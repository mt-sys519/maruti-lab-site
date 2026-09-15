"use client";

import { useRef } from "react";
import type { CSSProperties } from "react";
import { bitGames } from "./bit/games";
import { GameShelf } from "./bit/GameShelf";
import styles from "./LabHero.module.css";

export function LabHero() {
  const hero = useRef<HTMLElement>(null);
  const gameCount = String(bitGames.length).padStart(2, "0");

  function trackPointer(event: React.PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty(
      "--pointer-x",
      `${((event.clientX - rect.left) / rect.width) * 100}%`,
    );
    event.currentTarget.style.setProperty(
      "--pointer-y",
      `${((event.clientY - rect.top) / rect.height) * 100}%`,
    );
  }

  function chooseRandomGame(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const destination = bitGames[Math.floor(Math.random() * bitGames.length)];
    window.location.href = destination.href;
  }

  const glide = () =>
    (window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth") as ScrollBehavior;

  // Cards sit flush against each other, so a card's offsetLeft is exactly the
  // scroll position that puts it at the left edge of the rail.
  function cardsOf(strip: HTMLDivElement) {
    return Array.from(strip.children) as HTMLElement[];
  }

  return (
    <section
      id="top"
      ref={hero}
      className={`labHero ${styles.bitHomeHero}`}
      onPointerMove={trackPointer}
      aria-labelledby="lab-title"
    >
      <div className="labRail" aria-hidden="true">
        <span>MB-00</span>
        <span>{gameCount} GAMES</span>
        <span>JPN</span>
      </div>

      <div className={styles.intro}>
        <p className="labKicker">
          <i /> MARUTI LAB / QUICK GAMES
        </p>
        <h1 id="lab-title">
          <span>Maruti</span>
          <b>Bit</b>
        </h1>
        <p className={styles.lead}>短い時間で、頭を少し動かす。</p>
        <p className={styles.copy}>
          考える。見抜く。打ち込む。
          <br />
          ひと息で遊べる、小さなゲームを少しずつ増やしています。
        </p>
        <div className={styles.actions}>
          <a className={styles.primary} href="/bit" onClick={chooseRandomGame}>
            ランダムで遊ぶ
          </a>
          <a className={styles.secondary} href="/bit">
            ゲームを選ぶ
          </a>
        </div>
      </div>

      <div id="bit-games" className={styles.index} aria-label="MarutiBitのゲーム一覧">
        <div className={styles.indexHead}>
          <span>
            GAME INDEX<i className={styles.hint}>DRAG</i>
          </span>
          <strong>{gameCount} / ONLINE</strong>
        </div>
        <GameShelf className={styles.shelfBleed} align="start" />
      </div>

      <div className={`labReadout ${styles.readout}`} aria-label="MarutiBitの概要">
        <span>SMALL GAMES / SHORT SESSIONS</span>
        <strong>{gameCount}</strong>
        <span>THINK / TYPE / REPEAT</span>
      </div>
    </section>
  );
}
