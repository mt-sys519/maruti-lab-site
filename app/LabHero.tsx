"use client";

import { useRef } from "react";
import styles from "./LabHero.module.css";

const bitGames = [
  { number: "001", name: "ANGLE", kind: "角度", href: "/bit" },
  { number: "002", name: "BLANK", kind: "穴埋め", href: "/bit/blank" },
  { number: "003", name: "SEQUENCE", kind: "数列", href: "/bit/sequence" },
  { number: "004", name: "INPUT RAIN", kind: "入力", href: "/bit/input-rain" },
];

export function LabHero() {
  const hero = useRef<HTMLElement>(null);

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

  return (
    <section id="top" ref={hero} className={`labHero ${styles.bitHomeHero}`} onPointerMove={trackPointer} aria-labelledby="lab-title">
      <div className="labRail" aria-hidden="true">
        <span>MB-00</span><span>04 GAMES</span><span>JPN</span>
      </div>

      <div className={styles.intro}>
        <p className="labKicker"><i /> MARUTI LAB / QUICK GAMES</p>
        <h1 id="lab-title"><span>Maruti</span><b>Bit</b></h1>
        <p className={styles.lead}>短い時間で、頭を少し動かす。</p>
        <p className={styles.copy}>角度、計算、数列、タイピング。<br />5問で遊べる、小さなゲームシリーズです。</p>
        <div className={styles.actions}>
          <a className={styles.primary} href="/bit" onClick={chooseRandomGame}>ランダムで遊ぶ</a>
          <a className={styles.secondary} href="#bit-games">ゲームを選ぶ</a>
        </div>
      </div>

      <div id="bit-games" className={styles.index} aria-label="MarutiBitのゲーム一覧">
        <div className={styles.indexHead}><span>GAME INDEX</span><strong>04 / ONLINE</strong></div>
        <div className={styles.games}>
          {bitGames.map((game) => (
            <a href={game.href} key={game.name}>
              <span>{game.number}</span>
              <strong>{game.name}</strong>
              <small>{game.kind}</small>
            </a>
          ))}
        </div>
      </div>

      <div className={`labReadout ${styles.readout}`} aria-label="MarutiBitの概要">
        <span>FIVE QUESTIONS / ONE SHORT SESSION</span>
        <strong>04</strong>
        <span>THINK / TYPE / REPEAT</span>
      </div>
    </section>
  );
}
