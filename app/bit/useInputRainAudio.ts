"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SOUND_STORAGE_KEY = "marutibit:sound-enabled";
const SOUND_CHANGE_EVENT = "marutibit:sound-change";

const AUDIO_SRC = {
  bgm: "/audio/input-rain/game-bgm.wav",
  resultBgm: "/audio/input-rain/result-bgm.wav",
  countdown: "/audio/input-rain/countdown.wav",
  go: "/audio/input-rain/go.wav",
  acceptRain: "/audio/input-rain/accept-rain.wav",
};

const TYPE_PC_FILES = [1, 2, 3, 4, 5].map((n) => `/audio/input-rain/type-pc-0${n}.wav`);
const TYPE_FLICK_FILES = [1, 2, 3, 4].map((n) => `/audio/input-rain/type-flick-0${n}.wav`);
const BACKSPACE_FILES = [1, 2].map((n) => `/audio/input-rain/backspace-0${n}.wav`);

const LOOP_VOLUME = 0.48;
const ONE_SHOT_VOLUME = 0.65;
const ACCEPT_VOLUME = 0.52;
const GO_VOLUME = 0.4;
const TYPE_VOLUME = 0.68;
const BACKSPACE_VOLUME = 0.58;
const FADE_IN_MS = 650;
const FADE_OUT_MS = 450;
const BGM_BASS_CUT_DB = -9;
const BGM_BASS_CUT_HZ = 140;

function logPlayFailure(src: string, error: unknown) {
  console.warn(`[input-rain audio] play() failed for ${src}`, error);
}

/** A single loopable audio file with fade-in/out and pause-in-place support. */
class LoopTrack {
  private audio: HTMLAudioElement;
  private fadeToken = 0;
  private gainNode: GainNode | null = null;
  private currentVolume = 0;

  // tameBass routes playback through a lowshelf filter instead of straight to the
  // element's own output, to knock down an overly punchy kick drum in the mix that
  // plain HTMLMediaElement.volume can't selectively target (it's a flat attenuation).
  constructor(src: string, loop: boolean, tameBass = false) {
    this.audio = new Audio(src);
    this.audio.loop = loop;
    this.audio.preload = "auto";
    this.audio.volume = 0;
    if (tameBass) this.setupBassFilter();
  }

  private setupBassFilter() {
    try {
      const AudioContextConstructor = window.AudioContext
        || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) return;
      const context = new AudioContextConstructor();
      const source = context.createMediaElementSource(this.audio);
      const bassCut = context.createBiquadFilter();
      bassCut.type = "lowshelf";
      bassCut.frequency.value = BGM_BASS_CUT_HZ;
      bassCut.gain.value = BGM_BASS_CUT_DB;
      const gainNode = context.createGain();
      gainNode.gain.value = 0;
      source.connect(bassCut).connect(gainNode).connect(context.destination);
      this.audio.volume = 1;
      this.gainNode = gainNode;
    } catch (error) {
      logPlayFailure(this.audio.src, error);
    }
  }

  private getVolume() {
    return this.currentVolume;
  }

  private setVolume(value: number) {
    this.currentVolume = value;
    if (this.gainNode) this.gainNode.gain.value = value;
    else this.audio.volume = value;
  }

  // Driven by setInterval rather than requestAnimationFrame so the fade still runs
  // (and stays audible) in a backgrounded/unfocused tab, where rAF can be throttled
  // to a near-stop but timers keep firing.
  private fadeTo(target: number, duration: number, onDone?: () => void) {
    const token = (this.fadeToken += 1);
    const start = this.getVolume();
    const startTime = performance.now();
    const STEP_MS = 30;
    const timer = window.setInterval(() => {
      if (token !== this.fadeToken) { window.clearInterval(timer); return; }
      const t = duration <= 0 ? 1 : Math.min(1, (performance.now() - startTime) / duration);
      this.setVolume(start + (target - start) * t);
      if (t >= 1) { window.clearInterval(timer); onDone?.(); }
    }, STEP_MS);
  }

  async playFromStart(volume: number) {
    this.fadeToken += 1;
    this.audio.currentTime = 0;
    this.setVolume(0);
    if (this.gainNode?.context.state === "suspended") await this.gainNode.context.resume();
    try { await this.audio.play(); } catch (error) { logPlayFailure(this.audio.src, error); }
    this.fadeTo(volume, FADE_IN_MS);
  }

  async resumeInPlace(volume: number) {
    if (this.gainNode?.context.state === "suspended") await this.gainNode.context.resume();
    if (this.audio.paused) {
      try { await this.audio.play(); } catch (error) { logPlayFailure(this.audio.src, error); }
    }
    this.fadeTo(volume, FADE_IN_MS);
  }

  /** Fades out and pauses, keeping playback position for a later resumeInPlace(). */
  pauseFaded() {
    this.fadeTo(0, FADE_OUT_MS, () => this.audio.pause());
  }

  /** Fades out, pauses, and rewinds so the next playFromStart() begins clean. */
  stopFaded() {
    this.fadeTo(0, FADE_OUT_MS, () => {
      this.audio.pause();
      this.audio.currentTime = 0;
    });
  }

  /** Immediately stops playback without tearing down the audio graph, so the track can
   * still be resumed later (used when switching between the game and result loops). */
  stop() {
    this.fadeToken += 1;
    this.audio.pause();
  }

  teardown() {
    this.stop();
    if (this.gainNode) void this.gainNode.context.close();
  }
}

/** A short, non-looping cue that always restarts from the top when played. */
class OneShot {
  private audio: HTMLAudioElement;

  constructor(src: string) {
    this.audio = new Audio(src);
    this.audio.preload = "auto";
  }

  play(volume: number) {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.volume = volume;
    void this.audio.play().catch((error) => logPlayFailure(this.audio.src, error));
  }
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

/** Synthesized per-keystroke feedback; unrelated to the authored BGM/stinger files. */
class KeyFeedbackEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;

  async start() {
    if (!this.context) {
      const AudioContextConstructor = window.AudioContext
        || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) throw new Error("Web Audio is not supported");
      this.context = new AudioContextConstructor();
      const master = this.context.createGain();
      const filter = this.context.createBiquadFilter();
      const compressor = this.context.createDynamicsCompressor();
      master.gain.value = 0.52;
      filter.type = "lowpass";
      filter.frequency.value = 4300;
      compressor.threshold.value = -18;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.18;
      master.connect(filter).connect(compressor).connect(this.context.destination);
      this.master = master;
    }
    if (this.context.state === "suspended") await this.context.resume();
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
    oscillator.connect(envelope).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private noise(duration: number, volume: number, frequency: number) {
    if (!this.context || !this.master) return;
    const length = Math.max(1, Math.round(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = 1.4;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
  }

  miss() {
    this.noise(0.08, 0.065, 1100);
    this.tone(92.5, 0.18, 0.045, "sine");
  }

  stop() {
    if (this.context) void this.context.close();
    this.context = null;
    this.master = null;
  }
}

type LoopKind = "bgm" | "resultBgm" | null;

export function useInputRainAudio(paused = false) {
  const [enabled, setEnabled] = useState(false);
  const feedbackRef = useRef<KeyFeedbackEngine | null>(null);
  const bgmRef = useRef<LoopTrack | null>(null);
  const resultBgmRef = useRef<LoopTrack | null>(null);
  const countdownRef = useRef<OneShot | null>(null);
  const goRef = useRef<OneShot | null>(null);
  const acceptRef = useRef<OneShot | null>(null);
  const typePcRef = useRef<VariantPool | null>(null);
  const typeFlickRef = useRef<VariantPool | null>(null);
  const backspaceRef = useRef<VariantPool | null>(null);
  const activeLoopRef = useRef<LoopKind>(null);

  useEffect(() => {
    bgmRef.current = new LoopTrack(AUDIO_SRC.bgm, true, true);
    resultBgmRef.current = new LoopTrack(AUDIO_SRC.resultBgm, false);
    countdownRef.current = new OneShot(AUDIO_SRC.countdown);
    goRef.current = new OneShot(AUDIO_SRC.go);
    acceptRef.current = new OneShot(AUDIO_SRC.acceptRain);
    typePcRef.current = new VariantPool(TYPE_PC_FILES);
    typeFlickRef.current = new VariantPool(TYPE_FLICK_FILES);
    backspaceRef.current = new VariantPool(BACKSPACE_FILES);
    return () => {
      bgmRef.current?.teardown();
      resultBgmRef.current?.teardown();
    };
  }, []);

  const savePreference = useCallback((next: boolean) => {
    try { localStorage.setItem(SOUND_STORAGE_KEY, next ? "true" : "false"); } catch { /* Optional. */ }
    window.dispatchEvent(new CustomEvent<boolean>(SOUND_CHANGE_EVENT, { detail: next }));
  }, []);

  const ensureFeedback = useCallback(async () => {
    if (!enabled) return null;
    if (!feedbackRef.current) feedbackRef.current = new KeyFeedbackEngine();
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
    const engine = new KeyFeedbackEngine();
    try {
      await engine.start();
      feedbackRef.current = engine;
      setEnabled(true);
      savePreference(true);
    } catch {
      engine.stop();
    }
  }, [enabled, savePreference]);

  const playMiss = useCallback(() => { void ensureFeedback().then((engine) => engine?.miss()); }, [ensureFeedback]);

  const playAccept = useCallback(() => { if (enabled) acceptRef.current?.play(ACCEPT_VOLUME); }, [enabled]);
  const playCountdownTick = useCallback(() => { if (enabled) countdownRef.current?.play(ONE_SHOT_VOLUME); }, [enabled]);
  const playGo = useCallback(() => { if (enabled) goRef.current?.play(GO_VOLUME); }, [enabled]);
  const playTypeKey = useCallback(() => { if (enabled) typePcRef.current?.play(TYPE_VOLUME); }, [enabled]);
  const playTypeFlick = useCallback(() => { if (enabled) typeFlickRef.current?.play(TYPE_VOLUME); }, [enabled]);
  const playBackspace = useCallback(() => { if (enabled) backspaceRef.current?.play(BACKSPACE_VOLUME); }, [enabled]);

  const startBgm = useCallback(() => {
    activeLoopRef.current = "bgm";
    resultBgmRef.current?.stop();
    if (enabled && !paused) void bgmRef.current?.playFromStart(LOOP_VOLUME);
  }, [enabled, paused]);

  const startResultBgm = useCallback(() => {
    activeLoopRef.current = "resultBgm";
    bgmRef.current?.stop();
    if (enabled && !paused) void resultBgmRef.current?.playFromStart(LOOP_VOLUME);
  }, [enabled, paused]);

  const stopAllLoops = useCallback(() => {
    activeLoopRef.current = null;
    bgmRef.current?.stopFaded();
    resultBgmRef.current?.stopFaded();
  }, []);

  // Keep whichever loop is "active" in sync with the shared mute flag and the pause state,
  // fading out (keeping position) on pause/mute and fading back in on resume/unmute.
  useEffect(() => {
    const active = activeLoopRef.current;
    const track = active === "bgm" ? bgmRef.current : active === "resultBgm" ? resultBgmRef.current : null;
    if (!track) return;
    if (!enabled || paused) track.pauseFaded();
    else void track.resumeInPlace(LOOP_VOLUME);
  }, [enabled, paused]);

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
    playTypeKey,
    playTypeFlick,
    playBackspace,
    playAccept,
    playMiss,
    playCountdownTick,
    playGo,
    startBgm,
    startResultBgm,
    stopAllLoops,
  };
}
