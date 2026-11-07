"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InputRainGenre } from "./inputRainPrompts";

const SOUND_STORAGE_KEY = "marutibit:sound-enabled";
const SOUND_CHANGE_EVENT = "marutibit:sound-change";

const TYPE_PC_FILES = [1, 2, 3, 4, 5].map((n) => `/audio/input-rain/type-pc-0${n}.wav`);
const TYPE_FLICK_FILES = [1, 2, 3, 4].map((n) => `/audio/input-rain/type-flick-0${n}.wav`);
const BACKSPACE_FILES = [1, 2].map((n) => `/audio/input-rain/backspace-0${n}.wav`);

const TYPE_VOLUME = 0.68;
const BACKSPACE_VOLUME = 0.58;

function logPlayFailure(src: string, error: unknown) {
  console.warn(`[input-rain audio] play() failed for ${src}`, error);
}

/**
 * A pool of short one-shot variants (e.g. several key-thock recordings) played at random
 * so rapid typing doesn't sound mechanically identical. Each play() spins up a fresh
 * HTMLAudioElement instead of reusing one, so overlapping hits during fast typing don't
 * cut each other off.
 */
class VariantPool {
  private files: string[];
  private warm: HTMLAudioElement[];

  constructor(files: string[]) {
    this.files = files;
    // Kept referenced (not just constructed) so the browser actually finishes
    // preloading each variant instead of aborting once the object is GC'd.
    this.warm = files.map((src) => {
      const audio = new Audio(src);
      audio.preload = "auto";
      return audio;
    });
  }

  play(volume: number) {
    const src = this.files[Math.floor(Math.random() * this.files.length)];
    const audio = new Audio(src);
    audio.volume = volume;
    void audio.play().catch((error) => logPlayFailure(src, error));
  }
}

type Voice = "glass" | "marimba" | "koto" | "blip";

type RainMusic = {
  /** MIDI notes the typing melody walks over, low to high; `home` indexes the tonic. */
  scale: number[];
  home: number;
  voice: Voice;
  reverb: number;
  /** Ambient pad chords (MIDI), one per bar. */
  chords: number[][];
  bar: number;
  /** How much of the synthesized rain bed sits under the music. */
  rain: number;
};

// Each genre types in its own scale: a major pentatonic for the everyday window, a quieter
// one for the office, miyako-bushi (the koto's scale) for the idioms, and F minor
// pentatonic over a darker synth pad for the terminal. Pentatonics mean any run of
// keystrokes lands as a phrase rather than a wrong note.
const music: Record<InputRainGenre, RainMusic> = {
  daily: {
    scale: [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86], home: 5, voice: "glass", reverb: 0.42, bar: 4,
    chords: [[50, 57, 62, 64, 66], [47, 54, 57, 62, 66], [43, 50, 54, 59, 62], [45, 52, 57, 62, 64]], rain: 1,
  },
  business: {
    scale: [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84], home: 5, voice: "marimba", reverb: 0.22, bar: 4,
    chords: [[41, 48, 52, 57, 64], [40, 47, 50, 55, 62], [38, 45, 48, 53, 60], [36, 43, 50, 52, 59]], rain: 0.8,
  },
  yoji: {
    scale: [57, 59, 60, 64, 65, 69, 71, 72, 76, 77, 81], home: 3, voice: "koto", reverb: 0.34, bar: 5,
    chords: [[40, 47, 52, 59], [41, 48, 53, 57], [40, 47, 52, 57], [45, 52, 57, 60]], rain: 0.9,
  },
  terminal: {
    scale: [65, 68, 70, 72, 75, 77, 80, 82, 84, 87, 89], home: 5, voice: "blip", reverb: 0.12, bar: 4,
    chords: [[41, 48, 56, 60, 63], [37, 44, 53, 56, 60], [39, 46, 55, 58, 63], [36, 43, 51, 55, 58]], rain: 1,
  },
};

const midiToHz = (note: number) => 440 * 2 ** ((note - 69) / 12);

/**
 * Everything INPUT RAIN synthesizes: the raindrop each correct keystroke plays, the chord
 * a finished prompt resolves to, the miss thud, the countdown, the ambient pad and rain
 * bed, and the result phrase.
 */
class RainSynth {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverbSend: GainNode | null = null;
  private ambientBus: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private music: RainMusic = music.terminal;
  private step = 0;
  private streak = 0;
  private ambientTimer: number | null = null;
  private dripTimer: number | null = null;
  private dripping = false;
  private nextBarAt = 0;
  private barIndex = 0;
  private rainLevel = 0;

  async start() {
    if (!this.context) {
      const AudioContextConstructor = window.AudioContext
        || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) throw new Error("Web Audio is not supported");
      const context = new AudioContextConstructor();
      this.context = context;
      const master = context.createGain();
      const filter = context.createBiquadFilter();
      const compressor = context.createDynamicsCompressor();
      master.gain.value = 0.52;
      filter.type = "lowpass";
      filter.frequency.value = 6500;
      compressor.threshold.value = -18;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.18;
      master.connect(filter).connect(compressor).connect(context.destination);
      this.master = master;

      const reverb = context.createConvolver();
      reverb.buffer = this.impulse(2.4);
      const send = context.createGain();
      send.gain.value = this.music.reverb;
      send.connect(reverb).connect(compressor);
      this.reverbSend = send;

      const ambient = context.createGain();
      ambient.gain.value = 0;
      ambient.connect(master);
      ambient.connect(send);
      this.ambientBus = ambient;
    }
    if (this.context.state === "suspended") await this.context.resume();
  }

  setGenre(genre: InputRainGenre) {
    this.music = music[genre];
    if (this.reverbSend && this.context) this.reverbSend.gain.setTargetAtTime(this.music.reverb, this.context.currentTime, 0.05);
  }

  private impulse(seconds: number) {
    const context = this.context!;
    const length = Math.round(context.sampleRate * seconds);
    const buffer = context.createBuffer(2, length, context.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** 3.2;
    }
    return buffer;
  }

  private out(node: AudioNode, send = 1) {
    if (!this.master || !this.reverbSend) return;
    node.connect(this.master);
    if (send > 0) {
      const wet = this.context!.createGain();
      wet.gain.value = send;
      node.connect(wet).connect(this.reverbSend);
    }
  }

  private tone(frequency: number, duration: number, volume: number, type: OscillatorType = "sine", delay = 0) {
    if (!this.context || !this.master) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.018, duration * 0.2));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    this.out(envelope, 0.4);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private noise(duration: number, volume: number, frequency: number, delay = 0, q = 1.4) {
    if (!this.context || !this.master) return;
    const length = Math.max(1, Math.round(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** 2;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = q;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter).connect(gain);
    this.out(gain, 0.5);
    source.start(this.context.currentTime + delay);
  }

  /** One plucked note in the genre's voice. */
  private pluck(note: number, volume: number, delay = 0) {
    const context = this.context;
    if (!context) return;
    const frequency = midiToHz(note);
    const start = context.currentTime + delay;
    const voice = this.music.voice;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    this.out(envelope, 1);

    const partial = (ratio: number, type: OscillatorType, level: number, decay: number, bend = 1) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency * ratio * bend, start);
      if (bend !== 1) oscillator.frequency.exponentialRampToValueAtTime(frequency * ratio, start + 0.05);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(level, start + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
      oscillator.connect(gain).connect(envelope);
      oscillator.start(start);
      oscillator.stop(start + decay + 0.05);
    };

    envelope.gain.exponentialRampToValueAtTime(volume, start + 0.003);
    if (voice === "glass") {
      // A water drop: the pitch slips up into the note, with a glassy octave on top.
      partial(1, "sine", 1, 0.62, 0.94);
      partial(2, "sine", 0.28, 0.3, 0.97);
      partial(3.01, "sine", 0.08, 0.12);
    } else if (voice === "marimba") {
      partial(1, "sine", 1, 0.34);
      partial(4, "sine", 0.22, 0.05);
      partial(10, "sine", 0.05, 0.02);
    } else if (voice === "koto") {
      // Koto: a bright plucked string that settles from just under the note (oshi-de feel).
      const oscillator = context.createOscillator();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      oscillator.type = "sawtooth";
      oscillator.frequency.setValueAtTime(frequency * 0.982, start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency, start + 0.07);
      filter.type = "lowpass";
      filter.Q.value = 2;
      filter.frequency.setValueAtTime(Math.min(7000, frequency * 9), start);
      filter.frequency.exponentialRampToValueAtTime(Math.max(300, frequency * 1.6), start + 0.45);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.5, start + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.1);
      oscillator.connect(filter).connect(gain).connect(envelope);
      oscillator.start(start);
      oscillator.stop(start + 1.15);
      partial(1, "triangle", 0.55, 0.9, 0.982);
    } else {
      partial(1, "square", 0.32, 0.11);
      partial(2, "sine", 0.18, 0.06);
    }
    envelope.gain.setValueAtTime(volume, start + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + (voice === "koto" ? 1.2 : voice === "glass" ? 0.7 : 0.4));
  }

  /** Starts each prompt's melody back at home, so every line reads as its own phrase. */
  resetPhrase() {
    this.step = this.music.home;
  }

  /** One correct keystroke: the next note of a wandering melody, thickening with the streak. */
  drop(volume = 1) {
    if (!this.context) return;
    const scale = this.music.scale;
    const moves = [-2, -1, -1, 0, 1, 1, 2];
    let move = moves[Math.floor(Math.random() * moves.length)];
    // Gently pulled back toward home so long lines don't drift out of the register.
    if (this.step - this.music.home > 3 && move > 0) move = -move;
    if (this.music.home - this.step > 3 && move < 0) move = -move;
    this.step = Math.max(0, Math.min(scale.length - 1, this.step + move));
    this.streak += 1;
    const note = scale[this.step];
    const level = 0.2 * volume;
    this.pluck(note, level);
    if (this.streak >= 24) this.pluck(note + 12, level * 0.3, 0.012);
    if (this.streak >= 60) this.pluck(scale[Math.min(scale.length - 1, this.step + 2)], level * 0.32, 0.024);
  }

  /** A finished prompt resolves to a rising chord from home, with a little splash. */
  accept() {
    if (!this.context) return;
    const { scale, home } = this.music;
    [0, 2, 4, 5].forEach((offset, index) => {
      const note = scale[Math.min(scale.length - 1, home + offset)];
      this.pluck(note, 0.15 - index * 0.015, index * 0.055);
    });
    if (this.music.voice !== "blip") {
      this.noise(0.22, 0.05, 2600, 0, 0.9);
      this.tone(320, 0.14, 0.06, "sine");
    }
    this.step = home;
  }

  miss() {
    this.streak = 0;
    this.noise(0.08, 0.065, 1100);
    this.tone(92.5, 0.18, 0.045, "sine");
  }

  timeout() {
    this.streak = 0;
    const { scale, home } = this.music;
    this.pluck(scale[Math.max(0, home - 1)], 0.1);
    this.pluck(scale[Math.max(0, home - 3)], 0.09, 0.12);
    this.tone(70, 0.4, 0.05, "sine", 0.1);
  }

  /** Countdown pips: three notes climbing to home. */
  countdown(remaining: number) {
    const { scale, home } = this.music;
    this.pluck(scale[Math.max(0, home - remaining)], 0.14);
  }

  /**
   * The result's own music: a short phrase in the genre's voice (brighter the better the
   * run), after which the eaves keep dripping — sparse notes from the same scale under
   * the pad, so the result sounds like the rain has just stopped rather than like silence.
   */
  resultJingle(mood: "excellent" | "good" | "retry") {
    if (!this.context) return;
    const { scale, home } = this.music;
    const at = (offset: number) => scale[Math.max(0, Math.min(scale.length - 1, home + offset))];
    const phrase = mood === "excellent"
      ? [[0, 0], [2, 0.13], [4, 0.26], [5, 0.39], [4, 0.6], [5, 0.74]]
      : mood === "good"
        ? [[0, 0], [2, 0.16], [4, 0.32], [2, 0.56], [4, 0.72]]
        : [[2, 0], [1, 0.22], [0, 0.5]];
    phrase.forEach(([offset, delay]) => this.pluck(at(offset), 0.17, delay));
    const end = phrase[phrase.length - 1][1] + 0.22;
    const chord = mood === "retry" ? [-2, 0, 2] : [0, 2, 4, 7];
    chord.forEach((offset, index) => this.pluck(at(offset), 0.12 - index * 0.012, end + index * 0.025));
    this.dripping = true;
    if (this.dripTimer !== null) window.clearTimeout(this.dripTimer);
    this.dripTimer = window.setTimeout(() => this.drip(), (end + 1.6) * 1000);
  }

  private drip() {
    this.dripTimer = null;
    if (!this.dripping || !this.context) return;
    const { scale, home } = this.music;
    const pool = scale.slice(Math.max(0, home - 1), Math.min(scale.length, home + 5));
    this.pluck(pool[Math.floor(Math.random() * pool.length)], 0.05 + Math.random() * 0.04);
    // Now and then two drops fall close together, as off a real gutter.
    if (Math.random() < 0.3) this.pluck(pool[Math.floor(Math.random() * pool.length)], 0.04, 0.16 + Math.random() * 0.1);
    this.dripTimer = window.setTimeout(() => this.drip(), 650 + Math.random() * 1500);
  }

  startAmbient() {
    const context = this.context;
    if (!context || !this.ambientBus) return;
    this.startRainBed();
    if (this.dripping && this.dripTimer === null) this.dripTimer = window.setTimeout(() => this.drip(), 600);
    this.ambientBus.gain.cancelScheduledValues(context.currentTime);
    this.ambientBus.gain.setTargetAtTime(1, context.currentTime, 0.6);
    if (this.ambientTimer !== null || !this.music.chords.length) return;
    this.nextBarAt = context.currentTime + 0.05;
    // Scheduled a little ahead on the audio clock; the timer only tops the queue up.
    this.ambientTimer = window.setInterval(() => this.scheduleBars(), 250);
    this.scheduleBars();
  }

  pauseAmbient() {
    const context = this.context;
    if (!context || !this.ambientBus) return;
    this.ambientBus.gain.cancelScheduledValues(context.currentTime);
    this.ambientBus.gain.setTargetAtTime(0, context.currentTime, 0.15);
    if (this.ambientTimer !== null) window.clearInterval(this.ambientTimer);
    this.ambientTimer = null;
    if (this.dripTimer !== null) window.clearTimeout(this.dripTimer);
    this.dripTimer = null;
  }

  stopAmbient() {
    this.pauseAmbient();
    this.dripping = false;
    this.barIndex = 0;
    const source = this.rainSource;
    this.rainSource = null;
    if (source && this.context) {
      try { source.stop(this.context.currentTime + 1); } catch { /* Already stopped. */ }
    }
  }

  setRain(strength: number) {
    this.rainLevel = strength;
    if (this.rainGain && this.context) {
      this.rainGain.gain.setTargetAtTime((0.012 + strength * 0.07) * this.music.rain, this.context.currentTime, 0.25);
    }
  }

  /** A soft hiss of rain under the music that swells with the typing. */
  private startRainBed() {
    const context = this.context;
    if (!context || !this.ambientBus || this.rainSource) return;
    const length = context.sampleRate * 3;
    const buffer = context.createBuffer(2, length, context.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      let brown = 0;
      for (let index = 0; index < length; index += 1) {
        const white = Math.random() * 2 - 1;
        brown = (brown + 0.02 * white) / 1.02;
        // Mostly white for the hiss, a little brown for the body, plus sparse droplets.
        data[index] = white * 0.55 + brown * 2.4 + (Math.random() < 0.0009 ? (Math.random() - 0.5) * 3 : 0);
      }
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const highpass = context.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 420;
    const lowpass = context.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 5200;
    const gain = context.createGain();
    gain.gain.value = 0;
    source.connect(highpass).connect(lowpass).connect(gain).connect(this.ambientBus);
    source.start();
    this.rainSource = source;
    this.rainGain = gain;
    this.setRain(this.rainLevel);
  }

  private scheduleBars() {
    const context = this.context;
    if (!context || !this.ambientBus) return;
    const { chords, bar } = this.music;
    if (!chords.length) return;
    while (this.nextBarAt < context.currentTime + 0.6) {
      const chord = chords[this.barIndex % chords.length];
      chord.forEach((note, index) => this.padVoice(note, this.nextBarAt, bar, index === 0 ? 0.024 : 0.017));
      this.nextBarAt += bar;
      this.barIndex += 1;
    }
  }

  private padVoice(note: number, start: number, length: number, level: number) {
    const context = this.context;
    if (!context || !this.ambientBus) return;
    const frequency = midiToHz(note);
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    const voice = this.music.voice;
    filter.frequency.value = voice === "koto" ? 900 : voice === "blip" ? 850 : 1300;
    if (voice === "blip") level *= 0.6;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + 1.3);
    gain.gain.setValueAtTime(level, start + length);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length + 1.8);
    filter.connect(gain).connect(this.ambientBus);
    [-4, 4].forEach((cents) => {
      const oscillator = context.createOscillator();
      oscillator.type = voice === "marimba" ? "sine" : voice === "blip" ? "sawtooth" : "triangle";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = cents;
      oscillator.connect(filter);
      oscillator.start(start);
      oscillator.stop(start + length + 1.9);
    });
  }

  stop() {
    if (this.ambientTimer !== null) window.clearInterval(this.ambientTimer);
    this.ambientTimer = null;
    if (this.dripTimer !== null) window.clearTimeout(this.dripTimer);
    this.dripTimer = null;
    this.dripping = false;
    this.rainSource = null;
    this.rainGain = null;
    if (this.context) void this.context.close();
    this.context = null;
    this.master = null;
    this.reverbSend = null;
    this.ambientBus = null;
  }
}

export function useInputRainAudio(paused = false, genre: InputRainGenre = "terminal") {
  const [enabled, setEnabled] = useState(false);
  const feedbackRef = useRef<RainSynth | null>(null);
  const genreRef = useRef(genre);
  const typePcRef = useRef<VariantPool | null>(null);
  const typeFlickRef = useRef<VariantPool | null>(null);
  const backspaceRef = useRef<VariantPool | null>(null);
  const ambientActiveRef = useRef(false);

  useEffect(() => {
    typePcRef.current = new VariantPool(TYPE_PC_FILES);
    typeFlickRef.current = new VariantPool(TYPE_FLICK_FILES);
    backspaceRef.current = new VariantPool(BACKSPACE_FILES);
  }, []);

  useEffect(() => {
    genreRef.current = genre;
    feedbackRef.current?.setGenre(genre);
  }, [genre]);

  const savePreference = useCallback((next: boolean) => {
    try { localStorage.setItem(SOUND_STORAGE_KEY, next ? "true" : "false"); } catch { /* Optional. */ }
    window.dispatchEvent(new CustomEvent<boolean>(SOUND_CHANGE_EVENT, { detail: next }));
  }, []);

  const ensureFeedback = useCallback(async () => {
    if (!enabled) return null;
    if (!feedbackRef.current) {
      feedbackRef.current = new RainSynth();
      feedbackRef.current.setGenre(genreRef.current);
    }
    await feedbackRef.current.start();
    return feedbackRef.current;
  }, [enabled]);

  const toggle = useCallback(async () => {
    if (enabled) {
      feedbackRef.current?.stop();
      feedbackRef.current = null;
      setEnabled(false);
      savePreference(false);
      return;
    }
    const engine = new RainSynth();
    engine.setGenre(genreRef.current);
    try {
      await engine.start();
      feedbackRef.current = engine;
      setEnabled(true);
      savePreference(true);
    } catch {
      engine.stop();
    }
  }, [enabled, savePreference]);

  // Called from the START tap itself: the countdown that follows runs on timers, which
  // don't count as a user gesture, so the audio context has to be woken up here.
  const prime = useCallback(() => { void ensureFeedback(); }, [ensureFeedback]);

  const withSynth = useCallback((run: (engine: RainSynth) => void) => {
    void ensureFeedback().then((engine) => { if (engine) run(engine); });
  }, [ensureFeedback]);

  // The recorded key thock stays underneath as the tactile part; the raindrop note carries
  // the music.
  const thockVolume = TYPE_VOLUME * 0.42;

  const playMiss = useCallback(() => withSynth((engine) => engine.miss()), [withSynth]);
  const playTimeout = useCallback(() => withSynth((engine) => engine.timeout()), [withSynth]);
  const resetPhrase = useCallback(() => feedbackRef.current?.resetPhrase(), []);
  const setRainStrength = useCallback((strength: number) => feedbackRef.current?.setRain(strength), []);

  const playAccept = useCallback(() => withSynth((engine) => engine.accept()), [withSynth]);
  const playCountdownTick = useCallback((remaining: number) => withSynth((engine) => engine.countdown(remaining)), [withSynth]);
  const playGo = useCallback(() => withSynth((engine) => engine.accept()), [withSynth]);
  const playTypeKey = useCallback(() => {
    if (!enabled) return;
    typePcRef.current?.play(thockVolume);
    withSynth((engine) => engine.drop());
  }, [enabled, thockVolume, withSynth]);
  const playTypeFlick = useCallback(() => {
    if (!enabled) return;
    typeFlickRef.current?.play(thockVolume);
    withSynth((engine) => engine.drop());
  }, [enabled, thockVolume, withSynth]);
  const playBackspace = useCallback(() => { if (enabled) backspaceRef.current?.play(BACKSPACE_VOLUME); }, [enabled]);

  const startBgm = useCallback(() => {
    ambientActiveRef.current = true;
    if (!enabled || paused) return;
    withSynth((engine) => engine.startAmbient());
  }, [enabled, paused, withSynth]);

  // The result stays in the genre's own music: the same pad carries on, the rain dies
  // away, and a closing phrase marks the end.
  const startResultBgm = useCallback((mood: "excellent" | "good" | "retry" = "good") => {
    ambientActiveRef.current = true;
    if (enabled && !paused) withSynth((engine) => { engine.setRain(0.04); engine.resultJingle(mood); engine.startAmbient(); });
  }, [enabled, paused, withSynth]);

  const stopAllLoops = useCallback(() => {
    ambientActiveRef.current = false;
    feedbackRef.current?.stopAmbient();
  }, []);

  // Keep the ambient music in sync with the shared mute flag and the pause state.
  useEffect(() => {
    if (!ambientActiveRef.current) return;
    if (!enabled || paused) {
      feedbackRef.current?.pauseAmbient();
      return;
    }
    withSynth((engine) => engine.startAmbient());
  }, [enabled, paused, withSynth]);

  useEffect(() => {
    const apply = (next: boolean) => {
      setEnabled(next);
      if (!next) {
        feedbackRef.current?.stop();
        feedbackRef.current = null;
      }
    };
    try { apply(localStorage.getItem(SOUND_STORAGE_KEY) === "true"); } catch { /* Default OFF. */ }
    const onStorage = (event: StorageEvent) => { if (event.key === SOUND_STORAGE_KEY) apply(event.newValue === "true"); };
    const onChange = (event: Event) => apply(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("storage", onStorage);
    window.addEventListener(SOUND_CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SOUND_CHANGE_EVENT, onChange);
    };
  }, []);

  useEffect(() => () => feedbackRef.current?.stop(), []);

  return {
    enabled,
    toggle,
    prime,
    playTypeKey,
    playTypeFlick,
    playBackspace,
    playAccept,
    playMiss,
    playTimeout,
    playCountdownTick,
    playGo,
    resetPhrase,
    setRainStrength,
    startBgm,
    startResultBgm,
    stopAllLoops,
  };
}
