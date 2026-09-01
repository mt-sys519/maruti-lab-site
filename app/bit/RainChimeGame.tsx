"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import styles from "./RainChimeGame.module.css";
import { useRainChimeAudio } from "./useRainChimeAudio";
import { ShareButton } from "./shared/ShareButton";
import { XShareButton } from "./shared/XShareButton";

const rainDrops = Array.from({ length: 20 }, (_, index) => ({
  x: 61 + ((index * 37 + 11) % 100) * 0.35,
  delay: ((index * 29) % 100) / 17,
  duration: 0.68 + ((index * 17) % 31) / 38,
  length: 9 + ((index * 13) % 25),
}));

declare global {
  interface Document {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void>;
  }
  interface HTMLElement {
    webkitRequestFullscreen?: () => Promise<void>;
  }
}

type RoomScene = "lap" | "glance" | "keyboard" | "windowsill";

const roomFrames: Array<{ scene: RoomScene; src: string; className: string }> = [
  { scene: "lap", src: "/games/rain-chime/room-lap.webp", className: styles.lapFrame },
  { scene: "glance", src: "/games/rain-chime/room-glance.webp", className: styles.glanceFrame },
  { scene: "keyboard", src: "/games/rain-chime/room-keyboard.webp", className: styles.keyboardFrame },
  { scene: "windowsill", src: "/games/rain-chime/room-windowsill.webp", className: styles.windowsillFrame },
];

export function RainChimeGame() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const artboardRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<RoomScene>("lap");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { entered, soundOn, paused, backgroundPlayOn, toggleSound, toggleBackgroundPlay, resume } = useRainChimeAudio();
  const drops = useMemo(() => rainDrops, []);

  // iOS Safari historically only exposes the webkit-prefixed Fullscreen API,
  // and (unlike Android Chrome) doesn't reliably reflect requestFullscreen()
  // on arbitrary elements without it - mirrors PAKU/LILT ORB's fallback.
  useEffect(() => {
    const onFullscreenChange = () => {
      const current = document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
      setIsFullscreen(current === viewportRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!entered) return;
    let sceneTimer = 0;
    const scheduleScene = (first = false) => {
      const delay = first ? 9000 + Math.random() * 7000 : 18000 + Math.random() * 26000;
      sceneTimer = window.setTimeout(() => {
        const roll = Math.random();
        const next: RoomScene = roll < 0.38 ? "glance" : roll < 0.7 ? "keyboard" : "windowsill";
        setScene(next);
        const duration = next === "glance" ? 3600 + Math.random() * 2200 : 8000 + Math.random() * 5000;
        sceneTimer = window.setTimeout(() => {
          setScene("lap");
          scheduleScene();
        }, duration);
      }, delay);
    };
    scheduleScene(true);
    return () => {
      window.clearTimeout(sceneTimer);
    };
  }, [entered]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const artboard = artboardRef.current;
    if (!viewport || !artboard) return;
    const updateArtboard = () => {
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      if (!width || !height) return;
      const imageRatio = 16 / 9;
      const viewportRatio = width / height;
      const renderedWidth = viewportRatio > imageRatio ? width : height * imageRatio;
      const renderedHeight = viewportRatio > imageRatio ? width / imageRatio : height;
      artboard.style.width = `${renderedWidth}px`;
      artboard.style.height = `${renderedHeight}px`;
      artboard.style.left = `${(width - renderedWidth) / 2}px`;
      artboard.style.top = `${(height - renderedHeight) / 2}px`;
      // Rain drops size/fall themselves off this (see .drop/@keyframes fall) so
      // they scale with the artboard's actual rendered size instead of a fixed
      // pixel distance calibrated for the normal (small) viewport - without it,
      // fullscreen (where the artboard can render several times larger) makes
      // drops fall only a fraction of the way down and look tiny/sparse.
      artboard.style.setProperty("--art-h", `${renderedHeight}px`);
    };
    const observer = new ResizeObserver(updateArtboard);
    observer.observe(viewport);
    updateArtboard();
    return () => observer.disconnect();
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const current = document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
    if (current) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else await document.webkitExitFullscreen?.();
    } else {
      const viewport = viewportRef.current;
      if (!viewport) return;
      if (viewport.requestFullscreen) await viewport.requestFullscreen();
      else await viewport.webkitRequestFullscreen?.();
    }
  }, []);

  return (
    <>
    <section className={styles.shell} aria-label="AVENUE 鑑賞画面">
      <div className={styles.controls}>
        <div className={styles.controlsLeft}>
          <button type="button" aria-pressed={soundOn} onClick={() => void toggleSound()}>SOUND {soundOn ? "ON" : "OFF"}</button>
          <button type="button" aria-pressed={backgroundPlayOn} onClick={toggleBackgroundPlay}>BACKGROUND {backgroundPlayOn ? "ON" : "OFF"}</button>
        </div>
        <button type="button" aria-pressed={isFullscreen} onClick={() => void toggleFullscreen()}>FULLSCREEN</button>
      </div>

      <div ref={viewportRef} className={styles.viewport}>
        <div ref={artboardRef} className={styles.artboard} data-scene={scene}>
          {roomFrames.map((frame) => (
            <img
              key={frame.scene}
              className={`${styles.frame} ${frame.className}`}
              src={frame.src}
              alt={frame.scene === "lap" ? "1996年のニューヨーク、開いた窓辺で女性と黒猫が雨を眺める部屋" : ""}
              aria-hidden={frame.scene === "lap" ? undefined : "true"}
            />
          ))}
          <div className={styles.rainPane} aria-hidden="true">
            {drops.map((drop, index) => <i className={styles.drop} key={`sky-${index}`} style={{ "--x": drop.x, "--delay": drop.delay + .4, "--duration": drop.duration * 1.08, "--length": drop.length } as CSSProperties} />)}
          </div>
          <div className={styles.terminal} aria-hidden="true"><span>PT&gt;</span><i className={styles.cursor} /></div>
          <i className={styles.lampFlicker} aria-hidden="true" />
        </div>
        <div className={styles.shade} aria-hidden="true" />
        <div className={styles.topReadout} aria-hidden="true"><span>11TH AVE / NEW YORK / 1996</span><span>WINDOW CHANNEL / RAIN</span></div>

        {entered && paused && (
          <div className={styles.pause}>
            <div><p>THE ROOM IS PAUSED</p><button type="button" onClick={() => void resume()}>RETURN TO THE ROOM</button></div>
          </div>
        )}

        {isFullscreen && (
          <button className={styles.exitFullscreen} type="button" onClick={() => void toggleFullscreen()} aria-label="全画面表示を終了">
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M7 2v5H2M13 2v5h5M7 18v-5H2M13 18v-5h5" />
            </svg>
          </button>
        )}
      </div>

      <aside className={styles.note}>
        <p>SOUND SOURCES</p>
        <div><strong>RAIN / WIND CHIME / STEEL TONGUE DRUM<br />GENERATIVE AMBIENCE — NO FIXED LOOP</strong></div>
      </aside>
    </section>
    <div className="bitPakuShareRow">
      <ShareButton
        title="MarutiBit「AVENUE」"
        text="雨、ウインドチャイム、タングドラムがつくる部屋を眺めるピクセルアート・アンビエント"
        url="https://marutilab.com/bit/avenue"
      />
      <XShareButton
        variant="compact"
        text={"MarutiBit「AVENUE」\n雨、ウインドチャイム、タングドラムがつくる部屋を眺めるピクセルアート・アンビエント"}
        url="https://marutilab.com/bit/avenue"
      />
    </div>
    </>
  );
}
