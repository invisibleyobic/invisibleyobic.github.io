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
(function(){
/* оттаивание морозной подложки под курсором или пальцем */
var RM=matchMedia('(prefers-reduced-motion:reduce)').matches;
[].forEach.call(document.querySelectorAll('.thaw'),function(el){
 var x=.5,y=.5,tx=.5,ty=.5,r=0,tr=0,raf=0,off=0;
 var layer=el.querySelector('.frostlayer');if(!layer)return;
 function set(){var m=r<1?'none':'radial-gradient(circle '+r.toFixed(1)+'px at '+(x*100).toFixed(1)+'% '+(y*100).toFixed(1)+'%,transparent 0,transparent 38%,#000 100%)';layer.style.webkitMaskImage=m;layer.style.maskImage=m}
 function loop(){r+=(tr-r)*(RM?1:.1);x+=(tx-x)*(RM?1:.22);y+=(ty-y)*(RM?1:.22);set();raf=(Math.abs(tr-r)>.5||Math.abs(tx-x)>.002||Math.abs(ty-y)>.002)?requestAnimationFrame(loop):0}
 function go(){if(!raf)raf=requestAnimationFrame(loop)}
 function pos(e){var b=el.getBoundingClientRect();tx=(e.clientX-b.left)/b.width;ty=(e.clientY-b.top)/b.height}
 function R(){return Math.max(170,Math.min(320,el.offsetWidth*.24))}
 el.addEventListener('pointerenter',function(e){clearTimeout(off);pos(e);if(r<1){x=tx;y=ty}tr=R();go()});
 el.addEventListener('pointermove',function(e){clearTimeout(off);pos(e);tr=R();go()});
 el.addEventListener('pointerleave',function(){tr=0;go()});
 el.addEventListener('pointerdown',function(e){if(e.pointerType==='touch'){pos(e);x=tx;y=ty;tr=R();go()}});
 el.addEventListener('pointerup',function(e){if(e.pointerType==='touch'){off=setTimeout(function(){tr=0;go()},1100)}});
 el.addEventListener('pointercancel',function(){tr=0;go()});
 if(!RM&&'IntersectionObserver' in window){var seen=false;new IntersectionObserver(function(en){en.forEach(function(e){if(e.isIntersecting&&!seen){seen=true;setTimeout(function(){tx=.32;ty=.55;tr=R()*1.15;go();setTimeout(function(){tr=0;go()},1500)},600)}})},{threshold:.6}).observe(el)}
});
})();
(function(){
/* 3D-модель в карточке товара: скрипт (около 600 КБ) грузится только по нажатию */
var bar=document.querySelector('.p3bar');if(!bar)return;
var box=document.querySelector('.v3d'),note=document.querySelector('.v3dnote'),img=box&&box.nextElementSibling,inst=null,loading=false;
var base=document.querySelector('link[href$="assets/site.css"]').getAttribute('href').replace('assets/site.css','');
function mode(m){[].forEach.call(bar.querySelectorAll('button'),function(b){var on=b.dataset.m===m;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)})}
function photo(){if(inst){try{inst.dispose()}catch(e){}inst=null}box.textContent='';box.hidden=true;note.hidden=true;mode('photo')}
function show3d(btn){
 function go(){try{box.hidden=false;note.hidden=false;inst=window.Ozo3D.mount(box,btn.dataset.kind,{label:btn.dataset.label});mode('3d')}catch(e){photo()}}
 if(window.Ozo3D)return go();if(loading)return;loading=true;btn.textContent='Загружаем 3D...';
 var s=document.createElement('script');s.src=base+'assets/view3d.js';s.onload=function(){loading=false;btn.textContent='Покрутить в 3D';go()};s.onerror=function(){loading=false;btn.textContent='3D недоступно'};document.head.appendChild(s)}
bar.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;if(b.dataset.m==='3d')show3d(b);else photo()});
})();

