"""Ядро приёма заказа ОЗОТЭНС: проверка и расчёт на стороне сервера.

Правила проекта (CLAUDE.md, «Безопасность»):
  - сумма считается на сервере по прайсу `mockups/v11-app/prices.json`; цены и суммы из браузера не принимаются;
  - повтор запроса с тем же ключом идемпотентности не создаёт второй заказ;
  - ограничение частоты запросов;
  - текст пользователя хранится как текст и выводится как текст (не как HTML);
  - без согласий заказ не принимается; личные данные не пишем в логи.
Это чистая логика без сети и базы: её подключают к веб-серверу в РФ (план `plans/2026-10-10-multipage-shop.md`, фаза 4).
"""
import hashlib, hmac, json, pathlib, re, time

ROOT = pathlib.Path(__file__).resolve().parent.parent
MAX_LINES = 20
MAX_QTY = 9


class OrderError(ValueError):
    """Ошибка проверки заказа. Сообщение безопасно показывать человеку."""


def load_catalog(path=None):
    p = pathlib.Path(path) if path else ROOT / 'mockups/v11-app/prices.json'
    return json.loads(p.read_text(encoding='utf-8'))['items']


def calc_order(items, catalog):
    """items: [{'code': '85/04', 'size': 'M', 'qty': 2}, ...]. Возвращает строки и итог в рублях.
    Любые поля цены из входа игнорируются."""
    if not isinstance(items, list) or not items:
        raise OrderError('Заказ пустой')
    if len(items) > MAX_LINES:
        raise OrderError('Слишком много позиций')
    merged = {}
    for it in items:
        if not isinstance(it, dict):
            raise OrderError('Неверная позиция')
        code = str(it.get('code', ''))
        if code not in catalog:
            raise OrderError('Неизвестный товар')
        item = catalog[code]
        sizes = item.get('sizes') or []
        size = it.get('size') or ''
        if sizes and size not in sizes:
            raise OrderError('Выберите размер')
        if not sizes:
            size = ''
        qty = it.get('qty')
        if isinstance(qty, bool) or not isinstance(qty, int) or not 1 <= qty <= MAX_QTY:
            raise OrderError(f'Количество от 1 до {MAX_QTY}')
        key = (code, size)
        merged[key] = merged.get(key, 0) + qty
    lines = []
    total = 0
    for (code, size), qty in merged.items():
        if qty > MAX_QTY:
            raise OrderError(f'Количество от 1 до {MAX_QTY}')
        price = int(catalog[code]['price'])
        sum_ = price * qty
        total += sum_
        lines.append({'code': code, 'name': catalog[code]['short'], 'size': size, 'qty': qty, 'price': price, 'sum': sum_})
    return {'lines': lines, 'total': total}


PHONE = re.compile(r'\D')
EMAIL = re.compile(r'^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$')


def validate_customer(c):
    """Проверяет данные покупателя и согласия. Возвращает очищенный словарь."""
    if not isinstance(c, dict):
        raise OrderError('Нет данных покупателя')
    name = str(c.get('name', '')).strip()
    if not 2 <= len(name) <= 100:
        raise OrderError('Укажите имя')
    digits = PHONE.sub('', str(c.get('phone', '')))
    if len(digits) == 11 and digits[0] in '78':
        digits = digits[1:]
    if len(digits) != 10:
        raise OrderError('Проверьте номер телефона')
    email = str(c.get('email', '')).strip()
    if email and not EMAIL.match(email):
        raise OrderError('Проверьте почту')
    cons = c.get('consents') or {}
    if cons.get('personal_data') is not True or cons.get('offer') is not True:
        raise OrderError('Нужно согласие на обработку данных и принятие условий оферты')
    return {
        'name': name, 'phone': '+7' + digits, 'email': email,
        'city': str(c.get('city', '')).strip()[:100], 'comment': str(c.get('comment', '')).strip()[:1000],
        'consents': {'personal_data': True, 'offer': True, 'marketing': cons.get('marketing') is True},
    }


def clean_source(s):
    """Источник заявки обязателен (правило 4): UTM, промокод или unknown."""
    s = re.sub(r'[^\w.\-:/ ]', '', str(s or '').strip(), flags=re.U)[:120]
    return s or 'unknown'


class RateLimiter:
    """Не более `limit` запросов с одного ключа (IP) за `window` секунд."""

    def __init__(self, limit=5, window=60, now=time.monotonic):
        self.limit, self.window, self.now, self.hits = limit, window, now, {}

    def allow(self, key):
        t = self.now()
        recent = [x for x in self.hits.get(key, []) if t - x < self.window]
        if len(recent) >= self.limit:
            self.hits[key] = recent
            return False
        recent.append(t)
        self.hits[key] = recent
        return True


class OrderStore:
    """Хранилище заказов в памяти (для тестов). В боевой версии - таблица с уникальным индексом по ключу идемпотентности."""

    def __init__(self, catalog):
        self.catalog, self.orders, self.by_key = catalog, [], {}

    def create(self, payload, idem_key):
        key = str(idem_key or '')
        if not re.fullmatch(r'[A-Za-z0-9_\-]{16,64}', key):
            raise OrderError('Неверный ключ запроса')
        if key in self.by_key:  # повтор: возвращаем тот же заказ, второй не создаём
            return self.by_key[key], False
        if str(payload.get('website', '')).strip():  # ловушка для ботов: поле скрыто от людей
            raise OrderError('Заказ не принят')
        calc = calc_order(payload.get('items'), self.catalog)
        customer = validate_customer(payload.get('customer'))
        order = {'id': len(self.orders) + 1, 'lines': calc['lines'], 'total': calc['total'], 'customer': customer, 'source': clean_source(payload.get('source')), 'status': 'new'}
        self.orders.append(order)
        self.by_key[key] = order
        return order, True


def verify_webhook(body: bytes, signature: str, secret: bytes):
    """Подпись вебхука платёжного провайдера: HMAC-SHA256 от тела запроса, сравнение за постоянное время.
    Точный формат подписи берётся из документации выбранного провайдера."""
    expected = hmac.new(secret, body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, str(signature or ''))
