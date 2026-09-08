"use client";

import type { CSSProperties } from "react";
import { bitGames } from "./games";
import styles from "./BitHub.module.css";
import { GameMark } from "./GameMark";

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
              <span className={styles.visual}><GameMark id={game.id} /></span>
              <div><p className={styles.kana}>‐{game.kana}‐</p><h3>{game.name}</h3><span>{game.description}</span></div>
              <b className={styles.play}>PLAY</b>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
