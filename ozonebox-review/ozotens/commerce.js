(() => {
  "use strict";
  const script = document.currentScript;
  const base = new URL(".", script.src);
  const key = "ozotens_cart_v1";
  const money = value => value.toLocaleString("ru-RU") + " ₽";
  const path = value => new URL(value, base).href;
  const catalogPromise = fetch(path("commerce-catalog.json")).then(response => {
    if (!response.ok) throw new Error("Не удалось загрузить каталог.");
    return response.json();
  });
  let catalog;
  let memoryCart = [];
  function readCart() {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return memoryCart; }
  }
  function normalizedCart() {
    const merged = new Map();
    for (const line of readCart()) {
      const item = catalog.items[line?.code];
      const size = typeof line?.size === "string" ? line.size : "";
      if (!item || (item.sizes.length ? !item.sizes.includes(size) : size !== "")) continue;
      const quantity = Number(line.qty);
      if (!Number.isFinite(quantity) || quantity < 1) continue;
      const id = line.code + "|" + size;
      const previous = merged.get(id);
      merged.set(id, {code: line.code, size, qty: Math.min(9, Math.floor(quantity) + (previous?.qty || 0))});
    }
    return [...merged.values()];
  }
  function save(cart) {
    memoryCart = cart;
    try { localStorage.setItem(key, JSON.stringify(cart)); }
    catch {
      document.querySelectorAll("[data-commerce-status],[data-add-message]").forEach(element => {
        element.textContent = "Браузер не сохраняет корзину между страницами. Разрешите локальное хранение данных.";
      });
    }
    updateCounts(cart);
    window.dispatchEvent(new CustomEvent("ozotens:cartchange", {detail: {count: cart.reduce((sum, line) => sum + line.qty, 0)}}));
  }
  function updateCounts(cart = normalizedCart()) {
    const count = cart.reduce((sum, line) => sum + line.qty, 0);
    document.querySelectorAll("[data-cart-count]").forEach(element => { element.textContent = count ? "(" + count + ")" : ""; });
  }
  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function link(label, href, className = "") {
    const element = node("a", className, label);
    element.href = href;
    return element;
  }
  function summary(cart) {
    const fragment = document.createDocumentFragment();
    fragment.append(node("h2", "", "Ваш заказ"));
    let total = 0;
    for (const line of cart) {
      const item = catalog.items[line.code];
      total += item.price * line.qty;
      fragment.append(node("p", "", item.name + (line.size ? ", " + line.size : "") + " × " + line.qty + " — " + money(item.price * line.qty)));
    }
    fragment.append(node("p", "cart-total", "Итого " + money(total)));
    fragment.append(node("p", "", "Цены ориентировочные. Доставка рассчитывается отдельно."));
    return fragment;
  }
  function renderCart() {
    const container = document.querySelector("[data-cart-body]");
    if (!container) return;
    container.replaceChildren();
    const cart = normalizedCart();
    if (!cart.length) {
      container.append(node("p", "lede", "Корзина пока пуста."), link("Открыть каталог", path("catalog/"), "button"));
      return;
    }
    const list = node("div", "cart-lines");
    cart.forEach((line, index) => {
      const item = catalog.items[line.code];
      const row = node("article", "cart-line");
      const image = node("img");
      image.src = path("img/" + item.image);
      image.alt = item.name;
      image.width = 180;
      image.height = 180;
      const detail = node("div");
      detail.append(link(item.name, path("catalog/" + item.slug + "/")), node("p", "", "Артикул " + line.code + (line.size ? " · Размер " + line.size : "")), node("p", "", money(item.price) + " за штуку"));
      const label = node("label", "", "Количество");
      const input = node("input");
      input.type = "number";
      input.min = "1";
      input.max = "9";
      input.value = line.qty;
      input.inputMode = "numeric";
      input.setAttribute("aria-label", "Количество " + item.name + (line.size ? ", " + line.size : ""));
      input.addEventListener("change", () => {
        if (!input.checkValidity() || !Number.isInteger(Number(input.value))) { input.reportValidity(); return; }
        const latest = normalizedCart();
        const target = latest.find(value => value.code === line.code && value.size === line.size);
        if (target) target.qty = Number(input.value);
        save(latest);
        setTimeout(renderCart, 0);
      });
      label.append(input);
      const remove = node("button", "button button-secondary", "Удалить");
      remove.type = "button";
      remove.setAttribute("aria-label", "Удалить " + item.name + (line.size ? ", " + line.size : ""));
      remove.addEventListener("click", () => {
        save(normalizedCart().filter(value => value.code !== line.code || value.size !== line.size));
        setTimeout(renderCart, 0);
      });
      row.append(image, detail, label, node("strong", "", money(item.price * line.qty)), remove);
      list.append(row);
    });
    const totals = node("div", "cart-summary");
    totals.append(summary(cart), link("Оформить заказ", path("checkout/"), "button"), link("Продолжить покупки", path("catalog/"), "button button-secondary"));
    container.append(list, totals);
  }
  function setupProduct() {
    const form = document.querySelector("[data-add-form]");
    if (!form) return;
    form.addEventListener("submit", event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const item = catalog.items[form.dataset.code];
      const size = form.elements.size?.value || "";
      if (!item || (item.sizes.length && !item.sizes.includes(size))) return;
      const qty = Number(form.elements.quantity.value);
      if (!Number.isInteger(qty) || qty < 1 || qty > 9) return;
      const cart = normalizedCart();
      const existing = cart.find(line => line.code === form.dataset.code && line.size === size);
      if (existing) existing.qty = Math.min(9, existing.qty + qty);
      else cart.push({code: form.dataset.code, size, qty});
      save(cart);
      const message = form.querySelector("[data-add-message]");
      message.replaceChildren(document.createTextNode("Добавлено. "), link("Открыть корзину", path("cart/")));
    });
  }
  function setupKits() {
    document.querySelectorAll("[data-kit-form]").forEach(form => {
      const electrode = form.elements.electrode;
      const size = form.elements.size;
      const refresh = () => {
        const item = catalog.items[electrode.value];
        size.replaceChildren();
        const label = form.querySelector("[data-kit-size-label]");
        label.hidden = !item.sizes.length;
        size.required = Boolean(item.sizes.length);
        if (item.sizes.length) {
          const placeholder = node("option", "", "Выберите размер");
          placeholder.value = "";
          size.append(placeholder);
          for (const value of item.sizes) {
            const option = node("option", "", value);
            option.value = value;
            size.append(option);
          }
        }
        form.querySelector("[data-kit-total]").textContent = money(catalog.items["85/31"].price + catalog.items["5T15"].price + item.price);
      };
      refresh();
      electrode.addEventListener("change", refresh);
      form.addEventListener("submit", async event => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const message = form.querySelector("[data-kit-message]");
        try {
          await window.OzotensShop.addKit({electrode: electrode.value, size: size.value, qty: 1});
          message.replaceChildren(document.createTextNode("Комплект добавлен. "), link("Открыть корзину", path("cart/")));
        } catch (error) { message.textContent = error.message; }
      });
    });
  }
  function setupCheckout() {
    const form = document.querySelector("[data-checkout-form]");
    if (!form) return;
    const cart = normalizedCart();
    const sum = document.querySelector("[data-checkout-summary]");
    sum.replaceChildren(summary(cart));
    const button = form.querySelector("[data-order-submit]");
    const enabled = Boolean(catalog.orders?.enabled && catalog.orders.endpoint);
    document.querySelector("[data-checkout-status]").textContent = enabled
      ? "Проверьте товары и укажите данные для доставки."
      : "Приём заказов и оплата пока не подключены. Товары сохраняются в корзине.";
    button.disabled = !enabled || !cart.length;
    if (!cart.length) {
      form.hidden = true;
      sum.replaceChildren(node("p", "", "Корзина пуста."), link("Открыть каталог", path("catalog/"), "button"));
    }
    let inFlight = false;
    const idempotency = crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("");
    form.onsubmit = async event => {
      event.preventDefault();
      if (!enabled || inFlight || !form.reportValidity()) return;
      const values = new FormData(form);
      const digits = String(values.get("phone")).replace(/\D/g, "");
      const message = form.querySelector("[data-order-message]");
      if (!/^(?:[78])?\d{10}$/.test(digits)) {
        message.textContent = "Проверьте номер телефона.";
        form.elements.phone.focus();
        return;
      }
      const items = normalizedCart();
      if (!items.length) { setupCheckout(); return; }
      inFlight = true;
      button.disabled = true;
      message.textContent = "Отправляем заказ…";
      const customer = {
        name: String(values.get("name")).trim(),
        phone: String(values.get("phone")).trim(),
        email: String(values.get("email")).trim(),
        city: String(values.get("city")).trim(),
        comment: ["Доставка: " + values.get("delivery"), "Адрес: " + values.get("address"), values.get("comment")].join("\n"),
        consents: {personal_data: form.elements.consent_pd.checked, offer: form.elements.consent_offer.checked, marketing: form.elements.consent_mk.checked}
      };
      try {
        const response = await fetch(catalog.orders.endpoint, {
          method: "POST",
          headers: {"Content-Type": "application/json", "Idempotency-Key": idempotency},
          body: JSON.stringify({items, customer, delivery: {method: values.get("delivery"), address: String(values.get("address")).trim()}, source: location.search.slice(1) || "unknown", website: values.get("website") || ""})
        });
        const result = await response.json();
        if (!response.ok || !result.order_id) throw new Error(result.error || "Не удалось подтвердить заказ. Попробуйте ещё раз.");
        if (result.payment_url) {
          const payment = new URL(result.payment_url, location.href);
          if (payment.protocol !== "https:") throw new Error("Не удалось открыть оплату.");
          message.replaceChildren(node("p", "", "Заказ " + result.order_id), link("Перейти к оплате", payment.href, "button"));
        } else message.textContent = "Заказ " + result.order_id + ". Ожидает подтверждения.";
      } catch (error) { message.textContent = error.message || "Нет связи. Попробуйте ещё раз."; }
      finally { inFlight = false; button.disabled = !enabled; }
    };
  }
  window.OzotensShop = {
    async product(code) {
      const data = await catalogPromise;
      return data.items[code];
    },
    async add({code, size = "", qty = 1}) {
      catalog = await catalogPromise;
      const item = catalog.items[code];
      if (!item) throw new Error("Выберите товар.");
      if (item.sizes.length && !item.sizes.includes(size)) throw new Error("Выберите размер.");
      if (!item.sizes.length) size = "";
      if (!Number.isInteger(qty) || qty < 1 || qty > 9) throw new Error("Количество должно быть от 1 до 9.");
      const cart = normalizedCart();
      const existing = cart.find(line => line.code === code && line.size === size);
      if (existing) existing.qty = Math.min(9, existing.qty + qty);
      else cart.push({code, size, qty});
      save(cart);
      renderCart();
      return cart;
    },
    async addKit({electrode, size = "", qty = 1}) {
      catalog = await catalogPromise;
      const item = catalog.items[electrode];
      if (!item || ["85/31", "5T15"].includes(electrode)) throw new Error("Выберите электрод.");
      if (item.sizes.length && !item.sizes.includes(size)) throw new Error("Выберите размер электрода.");
      if (!item.sizes.length) size = "";
      if (!Number.isInteger(qty) || qty < 1 || qty > 9) throw new Error("Количество должно быть от 1 до 9.");
      const cart = normalizedCart();
      for (const code of ["85/31", "5T15", electrode]) {
        const lineSize = code === electrode ? size : "";
        const existing = cart.find(line => line.code === code && line.size === lineSize);
        if (existing) existing.qty = Math.min(9, existing.qty + qty);
        else cart.push({code, size: lineSize, qty});
      }
      save(cart);
      renderCart();
      return cart;
    }
  };
  catalogPromise.then(value => {
    catalog = value;
    updateCounts();
    setupProduct();
    setupKits();
    renderCart();
    setupCheckout();
    window.addEventListener("storage", event => {
      if (event.key === key) { updateCounts(); renderCart(); setupCheckout(); }
    });
  }).catch(error => {
    document.querySelectorAll("[data-cart-body],[data-checkout-status],[data-add-message]").forEach(element => { element.textContent = error.message; });
  });
})();
