class CyberAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.ambientGain = null;
    this.isInitialized = false;
    this.isMuted = true;
    this.masterVolume = 1.0;
    // +3 dB output headroom: same slider position is audibly stronger on quiet devices.
    // Uses the existing master GainNode; no extra audio node is added.
    this.outputBoost = Math.SQRT2;
    // 既存の低い環境ハムだけを独立してON/OFFできる。
    try { this.humEnabled = localStorage.getItem("cyberAquariumHumEnabled") !== "0"; }
    catch (_) { this.humEnabled = true; }

    // 環境音ノード
    this.ambientNodes = [];
    this.filterNode = null;
    this.lfoNode = null;

    // バブラー設定
    this.bubblerRate = 0.5; // 風量 (0.0〜1.0)
    this.bubblerInterval = null;
    this.noiseBuffer = null;

    // スキャンモード音響
    this.scanModeActive = false;
    this.scanTimer = null;

    // 上部ネオン／蛍光灯系の瞬間的な電気音
    this.lightGain = null;
    this.lightNodes = [];
    this.lightIntensity = 0.8;
    this.lightFlicker = 0.20;
    this.lightAgingTimer = null;

    // テーマ別の音像。NATURALは従来音、CYBERだけ電子機器寄りへ切り替える。
    try { this.themeMode = (localStorage.getItem("cyberAquariumTheme") || "dark") === "light" ? "light" : "dark"; }
    catch (_) { this.themeMode = "dark"; }
    this.cyberTextureTimer = null;
  }

  init() {
    if (this.isInitialized) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
      
      // マスターゲイン
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // 環境音専用ゲイン
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(this.humEnabled ? 0.04 : 0.0, this.ctx.currentTime);
      this.ambientGain.connect(this.masterGain);

      // setupAmbientDrone() は呼ばない、まだ。init() はここで(必ず suspended な)
      // 生成直後の AudioContext に対して呼ばれるので、ここでオシレーターを
      // start() すると蛍光管系と同じ「suspended 中に作った常時音がブラウザ依存で
      // 鳴らない」問題を踏む。resume 後の applyState() 側で一度だけ生成する。
      this.generateNoiseBuffer();
      this.isInitialized = true;
      this.applyThemeAudioProfile();
      // 蛍光管系はユーザーが AUDIO を有効化し、AudioContext が running になってから生成する。
      this.startBubblerScheduler();
      this.startCyberTextureScheduler();
      
      console.log("CyberAudioEngine: Initialized successfully");
    } catch (e) {
      console.error("Failed to initialize AudioContext", e);
    }
  }

  setupAmbientDrone() {
    if (!this.ctx) return;

    // 低音フィルター（水中感）
    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(180, this.ctx.currentTime);
    this.filterNode.Q.setValueAtTime(4, this.ctx.currentTime);
    this.filterNode.connect(this.ambientGain);

    // 1. メインの超低周波ハミング
    const baseOsc = this.ctx.createOscillator();
    baseOsc.type = 'sine';
    baseOsc.frequency.setValueAtTime(55, this.ctx.currentTime);

    const baseGain = this.ctx.createGain();
    baseGain.gain.setValueAtTime(0.6, this.ctx.currentTime);
    baseOsc.connect(baseGain);
    baseGain.connect(this.filterNode);
    baseOsc.start();
    this.ambientNodes.push(baseOsc);

    // 2. 倍音ハミング
    const overtoneOsc = this.ctx.createOscillator();
    overtoneOsc.type = 'triangle';
    overtoneOsc.frequency.setValueAtTime(110, this.ctx.currentTime);

    const overtoneGain = this.ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    overtoneOsc.connect(overtoneGain);
    overtoneGain.connect(this.filterNode);
    overtoneOsc.start();
    this.ambientNodes.push(overtoneOsc);

    // 3. 揺らぎを与えるLFO
    this.lfoNode = this.ctx.createOscillator();
    this.lfoNode.type = 'sine';
    this.lfoNode.frequency.setValueAtTime(0.15, this.ctx.currentTime);

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(50, this.ctx.currentTime);

    this.lfoNode.connect(lfoGain);
    lfoGain.connect(this.filterNode.frequency);
    this.lfoNode.start();
    this.ambientNodes.push(this.lfoNode);
  }

  setThemeMode(mode = "dark") {
    this.themeMode = mode === "light" ? "light" : "dark";
    if (this.isInitialized) {
      this.applyThemeAudioProfile();
      this.startCyberTextureScheduler();
      this.startLightAgingScheduler();
    }
  }

  applyThemeAudioProfile() {
    if (!this.ctx || !this.filterNode || this.ambientNodes.length < 3) return;
    const now = this.ctx.currentTime;
    const cyber = this.themeMode !== "light";

    // NATURALは従来の55/110Hzの水槽ハム。CYBERは低く沈め、フィルタを少し開いて機械共振へ。
    this.ambientNodes[0].frequency.setTargetAtTime(cyber ? 43 : 55, now, 0.45);
    this.ambientNodes[1].frequency.setTargetAtTime(cyber ? 86 : 110, now, 0.45);
    this.ambientNodes[2].frequency.setTargetAtTime(cyber ? 0.11 : 0.15, now, 0.45);
    this.filterNode.frequency.setTargetAtTime(cyber ? 245 : 180, now, 0.55);
    this.filterNode.Q.setTargetAtTime(cyber ? 5.2 : 4.0, now, 0.55);

    if (this.ambientGain) {
      // NATURAL keeps the original 55/110Hz hum timbre at about -3 dB from the original level (0.040 -> 0.0283).
      const target = this.humEnabled ? (cyber ? 0.040 : 0.0283) : 0.0;
      this.ambientGain.gain.setTargetAtTime(target, now, 0.16);
    }
  }

  startCyberTextureScheduler() {
    // v39: CYBER背景のランダムな短音（「ぽんぽん」）は撤去。
    // AIR / GLITCH / RAINなど、画面上の現象に紐づく音だけを残す。
    if (this.cyberTextureTimer) {
      clearTimeout(this.cyberTextureTimer);
      this.cyberTextureTimer = null;
    }
  }

  _makeCyberNoise(seconds, texture = "digital") {
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buffer = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let prev = 0;
      let smooth = 0;
      let held = 0;
      let holdLeft = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        let v;
        if (texture === "blue") {
          v = (white - prev) * 0.58;
          prev = white;
        } else if (texture === "soft") {
          smooth += (white - smooth) * 0.085;
          v = smooth * 1.7;
        } else {
          if (holdLeft <= 0) {
            const levels = 48;
            held = Math.round(white * levels) / levels;
            holdLeft = 2 + Math.floor(Math.random() * 7);
          }
          holdLeft--;
          v = held * 0.76 + (white - prev) * 0.16;
          prev = white;
          if (Math.random() < 0.016) v = 0;
        }
        data[i] = Math.max(-1, Math.min(1, v * (ch ? 0.94 : 1.0)));
      }
    }
    return buffer;
  }

  _createCyberFxBus(now, wet = 0.14) {
    const input = this.ctx.createGain();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-24, now);
    comp.knee.setValueAtTime(16, now);
    comp.ratio.setValueAtTime(3.0, now);
    comp.attack.setValueAtTime(0.003, now);
    comp.release.setValueAtTime(0.14, now);
    input.connect(comp);

    const dry = this.ctx.createGain();
    dry.gain.setValueAtTime(0.86, now);
    comp.connect(dry);
    dry.connect(this.masterGain);

    // Two very short, non-feedback taps add depth without an obvious echo or pitch.
    [[0.017, -0.62, wet], [0.031, 0.68, wet * 0.72]].forEach(([delayTime, pan, gain]) => {
      const d = this.ctx.createDelay(0.08);
      const g = this.ctx.createGain();
      d.delayTime.setValueAtTime(delayTime, now);
      g.gain.setValueAtTime(gain, now);
      comp.connect(d);
      d.connect(g);
      if (this.ctx.createStereoPanner) {
        const p = this.ctx.createStereoPanner();
        p.pan.setValueAtTime(pan, now);
        g.connect(p);
        p.connect(this.masterGain);
      } else {
        g.connect(this.masterGain);
      }
    });
    return input;
  }

  _playCyberGrain(startT, duration, opts = {}) {
    const src = this.ctx.createBufferSource();
    const hp = this.ctx.createBiquadFilter();
    const lp = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const bus = opts.bus || this._createCyberFxBus(startT, opts.wet ?? 0.10);

    src.buffer = this._makeCyberNoise(duration + 0.025, opts.texture || "digital");
    hp.type = "highpass";
    hp.frequency.setValueAtTime(opts.hp || 900, startT);
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(opts.lp || 7200, startT);
    if (opts.lpTo) lp.frequency.exponentialRampToValueAtTime(Math.max(120, opts.lpTo), startT + duration);
    hp.Q.setValueAtTime(0.36, startT);
    lp.Q.setValueAtTime(0.28, startT);

    const amp = opts.amp ?? 0.012;
    const attack = Math.min(duration * .28, opts.attack ?? 0.018);
    gain.gain.setValueAtTime(0.0001, startT);
    gain.gain.linearRampToValueAtTime(amp, startT + attack);
    gain.gain.setValueAtTime(amp * .82, startT + duration * .60);
    gain.gain.exponentialRampToValueAtTime(0.0001, startT + duration);

    src.connect(hp); hp.connect(lp); lp.connect(gain);
    if (pan) {
      pan.pan.setValueAtTime(opts.pan ?? 0, startT);
      gain.connect(pan); pan.connect(bus);
    } else {
      gain.connect(bus);
    }
    src.start(startT);
    src.stop(startT + duration + .03);
  }

  _playCyberChime(startT, baseFreq, duration, opts = {}) {
    const bus = opts.bus || this._createCyberFxBus(startT, opts.wet ?? 0.16);
    const panValue = opts.pan ?? 0;
    const amp = opts.amp ?? 0.010;
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const mix = this.ctx.createGain();
    mix.gain.setValueAtTime(1.0, startT);

    // Inharmonic bell/chime partials: transparent and metallic without 8-bit/game character.
    const ratios = opts.ratios || [1.0, 2.02, 2.73, 4.11, 5.36];
    const levels = opts.levels || [1.0, 0.46, 0.27, 0.14, 0.075];
    ratios.forEach((ratio, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const partialDur = duration * (1.0 - i * 0.095);
      const detune = (opts.detune ?? 5) * (Math.random() * 2 - 1);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(Math.max(180, baseFreq * ratio), startT);
      osc.detune.setValueAtTime(detune, startT);

      const peak = Math.max(0.00025, amp * levels[i]);
      const attack = 0.002 + i * 0.0007;
      g.gain.setValueAtTime(0.0001, startT);
      g.gain.linearRampToValueAtTime(peak, startT + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, startT + Math.max(0.045, partialDur));

      osc.connect(g);
      g.connect(mix);
      osc.start(startT);
      osc.stop(startT + partialDur + 0.035);
    });

    // A very soft high shelf keeps the tone glassy rather than round or bell-like.
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(opts.hp ?? 620, startT);
    hp.Q.setValueAtTime(0.28, startT);
    mix.connect(hp);
    if (panner) {
      panner.pan.setValueAtTime(panValue, startT);
      hp.connect(panner);
      panner.connect(bus);
    } else {
      hp.connect(bus);
    }
  }

  _playCyberFMGlass(startT, opts = {}) {
    const bus = opts.bus || this._createCyberFxBus(startT, opts.wet ?? 0.12);
    const carrierFreq = opts.freq ?? 980;
    const modRatio = opts.modRatio ?? 1.4142;
    const duration = opts.duration ?? 0.24;
    const amp = opts.amp ?? 0.014;
    const modDepth = opts.modDepth ?? 980;
    const panValue = opts.pan ?? 0;

    const carrier = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const ampGain = this.ctx.createGain();
    const hp = this.ctx.createBiquadFilter();
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

    carrier.type = "sine";
    mod.type = "sine";
    carrier.frequency.setValueAtTime(carrierFreq, startT);
    mod.frequency.setValueAtTime(carrierFreq * modRatio, startT);

    // Strong inharmonic sidebands at the attack collapse quickly into a clean glass tail.
    modGain.gain.setValueAtTime(modDepth, startT);
    modGain.gain.exponentialRampToValueAtTime(18, startT + duration * 0.72);
    modGain.gain.exponentialRampToValueAtTime(0.01, startT + duration);
    mod.connect(modGain);
    modGain.connect(carrier.frequency);

    ampGain.gain.setValueAtTime(0.0001, startT);
    ampGain.gain.linearRampToValueAtTime(amp, startT + 0.003);
    ampGain.gain.exponentialRampToValueAtTime(amp * 0.28, startT + duration * 0.40);
    ampGain.gain.exponentialRampToValueAtTime(0.0001, startT + duration);

    hp.type = "highpass";
    hp.frequency.setValueAtTime(opts.hp ?? 520, startT);
    hp.Q.setValueAtTime(0.32, startT);

    carrier.connect(ampGain);
    ampGain.connect(hp);
    if (panner) {
      panner.pan.setValueAtTime(panValue, startT);
      hp.connect(panner);
      panner.connect(bus);
    } else {
      hp.connect(bus);
    }

    carrier.start(startT); mod.start(startT);
    carrier.stop(startT + duration + 0.025);
    mod.stop(startT + duration + 0.025);
  }

  _playCyberCrystalFracture(startT, opts = {}) {
    const bus = opts.bus || this._createCyberFxBus(startT, opts.wet ?? 0.13);
    const base = opts.base ?? 1540;
    const amp = opts.amp ?? 0.014;
    const ratios = [1.0, 1.46, 2.19, 3.31, 4.82];
    const levels = [1.0, 0.50, 0.26, 0.13, 0.065];
    const mix = this.ctx.createGain();
    const hp = this.ctx.createBiquadFilter();
    const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const gate = this.ctx.createGain();

    mix.gain.setValueAtTime(1.0, startT);
    hp.type = "highpass";
    hp.frequency.setValueAtTime(opts.hp ?? 840, startT);
    hp.Q.setValueAtTime(0.22, startT);

    // One glass-like strike, then two tiny digital discontinuities.
    // The source remains tonal and transparent; the fracture comes from the envelope, not noise.
    gate.gain.setValueAtTime(0.0001, startT);
    gate.gain.linearRampToValueAtTime(1.0, startT + 0.004);
    gate.gain.exponentialRampToValueAtTime(0.60, startT + 0.045);
    gate.gain.setValueAtTime(0.0001, startT + 0.052);
    gate.gain.linearRampToValueAtTime(0.46, startT + 0.061);
    gate.gain.exponentialRampToValueAtTime(0.26, startT + 0.092);
    gate.gain.setValueAtTime(0.0001, startT + 0.100);
    gate.gain.linearRampToValueAtTime(0.19, startT + 0.110);
    gate.gain.exponentialRampToValueAtTime(0.0001, startT + 0.245);

    ratios.forEach((ratio, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const f0 = base * ratio;
      const drift = 0.982 - i * 0.0025;
      osc.type = "sine";
      osc.frequency.setValueAtTime(f0, startT);
      osc.frequency.exponentialRampToValueAtTime(Math.max(180, f0 * drift), startT + 0.23);
      osc.detune.setValueAtTime((i - 2) * 2.7, startT);
      g.gain.setValueAtTime(Math.max(0.0002, amp * levels[i]), startT);
      osc.connect(g);
      g.connect(mix);
      osc.start(startT);
      osc.stop(startT + 0.27 - i * 0.015);
    });

    mix.connect(gate);
    gate.connect(hp);
    if (pan) {
      pan.pan.setValueAtTime(opts.pan ?? -0.08, startT);
      pan.pan.linearRampToValueAtTime(opts.panTo ?? 0.16, startT + 0.22);
      hp.connect(pan);
      pan.connect(bus);
    } else {
      hp.connect(bus);
    }

    // Two very quiet crystal splinters make GLITCH feel fractured, not like a second RAIN.
    this._playCyberChime(startT + 0.072, base * 1.82, 0.115, {
      bus, amp: amp * 0.22, pan: 0.44, hp: 1500, detune: 4,
      ratios:[1.0, 2.41, 4.07], levels:[1.0, 0.20, 0.055]
    });
    this._playCyberChime(startT + 0.128, base * 2.36, 0.085, {
      bus, amp: amp * 0.13, pan: -0.38, hp: 1900, detune: 5,
      ratios:[1.0, 2.73], levels:[1.0, 0.12]
    });
  }

  playCyberBubbleSound() {
    if (!this.isInitialized || this.isMuted || !this.ctx || this.themeMode === "light") return;
    const now = this.ctx.currentTime;
    const bus = this._createCyberFxBus(now, 0.22);

    // AIR = electronic-harp harmonics rising out of the tank.
    // It is one harmonic family climbing upward, not a melody and not a bubble/noise vent.
    const base = [392.00, 415.30, 440.00][Math.floor(Math.random() * 3)];
    const harmonicRatios = [2.0, 3.0, 4.0, 6.0];
    const pans = [-0.34, -0.10, 0.16, 0.38];
    harmonicRatios.forEach((ratio, i) => {
      const t = now + i * 0.070 + Math.random() * 0.008;
      this._playCyberChime(t, base * ratio, 0.42 - i * 0.035, {
        bus,
        amp: [0.0088, 0.0070, 0.0056, 0.0040][i],
        pan: pans[i] + (Math.random() - 0.5) * 0.05,
        hp: 640 + i * 260,
        detune: 1.2,
        // Keep the pluck pure and harp-like: just a faint upper shimmer.
        ratios: [1.0, 2.01, 3.98],
        levels: [1.0, 0.15, 0.035]
      });
    });
  }

  playCyberFishFx(mode) {
    if (!this.isInitialized || this.isMuted || !this.ctx || this.themeMode === "light") return;
    const now = this.ctx.currentTime;

    if (mode === "GLITCH") {
      // GLITCH must be clearly audible and distinct from AIR/RAIN: one crystalline signal fracture.
      const bus = this._createCyberFxBus(now, 0.13);
      const root = [1320, 1396.91, 1480][Math.floor(Math.random() * 3)];
      this._playCyberCrystalFracture(now, {
        bus, base:root, amp:0.0275, hp:820, pan:-0.16, panTo:0.22
      });
      // A tiny re-lock glint, deliberately much quieter than the fracture itself.
      this._playCyberFMGlass(now + 0.176, {
        bus, freq:root * 1.50, modRatio:1.618, modDepth:420, duration:0.095, amp:0.0058, pan:0.30, hp:1300
      });
      return;
    }

    if (mode === "RAIN") {
      // RAIN = a spectral glass curtain, not a melody.
      // Several inharmonic resonances bloom almost together, drift across stereo,
      // and dissolve as one event. There is no equal-tempered motif to follow.
      const bus = this._createCyberFxBus(now, 0.32);
      const centers = [
        [910,  -0.72, 0.00],
        [1018, -0.42, 0.07],
        [1146, -0.10, 0.15],
        [1288,  0.22, 0.24],
        [1450,  0.50, 0.34],
        [1628,  0.70, 0.46]
      ];
      const reverse = Math.random() < 0.5;
      centers.forEach(([base, pan0, offset], i) => {
        const t = now + 0.018 + offset + Math.random() * 0.018;
        const pan = reverse ? -pan0 : pan0;
        const drift = 0.985 + Math.random() * 0.030;
        const freq = base * drift;
        const dur = 0.78 + i * 0.055 + Math.random() * 0.10;
        // One inharmonic object per layer: perceived as timbre, not as notes.
        this._playCyberChime(t, freq, dur, {
          bus,
          amp: 0.0066 - i * 0.00034,
          pan,
          hp: 720 + i * 70,
          detune: 2.6,
          ratios: [1.0, 1.431, 2.067, 2.913, 4.171],
          levels: [1.0, 0.29, 0.13, 0.052, 0.018]
        });
      });

      // A soft upper halo appears late and evaporates; it gives the event a
      // "waiting for the next one" signature without becoming a jingle.
      this._playCyberChime(now + 0.38, 1973 + Math.random() * 70, 0.92, {
        bus, amp:0.0032, pan: reverse ? -0.18 : 0.18, hp:1250, detune:1.8,
        ratios:[1.0, 1.618, 2.414, 3.732], levels:[1.0, 0.22, 0.075, 0.022]
      });
      return;
    }
  }

  playModeProtocolTransition(fromMode, toMode) {
    if (!this.isInitialized || this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const toCyber = toMode !== "light";
    const bus = this._createCyberFxBus(now, toCyber ? 0.18 : 0.12);

    // 1) de-resolution: the object loses continuous form.
    this._playCyberGrain(now, 0.36, {
      bus, texture:"digital", hp:toCyber ? 620 : 480,
      lp:toCyber ? 7200 : 5600, lpTo:toCyber ? 3300 : 2500,
      amp:toCyber ? 0.0125 : 0.0100, attack:0.028, pan:-0.18
    });

    // 2) protocol cloud: brief granular activity around the fully coded state.
    for (let i = 0; i < 7; i++) {
      const t = now + 0.20 + i * 0.047 + Math.random() * 0.018;
      this._playCyberGrain(t, 0.050 + Math.random() * 0.045, {
        bus, texture:i % 2 ? "blue" : "digital",
        hp:(toCyber ? 1700 : 1200) + Math.random() * 1800,
        lp:(toCyber ? 7600 : 5900) + Math.random() * 1400,
        amp:0.0042 + Math.random() * 0.0022,
        attack:0.006, pan:-0.76 + Math.random() * 1.52
      });
    }

    // 3) reconstruction: brighter, smoother energy gathers into the new form.
    this._playCyberGrain(now + 0.50, 0.39, {
      bus, texture:"blue", hp:toCyber ? 1450 : 900,
      lp:toCyber ? 9200 : 6500, lpTo:toCyber ? 6900 : 4300,
      amp:toCyber ? 0.0110 : 0.0088, attack:0.085, pan:0.22
    });

    // 4) lock: a very short broadband confirmation with no oscillator/pitch.
    this._playCyberGrain(now + 0.865, 0.060, {
      bus, texture:"blue", hp:toCyber ? 2100 : 1300,
      lp:toCyber ? 8500 : 5900,
      amp:toCyber ? 0.0075 : 0.0058, attack:0.006, pan:0
    });
  }


  // ホワイトノイズバッファの生成（砂掘り音や泡のはじける高域用）
  generateNoiseBuffer() {
    const bufferSize = this.ctx.sampleRate * 1.5; // 1.5秒分
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  setupLightFixture() {
    if (!this.ctx || !this.masterGain || this.lightGain) return;

    // 既存の水槽アンビエントを常時ハムとして使う。
    // 照明系では連続音を追加せず、「ジジッ」「カン」などの瞬間音だけを流す。
    this.lightGain = this.ctx.createGain();
    this.lightGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    this.lightGain.connect(this.masterGain);
  }

  updateLightParams(intensity) {
    this.lightIntensity = Math.max(0, Math.min(1, parseFloat(intensity) || 0));
    if (!this.isInitialized || !this.lightGain) return;
    const target = 0.82 + this.lightIntensity * 0.18;
    this.lightGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.30);
  }

  playLightCrackle(amount = this.lightFlicker) {
    if (!this.isInitialized || this.isMuted || !this.ctx) return;
    // The visible fluorescent/neon flicker exists in CYBER only.
    // Sound is tied 1:1 to that visual event: one short dry electric/metal strike,
    // never an unattended double hit and never a low resonant "pon".
    if (this.themeMode === "light") return;

    const strength = Math.max(0.08, Math.min(1, parseFloat(amount) || 0.2));
    const out = this.lightGain || this.masterGain;
    const sr = this.ctx.sampleRate;
    const duration = 0.070 + strength * 0.022; // about 72–92 ms
    const frames = Math.max(1, Math.floor(sr * duration));
    const buffer = this.ctx.createBuffer(1, frames, sr);
    const data = buffer.getChannelData(0);

    // Inharmonic metal partials + a tiny contact-discharge transient.
    // Everything lives above ~2 kHz so there is no rounded low-frequency body.
    const partials = [
      [2280, 0.72, 0.024],
      [3560, 0.56, 0.031],
      [5480, 0.32, 0.024],
      [8120, 0.14, 0.018]
    ].map(([freq, amp, decay]) => [freq * (0.985 + Math.random() * 0.03), amp, decay, Math.random() * Math.PI * 2]);

    let prevNoise = 0;
    for (let i = 0; i < frames; i++) {
      const t = i / sr;
      const attack = Math.min(1, t / 0.0015);
      const release = Math.max(0, 1 - t / duration);

      let metal = 0;
      for (const [freq, amp, decay, phase] of partials) {
        metal += Math.sin(Math.PI * 2 * freq * t + phase) * amp * Math.exp(-t / decay);
      }

      const white = Math.random() * 2 - 1;
      const edge = white - prevNoise * 0.965;
      prevNoise = white;
      const contact = edge * Math.exp(-t / 0.012) * 0.38;

      data[i] = (metal * 0.30 + contact) * attack * release * (0.64 + strength * 0.36);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(1450, this.ctx.currentTime);
    hp.Q.setValueAtTime(0.42, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.060 + strength * 0.036, this.ctx.currentTime);

    source.connect(hp);
    hp.connect(gain);

    if (typeof this.ctx.createStereoPanner === 'function') {
      const pan = this.ctx.createStereoPanner();
      pan.pan.setValueAtTime((Math.random() - 0.5) * 0.18, this.ctx.currentTime);
      gain.connect(pan);
      pan.connect(out);
    } else {
      gain.connect(out);
    }

    source.start();
  }

  playLightStarter() {
    if (!this.isInitialized || this.isMuted || !this.ctx) return;
    if (this.themeMode !== "light") return;
    // One continuous starter scrape. Do not schedule a second standalone hit;
    // that was perceived as "pop-pop".
    this.playLightCrackle(0.92);
  }

  playLightMetalPing(doubleHit = false) {
    if (!this.isInitialized || this.isMuted || !this.ctx) return;
    // NATURAL only. In CYBER this tonal metal hit was perceived as a recurring 'pon-pon'.
    if (this.themeMode !== "light") return;
    const out = this.lightGain || this.masterGain;

    const hit = (delay = 0, softer = false) => {
      const now = this.ctx.currentTime + delay;
      const scale = softer ? 0.58 : 1.0;

      // Thin fluorescent-fixture chassis: very short, high, dry "カン".
      // Inharmonic upper partials; no low resonant body.
      const partials = [
        [3450, 0.050 * scale, 0.060],
        [5280, 0.031 * scale, 0.043],
        [7920, 0.016 * scale, 0.029],
        [10400, 0.0065 * scale, 0.020]
      ];

      partials.forEach(([freq, peak, decay]) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        const f = freq * (0.985 + Math.random() * 0.030);
        osc.frequency.setValueAtTime(f, now);
        // Tiny downward drift of a struck thin panel, kept subtle so it never reads as a bell.
        osc.frequency.exponentialRampToValueAtTime(f * 0.996, now + decay);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(peak, now + 0.0007);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
        osc.connect(gain);
        gain.connect(out);
        osc.start(now);
        osc.stop(now + decay + 0.008);
      });

      // Bright mechanical strike transient. This supplies the "k" in "kan".
      if (this.noiseBuffer) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(4300, now);
        hp.Q.setValueAtTime(0.55, now);

        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(6900 + Math.random() * 900, now);
        bp.Q.setValueAtTime(1.15, now);

        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(0.0001, now);
        ng.gain.linearRampToValueAtTime(0.040 * scale, now + 0.00045);
        ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);

        noise.connect(hp);
        hp.connect(bp);
        bp.connect(ng);
        ng.connect(out);
        noise.start(now);
        noise.stop(now + 0.016);
      }
    };

    hit(0, false);
    if (doubleHit) hit(0.18 + Math.random() * 0.20, true);
  }

  startLightAgingScheduler() {
    if (this.lightAgingTimer) {
      clearTimeout(this.lightAgingTimer);
      this.lightAgingTimer = null;
    }
    // PAKU: the aging-fixture metal "ping" easter egg doesn't fit a calm
    // feeding toy, so this scheduler is disabled outright (never re-armed).
  }

  // 泡のはじける水音の合成
  playBubbleSound() {
    if (!this.isInitialized || this.isMuted) return;
    // Guards the setTimeout-delayed calls above too, in case suspend lands
    // in the gap between the interval tick firing and this actually running.
    if (!this.ctx || this.ctx.state !== "running") return;
    if (this.themeMode !== "light") {
      this.playCyberBubbleSound();
      return;
    }

    const now = this.ctx.currentTime;
    
    // 泡の「プクッ」という基音：サイン波の急上昇スイープ
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    const startFreq = 140 + Math.random() * 80;
    const endFreq = startFreq * (2.2 + Math.random() * 1.5); // 急激に高域へ
    
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.12);
    
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);

    // 水泡のはじける「プチッ」という高音ノイズ成分をブレンド
    if (this.noiseBuffer && Math.random() > 0.3) {
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = this.noiseBuffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(4000 + Math.random() * 2000, now);
      noiseFilter.Q.setValueAtTime(6, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.008, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      noiseSource.start(now);
      noiseSource.stop(now + 0.04);
    }
  }

  // バブラー（気泡）の間欠的再生スケジューラー
  startBubblerScheduler() {
    if (this.bubblerInterval) clearInterval(this.bubblerInterval);
    
    this.bubblerInterval = setInterval(() => {
      // ctx.currentTime freezes while suspended (e.g. phone locked/tab hidden).
      // Without this check, every tick below still schedules sounds against
      // that frozen "now", which all pile up and fire at once - as one loud
      // burst - the instant the context resumes.
      if (this.isMuted || !this.isInitialized || this.bubblerRate <= 0.05) return;
      if (!this.ctx || this.ctx.state !== "running") return;
      
      // NATURALは従来の気泡群。CYBERは連打すると泡の破裂音に聞こえるため、
      // 1回ずつ長めのデータ・ベント音を流す。
      if (this.themeMode !== "light") {
        const cyberChance = 0.035 + this.bubblerRate * 0.20;
        if (Math.random() < cyberChance) this.playCyberBubbleSound();
      } else {
        const chance = 0.05 + this.bubblerRate * 0.65;
        if (Math.random() < chance) {
          const count = Math.floor(1 + Math.random() * 4 * this.bubblerRate);
          for (let i = 0; i < count; i++) {
            const delay = i * (60 + Math.random() * 90);
            setTimeout(() => this.playBubbleSound(), delay);
          }
        }
      }
    }, 300);
  }

  // バブラー風量の更新
  updateBubblerRate(rate) {
    this.bubblerRate = parseFloat(rate);
  }

  // コリドラスが水面で腸呼吸した瞬間の小さな破裂音。
  // NATURALは水泡の「ぷちっ」、CYBERは極短いデータ・ポップへ置換する。
  playCorydorasAirGulp() {
    if (!this.isInitialized || this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.themeMode !== "light") {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(760 + Math.random()*120, now);
      osc.frequency.exponentialRampToValueAtTime(1320 + Math.random()*220, now + 0.045);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.0042, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.060);
      osc.connect(gain); gain.connect(this.masterGain);
      osc.start(now); osc.stop(now + 0.065);
      if (this.noiseBuffer) {
        this._playCyberGrain(now, 0.055, { texture:"digital", hp:2100, lp:7200, amp:0.0038, wet:0.035, attack:0.004, pan:(Math.random()-0.5)*0.35 });
      }
      return;
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    const start = 190 + Math.random()*55;
    osc.frequency.setValueAtTime(start, now);
    osc.frequency.exponentialRampToValueAtTime(start * 3.0, now + 0.070);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.012, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.082);
    osc.connect(gain); gain.connect(this.masterGain);
    osc.start(now); osc.stop(now + 0.09);

    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      const bp = this.ctx.createBiquadFilter();
      const ng = this.ctx.createGain();
      src.buffer = this.noiseBuffer;
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(4300 + Math.random()*900, now);
      bp.Q.setValueAtTime(7, now);
      ng.gain.setValueAtTime(0.0032, now);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
      src.connect(bp); bp.connect(ng); ng.connect(this.masterGain);
      src.start(now); src.stop(now + 0.03);
    }
  }

  // コリドラスの砂掘り音（細かな電子的プチプチ音）
  playCorydorasDig() {
    if (!this.isInitialized || this.isMuted || !this.noiseBuffer) return;
    // v42: CYBERでは自動短音を出さない。NATURALの砂掘り音だけ維持。
    if (this.themeMode !== "light") return;

    const now = this.ctx.currentTime;
    
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    // 砂をつつくような帯域
    filter.frequency.setValueAtTime(1800 + Math.random() * 800, now);
    filter.Q.setValueAtTime(15, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.012, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noiseSource.start(now);
    noiseSource.stop(now + 0.03);
  }

  // 戦術スキャン用のソナー・ピーン音
  playSonarPing() {
    if (!this.isInitialized || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    // 高域から始まり低域へディケイする潜水艦ソナー風の電子ピン音
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(165, now + 1.8);

    // 深みを持たせるためのフィルター
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 1.9);
  }

  // スキャンモードのオン/オフによる音響変化
  setScanMode(active) {
    this.scanModeActive = active;
    
    if (active) {
      this.playSonarPing();
      if (this.scanTimer) clearInterval(this.scanTimer);
      this.scanTimer = setInterval(() => {
        this.playSonarPing();
      }, 5000); // 5秒に1回鳴動
    } else {
      if (this.scanTimer) {
        clearInterval(this.scanTimer);
        this.scanTimer = null;
      }
    }
  }

  updateSystemParams(temp, ph) {
    if (!this.isInitialized || !this.filterNode || this.ambientNodes.length < 2) return;

    const baseTemp = 25;
    const tempRatio = temp / baseTemp;

    const newBaseFreq = 55 * tempRatio;
    const newOvertoneFreq = 110 * tempRatio;
    const newLfoFreq = 0.15 * (tempRatio * 1.5);

    this.ambientNodes[0].frequency.setTargetAtTime(newBaseFreq, this.ctx.currentTime, 0.5);
    this.ambientNodes[1].frequency.setTargetAtTime(newOvertoneFreq, this.ctx.currentTime, 0.5);
    this.ambientNodes[2].frequency.setTargetAtTime(newLfoFreq, this.ctx.currentTime, 0.5);

    const newCutoff = 180 + (ph - 7.0) * 30;
    this.filterNode.frequency.setTargetAtTime(Math.max(80, Math.min(300, newCutoff)), this.ctx.currentTime, 0.5);
  }

  setHumEnabled(enabled) {
    this.humEnabled = !!enabled;
    try { localStorage.setItem("cyberAquariumHumEnabled", this.humEnabled ? "1" : "0"); } catch (_) {}
    if (!this.ctx || !this.ambientGain) return;
    const now = this.ctx.currentTime;
    this.ambientGain.gain.cancelScheduledValues(now);
    const humLevel = this.themeMode === "light" ? 0.0283 : 0.040;
    this.ambientGain.gain.setTargetAtTime(this.humEnabled ? humLevel : 0.0, now, 0.08);
  }

  setMasterVolume(value) {
    this.masterVolume = Math.max(0, Math.min(1, parseFloat(value)));
    try { localStorage.setItem("cyberAquariumMasterVolume", String(Math.round(this.masterVolume * 100))); } catch (_) {}
    if (!this.ctx || !this.masterGain) return;
    const target = this.isMuted ? 0 : this.masterVolume * this.outputBoost;
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.06);
  }

  setMute(mute) {
    this.isMuted = mute;

    if (!this.isInitialized) {
      this.init();
    }
    if (!this.ctx || !this.masterGain) return;

    const applyState = () => {
      const now = this.ctx.currentTime;
      const targetVol = this.isMuted ? 0.0 : this.masterVolume * this.outputBoost;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(targetVol, now, this.isMuted ? 0.06 : 0.10);

      this.setScanMode(this.scanModeActive && !this.isMuted);
      if (!this.isMuted) {
        // suspended 中に作った常時音がブラウザ依存で鳴らないケースを避ける。
        // running になったユーザー操作の中で蛍光管ノードを初めて生成する。
        this.setupLightFixture();
        this.updateLightParams(this.lightIntensity);
        this.startLightAgingScheduler();
        // PAKU: skip the fluorescent-tube "starter" crackle on every sound-on -
        // it reads as a stray noise burst in this cozy reskin, not a lighting rig.

        // HUM(環境ハミング)のオシレーターも同じ理由でここまで遅延させる - 以前は
        // init() 内で(まだ確実に suspended な)コンテキストに対して start() して
        // いたため、蛍光管と同じ問題を踏んでいて「鳴ったり鳴らなかったり」の
        // 原因になっていた。
        if (!this.ambientDroneStarted) {
          this.setupAmbientDrone();
          this.ambientDroneStarted = true;
        }
      }
    };

    if (this.ctx.state === 'suspended') {
      const resumeResult = this.ctx.resume();
      if (resumeResult && typeof resumeResult.then === 'function') {
        resumeResult.then(applyState).catch(err => console.warn("AudioContext resume failed", err));
      } else {
        applyState();
      }
    } else {
      applyState();
    }
  }

  // PAKU: soft water "gloop" for a fish actually taking a food packet -
  // distinct from playFeed's rising bubble (played once, on tap/drop).
  playEatPop(pitch = 1) {
    if (!this.isInitialized || this.isMuted || !this.ctx) return;

    if (this.themeMode !== "light") {
      this.playTick(1300, 0.02);
      return;
    }

    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const startFreq = (560 + Math.random() * 160) * pitch;
    const endFreq = startFreq * 0.4;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.05);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);

    if (this.noiseBuffer) {
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = this.noiseBuffer;
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(2200 + Math.random() * 800, now);
      noiseFilter.Q.setValueAtTime(5, now);
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.007, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0006, now + 0.025);
      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      noiseSource.start(now);
      noiseSource.stop(now + 0.03);
    }
  }

  playTick(freq = 600, duration = 0.04) {
    if (!this.isInitialized || this.isMuted || !this.ctx) return;

    // CYBER: never use a sine oscillator for ticks. Even very short sine notes
    // read as a rounded "pon" on small speakers. Use a dry high-frequency data click.
    if (this.themeMode !== "light") {
      if (!this.noiseBuffer) return;
      const now = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(3200, now);
      hp.Q.setValueAtTime(0.45, now);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(8200, now);
      const gain = this.ctx.createGain();
      const dur = Math.max(0.008, Math.min(0.022, duration * 0.55));
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.016, now + 0.0015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(hp);
      hp.connect(lp);
      lp.connect(gain);
      gain.connect(this.masterGain);
      src.start(now);
      src.stop(now + dur + 0.004);
      return;
    }

    // NATURAL: retain the existing soft tonal tick.
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playSelect(isFlora = false) {
    if (!this.isInitialized || this.isMuted || !this.ctx) return;

    // CYBER: no rounded/tonal UI notes. Use one dry, filtered data click.
    if (this.themeMode !== "light") {
      if (!this.noiseBuffer) return;
      const now = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(isFlora ? 4300 : 3600, now);
      hp.Q.setValueAtTime(0.35, now);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(isFlora ? 9200 : 7800, now);
      lp.Q.setValueAtTime(0.20, now);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.014, now + 0.0015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);
      src.connect(hp);
      hp.connect(lp);
      lp.connect(gain);
      gain.connect(this.masterGain);
      src.start(now);
      src.stop(now + 0.024);
      return;
    }

    // NATURAL: retain the existing soft three-note selection cue.
    const now = this.ctx.currentTime;
    const type = isFlora ? 'triangle' : 'sine';
    const baseFreq = isFlora ? 220 : 330;
    const notes = [1, 1.25, 1.5];
    notes.forEach((ratio, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(baseFreq * ratio, now + i * 0.06);
      gain.gain.setValueAtTime(0.0, now + i * 0.06);
      gain.gain.linearRampToValueAtTime(isFlora ? 0.12 : 0.08, now + i * 0.06 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.15);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.2);
    });
  }

  playFeed() {
    this.playBubbleSound(); // 餌やりもバブル合成音を呼び出す
  }

}

const cyberAudio = new CyberAudioEngine();
window.cyberAudio = cyberAudio;
