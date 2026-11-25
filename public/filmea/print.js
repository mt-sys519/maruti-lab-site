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

// ---------- film and instant frames ----------
// Not Instagram shapes: these keep the real thing's proportions. Sizes are millimetres of the
// real thing, scaled to the canvas. Both crop the photo (centred) to their own window.
//
// Film: one frame of 135 slide film, scanned edge to edge: 38 mm of strip (one frame pitch) by its
// 35 mm width, the 36×24 frame in the middle. Kodak Standard perforations: 1.98 mm along the film by
// 2.79 mm across it, 0.51 mm corners, every 4.75 mm, 2.01 mm in from each edge, eight to a frame. On reversal film the rebate is
// black and the edge print, exposed in at the factory, comes out light: dot-matrix lettering along
// one edge, frame numbers and the DX bars along the other.
const FILM = { pitch: 38, across: 35, frameL: 36, frameS: 24, perfL: 1.98, perfS: 2.79, perfR: 0.51, perfStep: 4.75, perfIn: 2.01 };
// Instant: instax cards, all 86 mm on the long side, picture 6.5 mm from the top edge and the
// thick margin below. Upright photos get mini, wide ones WIDE, near-square ones SQUARE.
const INSTAX = {
  mini: { w: 54, h: 86, iw: 46, ih: 62 },
  square: { w: 72, h: 86, iw: 62, ih: 62 },
  wide: { w: 108, h: 86, iw: 99, ih: 62 },
};
// The card's corners are left square: a JPEG has no transparency, and SNS turn transparent corners
// black or white anyway.
const INSTAX_TOP = 6.5;

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
  if (style === 'instant') {
    const a = pw / ph;
    const kind = a < 0.9 ? 'mini' : a > 1.15 ? 'wide' : 'square';
    const f = INSTAX[kind], u = 1 / f.w;
    return { style, kind, mm: u, ratio: f.h / f.w, x: (f.w - f.iw) / 2 * u, y: INSTAX_TOP * u, w: f.iw * u, h: f.ih * u, crop: cropTo(f.iw / f.ih) };
  }
  const wide = pw >= ph;
  const W = wide ? FILM.pitch : FILM.across, u = 1 / W;
  const along = (FILM.pitch - FILM.frameL) / 2, across = (FILM.across - FILM.frameS) / 2;
  const win = wide ? { x: along * u, y: across * u, w: FILM.frameL * u, h: FILM.frameS * u }
    : { x: across * u, y: along * u, w: FILM.frameS * u, h: FILM.frameL * u };
  return { style, wide, mm: u, ratio: wide ? FILM.across / FILM.pitch : FILM.pitch / FILM.across, ...win, crop: cropTo(wide ? 1.5 : 2 / 3) };
}

// Rounded corners of the photo's window, in canvas px: the instax mask's are just softened; a film
// frame's are square.
export function windowRadius(L, W) {
  return L.style === 'instant' ? 0.25 * L.mm * W : 0;
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
export function drawFrameUnder(ctx, W, L, text) {
  ctx.save();
  if (L.style === 'instant') instaxUnder(ctx, W, L, text);
  else filmUnder(ctx, W, L, text);
  ctx.restore();
}

// Over the photo: the soft edge where the instax card's mask meets the picture. Film is flat.
export function drawFrameOver(ctx, W, L) {
  if (L.style !== 'instant') return;
  const x = L.x * W, y = L.y * W, w = L.w * W, h = L.h * W, mm = L.mm * W;
  ctx.save();
  roundRect(ctx, x, y, w, h, windowRadius(L, W));
  ctx.clip();
  const edge = mm * 0.5, dark = 'rgba(40,32,24,0.22)';
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [
    [x, 0, x + edge, 0, x, y, edge, h], [x + w, 0, x + w - edge, 0, x + w - edge, y, edge, h],
    [0, y, 0, y + edge, x, y, w, edge], [0, y + h, 0, y + h - edge, x, y + h - edge, w, edge],
  ]) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, dark); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(rx, ry, rw, rh);
  }
  ctx.restore();
}

function instaxUnder(ctx, W, L, text) {
  const H = W * L.ratio, mm = L.mm * W;
  // the card: a faintly warm white that is a shade darker toward the bottom
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#f6f4ef'); g.addColorStop(1, '#efece5');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  speckle(ctx, 0, 0, W, H, Math.max(1, mm * 0.08), 0.05, false);
  // the mask's edge sits a hair above the picture and catches the light
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(1, mm * 0.12);
  roundRect(ctx, L.x * W - mm * 0.1, L.y * W - mm * 0.1, L.w * W + mm * 0.2, L.h * W + mm * 0.2, windowRadius(L, W) + mm * 0.1);
  ctx.stroke();
  // the look and the number, centred in the thick margin under the picture
  const below = (L.y + L.h) * W, band = H - below;
  const both = text.caption && text.code;
  if (text.caption) {
    ctx.fillStyle = '#7d776d';
    dotText(ctx, text.caption.toUpperCase().replace(/\s+/g, ' '), W / 2, below + band * (both ? 0.42 : 0.5), mm * 0.2, 'center');
  }
  if (text.code) {
    ctx.fillStyle = '#c98a2a';
    dotText(ctx, text.code, W / 2, below + band * (both ? 0.62 : 0.5), mm * 0.15, 'center');
  }
}

function filmUnder(ctx, W, L, text) {
  const H = W * L.ratio, mm = L.mm * W;
  // Work along the strip (x) and across it (y); an upright photo's strip runs down the canvas.
  const len = L.wide ? W : H, wid = L.wide ? H : W;
  if (!L.wide) { ctx.translate(W, 0); ctx.rotate(Math.PI / 2); }
  // the base: unexposed slide film scanned with light behind it, deep but not paint-black, with a
  // warm cast and a little unevenness
  ctx.fillStyle = '#1c1713'; ctx.fillRect(0, 0, len, wid);
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
      ctx.shadowColor = 'rgba(255,250,240,0.35)'; ctx.shadowBlur = mm * 0.25;
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
  ctx.fillStyle = 'rgba(244,196,92,0.92)';
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
