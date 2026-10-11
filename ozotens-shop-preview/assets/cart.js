/* ОЗОТЭНС: корзина и форма заказа (макет). Корзина хранит только коды, размеры и количество, личных данных в ней нет.
   Суммы здесь только для показа: настоящую сумму считает сервер по прайсу (server/order_core.py).
   Пока в assets/catalog.json orders.enabled = false, форма ничего никуда не отправляет. */
(function(){
var KEY='ozotens_cart_v1',MAXQ=9;
var base=document.querySelector('link[href$="assets/site.css"]').getAttribute('href').replace('assets/site.css','');
function load(){try{var c=JSON.parse(localStorage.getItem(KEY));return Array.isArray(c)?c:[]}catch(e){return[]}}
function save(c){try{localStorage.setItem(KEY,JSON.stringify(c))}catch(e){}count()}
function rub(n){return n.toLocaleString('ru-RU')+' ₽'}
function count(){var n=load().reduce(function(a,l){return a+l.qty},0),el=document.getElementById('cartn');if(el){el.textContent=n?String(n):'';el.hidden=!n}}
function add(code,size,qty){var c=load(),f=c.filter(function(l){return l.code===code&&l.size===size})[0];if(f)f.qty=Math.min(MAXQ,f.qty+qty);else c.push({code:code,size:size,qty:Math.min(MAXQ,qty)});save(c)}
function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
var cat=null;
function catalog(cb){if(cat)return cb(cat);fetch(base+'assets/catalog.json').then(function(r){return r.json()}).then(function(d){cat=d;cb(d)}).catch(function(){cb(null)})}
count();

/* кнопка на карточке товара */
var addForm=document.getElementById('addform');
if(addForm){
 addForm.addEventListener('submit',function(e){e.preventDefault();
  var code=addForm.dataset.code,sel=addForm.querySelector('select'),size=sel?sel.value:'',q=parseInt(addForm.querySelector('output').textContent,10)||1;
  if(sel&&!size){var m=document.getElementById('addmsg');m.textContent='Выберите размер.';return}
  add(code,size,q);var m2=document.getElementById('addmsg');m2.textContent='';m2.append('Добавлено в заказ. ');var a=el('a',null,'Открыть заказ');a.href=base+'cart/';m2.appendChild(a)});
 var out=addForm.querySelector('output');
 addForm.querySelector('[data-q="-1"]').addEventListener('click',function(){out.textContent=Math.max(1,(parseInt(out.textContent,10)||1)-1)});
 addForm.querySelector('[data-q="1"]').addEventListener('click',function(){out.textContent=Math.min(MAXQ,(parseInt(out.textContent,10)||1)+1)});
}

/* корзина */
var box=document.getElementById('cart');
function renderCart(){
 catalog(function(d){
  box.textContent='';
  var c=load().filter(function(l){return d&&d.items[l.code]});
  if(!c.length){box.appendChild(el('p','lead','В заказе пока ничего нет.'));var b=el('a','btn','Открыть каталог');b.href=base+'catalog/';box.appendChild(b);return}
  var total=0,list=el('div','cl');
  c.forEach(function(l,i){var it=d.items[l.code],sum=it.price*l.qty;total+=sum;
   var row=el('div','crow'),nm=el('div','cn');nm.appendChild(el('b',null,it.name));nm.appendChild(el('small',null,(l.size?'Размер '+l.size+'. ':'')+rub(it.price)+' за штуку'));
   var q=el('div','cq'),minus=el('button',null,'−'),out=el('output',null,String(l.qty)),plus=el('button',null,'+');
   minus.type=plus.type='button';minus.setAttribute('aria-label','Меньше');plus.setAttribute('aria-label','Больше');
   minus.addEventListener('click',function(){var all=load();var x=all[i];if(!x)return;x.qty--;if(x.qty<1)all.splice(i,1);save(all);renderCart()});
   plus.addEventListener('click',function(){var all=load();var x=all[i];if(!x)return;x.qty=Math.min(MAXQ,x.qty+1);save(all);renderCart()});
   q.append(minus,out,plus);
   var sm=el('div','cs',rub(sum)),rm=el('button','crm','Убрать');rm.type='button';rm.addEventListener('click',function(){var all=load();all.splice(i,1);save(all);renderCart()});
   row.append(nm,q,sm,rm);list.appendChild(row)});
  box.appendChild(list);
  var t=el('p','ctotal');t.appendChild(el('span',null,'Итого (ориентировочно): '));t.appendChild(el('b',null,rub(total)));box.appendChild(t);
  box.appendChild(el('p','src','Цена ориентировочная: окончательную сумму считает продавец при приёме заказа. Доставка не включена.'));
  var go=el('a','btn','Оформить заказ');go.href=base+'checkout/';box.appendChild(go)
 })
}
if(box)renderCart();

/* форма заказа */
var form=document.getElementById('order');
if(form){
 var sum=document.getElementById('osum'),msg=document.getElementById('omsg');
 catalog(function(d){
  var c=load().filter(function(l){return d&&d.items[l.code]});sum.textContent='';
  if(!c.length){sum.appendChild(el('p','lead','Заказ пуст. Сначала добавьте товары из каталога.'));var b=el('a','btn','Открыть каталог');b.href=base+'catalog/';sum.appendChild(b);form.hidden=true;return}
  var total=0,ul=el('ul');c.forEach(function(l){var it=d.items[l.code];total+=it.price*l.qty;ul.appendChild(el('li',null,it.name+(l.size?', размер '+l.size:'')+' × '+l.qty+': '+rub(it.price*l.qty)))});
  sum.appendChild(ul);var t=el('p','ctotal');t.appendChild(el('span',null,'Итого (ориентировочно): '));t.appendChild(el('b',null,rub(total)));sum.appendChild(t)
 });
 function source(){var p=new URLSearchParams(location.search),parts=[];['utm_source','utm_medium','utm_campaign','promo'].forEach(function(k){if(p.get(k))parts.push(k+'='+p.get(k))});return parts.join('&')||'unknown'}
 function uuid(){if(window.crypto&&crypto.randomUUID)return crypto.randomUUID().replace(/-/g,'');var s='';for(var i=0;i<32;i++)s+=Math.floor(Math.random()*16).toString(16);return s}
 var idem=uuid();
 function err(f,t){var e=form.querySelector('[data-err="'+f+'"]');if(e)e.textContent=t||'';var inp=form.elements[f];if(inp&&inp.setAttribute){if(t)inp.setAttribute('aria-invalid','true');else inp.removeAttribute('aria-invalid')}}
 form.addEventListener('submit',function(e){
  e.preventDefault();msg.textContent='';var ok=true,v=form.elements;
  ['name','phone','email','consent_pd','consent_offer'].forEach(function(f){err(f,'')});
  if(v.name.value.trim().length<2){err('name','Укажите имя');ok=false}
  var dg=v.phone.value.replace(/\D/g,'');if(dg.length===11&&(dg[0]==='7'||dg[0]==='8'))dg=dg.slice(1);if(dg.length!==10){err('phone','Проверьте номер телефона');ok=false}
  if(v.email.value&&!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v.email.value.trim())){err('email','Проверьте почту');ok=false}
  if(!v.consent_pd.checked){err('consent_pd','Нужно согласие на обработку данных');ok=false}
  if(!v.consent_offer.checked){err('consent_offer','Нужно принять условия оферты');ok=false}
  if(!ok){var first=form.querySelector('[aria-invalid="true"]');if(first)first.focus();return}
  catalog(function(d){
   var payload={items:load().map(function(l){return{code:l.code,size:l.size,qty:l.qty}}),customer:{name:v.name.value.trim(),phone:v.phone.value.trim(),email:v.email.value.trim(),city:v.city.value.trim(),comment:v.comment.value.trim(),consents:{personal_data:true,offer:true,marketing:v.consent_mk.checked}},source:source(),website:v.website.value};
   if(d&&d.orders&&d.orders.enabled&&d.orders.endpoint){
    msg.textContent='Отправляем...';
    fetch(d.orders.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':idem},body:JSON.stringify(payload)}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})}).then(function(r){
     if(r.ok){save([]);form.hidden=true;sum.textContent='';sum.appendChild(el('p','lead','Заказ принят. Мы свяжемся с вами для подтверждения.'))}else msg.textContent=(r.j&&r.j.error)||'Не удалось отправить. Попробуйте ещё раз.'
    }).catch(function(){msg.textContent='Нет связи. Попробуйте ещё раз.'})
   }else{
    msg.textContent='Это макет: заказы пока не принимаются, данные никуда не отправлены и не сохранены.'
   }
  })
 })
}
})();
