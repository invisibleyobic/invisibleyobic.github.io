// device3d.js - интерактивная 3D-модель прибора (белый ROOVJOY с ЖК-экраном) на three.js r186.
// Без аддонов: скруглённый корпус, окружение для отражений и экран рисуются здесь же.
//
// API:
//   const dev = mountDevice(canvas, { onChange(state), haptic(kind), reducedMotion?, touchAction? })
//   dev.press('power' | 'prog' | 'ch1+' | 'ch1-' | 'ch2+' | 'ch2-')
//   dev.state -> { on, mode:'TENS'|'EMS'|'MASS', prog:1..22, ch1:0..40, ch2:0..40 } (копия)
//   dev.dispose()

import * as THREE from './vendor/three.module.min.js';

// ---------- размеры (единица = ширина прибора) ----------
const W = 1.0;          // ширина
const H = 3.06;         // высота (пропорции с фото)
const D = 0.28;         // толщина
const R = 0.075;        // радиус скругления рёбер
const FZ = D / 2;       // плоскость лицевой панели

const KEYS = ['power', 'prog', 'ch1+', 'ch1-', 'ch2+', 'ch2-'];
const ACCENT = new THREE.Color(0x2f66f5);
const MAX_LEVEL = 40;
const PROGS = 22;

const fx = (f) => -W / 2 + f * W;   // доля ширины слева -> x
const fy = (f) => H / 2 - f * H;    // доля высоты сверху -> y

// раскладка по фото
const LCD = { x: 0, y: fy(0.189), w: 0.825, h: 0.262 * H };
const BTN_Y = fy(0.407);
const ROCK_Y = fy(0.565);
const COL_X = 0.19;
const BTN_R = 0.094;          // радиус «крышки» круглой кнопки (плюс фаска)
const ROCK_W = 0.214, ROCK_H = 0.52;
const BTN_BEVEL = 0.014;
const JACK_X = 0.14;

function modeFor(p) { return p <= 8 ? 'TENS' : p <= 16 ? 'EMS' : 'MASS'; }

// ---------- геометрия ----------

// Скруглённый параллелепипед: куб с сеткой, вершины которого «натягиваются» на сферы в углах.
function roundedBox(w, h, d, r, s = 8) {
  const N = 2 * s + 1;
  const g = new THREE.BoxGeometry(1, 1, 1, N, N, N);
  const pos = g.attributes.position, nor = g.attributes.normal;
  const half = [w / 2 - r, h / 2 - r, d / 2 - r];
  const o = [0, 0, 0], inner = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    const v = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    for (let a = 0; a < 3; a++) {
      const k = Math.round((v[a] + 0.5) * N);
      if (k <= s) { inner[a] = -half[a]; o[a] = -(1 - k / s); }
      else { inner[a] = half[a]; o[a] = (k - s - 1) / s; }
    }
    const len = Math.hypot(o[0], o[1], o[2]) || 1;
    const n = [o[0] / len, o[1] / len, o[2] / len];
    pos.setXYZ(i, inner[0] + n[0] * r, inner[1] + n[1] * r, inner[2] + n[2] * r);
    nor.setXYZ(i, n[0], n[1], n[2]);
  }
  g.computeBoundingSphere();
  return g;
}

// ExtrudeGeometry гладкая: склеиваем совпадающие вершины и пересчитываем нормали.
function smoothExtrude(shape, opts) {
  const src = new THREE.ExtrudeGeometry(shape, opts);
  const pos = src.attributes.position, uv = src.attributes.uv;
  const map = new Map(), P = [], U = [], idx = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const key = Math.round(x * 1e5) + '|' + Math.round(y * 1e5) + '|' + Math.round(z * 1e5);
    let id = map.get(key);
    if (id === undefined) {
      id = P.length / 3; map.set(key, id);
      P.push(x, y, z); U.push(uv.getX(i), uv.getY(i));
    }
    idx.push(id);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(idx);
  for (const gr of src.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
  g.computeVertexNormals();
  src.dispose();
  return g;
}

function roundRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

// ---------- 2D-рисование ----------
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const SANS = '"Helvetica Neue", Arial, Helvetica, sans-serif';

// Сегментная цифра
const DIG = { '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': '' };
function seg7(ctx, x, y, w, h, ch, ink, ghost, skew = 0.1) {
  const t = w * 0.25, g = t * 0.14, ht = t / 2;
  const hs = (x0, x1, yy) => [[x0, yy], [x0 + ht, yy - ht], [x1 - ht, yy - ht], [x1, yy], [x1 - ht, yy + ht], [x0 + ht, yy + ht]];
  const vs = (xx, y0, y1) => [[xx, y0], [xx + ht, y0 + ht], [xx + ht, y1 - ht], [xx, y1], [xx - ht, y1 - ht], [xx - ht, y0 + ht]];
  const S = {
    a: hs(ht + g, w - ht - g, ht),
    g: hs(ht + g, w - ht - g, h / 2),
    d: hs(ht + g, w - ht - g, h - ht),
    f: vs(ht, ht + g, h / 2 - g),
    e: vs(ht, h / 2 + g, h - ht - g),
    b: vs(w - ht, ht + g, h / 2 - g),
    c: vs(w - ht, h / 2 + g, h - ht - g),
  };
  const lit = DIG[ch] || '';
  for (const k of 'abcdefg') {
    const on = lit.includes(k);
    if (!on && !ghost) continue;
    ctx.fillStyle = on ? ink : ghost;
    ctx.beginPath();
    S[k].forEach(([px, py], i) => {
      const X = x + px + (h / 2 - py) * skew, Y = y + py;
      i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
    });
    ctx.closePath();
    ctx.fill();
  }
}

// Лицевая «печать»: надписи с фото, посадочные кольца кнопок, рамка экрана, шов, логотип.
function drawFace(cw) {
  const ch = Math.round(cw * H / W);
  const c = makeCanvas(cw, ch), ctx = c.getContext('2d');
  const px = (x) => (x + W / 2) / W * cw;
  const py = (y) => (H / 2 - y) / H * ch;
  const u = cw / W; // пикселей на единицу

  // лёгкая волна-«свуш» как на корпусе
  ctx.save();
  const sw = ctx.createLinearGradient(0, py(fy(0.5)), cw, py(fy(0.85)));
  sw.addColorStop(0, 'rgba(255,255,255,0)');
  sw.addColorStop(0.5, 'rgba(214,216,220,0.32)');
  sw.addColorStop(1, 'rgba(214,216,220,0.0)');
  ctx.fillStyle = sw;
  ctx.beginPath();
  ctx.moveTo(px(fx(0.0)), py(fy(0.52)));
  ctx.bezierCurveTo(px(fx(0.45)), py(fy(0.56)), px(fx(0.8)), py(fy(0.64)), px(fx(1.0)), py(fy(0.83)));
  ctx.lineTo(px(fx(1.0)), py(fy(0.88)));
  ctx.bezierCurveTo(px(fx(0.8)), py(fy(0.7)), px(fx(0.45)), py(fy(0.6)), px(fx(0.0)), py(fy(0.565)));
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // ELECTROTHERAPY
  ctx.fillStyle = '#6d7075';
  ctx.font = `500 ${Math.round(0.042 * cw)}px ${SANS}`;
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(0.002 * cw)}px`;
  ctx.fillText('ELECTROTHERAPY', px(fx(0.09)), py(fy(0.036)));
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  // рамка экрана
  const lx = px(LCD.x - LCD.w / 2), ly = py(LCD.y + LCD.h / 2), lw = LCD.w * u, lh = LCD.h * u;
  const pad = 0.012 * u;
  rr(ctx, lx - pad, ly - pad, lw + pad * 2, lh + pad * 2, 0.018 * u);
  ctx.fillStyle = '#8f9499';
  ctx.fill();
  rr(ctx, lx - pad * 0.45, ly - pad * 0.45, lw + pad * 0.9, lh + pad * 0.9, 0.012 * u);
  ctx.fillStyle = '#3d4246';
  ctx.fill();
  // под самим экраном - прозрачно, чтобы печать не перекрывала ЖК
  ctx.clearRect(lx + 2, ly + 2, lw - 4, lh - 4);

  // посадочные кольца кнопок
  const seat = (cx, cy, w, h, r) => {
    const g = 0.022 * u;
    const X = px(cx) - (w * u) / 2 - g, Y = py(cy) - (h * u) / 2 - g, WW = w * u + 2 * g, HH = h * u + 2 * g;
    // мягкая тень-углубление
    ctx.save();
    ctx.shadowColor = 'rgba(70,74,80,0.28)';
    ctx.shadowBlur = 0.02 * u;
    rr(ctx, X, Y, WW, HH, r * u + g);
    const gr = ctx.createLinearGradient(0, Y, 0, Y + HH);
    gr.addColorStop(0, '#dcdee1'); gr.addColorStop(1, '#eceef0');
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 0.004 * u;
    ctx.strokeStyle = 'rgba(150,154,160,0.75)';
    rr(ctx, X, Y, WW, HH, r * u + g);
    ctx.stroke();
  };
  const bOut = (BTN_R + BTN_BEVEL);
  seat(-COL_X, BTN_Y, bOut * 2, bOut * 2, bOut);
  seat(COL_X, BTN_Y, bOut * 2, bOut * 2, bOut);
  const rw = ROCK_W + BTN_BEVEL * 2, rh = ROCK_H + BTN_BEVEL * 2;
  seat(-COL_X, ROCK_Y, rw, rh, rw / 2);
  seat(COL_X, ROCK_Y, rw, rh, rw / 2);

  // шов нижней части
  const sy = py(fy(0.893));
  ctx.fillStyle = 'rgba(160,164,170,0.55)';
  ctx.fillRect(px(fx(0.0)), sy, cw, 0.004 * u);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(px(fx(0.0)), sy + 0.004 * u, cw, 0.003 * u);

  // логотип ROOVJOY
  const ly0 = py(fy(0.962));
  ctx.font = `800 ${Math.round(0.072 * cw)}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2f3237';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(-0.002 * cw)}px`;
  ctx.fillText('ROOVJOY', cw / 2, ly0);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  // красный полумесяц вокруг «J», как на фирменном знаке
  const jx = cw / 2 + 0.052 * cw, jr = 0.05 * cw;
  ctx.save();
  ctx.beginPath();
  ctx.arc(jx, ly0, jr, 0.15 * Math.PI, 1.05 * Math.PI, false);
  ctx.arc(jx, ly0 - 0.006 * cw, jr * 0.82, 1.0 * Math.PI, 0.2 * Math.PI, true);
  ctx.closePath();
  ctx.fillStyle = '#d4232b';
  ctx.fill();
  ctx.restore();
  return c;
}

function drawRoundCap(kind) {
  const S = 256, c = makeCanvas(S, S), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S * 0.45, S * 0.4, S * 0.05, S / 2, S / 2, S * 0.55);
  g.addColorStop(0, '#d9dbde'); g.addColorStop(1, '#c4c7cb');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.lineCap = 'round';
  if (kind === 'power') {
    ctx.strokeStyle = '#d3222b';
    ctx.lineWidth = S * 0.06;
    ctx.beginPath();
    ctx.arc(S / 2, S * 0.53, S * 0.17, -Math.PI * 0.32, Math.PI * 1.32, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(S / 2, S * 0.3); ctx.lineTo(S / 2, S * 0.5);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#3a3e44';
    ctx.font = `700 ${Math.round(S * 0.5)}px ${SANS}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('P', S / 2, S * 0.53);
  }
  return c;
}

function drawRockerCap(label) {
  const Wc = 256, Hc = Math.round(256 * ROCK_H / ROCK_W);
  const c = makeCanvas(Wc, Hc), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, Wc, 0);
  g.addColorStop(0, '#c3c6ca'); g.addColorStop(0.5, '#d7d9dc'); g.addColorStop(1, '#c3c6ca');
  ctx.fillStyle = g; ctx.fillRect(0, 0, Wc, Hc);
  ctx.strokeStyle = '#3a3e44'; ctx.fillStyle = '#3a3e44';
  ctx.lineCap = 'round';
  const L = Wc * 0.17, lw = Wc * 0.07;
  ctx.lineWidth = lw;
  // плюс
  const py = Hc * 0.26;
  ctx.beginPath(); ctx.moveTo(Wc / 2 - L, py); ctx.lineTo(Wc / 2 + L, py);
  ctx.moveTo(Wc / 2, py - L); ctx.lineTo(Wc / 2, py + L); ctx.stroke();
  // разделитель
  ctx.lineWidth = Wc * 0.012;
  ctx.strokeStyle = '#80858c';
  ctx.beginPath(); ctx.moveTo(Wc * 0.22, Hc * 0.5); ctx.lineTo(Wc * 0.78, Hc * 0.5); ctx.stroke();
  // CH1 / CH2
  ctx.font = `700 ${Math.round(Wc * 0.2)}px ${SANS}`;
  ctx.fillStyle = '#2f3338';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, Wc / 2, Hc * 0.63);
  // минус
  ctx.strokeStyle = '#3a3e44'; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(Wc / 2 - L, Hc * 0.75); ctx.lineTo(Wc / 2 + L, Hc * 0.75); ctx.stroke();
  return c;
}

function drawShadow(S = 256) {
  const c = makeCanvas(S, S), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.35, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.14)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return c;
}

// ---------- ЖК-экран ----------
const LW = 1024, LH = Math.round(1024 * LCD.h / LCD.w);
function drawLCD(ctx, s, view) {
  const X = (f) => f * LW, Y = (f) => f * LH;
  const lit = view.power > 0.01;
  // фон
  if (!lit) {
    const g = ctx.createLinearGradient(0, 0, 0, LH);
    g.addColorStop(0, '#4b524c'); g.addColorStop(1, '#3d433e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, LW, LH);
    // едва заметный блик стекла
    const gl = ctx.createLinearGradient(0, 0, LW, LH);
    gl.addColorStop(0, 'rgba(255,255,255,0.05)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, LW, LH);
    return;
  }
  const g = ctx.createRadialGradient(LW * 0.5, LH * 0.45, LW * 0.1, LW * 0.5, LH * 0.5, LW * 0.75);
  g.addColorStop(0, '#d3dccd'); g.addColorStop(1, '#b4bfae');
  ctx.fillStyle = g; ctx.fillRect(0, 0, LW, LH);

  const ink = '#1a201c';
  const ghost = 'rgba(26,32,28,0.055)';
  const all = view.boot; // тест всех сегментов при включении
  const on = (cond) => (all || cond) ? ink : ghost;

  // плашки режимов
  const labels = [['TENS', 0.045, 0.29], ['EMS', 0.355, 0.29], ['MASS', 0.665, 0.29]];
  for (const [t, x, w] of labels) {
    const col = on(s.mode === t);
    ctx.strokeStyle = col; ctx.fillStyle = col;
    ctx.lineWidth = LW * 0.006;
    rr(ctx, X(x), Y(0.04), X(w), Y(0.115), LW * 0.012);
    ctx.stroke();
    ctx.font = `700 ${Math.round(LH * 0.085)}px ${SANS}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t, X(x + w / 2), Y(0.1));
  }

  // PRO. и батарея
  ctx.fillStyle = on(true);
  ctx.font = `700 ${Math.round(LH * 0.05)}px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.fillText('PRO.', X(0.035), Y(0.24));
  ctx.strokeStyle = on(true); ctx.lineWidth = LW * 0.005;
  ctx.strokeRect(X(0.04), Y(0.3), X(0.09), Y(0.045));
  ctx.fillRect(X(0.13), Y(0.312), X(0.012), Y(0.022));
  ctx.fillRect(X(0.05), Y(0.31), X(0.07), Y(0.026));

  const dw = X(0.138), dh = Y(0.31);
  const two = (v) => String(v).padStart(2, '0');
  const p = all ? '88' : two(s.prog);
  seg7(ctx, X(0.165), Y(0.2), dw, dh, p[0], ink, ghost);
  seg7(ctx, X(0.32), Y(0.2), dw, dh, p[1], ink, ghost);

  // таймер (минуты)
  const t = all ? '88' : two(view.minutes);
  // часы
  ctx.strokeStyle = on(true); ctx.lineWidth = LW * 0.005;
  ctx.beginPath(); ctx.arc(X(0.55), Y(0.235), X(0.022), 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X(0.55), Y(0.235)); ctx.lineTo(X(0.55), Y(0.215));
  ctx.moveTo(X(0.55), Y(0.235)); ctx.lineTo(X(0.563), Y(0.24)); ctx.stroke();
  seg7(ctx, X(0.6), Y(0.2), dw, dh, t[0], ink, ghost);
  seg7(ctx, X(0.755), Y(0.2), dw, dh, t[1], ink, ghost);
  ctx.fillStyle = on(true);
  ctx.font = `700 ${Math.round(LH * 0.04)}px ${SANS}`;
  ctx.fillText('MIN', X(0.9), Y(0.5));

  // нижний ряд: уровни каналов
  const c1 = all ? '88' : two(s.ch1), c2 = all ? '88' : two(s.ch2);
  seg7(ctx, X(0.05), Y(0.6), dw, dh, c1[0], ink, ghost);
  seg7(ctx, X(0.205), Y(0.6), dw, dh, c1[1], ink, ghost);
  seg7(ctx, X(0.66), Y(0.6), dw, dh, c2[0], ink, ghost);
  seg7(ctx, X(0.815), Y(0.6), dw, dh, c2[1], ink, ghost);

  // кружки 1 и 2
  const circ = (cx, n, col) => {
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = LW * 0.004;
    ctx.beginPath(); ctx.arc(X(cx), Y(0.64), X(0.022), 0, Math.PI * 2); ctx.stroke();
    ctx.font = `700 ${Math.round(LH * 0.038)}px ${SANS}`;
    ctx.textAlign = 'center'; ctx.fillText(n, X(cx), Y(0.643));
  };
  circ(0.39, '1', on(true));
  circ(0.6, '2', on(true));
  // ключ (блокировка) - в модели не используется, только «тень» сегмента
  ctx.strokeStyle = on(false); ctx.lineWidth = LW * 0.006;
  ctx.beginPath(); ctx.arc(X(0.535), Y(0.73), X(0.016), 0, Math.PI * 2);
  ctx.moveTo(X(0.519), Y(0.73)); ctx.lineTo(X(0.455), Y(0.73));
  ctx.moveTo(X(0.47), Y(0.73)); ctx.lineTo(X(0.47), Y(0.755)); ctx.stroke();
  // значки электродов: горят, когда канал работает
  const fork = (cx, active) => {
    ctx.strokeStyle = on(active); ctx.lineWidth = LW * 0.006; ctx.lineCap = 'round';
    const y0 = Y(0.79);
    ctx.beginPath();
    ctx.moveTo(X(cx - 0.02), y0); ctx.lineTo(X(cx - 0.02), y0 + Y(0.03));
    ctx.quadraticCurveTo(X(cx - 0.02), y0 + Y(0.06), X(cx), y0 + Y(0.06));
    ctx.quadraticCurveTo(X(cx + 0.02), y0 + Y(0.06), X(cx + 0.02), y0 + Y(0.03));
    ctx.lineTo(X(cx + 0.02), y0);
    ctx.moveTo(X(cx), y0 + Y(0.06)); ctx.lineTo(X(cx), y0 + Y(0.13));
    ctx.stroke();
  };
  fork(0.405, s.ch1 > 0 && view.blink1);
  fork(0.585, s.ch2 > 0 && view.blink2);

  // мягкая неравномерность подсветки
  const v = ctx.createRadialGradient(LW / 2, LH / 2, LW * 0.3, LW / 2, LH / 2, LW * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.08)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, LW, LH);
}

// ---------- окружение для отражений (своя «студия») ----------
function buildEnvironment(renderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  const sc = new THREE.Scene();
  const disp = [];
  const room = new THREE.Mesh(new THREE.BoxGeometry(14, 9, 14), new THREE.MeshBasicMaterial({ color: 0x5e5e5c, side: THREE.BackSide }));
  room.position.y = 2.5; sc.add(room); disp.push(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: 0x40403e }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.9; sc.add(floor); disp.push(floor);
  const panel = (w, h, k, pos, look, tint = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); sc.add(m); disp.push(m);
  };
  panel(6, 3.5, 3.2, [0, 6.8, 0.5], [0, 0, 0]);               // верхний софтбокс
  panel(1.2, 6, 7.0, [-6.8, 2, 1.5], [0, 1, 0]);              // левый стрип
  panel(1.4, 6, 4.5, [6.8, 2, -0.5], [0, 1, 0], 0xfff6ec);    // правый стрип, чуть тёплый
  panel(5, 3.5, 3.0, [-1.5, 1.2, 6.8], [0, 0.5, 0]);            // фронтальная заливка
  panel(3, 4, 2.6, [1.5, 2, -6.8], [0, 1, 0]);                // контровой
  panel(7, 3, 2.2, [0.5, 5.5, 5.5], [0, 0, 0]);               // широкий верхне-фронтальный: градиент на лицевой панели
  const env = pm.fromScene(sc, 0.03).texture;
  disp.forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
  pm.dispose();
  return env;
}

// ---------- пружина ----------
class Spring {
  constructor(k, c) { this.k = k; this.c = c; this.x = 0; this.v = 0; this.target = 0; }
  step(dt) {
    const n = Math.ceil(dt / 0.004);
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = -this.k * (this.x - this.target) - this.c * this.v;
      this.v += a * h; this.x += this.v * h;
    }
  }
  get settled() { return Math.abs(this.v) < 1e-3 && Math.abs(this.x - this.target) < 1e-3; }
}

// ---------- монтаж ----------
export function mountDevice(canvas, opts = {}) {
  const onChange = typeof opts.onChange === 'function' ? opts.onChange : () => {};
  const haptic = typeof opts.haptic === 'function' ? opts.haptic : () => {};
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reduced = opts.reducedMotion != null ? !!opts.reducedMotion : !!(mq && mq.matches);

  const st = { on: false, mode: 'TENS', prog: 1, ch1: 0, ch2: 0 };
  const emit = () => { try { onChange({ ...st }); } catch (e) { console.error(e); } };

  // рендерер
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // Вертикальный свайп отдаём браузеру (прокрутка), горизонтальный - вращение.
  // 'none' по просьбе можно передать в opts.touchAction, но тогда страница не прокручивается через canvas.
  const prevTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = opts.touchAction || 'pan-y';
  const prevCursor = canvas.style.cursor;
  canvas.style.cursor = 'grab';
  canvas.style.webkitTapHighlightColor = 'transparent';
  canvas.style.userSelect = 'none';

  const scene = new THREE.Scene();
  const envTex = buildEnvironment(renderer);
  scene.environment = envTex;
  scene.environmentIntensity = 1.0;

  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(-2.5, 4, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xfff1e2, 0.35);
  fill.position.set(3, 1, 2);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  const camTarget = new THREE.Vector3(0, 0.18, 0);

  const tex = (c) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    return t;
  };

  // иерархия: root (парение, толчок) -> spin (повороты) -> детали
  const root = new THREE.Group();
  const spin = new THREE.Group();
  root.add(spin);
  scene.add(root);

  // корпус
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0xfbfbf9, roughness: 0.3, metalness: 0,
    clearcoat: 1, clearcoatRoughness: 0.07, specularIntensity: 0.6,
  });
  const body = new THREE.Mesh(roundedBox(W, H, D, R, 9), bodyMat);
  spin.add(body);

  // лицевая печать
  const faceCanvas = drawFace(1024);
  const faceTex = tex(faceCanvas);
  const faceMat = new THREE.MeshPhysicalMaterial({
    map: faceTex, transparent: true, depthWrite: false, roughness: 0.34,
    clearcoat: 1, clearcoatRoughness: 0.07, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W, H), faceMat);
  face.position.z = FZ + 0.0006;
  face.renderOrder = 1;
  spin.add(face);

  // ЖК-экран
  const lcdCanvas = makeCanvas(LW, LH);
  const lcdCtx = lcdCanvas.getContext('2d');
  const lcdTex = tex(lcdCanvas);
  const lcdMat = new THREE.MeshPhysicalMaterial({
    map: lcdTex, emissiveMap: lcdTex, emissive: 0xffffff, emissiveIntensity: 0,
    roughness: 0.6, clearcoat: 1, clearcoatRoughness: 0.05, specularIntensity: 0.4,
  });
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(LCD.w, LCD.h), lcdMat);
  lcd.position.set(LCD.x, LCD.y, FZ + 0.0025);
  spin.add(lcd);

  // кнопки
  const greySide = new THREE.MeshPhysicalMaterial({ color: 0xc2c5c9, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.25 });
  const buttons = []; // {mesh, key|pair, spring, held, pulseUntil, kind, base}
  const pickables = [];

  const capMaterial = (canvasEl, w, h) => {
    const t = tex(canvasEl);
    t.repeat.set(1 / w, 1 / h);
    t.offset.set(0.5, 0.5);
    return new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.25 });
  };
  const extrudeOpts = { depth: 0.01, bevelEnabled: true, bevelThickness: BTN_BEVEL, bevelSize: BTN_BEVEL, bevelSegments: 7, curveSegments: 40 };

  const roundGeo = (() => {
    const s = new THREE.Shape(); s.absarc(0, 0, BTN_R, 0, Math.PI * 2, false);
    return smoothExtrude(s, extrudeOpts);
  })();
  const rockGeo = smoothExtrude(roundRectShape(ROCK_W, ROCK_H, ROCK_W / 2 - 0.0005), { ...extrudeOpts, curveSegments: 24 });
  const baseZ = FZ + BTN_BEVEL - 0.004;

  const addButton = (geo, mat, x, y, data) => {
    const m = new THREE.Mesh(geo, [mat, greySide]);
    m.position.set(x, y, baseZ);
    m.userData = data;
    spin.add(m);
    const b = { mesh: m, spring: new Spring(1500, 26), held: 0, pulseUntil: 0, dir: 0, ...data };
    buttons.push(b);
    m.userData.btn = b;
    pickables.push(m);
    return b;
  };
  addButton(roundGeo, capMaterial(drawRoundCap('power'), BTN_R * 2, BTN_R * 2), -COL_X, BTN_Y, { kind: 'round', key: 'power' });
  addButton(roundGeo, capMaterial(drawRoundCap('prog'), BTN_R * 2, BTN_R * 2), COL_X, BTN_Y, { kind: 'round', key: 'prog' });
  addButton(rockGeo, capMaterial(drawRockerCap('CH1'), ROCK_W, ROCK_H), -COL_X, ROCK_Y, { kind: 'rocker', ch: 'ch1' });
  addButton(rockGeo, capMaterial(drawRockerCap('CH2'), ROCK_W, ROCK_H), COL_X, ROCK_Y, { kind: 'rocker', ch: 'ch2' });
  const btnFor = (k) => {
    if (k === 'power' || k === 'prog') return { b: buttons.find((x) => x.key === k), dir: 0 };
    const ch = k.slice(0, 3);
    return { b: buttons.find((x) => x.ch === ch), dir: k.endsWith('+') ? 1 : -1 };
  };

  // гнёзда и штекеры
  const metal = new THREE.MeshPhysicalMaterial({ color: 0xc9cdd2, metalness: 1, roughness: 0.28 });
  const plugMat = new THREE.MeshPhysicalMaterial({ color: 0x1f2023, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.2 });
  const collarGlow = [];
  const plugProfile = [
    [0, 0], [0.05, 0], [0.052, 0.012], [0.052, 0.02], [0.049, 0.16], [0.045, 0.19], [0.034, 0.205],
    [0.03, 0.215], [0.028, 0.29], [0.024, 0.32], [0, 0.322],
  ].map(([a, b]) => new THREE.Vector2(a, b));
  const plugGeo = new THREE.LatheGeometry(plugProfile, 40);
  const collarGeo = new THREE.CylinderGeometry(0.06, 0.062, 0.022, 40);
  const ringGeo = new THREE.TorusGeometry(0.0525, 0.0045, 10, 48);
  const jackTop = H / 2;
  const plugTopY = jackTop + 0.018 + 0.322;
  [-JACK_X, JACK_X].forEach((x) => {
    const collar = new THREE.Mesh(collarGeo, metal);
    collar.position.set(x, jackTop + 0.008, 0);
    spin.add(collar);
    const plug = new THREE.Mesh(plugGeo, plugMat);
    plug.position.set(x, jackTop + 0.018, 0);
    spin.add(plug);
    // тёплое кольцо-индикатор у основания штекера
    const gm = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, emissive: ACCENT, emissiveIntensity: 0, roughness: 0.4 });
    const ring = new THREE.Mesh(ringGeo, gm);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, jackTop + 0.03, 0);
    spin.add(ring);
    collarGlow.push(gm);
  });

  // провода
  const cableU = [];
  const makeCable = (side) => {
    const x = side * JACK_X, t = plugTopY - 0.004;
    const pts = [
      [x, t, 0], [x, t + 0.12, 0], [x + side * 0.07, t + 0.27, 0.02], [x + side * 0.3, t + 0.39, 0.0],
      [x + side * 0.78, t + 0.42, -0.1], [x + side * 1.45, t + 0.36, -0.25], [x + side * 2.35, t + 0.4, -0.45], [x + side * 3.4, t + 0.56, -0.65],
    ].map((p) => new THREE.Vector3(...p));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const len = curve.getLength();
    const segs = 260, rad = 12;
    const geo = new THREE.TubeGeometry(curve, segs, 0.021, rad, false);
    const along = new Float32Array(geo.attributes.position.count);
    for (let i = 0; i <= segs; i++) for (let j = 0; j <= rad; j++) along[i * (rad + 1) + j] = i / segs;
    geo.setAttribute('along', new THREE.BufferAttribute(along, 1));
    const uni = {
      uPhase: { value: 0 }, uLevel: { value: 0 }, uLen: { value: len }, uLambda: { value: 0.62 },
      uStatic: { value: reduced ? 1 : 0 }, uGlow: { value: ACCENT.clone() },
    };
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x1c1d20, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3, transparent: true });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float along;\nvarying float vAlong;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlong = along;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
varying float vAlong;
uniform float uPhase, uLevel, uLen, uLambda, uStatic;
uniform vec3 uGlow;
float pulseBand(){
  float f = fract(vAlong * uLen / uLambda - uPhase);
  float b = smoothstep(0.0, 0.3, f) * (1.0 - smoothstep(0.3, 0.345, f));
  b = mix(b, 0.12, uStatic);
  return b * uLevel * (1.0 - smoothstep(0.55, 0.9, vAlong));
}`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlow * pulseBand() * 1.7;')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= 1.0 - smoothstep(0.62, 0.97, vAlong);');
    };
    mat.customProgramCacheKey = () => 'cable-pulse';
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 2;
    spin.add(mesh);

    // мягкое свечение вокруг импульса
    const gGeo = new THREE.TubeGeometry(curve, segs, 0.06, 10, false);
    const gAlong = new Float32Array(gGeo.attributes.position.count);
    for (let i = 0; i <= segs; i++) for (let j = 0; j <= 10; j++) gAlong[i * 11 + j] = i / segs;
    gGeo.setAttribute('along', new THREE.BufferAttribute(gAlong, 1));
    const gMat = new THREE.ShaderMaterial({
      uniforms: uni, transparent: true, depthWrite: false,
      vertexShader: `attribute float along; varying float vAlong; varying float vRim;
        void main(){ vAlong = along; vec4 mv = modelViewMatrix * vec4(position,1.0);
          vec3 n = normalize(normalMatrix * normal); vRim = abs(dot(n, normalize(-mv.xyz)));
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vAlong; varying float vRim;
        uniform float uPhase, uLevel, uLen, uLambda, uStatic; uniform vec3 uGlow;
        void main(){
          float f = fract(vAlong * uLen / uLambda - uPhase);
          float b = smoothstep(0.0, 0.3, f) * (1.0 - smoothstep(0.3, 0.36, f));
          b = mix(b, 0.1, uStatic);
          float a = b * uLevel * pow(vRim, 2.2) * 0.5 * (1.0 - smoothstep(0.5, 0.88, vAlong));
          gl_FragColor = vec4(vec3(0.953, 0.604, 0.169), a);
        }`,
    });
    const glow = new THREE.Mesh(gGeo, gMat);
    glow.renderOrder = 3;
    spin.add(glow);
    cableU.push({ uni, phase: 0, level: 0 });
  };
  makeCable(-1);
  makeCable(1);

  // контактная тень
  const shTex = new THREE.CanvasTexture(drawShadow());
  const shadowY = -H / 2 - 0.2;
  const shadowA = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.8),
    new THREE.MeshBasicMaterial({ map: shTex, color: 0x2a2620, transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false }));
  shadowA.rotation.x = -Math.PI / 2; shadowA.position.y = shadowY;
  const shadowB = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.34),
    new THREE.MeshBasicMaterial({ map: shTex, color: 0x1e1a16, transparent: true, opacity: 0.38, depthWrite: false, toneMapped: false }));
  shadowB.rotation.x = -Math.PI / 2; shadowB.position.y = shadowY + 0.001;
  scene.add(shadowA, shadowB);

  // ---------- экран: состояние отображения ----------
  const view = { power: 0, boot: false, minutes: 30, blink1: true, blink2: true };
  let bootTimer = 0, runSeconds = 0;
  const redraw = () => { drawLCD(lcdCtx, st, view); lcdTex.needsUpdate = true; };
  redraw();

  // ---------- логика ----------
  const pushSpring = new Spring(240, 13);
  const apply = (k) => {
    if (k === 'power') {
      st.on = !st.on;
      st.ch1 = 0; st.ch2 = 0;
      if (st.on) {
        view.power = 1; view.boot = true; runSeconds = 0; view.minutes = 30;
        clearTimeout(bootTimer);
        bootTimer = setTimeout(() => { view.boot = false; redraw(); wake(); }, 650);
      } else {
        view.power = 0; view.boot = false; clearTimeout(bootTimer);
      }
    } else if (st.on) {
      if (k === 'prog') {
        st.prog = st.prog % PROGS + 1;
        st.mode = modeFor(st.prog);
        st.ch1 = 0; st.ch2 = 0; // смена программы сбрасывает интенсивность
      } else {
        const ch = k.slice(0, 3);
        st[ch] = Math.max(0, Math.min(MAX_LEVEL, st[ch] + (k.endsWith('+') ? 1 : -1)));
      }
    }
    redraw();
    emit();
  };
  const commit = (k) => {
    try { haptic('tap'); } catch (e) { /* ничего */ }
    apply(k);
    pushSpring.v += 5.5;
    lastInteract = performance.now();
    wake();
  };
  const press = (k) => {
    if (!KEYS.includes(k)) return;
    const { b, dir } = btnFor(k);
    b.dir = dir;
    b.pulseUntil = performance.now() + 110;
    commit(k);
  };

  // ---------- ввод ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pick = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([body, ...pickables], false);
    if (!hits.length || hits[0].object === body) return null;
    const m = hits[0].object, b = m.userData.btn;
    if (b.kind === 'round') return { b, key: b.key, dir: 0 };
    const local = m.worldToLocal(hits[0].point.clone());
    const dir = local.y >= 0 ? 1 : -1;
    return { b, key: b.ch + (dir > 0 ? '+' : '-'), dir };
  };

  let ptr = null; // активный указатель
  let dragging = false;
  let userYaw = 0, userPitch = 0, yawVel = 0, pitchVel = 0;
  let lastInteract = -1e9;
  let holdTimer = 0, repeatTimer = 0;

  const stopRepeat = () => { clearTimeout(holdTimer); clearInterval(repeatTimer); holdTimer = repeatTimer = 0; };
  const releaseBtn = () => { if (ptr && ptr.hit) ptr.hit.b.held = 0; };

  const onDown = (e) => {
    if (ptr || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const hit = pick(e.clientX, e.clientY);
    ptr = { id: e.pointerId, type: e.pointerType, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t: performance.now(), hit, decided: false, repeated: false };
    yawVel = 0; pitchVel = 0;
    lastInteract = performance.now();
    if (hit) {
      hit.b.held = 1; hit.b.dir = hit.dir;
      if (hit.b.kind === 'rocker') {
        holdTimer = setTimeout(() => {
          if (!ptr || dragging) return;
          ptr.repeated = true;
          commit(hit.key);
          repeatTimer = setInterval(() => { if (ptr && !dragging) commit(hit.key); }, 105);
        }, 420);
      }
    }
    if (e.pointerType === 'mouse') { try { canvas.setPointerCapture(e.pointerId); } catch (_) {} }
    wake();
  };
  const onMove = (e) => {
    if (!ptr) {
      if (e.pointerType === 'mouse') {
        const h = pick(e.clientX, e.clientY);
        canvas.style.cursor = h ? 'pointer' : 'grab';
      }
      return;
    }
    if (e.pointerId !== ptr.id) return;
    const now = performance.now();
    const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
    const tx = e.clientX - ptr.x0, ty = e.clientY - ptr.y0;
    if (!ptr.decided && Math.hypot(tx, ty) > 7) {
      ptr.decided = true;
      if (ptr.type === 'mouse' || Math.abs(tx) > Math.abs(ty) * 1.15) {
        dragging = true;
        stopRepeat(); releaseBtn();
        if (ptr.type !== 'mouse') { try { canvas.setPointerCapture(e.pointerId); } catch (_) {} }
        canvas.style.cursor = 'grabbing';
      } else {
        // вертикальный жест на тач-экране: отдаём прокрутке
        stopRepeat(); releaseBtn(); ptr = null; return;
      }
    }
    if (dragging) {
      const dts = Math.max(1, now - ptr.t) / 1000;
      const k = 0.0095;
      userYaw += dx * k;
      const vy = (dx * k) / dts;
      yawVel = Math.max(-5, Math.min(5, yawVel * 0.5 + vy * 0.5));
      if (ptr.type === 'mouse') {
        userPitch = Math.max(-0.35, Math.min(0.35, userPitch + dy * 0.004));
        pitchVel = Math.max(-1.5, Math.min(1.5, pitchVel * 0.5 + (dy * 0.004 / dts) * 0.5));
      }
      lastInteract = now;
    }
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = now;
    wake();
  };
  const onUp = (e, cancel) => {
    if (!ptr || e.pointerId !== ptr.id) return;
    const p = ptr;
    stopRepeat();
    if (p.hit) {
      p.hit.b.held = 0;
      if (!dragging && !cancel && !p.repeated) {
        p.hit.b.pulseUntil = performance.now() + 70;
        commit(p.hit.key);
      }
    }
    if (performance.now() - p.t > 80) { yawVel = 0; pitchVel = 0; }
    ptr = null; dragging = false;
    lastInteract = performance.now();
    if (e.pointerType === 'mouse') canvas.style.cursor = pick(e.clientX, e.clientY) ? 'pointer' : 'grab';
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    wake();
  };
  const onUpEv = (e) => onUp(e, false);
  const onCancelEv = (e) => onUp(e, true);
  const onLeave = () => { if (!ptr) canvas.style.cursor = 'grab'; };
  const onCtx = (e) => { if (ptr && ptr.type !== 'mouse') e.preventDefault(); };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUpEv);
  canvas.addEventListener('pointercancel', onCancelEv);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('contextmenu', onCtx);

  // ---------- размеры и камера ----------
  const BASE_YAW = -0.4, BASE_PITCH = 0.03;
  let cw = 0, chh = 0;
  const fit = () => {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    if (w === cw && h === chh) return;
    cw = w; chh = h;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    // Нужно уместить: по высоте от тени до проводов над штекерами, по ширине - прибор с запасом на поворот.
    const halfH = 2.18, halfW = 0.95;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(halfH / tan, halfW / (tan * aspect));
    const elev = 0.15;
    camera.position.set(0, camTarget.y + Math.sin(elev) * dist, Math.cos(elev) * dist);
    camera.lookAt(camTarget);
    camera.updateProjectionMatrix();
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { fit(); wake(); }) : null;
  if (ro) ro.observe(canvas);
  fit();

  // ---------- цикл ----------
  let visible = true, docVisible = !document.hidden, raf = 0, last = 0, time = 0, sway = reduced ? 0 : 1, disposed = false;
  let quietFrames = 0;
  const update = (dt, now) => {
    time += dt;
    const idle = !ptr && now - lastInteract > 2600;
    if (!dragging) {
      userYaw += yawVel * dt; userPitch += pitchVel * dt;
      const damp = Math.exp(-dt * 4.2);
      yawVel *= damp; pitchVel *= damp;
      if (idle) {
        const k = 1 - Math.exp(-dt * 1.3);
        // возвращаемся к ближайшему «лицом вперёд»
        const target = Math.round(userYaw / (Math.PI * 2)) * Math.PI * 2;
        userYaw += (target - userYaw) * k;
        userPitch += (0 - userPitch) * k;
      }
      userPitch = Math.max(-0.35, Math.min(0.35, userPitch));
    }
    const swayTarget = idle && !reduced ? 1 : 0;
    sway += (swayTarget - sway) * (1 - Math.exp(-dt * 1.2));
    pushSpring.step(dt);
    const yaw = BASE_YAW + userYaw + sway * 0.3 * Math.sin(time * 0.42);
    const pitch = BASE_PITCH + userPitch + sway * 0.045 * Math.sin(time * 0.61 + 1.2) - pushSpring.x * 0.035;
    spin.rotation.set(pitch, yaw, sway * 0.02 * Math.sin(time * 0.33));
    const bob = sway * 0.035 * Math.sin(time * 0.9);
    root.position.set(0, bob, -pushSpring.x * 0.05);
    const sh = 1 - bob * 2.5;
    shadowA.scale.set(sh * (0.85 + 0.15 * Math.abs(Math.cos(yaw))), sh, 1);
    shadowB.scale.copy(shadowA.scale);
    shadowA.material.opacity = 0.22 * sh; shadowB.material.opacity = 0.3 * sh;

    // кнопки
    let moving = !pushSpring.settled || Math.abs(yawVel) > 1e-3 || dragging || sway > 1e-3;
    for (const b of buttons) {
      b.spring.target = (b.held || now < b.pulseUntil) ? 1 : 0;
      b.spring.step(dt);
      const p = b.spring.x;
      if (b.kind === 'round') {
        b.mesh.position.z = baseZ - p * 0.013;
      } else {
        b.mesh.position.z = baseZ - Math.abs(p) * 0.006;
        b.mesh.rotation.x = -b.dir * p * 0.085;
      }
      if (!b.spring.settled) moving = true;
    }

    // подсветка экрана
    const blTarget = st.on ? 0.62 : 0;
    const bl = lcdMat.emissiveIntensity;
    lcdMat.emissiveIntensity = bl + (blTarget - bl) * (1 - Math.exp(-dt * 14));
    if (Math.abs(lcdMat.emissiveIntensity - blTarget) > 1e-3) moving = true;

    // таймер сеанса: идёт, пока хотя бы один канал работает
    if (st.on && (st.ch1 > 0 || st.ch2 > 0)) {
      runSeconds += dt;
      const m = Math.max(0, 30 - Math.floor(runSeconds / 60));
      if (m !== view.minutes) { view.minutes = m; redraw(); }
    }

    // импульсы по проводам
    [st.ch1, st.ch2].forEach((lv, i) => {
      const c = cableU[i];
      const level = st.on ? lv : 0;
      const target = level > 0 ? 0.45 + 0.55 * level / MAX_LEVEL : 0;
      c.level += (target - c.level) * (1 - Math.exp(-dt * 8));
      const freq = level > 0 ? 0.75 + level * 0.085 : 0; // импульсов в секунду
      if (!reduced) c.phase += freq * dt;
      c.uni.uPhase.value = c.phase;
      c.uni.uLevel.value = c.level;
      c.uni.uStatic.value = reduced ? 1 : 0;
      const flash = reduced ? 0.5 : Math.exp(-((c.phase % 1)) * 5);
      collarGlow[i].emissiveIntensity = c.level * (0.6 + 2.4 * flash);
      if (c.level > 1e-3 && !reduced) moving = true;
      if (Math.abs(c.level - target) > 1e-3) moving = true;
    });
    return moving;
  };

  const tick = (now) => {
    raf = 0;
    if (disposed || !visible || !docVisible) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    fit();
    const moving = update(dt, now);
    renderer.render(scene, camera);
    // в режиме reduced-motion, когда всё замерло, перестаём крутить цикл
    quietFrames = moving ? 0 : quietFrames + 1;
    if (quietFrames > 3) { last = 0; return; }
    raf = requestAnimationFrame(tick);
  };
  function wake() {
    quietFrames = 0;
    if (!raf && !disposed && visible && docVisible) raf = requestAnimationFrame(tick);
  }

  const io = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver((ents) => {
      visible = ents.some((e) => e.isIntersecting);
      if (visible) wake(); else { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }
    }, { rootMargin: '80px' })
    : null;
  if (io) io.observe(canvas);
  const onVis = () => { docVisible = !document.hidden; if (docVisible) wake(); else last = 0; };
  document.addEventListener('visibilitychange', onVis);
  const onMQ = (e) => { if (opts.reducedMotion == null) { reduced = e.matches; wake(); } };
  if (mq && mq.addEventListener) mq.addEventListener('change', onMQ);
  wake();

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    stopRepeat(); clearTimeout(bootTimer);
    if (io) io.disconnect();
    if (ro) ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    if (mq && mq.removeEventListener) mq.removeEventListener('change', onMQ);
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUpEv);
    canvas.removeEventListener('pointercancel', onCancelEv);
    canvas.removeEventListener('pointerleave', onLeave);
    canvas.removeEventListener('contextmenu', onCtx);
    canvas.style.touchAction = prevTouchAction;
    canvas.style.cursor = prevCursor;
    const seen = new Set();
    scene.traverse((o) => {
      if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) {
        if (seen.has(m)) continue; seen.add(m);
        for (const k of ['map', 'emissiveMap']) if (m[k] && !seen.has(m[k])) { seen.add(m[k]); m[k].dispose(); }
        m.dispose();
      }
    });
    envTex.dispose();
    renderer.dispose();
  };

  return {
    press,
    get state() { return { ...st }; },
    dispose,
  };
}
