const root = document.querySelector('[data-offer-area]')?.closest('.offer-copy');
if (root) {
  const buttons = [...root.querySelectorAll('[data-problem]')];
  const area = root.querySelector('[data-offer-area]');
  const title = root.querySelector('[data-offer-title]');
  const name = root.querySelector('[data-offer-name]');
  const parts = root.querySelector('[data-offer-parts]');
  const price = root.querySelector('[data-offer-price]');
  const link = root.querySelector('[data-offer-link]');
  const catalog = new URL('catalog/', import.meta.url);
  const areas = {
    back: { sku: '85/04', name: 'СПИНА' },
    neck: { sku: '85/01', name: 'ШЕЯ' },
    shoulder: { sku: '85/02', name: 'ПЛЕЧО' },
    knee: { sku: '85/07', name: 'КОЛЕНО' },
    foot: { sku: '85/09', name: 'СТОПА' }
  };
  let problem = 'back';
  const money = value => new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
  const titles = {
    back: 'Болит <mark>спина?</mark>',
    pinch: '<mark>Защемление?</mark>',
    arthritis: '<mark>Артрит?</mark>',
    arthrosis: '<mark>Артроз?</mark>'
  };

  function render() {
    title.innerHTML = titles[problem];
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.problem === problem)));
    const selected = areas[area.value];
    if (!selected) {
      name.textContent = 'Какую область вы хотите посмотреть?';
      parts.textContent = 'Выберите область — покажем электрод, состав и цену комплекта.';
      price.textContent = '—';
      link.href = catalog.href + '#kits';
      link.textContent = 'Все комплектации ↗';
      return;
    }
    name.textContent = 'Комплект с электродом «' + selected.name + '»';
    parts.textContent = 'RoovJoy R-C3 + крем OZOTENS 30% + электрод ' + selected.sku;
    const total = Number(area.selectedOptions[0].dataset.total);
    price.textContent = Number.isFinite(total) && total > 0 ? money(total) : '—';
    link.href = catalog.href + '#kit-' + area.value;
    link.textContent = 'Посмотреть комплект ↗';
  }

  buttons.forEach(button => button.addEventListener('click', () => {
    problem = button.dataset.problem;
    if (problem === 'back') area.value = 'back';
    else area.value = '';
    render();
  }));
  area.addEventListener('change', render);
  render();
}

const dayClock = document.querySelector('[data-day-time]');
const dayEntries = document.querySelectorAll('.day-entries li');
if (dayClock && dayEntries.length) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      dayClock.textContent = entry.target.querySelector('b').textContent;
      dayEntries.forEach(item => item.classList.toggle('is-current', item === entry.target));
    }
  }, { rootMargin: '-25% 0px -35% 0px', threshold: 0 });
  dayEntries.forEach(entry => observer.observe(entry));
}
