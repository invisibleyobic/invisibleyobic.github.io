/* ОЗОТЭНС: меню на телефоне и поиск по сайту. Страницы читаются и без этого скрипта. */
(function(){
var b=document.getElementById('burger'),m=document.getElementById('menu');
if(b&&m)b.addEventListener('click',function(){var o=m.classList.toggle('open');b.setAttribute('aria-expanded',o)});
var box=document.getElementById('results');
if(!box)return;
var base=document.querySelector('link[href$="assets/site.css"]').getAttribute('href').replace('assets/site.css','');
var q=(new URLSearchParams(location.search).get('q')||'').trim();
var inp=document.getElementById('q2');if(inp)inp.value=q;
if(!q){box.textContent='Введите запрос: документ, электрод, доставка.';return}
function norm(s){return s.toLowerCase().replace(/ё/g,'е')}
function stem(w){return w.length>5?w.slice(0,w.length-2):w.length>3?w.slice(0,w.length-1):w}
var words=norm(q).split(/[^a-zа-я0-9]+/).filter(Boolean).map(stem);
fetch(base+'search-index.json').then(function(r){return r.json()}).then(function(idx){
 var res=idx.map(function(e){var t=norm(e.t),x=norm(e.x),s=0;words.forEach(function(w){if(t.indexOf(w)>-1)s+=3;if(x.indexOf(w)>-1)s+=1});
  var all=words.every(function(w){return t.indexOf(w)>-1||x.indexOf(w)>-1});return all?{e:e,s:s}:null}).filter(Boolean).sort(function(a,b){return b.s-a.s}).slice(0,30);
 box.textContent='';
 if(!res.length){box.textContent='Ничего не найдено. Попробуйте другое слово.';return}
 res.forEach(function(r){var a=document.createElement('a');a.className='res';a.href=base+r.e.u;var t=document.createElement('b');t.textContent=r.e.t;var s=document.createElement('small');s.textContent=r.e.x.slice(0,140);a.append(t,s);box.appendChild(a)})
}).catch(function(){box.textContent='Поиск сейчас недоступен. Разделы сайта открываются из меню.'});
})();
