"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import styles from "./RainChimeGame.module.css";
import { useRainChimeAudio } from "./useRainChimeAudio";

const rainDrops = Array.from({ length: 54 }, (_, index) => ({
  x: (index * 37 + 11) % 100,
  delay: ((index * 29) % 100) / 17,
  duration: 0.68 + ((index * 17) % 31) / 38,
  length: 9 + ((index * 13) % 25),
}));

export function RainChimeGame() {
  const shellRef = useRef<HTMLElement>(null);
  const [catAtKeyboard, setCatAtKeyboard] = useState(false);
  const [drumPulse, setDrumPulse] = useState(0);
  const onDrumPulse = useCallback(() => setDrumPulse((value) => value + 1), []);
  const { entered, soundOn, paused, enter, toggleSound, resume } = useRainChimeAudio(onDrumPulse);
  const drops = useMemo(() => rainDrops, []);

  useEffect(() => {
    if (!entered) return;
    let returnTimer = 0;
    let walkTimer = 0;
    const scheduleWalk = () => {
      walkTimer = window.setTimeout(() => {
        setCatAtKeyboard(true);
        returnTimer = window.setTimeout(() => {
          setCatAtKeyboard(false);
          scheduleWalk();
        }, 7000 + Math.random() * 5000);
      }, 38000 + Math.random() * 42000);
    };
    scheduleWalk();
    return () => {
      window.clearTimeout(walkTimer);
      window.clearTimeout(returnTimer);
    };
  }, [entered]);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await shellRef.current?.requestFullscreen();
  }, []);

  return (
    <section ref={shellRef} className={styles.shell} aria-label="RAIN CHIME 鑑賞画面">
      <div className={`${styles.viewport} ${catAtKeyboard ? styles.catAtKeyboard : ""}`}>
        <img className={`${styles.frame} ${styles.lapFrame}`} src="/games/rain-chime/room-lap.webp" alt="1996年のニューヨーク、雨の窓辺で女性と黒猫が過ごす部屋" />
        <img className={`${styles.frame} ${styles.keyboardFrame}`} src="/games/rain-chime/room-keyboard.webp" alt="" aria-hidden="true" />
        <div className={styles.shade} aria-hidden="true" />
        <div className={styles.rain} aria-hidden="true">
          {drops.map((drop, index) => (
            <i
              className={styles.drop}
              key={index}
              style={{
                "--x": drop.x,
                "--delay": drop.delay,
                "--duration": drop.duration,
                "--length": drop.length,
              } as CSSProperties}
            />
          ))}
        </div>
        <div className={styles.terminal} aria-hidden="true"><span>PT&gt;</span><i className={styles.cursor} /></div>
        <i key={drumPulse} className={`${styles.drumPulse} ${drumPulse ? styles.isActive : ""}`} aria-hidden="true" />
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
