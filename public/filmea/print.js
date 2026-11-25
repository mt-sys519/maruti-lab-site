// The print-like finish: the 4:5 mount the frame option saves, the date printed on it, and the
// photo's shooting date read from its EXIF.

// The mount takes Instagram's own shapes: 4:5 (1080×1350) for an upright photo, square (1080×1080)
// for a wide or square one, so a wide photo is not left floating in empty mount. The profile grid
// shows posts at 3:4, which trims about 3.1% off each side of a 4:5 post, so the side margin never
// drops below 6% and only the mount is cut. Below the photo the margin is 1.3× the top, as framers
// weight a mat's bottom edge.
const MIN_SIDE = 0.06;
const BOTTOM_WEIGHT = 1.3;

// Geometry for a photo of pw×ph on a mount 1 wide and `ratio` tall.
export function mountLayout(pw, ph) {
  const ratio = ph > pw ? 1.25 : 1;
  const minTop = MIN_SIDE, minV = minTop * (1 + BOTTOM_WEIGHT);
  const s = Math.min((1 - 2 * MIN_SIDE) / pw, (ratio - minV) / ph);
  const w = pw * s, h = ph * s;
  const v = ratio - h;
  const top = v / (1 + BOTTOM_WEIGHT);
  return { ratio, w, h, x: (1 - w) / 2, y: top, bottom: v - top };
}

// ---------- film and slide frames ----------
// Not Instagram shapes: these keep the real thing's proportions. Sizes are millimetres of the
// real thing, scaled to the canvas. Both crop the photo (centred) to their own window.
//
// Film: one frame of 135 slide film, scanned edge to edge: 38 mm of strip (one frame pitch) by its
// 35 mm width, the 36×24 frame in the middle. Kodak Standard perforations: 1.98 mm along the film by
// 2.79 mm across it, 0.51 mm corners, every 4.75 mm, 2.01 mm in from each edge, eight to a frame. On reversal film the rebate is
// black and the edge print, exposed in at the factory, comes out light: dot-matrix lettering along
// one edge, frame numbers and the DX bars along the other.
const FILM = { pitch: 38, across: 35, frameL: 36, frameS: 24, perfL: 1.98, perfS: 2.79, perfR: 0.51, perfStep: 4.75, perfIn: 2.01 };
// Slide mounts: a 50×50 mm square holding one frame of slide film, its window a little inside the
// 36×24 frame (35×23 mm) so the film's edges stay hidden, seen on a light box with the light behind.
// 'slide' is a white plastic mount, which the light partly shines through; 'slidecard' a card one,
// opaque, printed, the picture glowing out of it.
const SLIDE = { size: 50, wl: 35, ws: 23 };
// How far the window's cut edge shows inside the opening (mm). The window and the picture in it are
// square-cornered, as on the white plastic mounts of the reference photo.
const RIM = 0.35;
export const DRAWN_FRAMES = ['film', 'slide', 'slidecard'];

// x, y, w, h: the photo's window, as fractions of the canvas width. ratio: canvas height / width.
// crop: the part of the photo the window shows.
export function frameLayout(style, pw, ph) {
  if (style === 'white' || style === 'dark') {
    const g = mountLayout(pw, ph);
    return { ...g, crop: { x: 0, y: 0, w: pw, h: ph } };
  }
  const cropTo = (aspect) => {
    if (pw / ph > aspect) { const w = ph * aspect; return { x: (pw - w) / 2, y: 0, w, h: ph }; }
    const h = pw / aspect; return { x: 0, y: (ph - h) / 2, w: pw, h };
  };
  if (style === 'slide' || style === 'slidecard') {
    const wide = pw >= ph, u = 1 / SLIDE.size;
    const w = wide ? SLIDE.wl : SLIDE.ws, h = wide ? SLIDE.ws : SLIDE.wl;
    const win = { x: (SLIDE.size - w) / 2 * u, y: (SLIDE.size - h) / 2 * u, w: w * u, h: h * u };
    // The window's cut edge shows as a thin shade round the picture, the same width on all four sides.
    const [t, r, b, l] = [RIM, RIM, RIM, RIM].map((v) => v * u);
    const pic = { x: win.x + l, y: win.y + t, w: win.w - l - r, h: win.h - t - b };
    return { style, wide, mm: u, ratio: 1, ...pic, win, crop: cropTo(pic.w / pic.h) };
  }
  const wide = pw >= ph;
  const W = wide ? FILM.pitch : FILM.across, u = 1 / W;
  const along = (FILM.pitch - FILM.frameL) / 2, across = (FILM.across - FILM.frameS) / 2;
  const win = wide ? { x: along * u, y: across * u, w: FILM.frameL * u, h: FILM.frameS * u }
    : { x: across * u, y: along * u, w: FILM.frameS * u, h: FILM.frameL * u };
  return { style, wide, mm: u, ratio: wide ? FILM.across / FILM.pitch : FILM.pitch / FILM.across, ...win, crop: cropTo(wide ? 1.5 : 2 / 3) };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Fine grain so flat areas do not look drawn: one random tone per cell, laid over with low alpha.
function speckle(ctx, x, y, w, h, cell, alpha, light) {
  const cw = Math.max(1, Math.round(w / cell)), ch = Math.max(1, Math.round(h / cell));
  const t = document.createElement('canvas');
  t.width = cw; t.height = ch;
  const tx = t.getContext('2d'), d = tx.createImageData(cw, ch);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = light ? 255 : 0;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = Math.random() * 255 * alpha;
  }
  tx.putImageData(d, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(t, x, y, w, h);
  ctx.restore();
}

// ----- 5×7 dot-matrix lettering, as the LED arrays that expose film edge print -----
const DOTS = {
  '0': '01110100011001110101110011000101110', '1': '00100011000010000100001000010001110', '2': '01110100010000100010001000100011111',
  '3': '11111000100010000010000011000101110', '4': '00010001100101010010111110001000010', '5': '11111100001111000001000011000101110',
  '6': '00110010001000011110100011000101110', '7': '11111000010001000100010000100001000', '8': '01110100011000101110100011000101110',
  '9': '01110100011000101111000010001001100', 'A': '01110100011000111111100011000110001', 'B': '11110100011000111110100011000111110',
  'C': '01110100011000010000100001000101110', 'D': '11100100101000110001100011001011100', 'E': '11111100001000011110100001000011111',
  'F': '11111100001000011110100001000010000', 'I': '01110001000010000100001000010001110', 'K': '10001100101010011000101001001010001',
  'L': '10000100001000010000100001000011111', 'M': '10001110111010110101100011000110001', 'N': '10001100011100110101100111000110001',
  'O': '01110100011000110001100011000101110', 'P': '11110100011000111110100001000010000', 'R': '11110100011000111110101001001010001',
  'S': '01111100001000001110000010000111110', 'T': '11111001000010000100001000010000100', 'U': '10001100011000110001100011000101110',
  'Y': '10001100011000101010001000010000100', '-': '00000000000000011111000000000000000', '/': '00001000010001000100010001000010000',
  '.': '00000000000000000000000000110001100', '>': '10000110001110011110111001100010000', ' ': '00000000000000000000000000000000000',
};

// Draw text in dots of pitch p (px), starting at x with its vertical middle on y; returns the width.
function dotText(ctx, text, x, y, p, align = 'left') {
  const adv = 6 * p, width = text.length * adv - p;
  let cx = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
  const top = y - 3.5 * p + p / 2;
  const r = p * 0.42;
  for (const ch of text) {
    const g = DOTS[ch] || DOTS[' '];
    for (let i = 0; i < 35; i++) {
      if (g[i] !== '1') continue;
      ctx.beginPath();
      ctx.arc(cx + (i % 5) * p + p / 2, top + Math.floor(i / 5) * p, r, 0, Math.PI * 2);
      ctx.fill();
    }
    cx += adv;
  }
  return width;
}

// Under the photo: the card or the strip. text: { caption, code } (either may be empty).
export function drawFrameUnder(ctx, W, L, text, strength = 0.6) {
  ctx.save();
  if (L.style === 'slide' || L.style === 'slidecard') slideUnder(ctx, W, L, text, strength);
  else filmUnder(ctx, W, L, text, strength);
  ctx.restore();
}

// Over the photo: the light coming through the picture, on a slide mount or the film strip. strength: 0..1.
export function drawFrameOver(ctx, W, L, glow, strength = 0.6) {
  slideOver(ctx, W, L, glow, strength);
}

// Set a DM Mono font of size px with tracking (a fraction of the size); returns the tracking in px.
function setFont(ctx, px, track) {
  ctx.font = `500 ${px}px "DM Mono", Consolas, monospace`;
  const t = px * track;
  if ('letterSpacing' in ctx) { ctx.letterSpacing = `${t}px`; return t; }
  return 0;
}

function slideUnder(ctx, W, L, text, strength = 0.6) {
  const mm = L.mm * W, card = L.style === 'slidecard';
  const x = L.x * W, y = L.y * W, w = L.w * W, h = L.h * W, cx = x + w / 2, cy = y + h / 2;
  if (card) {
    // card stock lit only from behind: what reaches the front is dim and warm, darker to the corners
    ctx.fillStyle = '#b9ab92'; ctx.fillRect(0, 0, W, W);
    const v = ctx.createRadialGradient(cx, cy, mm * 12, cx, cy, mm * 38);
    v.addColorStop(0, 'rgba(255,240,210,0.16)'); v.addColorStop(1, 'rgba(40,28,14,0.28)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, W);
    speckle(ctx, 0, 0, W, W, Math.max(1, mm * 0.05), 0.09, false);
    speckle(ctx, 0, 0, W, W, Math.max(1, mm * 0.05), 0.05, true);
  } else {
    // white plastic, flat: on the reference the mount face is even to within a few levels from the
    // window to its outer edge
    ctx.fillStyle = '#f6f5f2'; ctx.fillRect(0, 0, W, W);
    speckle(ctx, 0, 0, W, W, Math.max(1, mm * 0.04), 0.02, false);
  }
  // the outer edge: no bevel, just the mount's cut edge, a line about 0.4 mm wide a few percent
  // darker than the face (measured: face 211, edge 204–206, then the light box)
  ctx.strokeStyle = card ? 'rgba(60,44,28,0.18)' : 'rgba(110,104,100,0.12)';
  ctx.lineWidth = mm * 0.4;
  ctx.strokeRect(mm * 0.2, mm * 0.2, W - mm * 0.4, W - mm * 0.4);
  // moulded (plastic) or printed (card) numbers, small, in the margin under the window
  const base = y + h + (W - y - h) * 0.55;
  ctx.textBaseline = 'middle';
  const write = (t, px, track, ax, align, col) => {
    const tr = setFont(ctx, px, track);
    ctx.textAlign = align;
    const xx = align === 'right' ? ax + tr : ax;
    if (!card) { ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText(t, xx + px * 0.05, base + px * 0.07); }
    ctx.fillStyle = col; ctx.fillText(t, xx, base);
  };
  const ink = card ? 'rgba(70,54,36,0.75)' : 'rgba(150,146,138,0.8)';
  // aligned to the window's sides when it is wide; an upright window (23 mm) is too narrow for both,
  // so they spread to the mount's own margins instead
  const left = L.wide ? x : mm * 4, right = L.wide ? x + w : W - mm * 4;
  if (text.code) write(text.code, mm * 0.95, 0.1, left, 'left', ink);
  if (text.caption) write(text.caption.toUpperCase().replace(/\s+/g, ' '), mm * 0.95, 0.16, right, 'right', ink);
  // the window's cut edge: not black but a thin soft shade of the mount, about 70% of its brightness,
  // picking up a little of the picture's colour (measured on the reference photo: mount ~228, the
  // line 150–190 at the top, ~116–160 on the right)
  const wn = L.win;
  ctx.fillStyle = card ? 'rgb(124,112,96)' : 'rgb(174,167,170)';
  ctx.fillRect(wn.x * W, wn.y * W, wn.w * W, wn.h * W);
}

// The light box itself (exposure, flare, highlight roll-off) is done in the engine's shader
// (engine.js lightBox), so the screen and the saved file are the same pixels. Here: the glow that
// needs a blur, which a single shader pass cannot do.

// The whole picture, blurred far out: light scattered inside the film and the lens, which tints even
// the dark parts of a backlit picture with its own colour. src: the cropped picture at any size.
export function transmissionScatter(src) {
  const sw = 14, sh = Math.max(1, Math.round(14 * src.height / src.width));
  const a = document.createElement('canvas');
  a.width = sw; a.height = sh;
  const ax = a.getContext('2d');
  ax.imageSmoothingQuality = 'high';
  ax.drawImage(src, 0, 0, sw, sh);
  const c = document.createElement('canvas');
  c.width = 96; c.height = Math.max(1, Math.round(96 * sh / sw));
  const cx = c.getContext('2d');
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(a, 0, 0, c.width, c.height);
  return c;
}

// The highlights of the picture, blurred: what a transparency throws as glow when light comes through.
// src: the cropped picture at any size. Returns a small canvas to draw stretched over the window.
export function transmissionGlow(src) {
  const sw = 96, sh = Math.max(1, Math.round(96 * src.height / src.width));
  const a = document.createElement('canvas');
  a.width = sw; a.height = sh;
  const ax = a.getContext('2d', { willReadFrequently: true });
  ax.drawImage(src, 0, 0, sw, sh);
  const d = ax.getImageData(0, 0, sw, sh), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const l = (0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]) / 255;
    const k = Math.max(0, (l - 0.55) / 0.45) ** 1.5;
    p[i] *= k; p[i + 1] *= k; p[i + 2] *= k; p[i + 3] = 255;
  }
  ax.putImageData(d, 0, 0);
  // blur by going down and back up twice
  const b = document.createElement('canvas');
  b.width = Math.max(1, sw >> 3); b.height = Math.max(1, sh >> 3);
  const bx = b.getContext('2d');
  bx.imageSmoothingQuality = 'high';
  bx.drawImage(a, 0, 0, b.width, b.height);
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  const cx = c.getContext('2d');
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(b, 0, 0, sw, sh);
  cx.globalCompositeOperation = 'screen';
  cx.globalAlpha = 0.6;
  cx.drawImage(a, 0, 0); // keep a little of the sharper core
  return c;
}

// Light through the transparency: the picture's highlights glow and the frame is lifted as a lit
// thing is. Nothing is drawn round the window itself; the mount is just cut.
function slideOver(ctx, W, L, glow, strength) {
  const x = L.x * W, y = L.y * W, w = L.w * W, h = L.h * W;
  if (glow && L.style === 'film') filmBleed(ctx, W, L, glow.glow || glow, strength);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.globalCompositeOperation = 'screen';
  if (glow) {
    // scattered light: the picture's own colour, faint at the default and strong when the box is bright
    if (glow.scatter) { ctx.globalAlpha = Math.min(0.75, 0.05 + 0.7 * strength ** 2.2); ctx.drawImage(glow.scatter, x, y, w, h); }
    ctx.globalAlpha = Math.min(1, 0.4 + 0.9 * strength);
    ctx.drawImage(glow.glow || glow, x, y, w, h);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// On the strip, light from the picture's bright parts spreads into the dark film right next to them
// (halation): a wide blur of the glow, laid only outside the frame, so the rebate beside a bright sky
// lights up and beside a dark corner stays dark.
function filmBleed(ctx, W, L, glow, strength) {
  const x = L.x * W, y = L.y * W, w = L.w * W, h = L.h * W, mm = L.mm * W;
  const spread = mm * 2.4;
  const pad = Math.max(2, Math.round(glow.width * spread / w));
  const c = document.createElement('canvas');
  c.width = glow.width + 2 * pad; c.height = glow.height + 2 * pad;
  const cx = c.getContext('2d');
  cx.drawImage(glow, pad, pad);
  // blur it outward: down to a few pixels and back up, twice
  for (const f of [5, 3]) {
    const t = document.createElement('canvas');
    t.width = Math.max(1, Math.round(c.width / f)); t.height = Math.max(1, Math.round(c.height / f));
    const tx = t.getContext('2d');
    tx.imageSmoothingQuality = 'high';
    tx.drawImage(c, 0, 0, t.width, t.height);
    cx.clearRect(0, 0, c.width, c.height);
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(t, 0, 0, c.width, c.height);
  }
  const k = w / glow.width;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, W * L.ratio);
  ctx.rect(x, y, w, h);
  ctx.clip('evenodd');
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = Math.min(1, 1.6 * strength);
  ctx.drawImage(c, x - pad * k, y - pad * k, c.width * k, c.height * k);
  ctx.restore();
}

function filmUnder(ctx, W, L, text, strength = 0.6) {
  const H = W * L.ratio, mm = L.mm * W;
  // Work along the strip (x) and across it (y); an upright photo's strip runs down the canvas.
  const len = L.wide ? W : H, wid = L.wide ? H : W;
  if (!L.wide) { ctx.translate(W, 0); ctx.rotate(Math.PI / 2); }
  // the base: unexposed slide film with the light box behind it, deep but not paint-black, a warm
  // brown that lets a little more through as the light gets stronger, and a little unevenness
  // measured: a slide strip's base on a light table is about 21% of the table's white (L 51 of 238)
  const base = 0.13 + 0.13 * strength;
  ctx.fillStyle = `rgb(${Math.round(238 * base)},${Math.round(236 * base)},${Math.round(226 * base)})`; ctx.fillRect(0, 0, len, wid);
  // The light box is not even: brightest under the middle of the frame and falling away toward the
  // strip's cut ends and edges, with soft blotches where the diffuser is uneven. All of it follows
  // the light's strength.
  const pool = ctx.createRadialGradient(len / 2, wid / 2, 0, len / 2, wid / 2, len * 0.62);
  pool.addColorStop(0, `rgba(255,205,150,${0.16 * strength})`); pool.addColorStop(0.55, `rgba(255,205,150,${0.06 * strength})`); pool.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = pool; ctx.fillRect(0, 0, len, wid);
  for (const [x0, x1] of [[0, len * 0.16], [len, len * 0.84]]) {
    const fall = ctx.createLinearGradient(x0, 0, x1, 0);
    fall.addColorStop(0, `rgba(0,0,0,${0.18 + 0.14 * strength})`); fall.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fall; ctx.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), wid);
  }
  speckle(ctx, 0, 0, len, wid, Math.max(1, mm * 2.5), 0.05 + 0.06 * strength, true);
  speckle(ctx, 0, 0, len, wid, Math.max(1, mm * 0.06), 0.06, true);
  // perforations: the scanner's light through them, falling off a little at their edges
  const fx = (len - FILM.frameL * mm) / 2;
  const step = FILM.perfStep * mm, pl = FILM.perfL * mm, ps = FILM.perfS * mm, pr = FILM.perfR * mm;
  const first = fx + (FILM.frameL * mm - 8 * step) / 2 + (step - pl) / 2;
  for (let k = -2; k < 11; k++) {
    const x = first + k * step;
    if (x > len || x + pl < 0) continue;
    for (const y of [FILM.perfIn * mm, wid - FILM.perfIn * mm - ps]) {
      ctx.save();
      // the light box seen straight through the hole blooms onto the film round it
      ctx.shadowColor = `rgba(255,250,240,${0.25 + 0.5 * strength})`; ctx.shadowBlur = mm * (0.15 + 0.6 * strength);
      ctx.fillStyle = '#f3efe6';
      roundRect(ctx, x, y, pl, ps, pr); ctx.fill();
      ctx.restore();
      ctx.save();
      roundRect(ctx, x, y, pl, ps, pr); ctx.clip();
      ctx.strokeStyle = 'rgba(120,110,95,0.5)'; ctx.lineWidth = mm * 0.12;
      roundRect(ctx, x, y, pl, ps, pr); ctx.stroke();
      ctx.restore();
    }
  }
  // edge print, light on the black rebate, between the perforations and the film's edge
  const edgeA = FILM.perfIn * mm / 2, edgeB = wid - FILM.perfIn * mm / 2;
  const p = mm * 0.15; // dot pitch: lettering about 1 mm tall
  ctx.fillStyle = 'rgb(214,198,92)'; // measured on the slide strip: (208,197,90)
  ctx.shadowColor = 'rgba(255,170,60,0.45)'; ctx.shadowBlur = p * 1.2;
  if (text.caption) dotText(ctx, text.caption.toUpperCase().replace(/\s+/g, ' '), fx + mm * 1.2, edgeA, p);
  dotText(ctx, '12', fx + mm * 0.6, edgeB, p);
  dotText(ctx, '>12A', fx + FILM.frameL * mm / 2 + mm * 0.6, edgeB, p);
  if (text.code) dotText(ctx, text.code, fx + FILM.frameL * mm - mm * 1.2, edgeA, p * 0.8, 'right');
  // DX bars: a clock track and a data track in the outer strip, under the frame's first half
  ctx.shadowBlur = 0;
  const bx = fx + mm * 3.2, bar = mm * 0.26, rowH = mm * 0.32;
  const data = '1011001110100110110010';
  for (let i = 0; i < data.length; i++) {
    ctx.fillRect(bx + i * bar * 1.6, edgeB - rowH * 1.25, bar, rowH);
    if (data[i] === '1') ctx.fillRect(bx + i * bar * 1.6, edgeB + rowH * 0.25, bar, rowH);
  }
}

// The number printed small at the mount's lower right, run together like the keycode on a film's
// edge: shooting date and time (YYYYMMDDhhmm) then the look as four digits (group, number), so
// 2026112514320804 is 25 Nov 2026 14:32 in the eighth group's fourth look. 0000 when no look is chosen.
export function mountCode(date, lookDigits) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}${p(date.getHours())}${p(date.getMinutes())}${lookDigits}`;
}

// DateTimeOriginal (or DateTime) from a JPEG's EXIF; null when there is none.
export async function readExifDate(blob) {
  try {
    const buf = new DataView(await blob.slice(0, 256 * 1024).arrayBuffer());
    if (buf.getUint16(0) !== 0xffd8) return null;
    let o = 2;
    while (o + 4 < buf.byteLength) {
      const marker = buf.getUint16(o), len = buf.getUint16(o + 2);
      if (marker === 0xffe1 && buf.getUint32(o + 4) === 0x45786966) return parseTiff(buf, o + 10);
      if ((marker & 0xff00) !== 0xff00) return null;
      o += 2 + len;
    }
  } catch {}
  return null;
}

function parseTiff(v, base) {
  const le = v.getUint16(base) === 0x4949;
  const u16 = (p) => v.getUint16(base + p, le), u32 = (p) => v.getUint32(base + p, le);
  const ascii = (p, n) => { let s = ''; for (let i = 0; i < n; i++) { const c = v.getUint8(base + p + i); if (!c) break; s += String.fromCharCode(c); } return s; };
  const find = (ifd, tag) => {
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (u16(e) === tag) return { count: u32(e + 4), value: u32(e + 8) };
    }
    return null;
  };
  const ifd0 = u32(4);
  let s = null;
  const exif = find(ifd0, 0x8769);
  if (exif) { const d = find(exif.value, 0x9003); if (d) s = ascii(d.value, d.count); }
  if (!s) { const d = find(ifd0, 0x0132); if (d) s = ascii(d.value, d.count); }
  const m = s && s.match(/^(\d{4}):(\d{2}):(\d{2})(?: (\d{2}):(\d{2}))?/);
  if (!m || m[1] === '0000') return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
}
