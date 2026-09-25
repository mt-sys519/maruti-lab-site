// NEON BREAK sound engine. One AudioContext, built lazily on the first user
// gesture (mobile autoplay policies), with a distinct synthesized voice per
// game event instead of a single reused beep.

export type MusicTrack = 'solo' | 'cpu' | 'stage' | null;

type Engine = {
  cueStrike: (power: number) => void;
  collision: (impact: number, a: number, b: number) => void;
  rail: (impact: number) => void;
  pocket: (ballId: number) => void;
  shield: () => void;
  foul: () => void;
  win: () => void;
  armPower: () => void;
  powerFire: () => void;
  pullTick: (norm: number, armed: boolean) => void;
  uiClick: () => void;
  setMusic: (track: MusicTrack) => void;
  motion: (moving: boolean) => void;
  unlock: () => void;
  setMuted: (muted: boolean) => void;
  dispose: () => void;
};

export function createBreakAudio(): Engine {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  // Effects sit on their own bus so the BGM level can move without dragging
  // every cue strike and pocket with it. They were both landing straight on
  // the master, which meant the only balance knob was the music's own gain -
  // and pushing that up quietly ate the effects twice over: once by simple
  // masking, once because a loud continuous loop keeps the master limiter
  // engaged, so every transient arrives with less headroom than it asks for.
  let sfx: GainNode | null = null;
  let delay: DelayNode | null = null;
  let muted = false;
  let lastCollision = -Infinity,
    lastRail = -Infinity,
    // Audio-clock time the last wind-up tick was scheduled for. A fast pull
    // crosses every step in under a tenth of a second, and eight ticks piled
    // on the same instant is one noise, not a wind-up.
    lastPull = -Infinity;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn();
    }, ms);
    timers.add(timer);
  };

  function ensure() {
    if (ctx) return;
    ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    )({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.65;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 12;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;
    master.connect(limiter).connect(ctx.destination);
    sfx = ctx.createGain();
    sfx.gain.value = 1.45;
    sfx.connect(master);

    // Short slap-back delay - gives every hit a bit of "arena" space instead
    // of sounding like it's coming from a phone speaker.
    delay = ctx.createDelay(0.5);
    delay.delayTime.value = 0.14;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.22;
    const delayFilter = ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 8800;
    delay.connect(feedback);
    feedback.connect(delayFilter);
    delayFilter.connect(delay);
    delay.connect(master);

    // Keeps the context perpetually "producing audio" so the browser never
    // auto-suspends it during a slow, careful aim - which is exactly the
    // recurring-delay case pointerdown-unlock can't fix for touch: per the
    // WHATWG "activation triggering input event" rule, pointerdown only
    // grants activation for mouse input, not touch (touch only gets it on
    // pointerup/touchend) - so on a phone, that early-unlock call landed on
    // an event with no activation to spend, and resume() was silently
    // stuck until release, i.e. the exact moment the shot needs to play.
    // A silent-but-nonzero oscillator that never stops removes the need for
    // any of that: once the context is running at all, it just never goes
    // idle long enough to be auto-suspended again for the rest of the
    // session, so only the very first sound of a session can ever pay a
    // resume cost.
    const keepAlive = ctx.createOscillator();
    const keepAliveGain = ctx.createGain();
    keepAliveGain.gain.value = 0.00001;
    keepAlive.frequency.value = 30;
    keepAlive.connect(keepAliveGain).connect(ctx.destination);
    keepAlive.start();
  }

  function resume() {
    ensure();
    if (ctx!.state === 'suspended') void ctx!.resume();
  }

  // One shared noise buffer, generated once and reused for every transient -
  // a break shot can fire a dozen+ collisions within a couple of frames, and
  // allocating + filling a fresh Float32Array (the old per-call
  // ctx.createBuffer + Math.random() loop) that many times in a burst was
  // real synchronous work landing all at once, which is what read as sound
  // lagging behind the balls during a break specifically. A BufferSourceNode
  // is cheap to create per call; only the underlying buffer needed caching.
  let noiseBuffer: AudioBuffer | null = null;
  function getNoiseBuffer() {
    if (noiseBuffer) return noiseBuffer;
    const dur = 0.15;
    noiseBuffer = ctx!.createBuffer(
      1,
      Math.ceil(ctx!.sampleRate * dur),
      ctx!.sampleRate,
    );
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }
  function noiseBurst() {
    const src = ctx!.createBufferSource();
    src.buffer = getNoiseBuffer();
    return src;
  }

  // A tight transient click - the actual "thock" of ball-on-ball or cue tip
  // contact - built from filtered noise, not a tone, so it reads as an
  // impact rather than a musical note.
  function click(opts: {
    freq: number;
    dur: number;
    gain: number;
    toDelay?: number;
  }) {
    if (muted) return;
    resume();
    const now = ctx!.currentTime;
    const noise = noiseBurst();
    const filt = ctx!.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = opts.freq;
    filt.Q.value = 1.1;
    const g = ctx!.createGain();
    g.gain.setValueAtTime(opts.gain, now);
    g.gain.exponentialRampToValueAtTime(0.0008, now + opts.dur);
    noise.connect(filt).connect(g);
    g.connect(sfx!);
    if (opts.toDelay) {
      const dg = ctx!.createGain();
      dg.gain.value = opts.toDelay;
      g.connect(dg).connect(delay!);
    }
    noise.start(now);
    noise.stop(now + opts.dur + 0.02);
  }

  // Ball-on-ball "clack". Still noise-first, as it has been since the bell
  // and chord versions read as synth notes rather than contact - but the
  // noise used to be centred at 2.2x a 4-7kHz base, i.e. 9-15kHz, which on
  // a phone speaker is a hiss with no knock in it. Real ball contact peaks
  // around 2-4kHz, so the burst sits there now, with a very short tonal body
  // under it for the hardness and only a trace of the glass on top.
  function clack(o: { freq: number; body: number; gain: number; dur: number }) {
    if (muted) return;
    resume();
    const now = ctx!.currentTime;
    const noise = noiseBurst();
    const nf = ctx!.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = o.freq;
    nf.Q.value = 1.4;
    const ng = ctx!.createGain();
    ng.gain.setValueAtTime(0.0001, now);
    ng.gain.linearRampToValueAtTime(o.gain, now + 0.0012);
    ng.gain.exponentialRampToValueAtTime(0.0005, now + o.dur);
    noise.connect(nf).connect(ng).connect(sfx!);
    noise.start(now);
    noise.stop(now + o.dur + 0.02);
    (
      [
        [o.body, 0.55, Math.min(0.045, o.dur)],
        [o.body * 4.6, 0.1, 0.022],
      ] as const
    ).forEach(([f, level, d]) => {
      const osc = ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      const g = ctx!.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(o.gain * level, now + 0.0015);
      g.gain.exponentialRampToValueAtTime(0.0003, now + d);
      osc.connect(g).connect(sfx!);
      osc.start(now);
      osc.stop(now + d + 0.02);
    });
  }
  // ---------------------------------------------------------------- music
  // There is no song. Pool is aiming, striking and then watching the balls
  // until they stop, and a looping track with a beat talks over exactly the
  // part that needs quiet. So the table is the instrument: a held chord sits
  // under the game - low while you aim, opening up while balls are moving -
  // and every ball-on-ball contact rings a note out of that chord. A break
  // scatters the chord across the felt; a clean shot plays a short phrase.
  // Each shot moves the harmony on to the next chord, and each operator has
  // her own set of chords and her own timbre for the held part.
  //
  // Every chord stays inside C major / A minor, so the pocket bells (A minor
  // pentatonic) always sit in whatever is being held.
  let music: GainNode | null = null;
  let reverbIn: GainNode | null = null;
  let bedLevel: GainNode | null = null;
  let bedFilter: BiquadFilterNode | null = null;
  let bedVoices: { fade: (at: number, over: number) => void }[] = [];
  let musicTrack: MusicTrack = null;
  let chordIndex = 0;
  let moving = false;
  let recentHits: number[] = [];
  let chordStart = 0;
  let melodyTimer: ReturnType<typeof setInterval> | null = null;
  let nextStep = 0;
  let walk = 3;
  let phraseLeft = 4;
  let restLeft = 2;
  const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

  // Shared room. SFX bells use it too, so it returns to the master rather
  // than through the music bus.
  function space() {
    if (reverbIn) return reverbIn;
    const c = ctx!;
    const seconds = 2.8,
      len = Math.floor(c.sampleRate * seconds);
    const impulse = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = impulse.getChannelData(ch);
      for (let i = 0; i < len; i++)
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.4);
    }
    reverbIn = c.createGain();
    const low = c.createBiquadFilter();
    low.type = 'highpass';
    low.frequency.value = 280;
    const conv = c.createConvolver();
    conv.buffer = impulse;
    const damp = c.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 6000;
    const ret = c.createGain();
    ret.gain.value = 0.8;
    reverbIn.connect(low).connect(conv).connect(damp).connect(ret).connect(master!);
    return reverbIn;
  }

  // A bell: a sine with a quicker octave and a faint inharmonic partial on
  // top. Used by the stage loop and by the pocket and win effects, so the
  // game's rewards sound like they belong to the same record as its music.
  function bell(o: {
    freq: number;
    at: number;
    gain: number;
    dur?: number;
    out: AudioNode;
    wet?: number;
    wetTo?: AudioNode;
    pan?: number;
  }) {
    const c = ctx!;
    const dur = o.dur ?? 1.2;
    const g = c.createGain();
    let out: AudioNode = g;
    if (o.pan) {
      const p = c.createStereoPanner();
      p.pan.value = o.pan;
      g.connect(p);
      out = p;
    }
    out.connect(o.out);
    if (o.wet && o.wetTo) {
      const s = c.createGain();
      s.gain.value = o.wet;
      out.connect(s).connect(o.wetTo);
    }
    (
      [
        [1, 1, dur],
        [2, 0.32, dur * 0.45],
        [4.07, 0.08, dur * 0.18],
      ] as const
    ).forEach(([ratio, level, d]) => {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = o.freq * ratio;
      const pg = c.createGain();
      pg.gain.setValueAtTime(0, o.at);
      pg.gain.linearRampToValueAtTime(o.gain * level, o.at + 0.004);
      pg.gain.exponentialRampToValueAtTime(0.0001, o.at + d);
      osc.connect(pg).connect(g);
      osc.start(o.at);
      osc.stop(o.at + d + 0.05);
    });
  }

  type Palette = {
    // First note of each chord is the bass. Kept in the second octave and
    // up: a held sine down around 40-60Hz that never changes is the sound of
    // every horror film's empty corridor, which is what the first pass
    // turned into.
    chords: number[][];
    wave: OscillatorType;
    voiceGain: number;
    cutoffIdle: number;
    cutoffMoving: number;
    wet: number;
    // The slow melody over the chord, and how long each chord is held while
    // nobody is shooting.
    bpm: number;
    chordBeats: number;
    melody: 'keys' | 'pluck' | 'bell';
  };
  const PALETTES: Record<Exclude<MusicTrack, null>, Palette> = {
    // AOI: cool and open. Cmaj9 - Fmaj9 - Am7 - G6.
    solo: {
      chords: [
        [48, 55, 59, 62, 64],
        [41, 57, 60, 64, 67],
        [45, 55, 60, 64, 67],
        [43, 55, 59, 62, 64],
      ],
      wave: 'triangle',
      voiceGain: 0.02,
      cutoffIdle: 1100,
      cutoffMoving: 2400,
      wet: 0.55,
      bpm: 76,
      chordBeats: 8,
      melody: 'keys',
    },
    // AIKA: brighter and higher, a touch of edge in the timbre.
    // Fmaj9 - G6 - Em7 - Am(add9).
    cpu: {
      chords: [
        [41, 53, 57, 60, 64, 67],
        [43, 55, 59, 62, 64, 67],
        [40, 52, 55, 59, 62, 67],
        [45, 57, 60, 64, 71, 72],
      ],
      wave: 'sawtooth',
      voiceGain: 0.02,
      cutoffIdle: 900,
      cutoffMoving: 2000,
      wet: 0.45,
      bpm: 96,
      chordBeats: 8,
      melody: 'pluck',
    },
    // LUNA: pure sines, far away. Am9 - Fmaj9 - Cmaj7 - G6.
    stage: {
      chords: [
        [45, 52, 59, 60, 64],
        [41, 55, 57, 60, 64],
        [48, 52, 55, 59, 62],
        [43, 55, 59, 62, 64],
      ],
      wave: 'sine',
      voiceGain: 0.026,
      cutoffIdle: 1600,
      cutoffMoving: 3000,
      wet: 0.8,
      bpm: 64,
      chordBeats: 8,
      melody: 'bell',
    },
  };
  const palette = () => PALETTES[musicTrack ?? 'solo'];
  const chord = () => {
    const cs = palette().chords;
    return cs[chordIndex % cs.length];
  };

  const IDLE_LEVEL = 0.4;
  function levelFor() {
    if (document.hidden) return 0;
    return moving ? 1 : IDLE_LEVEL;
  }
  function onVisibility() {
    if (!ctx || !bedLevel) return;
    bedLevel.gain.setTargetAtTime(levelFor(), ctx.currentTime, 0.15);
  }

  function musicBus() {
    if (music) return music;
    const c = ctx!;
    music = c.createGain();
    music.gain.value = 1;
    music.connect(master!);
    bedLevel = c.createGain();
    bedLevel.gain.value = 0;
    bedFilter = c.createBiquadFilter();
    bedFilter.type = 'lowpass';
    bedFilter.Q.value = 0.5;
    bedFilter.frequency.value = palette().cutoffIdle;
    bedFilter.connect(bedLevel).connect(music);
    // The held chord drifts: a very slow sweep on the filter so it is never
    // quite the same sound twice, without anything you would call movement.
    const drift = c.createOscillator();
    drift.frequency.value = 0.06;
    const driftDepth = c.createGain();
    driftDepth.gain.value = 180;
    drift.connect(driftDepth).connect(bedFilter.frequency);
    drift.start();
    const wet = c.createGain();
    wet.gain.value = 0.6;
    bedLevel.connect(wet).connect(space());
    document.addEventListener('visibilitychange', onVisibility);
    return music;
  }

  // Bring in the current chord and fade out whatever was held before it.
  function playChord(fadeIn: number) {
    const c = ctx!;
    musicBus();
    const now = c.currentTime;
    chordStart = now;
    for (const v of bedVoices) v.fade(now, 1.8);
    const p = palette();
    bedVoices = chord().map((midi, k) => {
      const bass = k === 0;
      const g = c.createGain();
      const level = bass ? p.voiceGain * 1.4 : p.voiceGain;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(level, now + fadeIn);
      const pan = c.createStereoPanner();
      pan.pan.value = bass ? 0 : ((k % 2 ? 1 : -1) * (0.2 + k * 0.08));
      g.connect(pan).connect(bedFilter!);
      const oscs = (bass ? [0] : [-5, 5]).map((cents) => {
        const o = c.createOscillator();
        o.type = bass ? 'sine' : p.wave;
        o.frequency.value = hz(midi);
        o.detune.value = cents;
        o.connect(g);
        o.start(now);
        return o;
      });
      return {
        fade(at: number, over: number) {
          g.gain.cancelScheduledValues(at);
          g.gain.setValueAtTime(g.gain.value, at);
          g.gain.linearRampToValueAtTime(0, at + over);
          for (const o of oscs) o.stop(at + over + 0.05);
        },
      };
    });
  }

  function startBed() {
    if (!musicTrack || muted) return;
    resume();
    musicBus();
    const now = ctx!.currentTime;
    bedFilter!.frequency.setTargetAtTime(
      moving ? palette().cutoffMoving : palette().cutoffIdle,
      now,
      0.2,
    );
    bedLevel!.gain.setTargetAtTime(levelFor(), now, 0.6);
    playChord(1.5);
    nextStep = now + 1.2;
    if (!melodyTimer) melodyTimer = setInterval(melodyTick, 100);
  }
  function stopBed() {
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const v of bedVoices) v.fade(now, 0.6);
    bedVoices = [];
    if (melodyTimer) clearInterval(melodyTimer);
    melodyTimer = null;
  }

  // Ball-on-ball: a clean, ringing tone taken from the chord being held,
  // with the edges that make it read as not-quite-of-this-world - two sines a
  // few hertz apart so the ring shimmers as it fades, a tiny downward chirp
  // on the attack, a glassy partial on top and a digital echo behind. Which
  // note comes from the pair of balls, so the same two balls always meet on
  // the same note within a chord; a harder hit rings longer and louder and
  // reaches into the upper octave.
  function chime(impact: number, a: number, b: number) {
    if (muted) return;
    resume();
    const c = ctx!;
    const now = c.currentTime;
    const norm = Math.min(1, impact / 40);
    const pcs = [...new Set(chord().slice(1).map((m) => m % 12))];
    const pool: number[] = [];
    for (const base of [72, 84])
      for (const pc of pcs) {
        const m = base + pc;
        if (m >= 76 && m <= 98) pool.push(m);
      }
    pool.sort((x, y) => x - y);
    const half = Math.floor(pool.length / 2);
    const pick = (a * 3 + b * 5 + chordIndex) % half;
    const midi = pool[norm > 0.55 ? pick + half : pick];
    const f = hz(midi);
    // A break fires a dozen of these at once; thin them out so it scatters
    // instead of piling up into one loud smear.
    const t = performance.now();
    recentHits = recentHits.filter((x) => t - x < 220);
    recentHits.push(t);
    const density = 1 / Math.sqrt(1 + (recentHits.length - 1) * 0.6);
    const gain = (0.05 + norm * 0.13) * density;
    const ring = 0.35 + norm * 0.75;

    const out = c.createStereoPanner();
    out.pan.value = ((a * 7 + b * 3) % 9) / 9 - 0.45;
    out.connect(sfx!);
    const wet = c.createGain();
    wet.gain.value = 0.35;
    out.connect(wet).connect(space());
    const echoSend = c.createGain();
    echoSend.gain.value = 0.16;
    out.connect(echoSend).connect(delay!);

    const partial = (
      freq: number,
      level: number,
      dur: number,
      glideFrom?: number,
    ) => {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(glideFrom ?? freq, now);
      if (glideFrom) o.frequency.exponentialRampToValueAtTime(freq, now + 0.035);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(gain * level, now + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.connect(g).connect(out);
      o.start(now);
      o.stop(now + dur + 0.05);
    };
    partial(f, 0.55, ring);
    partial(f + 3.1, 0.45, ring * 0.85);
    partial(f * 2.76, 0.16, 0.14);
    partial(f, 0.3, 0.06, f * 1.9);
    // The point of contact, so it still reads as a hit and not just a note.
    const n = noiseBurst();
    const nf = c.createBiquadFilter();
    nf.type = 'highpass';
    nf.frequency.value = 5200;
    const ng = c.createGain();
    ng.gain.setValueAtTime(gain * 0.5, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);
    n.connect(nf).connect(ng).connect(out);
    n.start(now);
    n.stop(now + 0.03);
  }

  // The melody over the held chord: one voice per operator.
  function melodyNote(midi: number, at: number, gain: number) {
    const c = ctx!;
    const p = palette();
    const f = hz(midi);
    const out = c.createStereoPanner();
    out.pan.value = ((midi % 7) - 3) * 0.1;
    out.connect(music!);
    const wet = c.createGain();
    wet.gain.value = p.wet * 0.7;
    out.connect(wet).connect(space());
    if (p.melody === 'bell') {
      bell({ freq: f, at, gain, dur: 2.4, out });
      return;
    }
    if (p.melody === 'pluck') {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3000, at);
      lp.frequency.exponentialRampToValueAtTime(380, at + 0.4);
      const g = c.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(gain * 0.8, at + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
      o.connect(lp).connect(g).connect(out);
      const echoSend = c.createGain();
      echoSend.gain.value = 0.3;
      g.connect(echoSend).connect(delay!);
      o.start(at);
      o.stop(at + 0.55);
      return;
    }
    // Keys: a soft electric-piano-ish tone, sine body with a quick octave.
    (
      [
        [1, 1, 1.6],
        [2, 0.22, 0.35],
        [3, 0.06, 0.15],
      ] as const
    ).forEach(([ratio, level, d]) => {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * ratio;
      const g = c.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(gain * level, at + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, at + d);
      o.connect(g).connect(out);
      o.start(at);
      o.stop(at + d + 0.05);
    });
  }

  // A slow walk over the chord's own notes, in short phrases with rests
  // between, so something is always gently happening without it turning into
  // a tune you would notice looping. While balls are moving it mostly steps
  // aside - the collisions are the melody then. And when nobody has shot for
  // a while the chord moves on by itself instead of hanging forever.
  function melodyTick() {
    if (!ctx || !musicTrack || muted || ctx.state !== 'running') return;
    if (document.hidden) return;
    const p = palette();
    const stepDur = 60 / p.bpm / 2;
    if (nextStep < ctx.currentTime) nextStep = ctx.currentTime + 0.05;
    while (nextStep < ctx.currentTime + 0.35) {
      const at = nextStep;
      nextStep += stepDur;
      if (!moving && at - chordStart > (60 / p.bpm) * p.chordBeats) {
        chordIndex++;
        playChord(1.4);
        chordStart = at;
      }
      if (restLeft > 0) {
        restLeft--;
        continue;
      }
      const onBeat = Math.round((at - chordStart) / stepDur) % 2 === 0;
      const chance = (onBeat ? 0.7 : 0.3) * (moving ? 0.35 : 1);
      if (Math.random() > chance) continue;
      const pcs = [...new Set(chord().slice(1).map((m) => m % 12))];
      const pool: number[] = [];
      for (const base of [60, 72, 84])
        for (const pc of pcs) {
          const m = base + pc;
          if (m >= 67 && m <= 88) pool.push(m);
        }
      pool.sort((x, y) => x - y);
      const steps = [-2, -1, -1, 1, 1, 2];
      walk += steps[Math.floor(Math.random() * steps.length)];
      if (walk < 0) walk = 1;
      if (walk >= pool.length) walk = pool.length - 2;
      melodyNote(pool[walk], at, 0.04 + Math.random() * 0.015);
      phraseLeft--;
      if (phraseLeft <= 0) {
        phraseLeft = 3 + Math.floor(Math.random() * 4);
        restLeft = 4 + Math.floor(Math.random() * 7);
      }
    }
  }

  function setMoving(next: boolean) {
    moving = next;
    if (!ctx || !bedLevel || !bedFilter) return;
    const now = ctx.currentTime;
    const p = palette();
    // Opens quickly on the strike, settles slowly once the table is still.
    bedLevel.gain.setTargetAtTime(levelFor(), now, next ? 0.12 : 1.2);
    bedFilter.frequency.setTargetAtTime(
      next ? p.cutoffMoving : p.cutoffIdle,
      now,
      next ? 0.15 : 1.4,
    );
  }

  function tone(opts: {
    freq: number;
    dur: number;
    gain: number;
    type?: OscillatorType;
    toDelay?: number;
  }) {
    if (muted) return;
    resume();
    const now = ctx!.currentTime;
    const osc = ctx!.createOscillator();
    osc.type = opts.type ?? 'triangle';
    osc.frequency.setValueAtTime(opts.freq, now);
    const g = ctx!.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(opts.gain, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0006, now + opts.dur);
    osc.connect(g);
    g.connect(sfx!);
    if (opts.toDelay) {
      const dg = ctx!.createGain();
      dg.gain.value = opts.toDelay;
      g.connect(dg).connect(delay!);
    }
    osc.start(now);
    osc.stop(now + opts.dur + 0.02);
  }

  return {
    // Cue strike: the leather tip on the cue ball - a duller, rounder knock
    // than ball-on-ball, harder and brighter as the shot gets stronger.
    cueStrike(power: number) {
      const norm = Math.min(1, power / 60);
      chordIndex++;
      if (musicTrack && !muted && ctx) playChord(0.25);
      clack({
        freq: 1300 + norm * 900,
        body: 820 + norm * 260,
        gain: 0.12 + norm * 0.1,
        dur: 0.04 + norm * 0.02,
      });
    },
    // Ball-ball collision, with pitch, level and length all tracking the
    // impact so a glancing kiss and a full carom sound different.
    collision(impact: number, a: number, b: number) {
      const now = performance.now();
      if (impact < 0.8 || now - lastCollision < 18) return;
      lastCollision = now;
      chime(impact, a, b);
    },
    // Cushion - softer and duller than a ball hit.
    rail(impact: number) {
      const now = performance.now();
      if (impact < 1 || now - lastRail < 35) return;
      lastRail = now;
      const norm = Math.min(1, impact / 30);
      clack({
        freq: 900 + norm * 500,
        body: 420 + norm * 120,
        gain: 0.05 + norm * 0.1,
        dur: 0.06 + norm * 0.03,
      });
    },
    // Pocket: the ball is pulled into the void (a short falling sweep, the
    // sound of the motes spiralling in) and a bell answers. The bells climb
    // the A minor pentatonic by ball number - notes all three loops share -
    // so a run of pots plays upward over whichever track is on, and the 9
    // lands with a fourth under it.
    pocket(ballId: number) {
      if (muted) return;
      resume();
      const now = ctx!.currentTime;
      const src = noiseBurst();
      const f = ctx!.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 2.5;
      f.frequency.setValueAtTime(3200, now);
      f.frequency.exponentialRampToValueAtTime(380, now + 0.15);
      const g = ctx!.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.12, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0004, now + 0.15);
      src.connect(f).connect(g).connect(sfx!);
      src.start(now);
      src.stop(now + 0.16);
      const SCALE = [69, 72, 74, 76, 79, 81, 84, 86, 88];
      const midi = SCALE[Math.max(0, Math.min(8, ballId - 1))];
      const at = now + 0.07;
      const room = space();
      bell({ freq: hz(midi), at, gain: 0.15, dur: 1.4, out: sfx!, wet: 0.4, wetTo: room });
      if (ballId === 9)
        bell({ freq: hz(midi - 5), at: at + 0.06, gain: 0.11, dur: 1.8, out: sfx!, wet: 0.5, wetTo: room });
    },
    // Power-shot cue shield bouncing off a pocket rim - an electric zap, the
    // one sound in the palette that isn't felt/mechanical.
    shield() {
      if (muted) return;
      resume();
      const now = ctx!.currentTime;
      const osc = ctx!.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(7200, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      const g = ctx!.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.12, now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0006, now + 0.14);
      const filt = ctx!.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 4800;
      osc.connect(filt).connect(g).connect(sfx!);
      osc.start(now);
      osc.stop(now + 0.16);
    },
    // Foul: the table powering down for a moment - a detuned pair sliding
    // down an octave with its filter closing, over a brief crackle. It has to
    // read as "that was wrong" at once, but a square-wave buzzer made the
    // whole game sound like a cheap one.
    foul() {
      if (muted) return;
      resume();
      const now = ctx!.currentTime;
      const f = ctx!.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 3;
      f.frequency.setValueAtTime(2200, now);
      f.frequency.exponentialRampToValueAtTime(260, now + 0.42);
      const g = ctx!.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.1, now + 0.01);
      g.gain.setValueAtTime(0.1, now + 0.2);
      g.gain.exponentialRampToValueAtTime(0.0005, now + 0.45);
      f.connect(g).connect(sfx!);
      [-14, 14].forEach((cents) => {
        const osc = ctx!.createOscillator();
        osc.type = 'sawtooth';
        osc.detune.value = cents;
        osc.frequency.setValueAtTime(hz(64), now);
        osc.frequency.exponentialRampToValueAtTime(hz(52), now + 0.4);
        osc.connect(f);
        osc.start(now);
        osc.stop(now + 0.47);
      });
      const src = noiseBurst();
      const nf = ctx!.createBiquadFilter();
      nf.type = 'bandpass';
      nf.frequency.value = 1500;
      const ng = ctx!.createGain();
      ng.gain.setValueAtTime(0.05, now);
      ng.gain.exponentialRampToValueAtTime(0.0005, now + 0.1);
      src.connect(nf).connect(ng).connect(sfx!);
      src.start(now);
      src.stop(now + 0.12);
    },
    // Win: the pentatonic bells run up and settle on a chord in the room.
    win() {
      if (muted) return;
      resume();
      const now = ctx!.currentTime;
      const room = space();
      [72, 76, 79, 84, 88].forEach((midi, i) =>
        bell({
          freq: hz(midi),
          at: now + i * 0.085,
          gain: 0.075,
          dur: 1.6,
          out: sfx!,
          wet: 0.5,
          wetTo: room,
          pan: (i - 2) * 0.2,
        }),
      );
      [60, 67, 71, 74].forEach((midi) =>
        bell({ freq: hz(midi), at: now + 0.45, gain: 0.05, dur: 2.4, out: sfx!, wet: 0.7, wetTo: room }),
      );
    },
    // Power shot armed - a rising whoosh to signal "loaded".
    armPower() {
      if (muted) return;
      resume();
      const now = ctx!.currentTime;
      const osc = ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(5600, now + 0.18);
      const g = ctx!.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.1, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0006, now + 0.2);
      osc.connect(g).connect(sfx!);
      osc.start(now);
      osc.stop(now + 0.22);
    },
    // The power shot leaving the cue: two quick zips a beat apart.
    //
    // A swept bandpass riding a FIXED low saw, not a rising saw: sweeping the
    // tone up while sweeping the filter down was the first attempt, and the
    // two passed each other without ever meeting - at Q=7 that window is a
    // few milliseconds wide, so the nodes were built and played and nothing
    // came out. A saw at 165Hz has harmonics all the way up; running the
    // filter across them is what makes the zip.
    //
    // The gain looks enormous next to the other effects because a Q=9
    // bandpass throws away most of the signal: rendered offline this peaks at
    // 0.17, which is where cueStrike sits.
    powerFire() {
      if (muted) return;
      resume();
      [0, 0.085].forEach((offset, i) => {
        const now = ctx!.currentTime + offset;
        const osc = ctx!.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(165 + i * 22, now);
        osc.frequency.linearRampToValueAtTime(200 + i * 26, now + 0.15);
        const band = ctx!.createBiquadFilter();
        band.type = "bandpass";
        band.Q.value = 9;
        band.frequency.setValueAtTime(420, now);
        band.frequency.exponentialRampToValueAtTime(6200 + i * 900, now + 0.13);
        const g = ctx!.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.9 - i * 0.18, now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0006, now + 0.17);
        osc.connect(band).connect(g).connect(sfx!);
        osc.start(now);
        osc.stop(now + 0.19);
      });
    },
    // Drawing the cue back. One short zip per step of the pull, climbing with
    // it, so winding up sounds like winding up - "shuin, shuin, shuin" - and
    // a shot that is armed winds up brighter and louder than one that is not.
    pullTick(norm: number, armed: boolean) {
      if (muted) return;
      resume();
      // Spaced on the audio clock rather than played on arrival, so a quick
      // draw still reads as "shuin shuin shuin" instead of one blurred zip.
      // Past a third of a second of backlog the tick is dropped rather than
      // stacked on the last one - stacking was what made a fast pull sound
      // like a single noise in the first place, and a tail still rattling
      // after the ball is struck would be worse than a missing step.
      const earliest = ctx!.currentTime;
      const at = Math.max(earliest, lastPull + 0.075);
      if (at > earliest + 0.34) return;
      lastPull = at;
      const now = at;
      const osc = ctx!.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(150 + norm * 90, now);
      const band = ctx!.createBiquadFilter();
      band.type = "bandpass";
      band.Q.value = armed ? 11 : 8;
      // Each step starts where the last one reached, so the pull climbs.
      band.frequency.setValueAtTime(700 + norm * 2600, now);
      band.frequency.exponentialRampToValueAtTime(
        1500 + norm * (armed ? 5200 : 3400),
        now + 0.085,
      );
      const g = ctx!.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(armed ? 0.75 : 0.42, now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0006, now + 0.11);
      osc.connect(band).connect(g).connect(sfx!);
      osc.start(now);
      osc.stop(now + 0.13);
    },
    uiClick() {
      if (muted) return;
      resume();
      click({ freq: 4200, dur: 0.025, gain: 0.06 });
    },
    // Which operator's chords and timbre the table holds. Switching fades
    // the old chord out under the new one rather than cutting.
    setMusic(track: MusicTrack) {
      if (track === musicTrack) return;
      musicTrack = track;
      chordIndex = 0;
      if (!track) {
        stopBed();
        return;
      }
      if (bedFilter && ctx)
        bedFilter.frequency.setTargetAtTime(
          palette().cutoffIdle,
          ctx.currentTime,
          0.3,
        );
      startBed();
    },
    motion(next: boolean) {
      setMoving(next);
    },
    // Every sound call already resumes the context first, but that's the
    // problem: the first call after any idle stretch (the very first shot
    // of a session, or just a suspended-context resume after the browser
    // auto-suspends an idle AudioContext between careful, slow aims) pays
    // that startup cost at the exact moment the cue strike is meant to
    // land, which is what read as the sound being a beat late. Aiming
    // (pointerdown, well before release) is a real user gesture too, so
    // calling this there gives resume() a head start during think time
    // instead of on the shot itself.
    unlock() {
      if (muted) return;
      resume();
    },
    setMuted(next: boolean) {
      muted = next;
      if (master && ctx)
        master.gain.setTargetAtTime(next ? 0 : 0.65, ctx.currentTime, 0.02);
      // The bus is silent either way; stopping the scheduler as well means a
      // muted game is not still building and tearing down a few dozen
      // oscillators a second for nothing.
      if (next) stopBed();
      // Unmuting is usually the very first sound of the session, so the
      // context may not exist yet - startBed builds it.
      else if (musicTrack && !bedVoices.length) startBed();
    },
    dispose() {
      document.removeEventListener('visibilitychange', onVisibility);
      if (melodyTimer) clearInterval(melodyTimer);
      melodyTimer = null;
      musicTrack = null;
      music = null;
      bedLevel = null;
      bedFilter = null;
      bedVoices = [];
      reverbIn = null;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      if (ctx) void ctx.close();
      ctx = null;
      master = null;
      sfx = null;
      delay = null;
      noiseBuffer = null;
    },
  };
}
