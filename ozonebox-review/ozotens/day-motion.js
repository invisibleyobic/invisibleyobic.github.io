const section = document.querySelector('.day-section');
const clock = section?.querySelector('[data-day-time]');
const entries = [...(section?.querySelectorAll('.day-entries li') || [])];

if (clock && entries.length) {
  const clockPanel = clock.closest('.day-clock');
  const originalClockParent = clockPanel.parentElement;
  const entryList = entries[0].parentElement;
  const progress = document.createElement('div');
  progress.className = 'day-progress';
  entryList.before(progress);
  progress.appendChild(entryList);
  const mobile = matchMedia('(max-width: 760px)');
  let refreshFrame;

  function refreshAfterLayout() {
    cancelAnimationFrame(refreshFrame);
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = requestAnimationFrame(() => window.ScrollTrigger?.refresh());
    });
  }

  function placeClock() {
    if (mobile.matches) progress.prepend(clockPanel);
    else originalClockParent.appendChild(clockPanel);
    refreshAfterLayout();
  }

  mobile.addEventListener('change', placeClock);
  placeClock();

  const minutes = entries.map(entry => {
    const [hours, mins] = entry.querySelector('b').textContent.split(':').map(Number);
    return hours * 60 + mins;
  });
  const state = { minute: minutes[0] };

  function render() {
    const minute = Math.round(state.minute);
    clock.textContent = String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0');
    const active = minutes.reduce((index, time, i) => minute >= time ? i : index, 0);
    entries.forEach((entry, i) => entry.classList.toggle('is-current', i === active));
  }

  function loadLibrary(filename) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('./vendor/' + filename, import.meta.url).href;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  try {
    const refinements = [...document.querySelectorAll('link[rel="stylesheet"]')]
      .find(link => new URL(link.href).pathname.endsWith('/home-refinements.css'));
    if (refinements && !refinements.sheet && document.readyState !== 'complete') {
      await new Promise(resolve => {
        refinements.addEventListener('load', resolve, { once: true });
        refinements.addEventListener('error', resolve, { once: true });
        window.addEventListener('load', resolve, { once: true });
      });
    }
    await new Promise(resolve => requestAnimationFrame(resolve));
    await document.fonts.ready;
    if (!window.gsap) await loadLibrary('gsap.min.js');
    if (!window.ScrollTrigger) await loadLibrary('ScrollTrigger.min.js');
    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);
    gsap.matchMedia().add({
      animate: '(prefers-reduced-motion: no-preference)',
      static: '(prefers-reduced-motion: reduce)'
    }, context => {
      if (context.conditions.static) {
        clock.textContent = entries[0].querySelector('b').textContent;
        entries.forEach(entry => entry.classList.add('is-current'));
        return;
      }
      state.minute = minutes[0];
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top 75%',
          end: 'bottom 35%',
          scrub: .35,
          invalidateOnRefresh: true
        },
        onUpdate: render
      });
      minutes.slice(1).forEach(minute => timeline.to(state, { minute, duration: 1, ease: 'none' }));
      render();
    });
    refreshAfterLayout();
    document.fonts.ready.then(refreshAfterLayout);
    const layoutObserver = new ResizeObserver(refreshAfterLayout);
    for (const element of document.querySelectorAll('.hero, .site-header')) layoutObserver.observe(element);
    if (document.readyState === 'complete') refreshAfterLayout();
    else window.addEventListener('load', refreshAfterLayout, { once: true });
  } catch {
    clock.textContent = entries[0].querySelector('b').textContent;
    entries.forEach(entry => entry.classList.add('is-current'));
  }
}
