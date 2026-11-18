(() => {
  const script = document.currentScript;
  const base = new URL('.', script.src);
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-main-menu]');
  if (header) {
    const resize = () => document.documentElement.style.setProperty('--header-height', header.getBoundingClientRect().height + 'px');
    new ResizeObserver(resize).observe(header);
    resize();
  }
  if (toggle && menu) {
    document.documentElement.classList.add('has-menu-js');
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      header.toggleAttribute('data-menu-open', open);
    });
    menu.addEventListener('click', event => {
      if (!event.target.closest('a')) return;
      toggle.setAttribute('aria-expanded','false');
      header.removeAttribute('data-menu-open');
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !header.hasAttribute('data-menu-open')) return;
      toggle.setAttribute('aria-expanded','false');
      header.removeAttribute('data-menu-open');
      toggle.focus();
    });
  }
  const results = document.querySelector('[data-search-results]');
  if (!results) return;
  const query = (new URLSearchParams(location.search).get('q') || '').trim();
  document.querySelectorAll('[name="q"]').forEach(input => { input.value=query; });
  if (!query) {
    results.textContent='Введите название товара, артикул или свой вопрос.';
    return;
  }
  const norm = value => value.toLowerCase().replaceAll('ё','е');
  const stems = norm(query).split(/[^a-zа-я0-9/]+/).filter(Boolean).map(word => word.length>5?word.slice(0,-2):word);
  const add = (name,url,description) => {
    const card=document.createElement('a');card.className='search-result';card.href=new URL(url,base).href;
    const title=document.createElement('h2');title.textContent=name;
    const text=document.createElement('p');text.textContent=description;
    card.append(title,text);results.append(card);
  };
  fetch(new URL('search-index.json',base)).then(response=>{
    if(!response.ok)throw Error('Search unavailable');
    return response.json();
  }).then(index=>{
    const matched=index.map(entry=>{
      const title=norm(entry.title), full=norm(entry.title+' '+entry.keywords+' '+entry.description);
      if(!stems.every(word=>full.includes(word)))return null;
      return {entry,score:(entry.sku && norm(entry.sku)===norm(query)?30:0)+stems.reduce((sum,word)=>sum+(title.includes(word)?4:1),0)};
    }).filter(Boolean).sort((a,b)=>b.score-a.score).slice(0,30);
    results.textContent='';
    if(!matched.length){results.textContent='По запросу «'+query+'» ничего не найдено. Попробуйте название товара или артикул.';return;}
    const count=document.createElement('p');count.className='search-count';count.textContent='Найдено: '+matched.length;results.append(count);
    matched.forEach(({entry})=>add(entry.title,entry.url,entry.description));
  }).catch(()=>{results.textContent='Поиск временно недоступен. Каталог и материалы открываются из меню.';});
})();
