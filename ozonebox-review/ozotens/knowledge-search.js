const form = document.querySelector('[data-knowledge-search]');
if (form) {
  const base = new URL('.', import.meta.url);
  const input = form.querySelector('input[name="q"]');
  const list = form.querySelector('[role="listbox"]');
  const grid = document.querySelector('[data-knowledge-results]');
  const count = document.querySelector('[data-knowledge-count]');
  const empty = document.querySelector('[data-knowledge-empty]');
  const filters = [...document.querySelectorAll('[data-category-filter]')];
  const assistant = Boolean(grid?.hasAttribute('data-assistant-results'));
  let articles = [];
  let categories = new Map();
  let matches = [];
  let selectedCategory = 'all';
  let active = -1;
  let blurTimer;

  const normalize = value => value.toLocaleLowerCase('ru').replaceAll('ё', 'е').trim();
  const tokens = value => normalize(value).split(/[^a-zа-я0-9/]+/).filter(Boolean);
  const href = article => new URL(article.url, base).href;

  function closeSuggestions() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function selectActive(index) {
    const options = [...list.querySelectorAll('[role="option"]')];
    active = index;
    options.forEach((option, i) => option.setAttribute('aria-selected', String(i === index)));
    if (options[index]) {
      input.setAttribute('aria-activedescendant', options[index].id);
      options[index].scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }

  function rank(query) {
    const words = tokens(query);
    return articles.map(article => {
      const title = normalize(article.title);
      const keywords = normalize(article.keywords.join(' '));
      const text = normalize(article.title + ' ' + article.description + ' ' + article.keywords.join(' '));
      if (!words.every(word => text.includes(word))) return null;
      let score = words.reduce((value, word) => value + (title.includes(word) ? 8 : keywords.includes(word) ? 4 : 1), 0);
      if (title.startsWith(normalize(query))) score += 5;
      return { article, score };
    }).filter(Boolean).sort((a, b) => b.score - a.score).map(value => value.article);
  }

  function suggestionList(query) {
    list.replaceChildren();
    active = -1;
    input.removeAttribute('aria-activedescendant');
    if (!query || !matches.length) {
      closeSuggestions();
      return;
    }
    matches.slice(0, 7).forEach((article, index) => {
      const option = document.createElement('li');
      option.id = 'knowledge-option-' + index;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      const title = document.createElement('b');
      title.textContent = article.title;
      const detail = document.createElement('small');
      detail.textContent = categories.get(article.category) + ' · ' + article.readingMinutes + ' мин чтения';
      option.append(title, detail);
      option.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse') event.preventDefault();
      });
      option.addEventListener('click', () => { location.href = href(article); });
      list.appendChild(option);
    });
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function renderCard(article) {
    const link = document.createElement('a');
    link.className = 'knowledge-card';
    link.dataset.articleCard = '';
    link.dataset.slug = article.slug;
    link.dataset.category = article.category;
    link.href = href(article);
    const photo = document.createElement('div');
    photo.className = 'knowledge-card-photo';
    const image = document.createElement('img');
    image.src = new URL(article.cover, base).href;
    image.alt = '';
    image.loading = 'lazy';
    image.width = 1200;
    image.height = 800;
    const label = document.createElement('span');
    label.textContent = categories.get(article.category);
    photo.append(image, label);
    const copy = document.createElement('div');
    copy.className = 'knowledge-card-copy';
    const title = document.createElement('h2');
    title.textContent = article.title;
    const description = document.createElement('p');
    description.textContent = article.description;
    const meta = document.createElement('div');
    meta.className = 'knowledge-card-meta';
    const time = document.createElement('span');
    time.textContent = article.readingMinutes + ' мин чтения';
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    meta.append(time, arrow);
    copy.append(title, description, meta);
    link.append(photo, copy);
    return link;
  }

  function update(open = false) {
    const query = input.value.trim();
    matches = query ? rank(query) : articles;
    const visible = matches.filter(article => selectedCategory === 'all' || article.category === selectedCategory);
    if (assistant) {
      const rows = query ? visible : articles.filter(article => ['herniated-disc', 'osteoarthritis', 'tens-evidence'].includes(article.slug));
      grid.replaceChildren(...rows.map(renderCard));
      count.textContent = query ? 'Найдено: ' + visible.length : 'Выберите тему или введите вопрос';
    } else {
      grid.replaceChildren(...visible.map(renderCard));
      count.textContent = query || selectedCategory !== 'all' ? 'Найдено: ' + visible.length : articles.length + ' материалов';
    }
    empty.hidden = visible.length > 0;
    if (open) suggestionList(query);
    else closeSuggestions();
  }

  input.addEventListener('input', () => update(true));
  input.addEventListener('focus', () => {
    clearTimeout(blurTimer);
    if (input.value.trim()) suggestionList(input.value.trim());
  });
  input.addEventListener('blur', () => { blurTimer = setTimeout(closeSuggestions, 150); });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeSuggestions();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.hidden) suggestionList(input.value.trim());
      const options = list.querySelectorAll('[role="option"]');
      if (!options.length) return;
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      selectActive(active < 0 ? (direction > 0 ? 0 : options.length - 1) : (active + direction + options.length) % options.length);
    } else if (event.key === 'Enter' && active >= 0 && !list.hidden) {
      event.preventDefault();
      location.href = href(matches[active]);
    }
  });
  form.addEventListener('submit', event => {
    if (!articles.length) return;
    if (assistant) return;
    event.preventDefault();
    update(false);
    const url = new URL(location.href);
    const query = input.value.trim();
    if (query) url.searchParams.set('q', query);
    else url.searchParams.delete('q');
    history.replaceState(null, '', url);
    document.getElementById('library-title').scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  filters.forEach(button => button.addEventListener('click', () => {
    selectedCategory = button.dataset.categoryFilter;
    filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
    update(false);
  }));
  document.querySelectorAll('[data-query]').forEach(button => button.addEventListener('click', () => {
    input.value = button.dataset.query;
    selectedCategory = 'all';
    filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter.dataset.categoryFilter === 'all')));
    input.focus({ preventScroll: true });
    update(true);
  }));
  document.addEventListener('pointerdown', event => {
    if (!form.contains(event.target)) closeSuggestions();
  });

  try {
    const response = await fetch(new URL('editorial-data.json?v=1', base));
    if (!response.ok) throw new Error('Article index unavailable');
    const data = await response.json();
    articles = data.articles;
    categories = new Map(data.categories.map(category => [category.id, category.label]));
    input.value = new URLSearchParams(location.search).get('q') || '';
    update(false);
  } catch {
    count.textContent = 'Поиск временно недоступен. Статьи можно открыть из списка.';
  }
}
