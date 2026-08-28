"use client";

import { bitGames } from "./games";
import styles from "./BitHub.module.css";

function GameVisual({ id }: { id: (typeof bitGames)[number]["id"] }) {
  if (id === "angle") return <span className={`${styles.visual} ${styles.angle}`} aria-hidden="true"><i /><i /><i /><b>?</b></span>;
  if (id === "blank") return <span className={`${styles.visual} ${styles.blank}`} aria-hidden="true"><span>8</span><i>＋</i><b>?</b><i>＝</i><span>13</span></span>;
  if (id === "sequence") return <span className={`${styles.visual} ${styles.sequence}`} aria-hidden="true"><span>2</span><i>4</i><span>8</span><b>?</b></span>;
  if (id === "input-rain") return <span className={`${styles.visual} ${styles.rain}`} aria-hidden="true"><i>PT&gt;</i><span>INPUT</span><b>RAIN</b></span>;
  return <span className={`${styles.visual} ${styles.paku}`} aria-hidden="true"><i /><i /><i /></span>;
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
          {bitGames.map((game, index) => {
            const isTrailingSolo = bitGames.length % 2 === 1 && index === bitGames.length - 1;
            return (
              <a href={game.href} className={`${styles.card} ${isTrailingSolo ? styles.spanFull : ""}`} key={game.id}>
                <span className={styles.number}>{game.number}</span>
                <GameVisual id={game.id} />
                <div><p>{game.kind}</p><h3>{game.name}</h3><span>{game.description}</span></div>
                <b className={styles.play}>PLAY</b>
              </a>
            );
          })}
        </div>
      </section>
    </>
  );
}
