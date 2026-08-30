"use client";

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
  if (id === "input-rain") return <span className={`${styles.visual} ${styles.rain}`} aria-hidden="true"><i>PT&gt;</i><span>INPUT</span><b>RAIN</b></span>;
  return (
    <span className={`${styles.visual} ${styles.paku}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M3.5 12 C7 7.5 12 6.7 16.2 9.2 L21 6.6 L19.4 12 L21 17.4 L16.2 14.8 C12 17.3 7 16.5 3.5 12 Z" />
        <circle cx="8.1" cy="11" r="1" />
      </svg>
    </span>
  );
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
          <h1 id="bit-hub-title">短い時間で、頭を少し動かす。</h1>
          <p>考える。見抜く。打ち込む。<br />ひと息で遊べる、小さなゲームを少しずつ増やしています。</p>
          <a href={bitGames[0].href} onClick={playRandom}>RANDOM START</a>
        </div>
      </section>

      <section className={styles.catalog} aria-labelledby="bit-catalog-title">
        <header><p>GAME INDEX</p><h2 id="bit-catalog-title">ゲームを選ぶ</h2><span>{String(bitGames.length).padStart(2, "0")} / ONLINE</span></header>
        <div className={styles.grid}>
          {bitGames.map((game) => (
            <a href={game.href} className={styles.card} key={game.id}>
              <span className={styles.number}>{game.number}</span>
              <GameVisual id={game.id} />
              <div><p>{game.kind}</p><h3>{game.name}</h3><span>{game.description}</span></div>
              <b className={styles.play}>PLAY</b>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
