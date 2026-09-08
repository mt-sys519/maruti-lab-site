"use client";

import type { CSSProperties } from "react";
import { bitGames } from "./games";
import styles from "./BitHub.module.css";

function GameVisual({ id }: { id: (typeof bitGames)[number]["id"] }) {
  if (id === "angle") return (
    <span className={`${styles.visual} ${styles.angle}`} aria-hidden="true">
      <svg viewBox="0 0 100 76" focusable="false">
        <path className={styles.triangle} d="M12 66 L92 66 L60 14 Z" />
        <path className={styles.arc} d="M34 66 A22 22 0 0 0 27 50" />
        <text className={styles.q} x="43" y="58" textAnchor="middle">?</text>
      </svg>
    </span>
  );
  if (id === "blank") return <span className={`${styles.visual} ${styles.blank}`} aria-hidden="true"><span>8</span><i>＋</i><b className={styles.slot}>?</b><i>＝</i><span>13</span></span>;
  if (id === "sequence") return (
    <span className={`${styles.visual} ${styles.sequence}`} aria-hidden="true">
      <span className={styles.numSmall}>2</span><span className={styles.numMed}>4</span><span className={styles.numLarge}>8</span><b className={styles.slot}>?</b>
    </span>
  );
  if (id === "input-rain") return (
    <span className={`${styles.visual} ${styles.inputRain}`} aria-hidden="true">
      {/* The same terminal mark its own page sets beside the title
          (.inputRainTitleMark in globals.css), sized up. Every other card is a
          mark; this one was the game's name spelled out a second time. */}
      <span className="inputRainTitleMark"><i /><i /><i /></span>
    </span>
  );
  if (id === "paku") return (
    <span className={`${styles.visual} ${styles.paku}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M3.5 12 C7 7.5 12 6.7 16.2 9.2 L21 6.6 L19.4 12 L21 17.4 L16.2 14.8 C12 17.3 7 16.5 3.5 12 Z" />
        <circle cx="8.1" cy="11" r="1" />
      </svg>
    </span>
  );
  if (id === "liltorb") return (
    <span className={`${styles.visual} ${styles.liltorb}`} aria-hidden="true">
      <svg viewBox="0 0 100 100" focusable="false">
        <circle className={styles.orbRing} cx="50" cy="50" r="34" />
        <circle className={styles.orbDot} cx="38" cy="42" r="2.6" />
        <circle className={styles.orbDot} cx="59" cy="35" r="1.9" />
        <circle className={styles.orbDot} cx="61" cy="59" r="2.3" />
        <circle className={styles.orbDot} cx="42" cy="62" r="1.7" />
      </svg>
    </span>
  );
  if (id === "neonbreak") return (
    <span className={`${styles.visual} ${styles.neonbreak}`} aria-hidden="true">
      {/* The same mark its own page sets beside the title
          (.bitNeonBreakLogo in globals.css). */}
      <svg viewBox="0 0 24 24" focusable="false">
        <circle cx="12" cy="12" r="9" />
        <path d="M6.4 17.6 17.6 6.4" />
        <circle className={styles.nbDot} cx="8.6" cy="8.6" r="1.5" />
      </svg>
    </span>
  );
  if (id === "avenue") return (
    <span className={`${styles.visual} ${styles.avenue}`} aria-hidden="true">
      {/* Its own title logo - the chime bars over a drop. */}
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M7 5.5 H17" />
        <path d="M9 5.5 V16" />
        <path d="M12 5.5 V19" />
        <path d="M15 5.5 V14.5" />
        <circle className={styles.avenueDot} cx="12" cy="21.3" r="1" />
      </svg>
    </span>
  );
  // Nothing should reach here: every id in bitGames has a mark above. Kept as
  // an empty box rather than a fallback picture, which is how NEON BREAK ended
  // up showing AVENUE's room.
  return <span className={styles.visual} aria-hidden="true" />;
}

export function BitHub() {
  function playRandom(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    window.location.href = bitGames[Math.floor(Math.random() * bitGames.length)].href;
  }

  return (
    <>
      <section className={styles.hero} aria-labelledby="bit-hub-title">
        <p>MARUTI LAB / QUICK GAMES</p>
        <div>
          <h1 id="bit-hub-title">短い時間で、頭と心を少し動かす。</h1>
          <p>考える。見抜く。打ち込む。感じる。<br />ひと息で遊べる、小さなゲームを少しずつ増やしています。</p>
          <a href={bitGames[0].href} onClick={playRandom}>RANDOM START</a>
        </div>
      </section>

      <section className={styles.catalog} aria-labelledby="bit-catalog-title">
        <header><p>GAME INDEX</p><h2 id="bit-catalog-title">ゲームを選ぶ</h2><span>{String(bitGames.length).padStart(2, "0")} / ONLINE</span></header>
        <div className={styles.grid}>
          {bitGames.map((game) => (
            <a href={game.href} className={styles.card} key={game.id} style={{ "--pkg-color": game.color } as CSSProperties}>
              {/* The kind sits with the serial at the top rather than above the
                  name, where it was one of three small lines stacked over the
                  title and read as part of the reading. */}
              <div className={styles.head}>
                <span className={styles.number}>{game.number}</span>
                <p className={styles.kind}>{game.kind}</p>
              </div>
              <GameVisual id={game.id} />
              <div><p className={styles.kana}>‐{game.kana}‐</p><h3>{game.name}</h3><span>{game.description}</span></div>
              <b className={styles.play}>PLAY</b>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
