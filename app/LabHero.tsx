"use client";

import { useRef } from "react";
import type { CSSProperties } from "react";
import { featuredBitGames } from "./bit/games";
import styles from "./LabHero.module.css";

export function LabHero() {
  const hero = useRef<HTMLElement>(null);
  const gameCount = String(featuredBitGames.length).padStart(2, "0");

  function trackPointer(event: React.PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--pointer-x", `${((event.clientX - rect.left) / rect.width) * 100}%`);
    event.currentTarget.style.setProperty("--pointer-y", `${((event.clientY - rect.top) / rect.height) * 100}%`);
  }

  function chooseRandomGame(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const destination = featuredBitGames[Math.floor(Math.random() * featuredBitGames.length)];
    window.location.href = destination.href;
  }

  function gameVisual(name: string) {
    if (name === "ANGLE") return (
      <span className={`${styles.visual} ${styles.angleVisual}`} aria-hidden="true">
        <svg viewBox="0 0 100 76" focusable="false">
          <path className={styles.triangle} d="M12 66 L92 66 L60 14 Z" />
          <path className={styles.arc} d="M34 66 A22 22 0 0 0 27 50" />
          <text className={styles.q} x="43" y="58" textAnchor="middle">?</text>
        </svg>
      </span>
    );
    if (name === "BLANK") return <span className={`${styles.visual} ${styles.blankVisual}`} aria-hidden="true"><span>8</span><i>+</i><b className={styles.slot}>?</b><i>=</i><span>13</span></span>;
    if (name === "SEQUENCE") return (
      <span className={`${styles.visual} ${styles.sequenceVisual}`} aria-hidden="true">
        <span className={styles.numSmall}>2</span><span className={styles.numMed}>4</span><span className={styles.numLarge}>8</span><b className={styles.slot}>?</b>
      </span>
    );
    if (name === "PAKU") return (
      <span className={`${styles.visual} ${styles.pakuVisual}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M3.5 12 C7 7.5 12 6.7 16.2 9.2 L21 6.6 L19.4 12 L21 17.4 L16.2 14.8 C12 17.3 7 16.5 3.5 12 Z" />
          <circle cx="8.1" cy="11" r="1" />
        </svg>
      </span>
    );
    return <span className={`${styles.visual} ${styles.rainVisual}`} aria-hidden="true"><i>PT&gt;</i><span>INPUT</span><b>RAIN</b></span>;
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
          {featuredBitGames.map((game, index) => {
            const itemsInLastRow = featuredBitGames.length % 2 === 0 ? 2 : featuredBitGames.length % 2;
            const isLastRow = index >= featuredBitGames.length - itemsInLastRow;
            const isTrailingSolo = itemsInLastRow === 1 && isLastRow;
            const rowClass = [isLastRow && styles.isLastRow, isTrailingSolo && styles.spanFull].filter(Boolean).join(" ");
            return (
              <a href={game.href} key={game.name} className={rowClass || undefined} style={{ "--pkg-color": game.color } as CSSProperties}>
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
