"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SOUND_STORAGE_KEY = "marutibit:sound-enabled";
const SOUND_CHANGE_EVENT = "marutibit:sound-change";
const BACKGROUND_PLAY_STORAGE_KEY = "marutibit:rain-chime:background-play";
const RAIN_RECORDING = "/audio/rain-chime/rain-open-window.mp3";
const CHIME_RECORDING = "/audio/rain-chime/wind-chimes-real.mp3";
const TONGUE_DRUM_RECORDING = "/audio/rain-chime/tongue-drum-real.mp3";
// The recording is a single mallet strike (Freesound 692569, "C3 - steel
// tongue drum"), pitched at C3. Other notes are produced by pitch-shifting
// this one hit via playbackRate rather than recording every note.
const TONGUE_DRUM_BASE_FREQUENCY = 130.81;

type AudioRig = {
  context: AudioContext;
  master: GainNode;
  rainGain: GainNode;
  rainBufferPromise: Promise<AudioBuffer>;
  rainSource: AudioBufferSourceNode | null;
  chimeElement: HTMLAudioElement;
  tongueDrumBufferPromise: Promise<AudioBuffer>;
  timers: number[];
};

function connectAtWindow(context: AudioContext, node: AudioNode, master: GainNode, pan: number) {
  const panner = context.createStereoPanner();
  panner.pan.value = pan;
  node.connect(panner).connect(master);
}

export function useRainChimeAudio() {
  const [entered, setEntered] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [paused, setPaused] = useState(false);
  const [backgroundPlayOn, setBackgroundPlayOn] = useState(false);
  const rigRef = useRef<AudioRig | null>(null);
  const enteredRef = useRef(false);
  const enteredAtRef = useRef(0);
  const soundRef = useRef(false);
  const backgroundPlayRef = useRef(false);
  const stopResumeRetryRef = useRef<(() => void) | null>(null);

  // AudioBufferSourceNode.loop repeats the decoded buffer sample-accurately;
  // an <audio loop> element instead restarts via the media pipeline, which
  // audibly stutters at the seam on most browsers. Rain is the one layer
  // that's always looping, so it's the one that has to be gapless.
  const stopRain = useCallback((rig: AudioRig) => {
    if (!rig.rainSource) return;
    try {
      rig.rainSource.stop();
    } catch {
      /* Already stopped. */
    }
    rig.rainSource.disconnect();
    rig.rainSource = null;
  }, []);

  const startRain = useCallback(async (rig: AudioRig) => {
    if (rig.rainSource) return;
    const buffer = await rig.rainBufferPromise;
    if (rigRef.current !== rig || rig.rainSource) return;
    const source = rig.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(rig.rainGain);
    source.start(0, Math.random() * buffer.duration);
    rig.rainSource = source;
  }, []);

  const applyGain = useCallback((next: boolean) => {
    soundRef.current = next;
    setSoundOn(next);
    const rig = rigRef.current;
    if (!rig) return;
    const now = rig.context.currentTime;
    rig.master.gain.cancelScheduledValues(now);
    rig.master.gain.setTargetAtTime(next ? 0.9 : 0.0001, now, 0.06);
    if (!next) {
      stopRain(rig);
      rig.chimeElement.pause();
    } else if (enteredRef.current) {
      void startRain(rig);
    }
  }, [startRain, stopRain]);

  const playChimeRecording = useCallback(() => {
    const rig = rigRef.current;
    if (!rig || !soundRef.current || rig.context.state !== "running") return;
    if (document.hidden && !backgroundPlayRef.current) return;
    rig.chimeElement.currentTime = 0;
    void rig.chimeElement.play().catch(() => undefined);
  }, []);

  const playDrum = useCallback(async () => {
    const rig = rigRef.current;
    // Scheduling notes while suspended queues them at a frozen currentTime;
    // they'd all fire in a pile the instant the context resumes. Only
    // schedule while genuinely running.
    if (!rig || !soundRef.current || rig.context.state !== "running") return;
    const buffer = await rig.tongueDrumBufferPromise;
    if (rigRef.current !== rig || !soundRef.current || rig.context.state !== "running") return;
    const { context, master } = rig;
    const now = context.currentTime;
    const notes = [130.81, 155.56, 174.61, 196, 233.08, 261.63];
    const drops = 1 + Math.floor(Math.random() * 3);
    for (let drop = 0; drop < drops; drop += 1) {
      const start = now + drop * (0.2 + Math.random() * 0.3);
      const frequency = notes[Math.floor(Math.random() * notes.length)];
      const strength = 0.78 + Math.random() * 0.34;

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = frequency / TONGUE_DRUM_BASE_FREQUENCY;
      const gain = context.createGain();
      gain.gain.value = 0.385 * strength;
      source.connect(gain);
      connectAtWindow(context, gain, master, 0.6 + Math.random() * 0.1);
      source.start(start);
    }
  }, []);

  const schedule = useCallback((rig: AudioRig) => {
    const addTimer = (callback: () => void, delay: number) => {
      const timer = window.setTimeout(callback, delay);
      rig.timers.push(timer);
    };
    const scheduleDrum = () => addTimer(() => {
      if (enteredRef.current) void playDrum();
      scheduleDrum();
    }, 3200 + Math.random() * 5800);
    const scheduleChime = (first = false) => addTimer(() => {
      if (enteredRef.current) playChimeRecording();
      scheduleChime();
    }, first ? 8000 + Math.random() * 12000 : 100000 + Math.random() * 100000);
    addTimer(() => void playDrum(), 2300);
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

    const rainGain = context.createGain();
    rainGain.gain.value = 1.05;
    rainGain.connect(master);
    const rainBufferPromise = fetch(RAIN_RECORDING)
      .then((response) => response.arrayBuffer())
      .then((data) => context.decodeAudioData(data));

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
    chimePanner.pan.value = 0.24;
    chimeSource.connect(chimeFilter).connect(chimeGain).connect(chimePanner).connect(master);

    const tongueDrumBufferPromise = fetch(TONGUE_DRUM_RECORDING)
      .then((response) => response.arrayBuffer())
      .then((data) => context.decodeAudioData(data));

    const rig: AudioRig = { context, master, rainGain, rainBufferPromise, rainSource: null, chimeElement, tongueDrumBufferPromise, timers: [] };
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
    if (rig.context.state === "suspended") await rig.context.resume();
    await startRain(rig);
  }, [startRain]);

  // AudioContext.resume() called outside a real user gesture (e.g. from the
  // mount effect below, honoring a stored "sound on" preference on a fresh
  // page load) can resolve without the context ever actually reaching
  // "running" on some browsers - the UI reads as ON but nothing plays.
  // Confirmed via the same failure mode documented for LILT ORB's
  // AudioContext: it self-corrects the instant a real gesture calls
  // resume() again (clicking the SOUND button once toggled it off, a
  // second click - now gesture-synchronous - actually started audio).
  // Retry on a timer, and again synchronously on the page's first real
  // gesture, so it recovers without needing that manual toggle.
  const retryStuckResume = useCallback((rig: AudioRig) => {
    let retryId = 0;
    const tryOnce = () => {
      if (rig.context.state === "running") {
        window.clearInterval(retryId);
        return;
      }
      void rig.context.resume();
      if (soundRef.current) void startRain(rig);
    };
    retryId = window.setInterval(tryOnce, 700);
    const onFirstGesture = () => {
      if (rig.context.state === "suspended") void rig.context.resume().then(() => {
        if (soundRef.current) void startRain(rig);
      });
    };
    document.addEventListener("pointerdown", onFirstGesture);
    document.addEventListener("keydown", onFirstGesture);
    return () => {
      window.clearInterval(retryId);
      document.removeEventListener("pointerdown", onFirstGesture);
      document.removeEventListener("keydown", onFirstGesture);
    };
  }, [startRain]);

  const toggleSound = useCallback(async () => {
    const next = !soundRef.current;
    applyGain(next);
    storePreference(next);
    if (next) {
      const rig = ensureAudio();
      await startSoundscape(rig);
      setPaused(false);
    }
  }, [applyGain, ensureAudio, startSoundscape, storePreference]);

  const toggleBackgroundPlay = useCallback(() => {
    const next = !backgroundPlayRef.current;
    backgroundPlayRef.current = next;
    setBackgroundPlayOn(next);
    try { window.localStorage.setItem(BACKGROUND_PLAY_STORAGE_KEY, next ? "true" : "false"); } catch { /* Optional. */ }
  }, []);

  const resume = useCallback(async () => {
    const rig = rigRef.current;
    if (rig) await startSoundscape(rig);
    setPaused(false);
  }, [startSoundscape]);

  // No entry gate, matching the other MarutiBit games: the room is "entered"
  // from mount, and the shared sound preference (read here, same key other
  // games write) decides whether it starts playing right away.
  useEffect(() => {
    enteredRef.current = true;
    enteredAtRef.current = Date.now();
    setEntered(true);
    const rig = ensureAudio();
    stopResumeRetryRef.current = retryStuckResume(rig);
    let storedBackgroundPlay = false;
    try { storedBackgroundPlay = window.localStorage.getItem(BACKGROUND_PLAY_STORAGE_KEY) === "true"; } catch { /* Default OFF. */ }
    backgroundPlayRef.current = storedBackgroundPlay;
    setBackgroundPlayOn(storedBackgroundPlay);
    const preferenceTimer = window.setTimeout(() => {
      let stored = false;
      try { stored = window.localStorage.getItem(SOUND_STORAGE_KEY) === "true"; } catch { /* Default OFF. */ }
      applyGain(stored);
      if (stored) void startSoundscape(rig);
    }, 0);
    const onStorage = (event: StorageEvent) => {
      if (event.key === SOUND_STORAGE_KEY) applyGain(event.newValue === "true");
    };
    const onSoundChange = (event: Event) => applyGain(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("storage", onStorage);
    window.addEventListener(SOUND_CHANGE_EVENT, onSoundChange);
    return () => {
      stopResumeRetryRef.current?.();
      stopResumeRetryRef.current = null;
      window.clearTimeout(preferenceTimer);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SOUND_CHANGE_EVENT, onSoundChange);
    };
  }, [applyGain, ensureAudio, startSoundscape, retryStuckResume]);

  // A browser-back restore from bfcache (the whole page frozen and revived,
  // not a real reload) fires "pageshow" with persisted=true. The page's
  // AudioContext gets suspended by the browser while frozen, but by then the
  // original retryStuckResume's interval has long since cleared itself
  // (it stops the moment the context first reaches "running"), so nothing is
  // left actively trying to resume it - the UI still reads sound-on from the
  // React state that was frozen along with the page, but nothing plays until
  // a fresh click happens to land on the still-attached first-gesture
  // listener. Re-arm a fresh retry loop here so it recovers on its own.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      let rig = rigRef.current;
      if (rig && rig.context.state === "closed") rig = null;
      if (!rig) {
        rigRef.current = null;
        rig = ensureAudio();
      }
      stopResumeRetryRef.current?.();
      stopResumeRetryRef.current = retryStuckResume(rig);
      if (soundRef.current) void startSoundscape(rig);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [ensureAudio, retryStuckResume, startSoundscape]);

  // Off by default: hiding the tab pauses the room after a short debounce,
  // same as before. Turning BACKGROUND PLAY on skips this entirely, so the
  // room keeps generating rain/chime/drum while the tab is in the
  // background - the intended use for that toggle.
  useEffect(() => {
    let hideTimer = 0;
    let fullscreenGraceUntil = 0;
    const onFullscreenChange = () => {
      fullscreenGraceUntil = Date.now() + 1200;
    };
    const onVisibility = () => {
      if (!enteredRef.current) return;
      if (!document.hidden) {
        window.clearTimeout(hideTimer);
        return;
      }
      hideTimer = window.setTimeout(() => {
        if (backgroundPlayRef.current) return;
        if (Date.now() < fullscreenGraceUntil) return;
        if (Date.now() - enteredAtRef.current < 4000) return;
        const rig = rigRef.current;
        if (rig) stopRain(rig);
        rig?.chimeElement.pause();
        if (rig?.context.state === "running") void rig.context.suspend();
        setPaused(true);
      }, 500);
    };
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.clearTimeout(hideTimer);
    };
  }, [stopRain]);

  useEffect(() => () => {
    enteredRef.current = false;
    const rig = rigRef.current;
    if (!rig) return;
    rig.timers.forEach(window.clearTimeout);
    stopRain(rig);
    rig.chimeElement.pause();
    rig.chimeElement.removeAttribute("src");
    rig.chimeElement.load();
    void rig.context.close();
    rigRef.current = null;
  }, [stopRain]);

  return { entered, soundOn, paused, backgroundPlayOn, toggleSound, toggleBackgroundPlay, resume };
}
