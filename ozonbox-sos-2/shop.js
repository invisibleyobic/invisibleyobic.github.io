// Магазин-макет OzoneBox: каталог, карточка товара, корзина с подсказками наборов, скидка по коду, оформление.
// Это имитация пути покупателя: оплата и отправка заказа не подключены, данные никуда не уходят.
// Цены - копия Tilda (сентябрь 2026). Описания с Tilda не берём: в них медицинские обещания (katalog/README.md).
(() => {
  const P = [
    ["stop-akne","Бокс «Стоп акне»",1990,["face","sets"],"Хит"],["krem-pryschi","Крем точечного действия",967,["face"],"Хит"],
    ["super-kombo","Набор «Супер комбо»",4999,["face","sets"],"Хит"],["chistaya-kozha","Безупречно чистая кожа",2800,["face","sets"],""],
    ["super-trio","Набор «Супер трио»",2893,["face","sets"],""],["super-duet","Подарочный набор «Супер дуэт»",1976,["sets"],""],
    ["ochischenie","Озоновое очищение",1257,["face"],""],["set-lico","Сет для лица",4479,["face","sets"],""],
    ["otri-6000","Озонированное масло «Отри 6000»",899,["face","oils"],""],["shampun","Шампунь «Озодермис»",1205,["hair"],""],
    ["maska-shampun","Набор маска и шампунь",2352,["hair","sets"],""],["vosstanovlenie-volos","Полное восстановление волос",2490,["hair","sets"],""],
    ["maska-volosy","Озодермик, маска для волос",1306,["hair"],""],["idealnoe-telo","Идеальное тело",3500,["body","sets"],""],
    ["anticellulit","Антицеллюлитный массажный крем",1633,["body"],""],["sos-boks","Набор «SOS бокс»",1900,["sets","hair"],""],
    ["ozodermik-3","Озодермик 3%",1195,["face"],""],["ozodermik-5","Озодермик 5%",1303,["face"],""],["dnevnoy-krem","Дневной крем",1419,["face"],""],
  ];
  // факты из katalog/ (объём, артикул, состав набора); пустое - значит, не знаем
  const INFO = {
    "otri-6000": { kind: "Озонированное масло", art: "4X10", inside: ["Оливковое масло, насыщенное озонидами"] },
    "dnevnoy-krem": { kind: "Крем для лица", vol: "50 мл", art: "OB3" },
    "ochischenie": { kind: "Озоновая эмульсия для лица", vol: "90 мл", art: "OUDL1" },
    "anticellulit": { kind: "Антицеллюлитный массажный крем для тела", vol: "150 мл", art: "3Q15" },
    "ozodermik-3": { kind: "Крем", vol: "80 мл", art: "2D08" },
    "ozodermik-5": { kind: "Крем", vol: "50 мл", art: "2E050" },
    "krem-pryschi": { kind: "Крем точечного нанесения", vol: "20 мл", art: "2G02" },
    "maska-volosy": { kind: "Маска для волос", vol: "150 мл", art: "2A15" },
    "shampun": { kind: "Шампунь", vol: "200 мл", art: "2В20" },
    "stop-akne": { kind: "Набор", inside: ["Крем Озодермик 3% - 80 мл", "Озонированное масло «Отри» - 25 мл"] },
    "super-trio": { kind: "Набор из трёх средств", inside: ["Озоновая эмульсия", "Крем Озодермик 3%", "Озонированное масло «Отри»"] },
    "super-duet": { kind: "Подарочный набор", inside: ["Озоновая эмульсия", "Крем Озодермик 3%", "Подарочная упаковка"] },
    "chistaya-kozha": { kind: "Набор", inside: ["Дневной крем - 50 мл", "Ночной крем - 50 мл"] },
    "vosstanovlenie-volos": { kind: "Набор для волос", inside: ["Маска для структуры волос - 150 мл", "Маска для роста волос - 150 мл"] },
    "idealnoe-telo": { kind: "Набор для тела", inside: ["Антицеллюлитный массажный крем - 150 мл", "Крем для ног - 150 мл", "Озонированное масло - 25 мл"] },
    "super-kombo": { kind: "Набор", inside: ["Дневной крем", "Ночной крем", "Крем Озодермик 3%", "Озонированное масло «Отри»"] },
    "maska-shampun": { kind: "Набор для волос", inside: ["Шампунь «Озодермис» - 200 мл", "Маска для волос - 150 мл"] },
    "sos-boks": { kind: "Набор", inside: ["Маска для волос - 150 мл", "Крем Озодермик 5% - 50 мл"], page: "/ozonbox-sos-2/" },
    "set-lico": { kind: "Большой набор для лица", inside: ["Набор «Безупречно чистая кожа»", "Бокс «Стоп акне»"] },
  };
  // наборы, где состав точно совпадает с отдельными товарами: только по ним считаем выгоду в рублях
  const EXACT = { "maska-shampun": ["shampun", "maska-volosy"], "sos-boks": ["maska-volosy", "ozodermik-5"] };
  // мягкие подсказки без цифр: состав совпадает не до миллилитра
  const SOFT = { "ochischenie": "super-duet", "ozodermik-3": "stop-akne", "otri-6000": "stop-akne", "dnevnoy-krem": "chistaya-kozha", "anticellulit": "idealnoe-telo" };
  const CODES = { "OSEN-R1": { pct: 10 }, "OSEN-OLD": { expired: true } };
  // личный код из окна «Стойте!»: STAY12- и 4 знака, у каждого посетителя свой (размер скидки ждёт решения владельца)
  const EXIT_PCT = 12;
  const codeOf = (v) => CODES[v] || (/^STAY12-[A-Z0-9]{4}$/.test(v || "") ? { pct: EXIT_PCT } : undefined);
  const MP = { ozon: "https://www.ozon.ru/seller/ip-salmanov-rafael-hazranovich/", wb: "https://www.wildberries.ru/brands/ozonebox" };

  const byId = Object.fromEntries(P.map((p) => [p[0], p]));
  const rub = (n) => n.toLocaleString("ru-RU") + " ₽";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const img = (id) => (window.OZB_IMG || "img/") + id + ".webp";
  const $ = (s, r = document) => r.querySelector(s);
  const KEY = "ozb_demo_cart_v1";
  const X = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>`;
  const ARR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

  // состояние корзины - в браузере, общее для главной и лендингов
  let st = { items: {}, promo: null, dl: "pvz" };
  try { st = Object.assign(st, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
  // в корзине - только товары из каталога и целые количества: мусор из старых версий не ломает счётчик
  st.items = Object.fromEntries(Object.entries(st.items || {}).filter(([id, n]) => byId[id] && Number.isInteger(n) && n > 0));
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  const count = () => Object.values(st.items).reduce((a, b) => a + b, 0);
  const subtotal = () => Object.entries(st.items).reduce((a, [id, q]) => a + byId[id][2] * q, 0);
  // скидка по коду - вниз до целого рубля, как в lib/orders/money.ts
  const discount = () => (st.promo && codeOf(st.promo)?.pct ? Math.floor(subtotal() * codeOf(st.promo).pct / 100) : 0);

  // каркас: подложка, карточка, корзина, окно скидки, тост
  document.body.insertAdjacentHTML("beforeend", `
    <div class="ov" id="ozbOv"></div>
    <section class="pd" id="ozbPd" role="dialog" aria-modal="true" aria-label="Карточка товара"></section>
    <aside class="cd" id="ozbCd" role="dialog" aria-modal="true" aria-label="Корзина"></aside>
    <section class="sr" id="ozbSr" role="dialog" aria-modal="true" aria-label="Поиск"></section>
    <section class="ex" id="ozbEx" role="dialog" aria-modal="true" aria-label="Скидка перед уходом"></section>
    <section class="pm" id="ozbPm" role="dialog" aria-modal="true" aria-label="Скидка по коду"></section>
    <div class="toast" id="ozbToast" role="status"><i></i><span></span></div>`);
  const ov = $("#ozbOv"), pd = $("#ozbPd"), cd = $("#ozbCd"), pm = $("#ozbPm"), toast = $("#ozbToast");
  let openEl = null;
  const lock = (on) => (document.documentElement.style.overflow = on ? "hidden" : "");
  const show = (el) => { if (openEl && openEl !== el) openEl.classList.remove("on"); openEl = el; el.classList.add("on"); ov.classList.add("on"); lock(true); setTimeout(() => el.querySelector("button")?.focus({ preventScroll: true }), 60); };
  const hide = () => { if (openEl) openEl.classList.remove("on"); openEl = null; ov.classList.remove("on"); lock(false); if (location.hash.startsWith("#p=")) history.replaceState(null, "", location.pathname + location.search); };
  ov.addEventListener("click", hide);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && openEl) hide(); });

  let tt;
  const say = (t) => { toast.querySelector("span").textContent = t; toast.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove("on"), 1800); };

  const sync = () => {
    const n = count();
    document.querySelectorAll("#cnt").forEach((c) => { c.textContent = n; c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump"); });
    const dn = $("#dockN"); if (dn) dn.textContent = n;
    $("#dock")?.classList.toggle("on", n > 0);
    $("#cartBtn")?.setAttribute("aria-label", `Корзина, товаров: ${n}`);
    if (openEl === cd) renderCart();
  };

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // товар летит из карточки в счётчик корзины
  const fly = (fromImg, done) => {
    const to = $("#cnt") || $("#cartBtn");
    if (!fromImg || !to || reduce || !fromImg.animate) return done();
    const a = fromImg.getBoundingClientRect(), b = to.getBoundingClientRect();
    if (!a.width) return done();
    const f = fromImg.cloneNode(); f.removeAttribute("id");
    Object.assign(f.style, { position: "fixed", zIndex: 120, left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px", objectFit: "contain", pointerEvents: "none", borderRadius: "16px", margin: 0 });
    document.body.appendChild(f);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2), k = Math.max(24 / a.width, .08);
    f.animate([{ transform: "none", opacity: 1 }, { transform: `translate(${dx * .55}px, ${dy * .55 - 80}px) scale(${(1 + k) / 2}) rotate(-12deg)`, opacity: 1, offset: .55 }, { transform: `translate(${dx}px, ${dy}px) scale(${k}) rotate(-20deg)`, opacity: .4 }],
      { duration: 650, easing: "cubic-bezier(.5,0,.3,1)" }).onfinish = () => { f.remove(); done(); };
  };
  const add = (id, q = 1, fromImg) => fly(fromImg, () => { st.items[id] = (st.items[id] || 0) + q; save(); sync(); say("В корзине: " + byId[id][1]); });
  const setQ = (id, q) => { if (!byId[id] || !Number.isFinite(q)) return; if (q <= 0) delete st.items[id]; else st.items[id] = q; save(); sync(); };

  // карточка товара
  const related = (id) => {
    const out = [];
    for (const [set, parts] of Object.entries(EXACT)) if (parts.includes(id)) out.push(set);
    if (SOFT[id]) out.push(SOFT[id]);
    const cats = byId[id][3];
    P.forEach((p) => { if (p[0] !== id && !out.includes(p[0]) && p[3].some((c) => cats.includes(c))) out.push(p[0]); });
    return out.slice(0, 5);
  };
  const open = (id) => {
    const p = byId[id]; if (!p) return;
    const inf = INFO[id] || {};
    const facts = [["Что это", inf.kind], ["Объём", inf.vol], ["Артикул", inf.art]].filter((f) => f[1]);
    const save$ = EXACT[id] ? EXACT[id].reduce((a, c) => a + byId[c][2], 0) - p[2] : 0;
    pd.innerHTML = `
      <button class="pd__x press" type="button" data-close aria-label="Закрыть">${X}</button>
      <div class="pd__img"><img src="${img(id)}" alt="${esc(p[1])}" width="900" height="900"></div>
      <div class="pd__body">
        <p class="pd__kick">${p[4] ? "Хит · " : ""}${p[3].includes("sets") ? "Набор" : "OzoneBox"}</p>
        <h2>${esc(p[1])}</h2>
        ${facts.length ? `<dl class="pd__facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : ""}
        ${inf.inside ? `<ul class="pd__inside">${inf.inside.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
        ${save$ > 0 ? `<p class="up"><span class="up__t">Выгода набора</span><span>По отдельности - ${rub(save$ + p[2])}, в наборе - <b>${rub(p[2])}</b>. Разница ${rub(save$)}.</span></p>` : ""}
        <div class="pd__buy"><span class="pd__price">${rub(p[2])}</span>
          <button class="btn btn--acid press" type="button" data-add="${id}">В корзину ${ARR}</button>
          ${inf.page ? `<a class="btn btn--ink btn--sm press" href="${inf.page}">Страница набора</a>` : ""}</div>
        <div class="pd__mp">Привычнее на маркетплейсе? <a class="mp mp--ozon" href="${MP.ozon}" target="_blank" rel="noopener">Ozon</a><a class="mp mp--wb" href="${MP.wb}" target="_blank" rel="noopener">Wildberries</a></div>
        <div class="pd__with"><h3>С этим берут</h3><div class="mini">${related(id).map((r) => `<button type="button" data-open="${r}"><img src="${img(r)}" alt="" loading="lazy">${esc(byId[r][1])}<span>${rub(byId[r][2])}</span></button>`).join("")}</div></div>
      </div>`;
    pd.scrollTop = 0;
    history.replaceState(null, "", "#p=" + id);
    show(pd);
  };

  // корзина: список, подсказки наборов, код, итог; затем контакты - доставка - готово
  let step = "cart";
  const upsell = () => {
    const ids = Object.keys(st.items), out = [];
    for (const [set, parts] of Object.entries(EXACT)) {
      if (st.items[set]) continue;
      const have = parts.filter((c) => st.items[c]);
      if (!have.length) continue;
      const full = parts.reduce((a, c) => a + byId[c][2], 0), gain = full - byId[set][2];
      if (have.length === parts.length) out.push(`<div class="up"><span class="up__t">Вы ничего не упустили?</span><p>${parts.map((c) => byId[c][1]).join(" и ")} есть в наборе «${byId[set][1].replace(/^Набор\s*«?|»$/g, "")}» - на <b>${rub(gain)}</b> дешевле.</p><button class="btn btn--acid btn--sm press" type="button" data-swap="${set}">Заменить на набор</button></div>`);
      else { const miss = parts.find((c) => !st.items[c]); out.push(`<div class="up"><span class="up__t">Почти набор</span><p>Добавьте «${byId[miss][1].replace(/[«»]/g, "")}» - вместе это ${byId[set][1]} за ${rub(byId[set][2])}: на <b>${rub(gain)}</b> дешевле, чем по отдельности.</p><button class="btn btn--acid btn--sm press" type="button" data-swap="${set}">Взять набором</button></div>`); }
    }
    ids.forEach((id) => { const s = SOFT[id]; if (s && !st.items[s] && !out.some((o) => o.includes(`"${s}"`))) out.push(`<div class="up up--soft"><span class="up__t">К этому подходит</span><p>${byId[s][1]}: ${(INFO[s]?.inside || []).join(", ").toLowerCase()}.</p><button class="btn btn--ink btn--sm press" type="button" data-open="${s}">Посмотреть</button></div>`); });
    return out.slice(0, 2).join("");
  };
  const renderCart = () => {
    const ids = Object.keys(st.items), sub = subtotal(), dis = discount();
    const head = (t) => `<div class="cd__head"><h2>${t}</h2><button class="cd__x press" type="button" data-close aria-label="Закрыть">${X}</button></div>`;
    const steps = (k) => `<div class="steps">${["Корзина", "Контакты", "Доставка"].map((t, i) => `<span class="${i <= k ? "on" : ""}">${t}</span>`).join("")}</div>`;
    if (step === "done") {
      const ids = st.flyIds || [];
      cd.innerHTML = head("Заказ") + `<div class="cd__body"><div class="done">
        <div class="bag" id="ozbBag">${ids.map((id, k) => `<img class="bag__it" src="${img(id)}" alt="" style="--k:${k}">`).join("")}
          <svg class="bag__svg" viewBox="0 0 120 120" aria-hidden="true"><path d="M22 44h76l-7 60a8 8 0 0 1-8 7H37a8 8 0 0 1-8-7L22 44Z" fill="#0e0f0d"/><path d="M42 44V36a18 18 0 0 1 36 0v8" fill="none" stroke="#0e0f0d" stroke-width="7" stroke-linecap="round"/><path d="M22 44h76" stroke="#46e62e" stroke-width="7" stroke-linecap="round"/></svg>
          <span class="bag__ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg></span></div>
        <h3 class="done__t">Заказ принят</h3><p class="note done__t">Номер ${st.last}. Это демонстрация: оплата и передача заказа в магазин подключаются отдельно.</p><button class="btn btn--acid press done__t" type="button" data-close>Вернуться в магазин</button></div></div>`;
      const bag = $("#ozbBag"), its = [...bag.querySelectorAll(".bag__it")];
      if (reduce || !bag.animate) { bag.classList.add("full"); return; }
      its.forEach((el, k) => {
        const sx = (k % 2 ? 1 : -1) * (60 + (k * 37) % 90), sy = -170 - (k * 23) % 60;
        el.animate([{ transform: `translate(${sx}px, ${sy}px) rotate(${sx / 4}deg) scale(1)`, opacity: 0 }, { opacity: 1, offset: .2 }, { transform: `translate(${sx * .3}px, ${sy * .5}px) rotate(${sx / 8}deg) scale(.9)`, offset: .55 }, { transform: "translate(0, 18px) scale(.35)", opacity: 0 }],
          { duration: 760, delay: 120 + k * 110, easing: "cubic-bezier(.45,0,.25,1)", fill: "both" });
      });
      const t = 120 + its.length * 110 + 600;
      bag.querySelector(".bag__svg").animate([{ transform: "scale(1)" }, { transform: "scale(1.08,.92)" }, { transform: "scale(.97,1.04)" }, { transform: "scale(1)" }], { duration: 420, delay: t, easing: "ease-out" });
      setTimeout(() => bag.classList.add("full"), t + 200);
      return;
    }
    if (!ids.length) { step = "cart"; cd.innerHTML = head("Корзина") + `<div class="cd__body"><div class="cd__empty">Пока пусто<button class="btn btn--acid press" type="button" data-close data-go-cat>В каталог ${ARR}</button></div></div>`; return; }
    const sumBlock = (btn) => `<div class="sum"><div><span>Товары, ${count()} шт.</span><span>${rub(sub)}</span></div>${dis ? `<div><span>Скидка по коду ${st.promo}</span><span>−${rub(dis)}</span></div>` : ""}<div class="tot"><span>Итого</span><span>${rub(sub - dis)}</span></div>${btn}</div>`;
    if (step === "contacts") {
      cd.innerHTML = head("<em>Ваши</em> контакты") + `<div class="cd__body">${steps(1)}<label class="fld">Имя<input id="fName" autocomplete="name" placeholder="Как к вам обращаться"></label><label class="fld">Телефон<input id="fTel" type="tel" autocomplete="tel" placeholder="+7"></label><p class="note">Демонстрация: данные не сохраняются и никуда не отправляются.</p></div>` + sumBlock(`<button class="btn btn--acid press" type="button" data-step="delivery">Дальше: доставка ${ARR}</button><button class="btn btn--sm press" type="button" data-step="cart">Назад</button>`);
      return;
    }
    if (step === "delivery") {
      const o = (v, t, sub) => `<label class="opt"><input type="radio" name="dl" value="${v}" ${st.dl === v ? "checked" : ""}><span>${t}<small>${sub}</small></span></label>`;
      cd.innerHTML = head("<em>Как</em> доставить") + `<div class="cd__body">${steps(2)}${o("cour", "Курьер до двери", "выберите день и время")}${o("pvz", "Пункт выдачи", "выбор на карте")}${o("post", "Почта", "в любой город")}<div class="dl" id="ozbDl"></div><p class="note">Всего у магазина 7 способов доставки. Сроки и цены покажем, когда подключим службы доставки.</p></div>` + sumBlock(`<button class="btn btn--acid press" type="button" data-step="done">Оформить заказ ${ARR}</button><button class="btn btn--sm press" type="button" data-step="contacts">Назад</button>`);
      renderDl();
      return;
    }
    cd.innerHTML = head("<em>Ваша</em> корзина") + `<div class="cd__body">
      ${ids.map((id) => `<div class="ci"><img src="${img(id)}" alt=""><div><p>${esc(byId[id][1])}</p><small>${rub(byId[id][2])}</small></div><div class="qty"><button type="button" data-q="${id}" data-d="-1" aria-label="Меньше">−</button><b>${st.items[id]}</b><button type="button" data-q="${id}" data-d="1" aria-label="Больше">+</button></div></div>`).join("")}
      ${upsell()}
      <div><div class="code"><input id="ozbCode" placeholder="Код из ролика" value="${st.promo || ""}" aria-label="Код из ролика"><button class="btn btn--ink btn--sm press" type="button" data-code>Применить</button></div><p class="code__msg ${st.promo ? "ok" : ""}" id="ozbMsg">${st.promo ? "Код применён: −" + codeOf(st.promo).pct + "%" : ""}</p></div>
    </div>` + sumBlock(`<button class="btn btn--acid press" type="button" data-step="contacts">Оформить ${ARR}</button>`);
  };
  // детали выбранной доставки
  const DAYS = ["Завтра", "Послезавтра", "Через 3 дня"], SLOTS = ["10-14", "14-18", "18-22"];
  // демо-точки на карте: условные, не реальные пункты
  const PVZ = [[55.7601, 37.6186], [55.7522, 37.5928], [55.7700, 37.6400], [55.7395, 37.6290], [55.7810, 37.5980], [55.7460, 37.6650]].map((c, i) => ({ id: i + 1, c, name: "Демо-пункт " + (i + 1) }));
  let map;
  const loadLeaflet = (cb) => {
    if (window.L) return cb();
    const base = (window.OZB_VENDOR || "vendor/") + "leaflet/";
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = base + "leaflet.css"; document.head.appendChild(l);
    const sc = document.createElement("script"); sc.src = base + "leaflet.js"; sc.onload = cb; document.head.appendChild(sc);
  };
  const renderDl = () => {
    const box = $("#ozbDl"); if (!box) return;
    if (st.dl === "cour") {
      box.innerHTML = `<label class="fld">Адрес<input id="fAddr" autocomplete="street-address" placeholder="Улица, дом, квартира" value="${esc(st.addr || "")}"></label>
        <div class="chips2">${DAYS.map((d) => `<button type="button" class="chip2 ${st.day === d ? "on" : ""}" data-day="${d}">${d}</button>`).join("")}</div>
        <div class="chips2">${SLOTS.map((t) => `<button type="button" class="chip2 ${st.slot === t ? "on" : ""}" data-slot="${t}">${t}</button>`).join("")}</div>`;
    } else if (st.dl === "pvz") {
      box.innerHTML = `<div class="map" id="ozbMap"><span class="map__load">Загружаем карту…</span></div><p class="pick" id="ozbPick">${st.pvz ? "Выбран: " + PVZ[st.pvz - 1].name : "Нажмите на точку на карте"}</p>`;
      loadLeaflet(() => {
        if (map) { map.remove(); map = null; }
        map = L.map("ozbMap", { zoomControl: false, attributionControl: true }).setView([55.758, 37.62], 12);
        const esri = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_";
        L.tileLayer(esri + "Base/MapServer/tile/{z}/{y}/{x}", { maxZoom: 16, attribution: "Esri, HERE, Garmin, © OpenStreetMap" }).addTo(map);
        L.tileLayer(esri + "Reference/MapServer/tile/{z}/{y}/{x}", { maxZoom: 16 }).addTo(map);
        L.control.zoom({ position: "bottomright" }).addTo(map);
        map.attributionControl.setPrefix("Leaflet");
        $("#ozbMap .map__load")?.remove();
        PVZ.forEach((p) => {
          const icon = L.divIcon({ className: "", html: `<span class="pin ${st.pvz === p.id ? "on" : ""}" data-pin="${p.id}"></span>`, iconSize: [26, 26], iconAnchor: [13, 26] });
          L.marker(p.c, { icon }).addTo(map).on("click", () => { st.pvz = p.id; save(); document.querySelectorAll(".pin").forEach((x) => x.classList.toggle("on", +x.dataset.pin === p.id)); $("#ozbPick").textContent = "Выбран: " + p.name; });
        });
        setTimeout(() => map.invalidateSize(), 60);
      });
    } else if (st.dl === "post") {
      box.innerHTML = `<label class="fld">Индекс<input id="fZip" inputmode="numeric" maxlength="6" placeholder="6 цифр" value="${esc(st.zip || "")}"></label><label class="fld">Адрес<input id="fPAddr" placeholder="Город, улица, дом" value="${esc(st.paddr || "")}"></label>`;
    } else box.innerHTML = "";
  };
  cd.addEventListener("change", (e) => { if (e.target.name === "dl") { st.dl = e.target.value; save(); renderDl(); } });
  cd.addEventListener("input", (e) => { const m = { fAddr: "addr", fZip: "zip", fPAddr: "paddr" }[e.target.id]; if (m) { st[m] = e.target.value; save(); } });
  cd.addEventListener("click", (e) => {
    const d = e.target.closest("[data-day],[data-slot]"); if (!d) return;
    if (d.dataset.day) st.day = d.dataset.day; else st.slot = d.dataset.slot; save(); renderDl();
  });

  const openCart = () => { step = st.last && step === "done" ? "cart" : step === "done" ? "cart" : step; renderCart(); show(cd); };

  // окно «забрать скидку»
  const openPromo = () => {
    pm.innerHTML = `<button class="pd__x press" type="button" data-close aria-label="Закрыть">${X}</button>
      <h2>Заберите <b>−10%</b><br>на весь заказ</h2>
      <ol><li>Подпишитесь на наш канал в Telegram</li><li>Нажмите кнопку ниже - покажем код</li><li>Введите код в корзине</li></ol>
      <a class="btn btn--acid press" href="#" data-tg>Открыть Telegram-канал ${ARR}</a>
      <button class="btn btn--white press" type="button" data-reveal>Я подписался - показать код</button>
      <div class="pm__code" id="ozbPmCode"><b>OSEN-R1</b><button class="btn btn--acid btn--sm press" type="button" data-apply="OSEN-R1">Применить</button></div>
      <p class="note">Макет: ссылка на канал и проверка подписки появятся вместе с Telegram-ботом. Условия акции опубликуем на сайте.</p>`;
    show(pm);
  };

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-add],[data-open],[data-close],[data-q],[data-swap],[data-step],[data-code],[data-apply],[data-reveal],[data-cart],[data-promo],[data-tg]");
    if (!t) return;
    const d = t.dataset;
    if (d.add !== undefined && d.add) { e.preventDefault(); add(d.add, 1, t.closest(".card,.pd,.t,.hero,.sos,.hit")?.querySelector(".card__img img,.pd__img img,.obj img,.hero__slide.on img,img")); t.classList.add("done"); setTimeout(() => t.classList.remove("done"), 900); return; }
    if (d.open) { e.preventDefault(); open(d.open); return; }
    if (d.cart !== undefined) { e.preventDefault(); openCart(); return; }
    if (d.promo !== undefined) { e.preventDefault(); openPromo(); return; }
    if (d.tg !== undefined) { e.preventDefault(); say("Ссылка на канал появится вместе с ботом"); return; }
    if (d.close !== undefined) { const goCat = d.goCat !== undefined; if (openEl === cd && step === "done") { step = "cart"; } hide(); if (goCat) document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" }); return; }
    if (d.q) { setQ(d.q, (st.items[d.q] || 0) + +d.d); return; }
    if (d.swap) { (EXACT[d.swap] || []).forEach((c) => { if (st.items[c]) setQ(c, st.items[c] - 1); }); add(d.swap); return; }
    if (d.reveal !== undefined) { $("#ozbPmCode").classList.add("on"); return; }
    if (d.apply) { st.promo = d.apply; save(); hide(); say("Код " + d.apply + " применится в корзине"); return; }
    if (d.code !== undefined) {
      const v = $("#ozbCode").value.trim().toUpperCase(), c = codeOf(v), msg = $("#ozbMsg");
      if (!v) { st.promo = null; save(); renderCart(); return; }
      if (!c) { msg.className = "code__msg bad"; msg.textContent = "Такого кода нет. Проверьте написание"; return; }
      if (c.expired) { msg.className = "code__msg bad"; msg.textContent = "Срок действия этого кода закончился"; return; }
      st.promo = v; save(); renderCart(); return;
    }
    if (d.step) {
      if (d.step === "delivery") { const n = $("#fName"), p = $("#fTel"); if (n && (!n.value.trim() || p.value.replace(/\D/g, "").length < 10)) { (n.value.trim() ? p : n).focus(); say("Укажите имя и телефон"); return; } }
      if (d.step === "done") {
        if (!st.dl) { say("Выберите способ доставки"); return; }
        if (st.dl === "pvz" && !st.pvz) { say("Выберите пункт на карте"); return; }
        if (st.dl === "cour" && (!(st.addr || "").trim() || !st.day || !st.slot)) { say("Укажите адрес, день и время"); return; }
        if (st.dl === "post" && (!/^\d{6}$/.test(st.zip || "") || !(st.paddr || "").trim())) { say("Укажите индекс и адрес"); return; }
        st.flyIds = Object.entries(st.items).flatMap(([id, q]) => Array(Math.min(q, 3)).fill(id)).slice(0, 8);
        st.last = "DEMO-" + String(Date.now()).slice(-5); st.items = {}; st.promo = null; save(); sync();
      }
      step = d.step; renderCart(); cd.querySelector(".cd__body").scrollTop = 0; return;
    }
  });

  // поиск: строка сверху, подсказки «Часто ищут», своя история (в браузере), результаты по мере ввода
  const sr = $("#ozbSr"), HKEY = "ozb_search_hist_v1";
  const CAT = { face: "лицо кожа", hair: "волосы кожа головы", body: "тело", oils: "масло", sets: "набор наборы подарок" };
  const EXTRA = { "stop-akne": "акне прыщи", "krem-pryschi": "акне прыщи точечно", "super-duet": "подарок упаковка", "sos-boks": "sos сос срочно" };
  const POP = ["Лицо", "Крем", "Волосы", "Тело", "Масло", "Наборы", "Акне", "Подарок"];
  const hay = Object.fromEntries(P.map(([id, name, , cats]) => {
    const inf = INFO[id] || {};
    return [id, [name, inf.kind, (inf.inside || []).join(" "), cats.map((c) => CAT[c]).join(" "), EXTRA[id] || ""].join(" ").toLowerCase().replace(/ё/g, "е")];
  }));
  // грубое русское окончание: «кремы» найдёт «крем», «лицо» - «лица»
  const stem = (w) => w.length > 4 ? w.slice(0, Math.max(4, w.length - 2)) : w.length > 3 ? w.slice(0, 3) : w;
  const STOP = new Set(["для", "и", "с", "со", "на", "от", "в", "во", "по", "к"]);
  const find = (q) => {
    const ws = q.toLowerCase().replace(/ё/g, "е").split(/[^a-zа-я0-9%]+/).filter((w) => w && !STOP.has(w)).map(stem);
    if (!ws.length) return [];
    // сначала товары, у которых слово в названии или виде товара, потом наборы, где оно в составе
    const inName = (p) => ws.every((w) => (p[1] + " " + (INFO[p[0]]?.kind || "")).toLowerCase().replace(/ё/g, "е").includes(w)) ? 0 : 1;
    return P.filter(([id]) => ws.every((w) => hay[id].includes(w))).sort((a, b) => inName(a) - inName(b));
  };
  let hist = [];
  try { hist = JSON.parse(localStorage.getItem(HKEY) || "[]"); } catch (e) {}
  const remember = (q) => { q = q.trim(); if (q.length < 2) return; hist = [q, ...hist.filter((h) => h.toLowerCase() !== q.toLowerCase())].slice(0, 6); try { localStorage.setItem(HKEY, JSON.stringify(hist)); } catch (e) {} };
  const LENS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>`;
  const CLOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>`;
  sr.innerHTML = `<div class="sr__bar">${LENS}<input id="ozbQ" type="search" placeholder="Что ищем?" autocomplete="off" enterkeyhint="search" aria-label="Что ищем?"><button class="sr__x press" type="button" data-sr-close aria-label="Закрыть">${X}</button></div><div class="sr__body" id="ozbSrBody"></div>`;
  const q = $("#ozbQ"), body = $("#ozbSrBody");
  const chips = (arr, ico) => `<div class="sr__chips">${arr.map((t) => `<button class="sr__chip press" type="button" data-sq="${esc(t)}">${ico || ""}${esc(t)}</button>`).join("")}</div>`;
  const renderSr = () => {
    const v = q.value.trim();
    if (!v) {
      body.innerHTML = (hist.length ? `<div class="sr__h"><h3>Вы искали</h3><button type="button" data-sr-clear>Очистить</button></div>${chips(hist, CLOCK)}` : "")
        + `<div class="sr__h"><h3>Часто ищут</h3></div>${chips(POP)}`;
      return;
    }
    const r = find(v);
    body.innerHTML = r.length
      ? `<div class="sr__h"><h3>Нашли: ${r.length}</h3></div><ul class="sr__list">${r.map(([id, name, price]) => `<li><button class="sr__it press" type="button" data-sr-open="${id}"><img src="${img(id)}" alt="" width="56" height="56" loading="lazy"><span>${esc(name)}<small>${esc(INFO[id]?.kind || "")}</small></span><b>${rub(price)}</b></button></li>`).join("")}</ul>`
      : `<div class="sr__none"><p>По запросу «${esc(v)}» ничего не нашли</p><span>Попробуйте одно слово: лицо, волосы, тело, масло</span></div>${chips(POP)}`;
  };
  const openSearch = () => { q.value = ""; renderSr(); show(sr); setTimeout(() => q.focus({ preventScroll: true }), 80); };
  q.addEventListener("input", renderSr);
  q.addEventListener("keydown", (e) => { if (e.key === "Enter") { remember(q.value); const r = find(q.value); if (r.length === 1) open(r[0][0]); else q.blur(); } });
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[aria-label='Поиск'],[data-search]");
    if (t && !sr.contains(t)) { e.preventDefault(); openSearch(); return; }
    if (!sr.contains(e.target)) return;
    const c = e.target.closest("[data-sq]"); if (c) { q.value = c.dataset.sq; renderSr(); q.focus({ preventScroll: true }); return; }
    const o = e.target.closest("[data-sr-open]"); if (o) { remember(q.value); open(o.dataset.srOpen); return; }
    if (e.target.closest("[data-sr-clear]")) { hist = []; try { localStorage.removeItem(HKEY); } catch (er) {} renderSr(); return; }
    if (e.target.closest("[data-sr-close]")) hide();
  });

  // окно «Стойте!»: когда посетитель собирается уйти. Компьютер - мышь уходит к вкладкам и крестику;
  // телефон - резкий рывок вверх после того, как пролистал хотя бы полтора экрана. Один раз за визит,
  // не раньше 12 секунд и первого действия, не поверх других окон и не тем, у кого код уже применён.
  const ex = $("#ozbEx"), EKEY = "ozb_exit_v1";
  let exCode = "";
  try { exCode = localStorage.getItem("ozb_exit_code") || ""; } catch (e) {}
  if (!exCode) { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; exCode = "STAY12-" + Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join(""); try { localStorage.setItem("ozb_exit_code", exCode); } catch (e) {} }
  const RINGS = `<svg class="ex__rings" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="34"/><circle cx="100" cy="100" r="58"/><circle cx="100" cy="100" r="82"/><circle cx="148" cy="52" r="9"/><circle cx="46" cy="150" r="6"/><circle cx="160" cy="138" r="4"/></svg>`;
  const openExit = () => {
    try { sessionStorage.setItem(EKEY, "1"); } catch (e) {}
    ex.innerHTML = `<button class="pd__x press" type="button" data-close aria-label="Закрыть">${X}</button>
      <div class="ex__txt">
        <p class="ex__kick">Уже уходите?</p>
        <h2>Стойте!<br>Для вас есть <mark>скидка</mark></h2>
        <p class="ex__sub">Личный код на весь заказ. Переверните карточку - покажем размер.</p>
        <button class="ex__no press" type="button" data-close data-ex-no>Нет, спасибо</button>
      </div>
      <div class="ex__card" id="ozbExCard">
        <div class="ex__face ex__front">${RINGS}<span class="ex__lbl">Ваша скидка</span><b class="ex__q">?</b><button class="btn btn--ink press" type="button" data-ex-flip>Узнать скидку ${ARR}</button></div>
        <div class="ex__face ex__back" inert aria-hidden="true"><span class="ex__lbl">Ваша скидка</span><b class="ex__pct">−${EXIT_PCT}%</b><span class="ex__on">на весь заказ</span>
          <div class="ex__code"><b>${exCode}</b><button class="press" type="button" data-ex-copy aria-label="Скопировать код"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg></button></div>
          <button class="btn btn--acid press" type="button" data-apply="${exCode}">Применить в корзине ${ARR}</button></div>
      </div>
      <p class="note ex__note">Скидка на весь заказ, с другими кодами не суммируется. Макет: код работает в демо-корзине этого сайта, полные условия акции опубликуем на сайте.</p>`;
    show(ex);
  };
  const burst = (host) => {
    if (reduce) return;
    for (let i = 0; i < 14; i++) {
      const b = document.createElement("span"); b.className = "ex__bub"; const z = 10 + Math.random() * 22; b.style.width = b.style.height = z + "px"; host.appendChild(b);
      const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 120;
      b.animate([{ transform: "translate(-50%,-50%) scale(.2)", opacity: 0 }, { opacity: 1, offset: .25 }, { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r}px)) scale(1)`, opacity: 0 }],
        { duration: 900 + Math.random() * 500, easing: "cubic-bezier(.2,.7,.3,1)", fill: "both" }).onfinish = () => b.remove();
    }
  };
  let armed = false, acted = false;
  const t0 = Date.now();
  // «Нет, спасибо» - не показываем неделю; код применён - не показываем вовсе
  const ready = () => armed && acted && !openEl && !st.promo && Date.now() - t0 > 12000 && (() => { try { return !sessionStorage.getItem(EKEY) && Date.now() - (+localStorage.getItem("ozb_exit_no") || 0) > 7 * 864e5; } catch (e) { return false; } })();
  setTimeout(() => (armed = true), 12000);
  ["scroll", "click", "keydown", "touchstart"].forEach((ev) => addEventListener(ev, () => (acted = true), { once: true, passive: true }));
  // компьютер: мышь ушла за верхний край и не вернулась за 400 мс (потянулся к вкладкам и передумал - не считаем)
  let exT;
  document.addEventListener("mouseout", (e) => { if (!e.relatedTarget && e.clientY < 12 && ready()) { clearTimeout(exT); exT = setTimeout(() => ready() && openExit(), 400); } });
  document.addEventListener("mouseover", () => clearTimeout(exT));
  // телефон: один быстрый рывок вверх длиной больше экрана, который довёл до самого верха
  let ly = scrollY, lt = 0, runY = scrollY, runT = performance.now();
  addEventListener("scroll", () => {
    const y = scrollY, t = performance.now();
    if (y >= ly) { runY = y; runT = t; }
    else if (t - lt > 250) { runY = ly; runT = t - 16; } // пауза - новый рывок
    else if (matchMedia("(pointer: coarse)").matches && y < innerHeight * .5 && runY - y > innerHeight * 1.2 && (runY - y) / Math.max(1, t - runT) > 1.5 && ready()) openExit();
    ly = y; lt = t;
  }, { passive: true });
  ex.addEventListener("click", (e) => {
    if (e.target.closest("[data-ex-no]")) { try { localStorage.setItem("ozb_exit_no", Date.now()); } catch (er) {} }
    if (e.target.closest("[data-ex-flip]")) { const cdx = $("#ozbExCard"), bk = cdx.querySelector(".ex__back"), fr = cdx.querySelector(".ex__front"); bk.inert = false; bk.removeAttribute("aria-hidden"); fr.inert = true; fr.setAttribute("aria-hidden", "true"); cdx.classList.add("on"); burst($("#ozbExCard")); setTimeout(() => ex.querySelector("[data-apply]")?.focus({ preventScroll: true }), 500); }
    if (e.target.closest("[data-ex-copy]")) { navigator.clipboard?.writeText(exCode).then(() => say("Код " + exCode + " скопирован"), () => say("Код: " + exCode)); }
  });

  sync();
  if (location.hash.startsWith("#p=")) setTimeout(() => open(location.hash.slice(3)), 300);
  if (location.search.includes("exit")) setTimeout(openExit, 400);
  window.OZB = { P, INFO, byId, rub, open, add, openCart, openPromo, openSearch, openExit };
})();
