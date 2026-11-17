// Каталог, поиск и список покупок OzoneBox.
// Цены - копия Tilda (сентябрь 2026). Описания с Tilda не берём: в них медицинские обещания (katalog/README.md).
(() => {
  const P = [
    ["stop-akne","Бокс «Стоп акне»",1830,["face","sets"],"Хит"],["krem-pryschi","Крем точечного действия",967,["face"],"Хит"],
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
    "sos-boks": { kind: "Набор", inside: ["Маска для волос - 150 мл", "Крем Озодермик 5% - 50 мл"], page: "../sos-box/index.html" },
    "set-lico": { kind: "Большой набор для лица", inside: ["Набор «Безупречно чистая кожа»", "Бокс «Стоп акне»"] },
  };
  // наборы, где состав точно совпадает с отдельными товарами: только по ним считаем выгоду в рублях
  const EXACT = { "maska-shampun": ["shampun", "maska-volosy"], "sos-boks": ["maska-volosy", "ozodermik-5"] };
  // мягкие подсказки без цифр: состав совпадает не до миллилитра
  const SOFT = { "ochischenie": "super-duet", "ozodermik-3": "stop-akne", "otri-6000": "stop-akne", "dnevnoy-krem": "chistaya-kozha", "anticellulit": "idealnoe-telo" };
  const byId = Object.fromEntries(P.map((p) => [p[0], p]));
  // ссылки на карточку товара на маркетплейсе, один в один. Заполнить по артикулам от Рафаэля (ВОПРОСЫ.md, 1.19):
  // "dnevnoy-krem": { ozon: "https://www.ozon.ru/product/...", wb: "https://www.wildberries.ru/catalog/АРТИКУЛ/detail.aspx" }
  const MPL = {};
  // пока ссылки на карточку нет - магазин продавца целиком (поиск по площадке выдавал чужие товары)
  const STORE = { ozon: "https://www.ozon.ru/seller/ip-salmanov-rafael-hazranovich/", wb: "https://www.wildberries.ru/seller/91509" };
  const mpUrl = (id, m) => MPL[id]?.[m] || STORE[m];
  const rub = (n) => n.toLocaleString("ru-RU") + " ₽";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const img = (id) => (window.OZB_IMG || "img/") + id + ".webp";
  const $ = (s, r = document) => r.querySelector(s);
  const KEY = "ozb_demo_cart_v1";
  const X = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>`;
  const ARR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

  // состояние корзины - в браузере, общее для главной и лендингов
  let st = { items: {} };
  try { st.items = JSON.parse(localStorage.getItem(KEY) || "{}").items || {}; } catch (e) {}
  // в корзине - только товары из каталога и целые количества: мусор из старых версий не ломает счётчик
  st.items = Object.fromEntries(Object.entries(st.items || {}).filter(([id, n]) => byId[id] && Number.isInteger(n) && n > 0));
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  const count = () => Object.values(st.items).reduce((a, b) => a + b, 0);
  // каркас: подложка, карточка, корзина, окно скидки, тост
  document.body.insertAdjacentHTML("beforeend", `
    <div class="ov" id="ozbOv"></div>
    <section class="pd" id="ozbPd" role="dialog" aria-modal="true" aria-label="Карточка товара"></section>
    <aside class="cd" id="ozbCd" role="dialog" aria-modal="true" aria-label="Список"></aside>
    <section class="sr" id="ozbSr" role="dialog" aria-modal="true" aria-label="Поиск"></section>
    <section class="sr ts" id="ozbTs" role="dialog" aria-modal="true" aria-label="Товары под задачу"></section>
    <div class="toast" id="ozbToast" role="status"><i></i><span></span></div>`);
  const ov = $("#ozbOv"), pd = $("#ozbPd"), cd = $("#ozbCd"), toast = $("#ozbToast");
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
    $("#cartBtn")?.setAttribute("aria-label", `Список, товаров: ${n}`);
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
  const add = (id, q = 1, fromImg) => fly(fromImg, () => { st.items[id] = (st.items[id] || 0) + q; save(); sync(); say("В списке: " + byId[id][1]); });
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
  // как применять, состав, важно знать - тексты с ozonbox.ru (texts.js), раскрываются по нажатию
  const txtBlock = (id) => {
    const t = (window.OZB_TXT || {})[id]; if (!t) return "";
    const part = (h, body) => body ? `<details class="pd__more"><summary>${h}</summary>${body}</details>` : "";
    const use = t.use.length ? `<ol>${t.use.map((u) => `<li>${esc(u)}</li>`).join("")}</ol>` : "";
    const comp = t.comp.map((c) => `<p>${c.t ? `<b>${esc(c.t)}:</b> ` : ""}${esc(c.v)}</p>`).join("");
    const notes = t.notes.length ? `<ul>${t.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : "";
    const all = part("Как применять", use) + part("Состав", comp) + part("Важно знать", notes);
    return all ? `<div class="pd__info">${all}</div>` : "";
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
          <button class="btn btn--acid press" type="button" data-add="${id}">В список ${ARR}</button>
          ${inf.page ? `<a class="btn btn--ink btn--sm press" href="${inf.page}">Страница набора</a>` : ""}</div>
        ${txtBlock(id)}
        <div class="pd__mp">Магазины продавца: <a class="mp mp--ozon" href="${mpUrl(id, "ozon")}" target="_blank" rel="noopener">Ozon</a><a class="mp mp--wb" href="${mpUrl(id, "wb")}" target="_blank" rel="noopener">Wildberries</a></div>
        <div class="pd__with"><h3>С этим берут</h3><div class="mini">${related(id).map((r) => `<button type="button" data-open="${r}"><img src="${img(r)}" alt="" loading="lazy">${esc(byId[r][1])}<span>${rub(byId[r][2])}</span></button>`).join("")}</div></div>
      </div>`;
    pd.scrollTop = 0;
    history.replaceState(null, "", "#p=" + id);
    show(pd);
  };

  // корзина: список, подсказки наборов, код, итог; затем контакты - доставка - готово
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
    const ids = Object.keys(st.items);
    const head = `<div class="cd__head"><h2>Список покупок</h2><button class="cd__x press" type="button" data-close aria-label="Закрыть">${X}</button></div>`;
    if (!ids.length) {
      cd.innerHTML = head + `<div class="cd__body"><div class="cd__empty">Пока пусто<button class="btn btn--acid press" type="button" data-close data-go-cat>В каталог ${ARR}</button></div></div>`;
      return;
    }
    cd.innerHTML = head + `<div class="cd__body">
      ${ids.map((id) => `<div class="ci"><img src="${img(id)}" alt=""><div><p>${esc(byId[id][1])}</p><small>${rub(byId[id][2])}</small></div><div class="qty"><button type="button" data-q="${id}" data-d="-1" aria-label="Меньше">−</button><b>${st.items[id]}</b><button type="button" data-q="${id}" data-d="1" aria-label="Больше">+</button></div></div>`).join("")}
      ${upsell()}
    </div><div class="sum"><p>Проверьте цены и наличие в магазинах продавца.</p>
      <div class="pd__mp"><a class="mp mp--ozon" href="${STORE.ozon}" target="_blank" rel="noopener">Ozon</a><a class="mp mp--wb" href="${STORE.wb}" target="_blank" rel="noopener">Wildberries</a></div>
    </div>`;
  };
  const openCart = () => { renderCart(); show(cd); };

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-add],[data-open],[data-close],[data-q],[data-swap],[data-cart]");
    if (!t) return;
    const d = t.dataset;
    if (d.add) {
      e.preventDefault();
      add(d.add, 1, t.closest(".card,.pd,.ts__row,.t,.hit,.hero,.sos")?.querySelector(".card__img img,.pd__img img,.obj img,.hero__slide.on img,img"));
      t.classList.add("done");
      setTimeout(() => t.classList.remove("done"), 900);
      return;
    }
    if (d.open) { e.preventDefault(); open(d.open); return; }
    if (d.cart !== undefined) { e.preventDefault(); openCart(); return; }
    if (d.close !== undefined) {
      hide();
      if (d.goCat !== undefined) document.getElementById("catalog")?.scrollIntoView({ behavior: "instant" });
      return;
    }
    if (d.q) { setQ(d.q, (st.items[d.q] || 0) + Number(d.d)); return; }
    if (d.swap) {
      (EXACT[d.swap] || []).forEach((id) => { if (st.items[id]) setQ(id, st.items[id] - 1); });
      add(d.swap);
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

  // главная 14: окно «товары под задачу» - открывается с плитки задачи, товары с кнопкой «В корзину»
  const ts = $("#ozbTs");
  const openList = (title, sub, ids, why = {}) => {
    ts.innerHTML = `<div class="sr__bar"><div class="ts__t"><h3>${esc(title)}</h3>${sub ? `<p>${esc(sub)}</p>` : ""}</div><button class="sr__x press" type="button" data-close aria-label="Закрыть">${X}</button></div>
      <div class="sr__body"><ul class="sr__list">${ids.filter((id) => byId[id]).map((id) => { const [, name, price] = byId[id];
        const save$ = EXACT[id] ? EXACT[id].reduce((a, c) => a + byId[c][2], 0) - price : 0;
        return `<li class="ts__row"><button class="sr__it press" type="button" data-open="${id}"><img src="${img(id)}" alt="" width="56" height="56" loading="lazy"><span>${esc(name)}<small>${esc(why[id] || INFO[id]?.kind || "")}</small></span></button>
        <div class="ts__buy"><b>${rub(price)}</b>${save$ > 0 ? `<em>выгода ${rub(save$)}</em>` : ""}<button class="btn btn--ink btn--sm press" type="button" data-add="${id}">В список</button></div></li>`; }).join("")}</ul></div>`;
    show(ts);
  };

  sync();
  if (location.hash.startsWith("#p=")) setTimeout(() => open(location.hash.slice(3)), 300);
  window.OZB = { P, INFO, byId, rub, open, add, openCart, openSearch, mpUrl, openList, EXACT };
})();
