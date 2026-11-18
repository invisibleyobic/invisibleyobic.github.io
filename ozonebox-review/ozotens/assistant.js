(() => {
  const panel=document.querySelector('.assistant-answer');
  if(!panel)return;
  const base=new URL('.',document.currentScript.src);
  const buttons=[...document.querySelectorAll('[data-help-topic]')],select=document.getElementById('help-area');
  const title=panel.querySelector('[data-help-title]'),text=panel.querySelector('[data-help-text]'),link=panel.querySelector('[data-help-link]');
  let topic='kit';
  const choices={
    kit:{title:'Сравните комплекты по области',text:'Прибор, крем и электрод нужной формы. Размеры и цены указаны в каталоге.',label:'Открыть комплектацию ↗'},
    video:{title:'Посмотрите видеоруководство',text:'Оригинальные ролики производителя с управлением воспроизведением на этой странице.',label:'Открыть видео ↗'},
    docs:{title:'Руководство, патент и публикации',text:'Первоисточники и прямые PDF собраны в разделе документов.',label:'Открыть документы ↗'},
    order:{title:'Доставка, оплата, гарантия',text:'Состав заказа можно изменить в корзине. Условия получения и вопросы по товару — в поддержке.',label:'Открыть поддержку ↗'}
  };
  function render(){
    const c=choices[topic];title.textContent=c.title;text.textContent=c.text;link.textContent=c.label;
    select.closest('label').hidden=topic==='docs'||topic==='order';
    const targets={kit:'catalog/#kit-'+select.value,video:'how-to/video/#'+select.value,docs:'znaniya/',order:'support/'};
    link.href=new URL(targets[topic],base).href;
    buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.helpTopic===topic)));
  }
  buttons.forEach(button=>button.addEventListener('click',()=>{topic=button.dataset.helpTopic;render();}));
  select.addEventListener('change',render);render();
})();
