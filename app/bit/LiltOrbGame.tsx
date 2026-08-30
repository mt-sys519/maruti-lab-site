"use client";

import { useEffect, useRef, useState } from "react";
import { GamePauseOverlay } from "./shared/GamePauseOverlay";
import { useVisibilityPause } from "./shared/useVisibilityPause";
import { ShareButton } from "./shared/ShareButton";
import { XShareButton } from "./shared/XShareButton";

// Shared with the other MarutiBit games' sound hooks, so toggling sound
// anywhere carries over here too instead of this game tracking its own
// separate, unpersisted on/off state.
const SOUND_STORAGE_KEY = "marutibit:sound-enabled";
const SOUND_CHANGE_EVENT = "marutibit:sound-change";

const PARTICLE_COUNT = 1240;
const CHIME_SCALE = [576.65, 647.27, 769.74, 864.0, 969.81, 1153.3, 1294.53]; // 432Hz, D major pentatonic
const DRAG_SCALE = [...CHIME_SCALE, ...CHIME_SCALE.map((f) => f * 2)];
const CYBER_ROOT = 110; // A2, standard 440Hz-family tuning
const ARP_SEMITONES = [0, 2, 3, 5, 7, 8, 10];
const ARP_SCALE = ARP_SEMITONES.map((s) => CYBER_ROOT * 4 * Math.pow(2, s / 12));

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

type Particle = {
  core: boolean; r: number; theta: number; phi: number; spin: number; drift: number;
  radialSpeed: number; radialAmp: number; size: number; phase: number; pulse: number;
  band: number; spark: boolean; cluster: number; lastX: number | null; lastY: number | null;
  offTheta: number; offPhi: number; offR: number; starBoost: number;
};

function makeParticle(rand: () => number): Particle {
  const core = rand() < 0.34;
  const r = core ? Math.pow(rand(), 0.78) * 0.72 : 0.28 + Math.pow(rand(), 0.42) * 0.72;
  return {
    core, r,
    theta: rand() * Math.PI * 2,
    phi: Math.asin(rand() * 2 - 1) * (0.7 + rand() * 0.27),
    spin: (0.11 + rand() * 0.22) * (core ? 1.18 : 1),
    drift: (rand() - 0.5) * 0.065,
    radialSpeed: 0.26 + rand() * 0.48,
    radialAmp: (core ? 0.16 : 0.08) + rand() * 0.055,
    size: 0.2 + rand() * 0.88,
    phase: rand() * Math.PI * 2,
    pulse: 0.65 + rand() * 1.55,
    band: rand(),
    spark: rand() < 0.1,
    cluster: rand(),
    lastX: null, lastY: null,
    offTheta: 0, offPhi: 0, offR: 0, starBoost: 0,
  };
}

declare global {
  interface Document {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void>;
  }
  interface HTMLElement {
    webkitRequestFullscreen?: () => Promise<void>;
  }
}

export function LiltOrbGame() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [natural, setNatural] = useState(true);
  const naturalRef = useRef(true);
  const [soundOn, setSoundOn] = useState(false);
  const soundOnRef = useRef(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const { paused, resume } = useVisibilityPause(ready);
  const pausedRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [controlsIdle, setControlsIdle] = useState(false);
  const idleTimerRef = useRef<number | null>(null);

  // Exposed so the pause overlay / resume-from-pause handler (defined outside
  // the mount effect) can reach into the running engine.
  const engineRef = useRef<{ setOutputGain: (on: boolean) => void; suspend: () => void; resumeAudio: () => void } | null>(null);

  useEffect(() => { naturalRef.current = natural; }, [natural]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    function applyPreference(next: boolean) {
      soundOnRef.current = next;
      setSoundOn(next);
      engineRef.current?.setOutputGain(next);
    }
    function onStorage(event: StorageEvent) {
      if (event.key === SOUND_STORAGE_KEY) applyPreference(event.newValue === "true");
    }
    function onSoundChange(event: Event) {
      applyPreference(Boolean((event as CustomEvent<boolean>).detail));
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener(SOUND_CHANGE_EVENT, onSoundChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SOUND_CHANGE_EVENT, onSoundChange);
    };
  }, []);

  function saveSoundPreference(next: boolean) {
    try { window.localStorage.setItem(SOUND_STORAGE_KEY, next ? "true" : "false"); } catch { /* Local storage is optional. */ }
    window.dispatchEvent(new CustomEvent<boolean>(SOUND_CHANGE_EVENT, { detail: next }));
  }

  function toggleSound() {
    const next = !soundOnRef.current;
    soundOnRef.current = next;
    setSoundOn(next);
    saveSoundPreference(next);
    engineRef.current?.setOutputGain(next);
  }

  useEffect(() => {
    if (paused) engineRef.current?.suspend();
  }, [paused]);

  function resumeFromPause() {
    resume();
    if (soundOnRef.current) engineRef.current?.resumeAudio();
  }

  useEffect(() => {
    const supportTimer = window.setTimeout(() => {
      setFullscreenSupported(typeof document.exitFullscreen === "function" || typeof document.webkitExitFullscreen === "function");
    }, 0);
    function handleFullscreenChange() {
      const current = document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
      const active = current === wrapRef.current;
      setIsFullscreen(active);
      setControlsIdle(false);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      if (active) idleTimerRef.current = window.setTimeout(() => setControlsIdle(true), 2600);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      window.clearTimeout(supportTimer);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  function toggleFullscreen() {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const current = document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
    if (current) {
      if (document.exitFullscreen) void document.exitFullscreen();
      else document.webkitExitFullscreen?.();
    } else if (wrap.requestFullscreen) {
      void wrap.requestFullscreen();
    } else {
      wrap.webkitRequestFullscreen?.();
    }
  }

  function wakeControls() {
    if (!isFullscreen) return;
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => setControlsIdle(true), 2600);
    setControlsIdle((was) => (was ? false : was));
  }

  // The whole particle + Web Audio engine lives here, imperative and outside
  // React state (same shape as PakuGame's relationship to aquarium.js) - it
  // reads `naturalRef`/`soundOnRef`/`pausedRef` rather than closing over
  // stale props, since it only runs once on mount.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let storedSoundOn = false;
    try { storedSoundOn = window.localStorage.getItem(SOUND_STORAGE_KEY) === "true"; } catch { /* Local storage is optional. */ }
    soundOnRef.current = storedSoundOn;
    setSoundOn(storedSoundOn);

    let dpr = 1, width = 1, height = 1, radius = 1;
    const rand = mulberry32(0xca1407);
    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => makeParticle(rand));

    let warmth = 0;
    let globalPulse = 0;
    let heartbeatPulse = 0;

    function resize() {
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      radius = Math.min(width * 0.42, height * 0.42);
    }
    resize();
    window.addEventListener("resize", resize);

    let pointer: { x: number; y: number } | null = null;
    let pointerActive = false;
    let pointerDownAt = 0;
    let pointerDownPos: { x: number; y: number } | null = null;

    function screenToLocal(clientX: number, clientY: number) {
      const rect = canvas!.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function handlePointerDown(event: PointerEvent) {
      pointerActive = true;
      pointer = screenToLocal(event.clientX, event.clientY);
      pointerDownAt = performance.now();
      pointerDownPos = pointer;
      try { canvas!.setPointerCapture(event.pointerId); } catch { /* Already released. */ }
      setHasInteracted(true);
      startAudio();
      // Also fire a resume() attempt synchronously, right here inside this
      // actual pointerdown handler, on every single tap/drag-start - not
      // just the first one. Confirmed on-device: rapid repeated tapping
      // brings sound on in ~1s, while dragging (one gesture, then just
      // pointermove) can take ~8s even with the timer-based retry in
      // attemptResume() already running. That strongly suggests Android
      // Chrome only really acts on resume() calls made synchronously inside
      // a trusted gesture - the same call fired from a setTimeout callback
      // (as the retry loop does) is likely mostly ignored. More gestures ->
      // more genuinely-trusted resume() attempts -> faster unlock.
      if (actx && !running && actx.state === "suspended") void actx.resume();
    }
    function handlePointerMove(event: PointerEvent) {
      if (pointerActive) pointer = screenToLocal(event.clientX, event.clientY);
    }
    function handlePointerUp(event: PointerEvent) {
      pointerActive = false;
      if (pointerDownPos) {
        const p = screenToLocal(event.clientX, event.clientY);
        const dist = Math.hypot(p.x - pointerDownPos.x, p.y - pointerDownPos.y);
        const dur = performance.now() - pointerDownAt;
        if (dist < 14 && dur < 280) registerTap(performance.now());
      }
      pointerDownPos = null;
      // Same reasoning as the pointerdown handler: pointerup is also a
      // trusted gesture, so take the extra free chance while waiting.
      if (actx && !running && actx.state === "suspended") void actx.resume();
    }
    function handlePointerCancel() {
      pointerActive = false;
      pointerDownPos = null;
    }
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);

    let last = performance.now();
    let lastRender = 0;
    const renderInterval = 1000 / 30;
    let rafId = 0;
    function frame(now: number) {
      rafId = requestAnimationFrame(frame);
      if (pausedRef.current) return;
      updateDragTone(now);
      if (lastRender && now - lastRender < renderInterval) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      lastRender = now;
      draw(now * 0.001, dt);
    }

    function draw(time: number, dt: number) {
      const natural = naturalRef.current;
      const cx = width * 0.5, cy = height * 0.5;
      const R = radius;
      ctx!.clearRect(0, 0, width, height);

      if (pointerActive) warmth = Math.min(1, warmth + dt * 0.045);
      else warmth = Math.max(0, warmth - dt * 0.012);
      globalPulse = Math.max(0, globalPulse - dt * 1.6);
      heartbeatPulse = Math.max(0, heartbeatPulse - dt * 2.4);

      const haze = ctx!.createRadialGradient(cx - R * 0.08, cy - R * 0.1, 0, cx, cy, R * 1.02);
      if (natural) {
        haze.addColorStop(0.0, "rgba(210,235,240,0.35)");
        haze.addColorStop(0.55, "rgba(140,195,210,0.14)");
        haze.addColorStop(1.0, "rgba(72,154,190,0.00)");
      } else {
        haze.addColorStop(0.0, "rgba(2,12,18,0.28)");
        haze.addColorStop(0.58, "rgba(0,5,9,0.12)");
        haze.addColorStop(1.0, "rgba(0,0,0,0.00)");
      }
      ctx!.fillStyle = haze;
      ctx!.beginPath();
      ctx!.arc(cx, cy, R * (1.02 + globalPulse * 0.05 + heartbeatPulse * 0.035), 0, Math.PI * 2);
      ctx!.fill();

      const rotY = time * 0.2;
      const rotX = -0.36 + Math.sin(time * 0.13) * 0.1;
      const rotZ = Math.sin(time * 0.1) * 0.18;
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      const cosZ = Math.cos(rotZ), sinZ = Math.sin(rotZ);
      const hotA = time * 0.29, hotB = -time * 0.21 + 2.35;
      const projected: { p: Particle; sx: number; sy: number; depth: number; centerFactor: number; clump: number }[] = [];
      const influenceR = R * 0.85;

      for (const p of particles) {
        p.theta += p.spin * dt * (0.6 + p.r * 0.92) * (1 + warmth * 0.35);
        p.phi += p.drift * dt + Math.sin(time * 0.25 + p.phase) * 0.00032;
        p.phi = Math.max(-1.34, Math.min(1.34, p.phi));

        const well = p.cluster < 0.58 ? hotA : hotB;
        const compression = p.core ? 0.3 : 0.2;
        let theta = p.theta - Math.sin(p.theta - well) * compression;
        const phiWell = Math.sin(well * 0.73 + p.cluster * 4.0) * 0.34;
        let phi = p.phi - Math.sin(p.phi - phiWell) * (p.core ? 0.18 : 0.1);

        theta += p.offTheta;
        phi += p.offPhi;
        const radialBreath = Math.sin(time * p.radialSpeed + p.phase) * p.radialAmp;
        const innerPulse = p.core ? Math.sin(time * 0.78 + p.phase * 0.7) * 0.08 : 0;
        const rr = Math.max(0.055, p.r * (0.92 + radialBreath) + innerPulse + p.offR + globalPulse * 0.1 + heartbeatPulse * (p.core ? 0.09 : 0.03));
        const lat = phi + Math.sin(theta * 1.55 + p.phase) * 0.105 * (1 - rr);
        const ring = Math.cos(lat);

        let x = rr * ring * Math.cos(theta);
        let y = rr * Math.sin(lat);
        const z = rr * ring * Math.sin(theta);

        const twist = (1 - rr) * 1.18 + 0.12 * Math.sin(time * 0.62 + p.phase);
        const ct = Math.cos(twist), st = Math.sin(twist);
        const tx = x * ct - y * st, ty = x * st + y * ct;
        x = tx; y = ty;

        const xz = x * cosY - z * sinY, zz = x * sinY + z * cosY;
        const yz = y * cosX - zz * sinX, zz2 = y * sinX + zz * cosX;
        const xx2 = xz * cosZ - yz * sinZ, yy2 = xz * sinZ + yz * cosZ;

        const perspective = 0.76 + (zz2 + 1) * 0.16;
        const sx = cx + xx2 * R * perspective;
        const sy = cy + yy2 * R * perspective;
        const depth = clamp01((zz2 + 1) * 0.5);
        const centerFactor = clamp01(1 - Math.hypot(xx2, yy2) * 0.68);
        const clump = 0.72 + 0.28 * Math.max(0, Math.cos(theta - well));

        if (pointer) {
          const dx = pointer.x - sx, dy = pointer.y - sy;
          const dist = Math.hypot(dx, dy);
          if (dist < influenceR) {
            const strength = (1 - dist / influenceR) * 0.85;
            const angTo = Math.atan2(dy, dx);
            p.offTheta += Math.cos(angTo) * strength * 0.1 * dt * 60;
            p.offPhi += Math.sin(angTo) * strength * 0.07 * dt * 60;
            p.offR += strength * 0.012 * dt * 60;
          }
        }
        p.offTheta *= 0.94;
        p.offPhi *= 0.94;
        p.offR *= 0.93;
        p.starBoost *= 0.96;

        projected.push({ p, sx, sy, depth, centerFactor, clump });
      }

      projected.sort((a, b) => a.depth - b.depth);

      ctx!.save();
      ctx!.globalCompositeOperation = natural ? "source-over" : "lighter";
      for (const q of projected) {
        const { p, sx, sy, depth, centerFactor, clump } = q;
        const front = 0.18 + depth * 0.82;
        const flicker = p.spark ? 0.52 + 0.48 * Math.max(0, Math.sin(time * 3.3 + p.phase)) : 1;
        const pulse = 0.86 + 0.14 * Math.sin(time * p.pulse + p.phase);
        const alpha = Math.min(1, front * flicker * pulse * clump * (natural ? 0.92 : 0.96) + p.starBoost * 0.6 + globalPulse * 0.12);
        const pr = p.size * (0.56 + depth * 1.1) * (0.9 + centerFactor * 0.18) * 1.35 * (1 + p.starBoost * 1.8);

        let rgb: number[], glowRgb: number[];
        if (natural) {
          rgb = p.band < 0.42 ? [30, 110, 140] : p.band < 0.8 ? [15, 70, 105] : [255, 255, 255];
          glowRgb = p.band >= 0.8 ? [120, 190, 215] : rgb;
        } else {
          rgb = p.band < 0.4 ? [60, 221, 255] : p.band < 0.74 ? [174, 247, 255] : [255, 255, 255];
          glowRgb = rgb;
        }
        if (p.starBoost > 0.05) { rgb = [255, 255, 255]; glowRgb = [255, 230, 190]; }

        const wantsGlow = p.spark || depth > 0.8 || p.starBoost > 0.05;
        const cyberWarmGlow = 1 + (!natural ? warmth * 1.3 : 0);

        if (p.lastX !== null && (p.spark || p.starBoost > 0.05) && (depth > 0.62 || p.starBoost > 0.05)) {
          ctx!.strokeStyle = `rgba(${glowRgb[0]},${glowRgb[1]},${glowRgb[2]},${alpha * (natural ? 0.2 : 0.22) + p.starBoost * 0.5})`;
          ctx!.lineWidth = Math.max(0.35, pr * (0.44 + p.starBoost * 0.6));
          ctx!.beginPath();
          ctx!.moveTo(p.lastX, p.lastY!);
          ctx!.lineTo(sx, sy);
          ctx!.stroke();
        }
        p.lastX = sx; p.lastY = sy;

        // Glow used to be Canvas2D's shadowBlur/shadowColor - one of the most
        // expensive things a canvas can do per-shape, and with 1200+ particles
        // (compounded by CYBER's additive 'lighter' blending) it dropped this
        // to a handful of FPS on mid-range Android hardware (reported on a
        // Redmi Note 13 Pro 5G, 4GB RAM). A plain low-alpha circle behind the
        // particle reads as glow too, at a fraction of the cost.
        if (wantsGlow) {
          const glowAlpha = Math.min(1, (natural ? 0.3 : 0.34) * alpha * cyberWarmGlow) * (p.spark ? 1.15 : 1);
          ctx!.fillStyle = `rgba(${glowRgb[0]},${glowRgb[1]},${glowRgb[2]},${glowAlpha})`;
          ctx!.beginPath();
          ctx!.arc(sx, sy, pr * (1.8 + p.starBoost * 1.4), 0, Math.PI * 2);
          ctx!.fill();
        }
        ctx!.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
        ctx!.beginPath();
        ctx!.arc(sx, sy, pr, 0, Math.PI * 2);
        ctx!.fill();

        if (natural && warmth > 0.02) {
          ctx!.lineWidth = Math.max(0.35, pr * 0.16) * warmth;
          ctx!.strokeStyle = `rgba(255,255,255,${0.55 * warmth * (0.5 + centerFactor * 0.5)})`;
          ctx!.beginPath();
          ctx!.arc(sx, sy, pr * 1.04, 0, Math.PI * 2);
          ctx!.stroke();
        }

        if ((p.spark || p.band > 0.91) && depth > 0.66) {
          ctx!.fillStyle = `rgba(${glowRgb[0]},${glowRgb[1]},${glowRgb[2]},${alpha * (natural ? 0.14 : 0.1) * cyberWarmGlow})`;
          ctx!.beginPath();
          ctx!.arc(sx, sy, pr * 2.8, 0, Math.PI * 2);
          ctx!.fill();
        }
      }
      ctx!.restore();
    }
    rafId = requestAnimationFrame(frame);

    // --- Signal graph ---
    // master: NATURAL. chimes/rim/lead/natural drag-tone -> outputGain -> destination.
    // cyberBus: CYBER. arpeggio plucks + drag grains + hidden kick loop -> highpass -> limiter -> outputGain -> destination.
    // outputGain is the single global mute point driven by the shared SOUND ON/OFF preference.
    let actx: AudioContext | null = null;
    let master: GainNode | null = null;
    let delay: DelayNode | null = null;
    let cyberBus: GainNode | null = null;
    let outputGain: GainNode | null = null;
    let running = false;

    function pickScaleFreq() {
      const base = CHIME_SCALE[Math.floor(Math.random() * CHIME_SCALE.length)];
      return Math.random() < 0.12 ? base * 2 : base;
    }

    function playChime(time: number, freq: number, velocity: number) {
      const carrier = actx!.createOscillator();
      const modulator = actx!.createOscillator();
      const modGain = actx!.createGain();
      const outGain = actx!.createGain();
      const tone = actx!.createBiquadFilter();
      const pan = actx!.createStereoPanner();
      tone.type = "lowpass";
      tone.frequency.value = 5200;
      const dur = 4.6 + velocity * 1.6;

      carrier.type = "sine";
      modulator.type = "sine";
      carrier.frequency.setValueAtTime(freq, time);
      modulator.frequency.setValueAtTime(freq * 2.0, time);
      modGain.gain.setValueAtTime(freq * 0.55 * velocity, time);
      modGain.gain.exponentialRampToValueAtTime(Math.max(1, freq * 0.08), time + dur * 0.75);

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(tone);
      tone.connect(outGain);

      outGain.gain.setValueAtTime(0, time);
      outGain.gain.linearRampToValueAtTime(0.12 * velocity, time + 0.01);
      outGain.gain.exponentialRampToValueAtTime(0.0006, time + dur);

      pan.pan.setValueAtTime((Math.random() - 0.5) * 0.7, time);
      outGain.connect(pan);
      pan.connect(master!);
      pan.connect(delay!);

      carrier.start(time);
      modulator.start(time);
      carrier.stop(time + dur + 0.2);
      modulator.stop(time + dur + 0.2);
    }

    function playRimTone(time: number) {
      const freq = CHIME_SCALE[Math.floor(Math.random() * CHIME_SCALE.length)] * (Math.random() < 0.5 ? 1 : 0.5);
      const dur = 5 + Math.random() * 4;
      const osc1 = actx!.createOscillator();
      const osc2 = actx!.createOscillator();
      osc1.type = "sine"; osc2.type = "sine";
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq * 1.003, time);

      const tremolo = actx!.createOscillator();
      tremolo.frequency.value = 4.5 + Math.random() * 1.5;
      const tremoloGain = actx!.createGain();
      tremoloGain.gain.value = 0.035;
      const outGain = actx!.createGain();
      outGain.gain.setValueAtTime(0.0001, time);
      tremolo.connect(tremoloGain);
      tremoloGain.connect(outGain.gain);
      tremolo.start(time);
      tremolo.stop(time + dur + 0.5);

      const merge = actx!.createGain();
      osc1.connect(merge); osc2.connect(merge);
      merge.connect(outGain);

      outGain.gain.linearRampToValueAtTime(0.045, time + dur * 0.35);
      outGain.gain.linearRampToValueAtTime(0.045, time + dur * 0.6);
      outGain.gain.exponentialRampToValueAtTime(0.0006, time + dur);

      const pan = actx!.createStereoPanner();
      pan.pan.setValueAtTime((Math.random() - 0.5) * 0.6, time);
      outGain.connect(pan);
      pan.connect(master!);
      pan.connect(delay!);

      osc1.start(time); osc2.start(time);
      osc1.stop(time + dur + 0.5); osc2.stop(time + dur + 0.5);
    }

    function playLeadChime(time: number) {
      const base = CHIME_SCALE[Math.floor(Math.random() * CHIME_SCALE.length)];
      const freq = base * 4;
      const carrier = actx!.createOscillator();
      const modulator = actx!.createOscillator();
      const modGain = actx!.createGain();
      const outGain = actx!.createGain();
      const tone = actx!.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = 6000;
      carrier.type = "sine"; modulator.type = "sine";
      carrier.frequency.setValueAtTime(freq, time);
      modulator.frequency.setValueAtTime(freq * 2.0, time);
      modGain.gain.setValueAtTime(freq * 0.4, time);
      modGain.gain.exponentialRampToValueAtTime(Math.max(1, freq * 0.04), time + 0.9);
      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(tone);
      tone.connect(outGain);
      const dur = 1.6 + Math.random() * 0.8;
      outGain.gain.setValueAtTime(0, time);
      outGain.gain.linearRampToValueAtTime(0.045, time + 0.006);
      outGain.gain.exponentialRampToValueAtTime(0.0006, time + dur);
      const pan = actx!.createStereoPanner();
      pan.pan.setValueAtTime((Math.random() - 0.5) * 0.8, time);
      outGain.connect(pan);
      pan.connect(master!);
      pan.connect(delay!);
      carrier.start(time); modulator.start(time);
      carrier.stop(time + dur + 0.2); modulator.stop(time + dur + 0.2);
    }

    let ambientTickCount = 0;
    function scheduleAmbientTick() {
      if (!actx || !running || !naturalRef.current) return;
      const now = actx.currentTime;
      // The very first tick after touch is deliberately denser than normal -
      // NATURAL otherwise opens with a single chime and then goes quiet for
      // 3.8-7s, so if that one chime is ever lost (a slow-to-wake audio
      // pipeline on some phones, reported as several seconds of apparent
      // silence after touching the orb), the next chance to notice sound is
      // whatever that long gap happens to roll. A short burst here, like
      // CYBER's opening arpeggio already has, gives several chances in the
      // first second instead of betting everything on just one.
      const isFirstTick = ambientTickCount === 0;
      ambientTickCount++;
      const cluster = isFirstTick ? 4 : Math.random() < 0.08 ? 3 : 1;
      const baseFreq = pickScaleFreq();
      for (let i = 0; i < cluster; i++) {
        const freq = cluster > 1 ? pickScaleFreq() : baseFreq;
        const velocity = 0.4 + Math.random() * 0.75;
        const t = now + 0.05 + i * (isFirstTick ? 0.32 + Math.random() * 0.1 : 0.09 + Math.random() * 0.08);
        playChime(t, freq, velocity);
      }
      if (cluster === 1 && Math.random() < 0.22) playRimTone(now + 0.3 + Math.random() * 0.6);
      if (Math.random() < 0.1) playLeadChime(now + 0.4 + Math.random() * 1.2);
      window.setTimeout(scheduleAmbientTick, 3800 + Math.random() * 3400);
    }

    function playPluck(time: number, freq: number, velocity: number) {
      const osc = actx!.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, time);

      const filt = actx!.createBiquadFilter();
      filt.type = "lowpass";
      filt.Q.value = 2.2;
      filt.frequency.setValueAtTime(freq * 1.2, time);
      filt.frequency.linearRampToValueAtTime(freq * 5.5 * velocity, time + 0.012);
      filt.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.9, 200), time + 0.28);

      const g = actx!.createGain();
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(0.03 * velocity, time + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0005, time + 0.34);

      const pan = actx!.createStereoPanner();
      osc.connect(filt); filt.connect(g);
      pan.pan.setValueAtTime((Math.random() - 0.5) * 0.7, time);
      g.connect(pan);
      pan.connect(cyberBus!);

      osc.start(time);
      osc.stop(time + 0.4);
    }

    function scheduleCyberArp() {
      if (!actx || !running) { window.setTimeout(scheduleCyberArp, 600); return; }
      if (naturalRef.current) { window.setTimeout(scheduleCyberArp, 600); return; }
      const now = actx.currentTime;
      const noteCount = 4 + Math.floor(Math.random() * 4);
      const stepMs = 150 + Math.random() * 60;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const start = Math.floor(Math.random() * ARP_SCALE.length);
      for (let i = 0; i < noteCount; i++) {
        const idx = ((start + i * dir) % ARP_SCALE.length + ARP_SCALE.length) % ARP_SCALE.length;
        const octaveUp = Math.random() < 0.15 ? 2 : 1;
        const freq = ARP_SCALE[idx] * octaveUp;
        const velocity = 0.55 + Math.random() * 0.5;
        playPluck(now + (i * stepMs) / 1000, freq, velocity);
      }
      const restMs = 4200 + Math.random() * 4200;
      window.setTimeout(scheduleCyberArp, noteCount * stepMs + restMs);
    }

    function playThump(time: number, velocity: number) {
      const osc = actx!.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(95, time);
      osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);

      const g = actx!.createGain();
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(0.055 * velocity, time + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0006, time + 0.22);

      osc.connect(g);
      g.connect(cyberBus!);
      osc.start(time);
      osc.stop(time + 0.24);
    }

    // Hidden feature: tap 4 times quickly (CYBER only) -> the average interval
    // becomes a BPM -> a precisely-scheduled kick loop starts. Tap 4 times
    // again to stop it. Switching to NATURAL stops it immediately.
    let tapTimestamps: number[] = [];
    let kickLoopActive = false;
    let nextKickTime = 0;
    let kickIntervalSec = 0.5;
    let kickSchedulerId: number | null = null;
    const KICK_LOOKAHEAD = 0.12;

    function stopKickLoop() {
      kickLoopActive = false;
      if (kickSchedulerId) { window.clearInterval(kickSchedulerId); kickSchedulerId = null; }
    }
    function kickScheduler() {
      if (naturalRef.current) { stopKickLoop(); return; }
      if (!kickLoopActive || !actx) return;
      while (nextKickTime < actx.currentTime + KICK_LOOKAHEAD) {
        playThump(nextKickTime, 1.0);
        const delayMs = Math.max(0, (nextKickTime - actx.currentTime) * 1000);
        window.setTimeout(() => { heartbeatPulse = 1; }, delayMs);
        nextKickTime += kickIntervalSec;
      }
    }
    function startKickLoop(bpm: number) {
      kickIntervalSec = 60 / bpm;
      nextKickTime = actx!.currentTime + 0.05;
      kickLoopActive = true;
      if (kickSchedulerId) window.clearInterval(kickSchedulerId);
      kickSchedulerId = window.setInterval(kickScheduler, 25);
    }
    function registerTap(t: number) {
      if (naturalRef.current) { tapTimestamps = []; return; }
      if (tapTimestamps.length && t - tapTimestamps[tapTimestamps.length - 1] > 2000) tapTimestamps = [];
      tapTimestamps.push(t);
      if (tapTimestamps.length >= 4) {
        const recent = tapTimestamps.slice(-4);
        let total = 0;
        for (let i = 1; i < 4; i++) total += recent[i] - recent[i - 1];
        const bpm = Math.max(40, Math.min(220, 60000 / (total / 3)));
        if (actx && running) {
          if (kickLoopActive) stopKickLoop();
          else startKickLoop(bpm);
        }
        tapTimestamps = [];
      }
    }

    // Idea: a granular "data stream" that exists only while dragging in
    // CYBER (nothing autonomous, nothing left playing after release), each
    // grain sweeping hard across the stereo field in the drag direction.
    function playGrain(time: number, freq: number, panStart: number, panEnd: number) {
      const osc = actx!.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, time);
      const dur = 0.028 + Math.random() * 0.026;
      const g = actx!.createGain();
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(0.026, time + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0004, time + dur);
      osc.connect(g);
      const pan = actx!.createStereoPanner();
      pan.pan.setValueAtTime(panStart, time);
      pan.pan.linearRampToValueAtTime(panEnd, time + dur);
      g.connect(pan);
      pan.connect(cyberBus!);
      osc.start(time);
      osc.stop(time + dur + 0.02);
    }
    function spawnGrain(directionX: number) {
      const now = actx!.currentTime;
      const idx = Math.floor(Math.random() * ARP_SCALE.length);
      const octaves = [0.5, 1, 1, 2];
      const octave = octaves[Math.floor(Math.random() * octaves.length)];
      const freq = ARP_SCALE[idx] * octave * (0.985 + Math.random() * 0.03);
      const goingRight = directionX >= 0;
      const panStart = goingRight ? -0.85 : 0.85;
      const panEnd = goingRight ? 0.85 : -0.85;
      playGrain(now, freq, panStart, panEnd);
    }

    let dragOsc1: OscillatorNode | null = null, dragOsc2: OscillatorNode | null = null;
    let dragNatGain: GainNode | null = null, dragCybGain: GainNode | null = null, dragFilt: BiquadFilterNode | null = null;
    let smoothedAngle = 0, smoothedSpeed = 0;
    let lastPointerPos: { x: number; y: number } | null = null;
    let lastAudioFrame = performance.now();
    let grainAccum = 0;

    function ensureDragTone() {
      if (dragOsc1) return;
      dragOsc1 = actx!.createOscillator();
      dragOsc2 = actx!.createOscillator();
      dragOsc1.type = "sine"; dragOsc2.type = "sine";
      dragNatGain = actx!.createGain();
      dragCybGain = actx!.createGain();
      dragNatGain.gain.value = 0;
      dragCybGain.gain.value = 0;
      dragFilt = actx!.createBiquadFilter();
      dragFilt.type = "lowpass";
      dragFilt.frequency.value = 3000;
      dragOsc1.connect(dragFilt); dragOsc2.connect(dragFilt);
      dragFilt.connect(dragNatGain); dragFilt.connect(dragCybGain);
      const pan = actx!.createStereoPanner();
      dragNatGain.connect(pan);
      pan.connect(master!); pan.connect(delay!);
      dragCybGain.connect(cyberBus!);
      dragOsc1.start(); dragOsc2.start();
    }

    function updateDragTone(now: number) {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastAudioFrame) / 1000));
      lastAudioFrame = now;
      if (!actx || !running) return;
      const natural = naturalRef.current;

      if (pointerActive && pointer) {
        const dx = pointer.x - width * 0.5, dy = pointer.y - height * 0.5;
        const targetAngle = Math.atan2(dy, dx);
        let diff = targetAngle - smoothedAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        smoothedAngle += diff * 0.12;

        let spd = 0, moveDx = 0;
        if (lastPointerPos) {
          moveDx = pointer.x - lastPointerPos.x;
          spd = Math.hypot(pointer.x - lastPointerPos.x, pointer.y - lastPointerPos.y) / Math.max(0.001, dt);
        }
        lastPointerPos = { x: pointer.x, y: pointer.y };
        smoothedSpeed += (spd - smoothedSpeed) * 0.15;

        ensureDragTone();
        const now2 = actx.currentTime;
        if (natural) {
          const norm = (smoothedAngle + Math.PI) / (Math.PI * 2);
          // JS's % can return negative results (unlike a true modulo), which happens
          // whenever smoothedAngle overshoots slightly past -PI - the extra +length
          // guards against indexing DRAG_SCALE with a negative number (-> undefined
          // -> a non-finite frequency handed to setTargetAtTime, which throws).
          const idx = ((Math.floor(norm * DRAG_SCALE.length) % DRAG_SCALE.length) + DRAG_SCALE.length) % DRAG_SCALE.length;
          const freq = DRAG_SCALE[idx];
          dragOsc1!.frequency.setTargetAtTime(freq, now2, 0.06);
          dragOsc2!.frequency.setTargetAtTime(freq * 1.004, now2, 0.06);
          const vol = Math.min(0.09, smoothedSpeed * 0.00035);
          dragNatGain!.gain.setTargetAtTime(vol, now2, 0.08);
          dragCybGain!.gain.setTargetAtTime(0, now2, 0.08);
          grainAccum = 0;
        } else {
          dragNatGain!.gain.setTargetAtTime(0, now2, 0.08);
          dragCybGain!.gain.setTargetAtTime(0, now2, 0.08);

          grainAccum += dt;
          const speedNorm = Math.min(1, smoothedSpeed / 900);
          const interval = 0.2 - speedNorm * 0.15;
          if (grainAccum >= interval) {
            grainAccum = 0;
            spawnGrain(moveDx);
          }
        }
        dragFilt!.frequency.setTargetAtTime(1200 + Math.min(3000, smoothedSpeed * 6), now2, 0.15);
      } else {
        grainAccum = 0;
        if (dragNatGain && dragCybGain) {
          dragNatGain.gain.setTargetAtTime(0, actx.currentTime, 0.4);
          dragCybGain.gain.setTargetAtTime(0, actx.currentTime, 0.4);
        }
        lastPointerPos = null;
      }
    }

    function triggerShootingStar() {
      const p = particles[Math.floor(Math.random() * particles.length)];
      p.starBoost = 1;
      if (actx && running) {
        if (naturalRef.current) playLeadChime(actx.currentTime + 0.1);
        else playPluck(actx.currentTime + 0.05, ARP_SCALE[ARP_SCALE.length - 1] * 2, 0.9);
      }
    }
    function triggerPulse() {
      globalPulse = 1;
      if (actx && running && naturalRef.current) {
        const now = actx.currentTime;
        [0, 1, 2].forEach((i) => playChime(now + i * 0.09, CHIME_SCALE[(i * 2) % CHIME_SCALE.length], 0.7));
      }
    }
    function triggerPhrase() {
      if (!actx || !running || !naturalRef.current) return;
      const now = actx.currentTime;
      const start = Math.floor(Math.random() * 3);
      const dir = Math.random() < 0.5 ? 1 : -1;
      for (let i = 0; i < 4; i++) {
        const idx = ((start + i * dir) % CHIME_SCALE.length + CHIME_SCALE.length) % CHIME_SCALE.length;
        playChime(now + i * 0.22, CHIME_SCALE[idx], 0.55 + i * 0.08);
      }
    }
    let specialMomentTimer: number | null = null;
    function scheduleSpecialMoment() {
      const kinds = [triggerShootingStar, triggerPulse, triggerPhrase];
      kinds[Math.floor(Math.random() * kinds.length)]();
      specialMomentTimer = window.setTimeout(scheduleSpecialMoment, 24000 + Math.random() * 18000);
    }
    specialMomentTimer = window.setTimeout(scheduleSpecialMoment, 8000 + Math.random() * 8000);

    // Built lazily, strictly inside the first real touch gesture (see
    // startAudio) - constructing it any earlier, outside a gesture, is a
    // known mobile-browser autoplay-policy trap: some browsers never
    // properly unlock a context that wasn't created within the gesture that
    // later calls resume() on it, even though resume() itself succeeds.
    // Confirmed by trying the eager version on-device: sound stopped working
    // entirely (not just delayed) until navigating away and back unlocked
    // the origin some other way.
    function ensureEngine() {
      if (actx) return;
      actx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      master = actx.createGain();
      master.gain.setValueAtTime(0, actx.currentTime);
      // Short, not silent-feeling: ambient NATURAL chimes are sparse (the
      // next one can be 4-7s away), so a long fade-in used to mask the very
      // first chime almost entirely - the audible "start" only ever arrived
      // at the second one, reading as several seconds of silence after touch.
      master.gain.linearRampToValueAtTime(1, actx.currentTime + 0.25);

      cyberBus = actx.createGain();
      cyberBus.gain.value = 1;
      const cyberHighpass = actx.createBiquadFilter();
      cyberHighpass.type = "highpass";
      cyberHighpass.frequency.value = 30;
      const cyberLimiter = actx.createDynamicsCompressor();
      cyberLimiter.threshold.value = -20;
      cyberLimiter.knee.value = 8;
      cyberLimiter.ratio.value = 8;
      cyberLimiter.attack.value = 0.003;
      cyberLimiter.release.value = 0.25;
      cyberBus.connect(cyberHighpass);
      cyberHighpass.connect(cyberLimiter);

      outputGain = actx.createGain();
      outputGain.gain.value = soundOnRef.current ? 1 : 0;
      master.connect(outputGain);
      cyberLimiter.connect(outputGain);
      outputGain.connect(actx.destination);

      delay = actx.createDelay(3.0);
      delay.delayTime.value = 0.78;
      const feedback = actx.createGain();
      feedback.gain.value = 0.38;
      const delayFilter = actx.createBiquadFilter();
      delayFilter.type = "lowpass";
      delayFilter.frequency.value = 2600;
      delay.connect(feedback); feedback.connect(delayFilter); delayFilter.connect(delay);
      delay.connect(master);
    }

    let startingAudio = false;
    // Confirmed on-device (Redmi Note 13 Pro 5G, Chrome for Android): on a
    // fresh page load, actx.resume()'s promise can simply hang and never
    // settle - not reject, just never resolve - a known Android Chrome
    // quirk. A single resume() call with no retry (the previous version of
    // this function) then waits forever with `running` stuck false, which
    // matches the reported "sound never comes on no matter how much you
    // touch it" exactly. So: keep calling resume() every ~700ms, checking
    // actx.state directly rather than trusting any single promise, until it
    // actually reports "running".
    function attemptResume() {
      if (running || !actx) return;
      if (actx.state !== "suspended") {
        running = true;
        startingAudio = false;
        scheduleAmbientTick();
        scheduleCyberArp();
        return;
      }
      startingAudio = true;
      actx.resume().catch(() => { /* Retried on the timer below regardless. */ });
      window.setTimeout(attemptResume, 700);
    }
    function startAudio() {
      if (running || startingAudio) return;
      ensureEngine();
      attemptResume();
    }

    engineRef.current = {
      setOutputGain(on: boolean) {
        if (!actx || !outputGain) return;
        outputGain.gain.setTargetAtTime(on ? 1 : 0, actx.currentTime, 0.15);
      },
      suspend() {
        if (actx && actx.state === "running") void actx.suspend();
      },
      resumeAudio() {
        if (actx && actx.state === "suspended") void actx.resume();
      },
    };

    setReady(true);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      if (kickSchedulerId) window.clearInterval(kickSchedulerId);
      if (specialMomentTimer) window.clearTimeout(specialMomentTimer);
      engineRef.current = null;
      void actx?.close();
    };
  }, []);

  return (
    <section className="bitGameShell bitLiltOrbShell" aria-label="LILT ORBゲーム">
      <GamePauseOverlay active={paused} onResume={resumeFromPause} />
      <div className="bitGameControls">
        <button className={`bitSound ${soundOn ? "isOn" : ""}`} type="button" aria-pressed={soundOn} onClick={toggleSound}>
          <span className="bitSoundBars" aria-hidden="true"><i /><i /><i /></span>SOUND <strong>{soundOn ? "ON" : "OFF"}</strong>
        </button>
        <div className="bitLiltOrbControlsRight">
          <button
            className={`bitLiltOrbTheme ${natural ? "isNatural" : ""}`}
            type="button"
            aria-pressed={natural}
            onClick={() => setNatural((v) => !v)}
          >
            <svg className="bitLiltOrbThemeIcon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M4 7h10.5l-3-3M16 13H5.5l3 3" />
            </svg>
            {natural ? "NATURAL" : "CYBER"}
          </button>
          {fullscreenSupported && (
            <button className="bitPakuFullscreen" type="button" aria-pressed={isFullscreen} onClick={toggleFullscreen} aria-label="全画面表示を切り替え">
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path d="M2 7V2h5M18 7V2h-5M2 13v5h5M18 13v5h-5" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div
        ref={wrapRef}
        className={`bitLiltOrbTank ${natural ? "isNatural" : ""}`}
        aria-label="触れると粒子が集まる球体"
        onPointerMove={wakeControls}
        onContextMenu={(event) => event.preventDefault()}
      >
        <canvas ref={canvasRef} className="bitLiltOrbCanvas" />
        {!ready && <p className="bitPakuLoading">粒子を準備中…</p>}
        <p className={`bitLiltOrbHint ${hasInteracted ? "isHidden" : ""}`} aria-hidden="true">なぞって、はなす</p>
        {isFullscreen && (
          <button
            className={`bitLiltOrbExitFullscreen ${controlsIdle ? "isIdle" : ""}`}
            type="button"
            onClick={toggleFullscreen}
            aria-label="全画面表示を終了"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M7 2v5H2M13 2v5h5M7 18v-5H2M13 18v-5h5" />
            </svg>
          </button>
        )}
      </div>
      <div className="bitPakuShareRow">
        <ShareButton
          title="MarutiBit「LILT ORB」"
          text="触れると粒子が集まる、癒しと刺激の球体トイ"
          url="https://marutilab.com/bit/liltorb"
        />
        <XShareButton
          variant="compact"
          text={"MarutiBit「LILT ORB」\n触れると粒子が集まる、癒しと刺激の球体トイ"}
          url="https://marutilab.com/bit/liltorb"
        />
      </div>
    </section>
  );
}
