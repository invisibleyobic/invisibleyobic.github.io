const $ = selector => document.querySelector(selector);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const reduce = motion.matches;
if (reduce) {
  document.getElementById('layer').setAttribute('rx', '30');
  document.getElementById('layer').setAttribute('ry', '6');
} else if (window.gsap) {
  gsap.timeline({repeat:-1,repeatDelay:.6})
    .fromTo('#dollop',{y:-10,opacity:0},{y:0,opacity:1,duration:.3})
    .to('#dollop',{y:52,duration:.55,ease:'power2.in'})
    .to('#dollop',{scaleY:.4,scaleX:1.5,transformOrigin:'50% 100%',opacity:0,duration:.18})
    .fromTo('#layer',{attr:{rx:4,ry:2}},{attr:{rx:30,ry:6},duration:.6,ease:'power2.out'},'-=.1')
    .to('#layer',{attr:{rx:0,ry:0},duration:.4,delay:1.1})
    .set('#dollop',{scaleX:1,scaleY:1});
  const belt = gsap.timeline({repeat:-1,repeatDelay:.4});
  ['.pr1','.pr2','.pr3'].forEach((selector,index)=>belt.fromTo('.belt-art '+selector,{scale:.4,opacity:.9},{scale:3,opacity:0,duration:1.4,ease:'power1.out'},index*.35));
  belt.fromTo('#beltImg',{scaleX:1},{scaleX:.96,duration:.25,yoyo:true,repeat:3,ease:'sine.inOut'},0);
}
// ===== монитор: бифазный прямоугольный импульс, развёртка как на больничном мониторе =====
(() => { const cv = $('#ecg'); if (!cv) return; const g = cv.getContext('2d'); let W = 0, H = 0, x = 0, vis = false, t = 0, last = 0, prevY = null;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const size = () => { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#07120d'; g.fillRect(0, 0, W, H); grid(); x = 0; prevY = null; if (reduce) drawStatic(); };
  const grid = () => { g.strokeStyle = 'rgba(111,245,169,.08)'; g.lineWidth = 1; for (let i = 0; i < W; i += 16) { g.beginPath(); g.moveTo(i + .5, 0); g.lineTo(i + .5, H); g.stroke(); } for (let j = 0; j < H; j += 16) { g.beginPath(); g.moveTo(0, j + .5); g.lineTo(W, j + .5); g.stroke(); } };
  // период меняется плавно: показываем, что частота настраивается
  const sig = tt => { const per = 0.55 + 0.35 * Math.sin(tt * 0.25), ph = (tt % per) / per, w = 0.07; return ph < w ? 1 : ph < 2 * w ? -1 : 0; };
  const drawStatic = () => { g.strokeStyle = '#6ff5a9'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i < W; i++) { const y = H * .5 - sig(i / (W / 2.4)) * H * .28; if (i === 0) g.moveTo(i, y); else g.lineTo(i, y); } g.stroke(); };
  const draw = now => { if (!vis) { last = now; return requestAnimationFrame(draw); } const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    const speed = W / 2.4, steps = Math.max(1, Math.round(speed * dt));
    for (let k = 0; k < steps; k++) { t += 1 / speed; x += 1; if (x > W) { x = 0; prevY = null; }
      g.fillStyle = '#07120d'; g.fillRect(x + 1, 0, 14, H); for (let j = 0; j < H; j += 16) { g.fillStyle = 'rgba(111,245,169,.08)'; g.fillRect(x + 1, j, 14, 1); }
      const y = H * 0.5 - sig(t) * H * 0.28;
      g.strokeStyle = '#6ff5a9'; g.lineWidth = 2; g.shadowColor = '#6ff5a9'; g.shadowBlur = 8; g.beginPath(); g.moveTo(x - 1, prevY ?? y); g.lineTo(x, y); g.stroke(); g.shadowBlur = 0; prevY = y; }
    requestAnimationFrame(draw); };
  new ResizeObserver(size).observe(cv); new IntersectionObserver(e => vis = e[0].isIntersecting).observe(cv);
  if (reduce) { size(); return; }
  requestAnimationFrame(draw);
})();
