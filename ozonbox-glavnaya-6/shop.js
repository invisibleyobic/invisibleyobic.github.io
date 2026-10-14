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
    ["anticellulit","Массажный крем для тела",1633,["body"],""],["sos-boks","Набор «СОС бокс»",1900,["sets","hair"],""],
    ["ozodermik-3","Озодермик 3%",1195,["face"],""],["ozodermik-5","Озодермик 5%",1303,["face"],""],["dnevnoy-krem","Дневной крем",1419,["face"],""],
  ];
  // факты из katalog/ (объём, артикул, состав набора); пустое - значит, не знаем
  const INFO = {
    "otri-6000": { kind: "Озонированное масло", art: "4X10", inside: ["Оливковое масло, насыщенное озонидами"] },
    "dnevnoy-krem": { kind: "Крем для лица", vol: "50 мл", art: "OB3" },
    "ochischenie": { kind: "Озоновая эмульсия для лица", vol: "90 мл", art: "OUDL1" },
    "anticellulit": { kind: "Массажный крем для тела", vol: "150 мл", art: "3Q15" },
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
    "idealnoe-telo": { kind: "Набор для тела", inside: ["Массажный крем для тела - 150 мл", "Крем для ног - 150 мл", "Озонированное масло - 25 мл"] },
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
  let st = { items: {}, promo: null };
  try { st = Object.assign(st, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  const count = () => Object.values(st.items).reduce((a, b) => a + b, 0);
  const subtotal = () => Object.entries(st.items).reduce((a, [id, q]) => a + byId[id][2] * q, 0);
  // скидка по коду - вниз до целого рубля, как в lib/orders/money.ts
  const discount = () => (st.promo && CODES[st.promo]?.pct ? Math.floor(subtotal() * CODES[st.promo].pct / 100) : 0);

  // каркас: подложка, карточка, корзина, окно скидки, тост
  document.body.insertAdjacentHTML("beforeend", `
    <div class="ov" id="ozbOv"></div>
    <section class="pd" id="ozbPd" role="dialog" aria-modal="true" aria-label="Карточка товара"></section>
    <aside class="cd" id="ozbCd" role="dialog" aria-modal="true" aria-label="Корзина"></aside>
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

  const add = (id, q = 1) => { st.items[id] = (st.items[id] || 0) + q; save(); sync(); say("В корзине: " + byId[id][1]); };
  const setQ = (id, q) => { if (q <= 0) delete st.items[id]; else st.items[id] = q; save(); sync(); };

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
        <div class="pd__mp">Привычнее на маркетплейсе? <a href="${MP.ozon}" target="_blank" rel="noopener">Ozon</a><a href="${MP.wb}" target="_blank" rel="noopener">Wildberries</a></div>
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
      cd.innerHTML = head("Заказ") + `<div class="cd__body"><div class="done"><span class="done__i"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg></span><h3>Заказ принят</h3><p class="note">Номер ${st.last}. Это демонстрация: оплата и передача заказа в магазин подключаются отдельно.</p><button class="btn btn--acid press" type="button" data-close>Вернуться в магазин</button></div></div>`;
      return;
    }
    if (!ids.length) { step = "cart"; cd.innerHTML = head("Корзина") + `<div class="cd__body"><div class="cd__empty">Пока пусто<button class="btn btn--acid press" type="button" data-close data-go-cat>В каталог ${ARR}</button></div></div>`; return; }
    const sumBlock = (btn) => `<div class="sum"><div><span>Товары, ${count()} шт.</span><span>${rub(sub)}</span></div>${dis ? `<div><span>Скидка по коду ${st.promo}</span><span>−${rub(dis)}</span></div>` : ""}<div class="tot"><span>Итого</span><span>${rub(sub - dis)}</span></div>${btn}</div>`;
    if (step === "contacts") {
      cd.innerHTML = head("<em>Ваши</em> контакты") + `<div class="cd__body">${steps(1)}<label class="fld">Имя<input id="fName" autocomplete="name" placeholder="Как к вам обращаться"></label><label class="fld">Телефон<input id="fTel" type="tel" autocomplete="tel" placeholder="+7"></label><p class="note">Демонстрация: данные не сохраняются и никуда не отправляются.</p></div>` + sumBlock(`<button class="btn btn--acid press" type="button" data-step="delivery">Дальше: доставка ${ARR}</button><button class="btn btn--sm press" type="button" data-step="cart">Назад</button>`);
      return;
    }
    if (step === "delivery") {
      const o = (v, t, s, c) => `<label class="opt"><input type="radio" name="dl" value="${v}" ${c ? "checked" : ""}><span>${t}<small>${s}</small></span></label>`;
      cd.innerHTML = head("<em>Как</em> доставить") + `<div class="cd__body">${steps(2)}${o("cour", "Курьер до двери", "срок и цену покажем после подключения служб", 1)}${o("pvz", "Пункт выдачи", "выбор пункта на карте", 0)}${o("post", "Почта", "в любой город", 0)}<p class="note">Всего у магазина 7 способов доставки - список служб подключим вместе с оплатой.</p></div>` + sumBlock(`<button class="btn btn--acid press" type="button" data-step="done">Оформить заказ ${ARR}</button><button class="btn btn--sm press" type="button" data-step="contacts">Назад</button>`);
      return;
    }
    cd.innerHTML = head("<em>Ваша</em> корзина") + `<div class="cd__body">
      ${ids.map((id) => `<div class="ci"><img src="${img(id)}" alt=""><div><p>${esc(byId[id][1])}</p><small>${rub(byId[id][2])}</small></div><div class="qty"><button type="button" data-q="${id}" data-d="-1" aria-label="Меньше">−</button><b>${st.items[id]}</b><button type="button" data-q="${id}" data-d="1" aria-label="Больше">+</button></div></div>`).join("")}
      ${upsell()}
      <div><div class="code"><input id="ozbCode" placeholder="Код из ролика" value="${st.promo || ""}" aria-label="Код из ролика"><button class="btn btn--ink btn--sm press" type="button" data-code>Применить</button></div><p class="code__msg ${st.promo ? "ok" : ""}" id="ozbMsg">${st.promo ? "Код применён: −" + CODES[st.promo].pct + "%" : ""}</p></div>
    </div>` + sumBlock(`<button class="btn btn--acid press" type="button" data-step="contacts">Оформить ${ARR}</button>`);
  };
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
    if (d.add !== undefined && d.add) { e.preventDefault(); add(d.add); t.classList.add("done"); setTimeout(() => t.classList.remove("done"), 900); return; }
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
      const v = $("#ozbCode").value.trim().toUpperCase(), c = CODES[v], msg = $("#ozbMsg");
      if (!v) { st.promo = null; save(); renderCart(); return; }
      if (!c) { msg.className = "code__msg bad"; msg.textContent = "Такого кода нет. Проверьте написание"; return; }
      if (c.expired) { msg.className = "code__msg bad"; msg.textContent = "Срок действия этого кода закончился"; return; }
      st.promo = v; save(); renderCart(); return;
    }
    if (d.step) {
      if (d.step === "delivery") { const n = $("#fName"), p = $("#fTel"); if (n && (!n.value.trim() || p.value.replace(/\D/g, "").length < 10)) { (n.value.trim() ? p : n).focus(); say("Укажите имя и телефон"); return; } }
      if (d.step === "done") { st.last = "DEMO-" + String(Date.now()).slice(-5); st.items = {}; st.promo = null; save(); sync(); }
      step = d.step; renderCart(); cd.querySelector(".cd__body").scrollTop = 0; return;
    }
  });

  sync();
  if (location.hash.startsWith("#p=")) setTimeout(() => open(location.hash.slice(3)), 300);
  window.OZB = { P, INFO, byId, rub, open, add, openCart, openPromo };
})();
