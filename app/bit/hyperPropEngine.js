// HYPER PROP stage 1: renderer, input and the handheld's buttons. Physics lives in
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
    ':': '0cc0cc0', '-': '000v000', "'": '4480000', ' ': '0000000',
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
  function makePlane(prop, pilot, bob, chain) {
    const [c, g] = canvas(66, 28);
    const P = (col, x, y, w = 1, h = 1) => px(g, col, x + 1, y + 1, w, h);
    const ell = (cx, cy, rx, ry, f) => {
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d <= 1) { const col = f(x, y, d); if (col) P(col, x, y); }
      }
    };
    // tail: wooden boom, a plain triangular fin with a red stripe, red stabiliser
    P(PC.woodL, 5, 11, 20); P(PC.woodD, 5, 12, 20);
    for (let y = 2; y <= 10; y++) { const w = Math.max(1, Math.round((y - 1) * 0.95)); P(y === 7 ? PC.tomato : PC.mustard, 1, y, w, 1); } P(PC.mustardD, 1, 3, 1, 8);
    P(PC.tomato, 0, 12, 10); P(PC.tomatoD, 1, 13, 8);
    // canvas wing with ribs and red tips turned up a little. Its front end stops short of
    // the propeller: drawn running past it, the blade looked like it went through the wing
    P(PC.canvas, 16, 0, 21); P(PC.canvas, 4, 1, 40); P(PC.cream, 17, 1, 19); P(PC.canvasS, 2, 2, 44); P(PC.canvasD, 6, 3, 36);
    for (let x = 7; x < 43; x += 5) P(PC.canvasS, x, 1);
    P(PC.tomato, 0, 0, 3); P(PC.tomato, 2, 1, 4); P(PC.tomatoD, 2, 2, 4); P(PC.tomato, 43, 0, 3); P(PC.tomato, 41, 1, 4); P(PC.tomatoD, 41, 2, 4);
    P(PC.wood, 29, 4, 1, 4); P(PC.wood, 37, 4, 1, 4);
    // bicycle wheel
    P(PC.woodD, 34, 18, 1, 2);
    ell(34, 21, 3.5, 3.5, (x, y, d) => d > 0.5 ? C.ink : (x === 34 || y === 21) ? C.greyL : null);
    P(PC.mustard, 34, 21);
    // egg gondola: cream top, teal band, tomato belly
    ell(33, 13, 10.5, 5.8, (x, y, d) => {
      if (y < 12) return (x < 29 && y < 11 && d > 0.45) ? PC.cream : d > 0.8 && x > 36 ? PC.canvasS : PC.canvas;
      if (y === 12) return PC.tealL;
      if (y === 13) return PC.teal;
      return y > 16 || (d > 0.7 && x > 38) ? PC.tomatoD : (x < 28 && y === 14 ? PC.tomatoL : PC.tomato);
    });
    ell(26, 15.5, 2.4, 2.4, (x, y, d) => d > 0.45 ? PC.mustard : PC.cream); P(PC.tomato, 26, 15);
    P('#3a2a22', 29, 8, 8);
    // windscreen
    P(PC.woodD, 38, 5, 1, 4); P(C.canopy, 39, 5, 2, 3); P(C.white, 39, 5); P(C.canopyD, 40, 7);
    if (pilot) {
      const b = bob ? 1 : 0, A = (col, x, y, w = 1) => P(col, x, y + b, w);
      A(AO.n, 32, 3, 3); A(AO.H, 31, 4, 5); A(AO.l, 32, 4);
      A(AO.n, 31, 5); A(AO.g, 32, 5); A(AO.G, 33, 5, 2); A(AO.g, 35, 5);
      A(AO.n, 31, 6); A(AO.H, 32, 6); A(C.skin, 33, 6, 3);
      A(AO.n, 31, 7); A(C.skinD, 32, 7); A(C.skin, 33, 7, 2); A(AO.f, 30, 8, 6);
    }
    // drive: chain from the pedals up to the hub, then the nose cone
    for (let i = 0; i < 10; i++) P((i + chain) % 2 ? C.ink : C.greyL, 38 + i, Math.round(16 - i * 0.4));
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
  for (const pilot of [0, 1]) for (const f of [0, 1, 2]) for (const b of [0, 1]) for (const ch of [0, 1]) planeSpr[`${pilot}${f}${b}${ch}`] = makePlane(f, pilot, b, ch);

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
  const boat = fromRows(['...w...', '...ww..', '...www.', '...wwww', '...k...', 'rrrrrrr', '.rrrrr.'], { w: C.white, k: C.ink, r: C.red });

  // ---------- state ----------
  const s = S.create();
  let camX = -CAM_LEAD, camY = 0, time = 0, propA = 0, parts = [], wreck = null, overT = 0, best = 0;
  let banner = null, jpMsg = '', jpT = 0;
  try { best = +localStorage.getItem('hyperprop.best') || 0; } catch { /* storage is optional */ }
  const inp = { up: false, down: false };
  let touchMode = matchMedia('(pointer: coarse)').matches;
  let stallBeep = 0, lastMark = 0;
  // TIME is the clock from the first step to the goal; it stops while paused.
  // Until the stage has been cleared once the record is the longest distance,
  // after that it is the fastest clear.
  let ui = 0, runTime = 0, bestTime = 0, newRecord = false;
  try { bestTime = +localStorage.getItem('hyperprop.bestTime') || 0; } catch { /* storage is optional */ }
  const fmt = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`;
  // Pausing follows the rest of MarutiBit: a hidden page pauses by itself and only an
  // explicit press brings it back. Here that press is START (or tapping the screen),
  // and play restarts after a short count so the fingers can find the pedals again.
  let paused = false, countdown = 0;
  const COUNT_STEP = 0.5;

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
  on(document, 'visibilitychange', () => {
    if (document.hidden) { pauseGame(); au.sleep(); } else if (!paused) au.wake();
  });
  on(window, 'pagehide', () => { pauseGame(); au.sleep(); });
  on(window, 'pageshow', (e) => { if (e.persisted) au.reset(); });

  function show(big, sub = '', t = 1.4, jp = '') { banner = { big, sub, t }; if (jp) { jpMsg = jp; jpT = t; } }
  function burst(x, y, n, cols, spd, up) {
    for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * spd, vy: Math.random() * spd * (up || 0.5), life: 0.5 + Math.random() * 0.6, col: cols[i % cols.length] });
  }

  function begin() {
    S.start(s); parts = []; wreck = null; overT = 0; banner = null; jpMsg = ''; lastMark = 0; stallBeep = 0;
    runTime = 0; newRecord = false; paused = false; countdown = 0;
    au.music('stage', 0); au.play('start');
  }

  const playing = () => s.phase === 'run' || s.phase === 'board' || s.phase === 'roll' || s.phase === 'fly';
  function pauseGame() {
    if (!playing()) return;
    // hidden again mid-count: back to waiting, the count starts over on the next press
    paused = true; countdown = 0; inp.up = false; inp.down = false;
  }
  // called from a press, which is also what lets the sound come back
  function resumeGame() {
    if (!paused || countdown > 0) return;
    countdown = COUNT_STEP * 3;
    au.wake(); au.play('tick');
  }

  function handleEvents() {
    for (const e of s.events) {
      if (e === 'step') { burst(s.x - 2, 0, 2, [C.dirt[0], C.grass[2]], 14, 0.6); au.play('step', s.lastFoot); }
      if (e === 'pedal') au.play('pedal', s.omega);
      if (e === 'board') au.play('board');
      if (e === 'liftoff') au.play('liftoff');
      if (e === 'stumble') au.play('stumble');
      if (e === 'stumble') { jpMsg = s.phase === 'run' ? 'つまずいた！ 左右交互に' : 'ペダルが空回り！ 左右交互に'; jpT = 0.9; }
      if (e === 'seated') { show('GO!', '', 0.8, '乗り込んだ！ 漕げ！'); au.play('seated'); au.layer(1); }
      if (e === 'climb') { show('TAKE OFF!', '', 1.6, '離陸！'); au.play('takeoff'); au.layer(2); }
      if (e === 'goal') {
        au.music(null); au.play('goal'); setBest(CFG.successDist * CFG.pxToM);
        newRecord = !bestTime || runTime < bestTime;
        if (newRecord) { bestTime = runTime; try { localStorage.setItem('hyperprop.bestTime', bestTime.toFixed(2)); } catch { /* storage is optional */ } }
        show('STAGE CLEAR!', `TIME ${fmt(runTime)}`, 1e9, newRecord ? `新記録！ ${fmt(runTime)}` : `400m 飛行成功！ ${fmt(runTime)}`);
      }
      if (e === 'fail' || e === 'land') onFail();
    }
    s.events.length = 0;
  }
  function setBest(d) { if (d > best) { best = d; try { localStorage.setItem('hyperprop.best', String(Math.round(best))); } catch { /* storage is optional */ } } }
  function onFail() {
    const r = s.result; setBest(r.dist);
    const d = Math.round(r.dist);
    const [big, jp] = { edge: ['FELL OFF!', '乗り込む前に崖の外へ…'], miss: ['MISSED!', '乗り込みが間に合わなかった'], stop: ['STOPPED', '止まってしまった'], splash: ['SPLASH!', `湖に着水… ${d}m`] }[r.reason];
    show(big, r.reason === 'splash' ? `${d}M` : '', 1e9, jp);
    au.music(null);
    if (r.reason === 'splash') { au.play('splash'); au.play('fail'); }
    else if (r.reason === 'stop') au.play('fail');
    else au.play('fall');
    if (r.reason === 'edge' || r.reason === 'miss') wreck = { x: s.x, y: s.boardT > 0 ? 6 : 12, vx: s.vx * 0.8, vy: 4, rot: 0, vr: 2.5, splashed: false };
    else if (r.reason === 'splash') { wreck = { x: s.x, y: CFG.lakeY, vx: 0, vy: 0, rot: s.theta, vr: 0, splashed: true, sink: 0 }; burst(s.x + 8, CFG.lakeY, 30, [C.white, C.water[0], C.water[1]], 60, 1.4); }
  }

  // ---------- input ----------
  const over = () => s.phase === 'over' || s.phase === 'clear';
  function pressFoot(side) { if (paused) return; if (s.phase === 'ready') return begin(); S.foot(s, side); }
  function pressUp() {
    if (paused) return;
    if (s.phase === 'ready') return begin();
    if (over()) { if (overT > 0.6) begin(); return; }
    S.board(s);
  }
  const KEYS = { ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', ArrowUp: 'up', KeyW: 'up', Space: 'up', ArrowDown: 'down', KeyS: 'down' };
  on(window, 'keydown', (e) => {
    const k = KEYS[e.code];
    if (k || e.code === 'Enter' || e.code === 'KeyR') e.preventDefault();
    touchMode = false;
    if (e.code === 'Escape' || e.code === 'KeyP') { if (paused) resumeGame(); else pauseGame(); return; }
    if (paused) { if (e.code === 'Enter') resumeGame(); return; }
    if (e.code === 'Enter' || e.code === 'KeyR') { if (s.phase === 'ready' || (over() && overT > 0.6) || e.code === 'KeyR') begin(); return; }
    if (e.repeat) { if (k === 'up') inp.up = true; if (k === 'down') inp.down = true; return; }
    if (k === 'L') pressFoot(-1); if (k === 'R') pressFoot(1);
    if (k === 'up') { inp.up = true; pressUp(); }
    if (k === 'down') inp.down = true;
  });
  on(window, 'keyup', (e) => { const k = KEYS[e.code]; if (k === 'up') inp.up = false; if (k === 'down') inp.down = false; });
  on(window, 'touchstart', () => { touchMode = true; }, { passive: true });
  function press(b) {
    const k = b.dataset.k;
    b.classList.add('on');
    if (k === 'L') pressFoot(-1); if (k === 'R') pressFoot(1);
    if (k === 'up') { inp.up = true; pressUp(); } if (k === 'down') inp.down = true;
    if (k === 'start') {
      if (paused) resumeGame();
      else if (playing()) pauseGame();
      else if (s.phase === 'ready' || (over() && overT > 0.6)) begin();
    }
  }
  function release(b) { const k = b.dataset.k; b.classList.remove('on'); if (k === 'up') inp.up = false; if (k === 'down') inp.down = false; }
  // Fingers are read from touchstart, one touch at a time, with the default action
  // cancelled. On iPhone Safari two fingers down together - which is exactly what
  // drumming the pedals is - start the pinch-zoom recogniser, and the pointer events
  // for those touches get cancelled or never arrive: a press goes missing, the next
  // one lands on the same side and counts as a stumble. Cancelling touchstart keeps
  // the page from ever treating the pad as a gesture.
  //
  // The playtest on an iPhone still stumbled after that, and never on Android Chrome.
  // Three things guard the count now. A finger that is still down is never a new
  // press, even when WebKit lists it among the changed touches as another one lands.
  // A fingertip that bounces and touches the same pedal twice within 70ms is one
  // press (drumming at 10 a second, the same pedal comes round every 200ms). And two
  // pedals arriving in one event are taken in the order that alternates.
  const held = new Map();
  const lastTap = { L: -Infinity, R: -Infinity };
  const sideOf = (b) => (b.dataset.k === 'L' ? -1 : b.dataset.k === 'R' ? 1 : 0);
  on(root, 'touchstart', (e) => {
    touchMode = true;
    let hit = false;
    const fresh = [];
    for (const t of e.changedTouches) {
      const b = t.target instanceof Element ? t.target.closest('[data-k]') : null;
      if (!b || !root.contains(b)) continue;
      hit = true;
      if (held.has(t.identifier)) continue;
      held.set(t.identifier, b); fresh.push(b);
    }
    if (hit) e.preventDefault();
    fresh.sort((x, y) => Number(sideOf(x) === s.lastFoot) - Number(sideOf(y) === s.lastFoot));
    for (const b of fresh) {
      const k = b.dataset.k;
      if (k === 'L' || k === 'R') {
        if (e.timeStamp - lastTap[k] < 70) { b.classList.add('on'); continue; }
        lastTap[k] = e.timeStamp;
      }
      press(b);
    }
  }, { passive: false });
  const lift = (e) => { for (const t of e.changedTouches) { const b = held.get(t.identifier); if (b) { held.delete(t.identifier); release(b); } } };
  on(root, 'touchend', lift); on(root, 'touchcancel', lift);
  // the mouse (and a pen) still come through pointer events
  root.querySelectorAll('[data-k]').forEach((b) => {
    on(b, 'pointerdown', (e) => { if (e.pointerType === 'touch') return; e.preventDefault(); press(b); });
    const off = (e) => { if (e.pointerType !== 'touch') release(b); };
    on(b, 'pointerup', off); on(b, 'pointercancel', off); on(b, 'pointerleave', off);
  });
  on($('wrap'), 'pointerdown', () => {
    if (paused) resumeGame();
    else if (s.phase === 'ready' || (over() && overT > 0.6)) begin();
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
    time += dt;
    if (playing()) runTime += dt;
    if (s.phase !== 'ready') S.step(s, dt, inp);
    handleEvents();
    if (over()) overT += dt;
    if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
    jpT -= dt; if (jpT <= 0 && !over()) jpMsg = '';
    propA += (s.phase === 'roll' || s.phase === 'fly' ? s.omega : s.phase === 'clear' ? 0.7 : 0) * 50 * dt;
    au.engine({ phase: s.phase, omega: s.omega, V: s.phase === 'over' ? 0 : Math.hypot(s.vx, s.vy) });
    if (s.phase === 'fly' && s.stall) { stallBeep -= dt; if (stallBeep <= 0) { au.play('stall'); stallBeep = 0.32; } } else stallBeep = 0;
    const mark = Math.floor(Math.max(0, s.x - CFG.edgeX) / 200);
    if (mark > lastMark && mark * 200 < CFG.successDist && (s.phase === 'fly' || s.phase === 'roll')) au.play('marker');
    lastMark = Math.max(lastMark, mark);

    if (wreck) {
      if (!wreck.splashed) {
        wreck.vy -= CFG.g * dt; wreck.x += wreck.vx * dt; wreck.y += wreck.vy * dt; wreck.rot += wreck.vr * dt;
        if (wreck.y <= CFG.lakeY) { au.play('splash'); au.play('fail'); wreck.splashed = true; wreck.y = CFG.lakeY; wreck.sink = 0; burst(wreck.x, CFG.lakeY, 30, [C.white, C.water[0], C.water[1]], 60, 1.4); }
      } else wreck.sink = Math.min(10, wreck.sink + dt * 2.5);
    }
    if (s.phase === 'fly' && s.x > CFG.edgeX && s.y - CFG.lakeY < 8 && Math.random() < 0.5) burst(s.x - 6, CFG.lakeY, 1, [C.white, C.water[0]], 8, 0.8);
    if (s.phase === 'fly' && s.omega > 0.3 && Math.random() < 0.25) parts.push({ x: s.x - 42, y: s.y + 6 + Math.random() * 8, vx: -24, vy: 0, life: 0.2, col: C.white, noGrav: true });

    for (const p of parts) { if (!p.noGrav) p.vy -= CFG.g * 0.8 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    parts = parts.filter((p) => p.life > 0 && p.y > CFG.lakeY - 2);

    const fx = wreck ? wreck.x : s.x, fy = wreck ? Math.max(wreck.y, CFG.lakeY) : s.y;
    camX += (fx - CAM_LEAD - camX) * Math.min(1, dt * 6);
    camX = Math.max(-150, camX);
    camY += (Math.max(0, fy - 40) - camY) * Math.min(1, dt * 3);
  }

  // ---------- draw ----------
  const sx = (x) => Math.round(x - camX), sy = (y) => Math.round(GROUND_SY - y + camY);
  function tile(img, par, y) {
    const off = ((-camX * par) % img.width + img.width) % img.width;
    for (let x = off - img.width; x < W; x += img.width) ctx.drawImage(img, Math.round(x), Math.round(y));
  }

  function draw() {
    ctx.drawImage(sky, 0, 0);
    const hz = HORIZON + Math.round(camY * 0.25);
    for (const [cx, cy, img] of clouds) {
      const x = (((cx - camX * 0.04 - time * 1.5) % 420) + 420) % 420 - 70;
      ctx.drawImage(img, Math.round(x), Math.round(cy + camY * 0.08));
    }
    for (let i = 0; i < 3; i++) {
      const bx = ((i * 97 + time * (7 + i * 2) - camX * 0.08) % 330 + 330) % 330 - 40, by = 50 + i * 9 + Math.sin(time * 0.7 + i) * 3;
      const up = Math.floor(time * 5 + i * 2) % 2;
      px(ctx, C.night, Math.round(bx), Math.round(by) + up, 1, 1); px(ctx, C.night, Math.round(bx) + 1, Math.round(by) + 1, 1, 1);
      px(ctx, C.night, Math.round(bx) + 2, Math.round(by), 1, 1); px(ctx, C.night, Math.round(bx) + 3, Math.round(by) + up, 1, 1);
    }
    tile(alps, 0.05, hz - 112 + 2);
    tile(range2, 0.1, hz - 62 + 2);
    tile(forest, 0.22, hz - 30 + 1);
    drawLake(hz);
    drawMarkers();

    // cliff and what stands on it
    ctx.drawImage(cliff, sx(CLIFF_L), sy(0) - CLIFF_TOP);
    for (const [x, img] of pines) ctx.drawImage(img, sx(x) - (img.width >> 1), sy(0) - img.height + 2);
    for (let x = -190; x < CFG.edgeX - 30; x += 37) ctx.drawImage(bush, sx(x + (hash(x) * 10 | 0)), sy(0) - 5);
    const st = sx(CFG.edgeX - 28), g0 = sy(0);
    px(ctx, C.ink, st - 1, g0 - 11, 3, 11); px(ctx, C.dirt[0], st, g0 - 10, 1, 10);
    px(ctx, C.red, st + 1, g0 - 10 + Math.round(Math.sin(time * 6)), 3, 2);
    const ws = sx(CFG.edgeX - 7);
    px(ctx, C.ink, ws - 1, g0 - 24, 3, 24); px(ctx, C.greyL, ws, g0 - 23, 1, 23);
    for (let i = 0; i < 4; i++) px(ctx, i % 2 ? C.white : C.red, ws + 1 + i * 3, g0 - 23 + Math.round(Math.sin(time * 5 + i) * i * 0.4) + (i >> 1), 3, 3 - (i >> 1));
    // water laps over the cliff foot
    const surf = sy(CFG.lakeY), ex = Math.max(0, sx(CFG.edgeX) + 1);
    if (ex > 0) {
      ctx.globalAlpha = 0.85; px(ctx, C.water[5], 0, surf + 1, ex, H - surf); ctx.globalAlpha = 1;
      crest(surf, 0, ex);
    }

    drawPlayer();
    for (const p of parts) px(ctx, p.col, sx(p.x), sy(p.y));
    drawHud();
  }

  function crest(y, x0, x1) {
    const t = Math.floor(time * 8);
    for (let x = x0; x < x1; x++) {
      const k = (x + t + Math.floor(camX)) & 15;
      px(ctx, k < 3 ? C.white : k < 7 ? C.water[1] : C.water[3], x, y);
    }
  }

  // the dithered water body only changes when the camera moves vertically, so keep it cached
  const [lakeC, lakeG] = canvas(W, H); let lakeKey = '';
  function drawLake(hz) {
    const surf = sy(CFG.lakeY);
    if (lakeKey !== hz + ',' + surf) {
      lakeKey = hz + ',' + surf; lakeG.clearRect(0, 0, W, H);
      for (let y = hz; y < H; y++) for (let x = 0; x < W; x++)
        px(lakeG, y < surf ? ramp([C.water[1], C.water[2], C.water[3]], (y - hz) / Math.max(1, surf - hz), x, y) : ramp([C.water[4], C.water[5], C.water[6]], (y - surf) / 26, x, y), x, y);
    }
    ctx.drawImage(lakeC, 0, 0);
    px(ctx, C.water[0], 0, hz, W, 1);
    // reflection, each row nudged by the ripple
    const off = ((-camX * 0.05) % 512 + 512) % 512;
    for (let r = 0; r < 40 && hz + 1 + r < surf; r++) {
      const wob = Math.round(Math.sin(time * 2 + r * 0.9) * (r > 4 ? 1 : 0));
      for (let x = off - 512; x < W; x += 512) ctx.drawImage(refl, 0, r, 512, 1, Math.round(x) + wob, hz + 1 + r, 512, 1);
    }
    for (let i = 0; i < 22; i++) {
      const y = hz + 3 + ((i * 37) % Math.max(4, surf - hz - 4));
      if (Math.floor(time * 2 + i * 0.7) % 3 === 0) continue;
      const x = ((i * 97 - camX * (0.2 + (y - hz) / 60)) % W + W) % W;
      px(ctx, i % 3 ? C.water[0] : C.white, Math.round(x), y, 2 + (i % 3), 1);
    }
    const bx = ((300 - camX * 0.15 + time * 3) % 520 + 520) % 520 - 60;
    ctx.drawImage(boat, Math.round(bx), hz + 1);
    crest(surf, 0, W);
    for (let i = 0; i < 10; i++) {
      const y = surf + 4 + ((i * 7) % Math.max(1, H - surf - 5));
      const x = ((i * 53 - camX - time * 6) % (W + 20) + W + 20) % (W + 20) - 10;
      px(ctx, C.water[3], Math.round(x), y, 4 + (i % 4), 1);
    }
  }

  function drawMarkers() {
    const surf = sy(CFG.lakeY);
    for (let d = 200; d <= CFG.successDist; d += 200) {
      const x = sx(CFG.edgeX + d); if (x < -40 || x > W + 40) continue;
      if (d === CFG.successDist) {
        px(ctx, C.ink, x - 17, surf - 5, 34, 6); px(ctx, C.rock[2], x - 16, surf - 4, 32, 5); px(ctx, C.rock[1], x - 14, surf - 6, 26, 2);
        px(ctx, C.ink, x - 12, surf - 8, 22, 2); px(ctx, C.grass[1], x - 11, surf - 8, 20, 2); px(ctx, C.grass[0], x - 9, surf - 8, 12, 1);
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

  function planeImg(pilot) {
    const f = s.omega > 0.45 || s.phase === 'clear' ? 2 : Math.floor(propA) % 2;
    return planeSpr[`${pilot ? 1 : 0}${f}${s.lastFoot === 1 ? 1 : 0}${Math.floor(propA * 3) % 2}`];
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
      if (s.result.reason === 'splash') drawPlane(wreck.x, wreck.y - sink, wreck.rot * 0.5 + 0.15, planeSpr['1100']);
      else { drawPlane(wreck.x + 6, wreck.y - sink, wreck.rot, planeSpr['0000']); drawSpr(tuckR[Math.floor(wreck.rot * 2) & 3], wreck.x - 4, wreck.y - sink + 6); }
      ctx.restore();
      return;
    }
    if (ph === 'ready' || ph === 'run') {
      const moving = s.vx > 2, f = moving ? Math.floor(s.x / 6) % 4 : 1;
      const bob = f % 2 ? 1 : 0;
      drawPlane(s.x + CARRY.dx, CARRY.y + bob, 0, planeSpr['0000']);
      if (s.stumble > 0) drawSpr(tuckR[1], s.x, 0);
      else drawSpr(runF[f], s.x, bob);
      return;
    }
    if (ph === 'board') {
      const t = Math.min(1, s.boardT / CFG.boardTime), e = t * t * (3 - 2 * t);
      drawPlane(s.x + CARRY.dx * (1 - e), (1 - e) * CARRY.y, 0, planeSpr['0000']);
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

  function drawHud() {
    const blink = Math.floor(ui * 2.5) % 2 === 0;
    if (s.phase === 'ready') {
      ctx.globalAlpha = 0.35; px(ctx, C.ink, 0, 0, W, H); ctx.globalAlpha = 1;
      text('HYPER', W / 2, 12, [C.white, C.white, '#d8ecf2', '#d8ecf2', '#b5d8ec', '#b5d8ec', '#8fbde2'], { s: 2, align: 'center', shadow: C.night });
      text('PROP', W / 2, 30, GOLD, { s: 4, align: 'center', shadow: C.redD });
      text('STAGE 1  LAKESIDE HILL', W / 2, 67, C.white, { align: 'center' });
      if (blink) text(touchMode ? 'PUSH PEDAL' : 'PRESS ENTER', W / 2, 150, C.yellow, { align: 'center' });
      text(bestTime ? `BEST TIME ${fmt(bestTime)}` : `BEST ${Math.round(best)}M`, W / 2, 172, C.greyL, { align: 'center' });
      return;
    }
    px(ctx, C.ink, 0, 0, W, HUD_H); px(ctx, C.night, 0, HUD_H - 1, W, 1);
    const V = s.phase === 'over' ? 0 : Math.hypot(s.vx, s.vy), air = s.phase === 'roll' || s.phase === 'fly' || s.phase === 'clear';
    text('SPEED', 4, 2, C.white, { outline: false }); bar(36, 2, V / 50, C.yellow);
    text('PEDAL', 4, 10, C.white, { outline: false }); bar(36, 10, air ? s.omega : 0, C.green);
    const dist = Math.round(Math.max(0, s.x - CFG.edgeX) * CFG.pxToM);
    const goalTxt = `/${CFG.successDist * CFG.pxToM}M`;
    text(goalTxt, 252, 2, C.greyL, { outline: false, align: 'right' }); text(`${dist}M`, 252 - textW(goalTxt) - 1, 2, C.yellow, { outline: false, align: 'right' });
    text(`TIME ${fmt(runTime)}`, 252, 10, C.white, { outline: false, align: 'right' });
    // progress strip under the HUD
    const prog = Math.max(0, Math.min(1, (s.x - CFG.edgeX) / CFG.successDist));
    px(ctx, C.night, 88, 7, 60, 1); px(ctx, C.yellow, 88, 7, Math.round(prog * 60), 1); px(ctx, C.white, 88 + Math.round(prog * 60) - 1, 5, 3, 3);

    if (banner) {
      text(banner.big, W / 2, 52, GOLD, { s: 2, align: 'center', shadow: C.redD });
      if (banner.sub) text(banner.sub, W / 2, 74, C.white, { align: 'center' });
      if (s.phase === 'clear' && newRecord && blink) text('NEW RECORD!', W / 2, 86, C.yellow, { align: 'center' });
    } else if (s.phase === 'fly' && s.stall && blink) text('STALL!', W / 2, 52, [C.white, C.redL, C.redL, C.red, C.red, C.redD, C.redD], { s: 2, align: 'center' });
    if (over() && overT > 0.6 && blink) text(touchMode ? 'PUSH START' : 'PRESS ENTER', W / 2, 100, C.yellow, { align: 'center' });

    if (paused) {
      ctx.globalAlpha = 0.45; px(ctx, C.ink, 0, HUD_H, W, H - HUD_H); ctx.globalAlpha = 1;
      if (countdown > 0) text(String(Math.ceil(countdown / COUNT_STEP)), W / 2, 76, GOLD, { s: 4, align: 'center', shadow: C.redD });
      else {
        text('PAUSED', W / 2, 70, C.white, { s: 2, align: 'center', shadow: C.night });
        if (blink) text(touchMode ? 'PUSH START' : 'PRESS ENTER', W / 2, 100, C.yellow, { align: 'center' });
      }
    }

    const cap = s.phase === 'run' ? '▲ で乗る' : 'PITCH';
    if ($('upCap').textContent !== cap) $('upCap').textContent = cap;
  }

  // The sub display is two fixed lines and never grows: the upper line says what is
  // happening, the lower one what to press. Every text here fits one line on a phone.
  const plateLines = [$('l1'), $('l2')];
  function updatePlate() {
    const t = touchMode;
    const pedal = t ? 'PEDAL を交互に叩いて' : '← → を交互に押して';
    const [what, press] = {
      ready: [t ? 'PEDAL か START でスタート' : 'Enter / Space でスタート', au.enabled ? '' : '音は本体の上の SOUND を ON に'],
      run: [pedal + '走る', t ? '赤い杭のあたりで ▲ で乗り込む' : '赤い杭のあたりで ↑ で乗り込む'],
      board: ['', ''],
      roll: [pedal + '漕ぐ', t ? '▲ で機首上げ' : '↑ で機首上げ'],
      fly: s.stall ? ['失速！', t ? '▼ で機首を下げて速度を戻す' : '↓ で機首を下げて速度を戻す'] : [pedal + '漕ぐ', t ? '▲ ▼ で機首' : '↑ ↓ で機首'],
      over: ['', t ? 'START でもう一度' : 'Enter / R でもう一度'],
      clear: ['', t ? 'START でもう一度' : 'Enter / R でもう一度'],
    }[s.phase] || ['', ''];
    const lines = paused
      ? (countdown > 0 ? ['もうすぐ再開', t ? 'PEDAL に指を置いて' : '← → に指を置いて'] : ['一時停止中', t ? 'START で続ける' : 'Enter / Esc で続ける'])
      : [jpMsg || what, press];
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
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    offs.forEach((off) => off());
    au.dispose();
  };
}
