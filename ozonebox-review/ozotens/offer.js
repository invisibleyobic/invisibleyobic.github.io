const root = document.querySelector('[data-offer-area]')?.closest('.offer-copy');
if (root) {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./home-refinements.css', import.meta.url).href;
  document.head.appendChild(stylesheet);
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
  const prompts = {
    back: {
      name: 'Какая область спины вас беспокоит?',
      description: 'Выберите область — покажем электрод, состав и цену комплекта.'
    },
    pinch: {
      name: 'Защемление: где вас беспокоит?',
      description: 'Сначала укажите область. Комплектации различаются формой электрода.'
    },
    arthritis: {
      name: 'Артрит: какую область хотите посмотреть?',
      description: 'Выберите сустав или область тела, чтобы сравнить комплектацию.'
    },
    arthrosis: {
      name: 'Артроз: какую область хотите посмотреть?',
      description: 'Выберите сустав или область тела — покажем компоненты и их общую стоимость.'
    }
  };
  const placeholder = area.querySelector('option[value=""]');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');

  function render() {
    title.innerHTML = titles[problem];
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.problem === problem)));
    const selected = areas[area.value];
    if (!selected) {
      name.textContent = prompts[problem].name;
      parts.textContent = prompts[problem].description;
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
    placeholder.textContent = problem === 'arthritis' || problem === 'arthrosis' ? 'Выберите сустав или область' : 'Выберите область';
    if (problem === 'back') area.value = 'back';
    else area.value = '';
    render();
    if (!motion.matches && window.gsap) {
      gsap.fromTo(root.querySelector('.quick-offer'), { opacity: .55 }, { opacity: 1, duration: .22, overwrite: true });
    }
  }));
  area.addEventListener('change', render);
  render();
}

if (document.querySelector('.day-section')) import('./day-motion.js');
