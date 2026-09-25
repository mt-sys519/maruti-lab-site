// HYPER PROP: renderer, input and the handheld's buttons. Physics lives in
// hyperPropSim.js, sound in hyperPropAudio.js. Everything on the monitor is drawn into
// a 256x192 (4:3) canvas: world, HUD and text.
//
// mountHyperProp(root) wires the game into the handheld markup under root and returns
// a function that takes it all down again - the loop, the sound and every listener -
// so leaving the page (or React mounting twice in development) leaves nothing behind.
import * as S from './hyperPropSim.js';
import { createHyperPropAudio } from './hyperPropAudio.js';

export function mountHyperProp(root) {
  const CFG = S.CFG;
  const offs = [];
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); offs.push(() => target.removeEventListener(type, fn, opts)); };
  let raf = 0;
  const W = 256, H = 192, GROUND_SY = 118, HORIZON = 134, HUD_H = 18, CAM_LEAD = 60;
  const $ = (id) => root.querySelector(`[data-hp="${id}"]`);
  // Words for the sub display and the messages come in Japanese and English; the page's
  // JP / EN switch sets data-lang on the stage, and every line is picked when it is shown.
  const en = () => root.dataset.lang === 'en';
  const L = (ja, eng) => (en() ? eng : ja);
  const cv = $('c');
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // one palette for everything on screen
  const C = {
    ink: '#14182a', night: '#232c4d', white: '#ffffff',
    sky: ['#2a4a8c', '#3563a8', '#4a7fc1', '#6a9fd4', '#8fbde2', '#b5d8ec', '#d8ecf2'],
    cloudW: '#ffffff', cloudL: '#e6eef8', cloudS: '#bccbe0', cloudD: '#95a8c6',
    snowW: '#f6f9fc', snowS: '#c9d6ea',
    grass: ['#c2ec72', '#8fcb52', '#62a03c', '#3f7a33'],
    dirt: ['#a5774a', '#7d5634', '#5a3c26'],
    rock: ['#cfc4ad', '#a79b84', '#827663', '#5e5447', '#3b342d'],
    water: ['#d4f0f7', '#a6dcec', '#78c1dd', '#529fc8', '#3c7fae', '#2c608c', '#214a6e'],
    pineL: '#4f8f52', pineD: '#326a3e', pineDD: '#224d30', trunk: '#6a4428',
    red: '#e0442f', redD: '#a82a1c', redL: '#ff8266', yellow: '#ffd35c', yellowL: '#fff0a8', yellowD: '#d19a2a', orange: '#ff8a2a',
    skin: '#f5c79a', skinD: '#d69a6a', hair: '#5a3420', blue: '#3f7fe0', blueD: '#2a56a8', pants: '#3a3f5c', pantsD: '#272a40',
    grey: '#8a90a6', greyL: '#c8cdd8', canopy: '#b8ecf8', canopyD: '#62b2d4',
    wing: '#fbf6e8', wingS: '#ddd2b6', wingD: '#aa9e80', green: '#7fe07a',
  };

  // ---------- pixel helpers ----------
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
  function px(g, col, x, y, w = 1, h = 1) { g.fillStyle = col; g.fillRect(x, y, w, h); }
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function hash(n) { n = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const dith = (x, y, t) => t * 16 > BAYER[(y & 3) * 4 + (x & 3)] + 0.5;
  function ramp(cols, t, x, y) {
    const f = Math.max(0, Math.min(0.9999, t)) * (cols.length - 1), i = Math.floor(f);
    return dith(x, y, f - i) ? cols[i + 1] : cols[i];
  }
  function outline(c, col) {
    const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height), a = d.data, w = c.width, h = c.height;
    const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && a[(y * w + x) * 4 + 3] > 0;
    const pts = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
      if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) pts.push([x, y]);
    g.fillStyle = col; for (const [x, y] of pts) g.fillRect(x, y, 1, 1);
    return c;
  }
  function fromRows(rows, pal) {
    const [c, g] = canvas(rows[0].length + 2, rows.length + 2);
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) px(g, pal[ch], x + 1, y + 1); }));
    return outline(c, C.ink);
  }
  function rot90(src, k) {
    const sw = src.width, sh = src.height, odd = k % 2;
    const [c, g] = canvas(odd ? sh : sw, odd ? sw : sh);
    g.translate(c.width / 2, c.height / 2); g.rotate(k * Math.PI / 2); g.drawImage(src, -sw / 2, -sh / 2);
    return c;
  }

  // ---------- 5x7 pixel font ----------
  const FONT = {
    A: 'ehhvhhh', B: 'uhhuhhu', C: 'ehggghe', D: 'uhhhhhu', E: 'vgguggv', F: 'vgguggg', G: 'ehgnhhf', H: 'hhhvhhh',
    I: 'e44444e', J: '72222ic', K: 'hikokih', L: 'ggggggv', M: 'hrllhhh', N: 'hhpljhh', O: 'ehhhhhe', P: 'uhhuggg',
    Q: 'ehhhlid', R: 'uhhukih', S: 'fgge11u', T: 'v444444', U: 'hhhhhhe', V: 'hhhhha4', W: 'hhhllla', X: 'hha4ahh',
    Y: 'hha4444', Z: 'v1248gv', 0: 'ehjlphe', 1: '4c4444e', 2: 'eh1248v', 3: 'v2421he', 4: '26aiv22', 5: 'vgu11he',
    6: '68guhhe', 7: 'v124888', 8: 'ehhehhe', 9: 'ehhf12c', '!': '4444404', '/': '122488g', '.': '00000cc',
    ':': '0cc0cc0', '-': '000v000', "'": '4480000', ' ': '0000000', '▲': '004ev00', '▼': '00ve400',
  };
  function glyphs(g, str, x, y, s, col) {
    [...str].forEach((ch, i) => {
      const f = FONT[ch]; if (!f) return;
      for (let r = 0; r < 7; r++) {
        const bits = parseInt(f[r], 32);
        g.fillStyle = Array.isArray(col) ? col[r] : col;
        for (let c = 0; c < 5; c++) if (bits & (16 >> c)) g.fillRect(x + (i * 6 + c) * s, y + r * s, s, s);
      }
    });
  }
  const textW = (str, s = 1) => str.length * 6 * s - s;
  // draws with an ink outline so text reads over any background
  function text(str, x, y, col, o = {}) {
    const s = o.s || 1, g = o.g || ctx;
    if (o.align === 'center') x -= Math.floor(textW(str, s) / 2);
    if (o.align === 'right') x -= textW(str, s);
    x = Math.round(x); y = Math.round(y);
    if (o.shadow) glyphs(g, str, x + s, y + s + 1, s, o.shadow);
    if (o.outline !== false) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) glyphs(g, str, x + dx, y + dy, s, C.ink);
    glyphs(g, str, x, y, s, col);
  }
  const GOLD = [C.yellowL, C.yellowL, C.yellow, C.yellow, C.orange, C.orange, C.red];

  // ---------- sprites ----------
  // AOI: navy bob, goggles, olive flight suit with a fleece collar, brown gloves and boots
  const AO = { n: '#1d2468', H: '#34429e', l: '#6379d8', g: '#6b4a2a', G: '#a8e0f2', s: C.skin, S: C.skinD, e: '#1d2468',
    o: '#5f6d3b', O: '#434d2a', q: '#808f52', f: '#f1e4c6', b: '#6b4a2a', B: '#46301c' };
  // the plane: hand-built and a little toy-like. Canvas wing, egg gondola, wooden prop, bicycle wheel, chain drive
  const PC = { canvas: '#f4ead0', canvasS: '#d8c8a2', canvasD: '#b09c74', wood: '#b0743e', woodD: '#724a26', woodL: '#d69a5c',
    tomato: '#e24a35', tomatoD: '#a8301f', tomatoL: '#ff7d62', cream: '#fff6dc', teal: '#2f9a93', tealL: '#62c9bd', mustard: '#eab43a', mustardD: '#b88420' };
  const PIV = { x: 34, y: 14 }, WHEEL_DY = 12, CARRY = { dx: 6, y: 13 };
  // The gondola is a glass egg so AOI can be seen pedalling. Each press turns the crank
  // half a turn and both legs follow it; a sprite is made for CRANK_STEPS positions of
  // the crank. The outline, the wheel and the wing are where they always were, so the
  // plane is the same size and its hit box did not move.
  const CRANK_STEPS = 8;
  function makePlane(prop, pilot, crank) {
    const [c, g] = canvas(66, 28);
    const P = (col, x, y, w = 1, h = 1) => px(g, col, Math.round(x) + 1, Math.round(y) + 1, w, h);
    const ell = (cx, cy, rx, ry, f) => {
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d <= 1) { const col = f(x, y, d); if (col) P(col, x, y); }
      }
    };
    const line = (x0, y0, x1, y1, col, w = 1) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
      for (let i = 0; i <= n; i++) P(col, x0 + (x1 - x0) * i / n - (w - 1) / 2, y0 + (y1 - y0) * i / n - (w - 1) / 2, w, w);
    };
    // tail: wooden boom, a plain triangular fin with a red stripe, red stabiliser
    P(PC.woodL, 5, 11, 20); P(PC.woodD, 5, 12, 20);
    for (let y = 2; y <= 10; y++) { const w = Math.max(1, Math.round((y - 1) * 0.95)); P(y === 7 ? PC.tomato : PC.mustard, 1, y, w, 1); } P(PC.mustardD, 1, 3, 1, 8);
    P(PC.tomato, 0, 12, 10); P(PC.tomatoD, 1, 13, 8);
    // The canvas wing, seen truly from the side like the rest of the plane: its cross-section,
    // thick and round at the front, thinning to a sharp trailing edge. Drawn as a long band
    // it read as seen from above, and nobody could tell it was a wing.
    // Painted red like the wing tips on the label art: in canvas colours it looked odd.
    P(PC.tomatoL, 30, 0, 10);
    P(PC.tomatoL, 26, 1, 4); P(PC.tomato, 30, 1, 12);
    P(PC.tomato, 20, 2, 22);
    P(PC.tomatoD, 14, 3, 27);
    P(PC.tomatoD, 41, 1, 1, 2);
    // bicycle wheel
    P(PC.woodD, 34, 18, 1, 2);
    ell(34, 21, 3.5, 3.5, (x, y, d) => d > 0.5 ? C.ink : (x === 34 || y === 21) ? C.greyL : null);
    P(PC.mustard, 34, 21);
    // two wooden struts hold the wing over the egg
    line(25, 4, 28, 8, PC.woodD); line(37, 4, 36, 7, PC.woodD);
    // the far wall of the egg, seen through the glass
    ell(33, 13, 10.5, 5.8, (x, y, d) => d > 0.7 && y > 15 ? (y > 16 ? PC.tomatoD : PC.tomato) : null);
    // seat and handlebar
    P(PC.mustardD, 28, 14, 4); P(PC.mustard, 28, 13, 3);
    P(PC.woodD, 38, 11, 1, 3); P(PC.woodD, 37, 11, 2, 1);
    // crank, legs: hip over the seat, crank ahead of it and low
    const a = crank / CRANK_STEPS * Math.PI * 2, CX = 37, CY = 15, R = 3, HX = 30, HY = 13;
    const foot = (t) => [CX + Math.cos(t) * R, CY + Math.sin(t) * R];
    if (pilot) {
      // far leg first, in shade, then the near one
      [[a + Math.PI, AO.O, AO.B], [a, AO.o, AO.b]].forEach(([t, col, boot], i) => {
        const [fx, fy] = foot(t), L = 4.8;
        const dx = fx - HX, dy = fy - HY, d = Math.min(Math.hypot(dx, dy), L * 2 - 0.01);
        const k = Math.atan2(dy, dx) - Math.acos(d / (2 * L));
        const kx = HX + Math.cos(k) * L, ky = HY + Math.sin(k) * L;
        line(HX, HY, kx, ky, col, 2); line(kx, ky, fx, fy, col, 2);
        P(boot, fx - 1, fy, 3, 1);
        if (i === 0) { P(C.grey, CX - 1, CY - 1, 3, 3); P(C.greyL, CX, CY); }
      });
      // AOI, sitting low enough that her head clears the wing: navy bob and goggles out of the open top, fleece collar, olive suit, brown glove on the bar
      P(AO.n, 30, 5, 3); P(AO.H, 29, 6, 5); P(AO.l, 30, 6);
      P(AO.n, 29, 7); P(AO.g, 30, 7); P(AO.G, 31, 7, 2); P(AO.g, 33, 7);
      P(AO.n, 29, 8); P(AO.H, 30, 8); P(C.skin, 31, 8, 3);
      P(AO.n, 29, 9); P(C.skinD, 30, 9); P(C.skin, 31, 9, 2);
      P(AO.f, 28, 10, 6);
      P(AO.o, 28, 11, 5, 2); P(AO.q, 29, 11, 2, 1); P(AO.O, 28, 13, 4, 1);
      line(32, 11, 36, 12, AO.o); P(AO.b, 36, 11, 2, 2);
    } else {
      P(C.grey, CX - 1, CY - 1, 3, 3); P(C.greyL, CX, CY);
      for (const t of [a, a + Math.PI]) { const [fx, fy] = foot(t); P(C.ink, fx - 1, fy, 3, 1); }
    }
    // crank arm, and the chain up to the hub running as the crank turns
    const [nx, ny] = foot(a);
    line(CX, CY, nx, ny, C.ink);
    for (let i = 0; i < 10; i++) P((i + crank) % 2 ? C.ink : C.greyL, CX + 1 + i, Math.round(CY - 0.5 - i * 0.3));
    // glass: a faint tint over what is inside, a rim that shades from sky blue to red,
    // a glint, and a thin red belly under the pedals
    g.globalAlpha = 0.3;
    ell(33, 13, 10.5, 5.8, (x, y, d) => y < 17 ? C.canopy : null);
    g.globalAlpha = 1;
    ell(33, 13, 10.5, 5.8, (x, y, d) => d > 0.8 ? (y < 12 ? C.canopyD : y < 16 ? PC.teal : PC.tomato) : null);
    ell(33, 13, 10.5, 5.8, (x, y) => y >= 18 ? PC.tomatoD : null);
    P(C.white, 25, 10); P(C.white, 26, 9); P(C.white, 27, 8);
    // drive: the hub and nose cone
    P(C.grey, 43, 12, 4); P(PC.mustard, 47, 11, 2, 3); P(PC.mustardD, 47, 13, 2); P(PC.cream, 47, 11);
    if (prop === 0) { P(PC.wood, 49, 2, 2, 21); P(PC.woodL, 49, 5, 1, 5); P(PC.woodL, 49, 14, 1, 5); P(PC.tomato, 49, 1, 2, 3); P(PC.tomato, 49, 21, 2, 3); }
    else if (prop === 1) { P(PC.wood, 49, 8, 2, 9); P(PC.tomato, 49, 7, 2, 2); P(PC.tomato, 49, 16, 2, 2); }
    outline(c, C.ink);
    if (prop === 2) {
      g.globalAlpha = 0.35; px(g, PC.cream, 49, 1, 4, 25); px(g, PC.cream, 48, 5, 6, 17);
      g.globalAlpha = 0.6; px(g, PC.tomato, 49, 2, 4, 2); px(g, PC.tomato, 49, 23, 4, 2); g.globalAlpha = 1;
    }
    return c;
  }
  const planeSpr = {};
  for (const pilot of [0, 1]) for (const f of [0, 1, 2]) for (let k = 0; k < CRANK_STEPS; k++) planeSpr[`${pilot}${f}${k}`] = makePlane(f, pilot, k);

  const aoiTop = [
    '..b.......b.', '..o.......o.', '..o.nHHHn.o.', '..onHlHHHHo.', '..ongGGgGGo.', '..onHHHssso.', '..onHHsseso.',
    '..onnHsssSo.', '..onnH.sS.o.', '..offfffffo.', '...oqooooO..', '...oqbooOO..', '...obbbbbO..', '...ooOoOO...'];
  const runF = [
    ['...oo.OO....', '..oo...OO...', '..bb....bb..', '.bbB....bbB.'],
    ['....ooO.....', '....oO......', '....bb......', '....bbB.....'],
    ['...OO.oo....', '..OO...oo...', '..bb....bb..', '.bbB....bbB.'],
    ['....OOo.....', '....Oo......', '....bb......', '....bbB.....'],
  ].map((legs) => fromRows([...aoiTop, ...legs], AO));
  const tuck = fromRows([
    '...nHHHn...', '..nHlHHHH..', '..ngGGgGG..', '..nHHsssse.', '...nHsssS..', '..offfffo..',
    'bqoooooOOb.', '.ooqoooOO..', '..oOOOoo...', '..bbB.bbB..'], AO);
  const tuckR = [0, 1, 2, 3].map((k) => rot90(tuck, k));

  // ---------- backdrop ----------
  const [sky, sg] = canvas(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px(sg, ramp(C.sky, (y - HUD_H + 6) / (HORIZON - HUD_H - 4), x, y), x, y);

  function cloudSpr(w, h, seed) {
    const [c, g] = canvas(w, h); const r = rng(seed);
    const blobs = Array.from({ length: 7 }, () => [5 + r() * (w - 10), h * 0.4 + r() * h * 0.3, 3 + r() * h * 0.42]);
    const inside = (x, y) => y < h * 0.82 && blobs.some(([bx, by, br]) => (x - bx) ** 2 + (y - by) ** 2 < br * br);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      let col = C.cloudL;
      if (!inside(x, y + 1)) col = C.cloudD;
      else if (!inside(x, y + 3)) col = C.cloudS;
      else if (!inside(x - 1, y - 1) || !inside(x - 2, y - 2)) col = C.cloudW;
      px(g, col, x, y);
    }
    return c;
  }
  const clouds = [[10, 26, cloudSpr(52, 18, 1)], [120, 40, cloudSpr(30, 11, 2)], [190, 22, cloudSpr(64, 20, 3)], [330, 46, cloudSpr(36, 13, 4)]];

  // mountains: explicit peaks, lit face on the left of each ridge crease, snow caps on the tall ones
  function mountains(w, h, n, seed, lo, hi, pal, snowFrac) {
    const [c, g] = canvas(w, h); const r = rng(seed);
    const peaks = Array.from({ length: n }, (_, i) => {
      const top = lo + r() * (hi - lo);
      return { id: i + seed * 31, x: (i + r() * 0.8) * (w / n), top, wl: top * (1.0 + r() * 0.7), wr: top * (1.0 + r() * 0.7), skew: (r() - 0.5) * 0.5 };
    }).sort((a, b) => b.top - a.top);
    for (const p of peaks) {
      const apex = h - p.top;
      for (let cx = Math.floor(p.x - p.wl); cx <= p.x + p.wr; cx++) {
        const dx = cx - p.x;
        let hh = dx < 0 ? p.top * (1 + dx / p.wl) : p.top * (1 - dx / p.wr);
        hh += (hash(p.id * 997 + (cx >> 1)) - 0.5) * 3 + Math.sin(cx * 0.31 + p.id) * 1.4;
        hh = Math.round(Math.min(hh, p.top));
        if (hh <= 0) continue;
        const X = ((cx % w) + w) % w;
        const snowAt = p.top * snowFrac * (0.75 + hash(p.id * 13 + Math.floor(cx / 3)) * 0.5);
        for (let y = h - hh; y < h; y++) {
          const alt = h - y, down = y - apex;
          const crease = p.x + Math.round(down * p.skew + Math.sin(down * 0.45 + p.id) * 1.2);
          const lit = cx < crease;
          let col = lit ? pal[0] : pal[2];
          const q = Math.floor(cx + alt * (lit ? 0.75 : -0.75));
          if (hash(Math.floor(q / 2) * 13 + p.id) < 0.14 && (q & 1) && hash(Math.floor(q / 2) * 7 + Math.floor(alt / 6) * 131) < 0.35 && y > h - hh + 2) col = lit ? pal[1] : pal[3];
          const snow = snowFrac && p.top > 30 && down < snowAt;
          if (snow || (snowFrac && p.top > 30 && down < snowAt + 2 && dith(X, y, 0.5))) col = lit ? C.snowW : C.snowS;
          if (alt < 12 && dith(X, y, (12 - alt) / 14)) col = pal[4];
          if (y === h - hh) col = snow || down < 3 ? C.white : lit ? pal[0] : pal[3];
          px(g, col, X, y);
        }
      }
    }
    return c;
  }
  const alps = mountains(512, 112, 9, 3, 40, 94, ['#b9c8de', '#9fb1cc', '#7b8db0', '#65779c', '#b3c8de'], 0.27);
  const range2 = mountains(512, 62, 11, 8, 16, 44, ['#86a0b4', '#7690a6', '#5d7690', '#4d647e', '#9fb7c9'], 0.12);
  const forest = (() => {
    const [c, g] = canvas(512, 30); const r = rng(5);
    const pine = (cx, base, hgt, l, d, dd) => {
      for (let i = 0; i < hgt; i++) {
        const wd = 1 + Math.floor((i % 4) * 0.7 + i * 0.32);
        const y = base - hgt + i, x0 = cx - (wd >> 1);
        for (let k = 0; k < wd; k++) px(g, k === wd - 1 && wd > 2 ? dd : k < wd / 2 ? l : d, ((x0 + k) % 512 + 512) % 512, y);
      }
    };
    for (let x = 0; x < 512; x += 3 + Math.floor(r() * 3)) pine(x, 26, 7 + Math.floor(r() * 8), '#5e8f86', '#4a7672', '#3d6361');
    px(g, '#3d6361', 0, 24, 512, 6);
    for (let x = 0; x < 512; x += 4 + Math.floor(r() * 4)) pine(x, 30, 9 + Math.floor(r() * 12), C.pineL, C.pineD, C.pineDD);
    px(g, C.pineDD, 0, 28, 512, 2);
    return c;
  })();
  // reflection of the far range, turned into water colours and striped
  const refl = (() => {
    const [c, g] = canvas(512, 40);
    const src = alps.getContext('2d').getImageData(0, 0, 512, 112).data;
    for (let y = 0; y < 40; y++) {
      if (y % 2 === 1 && y > 10) continue;
      const sy = 111 - Math.floor(y * 2.2); if (sy < 0) continue;
      for (let x = 0; x < 512; x++) {
        const i = (sy * 512 + x) * 4; if (!src[i + 3]) continue;
        const br = src[i] + src[i + 1] + src[i + 2];
        px(g, br > 690 ? C.water[0] : br > 560 ? C.water[1] : C.water[2], x, y);
      }
    }
    return c;
  })();

  // cliff: grass cap, boulders from a Voronoi pattern, darker face at the edge
  const CLIFF_L = -420, CLIFF_TOP = 3, CLIFF_H = 72;
  const cliff = (() => {
    const w = CFG.edgeX - CLIFF_L + 3, h = CLIFF_TOP + CLIFF_H; const [c, g] = canvas(w, h); const r = rng(9);
    const seeds = [];
    for (let gy = -1; gy < CLIFF_H / 8 + 2; gy++) for (let gx = -1; gx < w / 22 + 2; gx++)
      seeds.push([gx * 22 + (gy % 2) * 11 + r() * 12, gy * 8 + r() * 3]);
    const cell = (x, y) => {
      let d1 = 1e9, d2 = 1e9, best = null;
      for (const s of seeds) {
        if (Math.abs(s[0] - x) > 44 || Math.abs(s[1] - y) > 16) continue;
        const d = Math.hypot((s[0] - x) * 0.42, s[1] - y);
        if (d < d1) { d2 = d1; d1 = d; best = s; } else if (d < d2) d2 = d;
      }
      return [d1, d2, best];
    };
    const faceJag = (y) => Math.floor(Math.abs(Math.sin(y * 0.5) * 2 + Math.sin(y * 0.17) * 2.5));
    for (let y = 0; y < CLIFF_H; y++) {
      const right = w - 3 - (y < 6 ? 0 : faceJag(y));
      for (let x = 0; x <= right; x++) {
        const gd = 5 + (hash(x * 7) < 0.3 ? 1 : 0), drip = hash(x * 3 + 11) < 0.25 ? Math.floor(hash(x) * 4) : 0;
        let col, k;
        if (y < gd) col = y === 0 ? C.grass[0] : y === 1 ? (dith(x, y, 0.4) ? C.grass[0] : C.grass[1]) : y < gd - 1 ? C.grass[2] : C.grass[3];
        else if (y < gd + drip) col = C.grass[3];
        else {
          const [d1, d2, s] = cell(x, y), edge = (d2 - d1) * 1.4;
          if (edge < 0.9) k = hash(x * 7 + y * 131) < 0.7 ? 4 : 3;
          else {
            const up = (y - s[1]) < 0;
            k = edge < 2.2 ? (up ? 0 : 3) : edge < 3.4 && !up ? 2 : 1;
            if (k === 1 && hash(x * 31 + y * 17) < 0.08) k = 2;
          }
          if (y > 34 && k < 4 && dith(x, y, Math.min(1, (y - 34) / 30))) k++;
          if (x > right - 5 && k < 4) k++;
          if (x === right) k = 4;
          col = C.rock[Math.min(4, k)];
          if (y < gd + 7 && k === 0 && hash(x + y * 5) < 0.5) col = C.grass[3];
        }
        px(g, col, x, y + CLIFF_TOP);
      }
    }
    // blades and flowers along the top
    for (let x = 0; x < w - 3; x++) {
      const t = hash(x * 5 + 1);
      if (t < 0.3) px(g, C.grass[1], x, CLIFF_TOP - 1);
      if (t < 0.08) px(g, C.grass[0], x, CLIFF_TOP - 2);
      if (t > 0.97) px(g, hash(x) < 0.5 ? C.white : C.yellow, x, CLIFF_TOP + 1);
    }
    px(g, C.grass[1], w - 3, CLIFF_TOP, 2, 1); px(g, C.grass[2], w - 2, CLIFF_TOP + 1, 1, 2);
    return c;
  })();

  function pineSpr(hgt) {
    const w = Math.round(hgt * 0.55) | 1; const [c, g] = canvas(w + 2, hgt + 2);
    for (let i = 0; i < hgt - 3; i++) {
      const wd = Math.min(w, 1 + Math.floor((i % 5) * 0.9 + i * 0.36)), x0 = ((w - wd) >> 1) + 1;
      for (let k = 0; k < wd; k++) px(g, k === 0 && wd > 3 ? C.pineDD : k < wd * 0.45 ? C.pineL : k === wd - 1 ? C.pineDD : C.pineD, x0 + k, i + 1);
    }
    px(g, C.trunk, (w >> 1) + 1, hgt - 2, 1, 3);
    return outline(c, C.ink);
  }
  const pines = [[-200, pineSpr(30)], [-168, pineSpr(22)], [-120, pineSpr(34)], [-86, pineSpr(20)], [-52, pineSpr(27)], [-18, pineSpr(16)]];
  const bush = fromRows(['..gggg..', '.gGGggg.', 'gGGgggdg', 'ggggggdd'], { g: C.grass[2], G: C.grass[1], d: C.grass[3] });
  const GOAL_X = CFG.edgeX + CFG.successDist;
  // a gull, facing the plane: wings up, wings down
  const gull = [
    fromRows(['gg.........gg', '.gww.....wwg.', '..wwww.wwww..', '...wwwwwww...', '.oowwwwwww...', '....wwwww....'], { g: C.grey, w: C.white, o: C.orange }),
    fromRows(['...wwwwwww...', '.oowwwwwww...', '..wwww.wwww..', '.gww.....wwg.', 'gg.........gg', '.............'], { g: C.grey, w: C.white, o: C.orange }),
  ];
  const boat = fromRows(['...w...', '...ww..', '...www.', '...wwww', '...k...', 'rrrrrrr', '.rrrrr.'], { w: C.white, k: C.ink, r: C.red });

  // ---------- Egypt (stages 4-6) ----------
  // Same layers as the lake - sky, far, middle, near strip, water, the ground the run starts
  // on - drawn for the Nile: pyramids and dunes in the haze, palms along the bank, and a
  // stepped limestone pyramid to run along the top of.
  const EG = {
    sky: ['#2c5b9e', '#3a70b3', '#5289c4', '#78a6d2', '#a9c6d8', '#d9d6bf', '#f1e0b0'],
    water: ['#e0f2e2', '#a9dccd', '#7cc3b4', '#56a49c', '#3f8289', '#2f6776', '#244f62'],
    stone: ['#f1e0b4', '#e2c996', '#cbaa74', '#a8855a', '#7d5f3d'],
    sand: ['#f3dca0', '#e6c683', '#d2ab68', '#b88d50'],
    palm: ['#8fc15a', '#5f9a44', '#3f7334'], trunk: '#8a6038',
  };
  const skyEg = (() => {
    const [c, g] = canvas(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px(g, ramp(EG.sky, (y - HUD_H + 6) / (HORIZON - HUD_H - 4), x, y), x, y);
    // a pale sun low in the sky
    for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) { const d = x * x + y * y; if (d <= 49) px(g, d > 36 ? '#fbf0cc' : '#fff8e4', 196 + x, 44 + y); }
    return c;
  })();
  const cloudsEg = [[40, 30, cloudSpr(40, 8, 7)], [260, 52, cloudSpr(28, 6, 8)]];
  // far: the Giza group and a second group in the haze, over low dunes
  const farEg = (() => {
    const w = 512, h = 112, [c, g] = canvas(w, h);
    for (let x = 0; x < w; x++) {
      const dh = Math.round(10 + Math.sin(x * 0.021) * 5 + Math.sin(x * 0.057 + 1) * 3);
      for (let y = h - dh; y < h; y++) px(g, y === h - dh ? '#efd9a8' : (x + y) % 7 === 0 ? '#d9bf8c' : '#e3cb98', x, y);
    }
    const pyr = (cx, ph) => {
      for (let y = 0; y < ph; y++) {
        const hw = Math.round(y * 1.05), yy = h - 8 - ph + y;
        for (let x = -hw; x <= hw; x++) {
          const lit = x < 0;
          let col = lit ? '#ecd8aa' : '#c9ad7e';
          if (lit && y % 4 === 3) col = '#dcc493';
          if (!lit && y % 4 === 3) col = '#b99d70';
          px(g, col, ((cx + x) % w + w) % w, yy);
        }
      }
    };
    pyr(96, 62); pyr(150, 50); pyr(188, 30); pyr(392, 44); pyr(430, 28);
    return c;
  })();
  // middle: closer dunes, each with a lit side and a shaded side
  const midEg = (() => {
    const w = 512, h = 62, [c, g] = canvas(w, h);
    const top = (x) => 30 + Math.sin(x * 0.03) * 10 + Math.sin(x * 0.011 + 2) * 8 + Math.sin(x * 0.07) * 3;
    for (let x = 0; x < w; x++) {
      const t0 = Math.round(top(x)), lit = top(x + 1) > top(x - 1);
      for (let y = h - t0; y < h; y++) {
        let col = lit ? EG.sand[1] : EG.sand[2];
        if (y === h - t0) col = EG.sand[0];
        if (y > h - 8 && dith(x, y, (y - (h - 8)) / 8)) col = EG.sand[2];
        px(g, col, x, y);
      }
    }
    return c;
  })();
  // near: date palms along the bank, and the green strip of the bank itself
  const nearEg = (() => {
    const [c, g] = canvas(512, 30); const r = rng(21);
    px(g, EG.palm[2], 0, 25, 512, 5); px(g, EG.palm[1], 0, 24, 512, 1);
    for (let x = 0; x < 512; x += 3) if (hash(x) < 0.5) px(g, EG.palm[1], x, 23, 2, 1);
    for (let x = 6; x < 512; x += 14 + Math.floor(r() * 16)) {
      const ht = 11 + Math.floor(r() * 9), lean = r() < 0.5 ? -1 : 1;
      for (let i = 0; i < ht; i++) px(g, i % 3 ? EG.trunk : '#6d4a2a', ((x + Math.round(i * lean * 0.15)) % 512 + 512) % 512, 25 - i);
      const tx = x + Math.round(ht * lean * 0.15), ty = 25 - ht;
      for (const [dx, dy, len] of [[-1, 0, 5], [1, 0, 5], [-1, -1, 3], [1, -1, 3], [0, -1, 2]]) {
        for (let k = 1; k <= len; k++) px(g, k < 3 ? EG.palm[1] : EG.palm[0], ((tx + dx * k) % 512 + 512) % 512, ty + dy * (k < 3 ? 1 : 0) + (k > 2 ? k - 2 : 0));
      }
    }
    return c;
  })();
  const reflEg = (() => {
    const [c, g] = canvas(512, 40);
    const src = farEg.getContext('2d').getImageData(0, 0, 512, 112).data;
    for (let y = 0; y < 40; y++) {
      if (y % 2 === 1 && y > 10) continue;
      const sy = 111 - Math.floor(y * 2.2); if (sy < 0) continue;
      for (let x = 0; x < 512; x++) {
        const i = (sy * 512 + x) * 4; if (!src[i + 3]) continue;
        px(g, src[i] > 225 ? EG.water[0] : EG.water[1], x, y);
      }
    }
    return c;
  })();
  // The pyramid the run is on, and the sand at its foot. Its top is the runway, from a
  // little behind the start to the edge; the back face steps down gently, the front face
  // steeply (so a plane dropping off it stays clear of the stones). Sand runs from under it
  // out to sandTo, then the Nile.
  const SAND_TO = CFG.edgeX + (S.STAGES.find((st) => st && st.sandTo)?.sandTo || 25) / CFG.pxToM;
  const cliffEg = (() => {
    const drop = -CFG.lakeY, w = SAND_TO - CLIFF_L + 2, h = CLIFF_TOP + CLIFF_H; const [c, g] = canvas(w, h);
    const X = (wx) => wx - CLIFF_L;
    const topL = 56;
    // sand: from the pyramid's foot down to the bottom of the picture
    for (let y = drop; y < CLIFF_H; y++) for (let x = 0; x < w; x++) {
      let col = y === drop ? EG.sand[0] : y < drop + 3 ? EG.sand[1] : dith(x, y, Math.min(1, (y - drop) / 30)) ? EG.sand[3] : EG.sand[2];
      if (x > w - 3) col = EG.sand[3];
      px(g, col, x, y + CLIFF_TOP);
    }
    // the pyramid, course by course: 3px tall, the back face 4px a course, the front 2px
    for (let y = 0; y < drop; y++) {
      const course = Math.floor(y / 3);
      const left = topL - (course + 1) * 4, right = CFG.edgeX + course * 2;
      for (let wx = left; wx <= right; wx++) {
        const x = X(wx);
        if (x < 0 || x >= w) continue;
        const face = wx > CFG.edgeX - 2 ? 3 : wx < topL ? 1 : 0;
        let col = EG.stone[face === 3 ? 2 : face === 1 ? 1 : 0];
        if (y % 3 === 2) col = EG.stone[face === 3 ? 3 : 2];
        if ((wx + course * 5) % 9 === 0 && y % 3 !== 2) col = EG.stone[face === 3 ? 3 : 2];
        if (wx === right || wx === left) col = EG.stone[4];
        px(g, col, x, y + CLIFF_TOP);
      }
    }
    // the worn top: a lighter edge where feet have run
    for (let wx = topL; wx < CFG.edgeX; wx++) { px(g, '#fff0c8', X(wx), CLIFF_TOP); if (hash(wx) < 0.2) px(g, EG.stone[2], X(wx), CLIFF_TOP + 1); }
    return c;
  })();
  // a falcon, wings up and down: brown, pale breast, yellow beak
  const falcon = [
    fromRows(['bb.........bb', '.bBb.....bBb.', '..bBBb.bBBb..', '...bbwwwbb...', '.yybbwwwbb...', '....bbbbb....'], { b: '#8a5a32', B: '#5a3a20', w: '#f0dcb0', y: C.yellow }),
    fromRows(['...bbwwwbb...', '.yybbwwwbb...', '..bBBb.bBBb..', '.bBb.....bBb.', 'bb.........bb', '.............'], { b: '#8a5a32', B: '#5a3a20', w: '#f0dcb0', y: C.yellow }),
  ];
  // a felucca: a tall slanted sail on a brown hull
  const felucca = fromRows(['....w..', '...ww..', '..www..', '.wwww..', 'wwwww..', '...k...', 'hhhhhhh', '.hhhhh.'], { w: '#fbf4e2', k: C.ink, h: '#7a4e2a' });
  // a balloon, three colours round the ring
  const balloonSpr = ['#e24a35', '#f4c430', '#3f7fe0', '#2bb3a3', '#f2a0c1'].map((col) => fromRows([
    '.cccc.', 'cWcccc', 'cWcccc', 'cccccc', 'cccccd', '.cccd.', '..dd..', '...s..', '..s...', '...s..'], { c: col, W: '#ffffff', d: '#0003', s: '#6b6259' }));

  // ---------- the city (stages 7-9) ----------
  // Rooftop to rooftop across a city at blue hour. The run is along a tower's roof, and
  // what was the lake is the street far below: come down there and the flight is over.
  // Everything the plane meets rises from under the picture, so nothing stands in water.
  // Drawn the way pixel artists build night skylines: the far towers are nearly sky-
  // coloured silhouettes with varied crowns and a few pinpricks; nearer ones are darker
  // with windows lit a floor at a time, not sprinkled; light comes from the last of the
  // sunset on the left, so each face has a warm rim on that side; and the buildings in
  // play are lighter and outlined, so they stand clear of the backdrop.
  const CT = {
    sky: ['#141633', '#1d1f47', '#2c2a5e', '#4a3a78', '#7c4c86', '#c0607a', '#ec8a6c'],
    far: { body: '#4b3f78', rim: '#6d5890', lit: '#c9ad7a' },
    mid: { body: '#241f48', rim: '#3d3266', lit: '#f6d27a' },
    wall: ['#b7b3d4', '#8f89b4', '#6f6897', '#524b78', '#37315a'],
    rim: '#f3a57c', lit: '#ffe39a', dark: '#2a2548',
    road: ['#2a2646', '#211d3a', '#17142b'], line: '#8c86b0',
    steel: ['#f08a4b', '#d6602e', '#9c3d1c'],
    // kept for code shared with the lake: bursts and markers read the theme's water
    water: ['#c9c3e0', '#8c86b0', '#524b78', '#37315a', '#2a2646', '#211d3a', '#17142b'],
  };
  const skyCity = (() => {
    const [c, g] = canvas(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px(g, ramp(CT.sky, (y - HUD_H + 6) / (HORIZON - HUD_H - 4), x, y), x, y);
    // the first stars, only where the sky has gone dark
    const r = rng(77);
    for (let i = 0; i < 26; i++) { const x = Math.floor(r() * W), y = HUD_H + 2 + Math.floor(r() * 40); px(g, r() < 0.3 ? '#ffffff' : '#9fa6d8', x, y); }
    return c;
  })();
  function streak(w, seed) {
    const [c, g] = canvas(w, 3); const r = rng(seed);
    for (let y = 0; y < 3; y++) { const a = Math.floor(r() * w * 0.3), b = w - Math.floor(r() * w * 0.3); px(g, y < 1 ? '#d77d86' : '#8e5584', a, y, b - a, 1); }
    return c;
  }
  const cloudsCity = [[30, 70, streak(70, 3)], [220, 84, streak(50, 5)]];
  // One tower: a crown chosen from a few kinds (flat, set back, stepped, spire, slanted,
  // rounded), a rim on the left, and windows lit in runs along whole floors.
  function tower(g, x0, base, bw, bh, r, pal, win) {
    const kind = Math.floor(r() * 6), inset = Math.max(2, Math.floor(bw / 4));
    const top = (xx) => {
      if (kind === 1) return xx >= inset && xx < bw - inset ? bh : bh - 6;
      if (kind === 2) return xx >= inset * 1.5 && xx < bw - inset * 1.5 ? bh : xx >= inset / 2 && xx < bw - inset / 2 ? bh - 5 : bh - 10;
      if (kind === 4) return bh - Math.floor((xx / bw) * 6);
      if (kind === 5) { const d = Math.abs(xx - bw / 2) / (bw / 2); return bh - Math.floor(d * d * 5); }
      return bh;
    };
    for (let xx = 0; xx < bw; xx++) {
      const t = top(xx);
      for (let y = base - t; y < base; y++) px(g, xx === 0 || y === base - t ? pal.rim : pal.body, x0 + xx, y);
    }
    if (kind === 3) { const ax = x0 + (bw >> 1); px(g, pal.body, ax, base - bh - 9, 1, 9); px(g, C.red, ax, base - bh - 10); }
    if (!win) return;
    // floors every 3 rows; a floor is lit with some chance, and then a run of it
    for (let fy = base - 3; fy > base - bh + 3; fy -= 3) {
      if (r() > win.floors) { if (r() < win.single) px(g, pal.lit, x0 + 2 + Math.floor(r() * (bw - 4)), fy); continue; }
      const a = 2 + Math.floor(r() * (bw - 6)), len = 2 + Math.floor(r() * (bw - a - 2));
      for (let xx = a; xx < Math.min(bw - 2, a + len); xx += win.step) if (fy > base - top(xx) + 2) px(g, pal.lit, x0 + xx, fy);
    }
  }
  function skyline(w, h, seed, pal, minH, maxH, win) {
    const [c, g] = canvas(w, h); const r = rng(seed);
    for (let x = 0; x < w;) {
      const bw = 9 + Math.floor(r() * 18), bh = minH + Math.floor(r() * (maxH - minH));
      tower(g, x, h, Math.min(bw, w - x), bh, r, pal, win);
      x += bw + (r() < 0.3 ? 1 + Math.floor(r() * 3) : 0);
    }
    return c;
  }
  const farCity = skyline(512, 112, 31, CT.far, 34, 92, { floors: 0.12, single: 0.25, step: 2 });
  const midCity = skyline(512, 62, 47, CT.mid, 18, 56, { floors: 0.3, single: 0.3, step: 1 });
  // near: the low blocks just across the street, dark, with shop signs lit in colour
  const nearCity = (() => {
    const [c, g] = canvas(512, 30); const r = rng(91);
    for (let x = 0; x < 512;) {
      const bw = 14 + Math.floor(r() * 20), bh = 10 + Math.floor(r() * 14);
      for (let xx = 0; xx < bw && x + xx < 512; xx++) for (let y = 30 - bh; y < 30; y++) px(g, xx === 0 || y === 30 - bh ? '#2c2552' : '#16132c', x + xx, y);
      if (r() < 0.7) { const sw = 4 + Math.floor(r() * 6), sx0 = x + 2 + Math.floor(r() * Math.max(1, bw - sw - 4)); px(g, ['#ff5fa2', '#5fe0ff', '#ffd35c', '#9dff7a'][Math.floor(r() * 4)], sx0, 30 - bh + 3, sw, 2); }
      for (let xx = 2; xx < bw - 2; xx += 3) if (r() < 0.5) px(g, '#f6c77a', x + xx, 27, 2, 2);
      x += bw;
    }
    return c;
  })();
  // across the street, at street level: shopfronts glowing between the pillars
  const shopsCity = (() => {
    const [c, g] = canvas(512, 16); const r = rng(13);
    px(g, '#141128', 0, 0, 512, 16);
    for (let x = 0; x < 512; x += 12 + Math.floor(r() * 10)) {
      const w = 6 + Math.floor(r() * 5), lit = r();
      px(g, lit < 0.6 ? '#e8b46a' : lit < 0.8 ? '#6fd4e8' : '#3a3460', x, 6, w, 7);
      if (lit < 0.6) px(g, '#ffe3a8', x + 1, 7, w - 2, 1);
      px(g, '#2c2552', x - 1, 3, w + 2, 2);
    }
    return c;
  })();
  // A building's face in the play: pale walls, the warm rim of the sunset on the left and
  // along the top. The windows are fine - one pixel, a floor every three rows, with the
  // structure's columns between bays - so a building the height of the plane reads as a
  // tower of many floors, not a house the pilot could step over. Lit in runs along floors.
  function facade(g, x0, y0, w, h, seed) {
    const r = rng(seed);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let col = x < 2 ? CT.wall[1] : x >= w - 3 ? CT.wall[3] : CT.wall[2];
      if (x > 2 && x < w - 3 && x % 6 === 2) col = CT.wall[3];
      if (x === 0 || y === 0) col = CT.rim;
      else if (y === 1 || y === 2) col = CT.wall[0];
      px(g, col, x0 + x, y0 + y);
    }
    for (let fy = 4; fy < h - 1; fy += 3) {
      const on = r() < 0.4, a = 3 + Math.floor(r() * Math.max(1, w - 8)), len = 4 + Math.floor(r() * w * 0.7);
      for (let x = 3; x < w - 3; x++) {
        if (x % 6 === 2) continue;
        if (x % 2 === 0) continue;
        px(g, on && x >= a && x < a + len ? CT.lit : CT.dark, x0 + x, y0 + fy);
      }
    }
  }
  // The tower the run is on, reaching down out of the picture, with lower roofs behind.
  const cliffCity = (() => {
    const w = CFG.edgeX - CLIFF_L + 3, h = CLIFF_TOP + CLIFF_H; const [c, g] = canvas(w, h);
    const X = (wx) => wx - CLIFF_L;
    facade(g, X(-420), CLIFF_TOP + 30, 214, CLIFF_H - 30, 7);
    facade(g, X(-206), CLIFF_TOP + 14, 134, CLIFF_H - 14, 19);
    facade(g, X(-70), CLIFF_TOP, CFG.edgeX + 70, CLIFF_H, 3);
    for (let y = 0; y < CLIFF_H; y++) px(g, CT.wall[4], X(CFG.edgeX) - 1, CLIFF_TOP + y);
    // a parapet along the roof's edge, and the lit crown of the lower roofs
    px(g, '#e8e4f6', X(-70), CLIFF_TOP, CFG.edgeX + 70, 1);
    return outline(c, C.ink);
  })();
  // A drone, rotors spinning and its lights blinking. Yellow on the night sky, with red
  // and green lamps, so it reads at a glance against the towers.
  const drone = [
    fromRows(['www.......www', '..k.......k..', '.kkkkkkkkkkk.', '..kYYYYYYYk..', '...kRk.kGk...', '....k...k....'], { w: C.white, k: '#3a3f55', Y: '#ffd35c', R: C.red, G: C.green }),
    fromRows(['.w.........w.', '..k.......k..', '.kkkkkkkkkkk.', '..kYYYYYYYk..', '...kkk.kkk...', '....k...k....'], { w: C.greyL, k: '#3a3f55', Y: '#ffd35c' }),
  ];
  // cars along the street: headlights ahead, tail lights behind
  const carR = fromRows(['..bbbb...', 'rbbbbbbby', '.k....k..'], { b: '#5a5480', r: C.red, y: '#fff2b0', k: '#0e0c1c' });
  const carL = fromRows(['...bbbb..', 'ybbbbbbbr', '..k....k.'], { b: '#6a4a70', r: C.red, y: '#fff2b0', k: '#0e0c1c' });
  const cityCache = new Map();
  function buildingSpr(w, h) {
    const key = `b${w}x${h}`;
    if (!cityCache.has(key)) { const [c, g] = canvas(w + 2, h + 2); facade(g, 1, 1, w, h, w * 7 + h); cityCache.set(key, outline(c, C.ink)); }
    return cityCache.get(key);
  }
  function girderSpr(w) {
    const key = `g${w}`;
    if (!cityCache.has(key)) {
      const [c, g] = canvas(w + 2, 7);
      px(g, CT.steel[2], 1, 1, w, 1); px(g, CT.steel[0], 1, 2, w, 1); px(g, CT.steel[1], 1, 3, w, 2); px(g, CT.steel[2], 1, 5, w, 1);
      for (let x = 3; x < w - 1; x += 4) px(g, CT.steel[2], x, 3, 2, 2);
      cityCache.set(key, outline(c, C.ink));
    }
    return cityCache.get(key);
  }
  // The street where the lake was: the lit shopfronts across it, the road at the surface
  // line with cars going both ways, and the dark pavement on this side.
  function drawStreet(hz) {
    const surf = sy(CFG.lakeY);
    px(ctx, '#1b1734', 0, hz, W, Math.max(0, surf - hz));
    const off = ((-camX * 0.6) % 512 + 512) % 512;
    for (let x = off - 512; x < W; x += 512) ctx.drawImage(shopsCity, Math.round(x), surf - 16);
    px(ctx, CT.road[0], 0, surf, W, 8); px(ctx, CT.line, 0, surf, W, 1);
    for (let wx = Math.floor((camX - 8) / 24) * 24; wx < camX + W + 24; wx += 24) px(ctx, '#c9b36a', sx(wx), surf + 4, 10, 1);
    for (let i = 0; i < 5; i++) {
      const right = i % 2 === 0, sp = 26 + i * 7, span = W + 120;
      const x = Math.round((((i * 157 + (right ? 1 : -1) * time * sp - camX) % span) + span) % span) - 60;
      ctx.drawImage(right ? carR : carL, x, surf + (right ? 1 : 3));
    }
    px(ctx, CT.road[1], 0, surf + 8, W, 2); px(ctx, '#5a5480', 0, surf + 8, W, 1);
    px(ctx, CT.road[2], 0, surf + 10, W, H - surf - 10);
    for (let wx = Math.floor((camX - 40) / 64) * 64; wx < camX + W + 64; wx += 64) {
      const x = sx(wx) + 20; px(ctx, '#2c2552', x, surf + 10, 1, H - surf - 10);
      ctx.globalAlpha = 0.25; px(ctx, '#ffd98a', x - 6, surf + 10, 13, 3); ctx.globalAlpha = 1;
    }
  }
  function drawCityStone() {
    for (const o of s.stone) {
      if (o.kind !== 'building' && o.kind !== 'girder') continue;
      const x0 = sx(o.x), w = Math.round(o.w);
      if (x0 > W + 4 || x0 + w < -4) continue;
      if (o.kind === 'building') {
        // rising from below the picture, past the street, up to its roof
        const top = sy(o.top), img = buildingSpr(w, H - top + 2);
        ctx.drawImage(img, x0 - 1, top - 1);
      } else {
        // the cable runs up out of the picture to a crane nobody needs to see
        const bot = sy(o.bot), img = girderSpr(w), cx = x0 + (w >> 1);
        px(ctx, C.ink, cx - 1, HUD_H, 3, bot - 7 - HUD_H); px(ctx, C.greyL, cx, HUD_H, 1, bot - 7 - HUD_H);
        px(ctx, C.ink, cx - 2, bot - 8, 5, 2);
        ctx.drawImage(img, x0 - 1, bot - 7);
      }
    }
  }

  const THEMES = {
    alps: { sky, clouds, far: alps, mid: range2, near: forest, refl, cliff, water: C.water, props: true, lap: true, bird: gull, boat, goal: [C.rock[2], C.rock[1], C.grass[1], C.grass[0]] },
    city: { sky: skyCity, clouds: cloudsCity, far: farCity, mid: midCity, near: nearCity, cliff: cliffCity, water: CT.water, props: false, street: true, bird: drone, goal: [CT.wall[3], CT.wall[2], CT.wall[1], CT.wall[0]] },
    egypt: { sky: skyEg, clouds: cloudsEg, far: farEg, mid: midEg, near: nearEg, refl: reflEg, cliff: cliffEg, water: EG.water, props: false, bird: falcon, boat: felucca, goal: [EG.stone[2], EG.stone[1], EG.sand[1], EG.sand[0]] },
  };

  // ---------- state ----------
  // Records are kept per stage; stage 1 keeps the keys it had before there were others.
  // A stage opens once the one before it has been cleared, and the title starts on the
  // furthest open stage.
  const LAST = S.STAGES.length - 1;
  const recKey = (name, n) => (n === 1 ? `hyperprop.${name}` : `hyperprop.${name}.${n}`);
  const rec = { best: [], time: [] };
  for (let n = 1; n <= LAST; n++) {
    try {
      rec.best[n] = +localStorage.getItem(recKey('best', n)) || 0;
      rec.time[n] = +localStorage.getItem(recKey('bestTime', n)) || 0;
    } catch { rec.best[n] = 0; rec.time[n] = 0; /* storage is optional */ }
  }
  const opened = () => { let n = 1; while (n < LAST && rec.time[n]) n++; return n; };
  const s = S.create(opened());
  // the crank eases round to crankTo, which moves half a turn with every press once seated
  let crank = 0, crankTo = 0, lastStride = 1;
  let camX = s.x - CAM_LEAD, camY = 0, time = 0, propA = 0, parts = [], wreck = null, overT = 0;
  let banner = null, jpMsg = '', jpT = 0, seen = {};
  const inp = { up: false, down: false };
  let touchMode = matchMedia('(pointer: coarse)').matches;
  let stallBeep = 0, lastMark = 0;
  // TIME is the clock from the first step to the goal; it stops while paused.
  // Until the stage has been cleared once the record is the longest distance,
  // after that it is the fastest clear.
  let ui = 0, runTime = 0, newRecord = false;
  const fmt = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`;
  // Pausing follows the rest of MarutiBit: a hidden page pauses by itself and only an
  // explicit press brings it back. Here that press is START (or tapping the screen),
  // and play restarts after a short count so the fingers can find the pedals again.
  let paused = false, countdown = 0;
  const COUNT_STEP = 0.5;

  // ---------- tutorial ----------
  // Stage 1 is the tutorial. Nothing is explained up front: the game watches, and the
  // moment the player hesitates at a step it stops (or slows) the world, lights the
  // button to press and says what to do, on the monitor and on the sub display. Someone
  // who already knows never sees it happen. Until stage 1 has been cleared once the
  // world waits for them; after that the hints only light the button, and the stage
  // plays as a time attack. A miss always starts again from the top of the hill.
  const tutorialStage = () => s.stage === 1;
  const teach = () => tutorialStage() && !rec.time[1];
  const STAKE = CFG.edgeX - 28;
  // k is how fast the world runs while the hint is up: 0 waits for the press
  const HINTS = {
    run: { keys: 'LR', k: 1, jp: (t) => [L('助走をつけて走る', 'Run to build up speed'), t ? L('人差し指と中指で PEDAL を連打', 'Drum PEDAL: index + middle finger') : L('← → を連打', 'Drum ← →')] },
    soon: { keys: 'up', k: 1, jp: (t) => [L('赤い杭のところで乗り込む', 'Board at the red stake'), t ? L('杭の手前で ▲', '▲ just before the stake') : L('杭の手前で ↑', '↑ just before the stake')] },
    board: { keys: 'up', k: 0, big: 'PUSH ▲', jp: (t) => [L('赤い杭！ ここで乗り込む', 'The red stake! Board now'), t ? L('▲ を押して飛び乗る', 'Press ▲ to jump aboard') : L('↑ を押して飛び乗る', 'Press ↑ to jump aboard')] },
    seated: { keys: 'LR', k: 0, big: 'PEDAL!', jp: (t) => [L('乗り込んだ！ 漕いで加速', 'Aboard! Pedal to speed up'), t ? L('PEDAL を連打して漕ぐ', 'Drum PEDAL to pedal') : L('← → を連打して漕ぐ', 'Drum ← → to pedal')] },
    edge: { keys: 'up', k: 1, jp: (t) => [L('もうすぐ崖の先', 'The edge is coming'), t ? L('▲ で機首を上げて飛ぶ', '▲ to lift the nose and fly') : L('↑ で機首を上げて飛ぶ', '↑ to lift the nose and fly')] },
    low: { keys: 'up', k: 0.35, big: 'NOSE UP ▲', jp: (t) => [L('水面に近づいている', 'Getting close to the water'), t ? L('▲ で機首を上げる', '▲ to lift the nose') : L('↑ で機首を上げる', '↑ to lift the nose')] },
    stall: { keys: 'down', k: 0.35, big: 'NOSE DOWN ▼', jp: (t) => [L('失速！ 機首の上げすぎ', 'Stall! The nose is too high'), t ? L('▼ で機首を下げて速度を戻す', '▼ to drop the nose, regain speed') : L('↓ で機首を下げて速度を戻す', '↓ to drop the nose, regain speed')] },
    pedal: { keys: 'LR', k: 1, big: 'PEDAL!', jp: (t) => [L('プロペラが止まりそう', 'The propeller is slowing'), t ? L('PEDAL を連打し続ける', 'Keep drumming PEDAL') : L('← → を連打し続ける', 'Keep drumming ← →')] },
  };
  const tut = { hint: null, k: 1, seatedWait: false, lastFootT: -1e9, stallT: 0, glow: '' };
  function pickHint(dt) {
    const idle = ui - tut.lastFootT;
    tut.stallT = s.phase === 'fly' && s.stall ? tut.stallT + dt : 0;
    if (s.phase === 'run') {
      if (s.x >= STAKE - 2) return HINTS.board;
      if (s.x >= STAKE - 44) return HINTS.soon;
      return idle > 0.8 ? HINTS.run : null;
    }
    if (s.phase !== 'roll' && s.phase !== 'fly') return null;
    if (tut.seatedWait && idle > 0.3) return HINTS.seated;
    // the waits below let go as soon as the right button is down
    if (tut.stallT > 0.25) return inp.down ? { ...HINTS.stall, k: 1 } : HINTS.stall;
    if (s.phase === 'fly' && s.x > CFG.edgeX && s.y - CFG.lakeY < 10 && s.vy < 0 && !s.stall) return inp.up ? { ...HINTS.low, k: 1 } : HINTS.low;
    if (s.phase === 'roll' && s.x > CFG.edgeX - 16 && !inp.up) return HINTS.edge;
    return idle > 0.7 ? HINTS.pedal : null;
  }
  // returns how fast the world runs this tick
  function tutor(dt) {
    tut.hint = tutorialStage() && playing() ? pickHint(dt) : null;
    const want = teach() && tut.hint ? tut.hint.k : 1;
    tut.k = want < tut.k ? Math.max(want, tut.k - dt * 6) : Math.min(want, tut.k + dt * 4);
    // a slow walker still has to be able to jump on
    if (tut.hint === HINTS.board && teach()) s.vx = Math.max(s.vx, 8);
    return tut.k;
  }
  // After a clear the next stage starts straight away, like the next part of one
  // cartridge; only the last stage goes back to the title.
  function retry() {
    if (s.phase === 'clear' && s.stage < LAST) { s.stage += 1; begin(true); camX = s.x - CAM_LEAD; camY = 0; }
    else if (s.phase === 'clear') toTitle(LAST);
    else begin();
  }

  // ---------- sound ----------
  const SOUND_KEY = 'marutibit:sound-enabled';
  const au = createHyperPropAudio();
  function showSwitch() { $('sound').classList.toggle('on', au.enabled); $('sound').setAttribute('aria-pressed', String(au.enabled)); }
  try { if (localStorage.getItem(SOUND_KEY) === 'true') au.setEnabled(true); } catch { /* storage is optional */ }
  showSwitch();
  au.music('title');
  // click follows a released touch or a mouse press, so it may build the context
  on($('sound'), 'click', () => {
    au.setEnabled(!au.enabled); showSwitch();
    try { localStorage.setItem(SOUND_KEY, au.enabled ? 'true' : 'false'); } catch { /* storage is optional */ }
    if (au.enabled) { au.unlock(); au.play('start'); }
  });
  // the only moments that may start audio: a key, a mouse press, a touch let go
  on(window, 'keydown', () => au.unlock(), true);
  on(window, 'pointerdown', (e) => { if (e.pointerType === 'mouse') au.unlock(); }, true);
  on(window, 'pointerup', (e) => { if (e.pointerType !== 'mouse') au.unlock(); }, true);
  on(window, 'touchend', () => au.unlock(), true);
  // Drumming is hard on fingers and wrists. After 15 minutes of play the next result
  // screen says to rest, once; five minutes away from the page counts as that rest.
  const REST_AFTER = 15 * 60, AWAY_RESETS = 5 * 60 * 1000;
  let playT = 0, awayAt = 0, rest = false;
  const restNow = () => { if (playT < REST_AFTER) return; playT = 0; rest = true; };
  on(document, 'visibilitychange', () => {
    if (document.hidden) { awayAt = performance.now(); pauseGame(); au.sleep(); }
    else { if (awayAt && performance.now() - awayAt > AWAY_RESETS) playT = 0; if (!paused) au.wake(); }
  });
  on(window, 'pagehide', () => { pauseGame(); au.sleep(); });
  on(window, 'pageshow', (e) => { if (e.persisted) au.reset(); });

  function show(big, sub = '', t = 1.4, jp = '') { banner = { big, sub, t }; if (jp) { jpMsg = jp; jpT = t; } }
  function burst(x, y, n, cols, spd, up) {
    for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * spd, vy: Math.random() * spd * (up || 0.5), life: 0.5 + Math.random() * 0.6, col: cols[i % cols.length] });
  }

  // back to the title, on stage n
  function toTitle(n) {
    Object.assign(s, S.create(n)); parts = []; wreck = null; overT = 0; banner = null; jpMsg = ''; paused = false; countdown = 0; rest = false;
    camX = s.x - CAM_LEAD; camY = 0; tut.hint = null; tut.k = 1;
    au.music('title');
  }
  function pickStage(d) {
    const n = Math.max(1, Math.min(opened(), s.stage + d));
    if (n !== s.stage) { toTitle(n); au.play('tick'); }
  }
  // A stage opens with its card - STAGE n dropping in like GOAL!, its name under it,
  // over a short fanfare - when it is entered from the title or from the stage before.
  // A retry after a miss goes straight back to the run.
  const INTRO = 1.8;
  // each world has its own loop: the lake, Egypt, the city
  const stageMusic = () => ({ egypt: 'desert', city: 'city' })[S.STAGES[s.stage].theme] || 'stage';
  let intro = 0;
  function begin(card = false) {
    S.start(s); parts = []; seen = {}; crank = crankTo = 0; wreck = null; overT = 0; banner = null; jpMsg = ''; lastMark = 0; stallBeep = 0;
    runTime = 0; newRecord = false; paused = false; countdown = 0; rest = false;
    tut.seatedWait = false; tut.lastFootT = ui; tut.k = 1;
    intro = card ? INTRO : 0;
    if (card) { au.music(null); au.play('intro'); } else { au.music(stageMusic(), 0); au.play('start'); }
  }

  const playing = () => s.phase === 'run' || s.phase === 'board' || s.phase === 'roll' || s.phase === 'fly';
  function pauseGame() {
    if (!playing()) return;
    // hidden again mid-count: back to waiting, the count starts over on the next press
    paused = true; countdown = 0; inp.up = false; inp.down = false;
    au.sleep(); // the music and the propeller stop with the world
  }
  // called from a press, which is also what lets the sound come back
  function resumeGame() {
    if (!paused || countdown > 0) return;
    countdown = COUNT_STEP * 3;
    au.wake(); au.play('tick');
  }

  function handleEvents() {
    for (const e of s.events) {
      if (e === 'step') { burst(s.x - 2, 0, 2, [C.dirt[0], C.grass[2]], 14, 0.6); }
      if (e === 'pedal') au.play('pedal', s.omega);
      if (e === 'board') au.play('board');
      if (e === 'liftoff') au.play('liftoff');
      if (e === 'seated') {
        show('GO!', '', 0.8, L('乗り込んだ！ 漕げ！', 'Aboard! Pedal!')); au.play('seated'); au.layer(1);
        tut.seatedWait = true;
      }
      if (e === 'climb') { show('TAKE OFF!', '', 1.6, L('離陸！', 'Airborne!')); au.play('takeoff'); au.layer(2); }
      if (e === 'balloon') {
        const b = s.balloons.find((q) => q.popT === s.t) || s.balloons.filter((q) => q.popT >= 0).at(-1);
        au.play('pop'); if (b) burst(b.x, b.y, 12, ['#ffffff', '#e24a35', '#f4c430', '#3f7fe0'], 50, 1);
        const need = S.STAGES[s.stage].need;
        jpMsg = s.got >= need ? L(`風船 ${s.got}個！ あとはゴールへ`, `${s.got} balloons! Now for the goal`) : L(`風船 ${s.got}個 あと${need - s.got}個`, `${s.got} balloons, ${need - s.got} to go`); jpT = 1.2;
      }
      if (e === 'bird') {
        au.play('bird'); jpMsg = theme() === THEMES.city ? L('ドローンとぶつかった！ プロペラが止まる', 'Hit a drone! The propeller stalls') : L('鳥とぶつかった！ プロペラが止まる', 'Bird strike! The propeller stalls'); jpT = 1.2;
        burst(s.x + 8, s.y + 14, 14, [C.white, C.greyL, C.white], 40, 1);
      }
      if (e === 'goal') {
        const n = s.stage;
        au.music(null); au.play('goal'); setBest(CFG.successDist * CFG.pxToM);
        newRecord = !rec.time[n] || runTime < rec.time[n];
        if (newRecord) { rec.time[n] = runTime; try { localStorage.setItem(recKey('bestTime', n), runTime.toFixed(2)); } catch { /* storage is optional */ } }
        banner = null; jpMsg = newRecord ? L(`新記録！ ${fmt(runTime)}`, `New record! ${fmt(runTime)}`) : L(`400m 飛行成功！ ${fmt(runTime)}`, `Flew the 400m! ${fmt(runTime)}`); jpT = 1e9;
        restNow();
      }
      if (e === 'fail' || e === 'land') onFail();
    }
    s.events.length = 0;
  }
  function setBest(d) {
    const n = s.stage;
    if (d > rec.best[n]) { rec.best[n] = d; try { localStorage.setItem(recKey('best', n), String(Math.round(d))); } catch { /* storage is optional */ } }
  }
  function onFail() {
    const r = s.result; setBest(r.dist);
    restNow();
    const d = Math.round(r.dist);
    const st = S.STAGES[s.stage], water = theme() === THEMES.egypt ? L('ナイルに着水', 'Down in the Nile') : theme() === THEMES.city ? L('通りに墜落', 'Down in the street') : L('湖に着水', 'Down in the lake');
    const [big, jp] = {
      edge: ['FELL OFF!', L('乗り込む前に崖の外へ…', 'Over the edge before boarding…')], miss: ['MISSED!', L('乗り込みが間に合わなかった', 'Too late to board')], stop: ['STOPPED', L('止まってしまった', 'Came to a stop')],
      splash: [theme().street ? 'CRASH!' : 'SPLASH!', `${water}… ${d}m`], sand: ['CRASH!', L('砂の上に不時着…', 'Crash-landed on the sand…')], obelisk: ['CRASH!', L(`オベリスクにぶつかった… ${d}m`, `Hit an obelisk… ${d}m`)],
      sphinx: ['CRASH!', L(`スフィンクスにぶつかった… ${d}m`, `Hit the Sphinx… ${d}m`)],
      building: ['CRASH!', L(`ビルにぶつかった… ${d}m`, `Hit a building… ${d}m`)],
      girder: ['CRASH!', L(`吊り荷にぶつかった… ${d}m`, `Hit a hanging girder… ${d}m`)],
      short: ['NOT ENOUGH!', L(`風船が足りない… ${s.got}/${st.need}`, `Not enough balloons… ${s.got}/${st.need}`)],
    }[r.reason];
    show(big, r.reason === 'splash' || r.reason === 'obelisk' || r.reason === 'sphinx' || r.reason === 'building' || r.reason === 'girder' ? `${d}M` : r.reason === 'short' ? `${s.got}/${st.need}` : '', 1e9, jp);
    au.music(null);
    if (r.reason === 'splash' && theme().street) { au.play('crash'); au.play('fail'); }
    else if (r.reason === 'splash') { au.play('splash'); au.play('fail'); }
    else if (r.reason === 'stop' || r.reason === 'short') au.play('fail');
    else au.play('fall');
    if (r.reason === 'edge' || r.reason === 'miss') wreck = { x: s.x, y: s.boardT > 0 ? 6 : 12, vx: s.vx * 0.8, vy: 4, rot: 0, vr: 2.5, splashed: false };
    else if (r.reason === 'splash' && theme().street) { wreck = { x: s.x, y: CFG.lakeY, vx: 0, vy: 0, rot: s.theta, vr: 0, splashed: true, sink: 0, whole: true, sand: true }; burst(s.x + 8, CFG.lakeY, 24, [C.yellow, C.orange, C.white], 50, 1); }
    else if (r.reason === 'splash') { wreck = { x: s.x, y: CFG.lakeY, vx: 0, vy: 0, rot: s.theta, vr: 0, splashed: true, sink: 0, whole: true }; burst(s.x + 8, CFG.lakeY, 30, [C.white, theme().water[0], theme().water[1]], 60, 1.4); }
    else if (r.reason === 'sand') { wreck = { x: s.x, y: CFG.lakeY, vx: 0, vy: 0, rot: s.theta, vr: 0, splashed: true, sink: 0, whole: true, sand: true }; burst(s.x + 8, CFG.lakeY, 24, EG.sand, 40, 0.8); }
    // hitting an obelisk throws the plane back off it; running out at the goal lets it glide down
    else if (r.reason === 'obelisk' || r.reason === 'sphinx' || r.reason === 'building' || r.reason === 'girder') { wreck = { x: s.x, y: s.y, vx: -12, vy: 6, rot: s.theta, vr: -1.5, splashed: false, whole: true }; burst(s.x + 16, s.y + 10, 16, EG.stone, 40, 1); }
    else if (r.reason === 'short') wreck = { x: s.x, y: s.y, vx: s.vx * 0.7, vy: 0, rot: s.theta, vr: -0.6, splashed: false, whole: true };
  }

  // ---------- input ----------
  const over = () => s.phase === 'over' || s.phase === 'clear';
  // the result screen needs time to come in before START moves on
  const CLEAR_WAIT = 2.4;
  const canGo = () => overT > (s.phase === 'clear' ? CLEAR_WAIT : 0.6);
  function pressFoot(side) {
    if (paused || intro > 0) return;
    if (s.phase === 'ready') return begin(true);
    if (s.phase === 'clear') { if (canGo()) retry(); return; }
    tut.lastFootT = ui;
    if (s.phase === 'roll' || s.phase === 'fly') { tut.seatedWait = false; crankTo += Math.PI; }
    S.foot(s);
  }
  function pressUp() {
    if (paused || intro > 0) return;
    if (s.phase === 'ready') return pickStage(1);
    if (over()) { if (canGo()) retry(); return; }
    S.board(s);
  }
  const KEYS = { ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', ArrowUp: 'up', KeyW: 'up', Space: 'up', ArrowDown: 'down', KeyS: 'down' };
  on(window, 'keydown', (e) => {
    const k = KEYS[e.code];
    if (k || e.code === 'Enter' || e.code === 'KeyR') e.preventDefault();
    touchMode = false;
    if (e.code === 'Escape' || e.code === 'KeyP') { if (paused) resumeGame(); else pauseGame(); return; }
    if (paused) { if (e.code === 'Enter') resumeGame(); return; }
    if (e.code === 'KeyR') { begin(); return; }
    if (e.code === 'Enter' || (e.code === 'Space' && s.phase === 'ready')) { if (s.phase === 'ready') begin(true); else if (over() && canGo()) retry(); return; }
    if (e.repeat) { if (k === 'up') inp.up = true; if (k === 'down') inp.down = true; return; }
    if (k === 'L') pressFoot(-1); if (k === 'R') pressFoot(1);
    if (k === 'up') { inp.up = true; pressUp(); }
    if (k === 'down') { inp.down = true; if (s.phase === 'ready') pickStage(-1); }
  });
  on(window, 'keyup', (e) => { const k = KEYS[e.code]; if (k === 'up') inp.up = false; if (k === 'down') inp.down = false; });
  on(window, 'touchstart', () => { touchMode = true; }, { passive: true });
  function press(b) {
    const k = b.dataset.k;
    b.classList.add('on');
    if (k === 'L') pressFoot(-1); if (k === 'R') pressFoot(1);
    if (k === 'up') { inp.up = true; pressUp(); }
    if (k === 'down') { inp.down = true; if (s.phase === 'ready' && !paused) pickStage(-1); }
    if (k === 'start') {
      if (paused) resumeGame();
      else if (playing()) pauseGame();
      else if (s.phase === 'ready') begin(true);
      else if (over() && canGo()) retry();
    }
  }
  function release(b) { const k = b.dataset.k; b.classList.remove('on'); if (k === 'up') inp.up = false; if (k === 'down') inp.down = false; }
  // Fingers are read from touchstart, one touch at a time, with the default action
  // cancelled. On iPhone Safari two fingers down together - which is exactly what
  // drumming the pedals is - start the pinch-zoom recogniser, and the pointer events
  // for those touches get cancelled or never arrive. Cancelling touchstart keeps
  // the page from ever treating the pad as a gesture.
  //
  // Two things guard the count. A finger that is still down is never a new press,
  // even when WebKit lists it among the changed touches as another one lands. And a
  // fingertip that bounces and touches the same pedal twice within 70ms is one press.
  //
  // iOS also drops touchstart outright when it lands in the same instant another
  // finger lifts (a WebKit bug reported since iOS 15.6, Safari and Chrome alike, not on
  // Android) - and drumming two fingers is exactly that, more often the faster it goes.
  // The finger is still listed in e.touches though, so every touch event checks the
  // list: a finger on a pedal that was never seen is a press whose touchstart got lost,
  // and a held finger that has gone from the list is a lift that got lost.
  const held = new Map();
  const known = new Set();
  const lastTap = { L: -Infinity, R: -Infinity };
  const buttonOf = (t) => { const b = t.target instanceof Element ? t.target.closest('[data-k]') : null; return b && root.contains(b) ? b : null; };
  function adopt(t, fresh) {
    known.add(t.identifier);
    const b = buttonOf(t);
    if (b) { held.set(t.identifier, b); fresh.push(b); }
  }
  function sync(e, fresh) {
    const now = new Set();
    for (const t of e.touches) { now.add(t.identifier); if (!known.has(t.identifier)) adopt(t, fresh); }
    for (const id of known) {
      if (now.has(id)) continue;
      known.delete(id);
      const b = held.get(id); if (b) { held.delete(id); release(b); }
    }
  }
  function pressAll(fresh, ts) {
    for (const b of fresh) {
      const k = b.dataset.k;
      if (k === 'L' || k === 'R') {
        if (ts - lastTap[k] < 70) { b.classList.add('on'); continue; }
        lastTap[k] = ts;
      }
      press(b);
    }
  }
  on(root, 'touchstart', (e) => {
    touchMode = true;
    let hit = false;
    const fresh = [];
    for (const t of e.changedTouches) {
      if (buttonOf(t)) hit = true;
      if (!known.has(t.identifier)) adopt(t, fresh);
    }
    sync(e, fresh);
    if (hit) e.preventDefault();
    pressAll(fresh, e.timeStamp);
  }, { passive: false });
  const lift = (e) => {
    let hit = false;
    for (const t of e.changedTouches) {
      known.delete(t.identifier);
      const b = held.get(t.identifier); if (b) { hit = true; held.delete(t.identifier); release(b); }
    }
    const fresh = [];
    sync(e, fresh);
    if ((hit || fresh.length) && e.type === 'touchend' && e.cancelable) e.preventDefault();
    pressAll(fresh, e.timeStamp);
  };
  on(root, 'touchend', lift, { passive: false }); on(root, 'touchcancel', lift);
  on(root, 'touchmove', (e) => { const fresh = []; sync(e, fresh); pressAll(fresh, e.timeStamp); }, { passive: true });
  // The iPhone playtest was fine at the BGM's tempo and broken above it. Drumming, a
  // finger comes back to its own pedal every 0.45s at the music's 4.4 a second and every
  // 0.29s at 7 - inside Safari's double-tap-to-zoom window (~0.3s on one spot), and a
  // tap Safari is still deciding about can reach the page late. So Safari is told, in
  // every way it listens, that nothing here is a double tap: the touchend is cancelled
  // along with the touchstart, dblclick is cancelled, and while this page is up the
  // document is touch-action: manipulation (scrolling and pinch-zoom still work).
  on(root, 'dblclick', (e) => e.preventDefault(), { passive: false });
  const docStyle = document.documentElement.style, prevTouchAction = docStyle.touchAction;
  docStyle.touchAction = 'manipulation';
  // the mouse (and a pen) still come through pointer events
  root.querySelectorAll('[data-k]').forEach((b) => {
    on(b, 'pointerdown', (e) => { if (e.pointerType === 'touch') return; e.preventDefault(); press(b); });
    const off = (e) => { if (e.pointerType !== 'touch') release(b); };
    on(b, 'pointerup', off); on(b, 'pointercancel', off); on(b, 'pointerleave', off);
  });
  on($('wrap'), 'pointerdown', () => {
    if (paused) resumeGame();
    else if (s.phase === 'ready') begin(true);
    else if (over() && canGo()) retry();
  });

  // the monitor fills the top half; snap to whole device pixels when that costs little
  function fit() {
    const bz = $('bezel'), cs = getComputedStyle(bz);
    const w = bz.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = bz.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    let sc = Math.min(w / W, h / H);
    const dpr = devicePixelRatio || 1, dev = sc * dpr;
    if (dev >= 2 && Math.floor(dev) / dev > 0.93) sc = Math.floor(dev) / dpr;
    root.style.setProperty('--s', Math.max(0.5, sc));
    root.dataset.fit = '';
  }
  const ro = new ResizeObserver(fit); ro.observe($('bezel')); fit();

  // ---------- update ----------
  function update(dt) {
    ui += dt;
    if (paused) {
      // the world holds still; only the count back in moves
      if (countdown > 0) {
        const before = Math.ceil(countdown / COUNT_STEP);
        countdown -= dt;
        const after = Math.ceil(countdown / COUNT_STEP);
        if (countdown <= 0) { countdown = 0; paused = false; au.play('start'); }
        else if (after !== before) au.play('tick');
      }
      au.engine({ phase: 'over', omega: 0, V: 0 });
      return;
    }
    // the stage card: the world waits, then the run and its music start together
    if (intro > 0) {
      intro -= dt;
      if (intro <= 0) { intro = 0; tut.lastFootT = ui; au.music(stageMusic(), 0); au.play('start'); }
      au.engine({ phase: 'over', omega: 0, V: 0 });
      return;
    }
    // the tutorial may slow or stop the world; banners, the stall beep and the camera keep real time
    const real = dt;
    dt *= tutor(dt);
    time += dt;
    if (playing()) runTime += dt;
    if (s.phase !== 'ready') { S.step(s, dt, inp); playT += real; }
    handleEvents();
    if (over()) overT += dt;
    if (banner) { banner.t -= real; if (banner.t <= 0) banner = null; }
    jpT -= real; if (jpT <= 0 && !over()) jpMsg = '';
    propA += (s.phase === 'roll' || s.phase === 'fly' ? s.omega : s.phase === 'clear' ? 0.7 : 0) * 50 * dt;
    if (s.phase === 'clear') crankTo += Math.PI * 5 * dt;
    crank += (crankTo - crank) * Math.min(1, dt * 22);
    au.engine({ phase: s.phase, omega: s.omega, V: s.phase === 'over' ? 0 : Math.hypot(s.vx, s.vy) });
    // footsteps land with the running animation (a foot down every 12px), tatta-tatta,
    // however the presses fall
    if (s.phase === 'run') {
      const stride = Math.floor(s.x / 6) % 4;
      if (stride !== lastStride && (stride === 0 || stride === 2) && s.vx > 2) au.play('step', stride === 0 ? -1 : 1);
      lastStride = stride;
    }
    if (s.phase === 'fly' || s.phase === 'roll') {
      if (!seen.bird && s.birds.some((b) => b.hitT < 0 && b.x - s.x < 170 && b.x > s.x)) { seen.bird = true; jpMsg = theme() === THEMES.city ? L('ドローンだ！ 上か下をすり抜けろ', 'Drones! Slip over or under them') : L('鳥だ！ 上か下をすり抜けろ', 'Birds! Slip over or under them'); jpT = 2.2; }
      if (!seen.sink && S.airAt(s, s.x + 120) < -1) { seen.sink = true; jpMsg = L('下降気流！ 手前で高度を稼げ', 'Downdraft! Gain height before it'); jpT = 2.2; }
      if (!seen.balloon && s.balloons.some((b) => b.popT < 0 && b.x - s.x < 170 && b.x > s.x)) { seen.balloon = true; jpMsg = L(`プロペラで風船を割れ（${S.STAGES[s.stage].need}個以上）`, `Pop balloons with the propeller (${S.STAGES[s.stage].need}+)`); jpT = 2.4; }
      if (!seen.obelisk && s.obelisks.some((o) => o.x - s.x < 170 && o.x > s.x)) { seen.obelisk = true; jpMsg = L('オベリスク！ 上を越えろ', 'Obelisk! Fly over it'); jpT = 2.2; }
      if (!seen.building && s.stone.some((o) => o.kind === 'building' && o.x - s.x < 170 && o.x > s.x)) { seen.building = true; jpMsg = L('ビル！ 屋上を越えろ', 'A building! Over the roof'); jpT = 2.2; }
      if (!seen.lift && s.stone.some((o) => o.kind === 'girder' && o.amp && o.x - s.x < 170 && o.x > s.x)) { seen.lift = seen.girder = true; jpMsg = L('吊り荷が上下する！ 上がった隙にくぐれ', 'The girders go up and down - under while it is up'); jpT = 2.6; }
      if (!seen.girder && s.stone.some((o) => o.kind === 'girder' && o.x - s.x < 170 && o.x > s.x)) { seen.girder = true; jpMsg = L('吊り荷！ 当たると落ちる、下をくぐれ', 'A hanging girder! Solid - go under'); jpT = 2.4; }
      if (!seen.sphinx && s.stone.some((o) => o.kind === 'sphinx' && o.x - s.x < 170 && o.x > s.x)) { seen.sphinx = true; jpMsg = L('スフィンクス！ 頭を越えて背中の上を抜けろ', 'The Sphinx! Over its head, along its back'); jpT = 2.4; }
    }
    if (s.phase === 'fly' && s.stall) { stallBeep -= real; if (stallBeep <= 0) { au.play('stall'); stallBeep = 0.32; } } else stallBeep = 0;
    const mark = Math.floor(Math.max(0, s.x - CFG.edgeX) / 200);
    if (mark > lastMark && mark * 200 < CFG.successDist && (s.phase === 'fly' || s.phase === 'roll')) au.play('marker');
    lastMark = Math.max(lastMark, mark);

    if (wreck) {
      if (!wreck.splashed) {
        wreck.vy -= CFG.g * dt; wreck.x += wreck.vx * dt; wreck.y += wreck.vy * dt; wreck.rot += wreck.vr * dt;
        if (wreck.y <= CFG.lakeY) {
          wreck.splashed = true; wreck.y = CFG.lakeY; wreck.sink = 0; au.play('fail');
          if (theme().street) { wreck.sand = true; au.play('crash'); burst(wreck.x, CFG.lakeY, 24, [C.yellow, C.orange, C.white], 50, 1); }
          else { au.play('splash'); burst(wreck.x, CFG.lakeY, 30, [C.white, C.water[0], C.water[1]], 60, 1.4); }
        }
      } else if (!wreck.sand) wreck.sink = Math.min(10, wreck.sink + dt * 2.5);
    }
    if (s.phase === 'fly' && s.x > CFG.edgeX && s.y - CFG.lakeY < 8 && Math.random() < 0.5) burst(s.x - 6, CFG.lakeY, 1, [C.white, C.water[0]], 8, 0.8);
    if (s.phase === 'fly' && s.omega > 0.3 && Math.random() < 0.25) parts.push({ x: s.x - 42, y: s.y + 6 + Math.random() * 8, vx: -24, vy: 0, life: 0.2, col: C.white, noGrav: true });

    for (const p of parts) { if (!p.noGrav) p.vy -= CFG.g * 0.8 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    parts = parts.filter((p) => p.life > 0 && p.y > CFG.lakeY - 2);

    // past the goal the camera stays with the flag and the plane flies on out of the picture
    if (s.phase === 'clear' && overT < 1.4 && Math.random() < 0.7) {
      const cols = [C.yellow, C.red, C.white, C.green, C.blue, C.orange];
      parts.push({ x: GOAL_X + 4 + Math.random() * 14, y: CFG.lakeY + 34, vx: (Math.random() - 0.5) * 50, vy: 25 + Math.random() * 45, life: 1 + Math.random() * 0.8, col: cols[Math.floor(Math.random() * cols.length)] });
    }
    const fx = wreck ? wreck.x : s.phase === 'clear' ? Math.min(s.x, GOAL_X + 30) : s.x, fy = wreck ? Math.max(wreck.y, CFG.lakeY) : s.y;
    camX += (fx - CAM_LEAD - camX) * Math.min(1, real * 6);
    camX = Math.max(-150, camX);
    camY += (Math.max(0, fy - 40) - camY) * Math.min(1, real * 3);
  }

  // ---------- draw ----------
  const sx = (x) => Math.round(x - camX), sy = (y) => Math.round(GROUND_SY - y + camY);
  function tile(img, par, y) {
    const off = ((-camX * par) % img.width + img.width) % img.width;
    for (let x = off - img.width; x < W; x += img.width) ctx.drawImage(img, Math.round(x), Math.round(y));
  }

  const theme = () => THEMES[S.STAGES[s.stage].theme || 'alps'];
  function draw() {
    const T = theme();
    ctx.drawImage(T.sky, 0, 0);
    const hz = HORIZON + Math.round(camY * 0.25);
    for (const [cx, cy, img] of T.clouds) {
      const x = (((cx - camX * 0.04 - time * 1.5) % 420) + 420) % 420 - 70;
      ctx.drawImage(img, Math.round(x), Math.round(cy + camY * 0.08));
    }
    for (let i = 0; i < 3; i++) {
      const bx = ((i * 97 + time * (7 + i * 2) - camX * 0.08) % 330 + 330) % 330 - 40, by = 50 + i * 9 + Math.sin(time * 0.7 + i) * 3;
      const up = Math.floor(time * 5 + i * 2) % 2;
      px(ctx, C.night, Math.round(bx), Math.round(by) + up, 1, 1); px(ctx, C.night, Math.round(bx) + 1, Math.round(by) + 1, 1, 1);
      px(ctx, C.night, Math.round(bx) + 2, Math.round(by), 1, 1); px(ctx, C.night, Math.round(bx) + 3, Math.round(by) + up, 1, 1);
    }
    tile(T.far, 0.05, hz - T.far.height + 2);
    tile(T.mid, 0.1, hz - T.mid.height + 2);
    tile(T.near, 0.22, hz - 30 + 1);
    if (T.street) drawStreet(hz); else drawLake(hz, T);
    drawMarkers(T);
    drawObelisks();
    drawSphinx();
    drawCityStone();
    drawAir();

    // the ground the run starts on (the cliff, or the pyramid) and what stands on it
    ctx.drawImage(T.cliff, sx(CLIFF_L), sy(0) - CLIFF_TOP);
    if (T.props) {
      for (const [x, img] of pines) ctx.drawImage(img, sx(x) - (img.width >> 1), sy(0) - img.height + 2);
      for (let x = -190; x < CFG.edgeX - 30; x += 37) ctx.drawImage(bush, sx(x + (hash(x) * 10 | 0)), sy(0) - 5);
    }
    const st = sx(CFG.edgeX - 28), g0 = sy(0);
    px(ctx, C.ink, st - 1, g0 - 11, 3, 11); px(ctx, C.dirt[0], st, g0 - 10, 1, 10);
    px(ctx, C.red, st + 1, g0 - 10 + Math.round(Math.sin(time * 6)), 3, 2);
    const ws = sx(CFG.edgeX - 7);
    px(ctx, C.ink, ws - 1, g0 - 24, 3, 24); px(ctx, C.greyL, ws, g0 - 23, 1, 23);
    for (let i = 0; i < 4; i++) px(ctx, i % 2 ? C.white : C.red, ws + 1 + i * 3, g0 - 23 + Math.round(Math.sin(time * 5 + i) * i * 0.4) + (i >> 1), 3, 3 - (i >> 1));
    // water laps over the cliff foot
    const surf = sy(CFG.lakeY), ex = Math.max(0, sx(CFG.edgeX) + 1);
    if (ex > 0 && T.lap) {
      ctx.globalAlpha = 0.85; px(ctx, T.water[5], 0, surf + 1, ex, H - surf); ctx.globalAlpha = 1;
      crest(surf, 0, ex);
    }

    drawBirds(T);
    drawBalloons();
    drawPlayer();
    for (const p of parts) px(ctx, p.col, sx(p.x), sy(p.y));
    drawHud();
    if (intro > 0) drawIntro();
  }

  function crest(y, x0, x1, wp = theme().water) {
    const t = Math.floor(time * 8);
    for (let x = x0; x < x1; x++) {
      const k = (x + t + Math.floor(camX)) & 15;
      px(ctx, k < 3 ? C.white : k < 7 ? wp[1] : wp[3], x, y);
    }
  }

  // the dithered water body only changes when the camera moves vertically, so keep it cached
  const [lakeC, lakeG] = canvas(W, H); let lakeKey = '';
  function drawLake(hz, T) {
    const surf = sy(CFG.lakeY), wp = T.water;
    if (lakeKey !== hz + ',' + surf + ',' + s.stage) {
      lakeKey = hz + ',' + surf + ',' + s.stage; lakeG.clearRect(0, 0, W, H);
      for (let y = hz; y < H; y++) for (let x = 0; x < W; x++)
        px(lakeG, y < surf ? ramp([wp[1], wp[2], wp[3]], (y - hz) / Math.max(1, surf - hz), x, y) : ramp([wp[4], wp[5], wp[6]], (y - surf) / 26, x, y), x, y);
    }
    ctx.drawImage(lakeC, 0, 0);
    px(ctx, wp[0], 0, hz, W, 1);
    // reflection, each row nudged by the ripple
    const off = ((-camX * 0.05) % 512 + 512) % 512;
    for (let r = 0; r < 40 && hz + 1 + r < surf; r++) {
      const wob = Math.round(Math.sin(time * 2 + r * 0.9) * (r > 4 ? 1 : 0));
      for (let x = off - 512; x < W; x += 512) ctx.drawImage(T.refl, 0, r, 512, 1, Math.round(x) + wob, hz + 1 + r, 512, 1);
    }
    for (let i = 0; i < 22; i++) {
      const y = hz + 3 + ((i * 37) % Math.max(4, surf - hz - 4));
      if (Math.floor(time * 2 + i * 0.7) % 3 === 0) continue;
      const x = ((i * 97 - camX * (0.2 + (y - hz) / 60)) % W + W) % W;
      px(ctx, i % 3 ? wp[0] : C.white, Math.round(x), y, 2 + (i % 3), 1);
    }
    const bx = ((300 - camX * 0.15 + time * 3) % 520 + 520) % 520 - 60;
    ctx.drawImage(T.boat, Math.round(bx), hz + 1);
    crest(surf, 0, W);
    for (let i = 0; i < 10; i++) {
      const y = surf + 4 + ((i * 7) % Math.max(1, H - surf - 5));
      const x = ((i * 53 - camX - time * 6) % (W + 20) + W + 20) % (W + 20) - 10;
      px(ctx, wp[3], Math.round(x), y, 4 + (i % 4), 1);
    }
  }

  function drawMarkers(T) {
    const [g2, g1, t1, t0] = T.goal;
    const surf = sy(CFG.lakeY);
    for (let d = 200; d <= CFG.successDist; d += 200) {
      const x = sx(CFG.edgeX + d); if (x < -40 || x > W + 40) continue;
      if (d === CFG.successDist) {
        px(ctx, C.ink, x - 17, surf - 5, 34, 6); px(ctx, g2, x - 16, surf - 4, 32, 5); px(ctx, g1, x - 14, surf - 6, 26, 2);
        px(ctx, C.ink, x - 12, surf - 8, 22, 2); px(ctx, t1, x - 11, surf - 8, 20, 2); px(ctx, t0, x - 9, surf - 8, 12, 1);
        px(ctx, C.ink, x - 1, surf - 36, 3, 28); px(ctx, C.greyL, x, surf - 35, 1, 27);
        for (let yy = 0; yy < 10; yy++) for (let xx = 0; xx < 14; xx++) px(ctx, ((xx >> 1) + (yy >> 1)) % 2 ? C.ink : C.white, x + 2 + xx, surf - 35 + yy + Math.round(Math.sin(time * 4 + xx * 0.5)));
        text('GOAL', x - 26, surf - 34, C.yellow);
      } else {
        const bob = Math.round(Math.sin(time * 2 + d) * 0.8);
        px(ctx, C.ink, x - 3, surf - 7 + bob, 7, 7); px(ctx, C.orange, x - 2, surf - 6 + bob, 5, 5); px(ctx, C.white, x - 2, surf - 4 + bob, 5, 1); px(ctx, C.yellowL, x - 2, surf - 6 + bob, 1, 1);
        text(`${d * CFG.pxToM}M`, x, surf - 17 + bob, C.white, { align: 'center' });
      }
    }
  }

  // Sinking air is a dim stretch of sky with dark streaks falling through it, rising air
  // a warm one with yellow streaks climbing. Speed is exaggerated so a glance is enough.
  // Dark and yellow both read over the snow, where white streaks vanished.
  function drawAir() {
    const zones = S.STAGES[s.stage].air;
    if (!zones.length) return;
    const top = HUD_H, bot = sy(CFG.lakeY) - 2, span = Math.max(1, bot - top);
    for (const [a, b, w] of zones) {
      const x0 = CFG.edgeX + a / CFG.pxToM, x1 = CFG.edgeX + b / CFG.pxToM;
      if (sx(x1) < 0 || sx(x0) > W) continue;
      ctx.globalAlpha = 0.12;
      px(ctx, w < 0 ? C.night : C.yellow, sx(x0), top, Math.round(x1 - x0), span);
      const n = Math.round((x1 - x0) / 2.5);
      for (let i = 0; i < n; i++) {
        const wx = x0 + (i + hash(i * 13 + a) * 0.8) * (x1 - x0) / n;
        const k = S.airAt(s, wx) / Math.abs(w);
        const y = top + ((((hash(i * 7 + b) * span - time * w * 9) % span) + span) % span);
        ctx.globalAlpha = 0.7 * Math.abs(k);
        px(ctx, w < 0 ? C.night : C.yellow, sx(wx), Math.round(y), 1, 6);
      }
    }
    ctx.globalAlpha = 1;
  }
  function drawBirds(T) {
    for (const b of s.birds) {
      let x = b.x, y = b.y, f = Math.floor(time * 5 + b.p) % 2;
      if (b.hitT >= 0) {
        const t = s.t - b.hitT;
        if (t > 2) continue;
        x = b.hx + t * 30; y = b.hy + t * 28; f = Math.floor(t * 14) % 2;
      }
      const img = T.bird[f];
      ctx.drawImage(img, sx(x) - (img.width >> 1), sy(y) - (img.height >> 1));
    }
  }
  // balloons hang by their strings; the sprite's middle is the balloon's middle
  function drawBalloons() {
    s.balloons.forEach((b, i) => {
      if (b.popT >= 0) return;
      const img = balloonSpr[i % balloonSpr.length];
      ctx.drawImage(img, sx(b.x) - (img.width >> 1), sy(b.y) - 4);
    });
  }
  // an obelisk on its islet: a tapering shaft, lit on the left, a gilt tip, marks carved down it
  function drawObelisks() {
    const surf = sy(CFG.lakeY);
    for (const o of s.obelisks) {
      const x = sx(o.x), top = sy(o.top);
      if (x < -20 || x > W + 20) continue;
      px(ctx, C.ink, x - 9, surf - 3, 19, 4); px(ctx, EG.sand[1], x - 8, surf - 2, 17, 2); px(ctx, EG.sand[0], x - 6, surf - 3, 13, 1);
      const hgt = surf - 3 - top;
      for (let i = 0; i < hgt; i++) {
        const y = top + i, hw = i < 3 ? i : 2 + (i > hgt * 0.5 ? 1 : 0);
        px(ctx, C.ink, x - hw - 1, y, hw * 2 + 3, 1);
        if (i < 3) px(ctx, i === 0 ? C.yellowL : C.yellow, x - hw, y, hw * 2 + 1, 1);
        else { px(ctx, EG.stone[0], x - hw, y, hw, 1); px(ctx, EG.stone[2], x, y, hw + 1, 1); if (i % 4 === 1) px(ctx, EG.stone[3], x - 1, y, 1, 1); }
      }
    }
  }

  // The Sphinx lies on its islet facing the plane: paws out front, the head in its
  // striped headdress, then the long back and the haunch. Its silhouette stays a pixel
  // inside the solid blocks in the stage (sphinx.blocks), so what you see is what you hit.
  const sphinxSpr = (() => {
    const w = 112, h = 26;
    // height of the silhouette in each column, the plane's left to right
    const top = (x) => x < 1 ? 5 : x < 3 ? 6 : x < 16 ? 7 // forepaws stretched out
      : x < 18 ? 15 : x < 19 ? 20 : x < 21 ? 23 : x < 30 ? 26 : x < 32 ? 25 : x < 34 ? 21 : x < 36 ? 19 // chest, face, headdress
      : x < 45 ? 18 : x < 88 ? 17 : x < 92 ? 16 : x < 96 ? 15 // the back
      : x < 102 ? 13 - (x - 96) : 5; // rump and hind paw
    const [c, g] = canvas(w + 2, h + 2);
    for (let x = 0; x < w; x++) for (let k = 1; k <= top(x); k++) {
      const d = top(x) - k, y = h - k + 1;
      let col = k <= 2 ? EG.stone[3] : k % 3 === 0 ? EG.stone[2] : EG.stone[1]; // weathered courses
      if (d === 0) col = EG.stone[0];
      if (x < 18 && k === 8) col = EG.stone[3]; // forearm against the chest
      // the headdress: bold stripes over the crown and down the flap behind the face
      if ((x >= 20 && x < 34 && k >= 20) || (x >= 27 && x < 34 && k >= 12)) col = k % 2 ? EG.stone[0] : EG.stone[3];
      // the face, lighter, looking left
      if (x >= 17 && x < 23 && k >= 14 && k < 21 && !(x >= 20 && k >= 20)) col = '#f3dcaa';
      // the haunch curving round on the flank
      const r = Math.hypot(x - 97, (k - 3) * 1.4);
      if (x < 101 && k > 2 && Math.abs(r - 11) < 0.7) col = EG.stone[3];
      px(g, col, x + 1, y);
    }
    px(g, C.ink, 19, h - 19, 2, 1); px(g, C.ink, 19, h - 18, 1, 1); // brow and eye
    px(g, EG.stone[3], 18, h - 15, 1, 1); px(g, C.ink, 19, h - 14, 2, 1); // nostril and mouth
    for (const tx of [2, 6, 10]) px(g, EG.stone[3], tx + 1, h - 5, 1, 3); // toes
    px(g, EG.stone[3], 86, h - 2, 8, 1); px(g, EG.stone[3], 93, h - 3, 2, 1); // the tail round the flank
    return outline(c, C.ink);
  })();
  function drawSphinx() {
    const sp = S.STAGES[s.stage].sphinx; if (!sp) return;
    const x = sx(CFG.edgeX + sp.at / CFG.pxToM), surf = sy(CFG.lakeY);
    if (x > W + 10 || x + sphinxSpr.width < -10) return;
    px(ctx, C.ink, x - 4, surf - 3, sphinxSpr.width + 8, 4); px(ctx, EG.sand[1], x - 3, surf - 2, sphinxSpr.width + 6, 2); px(ctx, EG.sand[0], x - 1, surf - 3, sphinxSpr.width + 2, 1);
    ctx.drawImage(sphinxSpr, x - 1, surf - sphinxSpr.height + 1);
  }

  function planeImg(pilot) {
    const f = s.omega > 0.45 || s.phase === 'clear' ? 2 : Math.floor(propA) % 2;
    const k = ((Math.round(crank / (Math.PI * 2) * CRANK_STEPS) % CRANK_STEPS) + CRANK_STEPS) % CRANK_STEPS;
    return planeSpr[`${pilot ? 1 : 0}${f}${k}`];
  }
  function drawPlane(x, y, rot, img) {
    const q = Math.round(rot / (Math.PI / 48)) * (Math.PI / 48);
    ctx.save(); ctx.translate(sx(x), sy(y) - WHEEL_DY); ctx.rotate(-q); ctx.drawImage(img, -PIV.x, -PIV.y); ctx.restore();
  }
  function drawSpr(img, x, y) { ctx.drawImage(img, sx(x) - (img.width >> 1), sy(y) - img.height + 1); }

  function drawPlayer() {
    const ph = s.phase;
    if (wreck) {
      const sink = wreck.splashed ? wreck.sink : 0;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, sy(CFG.lakeY) + 2); ctx.clip();
      if (wreck.whole) drawPlane(wreck.x, wreck.y - sink, wreck.rot * 0.5 + 0.15, planeSpr['110']);
      else { drawPlane(wreck.x + 6, wreck.y - sink, wreck.rot, planeSpr['000']); drawSpr(tuckR[Math.floor(wreck.rot * 2) & 3], wreck.x - 4, wreck.y - sink + 6); }
      ctx.restore();
      return;
    }
    if (ph === 'ready' || ph === 'run') {
      const moving = s.vx > 2, f = moving ? Math.floor(s.x / 6) % 4 : 1;
      const bob = f % 2 ? 1 : 0;
      drawPlane(s.x + CARRY.dx, CARRY.y + bob, 0, planeSpr['000']);
      drawSpr(runF[f], s.x, bob);
      return;
    }
    if (ph === 'board') {
      const t = Math.min(1, s.boardT / CFG.boardTime), e = t * t * (3 - 2 * t);
      drawPlane(s.x + CARRY.dx * (1 - e), (1 - e) * CARRY.y, 0, planeSpr['000']);
      if (t < 0.9) drawSpr(tuckR[Math.floor(e * 4) & 3], s.x - e * 2, Math.sin(t * Math.PI) * 24 + e * 8);
      return;
    }
    drawPlane(s.x, s.y, s.theta, planeImg(true));
  }

  function bar(x, y, v, col) {
    px(ctx, C.greyL, x, y, 42, 7); px(ctx, C.ink, x + 1, y + 1, 40, 5);
    const w = Math.round(Math.max(0, Math.min(1, v)) * 40);
    px(ctx, col, x + 1, y + 1, w, 5); px(ctx, C.white, x + 1, y + 1, w, 1);
  }

  // the stage card, in the same hand as GOAL!: STAGE n drops in, the name comes under it
  function drawIntro() {
    const e = INTRO - intro, k = Math.min(1, e / 0.25);
    text(`STAGE ${s.stage}`, W / 2, 40 - Math.round((1 - k) * 24), GOLD, { s: 3, align: 'center', shadow: C.redD });
    if (e > 0.35) text(S.STAGES[s.stage].name, W / 2, 70, C.white, { align: 'center', shadow: C.night });
  }
  function drawHud() {
    const blink = Math.floor(ui * 2.5) % 2 === 0;
    if (s.phase === 'ready') {
      ctx.globalAlpha = 0.35; px(ctx, C.ink, 0, 0, W, H); ctx.globalAlpha = 1;
      text('HYPER', W / 2, 12, [C.white, C.white, '#d8ecf2', '#d8ecf2', '#b5d8ec', '#b5d8ec', '#8fbde2'], { s: 2, align: 'center', shadow: C.night });
      text('PROP', W / 2, 30, GOLD, { s: 4, align: 'center', shadow: C.redD });
      const many = opened() > 1;
      if (many && s.stage < opened()) text('▲', W / 2, 57, C.white, { align: 'center' });
      text(`STAGE ${s.stage}  ${S.STAGES[s.stage].name}`, W / 2, 67, C.white, { align: 'center' });
      if (many && s.stage > 1) text('▼', W / 2, 77, C.white, { align: 'center' });
      if (teach()) text('- TUTORIAL -', W / 2, 88, C.yellow, { align: 'center' });
      if (blink) text(touchMode ? 'PUSH PEDAL' : 'PRESS ENTER', W / 2, 150, C.yellow, { align: 'center' });
      const bt = rec.time[s.stage];
      text(bt ? `BEST TIME ${fmt(bt)}` : `BEST ${Math.round(rec.best[s.stage])}M`, W / 2, 172, C.greyL, { align: 'center' });
      return;
    }
    px(ctx, C.ink, 0, 0, W, HUD_H); px(ctx, C.night, 0, HUD_H - 1, W, 1);
    const V = s.phase === 'over' ? 0 : Math.hypot(s.vx, s.vy), air = s.phase === 'roll' || s.phase === 'fly' || s.phase === 'clear';
    text('SPEED', 4, 2, C.white, { outline: false }); bar(36, 2, V / 34, C.yellow);
    text('PEDAL', 4, 10, C.white, { outline: false }); bar(36, 10, air ? s.omega : 0, C.green);
    const need = S.STAGES[s.stage].need;
    if (need) {
      const ok = s.got >= need;
      px(ctx, C.red, 96, 10, 5, 5); px(ctx, C.white, 97, 11, 1, 1); px(ctx, C.greyL, 98, 15, 1, 2);
      text(`${s.got}/${need}`, 104, 10, ok ? C.yellow : C.white, { outline: false });
    }
    const dist = Math.round(Math.min(CFG.successDist, Math.max(0, s.x - CFG.edgeX)) * CFG.pxToM);
    const goalTxt = `/${CFG.successDist * CFG.pxToM}M`;
    text(goalTxt, 252, 2, C.greyL, { outline: false, align: 'right' }); text(`${dist}M`, 252 - textW(goalTxt) - 1, 2, C.yellow, { outline: false, align: 'right' });
    text(`TIME ${fmt(runTime)}`, 252, 10, C.white, { outline: false, align: 'right' });
    // progress strip under the HUD
    const prog = Math.max(0, Math.min(1, (s.x - CFG.edgeX) / CFG.successDist));
    px(ctx, C.night, 88, 7, 60, 1); px(ctx, C.yellow, 88, 7, Math.round(prog * 60), 1); px(ctx, C.white, 88 + Math.round(prog * 60) - 1, 5, 3, 3);

    if (banner) {
      text(banner.big, W / 2, 52, GOLD, { s: 2, align: 'center', shadow: C.redD });
      if (banner.sub) text(banner.sub, W / 2, 74, C.white, { align: 'center' });
    } else if (s.phase === 'fly' && s.stall && blink) text('STALL!', W / 2, 52, [C.white, C.redL, C.redL, C.red, C.red, C.redD, C.redD], { s: 2, align: 'center' });
    if (s.phase === 'over' && canGo() && blink) text(touchMode ? 'PUSH START' : 'PRESS ENTER', W / 2, 100, C.yellow, { align: 'center' });
    if (s.phase === 'clear') drawClear(blink);
    drawHint(blink);

    if (paused) {
      ctx.globalAlpha = 0.45; px(ctx, C.ink, 0, HUD_H, W, H - HUD_H); ctx.globalAlpha = 1;
      if (countdown > 0) text(String(Math.ceil(countdown / COUNT_STEP)), W / 2, 76, GOLD, { s: 4, align: 'center', shadow: C.redD });
      else {
        text('PAUSED', W / 2, 70, C.white, { s: 2, align: 'center', shadow: C.night });
        if (blink) text(touchMode ? 'PUSH START' : 'PRESS ENTER', W / 2, 100, C.yellow, { align: 'center' });
      }
    }
  }

  // The result screen: GOAL! drops in over the flag, then a panel comes down with the
  // time, the best time and what comes next. START only works once it has settled.
  function drawClear(blink) {
    const t = overT, n = s.stage, last = n === LAST;
    if (t < 1.4) {
      const k = Math.min(1, t / 0.25);
      text('GOAL!', W / 2, 40 - Math.round((1 - k) * 24), GOLD, { s: 3, align: 'center', shadow: C.redD });
      return;
    }
    const k = Math.min(1, (t - 1.4) / 0.35), e = 1 - (1 - k) ** 3;
    const pw = 184, ph = 100, x0 = (W - pw) >> 1, y0 = Math.round(30 - (1 - e) * 140);
    ctx.globalAlpha = 0.9; px(ctx, C.ink, x0, y0, pw, ph); ctx.globalAlpha = 1;
    px(ctx, C.yellow, x0, y0, pw, 1); px(ctx, C.yellow, x0, y0 + ph - 1, pw, 1); px(ctx, C.yellow, x0, y0, 1, ph); px(ctx, C.yellow, x0 + pw - 1, y0, 1, ph);
    px(ctx, C.night, x0 + 2, y0 + 2, pw - 4, 1); px(ctx, C.night, x0 + 2, y0 + ph - 3, pw - 4, 1);
    text(last ? 'ALL CLEAR!' : `STAGE ${n} CLEAR!`, W / 2, y0 + 9, GOLD, { s: 2, align: 'center', shadow: C.redD });
    text('TIME', x0 + 24, y0 + 34, C.greyL); text(fmt(runTime), x0 + pw - 24, y0 + 34, C.white, { align: 'right' });
    text('BEST', x0 + 24, y0 + 46, C.greyL); text(fmt(rec.time[n]), x0 + pw - 24, y0 + 46, C.white, { align: 'right' });
    if (newRecord && (blink || t < 2.2)) text('NEW RECORD!', W / 2, y0 + 60, C.yellow, { align: 'center' });
    px(ctx, C.night, x0 + 16, y0 + 72, pw - 32, 1);
    text(last ? 'THANK YOU FOR FLYING!' : `NEXT  STAGE ${n + 1}`, W / 2, y0 + 80, C.white, { align: 'center' });
    if (t > CLEAR_WAIT && blink) text(touchMode ? 'PUSH START' : 'PRESS ENTER', W / 2, y0 + ph + 10, C.yellow, { align: 'center' });
  }

  // The hint's words sit where the banner would, and a bouncing arrow at the foot of
  // the monitor points down at the button it wants - the rocker is under the left of
  // the screen, the pedals under the right.
  function drawHint(blink) {
    const h = tut.hint;
    if (!h || paused) return;
    if (h.big && !banner && (blink || tut.k < 1)) text(h.big, W / 2, 30, GOLD, { s: 2, align: 'center', shadow: C.redD });
    if (!touchMode) return;
    const ax = Math.round(W * (h.keys === 'LR' ? 0.69 : 0.19)), ay = H - 12 + (Math.floor(ui * 6) % 2);
    px(ctx, C.ink, ax - 2, ay - 6, 5, 6);
    for (let r = 0; r < 5; r++) px(ctx, C.ink, ax - 5 + r, ay - 1 + r, 11 - r * 2, 2);
    px(ctx, C.yellow, ax - 1, ay - 5, 3, 5);
    for (let r = 0; r < 4; r++) px(ctx, C.yellow, ax - 4 + r, ay + r, 9 - r * 2, 1);
  }
  // the button a tutorial hint is waiting for lights up; nothing else ever glows
  function updateGlow() {
    const want = tut.hint && !paused ? tut.hint.keys : '';
    if (want === tut.glow) return;
    tut.glow = want;
    root.querySelectorAll('[data-k]').forEach((b) => {
      const k = b.dataset.k;
      b.classList.toggle('hint', want === 'LR' ? k === 'L' || k === 'R' : k === want);
    });
  }

  // The sub display is two fixed lines and never grows: the upper line says what is
  // happening, the lower one what to press. Every text here fits one line on a phone.
  const plateLines = [$('l1'), $('l2')];
  function updatePlate() {
    const t = touchMode;
    const pedalTo = (ja, eng) => (t ? L(`PEDAL を叩いて${ja}`, `Drum PEDAL to ${eng}`) : L(`← → を押して${ja}`, `Press ← → to ${eng}`));
    const [what, press] = {
      // people reached for the pedals with a thumb: the title says which fingers
      ready: [t ? L('人差し指と中指で PEDAL を連打', 'Drum PEDAL: index + middle finger') : L('Enter / Space でスタート', 'Enter / Space to start'),
        opened() > 1 ? (t ? L('▲ ▼ で面をえらぶ', '▲ ▼ to choose a stage') : L('↑ ↓ で面をえらぶ', '↑ ↓ to choose a stage')) : au.enabled ? '' : L('音は本体の上の SOUND を ON に', 'Sound: switch SOUND on, at the top')],
      run: [pedalTo('走る', 'run'), t ? L('赤い杭のあたりで ▲ で乗り込む', '▲ at the red stake to board') : L('赤い杭のあたりで ↑ で乗り込む', '↑ at the red stake to board')],
      board: ['', ''],
      roll: [pedalTo('漕ぐ', 'pedal'), t ? L('▲ で機首上げ', '▲ to lift the nose') : L('↑ で機首上げ', '↑ to lift the nose')],
      fly: s.stall ? [L('失速！', 'Stall!'), t ? L('▼ で機首を下げて速度を戻す', '▼ to drop the nose, regain speed') : L('↓ で機首を下げて速度を戻す', '↓ to drop the nose, regain speed')] : [pedalTo('漕ぐ', 'pedal'), t ? L('▲ ▼ で機首', '▲ ▼ to pitch') : L('↑ ↓ で機首', '↑ ↓ to pitch')],
      over: ['', t ? L('START でもう一度', 'START to try again') : L('Enter / R でもう一度', 'Enter / R to try again')],
      clear: ['', !canGo() ? '' : s.stage < LAST ? (t ? L('PEDAL か START で次の面へ', 'PEDAL or START: next stage') : L('Enter で次の面へ / R でもう一度', 'Enter: next stage / R: retry')) : (t ? L('START でタイトルへ', 'START: back to the title') : L('Enter でタイトルへ / R でもう一度', 'Enter: title / R: retry'))],
    }[s.phase] || ['', ''];
    const lines = intro > 0 ? [`STAGE ${s.stage}  ${S.STAGES[s.stage].name}`, t ? L('PEDAL に指を置いて', 'Fingers on PEDAL') : L('← → に指を置いて', 'Fingers on ← →')]
      : paused
      ? (countdown > 0 ? [L('もうすぐ再開', 'Resuming…'), t ? L('PEDAL に指を置いて', 'Fingers on PEDAL') : L('← → に指を置いて', 'Fingers on ← →')] : [L('一時停止中', 'Paused'), t ? L('START で続ける', 'START to continue') : L('Enter / Esc で続ける', 'Enter / Esc to continue')])
      : tut.hint ? tut.hint.jp(t)
      : [rest && over() ? L('15分たったよ。指と手首をひと休み', '15 minutes in. Rest your fingers and wrists') : jpMsg || what, press];
    lines.forEach((txt, i) => { if (plateLines[i].textContent !== txt) plateLines[i].textContent = txt; });
  }

  // ---------- loop ----------
  let last = performance.now(), acc = 0;
  const STEP = 1 / 120;
  function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000); last = now;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
    draw();
    updatePlate();
    updateGlow();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return () => {
    docStyle.touchAction = prevTouchAction;
    cancelAnimationFrame(raf);
    ro.disconnect();
    offs.forEach((off) => off());
    au.dispose();
  };
}
