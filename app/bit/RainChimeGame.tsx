"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import styles from "./RainChimeGame.module.css";
import { useRainChimeAudio } from "./useRainChimeAudio";

const rainDrops = Array.from({ length: 20 }, (_, index) => ({
  x: (index * 37 + 11) % 100,
  delay: ((index * 29) % 100) / 17,
  duration: 0.68 + ((index * 17) % 31) / 38,
  length: 9 + ((index * 13) % 25),
}));

type RoomScene = "lap" | "glance" | "keyboard" | "windowsill";

const roomFrames: Array<{ scene: RoomScene; src: string; className: string }> = [
  { scene: "lap", src: "/games/rain-chime/room-lap.webp", className: styles.lapFrame },
  { scene: "glance", src: "/games/rain-chime/room-glance.webp", className: styles.glanceFrame },
  { scene: "keyboard", src: "/games/rain-chime/room-keyboard.webp", className: styles.keyboardFrame },
  { scene: "windowsill", src: "/games/rain-chime/room-windowsill.webp", className: styles.windowsillFrame },
];

export function RainChimeGame() {
  const shellRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const artboardRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<RoomScene>("lap");
  const [drumPulse, setDrumPulse] = useState(0);
  const onDrumPulse = useCallback(() => setDrumPulse((value) => value + 1), []);
  const { entered, soundOn, paused, enter, toggleSound, resume } = useRainChimeAudio(onDrumPulse);
  const drops = useMemo(() => rainDrops, []);

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
    };
    const observer = new ResizeObserver(updateArtboard);
    observer.observe(viewport);
    updateArtboard();
    return () => observer.disconnect();
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await shellRef.current?.requestFullscreen();
  }, []);

  return (
    <section ref={shellRef} className={styles.shell} aria-label="RAIN CHIME 鑑賞画面">
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
          <div className={`${styles.rainPane} ${styles.rainSky}`} aria-hidden="true">
            {drops.map((drop, index) => <i className={styles.drop} key={`sky-${index}`} style={{ "--x": drop.x, "--delay": drop.delay + .4, "--duration": drop.duration * 1.08, "--length": drop.length } as CSSProperties} />)}
          </div>
          <div className={styles.terminal} aria-hidden="true"><span>PT&gt;</span><i className={styles.cursor} /></div>
          <i key={drumPulse} className={`${styles.drumPulse} ${drumPulse ? styles.isActive : ""}`} aria-hidden="true" />
        </div>
        <div className={styles.shade} aria-hidden="true" />
        <div className={styles.topReadout} aria-hidden="true"><span>11TH AVE / NEW YORK / 1996</span><span>WINDOW CHANNEL / RAIN</span></div>

        {!entered && (
          <div className={styles.entry}>
            <div className={styles.entryPanel}>
              <p className={styles.serial}>MARUTI BIT / GAME 007</p>
              <h1>RAIN CHIME</h1>
              <p className={styles.entryText}>雨の夜を、しばらく聴く。<br />音は同じ順番では鳴りません。</p>
              <div className={styles.entryActions}>
                <button type="button" onClick={() => void enter(true)}>LISTEN</button>
                <button type="button" onClick={() => void enter(false)}>ENTER SILENT</button>
              </div>
            </div>
          </div>
        )}

        {entered && paused && (
          <div className={styles.pause}>
            <div><p>THE ROOM IS PAUSED</p><button type="button" onClick={() => void resume()}>RETURN TO THE ROOM</button></div>
          </div>
        )}
      </div>

      <div className={styles.controls}>
        <p>RAIN / WIND CHIME / STEEL TONGUE DRUM<br />GENERATIVE AMBIENCE — NO FIXED LOOP</p>
        <div className={styles.buttons}>
          <button type="button" aria-pressed={soundOn} onClick={() => void toggleSound()}>SOUND {soundOn ? "ON" : "OFF"}</button>
          <button type="button" onClick={() => void toggleFullscreen()}>FULLSCREEN</button>
        </div>
      </div>

      <aside className={styles.note}>
        <p>ABOUT THIS ROOM</p>
        <div><strong>1996年、11番街。雨が音楽になるまで。</strong>固定された曲はありません。雨、風鈴、非常階段のSteel Tongue Drumが、少しずつ違う間隔で鳴ります。猫も、気が向いたときだけ動きます。</div>
      </aside>
    </section>
  );
}
