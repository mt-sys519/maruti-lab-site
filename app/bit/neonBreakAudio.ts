// NEON BREAK sound engine. One AudioContext, built lazily on the first user
// gesture (mobile autoplay policies), with a distinct synthesized voice per
// game event instead of a single reused beep.

export type MusicTrack = 'solo' | 'cpu' | 'stage' | null;

type Engine = {
  cueStrike: (power: number) => void;
  collision: (impact: number) => void;
  rail: (impact: number) => void;
  pocket: (ballId: number) => void;
  shield: () => void;
  foul: () => void;
  win: () => void;
  armPower: () => void;
  uiClick: () => void;
  setMusic: (track: MusicTrack) => void;
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
    lastRail = -Infinity;
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

  // Ball-on-ball "clack". Two earlier shapes both leaned on sustained sine
  // tones (a 4-partial inharmonic bell, then a 4-partial major chord) and
  // both read as musical/synthy rather than physical - checked against how
  // real pool ball contact actually sounds (an elastic collision between
  // two hard, near-lossless bodies) and it's described as a "crisp, sharp
  // clack" / "pure, clean sound" - i.e. almost entirely a noise transient
  // with a very bright spectrum and next to no sustained pitch, not a tone
  // at all. So this version is noise-first: a short, hard bandpass-filtered
  // burst carries the actual impact, with only a hair of high sine content
  // underneath for "glassy" brightness rather than a full musical partial.
  function crystalTing(baseFreq: number, gain: number, dur = 0.09) {
    if (muted) return;
    resume();
    const now = ctx!.currentTime;

    // The clack itself: tight bandpass noise, sharp attack, fast decay.
    const noise = noiseBurst();
    const nf = ctx!.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = baseFreq * 2.2;
    nf.Q.value = 2.2;
    const ng = ctx!.createGain();
    ng.gain.setValueAtTime(0.0001, now);
    ng.gain.linearRampToValueAtTime(gain * 1.3, now + 0.0015);
    ng.gain.exponentialRampToValueAtTime(0.0006, now + dur);
    noise.connect(nf).connect(ng).connect(sfx!);
    const nd = ctx!.createGain();
    nd.gain.value = 0.1;
    ng.connect(nd).connect(delay!);
    noise.start(now);
    noise.stop(now + dur + 0.02);

    // A whisper-thin high sine underneath, gone well before the noise tail -
    // just enough top-end sparkle to read as glass rather than plastic.
    const shimmer = ctx!.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(baseFreq * 2.6, now);
    const sg = ctx!.createGain();
    const shimmerDur = Math.min(dur * 0.5, 0.045);
    sg.gain.setValueAtTime(0.0001, now);
    sg.gain.linearRampToValueAtTime(gain * 0.22, now + 0.002);
    sg.gain.exponentialRampToValueAtTime(0.0003, now + shimmerDur);
    shimmer.connect(sg).connect(sfx!);
    shimmer.start(now);
    shimmer.stop(now + shimmerDur + 0.02);
  }


  // ---------------------------------------------------------------- music
  // Three loops, one per operator, synthesized on the same context as the
  // SFX so there are no files to load, no autoplay-blocked <audio> element,
  // and the mute button already covers them. Notes are scheduled ahead on
  // the audio clock rather than fired from setInterval directly - a timer
  // tick only decides WHAT to schedule, never when it sounds, so the pulse
  // does not drift or stutter when the main thread is busy drawing a break.
  let music: GainNode | null = null;
  let musicTrack: MusicTrack = null;
  let musicTimer: ReturnType<typeof setInterval> | null = null;
  let nextStepTime = 0;
  let stepIndex = 0;
  const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

  function musicBus() {
    if (music) return music;
    music = ctx!.createGain();
    // Well above 1: the per-note gains are deliberately tiny so a dozen
    // overlapping voices never clip, and the limiter on the master catches
    // whatever peaks through. This is the one knob for overall BGM level.
    music.gain.value = 0.62;
    music.connect(master!);
    return music;
  }
  // A single voice. Long attacks are what separate the pad from the pluck,
  // so attack/release are explicit rather than a fixed envelope shape.
  function voice(o: {
    freq: number;
    at: number;
    dur: number;
    gain: number;
    type?: OscillatorType;
    attack?: number;
    cutoff?: number;
    detune?: number;
    send?: number;
  }) {
    const osc = ctx!.createOscillator();
    osc.type = o.type ?? 'triangle';
    osc.frequency.setValueAtTime(o.freq, o.at);
    if (o.detune) osc.detune.setValueAtTime(o.detune, o.at);
    const g = ctx!.createGain();
    const attack = o.attack ?? 0.01;
    g.gain.setValueAtTime(0.0001, o.at);
    g.gain.linearRampToValueAtTime(o.gain, o.at + attack);
    g.gain.exponentialRampToValueAtTime(0.0004, o.at + o.dur);
    let tail: AudioNode = osc;
    if (o.cutoff) {
      const f = ctx!.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(o.cutoff, o.at);
      f.Q.value = 6;
      osc.connect(f);
      tail = f;
    }
    tail.connect(g).connect(musicBus());
    if (o.send) {
      const dg = ctx!.createGain();
      dg.gain.value = o.send;
      g.connect(dg).connect(delay!);
    }
    osc.start(o.at);
    osc.stop(o.at + o.dur + 0.03);
  }
  function drum(o: {
    at: number;
    freq: number;
    drop?: number;
    dur: number;
    gain: number;
  }) {
    const osc = ctx!.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(o.freq, o.at);
    if (o.drop) osc.frequency.exponentialRampToValueAtTime(o.drop, o.at + o.dur);
    const g = ctx!.createGain();
    g.gain.setValueAtTime(o.gain, o.at);
    g.gain.exponentialRampToValueAtTime(0.0004, o.at + o.dur);
    osc.connect(g).connect(musicBus());
    osc.start(o.at);
    osc.stop(o.at + o.dur + 0.02);
  }
  function hat(at: number, gain: number, dur = 0.03, freq = 9000) {
    const noise = noiseBurst();
    const f = ctx!.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = freq;
    const g = ctx!.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0004, at + dur);
    noise.connect(f).connect(g).connect(musicBus());
    noise.start(at);
    noise.stop(at + dur + 0.02);
  }
  function snare(at: number, gain: number) {
    const noise = noiseBurst();
    const f = ctx!.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1900;
    f.Q.value = 0.8;
    const g = ctx!.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0004, at + 0.14);
    noise.connect(f).connect(g).connect(musicBus());
    noise.start(at);
    noise.stop(at + 0.17);
  }

  // AOI: unhurried and warm. A slow pad with a sine arpeggio drifting over
  // it and a soft heartbeat underneath - it should sit behind a player who
  // is being told to take their time, not push them.
  const AOI_BARS = [
    { bass: 45, pad: [69, 72, 76], arp: [76, 72, 81, 72] },
    { bass: 41, pad: [65, 69, 72], arp: [72, 69, 77, 69] },
    { bass: 48, pad: [64, 67, 72], arp: [72, 67, 79, 67] },
    { bass: 43, pad: [67, 71, 74], arp: [74, 71, 79, 71] },
  ];
  // AIKA: a driving sixteenth bassline that never lets up, four-on-the-floor
  // under it and a bright answer phrase every other bar. She is playing
  // against you and the loop should feel like it is keeping score.
  const AIKA_BARS = [
    { bass: 33 },
    { bass: 31 },
    { bass: 29 },
    { bass: 28 },
  ];
  // The plain version. Each bar plays its own chord: root on beat 3, fifth
  // on beat 4. Nothing held across bars, nothing anticipating the next one,
  // and the two closing bars filled - the loop is four bars of melody played
  // twice, which is what a backing line in this style normally is. Bars 4
  // and 8 break the two-note pattern into a run of eighths so each half has
  // an ending: straight subdivision between the two beats that were already
  // there, not a push across the bar line. Every clever
  // pass before this one was audibly clever, which is the wrong thing for
  // something that has to run under a whole match.
  const AIKA_LEAD: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
    [
      [8, 81],
      [12, 76],
    ],
    [
      [8, 79],
      [12, 74],
    ],
    [
      [8, 77],
      [12, 72],
    ],
    [
      [8, 76],
      [10, 74],
      [12, 72],
      [14, 71],
    ],
    [
      [8, 81],
      [12, 76],
    ],
    [
      [8, 79],
      [12, 74],
    ],
    [
      [8, 77],
      [12, 72],
    ],
    [
      [6, 76],
      [9, 74],
      [10, 71],
      [12, 69],
    ],
  ];
  // LUNA: no drums at all. A held pad, a bell every few beats and a low
  // pulse on the bar - the stages are a one-shot puzzle and the room should
  // be quiet enough to think in.
  const LUNA_BARS = [
    { bass: 38, pad: [69, 74, 77], bell: [86, 81, 89] },
    { bass: 38, pad: [69, 74, 77], bell: [84, 79, 88] },
    { bass: 36, pad: [67, 72, 76], bell: [88, 83, 91] },
    { bass: 43, pad: [71, 74, 79], bell: [86, 79, 90] },
  ];

  const TRACKS: Record<
    Exclude<MusicTrack, null>,
    { bpm: number; play: (step: number, at: number, beat: number) => void }
  > = {
    solo: {
      bpm: 84,
      play(step, at, beat) {
        const bar = AOI_BARS[Math.floor(step / 16) % 4],
          i = step % 16;
        if (i === 0) {
          voice({
            freq: hz(bar.bass),
            at,
            dur: beat * 3.6,
            gain: 0.05,
            type: 'sine',
            attack: 0.12,
          });
          bar.pad.forEach((n, k) =>
            voice({
              freq: hz(n),
              at,
              dur: beat * 3.4,
              gain: 0.021,
              type: 'triangle',
              attack: 0.5,
              detune: k * 4 - 4,
              send: 0.12,
            }),
          );
        }
        if (i === 0 || i === 8)
          drum({ at, freq: 92, drop: 44, dur: 0.2, gain: 0.07 });
        if (i % 4 === 2)
          voice({
            freq: hz(bar.arp[(i >> 2) % 4]),
            at,
            dur: beat * 0.8,
            gain: 0.026,
            type: 'sine',
            attack: 0.03,
            send: 0.22,
          });
      },
    },
    cpu: {
      bpm: 118,
      play(step, at, beat) {
        const barIndex = Math.floor(step / 16) % 8,
          bar = AIKA_BARS[barIndex % 4],
          lead = AIKA_LEAD[barIndex],
          i = step % 16;
        // Sixteenth bass, octave lift on the back half of each beat.
        const accent = i % 4 === 0;
        voice({
          freq: hz(bar.bass + (i % 8 === 6 ? 12 : 0)),
          at,
          dur: beat * 0.22,
          gain: accent ? 0.07 : 0.045,
          type: 'sawtooth',
          cutoff: accent ? 900 : 520,
        });
        if (i % 4 === 0) drum({ at, freq: 130, drop: 45, dur: 0.16, gain: 0.1 });
        if (i === 4 || i === 12) snare(at, 0.06);
        if (i % 2 === 1) hat(at, i % 4 === 3 ? 0.03 : 0.017);
        // Length comes from the gap to the next note rather than a fixed
        // value, so a bar written long-short-short-short actually sounds
        // long-short-short-short instead of four equal blips at different
        // spacings.
        lead.forEach(([at16, note], k) => {
          if (i !== at16) return;
          const next = k + 1 < lead.length ? lead[k + 1][0] : 16;
          voice({
            freq: hz(note),
            at,
            dur: (beat * (next - at16) * 0.75) / 4,
            gain: 0.03,
            type: 'square',
            cutoff: 2600,
            send: 0.2,
          });
        });
      },
    },
    stage: {
      bpm: 66,
      play(step, at, beat) {
        const bar = LUNA_BARS[Math.floor(step / 16) % 4],
          i = step % 16;
        if (i === 0) {
          voice({
            freq: hz(bar.bass),
            at,
            dur: beat * 4.2,
            gain: 0.04,
            type: 'sine',
            attack: 0.6,
          });
          bar.pad.forEach((n, k) =>
            voice({
              freq: hz(n),
              at,
              dur: beat * 4,
              gain: 0.017,
              type: 'sine',
              attack: 1.1,
              detune: k * 5 - 5,
              send: 0.16,
            }),
          );
        }
        if (i === 2 || i === 9 || i === 13)
          voice({
            freq: hz(bar.bell[i === 2 ? 0 : i === 9 ? 1 : 2]),
            at,
            dur: beat * 1.4,
            gain: 0.022,
            type: 'sine',
            attack: 0.004,
            send: 0.3,
          });
      },
    },
  };

  function musicTick() {
    if (!ctx || !musicTrack || ctx.state !== 'running') return;
    const track = TRACKS[musicTrack];
    const stepDur = 60 / track.bpm / 4;
    // Resync rather than fire a burst of backlogged notes if the context was
    // suspended (tab hidden, phone locked) while the loop was running.
    if (nextStepTime < ctx.currentTime) nextStepTime = ctx.currentTime + 0.06;
    while (nextStepTime < ctx.currentTime + 0.25) {
      track.play(stepIndex, nextStepTime, 60 / track.bpm);
      stepIndex = (stepIndex + 1) % 128;
      nextStepTime += stepDur;
    }
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
    // Cue strike: the tip's mechanical knock plus a touch of the same glass
    // ring the cue ball carries into every later contact - harder shots hit
    // harder and brighter.
    cueStrike(power: number) {
      const norm = Math.min(1, power / 60);
      click({
        freq: 3600 + norm * 3600,
        dur: 0.05,
        gain: 0.1 + norm * 0.08,
        toDelay: 0.08,
      });
      crystalTing(4000 + norm * 1400, 0.09 + norm * 0.08, 0.14);
    },
    // Ball-ball collision - a crystal-ball ting rather than a mechanical
    // click, with pitch/volume/ring-length all tracking impact force so a
    // glancing tap and a full-power carom sound distinct.
    collision(impact: number) {
      const now = performance.now();
      if (impact < 0.8 || now - lastCollision < 18) return;
      lastCollision = now;
      const norm = Math.min(1, impact / 40);
      crystalTing(4200 + norm * 2600, 0.12 + norm * 0.16, 0.1 + norm * 0.1);
    },
    // Cushion/rail - duller and lower than a ball hit, felt more than heard.
    rail(impact: number) {
      const now = performance.now();
      if (impact < 1 || now - lastRail < 35) return;
      lastRail = now;
      const norm = Math.min(1, impact / 30);
      click({ freq: 1040 + norm * 800, dur: 0.07, gain: 0.06 + norm * 0.1 });
    },
    // Pocket capture: a bright descending shimmer landing on a soft thud -
    // the one moment that should feel rewarding rather than incidental.
    pocket(ballId: number) {
      if (muted) return;
      resume();
      const now = ctx!.currentTime;
      const base = 4800 - ballId * 88;
      [8, 1, 2, 3].forEach((i) => {
        tone({
          freq: base * Math.pow(0.82, i),
          dur: 0.22,
          gain: 0.05,
          type: 'sine',
          toDelay: 0.15,
        });
      });
      later(() => crystalTing(2080, 0.14, 0.22), 90);
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
    // Foul: short dissonant two-note buzz, deliberately unpleasant.
    foul() {
      if (muted) return;
      resume();
      tone({ freq: 660, dur: 0.22, gain: 0.11, type: 'square' });
      later(
        () => tone({ freq: 624, dur: 0.24, gain: 0.1, type: 'square' }),
        60,
      );
    },
    // Win: a short rising arpeggio.
    win() {
      if (muted) return;
      resume();
      [2092, 2636, 3136, 4188].forEach((freq, i) => {
        later(
          () =>
            tone({
              freq,
              dur: 0.4,
              gain: 0.09,
              type: 'triangle',
              toDelay: 0.2,
            }),
          i * 90,
        );
      });
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
    uiClick() {
      if (muted) return;
      resume();
      click({ freq: 8800, dur: 0.02, gain: 0.06 });
    },
    // Switching tracks restarts the loop from the top of its own four-bar
    // cycle: the three run at different tempos, so carrying a step index
    // across would drop the new one in mid-phrase.
    setMusic(track: MusicTrack) {
      if (track === musicTrack) return;
      musicTrack = track;
      stepIndex = 0;
      if (!track || muted) {
        if (musicTimer) clearInterval(musicTimer);
        musicTimer = null;
        return;
      }
      resume();
      nextStepTime = ctx!.currentTime + 0.08;
      if (!musicTimer) musicTimer = setInterval(musicTick, 60);
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
      if (next) {
        if (musicTimer) clearInterval(musicTimer);
        musicTimer = null;
      } else if (musicTrack && ctx && !musicTimer) {
        nextStepTime = ctx.currentTime + 0.08;
        musicTimer = setInterval(musicTick, 60);
      }
    },
    dispose() {
      if (musicTimer) clearInterval(musicTimer);
      musicTimer = null;
      musicTrack = null;
      music = null;
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
