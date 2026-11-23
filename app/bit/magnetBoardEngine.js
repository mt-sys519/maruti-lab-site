// MAGNET BOARD: a magnetic drawing board. The screen is a field of iron-powder
// density (D) composited per pixel with a grain texture (N), the honeycomb walls
// (WL) and the practice sheet printed underneath (G); the pen raises powder, the
// slider under the screen wipes it back down column by column.
//
// mountMagnetBoard(root) wires the toy into the markup under root, found by
// data-mb, and returns a function that takes it all down again - the loop, the
// sound and every listener - so leaving the page (or React mounting twice in
// development) leaves nothing behind.

const SOUND_KEY = 'marutibit:sound-enabled';
const COLOR_KEY = 'marutibit:magnetboard-color';
const HIRA = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
const GYOU = ['あいうえお', 'かきくけこ', 'さしすせそ', 'たちつてと', 'なにぬねの', 'はひふへほ', 'まみむめも', 'やゆよ', 'らりるれろ', 'わをん'];
const SHEET_SHAPES = ['circle', 'triangle', 'square', 'star', 'heart', 'wave', 'zigzag', 'spiral'];

export function mountMagnetBoard(root) {
  const offs = [];
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); offs.push(() => target.removeEventListener(type, fn, opts)); };
  const $ = (id) => root.querySelector(`[data-mb="${id}"]`);
  let alive = true, raf = 0;

  const canvas = $('board');
  const ctx = canvas.getContext('2d');
  const screenEl = $('screen');
  const slider = $('slider');
  const knob = $('knob');
  const penBtns = [...root.querySelectorAll('[data-mb-width]')];
  const bottomEl = $('bottom');

  let penR = +(penBtns.find((b) => b.getAttribute('aria-pressed') === 'true') || penBtns[0]).dataset.mbWidth; // pen radius in css px
  const HEX_R = 3.5;            // css px, honeycomb cell circumradius
  const HAZE_R = 11;            // css px

  let scale = 1, cssW = 0, cssH = 0, W = 0, H = 0;
  let D, N, WL, G, Hz, img, px;
  let hazeBox = null;           // particles lifted toward the pen but not yet stuck
  const grains = [];            // loose particles left behind by a quick erase
  const pen = { x: 0, y: 0, active: false, since: 0 };
  let dirty = null;
  let eraseT;                   // per-column erase timer
  let eraseActive = false;
  let knobPos = 0;              // 0..1
  let KNOB_W = 52;              // css px, follows the frame's unit

  // ---- sizing ----
  // The plastic around the screen - frame, logo, colour dots, the eraser knob - is
  // drawn in units of u, and u follows the screen's width, so a phone-sized board
  // and a desk-sized one keep the same proportions as the toy itself.
  // On a wide screen the control card stands to the right of the board instead of
  // under it, so the kana picker opening never makes the board shrink.
  const SIDE_GAP = 28;
  const sideW = (u) => Math.round(230 + 70 * u); // the side card grows with the board, like its buttons
  const isSide = () => root.clientWidth >= 920;
  // A phone's toolbar sliding away changes innerHeight on every scroll; the board
  // only follows the height when it really changed (rotation, a new window size).
  let lastVW = 0, steadyVH = 0;
  function viewHeight() {
    const vw = window.innerWidth, vh = window.innerHeight;
    if (vw !== lastVW || Math.abs(vh - steadyVH) > 140) { lastVW = vw; steadyVH = vh; }
    return steadyVH;
  }
  // The board takes all the room it is given - the whole width of the page, down to
  // the bottom of the screen - and its shape follows that room, from 2:3 on a phone
  // held upright to 16:9 on a wide monitor.
  function fit() {
    const vh = viewHeight(), side = isSide();
    let u = 1, w = 0, h = 0;
    for (let k = 0; k < 3; k++) { // u and the screen size depend on each other; this settles in a pass or two
      const avail = root.clientWidth - (side ? sideW(u) + SIDE_GAP : 0);
      w = Math.min(avail - 36 * u, 1600);
      // the frame's chrome (top bar 34, knob rail 54, padding 28) has to fit on screen
      // with the board once scrolled to it. Stacked, the control card is left to sit
      // below the fold: keeping it on screen held a phone's board to a squat 3:4 with
      // little room to draw, so the board gets the screen's height and the card is a
      // scroll away.
      const maxH = Math.max(260, vh - (116 * u + 48));
      h = Math.min(maxH, w / (side ? 0.75 : 2 / 3));
      if (w / h > 1.78) w = h * 1.78; // a short, wide window: narrow the board rather than flatten it
      u = Math.min(1.5, Math.max(0.78, Math.min(w, h) / 420));
    }
    return { w: Math.max(200, Math.floor(w)), h: Math.max(150, Math.floor(h)), u };
  }
  function fitChrome({ w, u }) {
    const side = isSide();
    root.classList.toggle('mbSide', side);
    root.style.setProperty('--mb-u', u.toFixed(3));
    KNOB_W = 52 * u;
    // stacked, the control card stands exactly as wide as the board's frame above it
    bottomEl.style.width = side ? sideW(u) + 'px' : Math.round(w + 36 * u) + 'px';
  }
  function layout() {
    const f = fit();
    fitChrome(f);
    const { w, h } = f;
    // every pixel is composited by hand, so a big board on a sharp screen draws at a
    // coarser grain rather than letting a full-width wipe stutter
    const newScale = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2.4e6 / (w * h)));
    if (w === cssW && h === cssH && newScale === scale) { placeKnob(knobPos, false); return; }
    const old = D ? { D, W, H } : null;
    cssW = w; cssH = h; scale = newScale;
    W = Math.round(w * scale); H = Math.round(h * scale);
    canvas.width = W; canvas.height = H;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    screenEl.style.width = w + 'px';
    slider.style.width = w + 'px';
    D = new Float32Array(W * H);
    if (old) { // keep the drawing across resizes
      for (let y = 0; y < H; y++) {
        const oy = Math.min(old.H - 1, Math.floor(y * old.H / H));
        for (let x = 0; x < W; x++) D[y * W + x] = old.D[oy * old.W + Math.min(old.W - 1, Math.floor(x * old.W / W))];
      }
      for (const g of grains) { g.x *= W / old.W; g.y *= H / old.H; }
    }
    buildTextures();
    G = new Uint8Array(W * H);
    Hz = new Float32Array(W * H); hazeBox = null;
    eraseT = new Float32Array(W);
    img = ctx.createImageData(W, H);
    px = img.data;
    drawGuide();
    dirty = { x0: 0, y0: 0, x1: W, y1: H };
    placeKnob(knobPos, false);
  }

  // grain (how particles clump) and honeycomb walls
  function buildTextures() {
    N = new Uint8Array(W * H);
    WL = new Uint8Array(W * H);
    const bw = Math.max(1, Math.round(scale * 1.5));
    const bcols = Math.ceil(W / bw) + 1;
    const block = new Uint8Array(bcols * (Math.ceil(H / bw) + 1));
    for (let i = 0; i < block.length; i++) block[i] = Math.random() * 255;
    for (let y = 0, i = 0; y < H; y++) {
      const br = ((y / bw) | 0) * bcols;
      for (let x = 0; x < W; x++, i++) N[i] = Math.random() * 255 * 0.55 + block[br + ((x / bw) | 0)] * 0.45;
    }
    const R = HEX_R * scale, a = R * 0.8660254, colW = 2 * a, rowH = 1.5 * R;
    const wallW = 0.9 * scale;
    for (let y = 0, i = 0; y < H; y++) {
      const jr = Math.round(y / rowH);
      for (let x = 0; x < W; x++, i++) {
        let best = 1e9;
        for (let j = jr - 1; j <= jr + 1; j++) {
          const off = (j & 1) ? a : 0;
          const cx = Math.round((x - off) / colW) * colW + off;
          const dx = Math.abs(x - cx), dy = Math.abs(y - j * rowH);
          const d = Math.max(dx, 0.5 * dx + 0.8660254 * dy);
          if (d < best) best = d;
        }
        const w = (best - (a - wallW)) / wallW;
        WL[i] = w <= 0 ? 0 : w >= 1 ? 255 : w * 255;
      }
    }
  }

  function markDirty(x0, y0, x1, y1) {
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(W, Math.ceil(x1)); y1 = Math.min(H, Math.ceil(y1));
    if (x1 <= x0 || y1 <= y0) return;
    if (!dirty) dirty = { x0, y0, x1, y1 };
    else {
      dirty.x0 = Math.min(dirty.x0, x0); dirty.y0 = Math.min(dirty.y0, y0);
      dirty.x1 = Math.max(dirty.x1, x1); dirty.y1 = Math.max(dirty.y1, y1);
    }
  }

  function render() {
    if (!dirty) return;
    const { x0, y0, x1, y1 } = dirty;
    dirty = null;
    for (let y = y0; y < y1; y++) {
      let i = y * W + x0, p = i * 4;
      for (let x = x0; x < x1; x++, i++, p += 4) {
        const n = N[i] / 255, w = WL[i] / 255;
        let c = (D[i] - n * 0.5) / 0.3;
        c = c <= 0 ? 0 : c >= 1 ? 1 : c;
        const h = Hz[i];
        if (h > 0) { // only the lightest grains rise first, so the haze reads as speckles
          let hc = (h - n) / 0.12;
          hc = hc <= 0 ? 0 : hc >= 1 ? 0.7 : hc * 0.7;
          if (hc > c) c = hc;
        }
        c *= 1 - w * 0.78;
        const gd = G[i] / 255; // the practice sheet printed under the screen
        const bg = 229 - w * 15 + (n - 0.5) * 5;
        const br = bg - gd * 46, bgg = bg - gd * 30, bb = bg - 6 - gd * 8;
        const ink = 66 + n * 34;
        px[p] = br + (ink - 2 - br) * c;
        px[p + 1] = bgg + (ink - bgg) * c;
        px[p + 2] = bb + (ink + 6 - bb) * c;
        px[p + 3] = 255;
      }
    }
    const s = Math.max(1, Math.round(1.3 * scale));
    for (const g of grains) {
      const gx = g.x | 0, gy = g.y | 0;
      if (gx + s <= x0 || gx >= x1 || gy + s <= y0 || gy >= y1) continue;
      for (let yy = Math.max(y0, gy); yy < Math.min(y1, gy + s); yy++)
        for (let xx = Math.max(x0, gx); xx < Math.min(x1, gx + s); xx++) {
          const p = (yy * W + xx) * 4;
          px[p] = 64; px[p + 1] = 66; px[p + 2] = 72;
        }
    }
    ctx.putImageData(img, 0, 0, x0, y0, x1 - x0, y1 - y0);
  }

  // ---- drawing ----
  function deposit(cx, cy, r, amount) {
    const xa = Math.max(0, Math.floor(cx - r)), xb = Math.min(W - 1, Math.ceil(cx + r));
    const ya = Math.max(0, Math.floor(cy - r)), yb = Math.min(H - 1, Math.ceil(cy + r));
    const r2 = r * r;
    for (let y = ya; y <= yb; y++) {
      const dy = y - cy;
      for (let x = xa; x <= xb; x++) {
        const dx = x - cx, q = (dx * dx + dy * dy) / r2;
        if (q >= 1) continue;
        const i = y * W + x, a = amount * (1 - q);
        D[i] = 1 - (1 - D[i]) * (1 - a);
      }
    }
    markDirty(xa, ya, xb + 1, yb + 1);
  }

  // a quick stroke picks up less powder, so fast lines come out thin and broken
  function strokeTo(x0, y0, x1, y1, speed) {
    const r = penR * scale;
    const amount = 0.24 * Math.sqrt(3.2 / penR) / (1 + speed * 0.18);
    const len = Math.hypot(x1 - x0, y1 - y0), step = 0.6 * scale;
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      deposit(x0 + (x1 - x0) * t + (Math.random() - 0.5) * 0.6 * scale,
        y0 + (y1 - y0) * t + (Math.random() - 0.5) * 0.6 * scale, r, amount);
    }
  }

  penBtns.forEach((b) => on(b, 'click', () => {
    penR = +b.dataset.mbWidth;
    penBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    sfx.click();
  }));

  let drawing = null;
  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
  }
  function penAt(x, y) {
    if (!pen.active) pen.since = performance.now();
    pen.x = x; pen.y = y; pen.active = true;
  }
  on(canvas, 'pointerdown', (e) => {
    audio.ensure();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointers have nothing to capture */ }
    const p = toCanvas(e);
    drawing = { id: e.pointerId, x: p.x, y: p.y, t: e.timeStamp, still: performance.now() };
    deposit(p.x, p.y, penR * scale, 0.5);
    penAt(p.x, p.y);
    sfx.penDown();
  });
  on(canvas, 'pointermove', (e) => {
    if (!drawing || e.pointerId !== drawing.id) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    let dist = 0;
    for (const ev of (evs.length ? evs : [e])) {
      const p = toCanvas(ev);
      const dt = Math.max(1, ev.timeStamp - drawing.t);
      const seg = Math.hypot(p.x - drawing.x, p.y - drawing.y);
      strokeTo(drawing.x, drawing.y, p.x, p.y, seg / scale / dt);
      dist += seg / scale;
      drawing.x = p.x; drawing.y = p.y; drawing.t = ev.timeStamp;
    }
    if (dist > 0.3) drawing.still = performance.now();
    penAt(drawing.x, drawing.y);
    sfx.scratch(dist);
  });
  const endDraw = (e) => {
    audio.ensure();
    if (drawing && e.pointerId === drawing.id) {
      drawing = null; sfx.scratch(0);
      pen.active = false;
    }
  };
  on(canvas, 'pointerup', endDraw);
  on(canvas, 'pointercancel', endDraw);

  // holding the pen still keeps pulling particles in, so the dot slowly grows
  function stepDwell(now) {
    if (!drawing) return;
    const still = now - drawing.still;
    if (still < 70) return;
    const grow = Math.min(1, (still - 70) / 1400);
    deposit(drawing.x, drawing.y, penR * scale * (1 + grow * 0.9), 0.06);
  }

  // particles near the magnet lift a little and sink back when it moves on
  function stepHaze(now) {
    let nb = null;
    const grow = (x0, y0, x1, y1) => {
      if (!nb) nb = { x0, y0, x1, y1 };
      else { if (x0 < nb.x0) nb.x0 = x0; if (y0 < nb.y0) nb.y0 = y0; if (x1 > nb.x1) nb.x1 = x1; if (y1 > nb.y1) nb.y1 = y1; }
    };
    if (hazeBox) {
      const { x0, y0, x1, y1 } = hazeBox;
      for (let y = y0; y < y1; y++) {
        let i = y * W + x0, rowHit = false, ra = x1, rb = x0;
        for (let x = x0; x < x1; x++, i++) {
          let v = Hz[i];
          if (!v) continue;
          v *= 0.87;
          if (v < 0.01) v = 0; else { rowHit = true; if (x < ra) ra = x; if (x >= rb) rb = x + 1; }
          Hz[i] = v;
        }
        if (rowHit) grow(ra, y, rb, y + 1);
      }
      markDirty(x0, y0, x1, y1);
    }
    if (pen.active) {
      const ramp = Math.min(1, (now - pen.since) / 450), peak = 0.62 * ramp;
      const r = HAZE_R * (0.6 + 0.4 * penR / 3.2) * scale, r2 = r * r;
      const xa = Math.max(0, Math.floor(pen.x - r)), xb = Math.min(W, Math.ceil(pen.x + r));
      const ya = Math.max(0, Math.floor(pen.y - r)), yb = Math.min(H, Math.ceil(pen.y + r));
      for (let y = ya; y < yb; y++) {
        const dy = y - pen.y;
        for (let x = xa; x < xb; x++) {
          const dx = x - pen.x, q = (dx * dx + dy * dy) / r2;
          if (q >= 1) continue;
          const v = peak * (1 - q), i = y * W + x;
          if (v > Hz[i]) Hz[i] = v;
        }
      }
      if (xb > xa && yb > ya) { grow(xa, ya, xb, yb); markDirty(xa, ya, xb, yb); }
    }
    hazeBox = nb;
  }

  // ---- loose grains: stragglers from a quick erase, which the pen picks back up ----
  const MAX_GRAINS = 5000;
  function stepGrains(dt) {
    if (!grains.length) { sfx.grains(0); return; }
    const PULL = 5000 * scale;
    const pull = pen.active ? { x: pen.x, y: pen.y, r: 26 * scale, hold: penR * scale * 1.1 } : null;
    let bx0 = W, by0 = H, bx1 = 0, by1 = 0, moving = 0;
    for (let k = grains.length - 1; k >= 0; k--) {
      const g = grains[k];
      let ax = 0, ay = 0;
      if (pull) {
        const dx = pull.x - g.x, dy = pull.y - g.y, d = Math.hypot(dx, dy);
        if (d < pull.hold) {
          deposit(g.x, g.y, 1.4 * scale, 0.7);
          markDirty(g.x - 3, g.y - 3, g.x + 4, g.y + 4);
          grains[k] = grains[grains.length - 1]; grains.pop();
          continue;
        }
        if (d < pull.r) { const f = PULL * (1 - d / pull.r) / d; ax += dx * f; ay += dy * f; }
      }
      if (!ax && !ay && !g.vx && !g.vy) continue;
      g.vx = (g.vx + ax * dt) * 0.86; g.vy = (g.vy + ay * dt) * 0.86;
      const wi = (g.y | 0) * W + (g.x | 0);
      if (WL[wi] > 140) { g.vx *= 0.55; g.vy *= 0.55; } // honeycomb walls make them stutter
      if (!ax && !ay && Math.abs(g.vx) + Math.abs(g.vy) < 4 * scale) { g.vx = g.vy = 0; continue; }
      const ox = g.x, oy = g.y;
      g.x += g.vx * dt + (Math.random() - 0.5) * 0.5 * scale;
      g.y += g.vy * dt + (Math.random() - 0.5) * 0.5 * scale;
      if (g.x < 0) { g.x = 0; g.vx = 0; } else if (g.x > W - 2) { g.x = W - 2; g.vx = 0; }
      if (g.y < 0) { g.y = 0; g.vy = 0; } else if (g.y > H - 2) { g.y = H - 2; g.vy = 0; }
      bx0 = Math.min(bx0, ox, g.x); by0 = Math.min(by0, oy, g.y);
      bx1 = Math.max(bx1, ox, g.x); by1 = Math.max(by1, oy, g.y);
      moving++;
    }
    if (moving) { const s = 2 * scale + 1; markDirty(bx0 - s, by0 - s, bx1 + s, by1 + s); }
    sfx.grains(moving);
  }
  function spawnGrains(xa, xb, speed, now) {
    const p = Math.min(1, Math.max(0, (speed - 5) / 30)) * 0.02;
    if (p <= 0) return;
    const step = Math.max(1, Math.round(2 * scale));
    for (let x = xa; x < xb && grains.length < MAX_GRAINS; x++) {
      for (let y = (Math.random() * step) | 0; y < H; y += step) {
        if (D[y * W + x] > 0.45 && Math.random() < p) {
          grains.push({ x: x + Math.random(), y: y + Math.random(), vx: 0, vy: 0, born: now });
          if (grains.length >= MAX_GRAINS) break;
        }
      }
    }
  }
  function sweepGrains(xa, xb, now) {
    for (let k = grains.length - 1; k >= 0; k--) {
      const g = grains[k];
      if (g.x >= xa && g.x < xb && now - g.born > 300) {
        markDirty(g.x - 3, g.y - 3, g.x + 4, g.y + 4);
        grains[k] = grains[grains.length - 1]; grains.pop();
      }
    }
  }

  // ---- eraser slider ----
  function bandX(pos) { // board-space center of the erasing bar; parked off-screen at the ends
    const half = (KNOB_W / 2) * scale;
    return pos * (W + half * 2) - half;
  }
  function placeKnob(pos, erase) {
    pos = Math.min(1, Math.max(0, pos));
    if (erase && W) {
      const half = (KNOB_W / 2) * scale;
      const a = bandX(knobPos), b = bandX(pos);
      const xa = Math.max(0, Math.floor(Math.min(a, b) - half)), xb = Math.min(W, Math.ceil(Math.max(a, b) + half));
      const now = performance.now();
      sweepGrains(xa, xb, now);
      // a quick swipe leaves a few stragglers behind
      spawnGrains(xa, xb, Math.abs(pos - knobPos) * cssW, now);
      for (let x = xa; x < xb; x++) eraseT[x] = 1;
      if (xb > xa) eraseActive = true;
    }
    knobPos = pos;
    knob.style.transform = `translateX(${pos * (cssW - KNOB_W)}px)`;
    knob.setAttribute('aria-valuenow', String(Math.round(pos * 100)));
  }
  let knobDrag = null;
  function moveKnob(e) {
    const r = slider.getBoundingClientRect();
    const pos = (e.clientX - r.left - knobDrag.grab) / (cssW - KNOB_W);
    const before = knobPos;
    placeKnob(pos, true);
    sfx.slide(Math.abs(knobPos - before) * cssW);
  }
  on(slider, 'pointerdown', (e) => {
    audio.ensure();
    try { slider.setPointerCapture(e.pointerId); } catch { /* synthetic pointers have nothing to capture */ }
    const r = slider.getBoundingClientRect();
    const kx = knobPos * (cssW - KNOB_W);
    const local = e.clientX - r.left;
    knobDrag = { id: e.pointerId, grab: (local >= kx && local <= kx + KNOB_W) ? local - kx : KNOB_W / 2 };
    moveKnob(e);
  });
  on(slider, 'pointermove', (e) => { if (knobDrag && e.pointerId === knobDrag.id) moveKnob(e); });
  const endKnob = (e) => {
    audio.ensure();
    if (knobDrag && e.pointerId === knobDrag.id) { knobDrag = null; sfx.slide(0); }
  };
  on(slider, 'pointerup', endKnob);
  on(slider, 'pointercancel', endKnob);
  on(knob, 'keydown', (e) => {
    const step = e.shiftKey ? 0.25 : 0.05;
    if (e.key === 'ArrowRight') placeKnob(knobPos + step, true);
    else if (e.key === 'ArrowLeft') placeKnob(knobPos - step, true);
    else if (e.key === 'Home') placeKnob(0, true);
    else if (e.key === 'End') placeKnob(1, true);
    else return;
    e.preventDefault();
    sfx.swish();
  });

  // particles sink back under the bar over a few frames
  function stepErase() {
    if (!eraseActive) return;
    let any = false, xa = W, xb = 0;
    for (let x = 0; x < W; x++) {
      const t = eraseT[x];
      if (t <= 0) continue;
      any = true; if (x < xa) xa = x; if (x > xb) xb = x;
      const next = t - 0.2;
      if (next <= 0) { for (let i = x; i < W * H; i += W) D[i] = 0; eraseT[x] = 0; }
      else { for (let i = x; i < W * H; i += W) D[i] *= 0.5; eraseT[x] = next; }
    }
    if (any) markDirty(xa, 0, xb + 1, H);
    eraseActive = any;
  }

  // ---- frame color ----
  const dots = [...root.querySelectorAll('[data-mb-color]')];
  function setColor(c, keep) {
    root.style.setProperty('--mb-frame', c);
    dots.forEach((d) => d.setAttribute('aria-pressed', String(d.dataset.mbColor === c)));
    if (keep) try { localStorage.setItem(COLOR_KEY, c); } catch { /* storage is optional */ }
  }
  dots.forEach((d) => on(d, 'click', () => { setColor(d.dataset.mbColor, true); sfx.click(); }));
  let savedColor = null;
  try { savedColor = localStorage.getItem(COLOR_KEY); } catch { /* storage is optional */ }
  setColor(savedColor && dots.some((d) => d.dataset.mbColor === savedColor) ? savedColor : dots[0].dataset.mbColor, false);

  // ---- sound: MarutiBit's shared switch, off unless it says "true" ----
  const audio = {
    ctx: null, on: false,
    // only ever built inside a press or a release, never on load
    ensure() {
      if (!this.on) return;
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.build();
      }
      if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    },
    build() {
      const c = this.ctx;
      this.master = c.createGain(); this.master.gain.value = 1;
      this.master.connect(c.destination);
      const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      const loop = (type, freq, q) => {
        const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
        const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
        const g = c.createGain(); g.gain.value = 0;
        src.connect(f); f.connect(g); g.connect(this.master); src.start();
        return { g, f };
      };
      this.pen = loop('bandpass', 2600, 0.9);
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      this.pen.f.disconnect(); this.pen.f.connect(hp); hp.connect(this.pen.g);
      this.sl = loop('lowpass', 1400, 0.7);
      this.gr = loop('bandpass', 5200, 0.6);
    },
    // a context brought back from the back/forward cache is thrown away, not woken
    reset() {
      if (this.ctx) this.ctx.close().catch(() => {});
      this.ctx = this.master = this.noise = this.pen = this.sl = this.gr = null;
      sfx.lastGrain = undefined;
    },
  };
  const snd = $('sound');
  function setSound(onNow) {
    audio.on = onNow;
    snd.setAttribute('aria-pressed', String(onNow));
    if (audio.master) audio.master.gain.value = onNow ? 1 : 0;
  }
  try { setSound(localStorage.getItem(SOUND_KEY) === 'true'); } catch { setSound(false); }
  on(snd, 'click', () => {
    setSound(!audio.on);
    try { localStorage.setItem(SOUND_KEY, audio.on ? 'true' : 'false'); } catch { /* storage is optional */ }
    audio.ensure();
    sfx.click();
  });
  on(window, 'pageshow', (e) => { if (e.persisted) audio.reset(); });

  const sfx = {
    scratch(dist) {
      if (!audio.pen) return;
      const t = audio.ctx.currentTime, v = Math.min(0.32, dist * 0.022);
      audio.pen.g.gain.setTargetAtTime(v, t, v ? 0.015 : 0.04);
      audio.pen.f.frequency.setTargetAtTime(2200 + Math.min(1800, dist * 90), t, 0.03);
    },
    slide(dist) {
      if (!audio.sl) return;
      const t = audio.ctx.currentTime, v = Math.min(0.45, dist * 0.03);
      audio.sl.g.gain.setTargetAtTime(v, t, v ? 0.015 : 0.05);
      audio.sl.f.frequency.setTargetAtTime(700 + Math.min(1600, dist * 60), t, 0.03);
    },
    burst(freq, q, dur, vol, type = 'bandpass') {
      const c = audio.ctx; if (!c || !audio.noise) return;
      const t = c.currentTime, src = c.createBufferSource(); src.buffer = audio.noise;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(audio.master);
      src.start(t, Math.random()); src.stop(t + dur + 0.02);
    },
    penDown() { this.burst(3200, 1.2, 0.04, 0.25); },
    click() { this.burst(2400, 2, 0.035, 0.18); },
    swish() { this.burst(1000, 0.7, 0.12, 0.3, 'lowpass'); },
    grains(n) {
      if (!audio.gr) return;
      const v = Math.min(0.2, n * 0.0008);
      if (v === this.lastGrain) return;
      this.lastGrain = v;
      audio.gr.g.gain.setTargetAtTime(v, audio.ctx.currentTime, 0.05);
    },
  };

  // ---- practice sheets (printed faintly under the screen) ----
  const lesson = { mode: 'free', hira: 0, shape: 0, math: null, answered: false };
  const nextBtn = $('next');
  const modeBtns = [...root.querySelectorAll('[data-mb-mode]')];
  const rand = (n) => Math.floor(Math.random() * n);
  const fontAsked = new Set();
  const font = (size) => `600 ${size}px "Klee One", "Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif`;
  function needFont(text) { // canvas text only shows the web font once that glyph slice is in
    const f = font(100);
    if (!document.fonts || fontAsked.has(text) || document.fonts.check(f, text)) return;
    fontAsked.add(text);
    document.fonts.load(f, text).then(() => { if (alive) drawGuide(); }).catch(() => {});
  }

  function newMath() {
    let q;
    do {
      if (Math.random() < 0.5) { const a = 1 + rand(9), b = 1 + rand(10 - a); q = { a, b, op: '+', ans: a + b }; }
      else { const a = 2 + rand(9), b = 1 + rand(a - 1); q = { a, b, op: '−', ans: a - b }; }
    } while (lesson.math && q.a === lesson.math.a && q.b === lesson.math.b && q.op === lesson.math.op);
    lesson.math = q; lesson.answered = false;
  }

  function sheetHira(g, w, h, m) {
    const ch = HIRA[lesson.hira], s = m * 0.78, x = (w - s) / 2, y = (h - s) / 2;
    needFont(ch);
    g.globalAlpha = 0.55; g.lineWidth = 2; g.strokeRect(x, y, s, s);
    g.globalAlpha = 0.4; g.setLineDash([7, 7]);
    g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2, y + s); g.moveTo(x, h / 2); g.lineTo(x + s, h / 2); g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 1; g.font = font(s * 0.8); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ch, w / 2, h / 2 - s * 0.03);
  }

  function sheetMath(g, w, h, m) {
    if (!lesson.math) newMath();
    const q = lesson.math, text = `${q.a} ${q.op} ${q.b} =`;
    needFont('0123456789+−=');
    g.font = font(100);
    const per = g.measureText(text).width / 100;
    const fs = Math.min(m * 0.2, (w * 0.86) / (per + 1.45));
    const box = fs * 1.15, gap = fs * 0.3, total = per * fs + gap + box;
    const x0 = (w - total) / 2, cy = h * 0.34;
    g.font = font(fs); g.textAlign = 'left'; g.textBaseline = 'middle'; g.globalAlpha = 1;
    g.fillText(text, x0, cy);
    const bx = x0 + per * fs + gap, by = cy - box / 2;
    g.globalAlpha = 0.6; g.lineWidth = 2.5; g.setLineDash([8, 6]);
    g.beginPath();
    if (g.roundRect) g.roundRect(bx, by, box, box, box * 0.14); else g.rect(bx, by, box, box);
    g.stroke();
    g.setLineDash([]);
    if (lesson.answered) {
      g.globalAlpha = 0.9; g.textAlign = 'center';
      g.fillText(String(q.ans), bx + box / 2, cy);
    }
    // counting dots: two groups to add, or one group with some crossed out to take away
    const sp = Math.min(m * 0.1, w * 0.08), r = sp * 0.34, top = h * 0.6;
    const group = (n, gx, crossFrom) => {
      for (let k = 0; k < n; k++) {
        const x = gx + (k % 5) * sp + sp / 2, y = top + Math.floor(k / 5) * sp + sp / 2;
        g.globalAlpha = 0.85; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        if (k >= crossFrom) {
          const c = r * 1.5;
          g.globalAlpha = 1; g.lineWidth = 3;
          g.beginPath(); g.moveTo(x - c, y - c); g.lineTo(x + c, y + c); g.moveTo(x + c, y - c); g.lineTo(x - c, y + c); g.stroke();
        }
      }
    };
    const colsW = (n) => Math.min(5, n) * sp;
    if (q.op === '+') {
      const gapW = sp * 1.2, all = colsW(q.a) + gapW + colsW(q.b), gx = (w - all) / 2;
      group(q.a, gx, Infinity);
      group(q.b, gx + colsW(q.a) + gapW, Infinity);
    } else group(q.a, (w - colsW(q.a)) / 2, q.a - q.b);
  }

  function sheetShape(g, w, h, m) {
    const kind = SHEET_SHAPES[lesson.shape], s = m * 0.62, cx = w / 2, cy = h / 2, R = s / 2;
    let start = null; // lines get a dot where the stroke begins
    g.globalAlpha = 1; g.lineWidth = Math.max(8, m * 0.026);
    g.beginPath();
    if (kind === 'circle') g.arc(cx, cy, R, 0, Math.PI * 2);
    else if (kind === 'triangle') { g.moveTo(cx, cy - R); g.lineTo(cx + R * 0.95, cy + R * 0.72); g.lineTo(cx - R * 0.95, cy + R * 0.72); g.closePath(); }
    else if (kind === 'square') g.rect(cx - R * 0.82, cy - R * 0.82, R * 1.64, R * 1.64);
    else if (kind === 'star') {
      for (let k = 0; k < 10; k++) {
        const rr = k % 2 ? R * 0.42 : R, t = -Math.PI / 2 + k * Math.PI / 5;
        if (k) g.lineTo(cx + rr * Math.cos(t), cy + R * 0.06 + rr * Math.sin(t));
        else g.moveTo(cx + rr * Math.cos(t), cy + R * 0.06 + rr * Math.sin(t));
      }
      g.closePath();
    } else if (kind === 'heart') {
      g.moveTo(cx, cy + R * 0.85);
      g.bezierCurveTo(cx - R * 1.35, cy - R * 0.05, cx - R * 0.6, cy - R * 1.05, cx, cy - R * 0.4);
      g.bezierCurveTo(cx + R * 0.6, cy - R * 1.05, cx + R * 1.35, cy - R * 0.05, cx, cy + R * 0.85);
    } else if (kind === 'wave' || kind === 'zigzag') {
      const x0 = w * 0.12, x1 = w * 0.88, amp = Math.min(h * 0.12, R * 0.35);
      for (let row = 0; row < 2; row++) {
        const y = cy + (row ? 1 : -1) * Math.min(h * 0.2, R * 0.8);
        if (kind === 'wave') {
          for (let k = 0; k <= 120; k++) {
            const t = k / 120, lx = x0 + (x1 - x0) * t, ly = y + Math.sin(t * Math.PI * 6) * amp;
            if (k) g.lineTo(lx, ly); else g.moveTo(lx, ly);
          }
        } else {
          for (let k = 0; k <= 8; k++) {
            const lx = x0 + (x1 - x0) * k / 8, ly = y + (k % 2 ? amp : -amp);
            if (k) g.lineTo(lx, ly); else g.moveTo(lx, ly);
          }
        }
        if (!row) start = [x0, kind === 'zigzag' ? y - amp : y];
      }
    } else if (kind === 'spiral') {
      const n = 300;
      for (let k = 0; k <= n; k++) {
        const t = k / n, a = t * 3 * Math.PI * 2, rr = R * t;
        if (k) g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); else g.moveTo(cx, cy);
      }
      start = [cx, cy];
    }
    g.globalAlpha = 0.75; g.stroke();
    if (start) { g.globalAlpha = 1; g.beginPath(); g.arc(start[0], start[1], g.lineWidth * 0.9, 0, Math.PI * 2); g.fill(); }
  }

  function drawGuide() {
    if (!G) return;
    G.fill(0);
    if (lesson.mode !== 'free') {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d');
      g.scale(scale, scale);
      g.fillStyle = g.strokeStyle = '#000';
      g.lineCap = g.lineJoin = 'round';
      const m = Math.min(cssW, cssH);
      if (lesson.mode === 'hira') sheetHira(g, cssW, cssH, m);
      else if (lesson.mode === 'math') sheetMath(g, cssW, cssH, m);
      else sheetShape(g, cssW, cssH, m);
      const d = g.getImageData(0, 0, W, H).data;
      for (let i = 0; i < G.length; i++) G[i] = d[i * 4 + 3];
    }
    markDirty(0, 0, W, H);
  }

  function updateNext() {
    nextBtn.disabled = lesson.mode === 'free';
    nextBtn.textContent = lesson.mode === 'math' && !lesson.answered ? 'こたえ' : 'つぎ';
  }

  // picking a kana: a row of 行 under the controls, then the sounds of that 行
  const kanaEl = $('kana');
  const gyouEl = $('gyou'), danEl = $('dan');
  const gyouOf = (ch) => GYOU.findIndex((g) => g.includes(ch));
  const kanaButton = (label, pick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', () => { lesson.hira = HIRA.indexOf(pick); syncKana(); drawGuide(); sfx.click(); });
    return b;
  };
  gyouEl.replaceChildren(...GYOU.map((g) => kanaButton(g[0], g[0])));
  function syncKana() {
    const ch = HIRA[lesson.hira], gi = gyouOf(ch);
    [...gyouEl.children].forEach((b, i) => b.setAttribute('aria-current', String(i === gi)));
    danEl.replaceChildren(...[...GYOU[gi]].map((c) => {
      const b = kanaButton(c, c);
      b.setAttribute('aria-current', String(c === ch));
      return b;
    }));
  }
  function setMode(mode) {
    lesson.mode = mode;
    modeBtns.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.mbMode === mode)));
    kanaEl.hidden = mode !== 'hira';
    if (mode === 'hira') syncKana();
    if (mode === 'math') newMath();
    updateNext();
    layout();
    drawGuide();
  }
  modeBtns.forEach((b) => on(b, 'click', () => { setMode(b.dataset.mbMode); sfx.click(); }));
  on(nextBtn, 'click', () => {
    if (lesson.mode === 'hira') { lesson.hira = (lesson.hira + 1) % HIRA.length; syncKana(); }
    else if (lesson.mode === 'shape') lesson.shape = (lesson.shape + 1) % SHEET_SHAPES.length;
    else if (lesson.mode === 'math') { if (!lesson.answered) lesson.answered = true; else newMath(); }
    updateNext(); drawGuide(); sfx.click();
  });

  // ---- loop ----
  let lastT = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
    lastT = now;
    stepErase();
    stepDwell(now);
    stepHaze(now);
    stepGrains(dt);
    render();
    raf = requestAnimationFrame(frame);
  }
  on(window, 'resize', layout);
  // a scrollbar turning up narrows the page without a window resize
  let seenWidth = root.clientWidth;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    if (root.clientWidth !== seenWidth) { seenWidth = root.clientWidth; layout(); }
  }) : null;
  if (ro) { ro.observe(root); offs.push(() => ro.disconnect()); }
  syncKana(); // the picker is filled from the start, hidden until a kana sheet asks for it
  setMode('free');
  raf = requestAnimationFrame(frame);

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    offs.forEach((off) => off());
    gyouEl.replaceChildren();
    danEl.replaceChildren();
    audio.reset();
  };
}
