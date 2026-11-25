import { Engine } from './engine.js';
import { loadLutFromBuffer, loadLutFromUrl } from './loaders.js';
import { mountLayout, frameLayout, drawFrameUnder, drawFrameOver, windowRadius, mountCode, readExifDate, DRAWN_FRAMES, transmissionGlow, transmissionScatter } from './print.js';

const $ = (id) => document.getElementById(id);

const SAMPLES = [
  { label: '人物', url: 'photos/portrait.jpg' },
  { label: '風景', url: 'photos/landscape.jpg' },
  { label: '街', url: 'photos/street.jpg' },
  { label: '赤', url: 'photos/red.jpg' },
  { label: '陰影', url: 'photos/shade.jpg' },
];

// The date on the mount, in the amber of a film's edge printing (deeper on white so it still reads).
const DATE_INK = { white: '#d4890f', dark: '#e8a51e' };
const CODE_SIZE = 0.0115, CODE_TRACK = 0.12; // the number's size (of the mount's width) and tracking

const GROUP_COLORS = { F: '#4f7a5e', S: '#5a6f93', N: '#b8863b', P: '#7c5f8f', L: '#a8463e', C: '#9a5b45', R: '#3f6e73', K: '#6b7d3c', O: '#c0703a', U: '#6f6a63' };

const SLIDERS = {
  intensity: { def: 100, to: (v) => v / 100, fmt: (v) => `${v}` },
  exposure: { def: 0, to: (v) => v / 100, fmt: (v) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v / 100).toFixed(2)} EV` },
  wb: { def: 0, to: (v) => v / 100, fmt: (v) => (v > 0 ? `+${v} 暖` : v < 0 ? `−${-v} 寒` : '0') },
  grain: { def: 0, to: (v) => v / 100, fmt: (v) => `${v}%` },
  vignette: { def: 0, to: (v) => v / 100, fmt: (v) => `${v}%` },
};

let engine;
let groups = [];
let presets = [];
let current = null;
const lastInGroup = {};
let currentTab = 'F';
const lutCache = new Map();
const lutLoading = new Map();
let userCount = 0;
let splitOn = false;
let splitX = 0.5;
let holdKey = false, holdBtn = false;
let rafPending = false;
let frame = 'none';
const lookIntensity = new Map(); // each look keeps its own 効き具合; a look not touched yet starts at 100
let stampOn = true;   // the keycode-like number at the mount's lower right
let captionOn = true; // the look's code under the photo on a mount
let photoDate = new Date();
let slideLight = 0.6; // 光の強さ, the light box behind slides and the film strip, 0..1
let saveLong = 0; // long side of the saved image; 0 keeps the photo's own size
let thumbToken = 0;

function toast(msg, isError = false) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('error', isError);
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), isError ? 5000 : 2200);
}

function requestRender() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    engine.view.bypass = holdKey || holdBtn;
    engine.view.splitX = splitOn && !engine.view.bypass ? splitX : -1;
    engine.render();
    if ($('infoSec').open) drawHistogram();
    if (!engine.view.bypass) refreshGlow();
    const showTags = splitOn && !engine.view.bypass && !!current;
    $('tagBefore').classList.toggle('show', showTags);
    $('tagAfter').classList.toggle('show', showTags);
    $('splitLine').classList.toggle('active', showTags);
    $('viewport').classList.toggle('splitting', showTags);
    $('viewport').classList.toggle('holding', engine.view.bypass && !!current);
  });
}

// ---------- layout ----------
function layout() {
  if (!engine.imgW) return;
  const vp = $('viewport');
  const cs = getComputedStyle(vp);
  let availW = vp.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  let availH = vp.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const stage = $('stage'), cap = $('frameCaption');
  const crop = $('cropBox'), box = $('canvasBox');
  Object.assign(crop.style, { left: '', top: '', width: '', height: '', borderRadius: '' });
  Object.assign(box.style, { left: '', top: '' });
  engine.params.light = -1;
  for (const k of ['l', 't', 'r', 'b']) box.style.removeProperty(`--crop-${k}`);
  let s;
  if (DRAWN_FRAMES.includes(frame)) {
    // the photo shows through its window, cropped to the frame's shape; the rest is drawn
    const L = frameLayout(frame, engine.imgW, engine.imgH);
    const mw = Math.floor(Math.min(availW, availH / L.ratio));
    s = (L.w * mw) / L.crop.w;
    Object.assign(stage.style, { width: mw + 'px', height: Math.floor(mw * L.ratio) + 'px', paddingTop: '' });
    Object.assign(crop.style, { left: L.x * mw + 'px', top: L.y * mw + 'px', width: L.w * mw + 'px', height: L.h * mw + 'px', borderRadius: windowRadius(L, mw) + 'px' });
    Object.assign(box.style, { left: -L.crop.x * s + 'px', top: -L.crop.y * s + 'px' });
    // where the window sits inside the photo, so the labels on the photo stay inside it
    const cut = { l: L.crop.x, t: L.crop.y, r: engine.imgW - L.crop.x - L.crop.w, b: engine.imgH - L.crop.y - L.crop.h };
    for (const k in cut) box.style.setProperty(`--crop-${k}`, cut[k] * s + 'px');
    artWidth = mw;
    engine.params.light = isSlide() ? slideLight : -1;
    drawArt();
  } else if (frame !== 'none') {
    // the 4:5 mount as it will be saved, photo placed by mountLayout
    const g = mountLayout(engine.imgW, engine.imgH);
    const mw = Math.floor(Math.min(availW, availH / g.ratio));
    s = (g.w * mw) / engine.imgW;
    Object.assign(stage.style, { width: mw + 'px', height: Math.floor(mw * g.ratio) + 'px', paddingTop: (g.y * mw) + 'px' });
    cap.style.top = captionY(g) * mw + 'px';
    cap.style.fontSize = Math.max(7, mw * 0.016) + 'px';
    cap.style.letterSpacing = Math.max(1, mw * 0.016 * 0.24) + 'px';
    const code = $('frameDate');
    code.style.top = captionY(g) * mw + 'px';
    code.style.fontSize = Math.max(6, mw * CODE_SIZE) + 'px';
    code.style.letterSpacing = mw * CODE_SIZE * CODE_TRACK + 'px';
    code.style.right = (1 - g.x - g.w) * mw + 'px';
    code.style.marginRight = -mw * CODE_SIZE * CODE_TRACK + 'px'; // letter-spacing trails the last digit
    code.textContent = mountCode(photoDate, lookDigits());
  } else {
    s = Math.min(availW / engine.imgW, availH / engine.imgH, 1);
    Object.assign(stage.style, { width: '', height: '', paddingTop: '' });
  }
  // Behind a drawn frame's window the photo is rounded up, not down: the window clips the extra, and
  // a photo a fraction of a pixel short of the window would leave the mount showing along one edge.
  const round = DRAWN_FRAMES.includes(frame) ? Math.ceil : Math.floor;
  const cssW = Math.max(1, round(engine.imgW * s));
  const cssH = Math.max(1, round(engine.imgH * s));
  const c = $('view');
  c.style.width = cssW + 'px';
  c.style.height = cssH + 'px';
  const dpr = window.devicePixelRatio || 1;
  c.width = Math.min(engine.imgW, Math.round(cssW * dpr));
  c.height = Math.min(engine.imgH, Math.round(cssH * dpr));
  $('splitLine').style.left = splitX * 100 + '%';
  requestRender();
}

// The drawn frame (film or slide mount) behind the photo on screen, the same drawing the saved file gets.
let artWidth = 0;
function drawArt() {
  if (!DRAWN_FRAMES.includes(frame) || !engine.imgW || !artWidth) return;
  const L = frameLayout(frame, engine.imgW, engine.imgH);
  const dpr = window.devicePixelRatio || 1;
  const glow = isSlide() ? screenGlow(L) : null;
  for (const [id, draw] of [['frameArt', (x, w) => drawFrameUnder(x, w, L, frameText(), slideLight)], ['frameOver', (x, w) => drawFrameOver(x, w, L, glow, slideLight)]]) {
    const c = $(id);
    c.style.width = artWidth + 'px'; c.style.height = Math.floor(artWidth * L.ratio) + 'px';
    c.width = Math.round(artWidth * dpr); c.height = Math.round(artWidth * L.ratio * dpr);
    draw(c.getContext('2d'), c.width);
  }
}

// Frames seen with light coming through them: the film strip and the slide mounts.
function isSlide() { return frame === 'film' || frame === 'slide' || frame === 'slidecard'; }

// The glow for the screen, from a small read of the rendered picture (rows come bottom-up).
function screenGlow(L) {
  const sw = 192, sh = Math.max(1, Math.round(192 * engine.imgH / engine.imgW));
  const px = engine.readSmall(sw, sh);
  const flip = new Uint8ClampedArray(px.length);
  for (let r = 0; r < sh; r++) flip.set(px.subarray((sh - 1 - r) * sw * 4, (sh - r) * sw * 4), r * sw * 4);
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  c.getContext('2d').putImageData(new ImageData(flip, sw, sh), 0, 0);
  const k = sw / engine.imgW;
  const crop = document.createElement('canvas');
  crop.width = Math.max(1, Math.round(L.crop.w * k)); crop.height = Math.max(1, Math.round(L.crop.h * k));
  crop.getContext('2d').drawImage(c, L.crop.x * k, L.crop.y * k, L.crop.w * k, L.crop.h * k, 0, 0, crop.width, crop.height);
  return { glow: transmissionGlow(crop), scatter: transmissionScatter(crop) };
}

// The glow follows the picture as looks and sliders change; redrawn a moment after the last change.
let glowTimer = 0;
function refreshGlow() {
  if (!isSlide()) return;
  clearTimeout(glowTimer);
  glowTimer = setTimeout(drawArt, 120);
}

function frameText() {
  return { caption: captionOn ? $('frameCaption').textContent : '', code: stampOn ? mountCode(photoDate, lookDigits()) : '' };
}

// The look as four digits for the mount's number: its group's place in the tab order, then its number.
function lookDigits() {
  if (!current) return '0000';
  const gi = current.group === 'U' ? 99 : groups.findIndex((g) => g.id === current.group) + 1;
  const n = parseInt(String(current.code).replace(/\D/g, ''), 10) || 0;
  return String(gi).padStart(2, '0') + String(n % 100).padStart(2, '0');
}

// The caption and date sit in a narrow band right under the photo (the bottom margin a tall photo
// gets), however much mount a wide photo leaves below.
function captionY(g) {
  return g.y + g.h + Math.min(g.bottom, 0.078) / 2;
}


// ---------- histogram ----------
function drawHistogram() {
  const sw = 192, sh = Math.max(16, Math.round(192 * engine.imgH / engine.imgW));
  const px = engine.readSmall(sw, sh);
  const bins = [new Uint32Array(128), new Uint32Array(128), new Uint32Array(128)];
  for (let i = 0; i < px.length; i += 4) {
    bins[0][px[i] >> 1]++; bins[1][px[i + 1] >> 1]++; bins[2][px[i + 2] >> 1]++;
  }
  let peak = 1;
  for (const b of bins) for (let i = 1; i < 127; i++) peak = Math.max(peak, b[i]);
  const c = $('hist'), x = c.getContext('2d');
  const w = c.width, h = c.height;
  const dark = document.documentElement.dataset.theme === 'dark';
  x.clearRect(0, 0, w, h);
  x.globalCompositeOperation = dark ? 'screen' : 'multiply';
  const cols = dark
    ? [['rgba(235,75,65,0.4)', 'rgba(245,95,85,0.9)'], ['rgba(65,210,115,0.4)', 'rgba(85,230,135,0.9)'], ['rgba(65,135,245,0.4)', 'rgba(95,160,255,0.9)']]
    : [['rgba(226,92,80,0.35)', 'rgba(200,70,60,0.85)'], ['rgba(80,180,110,0.35)', 'rgba(50,150,85,0.85)'], ['rgba(80,130,220,0.35)', 'rgba(55,105,200,0.85)']];
  bins.forEach((b, k) => {
    x.beginPath(); x.moveTo(0, h);
    for (let i = 0; i < 128; i++) x.lineTo((i / 127) * w, h - Math.min(1, b[i] / peak) * (h - 10));
    x.lineTo(w, h); x.closePath();
    x.fillStyle = cols[k][0]; x.fill();
    x.strokeStyle = cols[k][1]; x.lineWidth = 2; x.stroke();
  });
  x.globalCompositeOperation = 'source-over';
}

// ---------- images ----------
async function setPhotoFromBlob(blob) {
  photoDate = (await readExifDate(blob)) || (blob.lastModified ? new Date(blob.lastModified) : new Date());
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  let w = bmp.width, h = bmp.height;
  const lim = engine.maxTex;
  if (w > lim || h > lim) { const s = lim / Math.max(w, h); w = Math.floor(w * s); h = Math.floor(h * s); }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  engine.setImage(c, w, h);
  $('resInfo').textContent = `${w} × ${h}`;
  layout();
  renderThumbs();
}

async function loadSample(i) {
  document.querySelectorAll('#sampleBar .sbtn').forEach((b, k) => b.classList.toggle('active', k === i));
  try {
    const res = await fetch(SAMPLES[i].url);
    if (!res.ok) throw new Error(res.status);
    await setPhotoFromBlob(await res.blob());
  } catch {
    if (!engine.imgW) fallbackScene();
    toast('サンプル写真を読み込めませんでした。手元の写真を選んでください');
  }
}

function fallbackScene() {
  const W = 1500, H = 1000;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, 520);
  sky.addColorStop(0, '#2b62a8'); sky.addColorStop(1, '#cfe0ef');
  x.fillStyle = sky; x.fillRect(0, 0, W, 520);
  x.fillStyle = '#3c6a35'; x.fillRect(0, 520, W, 240);
  for (let i = 0; i < W; i++) { x.fillStyle = `hsl(${(i / W) * 360},70%,50%)`; x.fillRect(i, 760, 1, 120); }
  for (let i = 0; i < W; i++) { const v = Math.round((i / (W - 1)) * 255); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(i, 880, 1, 120); }
  const sk = x.createRadialGradient(420, 330, 20, 430, 350, 170);
  sk.addColorStop(0, '#f6d2bd'); sk.addColorStop(0.6, '#d9a283'); sk.addColorStop(1, '#9a6248');
  x.fillStyle = sk; x.beginPath(); x.arc(430, 350, 160, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#c0282d'; x.fillRect(900, 230, 260, 220);
  engine.setImage(c, W, H);
  $('resInfo').textContent = `${W} × ${H}`;
  layout();
  renderThumbs();
}

// ---------- presets ----------
function getLut(p) {
  if (lutCache.has(p.id)) return Promise.resolve(lutCache.get(p.id));
  if (!lutLoading.has(p.id)) {
    lutLoading.set(p.id, loadLutFromUrl(p.file).then((lut) => { lutCache.set(p.id, lut); return lut; })
      .finally(() => lutLoading.delete(p.id)));
  }
  return lutLoading.get(p.id);
}

function tabsList() {
  const list = groups.map((g) => ({ id: g.id, label: g.label, note: g.note }));
  if (presets.some((p) => p.group === 'U')) list.push({ id: 'U', label: '手持ちのLUT', note: 'ドロップした LUT です。ページを閉じると消えます' });
  return list;
}

// Horizontal strip with ‹ › buttons, wheel and drag scrolling (tabs always, thumbs on phones).
function hscroll(el, extra = '') {
  const wrap = document.createElement('div');
  wrap.className = 'hscroll ' + extra;
  el.parentNode.insertBefore(wrap, el);
  wrap.appendChild(el);
  const mk = (dir) => {
    const b = document.createElement('button');
    b.className = `hs-btn hs-${dir}`;
    b.type = 'button';
    b.setAttribute('aria-label', dir === 'l' ? '前へ' : '次へ');
    b.innerHTML = `<svg viewBox="0 0 24 24"><path d="${dir === 'l' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    b.addEventListener('click', () => el.scrollBy({ left: (dir === 'l' ? -1 : 1) * el.clientWidth * 0.7, behavior: 'smooth' }));
    wrap.appendChild(b);
    return b;
  };
  const L = mk('l'), R = mk('r');
  const update = () => {
    const max = el.scrollWidth - el.clientWidth;
    const scrollable = max > 2 && getComputedStyle(el).overflowX !== 'visible';
    L.classList.toggle('show', scrollable && el.scrollLeft > 2);
    R.classList.toggle('show', scrollable && el.scrollLeft < max - 2);
    wrap.classList.toggle('fade-l', scrollable && el.scrollLeft > 2);
    wrap.classList.toggle('fade-r', scrollable && el.scrollLeft < max - 2);
  };
  el.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(el);
  new MutationObserver(update).observe(el, { childList: true });
  el.addEventListener('wheel', (e) => {
    if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  }, { passive: false });
  // mouse drag; a drag longer than a few px swallows the click that ends it
  let down = null, moved = false;
  el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') { down = { x: e.clientX, s: el.scrollLeft }; moved = false; } });
  window.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - down.x;
    if (Math.abs(dx) > 4) moved = true;
    if (moved) el.scrollLeft = down.s - dx;
  });
  window.addEventListener('pointerup', () => { down = null; });
  el.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  update();
}

function renderTabs() {
  const el = $('tabs');
  const keep = el.scrollLeft;
  el.innerHTML = '';
  for (const t of tabsList()) {
    const b = document.createElement('button');
    b.className = 'tab' + (t.id === currentTab ? ' on' : '');
    b.setAttribute('role', 'tab');
    b.innerHTML = '<span class="dot"></span><span></span>';
    b.querySelector('.dot').style.background = GROUP_COLORS[t.id] || GROUP_COLORS.U;
    b.lastChild.textContent = t.id === 'U' ? '手持ち' : t.id;
    b.title = t.label;
    b.addEventListener('click', () => {
      currentTab = t.id; renderTabs(); renderThumbs();
      // a type is chosen to be seen: apply its last-used look (else its first) right away
      const inGroup = presets.filter((p) => p.group === t.id);
      const pick = inGroup.find((p) => p === lastInGroup[t.id]) || inGroup[0];
      if (pick && pick !== current) selectPreset(pick);
      reveal();
    });
    el.appendChild(b);
  }
  el.scrollLeft = keep;
  el.querySelector('.tab.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  $('groupNote').textContent = tabsList().find((t) => t.id === currentTab)?.note || '';
}

function renderThumbs() {
  const el = $('thumbs');
  el.innerHTML = '';
  if (!engine.imgW) return;
  const token = ++thumbToken;
  const items = presets.filter((p) => p.group === currentTab);
  const tw = 168, th = Math.max(24, Math.round(tw * engine.imgH / engine.imgW));
  const jobs = [];
  for (const p of items) {
    const b = document.createElement('button');
    b.className = 'thumb' + (current === p ? ' on' : '');
    b.dataset.id = p.id;
    b.innerHTML = '<div class="film"><canvas></canvas></div><div class="fname"><code></code><span></span></div>';
    b.querySelector('code').textContent = p.code;
    b.querySelector('.fname span').textContent = p.name;
    b.title = `${p.code} ${p.name}${p.desc ? ' — ' + p.desc : ''}`;
    b.addEventListener('click', () => { selectPreset(p); reveal(); });
    el.appendChild(b);
    jobs.push({ p, canvas: b.querySelector('canvas') });
  }
  (async () => {
    for (const j of jobs) {
      let lut;
      try { lut = await getLut(j.p); } catch { continue; }
      if (token !== thumbToken) return;
      j.canvas.width = tw; j.canvas.height = th;
      j.canvas.getContext('2d').putImageData(new ImageData(engine.renderThumb(lut, tw, th), tw, th), 0, 0);
      await new Promise((r) => requestAnimationFrame(r));
      if (token !== thumbToken) return;
    }
    requestRender();
  })();
}

function markActiveThumb() {
  document.querySelectorAll('.thumb').forEach((b) => b.classList.toggle('on', current?.id === b.dataset.id));
}

async function selectPreset(p) {
  try {
    const lut = await getLut(p);
    current = p;
    lastInGroup[p.group] = p;
    engine.setLut(lut);
    const amt = $('s-intensity');
    amt.value = lookIntensity.get(p) ?? SLIDERS.intensity.def;
    amt.dispatchEvent(new Event('input'));
    const label = $('lookLabel');
    label.querySelector('i').style.background = GROUP_COLORS[p.group] || GROUP_COLORS.U;
    label.querySelector('b').textContent = p.code;
    label.querySelector('span').textContent = p.name;
    label.title = p.desc || '';
    $('activeCode').textContent = `${p.code}  ${p.name}`;
    $('frameCaption').textContent = `filmea  //  ${p.group === 'U' ? 'USER' : 'TYPE-' + p.code}`;
    $('frameDate').textContent = mountCode(photoDate, lookDigits());
    drawArt();
    markActiveThumb();
    requestRender();
  } catch (e) {
    toast(`${p.name}: ${e.message}`, true);
  }
}

async function loadPresets() {
  try {
    const res = await fetch('presets.json', { cache: 'no-store' });
    const json = await res.json();
    groups = json.groups || [];
    presets = (json.presets || []).map((p) => ({ ...p, id: p.id || p.code }));
    const cr = $('credits');
    cr.innerHTML = '';
    for (const line of json.credits || []) { const d = document.createElement('p'); d.textContent = line; cr.appendChild(d); }
  } catch {
    groups = []; presets = [];
  }
  $('lookCount').textContent = `${presets.length} 種`;
  currentTab = groups[0]?.id || 'U';
  renderTabs();
  renderThumbs();
  if (presets.length) selectPreset(presets[0]);
}

async function addUserLut(file) {
  const lut = await loadLutFromBuffer(await file.arrayBuffer(), file.name);
  userCount++;
  const p = {
    id: `user-${userCount}`,
    code: `U${String(userCount).padStart(2, '0')}`,
    name: lut.title || file.name,
    desc: `${file.name}  ·  ${lut.size}³`,
    group: 'U',
  };
  lutCache.set(p.id, lut);
  presets.push(p);
  currentTab = 'U';
  renderTabs();
  renderThumbs();
  await selectPreset(p);
  toast(`${file.name} を読み込みました（${lut.size}³）`);
}

async function isHaldPng(file) {
  if (!/\.png$/i.test(file.name)) return false;
  try {
    const bmp = await createImageBitmap(file);
    const w = bmp.width, h = bmp.height;
    bmp.close?.();
    const l = Math.round(Math.cbrt(w));
    return w === h && l * l * l === w && l >= 2;
  } catch { return false; }
}

async function handleFiles(files) {
  for (const f of files) {
    try {
      if (/\.(cube|lut16)$/i.test(f.name) || await isHaldPng(f)) await addUserLut(f);
      else if (f.type.startsWith('image/')) {
        document.querySelectorAll('.sbtn').forEach((b) => b.classList.remove('active'));
        await setPhotoFromBlob(f);
        reveal();
      } else toast(`${f.name}: 対応していない形式です`, true);
    } catch (e) {
      toast(`${f.name}: ${e.message}`, true);
    }
  }
}

// ---------- save ----------
// Shrink so the long side is `long`, halving first so the last step never skips pixels.
function shrinkCanvas(src, long) {
  const s = long / Math.max(src.width, src.height);
  const tw = Math.max(1, Math.round(src.width * s)), th = Math.max(1, Math.round(src.height * s));
  let cur = src;
  while (cur.width / 2 >= tw && cur.height / 2 >= th) {
    const c = document.createElement('canvas');
    c.width = Math.round(cur.width / 2); c.height = Math.round(cur.height / 2);
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(cur, 0, 0, c.width, c.height);
    cur = c;
  }
  const c = document.createElement('canvas');
  c.width = tw; c.height = th;
  const x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(cur, 0, 0, tw, th);
  return c;
}

async function save() {
  if (!engine.imgW) return;
  const btn = $('btnSave');
  btn.disabled = true;
  await new Promise((r) => setTimeout(r, 30));
  try {
    const iw = engine.imgW, ih = engine.imgH;
    if (DRAWN_FRAMES.includes(frame)) return await saveDrawnFrame(iw, ih);
    const g = frame === 'none' ? null : mountLayout(iw, ih);
    // Long side the photo itself ends up with. On a mount the size choice is the mount's width
    // (1080 -> 1080x1350); the original size keeps the photo's pixels, kept under the ~16.7M-pixel
    // canvas limit of phones.
    let photoLong = saveLong || Math.max(iw, ih);
    let mountW = 0;
    if (g) {
      mountW = saveLong || Math.round(iw / g.w);
      mountW = Math.min(mountW, Math.floor(Math.sqrt(16e6 / g.ratio)));
      photoLong = Math.round(Math.max(g.w, g.h) * mountW);
    }
    const shrink = photoLong < Math.max(iw, ih);
    const pixels = engine.renderFull(shrink ? photoLong : 0);
    let img = document.createElement('canvas');
    img.width = iw; img.height = ih;
    img.getContext('2d').putImageData(new ImageData(pixels, iw, ih), 0, 0);
    if (shrink) img = shrinkCanvas(img, photoLong);
    const W = img.width, H = img.height;
    let out = document.createElement('canvas');
    if (!g) {
      out = img;
    } else {
      out.width = mountW; out.height = Math.round(mountW * g.ratio);
      const x = out.getContext('2d');
      x.fillStyle = frame === 'white' ? '#f8f7f3' : '#151517';
      x.fillRect(0, 0, out.width, out.height);
      x.drawImage(img, Math.round((mountW - W) / 2), Math.round(g.y * mountW));
      const fs = Math.max(11, Math.round(mountW * 0.016));
      x.font = `500 ${fs}px "DM Mono", Consolas, monospace`;
      x.textBaseline = 'middle';
      if ('letterSpacing' in x) x.letterSpacing = `${Math.round(fs * 0.24)}px`;
      const cy = captionY(g) * mountW;
      if (captionOn) {
        x.fillStyle = frame === 'white' ? '#5b5752' : '#8c8a86';
        x.textAlign = 'center';
        x.fillText($('frameCaption').textContent, mountW / 2, cy);
      }
      if (stampOn) {
        // right-aligned to the photo's edge; letterSpacing also trails the last digit, so shift it back
        const cs = Math.max(8, Math.round(mountW * CODE_SIZE));
        x.font = `500 ${cs}px "DM Mono", Consolas, monospace`;
        const track = cs * CODE_TRACK;
        if ('letterSpacing' in x) x.letterSpacing = `${track}px`;
        x.fillStyle = frame === 'white' ? DATE_INK.white : DATE_INK.dark;
        x.textAlign = 'right';
        x.fillText(mountCode(photoDate, lookDigits()), (g.x + g.w) * mountW + ('letterSpacing' in x ? track : 0), cy);
      }
    }
    await download(out);
  } catch (e) {
    toast(`保存できませんでした: ${e.message}`, true);
  } finally {
    btn.disabled = false;
  }
}

// Film or slide mount: the frame drawn at the chosen width, the photo cropped into its window.
async function saveDrawnFrame(iw, ih) {
  const L = frameLayout(frame, iw, ih);
  let mountW = saveLong || Math.round(L.crop.w / L.w);
  mountW = Math.min(mountW, Math.floor(Math.sqrt(16e6 / L.ratio)));
  const k = (L.w * mountW) / L.crop.w; // output pixels per photo pixel
  const long = Math.round(Math.max(iw, ih) * k);
  const shrink = k < 1;
  const pixels = engine.renderFull(shrink ? long : 0);
  let img = document.createElement('canvas');
  img.width = iw; img.height = ih;
  img.getContext('2d').putImageData(new ImageData(pixels, iw, ih), 0, 0);
  if (shrink) img = shrinkCanvas(img, long);
  const f = img.width / iw;
  const out = document.createElement('canvas');
  out.width = mountW; out.height = Math.round(mountW * L.ratio);
  const x = out.getContext('2d');
  drawFrameUnder(x, mountW, L, frameText(), slideLight);
  x.save();
  const r = windowRadius(L, mountW), wx = L.x * mountW, wy = L.y * mountW, ww = L.w * mountW, wh = L.h * mountW;
  x.beginPath(); x.roundRect ? x.roundRect(wx, wy, ww, wh, r) : x.rect(wx, wy, ww, wh); x.clip();
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, L.crop.x * f, L.crop.y * f, L.crop.w * f, L.crop.h * f, wx, wy, ww, wh);
  x.restore();
  let glow = null;
  if (isSlide()) {
    const g = document.createElement('canvas');
    g.width = 192; g.height = Math.max(1, Math.round(192 * L.crop.h / L.crop.w));
    g.getContext('2d').drawImage(img, L.crop.x * f, L.crop.y * f, L.crop.w * f, L.crop.h * f, 0, 0, g.width, g.height);
    glow = { glow: transmissionGlow(g), scatter: transmissionScatter(g) };
  }
  drawFrameOver(x, mountW, L, glow, slideLight);
  await download(out);
}

async function download(out, type = 'image/jpeg') {
  const blob = await new Promise((r) => out.toBlob(r, type, 0.95));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `filmea_${(current?.code || 'none').toLowerCase()}_${Date.now()}.${type === 'image/png' ? 'png' : 'jpg'}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---------- wiring ----------
// Track fill: from the left for 0..max sliders, from the middle for ±sliders (exposure).
function setFill(el) {
  if (el.classList.contains('wb')) return;
  const min = +el.min, max = +el.max, v = +el.value;
  const pos = ((v - min) / (max - min)) * 100;
  const from = min < 0 ? ((0 - min) / (max - min)) * 100 : 0;
  const a = Math.min(from, pos), b = Math.max(from, pos);
  const inDock = !!el.closest('.dock');
  const fill = inDock ? 'var(--dock-ink)' : 'var(--accent)';
  const base = inDock ? 'rgba(255,255,255,.2)' : 'var(--surface-2)';
  el.style.background = `linear-gradient(90deg, transparent ${a}%, ${fill} ${a}%, ${fill} ${b}%, transparent ${b}%), ${base}`;
}

// The page opens on a start screen asking for the visitor's own photo; the portrait sample is
// loaded underneath only so the look thumbnails have something to show.
function reveal() {
  $('viewport').classList.remove('empty');
  requestAnimationFrame(layout);
}

function initUI() {
  hscroll($('tabs'), 'tabs-wrap');
  hscroll($('thumbs'));
  // sample chips: the small row on the stage, and the larger row on the start screen
  for (const [bar, big] of [[$('sampleBar'), false], [$('emptySamples'), true]]) {
    SAMPLES.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = big ? 'sbtn sbtn-big' : 'sbtn';
      b.title = s.label;
      b.setAttribute('aria-label', `サンプル: ${s.label}`);
      b.style.backgroundImage = `url(${s.url.replace(/fit=max&w=\d+&q=\d+/, 'fit=crop&w=160&h=160&q=70')})`;
      if (big) b.innerHTML = `<span>${s.label}</span>`;
      b.addEventListener('click', async () => { await loadSample(i); reveal(); });
      bar.appendChild(b);
    });
  }

  for (const [key, s] of Object.entries(SLIDERS)) {
    const el = $(`s-${key}`), val = $(`v-${key}`);
    const apply = () => {
      const v = parseFloat(el.value);
      val.textContent = s.fmt(v);
      engine.params[key] = s.to(v);
      setFill(el);
      if (key === 'intensity' && current) lookIntensity.set(current, v);
      if (key !== 'intensity') {
        const changed = Object.entries(SLIDERS).some(([k, d]) => k !== 'intensity' && +$(`s-${k}`).value !== d.def);
        $('adjustState').textContent = changed ? '調整中' : '初期値';
      }
      requestRender();
    };
    el.addEventListener('input', apply);
    el.addEventListener('dblclick', () => { el.value = s.def; apply(); });
    apply();
  }
  $('btnReset').addEventListener('click', (e) => {
    e.preventDefault();
    for (const [key, s] of Object.entries(SLIDERS)) {
      if (key === 'intensity') continue;
      $(`s-${key}`).value = s.def; $(`s-${key}`).dispatchEvent(new Event('input'));
    }
  });

  $('btnSplit').addEventListener('click', () => {
    splitOn = !splitOn;
    $('btnSplit').classList.toggle('on', splitOn);
    requestRender();
  });

  const box = $('canvasBox');
  let dragging = false;
  const moveSplit = (clientX) => {
    const r = box.getBoundingClientRect();
    splitX = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    $('splitLine').style.left = splitX * 100 + '%';
    requestRender();
  };
  let pressTimer = 0;
  const hint = $('hint');
  try { if (localStorage.getItem('filmea-hinted')) hint.classList.add('gone'); } catch {}
  const pressEnd = () => { clearTimeout(pressTimer); if (holdBtn) { holdBtn = false; $('btnHold').classList.toggle('on', holdKey); requestRender(); } };
  box.addEventListener('pointerdown', (e) => {
    if (!splitOn) {
      // long-press on the photo shows the original, like photo editors on phones
      box.setPointerCapture(e.pointerId);
      pressTimer = setTimeout(() => {
        holdBtn = true; $('btnHold').classList.add('on'); requestRender();
        hint.classList.add('gone');
        try { localStorage.setItem('filmea-hinted', '1'); } catch {}
      }, 170);
      return;
    }
    dragging = true;
    box.setPointerCapture(e.pointerId);
    moveSplit(e.clientX);
  });
  box.addEventListener('pointermove', (e) => { if (dragging) moveSplit(e.clientX); });
  const end = () => { dragging = false; pressEnd(); };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);
  box.addEventListener('contextmenu', (e) => e.preventDefault());

  const hold = $('btnHold');
  const setHoldBtn = (on) => { holdBtn = on; hold.classList.toggle('on', on || holdKey); requestRender(); };
  hold.addEventListener('pointerdown', (e) => { hold.setPointerCapture(e.pointerId); setHoldBtn(true); });
  hold.addEventListener('pointerup', () => setHoldBtn(false));
  hold.addEventListener('pointercancel', () => setHoldBtn(false));
  hold.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    e.preventDefault();
    if (!holdKey) { holdKey = true; hold.classList.add('on'); requestRender(); }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code !== 'Space') return;
    holdKey = false; hold.classList.toggle('on', holdBtn); requestRender();
  });
  window.addEventListener('blur', () => { holdKey = false; holdBtn = false; hold.classList.remove('on'); requestRender(); });

  const saveState = () => {
    const size = document.querySelector('#sizeSeg button.on').textContent;
    $('sizeLabel').textContent = frame === 'none' ? '大きさ（長い辺）' : '大きさ（台紙の横幅）';
    $('captionCheck').closest('label').classList.toggle('off', frame === 'none');
    $('stampCheck').closest('label').classList.toggle('off', frame === 'none');
    $('lightCtrl').hidden = !isSlide();
    const parts = [size];
    if (frame !== 'none') parts.push(`枠 ${document.querySelector('#frameSeg button.on').textContent}`);
    if (frame !== 'none' && stampOn) parts.push('番号');
    $('frameState').textContent = parts.join('・');
  };
  $('s-light').addEventListener('input', (e) => {
    slideLight = +e.target.value / 100;
    $('v-light').textContent = e.target.value;
    setFill(e.target);
    engine.params.light = isSlide() ? slideLight : -1;
    requestRender();
  });
  $('s-light').addEventListener('dblclick', (e) => { e.target.value = 60; e.target.dispatchEvent(new Event('input')); });
  $('v-light').textContent = $('s-light').value;
  setFill($('s-light'));
  $('stampCheck').addEventListener('change', (e) => { stampOn = e.target.checked; $('frameDate').classList.toggle('hidden', !stampOn); saveState(); drawArt(); });
  $('captionCheck').addEventListener('change', (e) => { captionOn = e.target.checked; $('frameCaption').classList.toggle('hidden', !captionOn); drawArt(); });
  $('frameSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    frame = b.dataset.v;
    document.querySelectorAll('#frameSeg button').forEach((x) => x.classList.toggle('on', x === b));
    $('stage').className = 'stage' + (frame === 'none' ? '' : ` frame-${frame}`) + (DRAWN_FRAMES.includes(frame) ? ' drawn' : '');
    saveState();
    layout();
  });
  $('sizeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    saveLong = +b.dataset.v;
    document.querySelectorAll('#sizeSeg button').forEach((x) => x.classList.toggle('on', x === b));
    saveState();
  });
  saveState();

  $('infoSec').addEventListener('toggle', () => requestRender());
  $('btnHist').addEventListener('click', () => {
    const d = $('infoSec');
    d.open = !d.open;
    $('btnHist').classList.toggle('on', d.open);
  });

  $('btnTheme').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    if (dark) document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem('filmea-theme', dark ? 'dark' : ''); } catch {}
    requestRender();
  });

  $('photoInput').addEventListener('change', (e) => { handleFiles([...e.target.files]); e.target.value = ''; });
  $('lutInput').addEventListener('change', (e) => { handleFiles([...e.target.files]); e.target.value = ''; });
  $('btnSave').addEventListener('click', save);

  const vp = $('viewport');
  let depth = 0;
  document.addEventListener('dragenter', (e) => { e.preventDefault(); depth++; vp.classList.add('dragover'); });
  document.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; vp.classList.remove('dragover'); } });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    depth = 0; vp.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFiles([...e.dataTransfer.files]);
  });

  new ResizeObserver(layout).observe(vp);
}

function boot() {
  try {
    engine = new Engine($('view'));
  } catch (e) {
    toast(e.message, true);
    return;
  }
  window.__filmea = { engine, get presets() { return presets; } };
  initUI();
  fallbackScene();
  loadPresets();
  loadSample(0);
}

boot();
