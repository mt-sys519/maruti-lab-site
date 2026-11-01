"use client";

import { useEffect, useRef, useState } from "react";

declare global {
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

// The table is its own static page (public/bit/airhockey/play), copied in
// as it was approved: three.js from an import map, a baked GLB and the raw
// hit samples. It sizes itself to its window and owns the whole of it -
// canvas, sound button, menus - so it sits in an iframe rather than being
// remounted into React. ?v=b is the Blender-baked table; without it the game
// draws its older code-built one.
const PLAY_URL = "/bit/airhockey/play/index.html?v=b";

export function AirHockeyGame() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false);
  const fullscreenActive = isFullscreen || pseudoFullscreen;

  useEffect(() => {
    function handleFullscreenChange() {
      const current = document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
      setIsFullscreen(current === stageRef.current);
      if (current) setPseudoFullscreen(false);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  // The pseudo fullscreen pins the stage over the page, so the page under it
  // must not scroll away beneath a finger dragging a mallet.
  useEffect(() => {
    if (!pseudoFullscreen) return;
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = previous;
    };
  }, [pseudoFullscreen]);

  // Same as PAKU: where the native request is missing or refused (iPhone
  // Safari), fall back to a CSS-only fullscreen rather than a dead button.
  // Some browsers neither grant nor refuse - the promise just sits there - so
  // a request that has not taken hold shortly after is treated as refused.
  function toggleFullscreen() {
    if (pseudoFullscreen) {
      setPseudoFullscreen(false);
      return;
    }
    const stage = stageRef.current;
    if (!stage) return;
    const current = document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
    if (current) {
      if (document.exitFullscreen) void document.exitFullscreen();
      else document.webkitExitFullscreen?.();
      return;
    }
    const request = stage.requestFullscreen?.bind(stage) ?? stage.webkitRequestFullscreen?.bind(stage);
    if (!request) {
      setPseudoFullscreen(true);
      return;
    }
    request().catch(() => setPseudoFullscreen(true));
    window.setTimeout(() => {
      if (!(document.fullscreenElement ?? document.webkitFullscreenElement)) setPseudoFullscreen(true);
    }, 400);
  }

  return (
    <section className="ahPanel" aria-label="AIR HOCKEY">
      <div ref={stageRef} className={`ahStage ${pseudoFullscreen ? "isPseudoFullscreen" : ""}`}>
        <iframe className="ahFrame" src={PLAY_URL} title="AIR HOCKEY" allow="fullscreen; autoplay" />
        {fullscreenActive && (
          // Fullscreen shows only the stage's own subtree, so the button below
          // it disappears; this one stays inside. Bottom left, because the
          // game's own pause and sound buttons hold the top corners.
          <button className="ahExitFullscreen" type="button" onClick={toggleFullscreen} aria-label="全画面表示を終了">
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M7 2v5H2M13 2v5h5M7 18v-5H2M13 18v-5h5" />
            </svg>
          </button>
        )}
      </div>
      <div className="ahBar">
        <button className="ahFullscreen" type="button" aria-pressed={fullscreenActive} onClick={toggleFullscreen}>
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="M2 7V2h5M18 7V2h-5M2 13v5h5M18 13v5h-5" />
          </svg>
          全画面
        </button>
      </div>
    </section>
  );
}
