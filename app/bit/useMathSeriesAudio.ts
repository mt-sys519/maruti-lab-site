"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MathAudioScene = "thinking" | "result";

const SOUND_STORAGE_KEY = "marutibit:sound-enabled";
const SOUND_CHANGE_EVENT = "marutibit:sound-change";

type OscillatorKind = OscillatorType;

class MathSeriesAudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private echoInput: GainNode | null = null;
  private timer: number | null = null;
  private scene: MathAudioScene = "thinking";
  private step = 0;

  async start(scene: MathAudioScene) {
    if (!this.context) {
      const AudioContextConstructor = window.AudioContext
        || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) throw new Error("Web Audio is not supported");
      this.context = new AudioContextConstructor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.6;
      const toneFilter = this.context.createBiquadFilter();
      const compressor = this.context.createDynamicsCompressor();
      toneFilter.type = "lowpass";
      toneFilter.frequency.value = 5400;
      toneFilter.Q.value = 0.45;
      compressor.threshold.value = -22;
      compressor.knee.value = 18;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.006;
      compressor.release.value = 0.24;
      this.master.connect(toneFilter).connect(compressor).connect(this.context.destination);

      const delay = this.context.createDelay(0.5);
      const feedback = this.context.createGain();
      const wet = this.context.createGain();
      this.echoInput = this.context.createGain();
      delay.delayTime.value = 0.145;
      feedback.gain.value = 0.16;
      wet.gain.value = 0.14;
      this.echoInput.gain.value = 0.24;
      this.echoInput.connect(delay);
      delay.connect(feedback).connect(delay);
      delay.connect(wet).connect(this.master);
    }
    if (this.context.state === "suspended") await this.context.resume();
    this.setScene(scene);
  }

  setScene(scene: MathAudioScene) {
    if (!this.context || !this.master) return;
    if (this.scene === scene && this.timer !== null) return;
    this.scene = scene;
    this.step = 0;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.playSceneStep();
    const beat = scene === "thinking" ? 455 : 520;
    this.timer = window.setInterval(() => this.playSceneStep(), beat);
  }

  private tone(frequency: number, start: number, duration: number, volume: number, kind: OscillatorKind = "sine") {
    if (!this.context || !this.master) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = kind;
    oscillator.frequency.setValueAtTime(frequency, start);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.045, duration * 0.2));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    if (this.echoInput) envelope.connect(this.echoInput);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  private chord(frequencies: number[], start: number, duration: number, volume: number) {
    frequencies.forEach((frequency, index) => {
      this.tone(frequency, start + index * 0.018, duration, volume, index % 2 === 0 ? "sine" : "triangle");
    });
  }

  private softClick(start: number, accented = false) {
    this.tone(accented ? 1320 : 920, start, accented ? 0.055 : 0.035, accented ? 0.045 : 0.025, "triangle");
  }

  private triangleAccent(start: number, frequency: number) {
    this.tone(frequency, start, 1.15, 0.055, "triangle");
    this.tone(frequency * 2, start + 0.012, 0.72, 0.018, "sine");
  }

  private playSceneStep() {
    if (!this.context) return;
    const now = this.context.currentTime + 0.025;
    if (this.scene === "thinking") {
      // 132 BPM: short pulses and a clipped off-beat figure keep the player
      // alert without turning the loop into a melody or a relaxation pad.
      const pulse = [130.81, 146.83, 164.81, 146.83];
      const ostinato = [659.25, 783.99, 698.46, 880, 783.99, 698.46, 587.33, 698.46, 659.25, 880, 783.99, 698.46, 659.25, 587.33, 698.46, 783.99];
      this.tone(pulse[this.step % pulse.length], now, 0.2, this.step % 4 === 0 ? 0.075 : 0.052, "triangle");
      this.softClick(now, this.step % 4 === 0);
      const pluck = ostinato[this.step % ostinato.length];
      this.tone(pluck, now + 0.205, 0.115, this.step % 4 === 3 ? 0.035 : 0.044, "triangle");
      this.tone(pluck * 2, now + 0.21, 0.075, 0.009, "sine");
      if (this.step % 8 === 6) this.triangleAccent(now + 0.19, 1174.66);
    } else {
      const resultChords = [
        [349.23, 440, 523.25],
        [392, 493.88, 587.33],
        [329.63, 415.3, 523.25],
        [440, 523.25, 659.25],
      ];
      if (this.step % 4 === 0) {
        const chord = resultChords[(this.step / 4) % resultChords.length];
        this.chord(chord, now, 1.55, 0.062);
        this.tone(chord[0] / 2, now, 1.35, 0.026, "sine");
      }
      const arpeggio = [659.25, 783.99, 987.77, 783.99];
      this.tone(arpeggio[this.step % arpeggio.length], now, 0.44, 0.052, "triangle");
      if (this.step % 8 === 6) this.triangleAccent(now, 1174.66);
    }
    this.step = (this.step + 1) % 16;
  }

  playAnswer(correct: boolean) {
    if (!this.context) return;
    const now = this.context.currentTime + 0.015;
    if (correct) {
      this.tone(659.25, now, 0.46, 0.085, "triangle");
      this.tone(880, now + 0.13, 0.72, 0.065, "triangle");
    } else {
      this.tone(392, now, 0.38, 0.06, "sine");
      this.tone(349.23, now + 0.12, 0.58, 0.045, "triangle");
    }
  }

  playTap(kind: "key" | "action" = "key") {
    if (!this.context) return;
    const now = this.context.currentTime + 0.008;
    if (kind === "action") {
      this.tone(523.25, now, 0.11, 0.085, "triangle");
      this.tone(659.25, now + 0.045, 0.16, 0.055, "sine");
      return;
    }
    this.tone(740, now, 0.055, 0.07, "triangle");
  }

  async suspend() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (this.context?.state === "running") await this.context.suspend();
  }

  async resume(scene: MathAudioScene) {
    if (!this.context) return;
    if (this.context.state === "suspended") await this.context.resume();
    this.setScene(scene);
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (this.master && this.context) {
      const context = this.context;
      const now = context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(Math.max(this.master.gain.value, 0.0001), now);
      this.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      window.setTimeout(() => { void context.close(); }, 100);
    }
    this.context = null;
    this.master = null;
    this.echoInput = null;
  }
}

export function useMathSeriesAudio(scene: MathAudioScene, paused = false) {
  const [enabled, setEnabled] = useState(false);
  const engineRef = useRef<MathSeriesAudioEngine | null>(null);

  const savePreference = useCallback((next: boolean) => {
    try { localStorage.setItem(SOUND_STORAGE_KEY, next ? "true" : "false"); } catch { /* Local storage is optional. */ }
    window.dispatchEvent(new CustomEvent<boolean>(SOUND_CHANGE_EVENT, { detail: next }));
  }, []);

  const toggle = useCallback(async () => {
    if (enabled) {
      engineRef.current?.stop();
      engineRef.current = null;
      setEnabled(false);
      savePreference(false);
      return;
    }
    const engine = new MathSeriesAudioEngine();
    try {
      await engine.start(scene);
      engineRef.current = engine;
      setEnabled(true);
      savePreference(true);
    } catch {
      engine.stop();
    }
  }, [enabled, savePreference, scene]);

  const playAnswer = useCallback((correct: boolean) => {
    engineRef.current?.playAnswer(correct);
  }, []);

  const playTap = useCallback((kind: "key" | "action" = "key") => {
    if (!enabled) return;
    if (engineRef.current) {
      engineRef.current.playTap(kind);
      return;
    }
    const engine = new MathSeriesAudioEngine();
    engineRef.current = engine;
    void engine.start(scene).then(() => engine.playTap(kind)).catch(() => {
      engine.stop();
      if (engineRef.current === engine) engineRef.current = null;
    });
  }, [enabled, scene]);

  const resume = useCallback(async () => {
    if (!enabled) return;
    if (!engineRef.current) {
      const engine = new MathSeriesAudioEngine();
      engineRef.current = engine;
      await engine.start(scene);
      return;
    }
    await engineRef.current.resume(scene);
  }, [enabled, scene]);

  useEffect(() => {
    const applyPreference = (next: boolean) => {
      setEnabled(next);
      if (!next) {
        engineRef.current?.stop();
        engineRef.current = null;
      }
    };
    try { applyPreference(localStorage.getItem(SOUND_STORAGE_KEY) === "true"); } catch { /* Keep the default OFF. */ }
    const onStorage = (event: StorageEvent) => {
      if (event.key === SOUND_STORAGE_KEY) applyPreference(event.newValue === "true");
    };
    const onSoundChange = (event: Event) => applyPreference(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("storage", onStorage);
    window.addEventListener(SOUND_CHANGE_EVENT, onSoundChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SOUND_CHANGE_EVENT, onSoundChange);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (paused) {
      void engineRef.current?.suspend();
    } else {
      engineRef.current?.setScene(scene);
    }
  }, [enabled, paused, scene]);

  useEffect(() => () => engineRef.current?.stop(), []);

  return { enabled, toggle, playAnswer, playTap, resume };
}
