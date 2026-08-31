"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SOUND_STORAGE_KEY = "marutibit:sound-enabled";
const SOUND_CHANGE_EVENT = "marutibit:sound-change";

type AudioRig = {
  context: AudioContext;
  master: GainNode;
  rain: AudioBufferSourceNode[];
  timers: number[];
};

function makeNoiseBuffer(context: AudioContext) {
  const length = context.sampleRate * 3;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let index = 0; index < length; index += 1) {
    const white = Math.random() * 2 - 1;
    last = last * 0.82 + white * 0.18;
    data[index] = white * 0.42 + last * 0.58;
  }
  return buffer;
}

export function useRainChimeAudio(onDrumPulse: () => void) {
  const [entered, setEntered] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [paused, setPaused] = useState(false);
  const rigRef = useRef<AudioRig | null>(null);
  const enteredRef = useRef(false);
  const soundRef = useRef(false);
  const pulseRef = useRef(onDrumPulse);

  useEffect(() => {
    pulseRef.current = onDrumPulse;
  }, [onDrumPulse]);

  const applyGain = useCallback((next: boolean) => {
    soundRef.current = next;
    setSoundOn(next);
    const rig = rigRef.current;
    if (!rig) return;
    const now = rig.context.currentTime;
    rig.master.gain.cancelScheduledValues(now);
    rig.master.gain.setTargetAtTime(next ? 0.72 : 0.0001, now, 0.08);
  }, []);

  const playChime = useCallback(() => {
    const rig = rigRef.current;
    if (!rig || rig.context.state === "closed") return;
    const { context, master } = rig;
    const now = context.currentTime;
    const notes = [659.25, 783.99, 987.77, 1174.66, 1318.51];
    const frequency = notes[Math.floor(Math.random() * notes.length)];
    [1, 2.01, 3.98].forEach((multiple, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency * multiple;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime([0.065, 0.025, 0.009][index], now + 0.025 + index * 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2 + index * 0.7);
      oscillator.connect(gain).connect(master);
      oscillator.start(now + index * 0.035);
      oscillator.stop(now + 4.2);
    });
  }, []);

  const playDrum = useCallback(() => {
    const rig = rigRef.current;
    if (!rig || rig.context.state === "closed") return;
    pulseRef.current();
    const { context, master } = rig;
    const now = context.currentTime;
    const notes = [130.81, 146.83, 174.61, 196, 220, 261.63];
    const frequency = notes[Math.floor(Math.random() * notes.length)];
    [
      { multiple: 1, level: 0.16, type: "sine" as OscillatorType },
      { multiple: 2.01, level: 0.045, type: "sine" as OscillatorType },
      { multiple: 3.93, level: 0.014, type: "triangle" as OscillatorType },
    ].forEach(({ multiple, level, type }, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency * multiple, now);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * multiple * 0.992, now + 2.8);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(level, now + 0.012 + index * 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.4 - index * 0.35);
      oscillator.connect(gain).connect(master);
      oscillator.start(now);
      oscillator.stop(now + 3.7);
    });
  }, []);

  const schedule = useCallback((rig: AudioRig) => {
    const scheduleChime = () => {
      const delay = 5500 + Math.random() * 10500;
      const timer = window.setTimeout(() => {
        if (enteredRef.current) playChime();
        scheduleChime();
      }, delay);
      rig.timers.push(timer);
    };
    const scheduleDrum = () => {
      const delay = 8500 + Math.random() * 14500;
      const timer = window.setTimeout(() => {
        if (enteredRef.current) playDrum();
        scheduleDrum();
      }, delay);
      rig.timers.push(timer);
    };
    scheduleChime();
    scheduleDrum();
  }, [playChime, playDrum]);

  const ensureAudio = useCallback(() => {
    if (rigRef.current) return rigRef.current;
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = soundRef.current ? 0.72 : 0.0001;
    master.connect(context.destination);

    const buffer = makeNoiseBuffer(context);
    const rain: AudioBufferSourceNode[] = [];
    [
      { type: "lowpass" as BiquadFilterType, frequency: 5200, gain: 0.23, rate: 1 },
      { type: "highpass" as BiquadFilterType, frequency: 2600, gain: 0.055, rate: 0.87 },
    ].forEach((layer) => {
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.playbackRate.value = layer.rate;
      filter.type = layer.type;
      filter.frequency.value = layer.frequency;
      gain.gain.value = layer.gain;
      source.connect(filter).connect(gain).connect(master);
      source.start();
      rain.push(source);
    });

    const rig = { context, master, rain, timers: [] };
    rigRef.current = rig;
    schedule(rig);
    return rig;
  }, [schedule]);

  const storePreference = useCallback((next: boolean) => {
    try { window.localStorage.setItem(SOUND_STORAGE_KEY, next ? "true" : "false"); } catch { /* Optional. */ }
    window.dispatchEvent(new CustomEvent<boolean>(SOUND_CHANGE_EVENT, { detail: next }));
  }, []);

  const enter = useCallback(async (withSound: boolean) => {
    enteredRef.current = true;
    setEntered(true);
    applyGain(withSound);
    storePreference(withSound);
    const rig = ensureAudio();
    if (rig.context.state === "suspended") await rig.context.resume();
    setPaused(false);
  }, [applyGain, ensureAudio, storePreference]);

  const toggleSound = useCallback(async () => {
    const next = !soundRef.current;
    applyGain(next);
    storePreference(next);
    if (next && enteredRef.current) {
      const rig = ensureAudio();
      if (rig.context.state === "suspended") await rig.context.resume();
      setPaused(false);
    }
  }, [applyGain, ensureAudio, storePreference]);

  const resume = useCallback(async () => {
    const rig = rigRef.current;
    if (rig && rig.context.state === "suspended") await rig.context.resume();
    setPaused(false);
  }, []);

  useEffect(() => {
    const preferenceTimer = window.setTimeout(() => {
      try { applyGain(window.localStorage.getItem(SOUND_STORAGE_KEY) === "true"); } catch { /* Default OFF. */ }
    }, 0);
    const onStorage = (event: StorageEvent) => {
      if (event.key === SOUND_STORAGE_KEY) applyGain(event.newValue === "true");
    };
    const onSoundChange = (event: Event) => applyGain(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("storage", onStorage);
    window.addEventListener(SOUND_CHANGE_EVENT, onSoundChange);
    return () => {
      window.clearTimeout(preferenceTimer);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SOUND_CHANGE_EVENT, onSoundChange);
    };
  }, [applyGain]);

  useEffect(() => {
    const onVisibility = () => {
      if (!enteredRef.current || !document.hidden) return;
      const rig = rigRef.current;
      if (rig?.context.state === "running") void rig.context.suspend();
      setPaused(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => () => {
    enteredRef.current = false;
    const rig = rigRef.current;
    if (!rig) return;
    rig.timers.forEach(window.clearTimeout);
    rig.rain.forEach((source) => { try { source.stop(); } catch { /* Already stopped. */ } });
    void rig.context.close();
    rigRef.current = null;
  }, []);

  return { entered, soundOn, paused, enter, toggleSound, resume };
}
