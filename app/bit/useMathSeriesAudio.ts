"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MathAudioScene = "thinking" | "result";

type OscillatorKind = OscillatorType;

class MathSeriesAudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
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
      this.master.gain.value = 0.55;
      this.master.connect(this.context.destination);
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
    const beat = scene === "thinking" ? 500 : 560;
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
    oscillator.connect(envelope).connect(this.master);
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
      const chords = [
        [130.81, 196, 246.94],
        [146.83, 220, 261.63],
      ];
      if (this.step % 4 === 0) this.chord(chords[(this.step / 4) % chords.length], now, 1.8, 0.032);
      this.softClick(now, this.step % 4 === 0);
      if (this.step % 4 === 2) this.triangleAccent(now, this.step % 8 === 2 ? 1046.5 : 1174.66);
    } else {
      const resultChords = [
        [174.61, 220, 261.63],
        [196, 246.94, 293.66],
        [164.81, 207.65, 261.63],
        [220, 261.63, 329.63],
      ];
      if (this.step % 4 === 0) this.chord(resultChords[(this.step / 4) % resultChords.length], now, 2.05, 0.034);
      const arpeggio = [523.25, 659.25, 783.99, 659.25];
      this.tone(arpeggio[this.step % arpeggio.length], now, 0.6, 0.038, "triangle");
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
  }
}

export function useMathSeriesAudio(scene: MathAudioScene) {
  const [enabled, setEnabled] = useState(false);
  const engineRef = useRef<MathSeriesAudioEngine | null>(null);

  const toggle = useCallback(async () => {
    if (enabled) {
      engineRef.current?.stop();
      engineRef.current = null;
      setEnabled(false);
      return;
    }
    const engine = new MathSeriesAudioEngine();
    try {
      await engine.start(scene);
      engineRef.current = engine;
      setEnabled(true);
    } catch {
      engine.stop();
    }
  }, [enabled, scene]);

  const playAnswer = useCallback((correct: boolean) => {
    engineRef.current?.playAnswer(correct);
  }, []);

  const playTap = useCallback((kind: "key" | "action" = "key") => {
    engineRef.current?.playTap(kind);
  }, []);

  useEffect(() => {
    if (enabled) engineRef.current?.setScene(scene);
  }, [enabled, scene]);

  useEffect(() => () => engineRef.current?.stop(), []);

  return { enabled, toggle, playAnswer, playTap };
}
