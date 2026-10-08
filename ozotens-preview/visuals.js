/* Schematic motion uses the existing SVGs; it does not depict a therapy result. */
(function(){
 const section=document.querySelector('#how'),steps=section.querySelector('.steps');
 if(section.querySelector('.scheme-control'))return;
 const control=document.createElement('button');control.type='button';control.className='scheme-control';control.textContent='Остановить анимацию схем';control.setAttribute('aria-pressed','true');steps.after(control);
 let paused=false;const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 function update(visible){steps.classList.toggle('playing',visible&&!paused&&!reduced.matches)}
 let visible=false;
 if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;update(visible)},{threshold:.15});observer.observe(section)}else{visible=true;update(visible)}
 control.addEventListener('click',()=>{paused=!paused;control.textContent=paused?'Включить анимацию схем':'Остановить анимацию схем';control.setAttribute('aria-pressed',String(!paused));update(visible)});
 if(reduced.addEventListener)reduced.addEventListener('change',()=>update(visible));else if(reduced.addListener)reduced.addListener(()=>update(visible));
})();
