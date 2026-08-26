"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SOUND_STORAGE_KEY = "marutibit:sound-enabled";
const SOUND_CHANGE_EVENT = "marutibit:sound-change";

const AUDIO_SRC = {
  bgm: "/audio/input-rain/game-bgm.wav",
  resultBgm: "/audio/input-rain/result-bgm.wav",
  countdown: "/audio/input-rain/countdown.wav",
  go: "/audio/input-rain/go.wav",
};

const LOOP_VOLUME = 0.7;
const ONE_SHOT_VOLUME = 0.9;
const FADE_IN_MS = 650;
const FADE_OUT_MS = 450;

/** A single loopable audio file with fade-in/out and pause-in-place support. */
class LoopTrack {
  private audio: HTMLAudioElement;
  private fadeToken = 0;

  constructor(src: string, loop: boolean) {
    this.audio = new Audio(src);
    this.audio.loop = loop;
    this.audio.preload = "auto";
    this.audio.volume = 0;
  }

  private fadeTo(target: number, duration: number, onDone?: () => void) {
    const token = (this.fadeToken += 1);
    const start = this.audio.volume;
    const startTime = performance.now();
    const step = (now: number) => {
      if (token !== this.fadeToken) return;
      const t = duration <= 0 ? 1 : Math.min(1, (now - startTime) / duration);
      this.audio.volume = start + (target - start) * t;
      if (t < 1) window.requestAnimationFrame(step);
      else onDone?.();
    };
    window.requestAnimationFrame(step);
  }

  async playFromStart(volume: number) {
    this.fadeToken += 1;
    this.audio.currentTime = 0;
    this.audio.volume = 0;
    try { await this.audio.play(); } catch { /* Blocked until the next user gesture. */ }
    this.fadeTo(volume, FADE_IN_MS);
  }

  async resumeInPlace(volume: number) {
    if (this.audio.paused) {
      try { await this.audio.play(); } catch { /* Blocked until the next user gesture. */ }
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

  teardown() {
    this.fadeToken += 1;
    this.audio.pause();
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
    void this.audio.play().catch(() => { /* Blocked until the next user gesture. */ });
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

  type() {
    this.noise(0.014, 0.035, 5200);
  }

  accept() {
    this.tone(523.25, 0.14, 0.07, "triangle");
    this.tone(783.99, 0.25, 0.052, "sine", 0.07);
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
  const activeLoopRef = useRef<LoopKind>(null);

  useEffect(() => {
    bgmRef.current = new LoopTrack(AUDIO_SRC.bgm, true);
    resultBgmRef.current = new LoopTrack(AUDIO_SRC.resultBgm, false);
    countdownRef.current = new OneShot(AUDIO_SRC.countdown);
    goRef.current = new OneShot(AUDIO_SRC.go);
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

  const playType = useCallback(() => { void ensureFeedback().then((engine) => engine?.type()); }, [ensureFeedback]);
  const playAccept = useCallback(() => { void ensureFeedback().then((engine) => engine?.accept()); }, [ensureFeedback]);
  const playMiss = useCallback(() => { void ensureFeedback().then((engine) => engine?.miss()); }, [ensureFeedback]);

  const playCountdownTick = useCallback(() => { if (enabled) countdownRef.current?.play(ONE_SHOT_VOLUME); }, [enabled]);
  const playGo = useCallback(() => { if (enabled) goRef.current?.play(ONE_SHOT_VOLUME); }, [enabled]);

  const startBgm = useCallback(() => {
    activeLoopRef.current = "bgm";
    resultBgmRef.current?.teardown();
    if (enabled && !paused) void bgmRef.current?.playFromStart(LOOP_VOLUME);
  }, [enabled, paused]);

  const startResultBgm = useCallback(() => {
    activeLoopRef.current = "resultBgm";
    bgmRef.current?.teardown();
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
    playType,
    playAccept,
    playMiss,
    playCountdownTick,
    playGo,
    startBgm,
    startResultBgm,
    stopAllLoops,
  };
}
