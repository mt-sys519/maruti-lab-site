"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SOUND_STORAGE_KEY = "marutibit:sound-enabled";
const SOUND_CHANGE_EVENT = "marutibit:sound-change";

class InputRainAudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private pulseTimer: number | null = null;
  private step = 0;

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
    this.startPulse();
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

  private startPulse() {
    if (this.pulseTimer !== null) return;
    const pulse = () => {
      const low = [65.41, 73.42, 82.41, 73.42][this.step % 4];
      this.tone(low, 0.16, this.step % 4 === 0 ? 0.05 : 0.028, "triangle");
      if (this.step % 2 === 1) this.tone(1046.5, 0.028, 0.012, "sine", 0.11);
      this.step = (this.step + 1) % 16;
    };
    pulse();
    this.pulseTimer = window.setInterval(pulse, 430);
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

  result() {
    [392, 523.25, 659.25].forEach((frequency, index) => this.tone(frequency, 0.65, 0.045, index === 1 ? "triangle" : "sine", index * 0.07));
  }

  async suspend() {
    if (this.pulseTimer !== null) window.clearInterval(this.pulseTimer);
    this.pulseTimer = null;
    if (this.context?.state === "running") await this.context.suspend();
  }

  async resume() {
    if (!this.context) return;
    if (this.context.state === "suspended") await this.context.resume();
    this.startPulse();
  }

  stop() {
    if (this.pulseTimer !== null) window.clearInterval(this.pulseTimer);
    this.pulseTimer = null;
    if (this.context) void this.context.close();
    this.context = null;
    this.master = null;
  }
}

export function useInputRainAudio(paused = false) {
  const [enabled, setEnabled] = useState(false);
  const engineRef = useRef<InputRainAudioEngine | null>(null);

  const savePreference = useCallback((next: boolean) => {
    try { localStorage.setItem(SOUND_STORAGE_KEY, next ? "true" : "false"); } catch { /* Optional. */ }
    window.dispatchEvent(new CustomEvent<boolean>(SOUND_CHANGE_EVENT, { detail: next }));
  }, []);

  const ensure = useCallback(async () => {
    if (!enabled) return null;
    if (!engineRef.current) engineRef.current = new InputRainAudioEngine();
    await engineRef.current.start();
    return engineRef.current;
  }, [enabled]);

  const toggle = useCallback(async () => {
    if (enabled) {
      engineRef.current?.stop();
      engineRef.current = null;
      setEnabled(false);
      savePreference(false);
      return;
    }
    const engine = new InputRainAudioEngine();
    try {
      await engine.start();
      engineRef.current = engine;
      setEnabled(true);
      savePreference(true);
    } catch {
      engine.stop();
    }
  }, [enabled, savePreference]);

  const playType = useCallback(() => { void ensure().then((engine) => engine?.type()); }, [ensure]);
  const playAccept = useCallback(() => { void ensure().then((engine) => engine?.accept()); }, [ensure]);
  const playMiss = useCallback(() => { void ensure().then((engine) => engine?.miss()); }, [ensure]);
  const playResult = useCallback(() => { void ensure().then((engine) => engine?.result()); }, [ensure]);
  const resume = useCallback(async () => { await ensure(); }, [ensure]);
  const suspend = useCallback(async () => { await engineRef.current?.suspend(); }, []);

  useEffect(() => {
    const apply = (next: boolean) => {
      setEnabled(next);
      if (!next) {
        engineRef.current?.stop();
        engineRef.current = null;
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

  useEffect(() => {
    if (!enabled || !engineRef.current) return;
    if (paused) void engineRef.current.suspend();
    else void engineRef.current.resume();
  }, [enabled, paused]);

  useEffect(() => () => engineRef.current?.stop(), []);

  return { enabled, toggle, playType, playAccept, playMiss, playResult, resume, suspend };
}
