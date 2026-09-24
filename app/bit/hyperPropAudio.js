// HYPER PROP sound: every effect and both loops are synthesized on one AudioContext,
// so there are no files to load and one switch covers everything.
//
// The context is only ever built inside a real user activation (keydown, mouse down,
// a touch being released). On iPhone a touch pressing down grants nothing, and a
// context minted outside activation can stay unresumable for good, so unlock() is
// called from those events only and every sound before it simply stays quiet.
export function createHyperPropAudio() {
  let ctx = null, master = null, sfx = null, music = null, delay = null, noiseBuf = null;
  let enabled = false, track = null, layer = 0, timer = null, nextStep = 0, step = 0;
  let prop = null, wind = null, roll = null;
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // overall loudness, measured: play peaks land around 0.7-0.9 through the limiter
  const LEVEL = 2.2;

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain(); master.gain.value = enabled ? LEVEL : 0;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -4; lim.knee.value = 6; lim.ratio.value = 8; lim.attack.value = 0.003; lim.release.value = 0.15;
    master.connect(lim).connect(ctx.destination);
    // effects sat on top of the loops on a phone; 0.7 is about 3dB under where they were
    sfx = ctx.createGain(); sfx.gain.value = 0.7; sfx.connect(master);
    // raised from 0.4 after the first listen on a phone: the loops sat too far under the effects
    music = ctx.createGain(); music.gain.value = 0.6; music.connect(master);
    // a little room on the chimes and the lead, nothing more
    delay = ctx.createDelay(0.5); delay.delayTime.value = 0.18;
    const fb = ctx.createGain(); fb.gain.value = 0.25; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000;
    delay.connect(fb).connect(lp).connect(delay); delay.connect(master);
    // a silent note that never stops, so the browser never idles the context between presses
    const keep = ctx.createOscillator(), kg = ctx.createGain(); kg.gain.value = 0.00001; keep.frequency.value = 30;
    keep.connect(kg).connect(ctx.destination); keep.start();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    buildLoops();
    if (track && !timer) startScheduler();
  }
  const live = () => enabled && ctx && ctx.state === 'running';

  // ---------- building blocks ----------
  function tone(o) {
    const at = o.at ?? ctx.currentTime, osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f, at);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, at + (o.slide ?? o.dur));
    if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 6; lg.gain.value = o.vib; l.connect(lg).connect(osc.frequency); l.start(at); l.stop(at + o.dur + 0.05); }
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(o.g, at + (o.attack ?? 0.005));
    if (o.hold) g.gain.setValueAtTime(o.g, at + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0003, at + o.dur);
    let tail = osc;
    if (o.cut) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(o.cut, at); if (o.cutTo) f.frequency.exponentialRampToValueAtTime(o.cutTo, at + o.dur); osc.connect(f); tail = f; }
    tail.connect(g).connect(o.bus || sfx);
    if (o.send) { const s = ctx.createGain(); s.gain.value = o.send; g.connect(s).connect(delay); }
    osc.start(at); osc.stop(at + o.dur + 0.05);
  }
  function noise(o) {
    const at = o.at ?? ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f, at); f.Q.value = o.q ?? 1;
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, at + o.dur);
    g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(o.g, at + (o.attack ?? 0.003));
    g.gain.exponentialRampToValueAtTime(0.0003, at + o.dur);
    src.connect(f).connect(g).connect(o.bus || sfx);
    src.start(at, Math.random() * 0.5); src.stop(at + o.dur + 0.05);
  }
  const seq = (notes, t0, len, o) => notes.forEach((m, i) => m && tone({ f: hz(m), at: t0 + i * len, dur: len * 0.95, ...o }));

  // ---------- continuous: propeller, wind, wheels on grass ----------
  function loopNoise(type, f, q) {
    const src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0;
    src.connect(fl).connect(g).connect(sfx); src.start();
    return { fl, g };
  }
  function buildLoops() {
    // the prop: a low buzz that pulses once per blade pass
    const osc = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), depth = ctx.createGain();
    osc.type = 'sawtooth'; osc.frequency.value = 40; fl.type = 'lowpass'; fl.frequency.value = 500; fl.Q.value = 2; g.gain.value = 0;
    lfo.type = 'triangle'; lfo.frequency.value = 8; depth.gain.value = 0;
    lfo.connect(depth).connect(g.gain);
    osc.connect(fl).connect(g).connect(sfx); osc.start(); lfo.start();
    prop = { osc, fl, g, lfo, depth };
    wind = loopNoise('bandpass', 500, 0.7);
    roll = loopNoise('lowpass', 180, 0.8);
  }
  // Called every game tick, but the loops only need retuning about 20 times a second.
  // Each retune is an automation event on the param's timeline; at 120 a second across
  // nine params Safari kept piling them up faster than it let them go, which is the kind
  // of load that turns into crackle. So: throttle, and clear what is queued before
  // setting the next target, so every timeline holds one event at a time.
  let lastEngine = 0;
  function engine(st) {
    if (!ctx || !prop) return;
    const t = ctx.currentTime;
    if (t - lastEngine < 0.05) return;
    lastEngine = t;
    const on = live() ? 1 : 0, set = (p, v, k = 0.06) => { p.cancelScheduledValues(t); p.setTargetAtTime(v, t, k); };
    const turning = on && (st.phase === 'roll' || st.phase === 'fly' || st.phase === 'clear');
    const w = st.phase === 'clear' ? 0.7 : st.omega;
    set(prop.osc.frequency, 38 + w * 70); set(prop.fl.frequency, 300 + w * 1100); set(prop.lfo.frequency, 4 + w * 26);
    const lv = turning ? 0.018 + w * 0.05 : 0;
    set(prop.g.gain, lv * 0.6); set(prop.depth.gain, lv * 0.4);
    const airborne = on && (st.phase === 'fly' || st.phase === 'clear' || st.phase === 'run');
    set(wind.fl.frequency, 300 + st.V * 22); set(wind.g.gain, airborne ? Math.max(0, Math.min(1, (st.V - 8) / 40)) * (st.phase === 'run' ? 0.03 : 0.07) : 0, 0.15);
    set(roll.g.gain, on && st.phase === 'roll' ? Math.min(1, st.V / 35) * 0.09 : 0, 0.05);
  }

  // ---------- effects ----------
  const fx = {
    start() { const t = ctx.currentTime; tone({ f: 988, dur: 0.07, g: 0.07, at: t }); tone({ f: 1319, dur: 0.3, g: 0.07, at: t + 0.07, send: 0.2 }); },
    step(side) { noise({ f: 170 + side * 30, type: 'lowpass', q: 1, dur: 0.07, g: 0.35 }); tone({ f: 95, to: 60, dur: 0.06, g: 0.12, type: 'sine' }); },
    board() { const t = ctx.currentTime; tone({ f: 330, to: 990, slide: 0.14, dur: 0.16, g: 0.07 }); noise({ f: 600, to: 2400, q: 0.9, dur: 0.3, g: 0.12, at: t + 0.12 }); },
    seated() { const t = ctx.currentTime; noise({ f: 160, type: 'lowpass', dur: 0.1, g: 0.4 }); tone({ f: 1319, dur: 0.07, g: 0.05, at: t + 0.06 }); tone({ f: 1760, dur: 0.14, g: 0.05, at: t + 0.12, send: 0.2 }); },
    pedal(w) { noise({ f: 3800, type: 'highpass', q: 0.7, dur: 0.025, g: 0.06 }); tone({ f: 1800 + w * 900, dur: 0.018, g: 0.018 }); },
    liftoff() { noise({ f: 400, to: 1800, q: 0.8, dur: 0.6, g: 0.12, attack: 0.15 }); },
    takeoff() { const t = ctx.currentTime; seq([74, 78, 81], t, 0.075, { g: 0.09, cut: 4000 }); tone({ f: hz(86), dur: 0.55, hold: 0.25, g: 0.09, at: t + 0.225, vib: 8, cut: 4000, send: 0.25 }); seq([69, 74, 78], t, 0.075, { g: 0.05, type: 'triangle' }); tone({ f: hz(81), dur: 0.55, g: 0.06, type: 'triangle', at: t + 0.225 }); },
    marker() { const t = ctx.currentTime; tone({ f: 1568, dur: 0.3, g: 0.09, type: 'sine', at: t, send: 0.3 }); tone({ f: 2093, dur: 0.45, g: 0.07, type: 'sine', at: t + 0.07, send: 0.3 }); },
    stall() { tone({ f: 988, dur: 0.09, g: 0.045, hold: 0.06 }); },
    tick() { tone({ f: 1319, dur: 0.08, g: 0.05, type: 'square' }); },
    splash() { const t = ctx.currentTime; noise({ f: 2600, to: 250, type: 'lowpass', q: 0.6, dur: 0.8, g: 0.3 }); for (let i = 0; i < 6; i++) tone({ f: 300 + Math.random() * 500, to: 900 + Math.random() * 600, dur: 0.06, g: 0.04, type: 'sine', at: t + 0.25 + i * 0.07 + Math.random() * 0.04 }); },
    fall() { tone({ f: 1100, to: 220, slide: 1.0, dur: 1.0, g: 0.07, type: 'sine', vib: 25 }); },
    fail() { const t = ctx.currentTime + 0.5; [69, 68, 67].forEach((m, i) => tone({ f: hz(m), dur: 0.2, g: 0.09, at: t + i * 0.22, cut: 2200 })); tone({ f: hz(66), dur: 0.8, hold: 0.3, g: 0.09, at: t + 0.66, cut: 2400, cutTo: 400, vib: 6 }); },
    goal() {
      const t = ctx.currentTime, b = 0.11;
      seq([74, 78, 81, 86], t, b, { g: 0.11, cut: 4200 });
      tone({ f: hz(83), dur: b * 1.9, g: 0.11, at: t + b * 4, cut: 4200 }); tone({ f: hz(86), dur: b, g: 0.11, at: t + b * 6, cut: 4200 });
      tone({ f: hz(90), dur: 1.1, hold: 0.5, g: 0.12, at: t + b * 7, vib: 7, cut: 4200, send: 0.3 });
      seq([62, 66, 69, 74], t, b, { g: 0.08, type: 'triangle' }); tone({ f: hz(50), dur: 1.4, g: 0.15, type: 'triangle', at: t + b * 7 });
      for (let i = 0; i < 6; i++) noise({ f: 1800, q: 0.9, dur: 0.06, g: 0.12, at: t + b * 4 + i * b * 0.5 });
    },
  };

  // ---------- music ----------
  // Both loops are in D major so the jingles and the chimes never clash with them.
  const bus = () => music;
  const lead = (m, at, len, g = 0.034) => tone({ f: hz(m), at, dur: len, g, cut: 3200, bus: bus(), send: 0.18, attack: 0.008 });
  const kick = (at) => tone({ f: 150, to: 55, dur: 0.16, g: 0.18, type: 'sine', at, bus: bus(), attack: 0.006 });
  const snare = (at) => { noise({ f: 1900, q: 0.8, dur: 0.12, g: 0.11, at, bus: bus() }); tone({ f: 190, to: 140, dur: 0.08, g: 0.05, type: 'triangle', at, bus: bus() }); };
  const hat = (at, g = 0.035) => noise({ f: 9000, type: 'highpass', q: 0.7, dur: 0.03, g, at, bus: bus() });
  const STAGE = {
    bpm: 132,
    chords: [[50, [62, 66, 69]], [45, [61, 64, 69]], [47, [62, 66, 71]], [43, [62, 67, 71]], [50, [62, 66, 69]], [45, [61, 64, 69]], [43, [62, 67, 71]], [45, [61, 64, 69]]],
    melody: [
      [[0, 69, 2], [2, 74, 2], [4, 78, 4], [8, 76, 2], [10, 74, 4], [14, 69, 2]],
      [[0, 73, 2], [2, 76, 2], [4, 81, 4], [8, 79, 2], [10, 78, 2], [12, 76, 4]],
      [[0, 74, 2], [2, 78, 2], [4, 83, 4], [8, 81, 2], [10, 78, 2], [12, 74, 4]],
      [[0, 71, 2], [2, 74, 2], [4, 79, 2], [6, 78, 2], [8, 76, 4], [12, 74, 2], [14, 76, 2]],
      [[0, 78, 4], [4, 76, 2], [6, 74, 2], [8, 69, 2], [10, 74, 2], [12, 78, 2], [14, 81, 2]],
      [[0, 81, 4], [4, 79, 1], [5, 78, 1], [6, 76, 2], [8, 73, 4], [12, 76, 4]],
      [[0, 74, 2], [2, 79, 2], [4, 83, 4], [8, 81, 2], [10, 79, 2], [12, 78, 2], [14, 76, 2]],
      [[0, 76, 8], [8, 73, 2], [10, 76, 2], [12, 81, 4]],
    ],
    play(i, at, beat) {
      const bar = Math.floor(i / 16) % 8, s = i % 16, [root, triad] = this.chords[bar], sx = beat / 4;
      // running: drums and bass. seated: chord stabs join. flying: the tune.
      if (s % 4 === 0 || s % 4 === 2) tone({ f: hz(root + (s % 4 === 2 ? 12 : 0)), at, dur: sx * 1.8, g: 0.1, type: 'triangle', bus: bus(), attack: 0.012 });
      if (s === 0 || s === 8 || s === 11) kick(at);
      if (s === 4 || s === 12) snare(at);
      if (s % 2 === 0) hat(at, s % 4 === 0 ? 0.03 : 0.045);
      if (layer >= 1 && (s === 2 || s === 6 || s === 10 || s === 14)) triad.forEach((m) => tone({ f: hz(m), at, dur: sx * 1.2, g: 0.014, cut: 1800, bus: bus() }));
      if (layer >= 2) for (const [st, m, len] of this.melody[bar]) if (st === s) lead(m, at, sx * len * 0.9);
    },
  };
  const TITLE = {
    bpm: 92,
    chords: [[50, [62, 66, 69]], [47, [62, 66, 71]], [43, [62, 67, 71]], [45, [61, 64, 69]]],
    melody: [[[0, 78, 6], [6, 76, 2], [8, 74, 8]], [[0, 74, 4], [4, 78, 4], [8, 81, 8]], [[0, 79, 6], [6, 78, 2], [8, 76, 8]], [[0, 76, 4], [4, 73, 4], [8, 69, 8]]],
    play(i, at, beat) {
      const bar = Math.floor(i / 16) % 4, s = i % 16, [root, triad] = this.chords[bar], sx = beat / 4;
      if (s === 0) { tone({ f: hz(root), at, dur: beat * 3.8, g: 0.21, type: 'triangle', bus: bus(), attack: 0.05 }); triad.forEach((m) => tone({ f: hz(m), at, dur: beat * 3.6, g: 0.04, type: 'sine', bus: bus(), attack: 0.4 })); }
      if (s % 2 === 0) tone({ f: hz(triad[(s / 2) % 3] + 12), at, dur: sx * 1.6, g: 0.065, type: 'sine', bus: bus(), send: 0.25 });
      for (const [st, m, len] of this.melody[bar]) if (st === s) tone({ f: hz(m), at, dur: sx * len * 0.95, g: 0.12, type: 'triangle', bus: bus(), vib: 3, attack: 0.02, send: 0.2 });
    },
  };
  const TRACKS = { stage: STAGE, title: TITLE };
  function tick() {
    if (!track || !live()) return;
    const tr = TRACKS[track], sx = 60 / tr.bpm / 4;
    if (nextStep < ctx.currentTime) nextStep = ctx.currentTime + 0.05;
    while (nextStep < ctx.currentTime + 0.2) { tr.play(step, nextStep, 60 / tr.bpm); step = (step + 1) % 128; nextStep += sx; }
  }
  function startScheduler() { nextStep = ctx.currentTime + 0.08; if (!timer) timer = setInterval(tick, 50); }

  return {
    get enabled() { return enabled; },
    // call from keydown, mousedown, or a touch being released
    unlock() {
      if (!enabled) return;
      ensure();
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
    },
    setEnabled(on) {
      enabled = on;
      if (ctx) master.gain.setTargetAtTime(on ? LEVEL : 0, ctx.currentTime, 0.03);
    },
    play(name, arg) { if (live() && fx[name]) fx[name](arg); },
    engine,
    music(name, lay = 0) {
      layer = lay;
      if (name === track) return;
      track = name; step = 0;
      if (!name) { clearInterval(timer); timer = null; return; }
      if (ctx) startScheduler();
    },
    layer(n) { layer = n; },
    // hidden tab: stop the clock; coming back, try to carry on (sticky activation usually allows it)
    sleep() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    wake() { if (ctx && enabled && ctx.state !== 'running') ctx.resume().catch(() => {}); },
    // restored from the back/forward cache: the old context may be frozen for good, so throw it away
    reset() {
      clearInterval(timer); timer = null;
      if (ctx) ctx.close().catch(() => {});
      ctx = null; prop = wind = roll = null;
    },
    // leaving the page: nothing may keep playing or scheduling
    dispose() { track = null; this.reset(); },
  };
}
