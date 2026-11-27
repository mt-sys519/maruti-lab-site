import { Engine } from './engine.js';
import { loadLutFromBuffer, loadLutFromUrl } from './loaders.js';
import { mountLayout, frameLayout, TRIM0, TRIM_ZOOM_MAX, drawFrameUnder, drawFrameOver, drawFrameShade, loadMountArt, mountCode, filmFrameNumber, readExifDate, DRAWN_FRAMES, LIGHT_FRAMES, MOUNT_STYLES, transmissionGlow, transmissionScatter } from './print.js';

const $ = (id) => document.getElementById(id);

const SAMPLES = [
  { label: '人物', url: 'photos/person.jpg' },
  { label: '風景', url: 'photos/fuji.jpg' },
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
const lastInGroup = {}; // the last look used in each tab, by tab id (a group's letter or a purpose's p:id)
let currentTab = 'p:people';

// 目的: a way in for people who do not know the groups. Each gathers looks from all nine groups,
// chosen by their names and descriptions; the icon says the subject at a glance.
const ICON = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const PURPOSES = [
  { id: 'p:people', label: '人物', note: '肌がやわらかく明るく見える色。9系統から集めました',
    icon: ICON('<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.8-4 3.8-6.2 7.5-6.2s6.7 2.2 7.5 6.2"/>'),
    codes: ['F05', 'S01', 'C01', 'K02', 'P05', 'O10', 'F02', 'S09', 'F04', 'R03', 'O03', 'N04'] },
  { id: 'p:land', label: '風景', note: '空の青と緑が映える色',
    icon: ICON('<path d="M3 19l6.5-10 4 6 2.5-3.5L21 19z"/><circle cx="17" cy="6" r="1.8"/>'),
    codes: ['F01', 'S04', 'S05', 'S07', 'P04', 'C02', 'K03', 'K10', 'K04', 'O08', 'R01', 'L02', 'S03'] },
  { id: 'p:street', label: '街', note: '街のスナップに合う、硬めで渋い色',
    icon: ICON('<path d="M4 20V9h5v11M9 20V5h6v15M15 20v-8h5v8M3 20h18"/>'),
    codes: ['F06', 'F03', 'F07', 'F08', 'R02', 'R04', 'R05', 'P03', 'N05', 'N06', 'N11', 'K09', 'P07'] },
  { id: 'p:mono', label: 'モノクロ', note: '白黒。やわらかいものから硬いものまで',
    icon: ICON('<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>'),
    codes: ['F09', 'F10', 'S10', 'N17', 'N18', 'N20', 'P08', 'P09', 'P10', 'P11', 'P12', 'L03', 'L04', 'C06', 'R06', 'R07', 'R08', 'R09', 'K13', 'O04', 'O11'] },
  { id: 'p:film', label: 'フィルム', note: '褪せた色、クロス現像、セピア。昔のフィルムやプリントの風合い',
    icon: ICON('<rect x="4" y="3.5" width="16" height="17" rx="1.5"/><path d="M8 3.5v17M16 3.5v17M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4"/>'),
    codes: ['F13', 'S06', 'S08', 'K05', 'O07', 'N12', 'K11', 'R10', 'R11', 'R12', 'O05', 'F11', 'S11', 'N13', 'O06'] },
  { id: 'p:mood', label: '気分', note: '朝の青、夢のアンバー、染めた色。気分で選ぶ色',
    icon: ICON('<path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z"/><path d="M18.5 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/>'),
    codes: ['N01', 'N02', 'N03', 'N07', 'N08', 'N09', 'N10', 'N14', 'N15', 'N16', 'K12', 'K07', 'O02', 'O01', 'K06'] },
];

// The looks a tab shows: a purpose's own list, or a group's looks.
function tabItems(id) {
  const pu = PURPOSES.find((x) => x.id === id);
  if (!pu) return presets.filter((p) => p.group === id);
  const byCode = new Map(presets.filter((p) => p.group !== 'U').map((p) => [p.code, p]));
  return pu.codes.map((c) => byCode.get(c)).filter(Boolean);
}

// Choosing a tab shows it and applies its last-used look (else its first) right away.
function openTab(id) {
  currentTab = id; renderTabs(); renderThumbs();
  const items = tabItems(id);
  const pick = items.find((p) => p === lastInGroup[id]) || items[0];
  if (pick && pick !== current) selectPreset(pick);
  reveal();
}
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
let filmBase = 'black'; // the film strip's base: black (reversal), brown (negative's orange mask) or clear
let mountStyle = 'slide'; // the slide mount's colour: slide (white plastic), slideblack or slidecard (card)
let saveLong = 0; // long side of the saved image; 0 keeps the photo's own size
let thumbToken = 0;

function toast(msg, isError = false, ms = 0) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('error', isError);
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), ms || (isError ? 5000 : 2200));
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
    refreshTiles();
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
  Object.assign(crop.style, { left: '', top: '', width: '', height: '' });
  Object.assign(box.style, { left: '', top: '' });
  engine.params.light = -1;
  engine.params.mtf = 0;
  for (const k of ['l', 't', 'r', 'b']) box.style.removeProperty(`--crop-${k}`);
  let s, cssW = 0, cssH = 0;
  engine.view.map = null;
  if (DRAWN_FRAMES.includes(frame)) {
    // the photo shows through its window, cropped to the frame's shape; the rest is drawn
    const L = frameLayout(frame, engine.imgW, engine.imgH, trim);
    const mw = Math.floor(Math.min(availW, availH / L.ratio));
    // The frame is drawn over the photo with its window cut out, so the window's edge comes from one
    // canvas only. The photo's canvas runs under the frame BLEED px past the window, so rounding to
    // the screen's pixels (125% scaling and the like) never leaves an edge of the window uncovered or
    // the light short of the picture's edge. The canvas shows only the crop, turned (placeCrop).
    win = { w: L.w * mw, h: L.h * mw };
    bleed = BLEED;
    cssW = win.w + 2 * BLEED; cssH = win.h + 2 * BLEED;
    Object.assign(stage.style, { width: mw + 'px', height: Math.floor(mw * L.ratio) + 'px', paddingTop: '' });
    Object.assign(crop.style, { left: L.x * mw - BLEED + 'px', top: L.y * mw - BLEED + 'px', width: cssW + 'px', height: cssH + 'px' });
    artWidth = mw;
    placeCrop(L);
    syncOrient(L);
    engine.params.light = isSlide() ? slideLight : -1;
    // on slide film the picture takes the film's sharpness: how many of the photo's pixels make a
    // millimetre of the frame (the window's width in mm is L.w / L.mm)
    engine.params.mtf = isSlide() ? L.crop.w * L.mm / L.w : 0;
    drawArt();
  } else if (frame !== 'none') {
    // the 4:5 mount as it will be saved, the photo (its crop) placed by mountLayout
    const g = frameLayout(frame, engine.imgW, engine.imgH, trim);
    const mw = Math.floor(Math.min(availW, availH / g.ratio));
    s = (g.w * mw) / g.crop.w;
    Object.assign(stage.style, { width: mw + 'px', height: Math.floor(mw * g.ratio) + 'px', paddingTop: (g.y * mw) + 'px' });
    // The look's name and the number in the same proportion to the mount as the saved file has them:
    // set at 10px and scaled down, as browsers will not draw text below their minimum size, and a
    // minimum on a small mount ran the two together.
    const TEXT_PX = 10;
    cap.style.top = captionY(g) * mw + 'px';
    cap.style.fontSize = TEXT_PX + 'px';
    cap.style.letterSpacing = TEXT_PX * 0.24 + 'px';
    cap.style.transform = `translateY(-50%) scale(${mw * 0.016 / TEXT_PX})`;
    const code = $('frameDate'), k = mw * CODE_SIZE / TEXT_PX;
    code.style.top = captionY(g) * mw + 'px';
    code.style.fontSize = TEXT_PX + 'px';
    code.style.letterSpacing = TEXT_PX * CODE_TRACK + 'px';
    code.style.transformOrigin = 'right center';
    code.style.transform = `translateY(-50%) scale(${k})`;
    code.style.right = (1 - g.x - g.w) * mw + 'px';
    code.style.marginRight = -TEXT_PX * CODE_TRACK * k + 'px'; // letter-spacing trails the last digit
    code.textContent = mountCode(photoDate, lookDigits());
  } else {
    // at most the photo's own pixels at the crop's full size, so zooming in keeps its size on screen
    const c0 = frameLayout('none', engine.imgW, engine.imgH, trim).crop;
    s = Math.min(availW / c0.w, availH / c0.h, trim.zoom);
    Object.assign(stage.style, { width: '', height: '', paddingTop: '' });
  }
  if (!cssW) {
    // no window: the canvas is the crop itself, edge to edge
    const L = frameLayout(frame, engine.imgW, engine.imgH, trim);
    win = { w: Math.max(1, Math.floor(L.crop.w * s)), h: Math.max(1, Math.floor(L.crop.h * s)) };
    cssW = win.w; cssH = win.h;
    bleed = 0;
    placeCrop(L);
    syncOrient(L);
  }
  const c = $('view');
  c.style.width = cssW + 'px';
  c.style.height = cssH + 'px';
  // no more canvas pixels than photo pixels across it, nor than a GPU canvas wants
  const dpr = (window.devicePixelRatio || 1) * zoomRes;
  const cw = Math.max(1, Math.min(4096, Math.ceil(cssW / cropScale), Math.round(cssW * dpr)));
  const ch = Math.max(1, Math.min(4096, Math.ceil(cssH / cropScale), Math.round(cssH * dpr)));
  if (c.width !== cw) c.width = cw; // reassigning clears the canvas, even to the same size
  if (c.height !== ch) c.height = ch;
  $('splitLine').style.left = splitX * 100 + '%';
  requestRender();
}

// The photo on screen: the canvas (win, the window or the photo's own crop in CSS px, and bleed round
// it, BLEED under a drawn frame) shows L.crop turned by its angle, through the engine's map from canvas
// to photo. cropScale is the screen px per photo px. The labels on the photo keep to the window.
let cropScale = 1, win = { w: 0, h: 0 }, bleed = 0;
const BLEED = 3;
function placeCrop(L) {
  const c = L.crop, s = win.w / c.w, W = win.w + 2 * bleed, H = win.h + 2 * bleed;
  const cos = Math.cos(c.angle), sin = Math.sin(c.angle), iw = engine.imgW, ih = engine.imgH;
  cropScale = s;
  // a point d from the window's centre (screen px) shows the photo at the crop's centre + R(-angle)·d / s
  engine.view.map = [
    [cos * W / s / iw, sin * H / s / iw, (c.cx - (cos * W + sin * H) / 2 / s) / iw],
    [-sin * W / s / ih, cos * H / s / ih, (c.cy - (-sin * W + cos * H) / 2 / s) / ih],
  ];
  const box = $('canvasBox');
  for (const k of ['l', 't', 'r', 'b']) box.style.setProperty(`--crop-${k}`, bleed + 'px');
  requestRender();
}

// How the photo sits in a drawn frame's window: turned, zoomed and moved (see TRIM0 in print.js).
let trim = { ...TRIM0 };
let trimming = false; // the トリミング mode, where the dock holds the turn and the dial

// The drawn frame (film or slide mount) behind the photo on screen, the same drawing the saved file gets.
let artWidth = 0;

// Pinch zoom of the picture on screen: s about the stage's centre, then x, y in px. zoomRes is the
// scale the canvases were last drawn for, so a zoomed picture is redrawn sharp once the fingers lift.
let zoom = { s: 1, x: 0, y: 0 }, zoomRes = 1;
function applyZoom() {
  $('stage').style.transform = zoom.s === 1 && !zoom.x && !zoom.y ? '' : `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})`;
}
function resetZoom() {
  zoom = { s: 1, x: 0, y: 0 };
  zoomRes = 1;
  applyZoom();
}
function drawArt() {
  if (!DRAWN_FRAMES.includes(frame) || !engine.imgW || !artWidth) return;
  const L = frameLayout(frame, engine.imgW, engine.imgH, trim);
  const dpr = Math.min((window.devicePixelRatio || 1) * zoomRes, 4096 / artWidth);
  const glow = isSlide() ? screenGlow(L) : null;
  // the frame over the photo with its window cut out, then the light through it (screened on)
  const under = (x, w) => { drawFrameUnder(x, w, L, frameText(), slideLight); x.clearRect(L.x * w, L.y * w, L.w * w, L.h * w); drawFrameShade(x, w, L); };
  for (const [id, draw] of [['frameArt', under], ['frameOver', (x, w) => drawFrameOver(x, w, L, glow, slideLight)]]) {
    const c = $(id);
    c.style.width = artWidth + 'px'; c.style.height = Math.floor(artWidth * L.ratio) + 'px';
    c.width = Math.round(artWidth * dpr); c.height = Math.round(artWidth * L.ratio * dpr);
    draw(c.getContext('2d'), c.width);
  }
}

// Frames seen with light coming through them: the film strip and the slide mounts.
function isSlide() { return LIGHT_FRAMES.includes(frame); }

// The glow for the screen, from a small read of the rendered picture (rows come bottom-up).
function screenGlow(L) {
  // read finer as the crop gets smaller, so the glow comes from as many pixels as the saved one's
  const sw = Math.max(16, Math.min(engine.imgW, 2048, Math.round(192 * engine.imgW / L.crop.w)));
  const sh = Math.max(1, Math.round(sw * engine.imgH / engine.imgW));
  const px = engine.readSmall(sw, sh);
  const flip = new Uint8ClampedArray(px.length);
  for (let r = 0; r < sh; r++) flip.set(px.subarray((sh - 1 - r) * sw * 4, (sh - r) * sw * 4), r * sw * 4);
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  c.getContext('2d').putImageData(new ImageData(flip, sw, sh), 0, 0);
  const crop = document.createElement('canvas');
  crop.width = 192; crop.height = Math.max(1, Math.round(192 * L.crop.h / L.crop.w));
  drawCrop(crop.getContext('2d'), c, L, 0, 0, crop.width, crop.height);
  return { glow: transmissionGlow(crop), scatter: transmissionScatter(crop) };
}

// Draw L.crop of img (the photo at any size) into the rect x, y, w, h of ctx, turned as on screen.
function drawCrop(ctx, img, L, x, y, w, h) {
  const c = L.crop, k = w / c.w; // ctx px per photo px
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(c.angle);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, -c.cx * k, -c.cy * k, engine.imgW * k, engine.imgH * k);
  ctx.restore();
}

// The glow follows the picture as looks and sliders change; redrawn a moment after the last change.
let glowTimer = 0;
function refreshGlow() {
  if (!isSlide()) return;
  clearTimeout(glowTimer);
  glowTimer = setTimeout(drawArt, 120);
}

function frameText() {
  return { caption: captionOn ? $('frameCaption').textContent : '', code: stampOn ? mountCode(photoDate, lookDigits()) : '', frame: filmFrameNumber(photoDate), dx: lookDx(), base: filmBase };
}

// The look for the film's DX bars: its place in the whole list (product class) and its group (specifier).
function lookDx() {
  if (!current) return { product: 0, specifier: 0 };
  const g = parseInt(lookDigits().slice(0, 2), 10);
  return { product: presets.indexOf(current) + 1, specifier: g === 99 ? 15 : g };
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

// ---------- トリミング ----------
// The photo moved and zoomed by the pointer(s), from a snapshot taken when the gesture starts: the
// photo point that was under m0 is put under m, the crop zoomed k times (1 for a plain drag).
function trimSnap(m0) {
  const L = frameLayout(frame, engine.imgW, engine.imgH, trim);
  const r = $('cropBox').getBoundingClientRect();
  return { m0, cx: L.crop.cx, cy: L.crop.cy, angle: L.crop.angle, s: cropScale, zoom: trim.zoom, wc: { x: r.left + r.width / 2, y: r.top + r.height / 2 } };
}
function trimMove(g, m, k = 1) {
  const zoom = Math.max(1, Math.min(TRIM_ZOOM_MAX, g.zoom * k)), s = g.s * zoom / g.zoom;
  const cos = Math.cos(g.angle), sin = Math.sin(g.angle);
  // a screen point as an offset in photo px from the crop's centre
  const at = (p, sc) => { const dx = p.x - g.wc.x, dy = p.y - g.wc.y; return { x: (cos * dx + sin * dy) / sc, y: (-sin * dx + cos * dy) / sc }; };
  const a = at(g.m0, g.s), b = at(m, s);
  trim = { ...trim, zoom, x: (g.cx + a.x - b.x) / engine.imgW, y: (g.cy + a.y - b.y) / engine.imgH };
  // keep the centre where frameLayout holds it, so the next gesture starts from what is on screen
  const c = frameLayout(frame, engine.imgW, engine.imgH, trim).crop;
  trim.x = c.cx / engine.imgW; trim.y = c.cy / engine.imgH;
  trimChanged();
}

// After the trim changed: relayout when the window's shape may change (a quarter turn, the window's
// direction), else only move the photo in it. The glow and the tiles follow a moment later.
function trimChanged(shape = false) {
  if (!engine.imgW) return;
  // without a window the photo's own crop is the shape on screen, so it is laid out again every time
  if (shape || !DRAWN_FRAMES.includes(frame)) layout();
  else placeCrop(frameLayout(frame, engine.imgW, engine.imgH, trim));
  drawDial();
}

// 分度器: the fine angle on a scale that slides under a fixed needle, DIAL_PX of drag a degree.
const DIAL_PX = 8, FINE_MAX = 45;
function setFine(v) {
  v = Math.max(-FINE_MAX, Math.min(FINE_MAX, Math.round(v * 10) / 10));
  if (Object.is(v, -0)) v = 0;
  if (v === trim.fine) return;
  trim = { ...trim, fine: v };
  trimChanged();
}
function drawDial() {
  if (!trimming) return;
  const cv = $('dialCanvas'), w = cv.clientWidth, h = cv.clientHeight, dpr = window.devicePixelRatio || 1;
  const f = trim.fine;
  $('dialVal').textContent = `${f > 0 ? '+' : f < 0 ? '−' : ''}${Math.abs(f).toFixed(1)}°`;
  $('dial').setAttribute('aria-valuenow', f.toFixed(1));
  if (!w) return;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const x = cv.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, w, h);
  const mid = w / 2, base = h - 3, ink = getComputedStyle($('dial')).color;
  x.fillStyle = ink;
  for (let d = Math.ceil(f - mid / DIAL_PX); d <= f + mid / DIAL_PX; d++) {
    if (d < -FINE_MAX || d > FINE_MAX) continue;
    const px = mid + (d - f) * DIAL_PX;
    const len = d % 10 === 0 ? 12 : d % 5 === 0 ? 9 : 5;
    // the ticks fade toward the ends of the scale
    x.globalAlpha = Math.max(0, 1 - Math.abs(px - mid) / mid) * (d % 5 === 0 ? 0.9 : 0.55);
    x.fillRect(Math.round(px * dpr) / dpr - 0.5, base - len, 1, len);
    if (d === 0) { x.beginPath(); x.arc(px, base - len - 3.5, 1.6, 0, Math.PI * 2); x.fill(); }
  }
  x.globalAlpha = 1;
  x.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#c65a3c';
  x.fillRect(mid - 1, base - 17, 2, 17);
}

function setTrimming(on) {
  if (on === trimming) return;
  trimming = on;
  $('viewport').classList.toggle('trimming', on);
  $('dock').classList.toggle('trimming', on);
  $('btnTrim').classList.toggle('on', on);
  if (on) { resetZoom(); layout(); drawDial(); }
}

// The window's direction (窓の向き): a button in the トリミング mode for the film strip and the slide
// mounts only, showing the direction the layout made.
function syncOrient(L) {
  const b = $('btnOrient'), show = isSlide();
  b.hidden = !show;
  $('dock').classList.toggle('has-orient', show);
  if (show) {
    b.classList.toggle('is-wide', !!L.wide);
    b.setAttribute('aria-label', L.wide ? '窓の向き：横（押すと縦）' : '窓の向き：縦（押すと横）');
  }
  drawDial();
}

// The photo turned or zoomed with no window (なし, 白, 黒) changes the saved file; untouched, it is saved
// as it always was.
function plainTrim() { return !trim.q && !trim.fine && trim.zoom === 1; }

// L.crop of the photo, rendered in full as the save does, at k output px per photo px.
function renderCrop(L, k) {
  const iw = engine.imgW, ih = engine.imgH, long = Math.round(Math.max(iw, ih) * k), shrink = k < 1;
  const pixels = engine.renderFull(shrink ? long : 0);
  let img = document.createElement('canvas');
  img.width = iw; img.height = ih;
  img.getContext('2d').putImageData(new ImageData(pixels, iw, ih), 0, 0);
  if (shrink) img = shrinkCanvas(img, long);
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(L.crop.w * k)); out.height = Math.max(1, Math.round(L.crop.h * k));
  drawCrop(out.getContext('2d'), img, L, 0, 0, out.width, out.height);
  return out;
}

// The crop as it is now rendered, w wide (for the tiles).
function croppedPhoto(L, w, light) {
  const c = L.crop, src = renderedPhoto(Math.min(engine.imgW, Math.max(16, Math.ceil(w * engine.imgW / c.w))), light);
  const out = document.createElement('canvas');
  out.width = w; out.height = Math.max(1, Math.round(w * c.h / c.w));
  drawCrop(out.getContext('2d'), src, L, 0, 0, out.width, out.height);
  return out;
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
// The photo on screen, so it can be put back when the GPU context comes back: the file itself, or
// 'scene' for the drawn fallback.
let photoSrc = null;

// keep: the same photo put back after a lost context, the zoom and crop left as they were.
async function setPhotoFromBlob(blob, keep = false) {
  photoDate = (await readExifDate(blob)) || (blob.lastModified ? new Date(blob.lastModified) : new Date());
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  let w = bmp.width, h = bmp.height;
  const lim = engine.maxTex;
  if (w > lim || h > lim) { const s = lim / Math.max(w, h); w = Math.floor(w * s); h = Math.floor(h * s); }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  photoSrc = blob;
  engine.setImage(c, w, h);
  $('resInfo').textContent = `${w} × ${h}`;
  if (!keep) { resetZoom(); trim = { ...TRIM0 }; setTrimming(false); }
  layout();
  renderThumbs();
}

async function loadSample(i) {
  document.querySelectorAll('#sampleBar .sbtn:not(.sbtn-add)').forEach((b, k) => b.classList.toggle('active', k === i));
  try {
    const res = await fetch(SAMPLES[i].url);
    if (!res.ok) throw new Error(res.status);
    await setPhotoFromBlob(await res.blob());
  } catch {
    if (!engine.imgW) fallbackScene();
    toast('サンプル写真を読み込めませんでした。手元の写真を選んでください');
  }
}

// A lost GPU context comes back empty: put the photo back. A context lost again within a few seconds
// of putting it back means the photo itself is too much for the GPU; it is not tried a third time, and
// the next photo chosen is shown as usual.
let putBackAt = -1e9, giveUp = false;
function onContextLost() {
  giveUp = performance.now() - putBackAt < 5000;
}
function onContextRestored() {
  if (giveUp) {
    giveUp = false;
    engine.imgW = engine.imgH = 0;
    photoSrc = null;
    $('thumbs').innerHTML = '';
    toast('この写真は大きすぎて表示できませんでした。別の写真を選んでください', true);
    return;
  }
  putBackAt = performance.now();
  if (photoSrc === 'scene') fallbackScene(true);
  else if (photoSrc) setPhotoFromBlob(photoSrc, true).catch((e) => toast(e.message, true));
}

function fallbackScene(keep = false) {
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
  photoSrc = 'scene';
  engine.setImage(c, W, H);
  if (!keep) { trim = { ...TRIM0 }; setTrimming(false); }
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
    b.dataset.id = t.id;
    b.setAttribute('role', 'tab');
    b.innerHTML = '<span class="dot"></span><span></span>';
    b.querySelector('.dot').style.background = GROUP_COLORS[t.id] || GROUP_COLORS.U;
    b.lastChild.textContent = t.id === 'U' ? '手持ち' : t.id;
    b.title = t.label;
    b.addEventListener('click', () => openTab(t.id));
    el.appendChild(b);
  }
  el.scrollLeft = keep;
  el.querySelector('.tab.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  markGroupTab();
  const pt = $('purposeTabs');
  pt.innerHTML = '';
  for (const pu of PURPOSES) {
    const b = document.createElement('button');
    b.className = 'pt' + (pu.id === currentTab ? ' on' : '');
    b.setAttribute('role', 'tab');
    b.title = pu.note;
    b.innerHTML = `${pu.icon}<span>${pu.label}</span>`;
    b.addEventListener('click', () => openTab(pu.id));
    pt.appendChild(b);
  }
  const pu = PURPOSES.find((x) => x.id === currentTab);
  $('groupNote').textContent = pu ? `${pu.note}（${tabItems(pu.id).length}種）` : tabsList().find((t) => t.id === currentTab)?.note || '';
}

function renderThumbs() {
  const el = $('thumbs');
  el.innerHTML = '';
  if (!engine.imgW) return;
  const token = ++thumbToken;
  const items = tabItems(currentTab);
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
  markGroupTab();
}

// While a purpose tab is open, the chosen look's group is underlined too, so its letter can be learnt.
function markGroupTab() {
  const purpose = PURPOSES.some((x) => x.id === currentTab);
  document.querySelectorAll('#tabs .tab').forEach((b) => b.classList.toggle('cur', purpose && current?.group === b.dataset.id));
}

async function selectPreset(p) {
  try {
    const lut = await getLut(p);
    current = p;
    lastInGroup[p.group] = p;
    if (tabItems(currentTab).includes(p)) lastInGroup[currentTab] = p;
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
    $('frameCaption').textContent = `FILMEA  //  ${p.group === 'U' ? 'USER' : 'TYPE-' + p.code}`;
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
  currentTab = PURPOSES[0].id;
  renderTabs();
  renderThumbs();
  const first = tabItems(currentTab)[0] || presets[0];
  if (first) selectPreset(first);
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
    if (!plainTrim()) return await saveTrimmed(iw, ih);
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
    await download(g ? composeMount(frame, mountW, g, img) : img);
  } catch (e) {
    toast(`保存できませんでした: ${e.message}`, true);
  } finally {
    btn.disabled = false;
  }
}

// The white or black mount mountW wide with the photo (img, already at its size on the mount) on it,
// and the look's name and the number under it. small: a tile, where the text keeps its proportion
// instead of a readable minimum size.
function composeMount(style, mountW, g, img, small = false) {
  const out = document.createElement('canvas');
  out.width = mountW; out.height = Math.round(mountW * g.ratio);
  const x = out.getContext('2d');
  x.fillStyle = style === 'white' ? '#f8f7f3' : '#151517';
  x.fillRect(0, 0, out.width, out.height);
  x.drawImage(img, Math.round((mountW - img.width) / 2), Math.round(g.y * mountW));
  const fs = small ? mountW * 0.016 : Math.max(11, Math.round(mountW * 0.016));
  x.font = `500 ${fs}px "DM Mono", Consolas, monospace`;
  x.textBaseline = 'middle';
  if ('letterSpacing' in x) x.letterSpacing = `${fs * 0.24}px`;
  const cy = captionY(g) * mountW;
  if (captionOn) {
    x.fillStyle = style === 'white' ? '#5b5752' : '#8c8a86';
    x.textAlign = 'center';
    x.fillText($('frameCaption').textContent, mountW / 2, cy);
  }
  if (stampOn) {
    // right-aligned to the photo's edge; letterSpacing also trails the last digit, so shift it back
    const cs = small ? mountW * CODE_SIZE : Math.max(8, Math.round(mountW * CODE_SIZE));
    x.font = `500 ${cs}px "DM Mono", Consolas, monospace`;
    const track = cs * CODE_TRACK;
    if ('letterSpacing' in x) x.letterSpacing = `${track}px`;
    x.fillStyle = style === 'white' ? DATE_INK.white : DATE_INK.dark;
    x.textAlign = 'right';
    x.fillText(mountCode(photoDate, lookDigits()), (g.x + g.w) * mountW + ('letterSpacing' in x ? track : 0), cy);
  }
  return out;
}

// なし, 白 or 黒 with the photo turned or zoomed: the crop, never enlarged when saved bare (as the whole
// photo never is), and at the mount's own size on a mount.
async function saveTrimmed(iw, ih) {
  const L = frameLayout(frame, iw, ih, trim), c = L.crop;
  if (frame === 'none') {
    await download(renderCrop(L, saveLong ? Math.min(1, saveLong / Math.max(c.w, c.h)) : 1));
    return;
  }
  let mountW = saveLong || Math.round(c.w / L.w);
  mountW = Math.min(mountW, Math.floor(Math.sqrt(16e6 / L.ratio)));
  await download(composeMount(frame, mountW, L, renderCrop(L, (L.w * mountW) / c.w)));
}

// Instant, film or slide mount: the frame drawn at the chosen width, the photo cropped into its window.
async function saveDrawnFrame(iw, ih) {
  const L = frameLayout(frame, iw, ih, trim);
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
  await download(composeFrame(mountW, L, img, frameText(), slideLight));
}

// A drawn frame W wide with the picture in its window and the light through it. img: the rendered
// photo at any size (its scale is read per axis, so a rounded height cannot shift the crop).
function composeFrame(W, L, img, text, light) {
  const out = document.createElement('canvas');
  out.width = W; out.height = Math.round(W * L.ratio);
  const x = out.getContext('2d');
  drawFrameUnder(x, W, L, text, light);
  drawCrop(x, img, L, L.x * W, L.y * W, L.w * W, L.h * W);
  drawFrameShade(x, W, L);
  const g = document.createElement('canvas');
  g.width = 192; g.height = Math.max(1, Math.round(192 * L.crop.h / L.crop.w));
  drawCrop(g.getContext('2d'), img, L, 0, 0, g.width, g.height);
  drawFrameOver(x, W, L, { glow: transmissionGlow(g), scatter: transmissionScatter(g) }, light);
  return out;
}

// ---------- 枠 tiles ----------
// The frames as small tiles of the visitor's own photo, in the chosen look with the sliders applied.
// フィルム化 (the film strip and slide mounts, on the light box) and 枠 (mounts and the instant card),
// each its own row of tiles; one frame at a time across both.
const FILM_TILES = [['none', 'なし'], ['film', 'スリーブ'], ['mount', 'マウント']];
// the マウント tile stands for whichever mount colour is chosen
const tileOf = (f) => MOUNT_STYLES.includes(f) ? 'mount' : f;
const styleOf = (v) => v === 'mount' ? mountStyle : v;
const MOUNT_TILES = [['none', 'なし'], ['white', '白'], ['dark', '黒'], ['instant', 'インスタント']];
const TILE_W = 220; // px of the tile's picture: sharp on a 2x screen in the three-across row

// The photo as it is now rendered, w wide, through the light box when light >= 0 (top row first).
function renderedPhoto(w, light) {
  const h = Math.max(1, Math.round(w * engine.imgH / engine.imgW));
  const keep = engine.params.light;
  engine.params.light = light;
  const px = engine.readSmall(w, h);
  engine.params.light = keep;
  const flip = new Uint8ClampedArray(w * h * 4);
  for (let r = 0; r < h; r++) flip.set(px.subarray((h - 1 - r) * w * 4, (h - r) * w * 4), r * w * 4);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').putImageData(new ImageData(flip, w, h), 0, 0);
  return c;
}

function drawTiles() {
  if (!engine.imgW || !current) return;
  for (const b of document.querySelectorAll('.ftile')) {
    const style = styleOf(b.dataset.v);
    let pic;
    if (style === 'none') {
      const L = frameLayout(style, engine.imgW, engine.imgH, trim), c = L.crop;
      pic = croppedPhoto(L, c.w >= c.h ? TILE_W : Math.max(16, Math.round(TILE_W * c.w / c.h)), -1);
    } else if (style === 'white' || style === 'dark') {
      const g = frameLayout(style, engine.imgW, engine.imgH, trim);
      pic = composeMount(style, TILE_W, g, croppedPhoto(g, Math.max(16, Math.round(g.w * TILE_W)), -1), true);
    } else {
      const L = frameLayout(style, engine.imgW, engine.imgH, trim);
      const light = LIGHT_FRAMES.includes(style) ? slideLight : -1;
      pic = composeFrame(TILE_W, L, renderedPhoto(Math.min(engine.imgW, Math.max(16, Math.ceil(TILE_W * L.w * engine.imgW / L.crop.w))), light), frameText(), slideLight);
    }
    const c = b.querySelector('canvas');
    c.width = pic.width; c.height = pic.height;
    c.getContext('2d').drawImage(pic, 0, 0);
  }
}

// Redrawn a moment after the last change of photo, look, slider or text.
let tileTimer = 0;
function refreshTiles() {
  clearTimeout(tileTimer);
  tileTimer = setTimeout(drawTiles, 150);
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
const THUMB = 18; // px, the range thumb's width in style.css
function setFill(el) {
  if (el.classList.contains('wb')) return;
  const min = +el.min, max = +el.max, v = +el.value;
  const pos = ((v - min) / (max - min)) * 100;
  const from = min < 0 ? ((0 - min) / (max - min)) * 100 : 0;
  // the thumb's centre only travels from one radius in to one radius short of the end, so the fill's
  // edge is placed on that run, not on the whole track, or it slips off the thumb toward either end
  const at = (p) => p <= 0 ? '0%' : p >= 100 ? '100%' : `calc(${THUMB / 2}px + (100% - ${THUMB}px) * ${p / 100})`;
  const a = at(Math.min(from, pos)), b = at(Math.max(from, pos));
  const inDock = !!el.closest('.dock');
  const fill = inDock ? 'var(--dock-ink)' : 'var(--accent)';
  const base = inDock ? 'rgba(255,255,255,.2)' : 'var(--surface-2)';
  el.style.background = `linear-gradient(90deg, transparent ${a}, ${fill} ${a}, ${fill} ${b}, transparent ${b}), ${base}`;
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
  let cropDrag = null; // dragging the photo in a drawn frame's window
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
    if (trimming) return; // the stage takes the photo in the トリミング mode
    if (!splitOn) {
      // long-press on the photo shows the original, like photo editors on phones
      box.setPointerCapture(e.pointerId);
      pressTimer = setTimeout(() => {
        holdBtn = true; $('btnHold').classList.add('on'); requestRender();
        hint.classList.add('gone');
        try { localStorage.setItem('filmea-hinted', '1'); } catch {}
      }, 170);
      if (DRAWN_FRAMES.includes(frame) && zoom.s === 1) cropDrag = { x: e.clientX, y: e.clientY, snap: trimSnap({ x: e.clientX, y: e.clientY }), moved: false };
      return;
    }
    dragging = true;
    box.setPointerCapture(e.pointerId);
    moveSplit(e.clientX);
  });
  box.addEventListener('pointermove', (e) => {
    if (dragging) { moveSplit(e.clientX); return; }
    if (!cropDrag || zoom.s !== 1) return;
    const dx = e.clientX - cropDrag.x, dy = e.clientY - cropDrag.y;
    if (!cropDrag.moved && Math.hypot(dx, dy) < 6) return;
    if (!cropDrag.moved) { pressEnd(); cropDrag.moved = true; } // moving the photo, not holding for the original
    trimMove(cropDrag.snap, { x: e.clientX, y: e.clientY }); // the photo follows the finger
  });
  const end = () => { dragging = false; cropDrag = null; pressEnd(); };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);
  box.addEventListener('contextmenu', (e) => e.preventDefault());

  // Pinch to zoom on phones: two fingers zoom about their midpoint and move the picture; while it is
  // zoomed, one finger drags it; a double tap puts it back. Touch only: a mouse keeps its clicks.
  const stage = $('stage');
  const pts = new Map();
  let gesture = null, lastTap = 0, sharpTimer = 0;
  const midOf = (p) => (p.length > 1 ? { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 } : p[0]);
  const begin = () => {
    const p = [...pts.values()], r = stage.getBoundingClientRect();
    gesture = {
      n: p.length, m0: midOf(p), d0: p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0,
      s0: zoom.s, x0: zoom.x, y0: zoom.y, moved: false,
      c: { x: r.left + r.width / 2 - zoom.x, y: r.top + r.height / 2 - zoom.y }, // the unzoomed centre
    };
  };
  const clampZoom = () => {
    const mx = (zoom.s - 1) * stage.offsetWidth / 2, my = (zoom.s - 1) * stage.offsetHeight / 2;
    zoom.x = Math.max(-mx, Math.min(mx, zoom.x));
    zoom.y = Math.max(-my, Math.min(my, zoom.y));
  };
  const sharpen = () => {
    clearTimeout(sharpTimer);
    sharpTimer = setTimeout(() => {
      const want = Math.min(4, Math.max(1, Math.round(zoom.s * 2) / 2));
      if (want !== zoomRes) { zoomRes = want; layout(); }
    }, 150);
  };
  // In the トリミング mode the stage takes every pointer, mouse too: one drags the photo in the window,
  // two pinch it larger or smaller about their midpoint; the wheel zooms about the cursor.
  const tpts = new Map();
  let tg = null;
  const trimBegin = () => {
    const p = [...tpts.values()];
    tg = { n: p.length, d0: p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0, snap: trimSnap(midOf(p)) };
  };
  const trimLift = (e) => {
    if (!tpts.delete(e.pointerId)) return false;
    if (tpts.size) trimBegin(); else tg = null;
    return true;
  };
  stage.addEventListener('wheel', (e) => {
    if (!trimming) return;
    e.preventDefault();
    const m = { x: e.clientX, y: e.clientY }, dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    trimMove(trimSnap(m), m, Math.exp(-dy * 0.0015));
  }, { passive: false });
  stage.addEventListener('pointerdown', (e) => {
    if (trimming) {
      try { stage.setPointerCapture(e.pointerId); } catch {}
      tpts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (tpts.size <= 2) trimBegin();
      return;
    }
    if (e.pointerType !== 'touch') return;
    try { if (!box.hasPointerCapture(e.pointerId)) stage.setPointerCapture(e.pointerId); } catch {}
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { pressEnd(); dragging = false; cropDrag = null; } // a second finger: a pinch, not a hold or a drag
    if (pts.size <= 2) begin();
  });
  stage.addEventListener('pointermove', (e) => {
    if (tpts.has(e.pointerId)) {
      tpts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const p = [...tpts.values()];
      if (!tg || !trimming) return;
      if (tg.n >= 2 && p.length >= 2) trimMove(tg.snap, midOf(p), Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) / tg.d0);
      else if (tg.n === 1) trimMove(tg.snap, p[0]);
      return;
    }
    if (!pts.has(e.pointerId) || !gesture) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = [...pts.values()];
    if (gesture.n >= 2 && p.length >= 2) {
      // keep the point that was under the fingers' midpoint under it
      const m = midOf(p), d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const s = Math.max(1, Math.min(6, gesture.s0 * d / gesture.d0)), k = s / gesture.s0, c = gesture.c;
      zoom = { s, x: m.x - c.x - k * (gesture.m0.x - c.x - gesture.x0), y: m.y - c.y - k * (gesture.m0.y - c.y - gesture.y0) };
      gesture.moved = true;
    } else if (gesture.n === 1 && zoom.s > 1 && !splitOn) {
      const dx = p[0].x - gesture.m0.x, dy = p[0].y - gesture.m0.y;
      if (!gesture.moved && Math.hypot(dx, dy) < 6) return;
      if (!gesture.moved) pressEnd(); // dragging the picture, not holding for the original
      gesture.moved = true;
      zoom.x = gesture.x0 + dx; zoom.y = gesture.y0 + dy;
    } else return;
    clampZoom();
    applyZoom();
  });
  const lift = (e) => {
    if (trimLift(e)) return;
    if (!pts.has(e.pointerId)) return;
    const tap = gesture && gesture.n === 1 && !gesture.moved;
    pts.delete(e.pointerId);
    if (pts.size) { begin(); return; } // one finger left after a pinch carries on dragging
    gesture = null;
    if (zoom.s < 1.03) { zoom = { s: 1, x: 0, y: 0 }; applyZoom(); }
    if (tap) {
      if (e.timeStamp - lastTap < 300 && zoom.s > 1) { zoom = { s: 1, x: 0, y: 0 }; applyZoom(); lastTap = 0; }
      else lastTap = e.timeStamp;
    }
    sharpen();
  };
  stage.addEventListener('pointerup', lift);
  stage.addEventListener('pointercancel', lift);

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
    $('sizeLabel').textContent = frame === 'none' ? '大きさ（長い辺）' : '大きさ（枠の横幅）';
    $('frameState').textContent = document.querySelector('#sizeSeg button.on').textContent;
  };
  // One frame at a time, from either row of tiles; the other row shows なし. The light slider shows for
  // the frames on the light box, the text checks under whichever row holds the frame; the look's label
  // leaves the photo, as the frame prints it.
  const SECTIONS = [['filmTiles', FILM_TILES, 'filmBody', 'filmState'], ['mountTiles', MOUNT_TILES, 'mountBody', 'mountState']];
  const sectionOf = (v) => SECTIONS.find(([, list]) => v !== 'none' && list.some(([x]) => x === tileOf(v)));
  const setFrame = (v) => {
    frame = v;
    resetZoom();
    const drawn = DRAWN_FRAMES.includes(frame), sec = sectionOf(frame);
    for (const [id] of SECTIONS) {
      const mine = sec && sec[0] === id;
      document.querySelectorAll(`#${id} .ftile`).forEach((x) => x.classList.toggle('on', x.dataset.v === (mine ? tileOf(frame) : 'none')));
    }
    $('lightCtrl').hidden = !isSlide();
    $('baseCtrl').hidden = frame !== 'film';
    $('mountCtrl').hidden = !MOUNT_STYLES.includes(frame);
    for (const [id, list, body, state] of SECTIONS) {
      const mine = sec && sec[0] === id;
      $(body).hidden = !mine;
      $(state).textContent = mine ? list.find(([x]) => x === tileOf(frame))[1] : 'なし';
    }
    const checks = $('textChecks'), note = $('cropNote');
    checks.hidden = !sec;
    note.hidden = !drawn;
    if (sec) { $(sec[2]).appendChild(note); $(sec[2]).appendChild(checks); }
    $('viewport').classList.toggle('framed', frame !== 'none');
    $('stage').className = 'stage' + (frame === 'none' ? '' : ` frame-${frame}`) + (drawn ? ' drawn' : '');
    saveState();
    layout();
  };
  for (const [id, list] of SECTIONS) {
    for (const [v, label] of list) {
      const b = document.createElement('button');
      b.className = 'ftile' + (v === 'none' ? ' on' : '');
      b.dataset.v = v;
      b.setAttribute('role', 'radio');
      b.innerHTML = '<div class="box"><canvas></canvas></div><div class="fname"><span></span></div>';
      b.querySelector('span').textContent = label;
      // なし takes off a frame from its own row only; a frame chosen in the other row stays
      b.addEventListener('click', () => { if (v !== 'none' || sectionOf(frame)?.[0] === id) setFrame(styleOf(v)); });
      $(id).appendChild(b);
    }
  }
  $('btnOrient').addEventListener('click', () => {
    const wide = frameLayout(frame, engine.imgW, engine.imgH, trim).wide;
    trim = { ...trim, orient: wide ? 'upright' : 'wide' };
    trimChanged(true);
  });
  $('btnTrim').addEventListener('click', () => setTrimming(!trimming));
  $('btnTrimDone').addEventListener('click', () => setTrimming(false));
  $('btnTrimReset').addEventListener('click', () => { trim = { ...TRIM0 }; trimChanged(true); });
  $('btnTurn').addEventListener('click', () => { trim = { ...trim, q: (trim.q + 1) % 4 }; trimChanged(true); });
  // the dial: drag the scale; a double tap or double click on the number puts it back to 0
  const dial = $('dial');
  let dd = null, valTap = 0;
  dial.addEventListener('pointerdown', (e) => {
    dial.setPointerCapture(e.pointerId);
    dd = { x: e.clientX, f: trim.fine, moved: false, onVal: $('dialVal').contains(e.target) };
  });
  dial.addEventListener('pointermove', (e) => {
    if (!dd) return;
    const dx = e.clientX - dd.x;
    if (!dd.moved && Math.abs(dx) < 3) return;
    dd.moved = true;
    setFine(dd.f - dx / DIAL_PX);
  });
  const dialUp = (e) => {
    if (dd && !dd.moved && dd.onVal && e.type === 'pointerup') {
      if (e.timeStamp - valTap < 350) { setFine(0); valTap = 0; } else valTap = e.timeStamp;
    }
    dd = null;
  };
  dial.addEventListener('pointerup', dialUp);
  dial.addEventListener('pointercancel', dialUp);
  // ← → turn by 0.1°, with Shift by 1°, while the mode is on (the panel's sliders keep their keys)
  window.addEventListener('keydown', (e) => {
    if (!trimming || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.target.tagName === 'INPUT') return;
    e.preventDefault();
    setFine(trim.fine + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1 : 0.1));
  });
  window.addEventListener('resize', drawDial);

  $('s-light').addEventListener('input', (e) => {
    slideLight = +e.target.value / 100;
    $('v-light').textContent = e.target.value;
    setFill(e.target);
    engine.params.light = isSlide() ? slideLight : -1;
    requestRender();
  });
  $('baseSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    filmBase = b.dataset.v;
    document.querySelectorAll('#baseSeg button').forEach((x) => x.classList.toggle('on', x === b));
    drawArt(); refreshTiles();
  });
  $('mountSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    mountStyle = b.dataset.v;
    document.querySelectorAll('#mountSeg button').forEach((x) => x.classList.toggle('on', x === b));
    if (MOUNT_STYLES.includes(frame)) setFrame(mountStyle);
    refreshTiles();
  });
  $('s-light').addEventListener('dblclick', (e) => { e.target.value = 60; e.target.dispatchEvent(new Event('input')); });
  // the slider is the truth: if a browser brings back its last position, the light follows it
  slideLight = +$('s-light').value / 100;
  $('v-light').textContent = $('s-light').value;
  setFill($('s-light'));
  $('stampCheck').addEventListener('change', (e) => { stampOn = e.target.checked; $('frameDate').classList.toggle('hidden', !stampOn); saveState(); drawArt(); refreshTiles(); });
  $('captionCheck').addEventListener('change', (e) => { captionOn = e.target.checked; $('frameCaption').classList.toggle('hidden', !captionOn); drawArt(); refreshTiles(); });
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

// As an app: the service worker keeps the page usable offline, and the button in the top bar adds the
// page as an app. On phones and tablets the button is always there: where the browser can do it from
// the page (Chrome on Android) it asks right away, elsewhere (Safari on iPhone) it says how. On a
// computer, where few want it, the button shows only while the browser offers to install the page.
function appSetup() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  const btn = $('btnInstall');
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) { btn.hidden = true; return; }
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const handheld = ios || /Android|Mobi/i.test(navigator.userAgent);
  let offer = null;
  const show = () => { btn.hidden = !(handheld || offer); };
  show();
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); offer = e; show(); });
  window.addEventListener('appinstalled', () => { offer = null; btn.hidden = true; });
  btn.addEventListener('click', async () => {
    if (offer) {
      offer.prompt();
      const choice = await offer.userChoice.catch(() => null);
      offer = null;
      if (choice?.outcome === 'accepted') btn.hidden = true; else show();
      return;
    }
    toast(ios ? 'Safari の共有ボタン（□に↑）から「ホーム画面に追加」を選ぶと、アプリとして使えます'
      : 'ブラウザのメニューの「アプリをインストール」か「ホーム画面に追加」から、アプリとして追加できます', false, 6000);
  });
}

function boot() {
  appSetup();
  try {
    engine = new Engine($('view'));
  } catch (e) {
    toast(e.message, true);
    return;
  }
  engine.onLost = onContextLost;
  engine.onRestored = onContextRestored;
  window.__filmea = { engine, get presets() { return presets; } };
  initUI();
  // the rendered slide mounts; the picture's crop changes with them, so lay out again once they are in
  loadMountArt(() => { layout(); refreshTiles(); });
  fallbackScene();
  loadPresets();
  loadSample(0);
}

boot();
