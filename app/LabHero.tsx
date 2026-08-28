"use client";

import { useRef } from "react";
import { bitGames } from "./bit/games";
import styles from "./LabHero.module.css";

export function LabHero() {
  const hero = useRef<HTMLElement>(null);
  const gameCount = String(bitGames.length).padStart(2, "0");

  function trackPointer(event: React.PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--pointer-x", `${((event.clientX - rect.left) / rect.width) * 100}%`);
    event.currentTarget.style.setProperty("--pointer-y", `${((event.clientY - rect.top) / rect.height) * 100}%`);
  }

  function chooseRandomGame(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const destination = bitGames[Math.floor(Math.random() * bitGames.length)];
    window.location.href = destination.href;
  }

  function gameVisual(name: string) {
    if (name === "ANGLE") return <span className={`${styles.visual} ${styles.angleVisual}`} aria-hidden="true"><i /><i /><i /><b>?</b></span>;
    if (name === "BLANK") return <span className={`${styles.visual} ${styles.blankVisual}`} aria-hidden="true"><span>8</span><i>+</i><b>?</b><i>=</i><span>13</span></span>;
    if (name === "SEQUENCE") return <span className={`${styles.visual} ${styles.sequenceVisual}`} aria-hidden="true"><span>2</span><i>4</i><span>8</span><b>?</b></span>;
    if (name === "INPUT RAIN") return <span className={`${styles.visual} ${styles.rainVisual}`} aria-hidden="true"><i>PT&gt;</i><span>INPUT</span><b>RAIN</b></span>;
    return <span className={`${styles.visual} ${styles.pakuVisual}`} aria-hidden="true"><i /><i /><i /></span>;
  }

  return (
    <section id="top" ref={hero} className={`labHero ${styles.bitHomeHero}`} onPointerMove={trackPointer} aria-labelledby="lab-title">
      <div className="labRail" aria-hidden="true">
        <span>MB-00</span><span>{gameCount} GAMES</span><span>JPN</span>
      </div>

      <div className={styles.intro}>
        <p className="labKicker"><i /> MARUTI LAB / QUICK GAMES</p>
        <h1 id="lab-title"><span>Maruti</span><b>Bit</b></h1>
        <p className={styles.lead}>短い時間で、頭を少し動かす。</p>
        <p className={styles.copy}>考える。見抜く。打ち込む。<br />ひと息で遊べる、小さなゲームを少しずつ増やしています。</p>
        <div className={styles.actions}>
          <a className={styles.primary} href="/bit" onClick={chooseRandomGame}>ランダムで遊ぶ</a>
          <a className={styles.secondary} href="/bit">ゲームを選ぶ</a>
        </div>
      </div>

      <div id="bit-games" className={styles.index} aria-label="MarutiBitのゲーム一覧">
        <div className={styles.indexHead}><span>GAME INDEX</span><strong>{gameCount} / ONLINE</strong></div>
        <div className={styles.games}>
          {bitGames.map((game, index) => {
            const itemsInLastRow = bitGames.length % 2 === 0 ? 2 : bitGames.length % 2;
            const isLastRow = index >= bitGames.length - itemsInLastRow;
            const isTrailingSolo = itemsInLastRow === 1 && isLastRow;
            const rowClass = [isLastRow && styles.isLastRow, isTrailingSolo && styles.spanFull].filter(Boolean).join(" ");
            return (
              <a href={game.href} key={game.name} className={rowClass || undefined}>
                <span className={styles.gameNumber}>{game.number}</span>
                {gameVisual(game.name)}
                <strong className={styles.gameName}>{game.name}</strong>
                <small className={styles.gameKind}>{game.kind}</small>
              </a>
            );
          })}
        </div>
      </div>

      <div className={`labReadout ${styles.readout}`} aria-label="MarutiBitの概要">
        <span>SMALL GAMES / SHORT SESSIONS</span>
        <strong>{gameCount}</strong>
        <span>THINK / TYPE / REPEAT</span>
      </div>
    </section>
  );
}
