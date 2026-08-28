"use client";

import { useEffect, useRef, useState } from "react";

const ENGINE_BASE = "/scripts/paku";
const ENGINE_FILES = ["database.js", "botanical-engine.js", "audio.js", "particle-core.js", "aquarium.js"];
// Bumped whenever these static files change, so a browser that already cached
// an older copy (common on repeated same-URL loads while testing on a phone)
// is forced to fetch the current one instead of silently reusing a stale build.
const ENGINE_VERSION = "7";
const CANVAS_ID = "paku-aquarium-canvas";

type PakuAquarium = {
  themeMode: string;
  airLayerCanvas?: HTMLCanvasElement | null;
  lighting: number;
  bubblerRate: number;
  speciesConfig: Record<string, { enabled: boolean; count?: number; max?: number }>;
  fishes: { id: string; size: number }[];
  setTheme: (mode: string) => void;
  spawnPopulation: () => void;
  start: () => void;
  stop: () => void;
  feedData: (x: number, y: number) => void;
};

type PakuAudio = {
  isMuted: boolean;
  ctx?: { state: string; resume: () => void };
  setMute: (muted: boolean) => void;
  setThemeMode: (mode: string) => void;
  updateBubblerRate: (rate: number) => void;
  setMasterVolume: (volume: number) => void;
  setHumEnabled: (enabled: boolean) => void;
};

declare global {
  interface Window {
    cyberAudio?: PakuAudio;
    aquariumInstance?: PakuAquarium;
  }
  // aquarium.js declares this as a top-level `class`, which (unlike `var`) never
  // becomes a `window` property - it only exists as a global lexical binding.
  var CyberAquarium: (new (canvasId: string) => PakuAquarium) | undefined;
  // iOS Safari only gained unprefixed element.requestFullscreen() in 16.4; the
  // webkit-prefixed pair is still needed as a fallback for older versions.
  interface Document {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void>;
  }
  interface HTMLElement {
    webkitRequestFullscreen?: () => Promise<void>;
  }
}

// Deduped by base filename, not the full URL - a version-query bump must never
// result in a second <script> for a file that's already declaring top-level
// classes (dev-only HMR remounts would otherwise inject it twice and throw
// "Identifier has already been declared").
function loadScriptOnce(file: string, src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-paku-file="${file}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") { resolve(); return; }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.dataset.pakuFile = file;
    script.onload = () => { script.dataset.loaded = "true"; resolve(); };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

async function loadPakuEngine() {
  for (const file of ENGINE_FILES) await loadScriptOnce(file, `${ENGINE_BASE}/${file}?v=${ENGINE_VERSION}`);
}

export function PakuGame() {
  const tankRef = useRef<HTMLDivElement>(null);
  const tapFxRef = useRef<HTMLDivElement>(null);
  const aquariumRef = useRef<PakuAquarium | null>(null);
  const startedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [debugInfo, setDebugInfo] = useState("");

  useEffect(() => {
    let cancelled = false;
    const cleanupFns: (() => void)[] = [];
    (async () => {
      await loadPakuEngine();
      if (cancelled || startedRef.current || typeof CyberAquarium === "undefined") return;
      startedRef.current = true;

      const aquarium = new CyberAquarium(CANVAS_ID);
      aquariumRef.current = aquarium;
      window.aquariumInstance = aquarium;

      // setTheme() (not a raw themeMode assignment) is what actually invalidates the
      // cached background/gravel static layer - skipping it left that layer baked
      // from the constructor's dark-mode default while per-frame fish draws (which
      // read themeMode live) correctly showed light mode.
      aquarium.setTheme("light");
      aquarium.lighting = 0.82;
      aquarium.bubblerRate = 0.65;

      Object.keys(aquarium.speciesConfig).forEach((id) => { aquarium.speciesConfig[id].enabled = false; });
      aquarium.speciesConfig["neon-tetra"] = { enabled: true, count: 9, max: 30 };
      aquarium.speciesConfig["corydoras"] = { enabled: true, count: 3, max: 12 };
      aquarium.speciesConfig["african-lampeye"] = { enabled: true, count: 6, max: 24 };

      aquarium.spawnPopulation();

      aquarium.fishes.forEach((fish) => {
        if (fish.id === "neon-tetra") fish.size *= 1.6;
        if (fish.id === "corydoras") fish.size *= 1.3;
        if (fish.id === "african-lampeye") fish.size *= 1.5;
      });

      aquarium.start();

      window.cyberAudio?.setThemeMode("light");
      window.cyberAudio?.updateBubblerRate(0.65);
      window.cyberAudio?.setMasterVolume(0.9);
      window.cyberAudio?.setHumEnabled(true);

      setReady(true);

      // Temporary on-screen diagnostic for the CYBER-theme report - polls continuously
      // (not just once) so a screenshot taken any time later still reflects the live
      // state, and checks the AIR canvas directly since that's the visible symptom.
      // Remove once resolved.
      const describe = () => {
        let stored = "n/a";
        try { stored = window.localStorage.getItem("cyberAquariumTheme") ?? "(null)"; } catch { /* ignore */ }
        setDebugInfo(
          `t=${Math.round(performance.now() / 1000)}s aq=${aquarium.themeMode} audio=${window.cyberAudio?.themeMode} ls=${stored} `
          + `sameRef=${window.aquariumInstance === aquarium} airDisplay=${aquarium.airLayerCanvas?.style.display ?? "(none)"} `
          + `tags=${document.querySelectorAll("script[data-paku-file]").length} v=${ENGINE_VERSION}`,
        );
      };
      describe();
      const debugTimer = window.setInterval(describe, 1000);
      cleanupFns.push(() => window.clearInterval(debugTimer));
    })();

    return () => {
      cancelled = true;
      cleanupFns.forEach((fn) => fn());
      aquariumRef.current?.stop();
      if (window.aquariumInstance === aquariumRef.current) window.aquariumInstance = undefined;
    };
  }, []);

  function enableAudio() {
    const audio = window.cyberAudio;
    if (!audio) return;
    if (audio.isMuted) audio.setMute(false);
    if (audio.ctx?.state === "suspended") audio.ctx.resume();
    audio.setThemeMode("light");
    audio.updateBubblerRate(0.65);
    audio.setMasterVolume(0.9);
    setSoundOn(!audio.isMuted);
  }

  function toggleSound() {
    const audio = window.cyberAudio;
    if (!audio) return;
    if (audio.isMuted) enableAudio();
    else { audio.setMute(true); setSoundOn(false); }
  }

  useEffect(() => {
    // Deferred so the client's first render still matches the server's (no
    // fullscreen API on the server), avoiding a hydration mismatch.
    const supportTimer = window.setTimeout(() => {
      setFullscreenSupported(typeof document.exitFullscreen === "function" || typeof document.webkitExitFullscreen === "function");
    }, 0);

    function handleFullscreenChange() {
      const current = document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
      setIsFullscreen(current === tankRef.current);
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
    const tank = tankRef.current;
    if (!tank) return;
    const current = document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
    if (current) {
      if (document.exitFullscreen) void document.exitFullscreen();
      else document.webkitExitFullscreen?.();
    } else if (tank.requestFullscreen) {
      void tank.requestFullscreen();
    } else {
      tank.webkitRequestFullscreen?.();
    }
  }

  function feedAt(clientX: number, clientY: number) {
    enableAudio();
    const tank = tankRef.current;
    const aquarium = aquariumRef.current;
    if (!tank || !aquarium) return;
    const rect = tank.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    aquarium.feedData(x, y);

    const tapFx = tapFxRef.current;
    if (tapFx) {
      tapFx.style.left = `${x}px`;
      tapFx.style.top = `${y}px`;
      tapFx.classList.remove("isGo");
      void tapFx.offsetWidth;
      tapFx.classList.add("isGo");
    }
  }

  return (
    <section className="bitGameShell bitPakuShell" aria-label="PAKUゲーム">
      <div className="bitGameControls">
        <button className={`bitSound ${soundOn ? "isOn" : ""}`} type="button" aria-pressed={soundOn} onClick={toggleSound}>
          <span className="bitSoundBars" aria-hidden="true"><i /><i /><i /></span>SOUND <strong>{soundOn ? "ON" : "OFF"}</strong>
        </button>
        {fullscreenSupported && (
          <button className="bitPakuFullscreen" type="button" aria-pressed={isFullscreen} onClick={toggleFullscreen} aria-label="全画面表示を切り替え">
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M2 7V2h5M18 7V2h-5M2 13v5h5M18 13v5h-5" />
            </svg>
          </button>
        )}
      </div>

      <div
        ref={tankRef}
        className="bitPakuTank"
        aria-label="ネオンテトラの水槽"
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button,input")) return;
          event.preventDefault();
          feedAt(event.clientX, event.clientY);
        }}
        onContextMenu={(event) => event.preventDefault()}
      >
        <canvas id={CANVAS_ID} className="bitPakuCanvas" />
        <div ref={tapFxRef} className="bitPakuTapFx" aria-hidden="true" />
        {!ready && <p className="bitPakuLoading">水槽を準備中…</p>}
      </div>
      {debugInfo && <p style={{ margin: "8px 0 0", padding: "8px", background: "#300", color: "#f88", fontSize: "10px", wordBreak: "break-all" }}>DEBUG: {debugInfo}</p>}
    </section>
  );
}
