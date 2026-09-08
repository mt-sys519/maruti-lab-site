"use client";

import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { bitGames } from "./bit/games";
import { GameMark } from "./bit/GameMark";
import styles from "./LabHero.module.css";

const PAGE_SIZE = 4;
const totalPages = Math.ceil(bitGames.length / PAGE_SIZE);

export function LabHero() {
  const hero = useRef<HTMLElement>(null);
  const [page, setPage] = useState(0);
  const gameCount = String(bitGames.length).padStart(2, "0");
  const pageGames = bitGames.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function trackPointer(event: React.PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--pointer-x", `${((event.clientX - rect.left) / rect.width) * 100}%`);
    event.currentTarget.style.setProperty("--pointer-y", `${((event.clientY - rect.top) / rect.height) * 100}%`);
  }

  function goToPage(direction: -1 | 1) {
    setPage((current) => (current + direction + totalPages) % totalPages);
  }

  function chooseRandomGame(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const destination = bitGames[Math.floor(Math.random() * bitGames.length)];
    window.location.href = destination.href;
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
        <div className={styles.indexHead}>
          <span>GAME INDEX</span>
          {totalPages > 1 ? (
            <div className={styles.pager}>
              <button type="button" onClick={() => goToPage(-1)} aria-label="前のゲームを表示">‹</button>
              <strong>{gameCount} / ONLINE</strong>
              <button type="button" onClick={() => goToPage(1)} aria-label="次のゲームを表示">›</button>
            </div>
          ) : (
            <strong>{gameCount} / ONLINE</strong>
          )}
        </div>
        <div className={styles.games}>
          {pageGames.map((game, index) => {
            const itemsInLastRow = pageGames.length % 2 === 0 ? 2 : pageGames.length % 2;
            const isLastRow = index >= pageGames.length - itemsInLastRow;
            const isTrailingSolo = itemsInLastRow === 1 && isLastRow;
            const rowClass = [isLastRow && styles.isLastRow, isTrailingSolo && styles.spanFull].filter(Boolean).join(" ");
            return (
              <a href={game.href} key={game.name} className={rowClass || undefined} style={{ "--pkg-color": game.color } as CSSProperties}>
                <span className={styles.gameNumber}>{game.number}</span>
                <span className={styles.visual}><GameMark id={game.id} /></span>
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
