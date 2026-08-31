"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SOUND_STORAGE_KEY = "marutibit:sound-enabled";
const SOUND_CHANGE_EVENT = "marutibit:sound-change";
const RAIN_RECORDING = "/audio/rain-chime/rain-open-window.mp3";
const CHIME_RECORDING = "/audio/rain-chime/wind-chimes-real.mp3";

type AudioRig = {
  context: AudioContext;
  master: GainNode;
  rainElement: HTMLAudioElement;
  chimeElement: HTMLAudioElement;
  impactNoise: AudioBuffer;
  timers: number[];
};

function makeImpactNoise(context: AudioContext) {
  const length = Math.floor(context.sampleRate * 0.12);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    const decay = 1 - index / length;
    data[index] = (Math.random() * 2 - 1) * decay * decay;
  }
  return buffer;
}

function connectAtWindow(context: AudioContext, node: AudioNode, master: GainNode, pan: number) {
  const panner = context.createStereoPanner();
  panner.pan.value = pan;
  node.connect(panner).connect(master);
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
    rig.master.gain.setTargetAtTime(next ? 0.9 : 0.0001, now, 0.06);
    if (!next) {
      rig.rainElement.pause();
      rig.chimeElement.pause();
    } else if (enteredRef.current) {
      void rig.rainElement.play().catch(() => undefined);
    }
  }, []);

  const playChimeRecording = useCallback(() => {
    const rig = rigRef.current;
    if (!rig || !soundRef.current || document.hidden || rig.context.state !== "running") return;
    rig.chimeElement.currentTime = 0;
    void rig.chimeElement.play().catch(() => undefined);
  }, []);

  const playDrum = useCallback(() => {
    const rig = rigRef.current;
    if (!rig || !soundRef.current || rig.context.state === "closed") return;
    pulseRef.current();
    const { context, master, impactNoise } = rig;
    const now = context.currentTime;
    const notes = [130.81, 155.56, 174.61, 196, 233.08, 261.63];
    const drops = 1 + Math.floor(Math.random() * 3);
    for (let drop = 0; drop < drops; drop += 1) {
      const start = now + drop * (0.2 + Math.random() * 0.3);
      const frequency = notes[Math.floor(Math.random() * notes.length)];
      const strength = 0.78 + Math.random() * 0.34;

      const click = context.createBufferSource();
      const clickFilter = context.createBiquadFilter();
      const clickGain = context.createGain();
      click.buffer = impactNoise;
      clickFilter.type = "bandpass";
      clickFilter.frequency.value = 1600 + Math.random() * 1800;
      clickFilter.Q.value = 0.75;
      clickGain.gain.setValueAtTime(0.075 * strength, start);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.055);
      click.connect(clickFilter).connect(clickGain);
      connectAtWindow(context, clickGain, master, 0.62);
      click.start(start);

      [
        { multiple: 1, level: 0.19, decay: 3.1, type: "sine" as OscillatorType },
        { multiple: 1.51, level: 0.07, decay: 2.1, type: "sine" as OscillatorType },
        { multiple: 2.03, level: 0.033, decay: 1.45, type: "triangle" as OscillatorType },
        { multiple: 2.48, level: 0.016, decay: 1.0, type: "sine" as OscillatorType },
      ].forEach(({ multiple, level, decay, type }) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency * multiple, start);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * multiple * 0.994, start + decay);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(level * strength, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
        oscillator.connect(gain);
        connectAtWindow(context, gain, master, 0.68);
        oscillator.start(start);
        oscillator.stop(start + decay + 0.1);
      });
    }
  }, []);

  const schedule = useCallback((rig: AudioRig) => {
    const addTimer = (callback: () => void, delay: number) => {
      const timer = window.setTimeout(callback, delay);
      rig.timers.push(timer);
    };
    const scheduleDrum = () => addTimer(() => {
      if (enteredRef.current) playDrum();
      scheduleDrum();
    }, 3200 + Math.random() * 5800);
    const scheduleChime = (first = false) => addTimer(() => {
      if (enteredRef.current) playChimeRecording();
      scheduleChime();
    }, first ? 8000 + Math.random() * 12000 : 100000 + Math.random() * 100000);
    addTimer(playDrum, 2300);
    scheduleDrum();
    scheduleChime(true);
  }, [playChimeRecording, playDrum]);

  const ensureAudio = useCallback(() => {
    if (rigRef.current) return rigRef.current;
    const AudioContextConstructor = window.AudioContext
      || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) throw new Error("Web Audio is not supported");
    const context = new AudioContextConstructor();
    const master = context.createGain();
    const limiter = context.createDynamicsCompressor();
    master.gain.value = soundRef.current ? 0.9 : 0.0001;
    limiter.threshold.value = -7;
    limiter.knee.value = 12;
    limiter.ratio.value = 4;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.18;
    master.connect(limiter).connect(context.destination);

    const rainElement = new Audio(RAIN_RECORDING);
    rainElement.loop = true;
    rainElement.preload = "auto";
    rainElement.volume = 1;
    const rainSource = context.createMediaElementSource(rainElement);
    const rainGain = context.createGain();
    rainGain.gain.value = 0.94;
    rainSource.connect(rainGain).connect(master);

    const chimeElement = new Audio(CHIME_RECORDING);
    chimeElement.loop = false;
    chimeElement.preload = "auto";
    chimeElement.volume = 0.82;
    const chimeSource = context.createMediaElementSource(chimeElement);
    const chimeFilter = context.createBiquadFilter();
    const chimeGain = context.createGain();
    const chimePanner = context.createStereoPanner();
    chimeFilter.type = "highpass";
    chimeFilter.frequency.value = 240;
    chimeGain.gain.value = 0.62;
    chimePanner.pan.value = 0.58;
    chimeSource.connect(chimeFilter).connect(chimeGain).connect(chimePanner).connect(master);

    const rig = { context, master, rainElement, chimeElement, impactNoise: makeImpactNoise(context), timers: [] };
    rigRef.current = rig;
    schedule(rig);
    return rig;
  }, [schedule]);

  const storePreference = useCallback((next: boolean) => {
    try { window.localStorage.setItem(SOUND_STORAGE_KEY, next ? "true" : "false"); } catch { /* Optional. */ }
    window.dispatchEvent(new CustomEvent<boolean>(SOUND_CHANGE_EVENT, { detail: next }));
  }, []);

  const startSoundscape = useCallback(async (rig: AudioRig) => {
    if (!soundRef.current) return;
    const playPromise = rig.rainElement.play();
    if (rig.context.state === "suspended") await rig.context.resume();
    await playPromise.catch(() => undefined);
  }, []);

  const enter = useCallback(async (withSound: boolean) => {
    enteredRef.current = true;
    setEntered(true);
    applyGain(withSound);
    storePreference(withSound);
    const rig = ensureAudio();
    await startSoundscape(rig);
    setPaused(false);
  }, [applyGain, ensureAudio, startSoundscape, storePreference]);

  const toggleSound = useCallback(async () => {
    const next = !soundRef.current;
    applyGain(next);
    storePreference(next);
    if (next && enteredRef.current) {
      const rig = ensureAudio();
      await startSoundscape(rig);
      setPaused(false);
    }
  }, [applyGain, ensureAudio, startSoundscape, storePreference]);

  const resume = useCallback(async () => {
    const rig = rigRef.current;
    if (rig) await startSoundscape(rig);
    setPaused(false);
  }, [startSoundscape]);

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
    // A momentary visibilitychange flicker (OS focus steal, a fullscreen
    // transition, an alt-tab that bounces right back) shouldn't drop the
    // dark ".pause" overlay over the room for a single frame - only pause
    // once hidden actually sticks for a bit.
    let hideTimer = 0;
    const onVisibility = () => {
      if (!enteredRef.current) return;
      if (!document.hidden) {
        window.clearTimeout(hideTimer);
        return;
      }
      hideTimer = window.setTimeout(() => {
        const rig = rigRef.current;
        rig?.rainElement.pause();
        rig?.chimeElement.pause();
        if (rig?.context.state === "running") void rig.context.suspend();
        setPaused(true);
      }, 500);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => () => {
    enteredRef.current = false;
    const rig = rigRef.current;
    if (!rig) return;
    rig.timers.forEach(window.clearTimeout);
    rig.rainElement.pause();
    rig.chimeElement.pause();
    rig.rainElement.removeAttribute("src");
    rig.chimeElement.removeAttribute("src");
    rig.rainElement.load();
    rig.chimeElement.load();
    void rig.context.close();
    rigRef.current = null;
  }, []);

  return { entered, soundOn, paused, enter, toggleSound, resume };
}
