"use client";

import { useRef } from "react";
import type { CSSProperties } from "react";
import { BitRetro } from "./BitRetro";
import { bitGames, retroGames } from "./games";
import styles from "./BitHub.module.css";
import { GameShelf } from "./GameShelf";
import type { ShelfHandle } from "./GameShelf";
import { GameUnit } from "./GameUnit";
import { pickOfTheDay } from "./pickOfTheDay";

export function BitHub() {
  const pick = pickOfTheDay();
  const shelf = useRef<ShelfHandle>(null);

  function playRandom(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    window.location.href = bitGames[Math.floor(Math.random() * bitGames.length)].href;
  }

  return (
    <>
      {/* The shop's sign and its floor plan. MarutiBit is a shop with two counters -
          the RETRO series and the mini games - and the hero names the shop and points at
          both, rather than standing apart as a slogan over a grid. */}
      <section className={styles.hero} aria-labelledby="bit-hub-title">
        <div className={styles.heroHead}>
          <p className={styles.heroEyebrow}>MARUTI LAB / GAMES</p>
          <h1 id="bit-hub-title" className={styles.heroBrand}><span>Maruti</span><b>Bit</b></h1>
          <p className={styles.heroLine}>ひと息で遊べる、小さなゲームの店。</p>
          <a className={styles.random} href={bitGames[0].href} onClick={playRandom}>RANDOM START</a>
        </div>
        <nav className={styles.doors} aria-label="売り場">
          <a className={`${styles.door} ${styles.doorRetro}`} href="#bit-retro">
            <span className={styles.doorArt}>
              <img src={retroGames[0].label} width={600} height={600} alt="" />
            </span>
            <span className={styles.doorText}>
              <b>RETRO</b>
              <small>携帯機で遊ぶシリーズ</small>
            </span>
          </a>
          <a className={`${styles.door} ${styles.doorMini}`} href="#bit-mini">
            <span className={styles.doorArt}>
              {bitGames.slice(0, 5).map((game, i) => (
                <i key={game.id} style={{ "--pkg-color": game.color, "--i": i } as CSSProperties} />
              ))}
            </span>
            <span className={styles.doorText}>
              <b>MINI GAMES</b>
              <small>ひと息で遊べる{bitGames.length}本</small>
            </span>
          </a>
        </nav>
      </section>

      <BitRetro />

      <section className={styles.catalog} id="bit-mini" aria-label="ゲーム一覧">
        {/* No heading of its own: the shelf reads as part of the hero above it,
            and a second title in between pushed the machines down the page. */}
        {/* The line that parts the mini games from the RETRO series above: a rule with
            the name set into it. */}
        <h2 className={styles.rule}>
          <span>MINI GAMES</span>
          <small>ミニゲーム</small>
        </h2>
        <header>
          <p>GAME INDEX</p>
          <div className={styles.steps}>
            <span>{String(bitGames.length).padStart(2, "0")} / ONLINE</span>
            <button type="button" onClick={() => shelf.current?.step(-1)} aria-label="前のゲームを表示">‹</button>
            <button type="button" onClick={() => shelf.current?.step(1)} aria-label="次のゲームを表示">›</button>
          </div>
        </header>
        {/* The shelf is how you browse; the list below is how you check. It
            starts closed so the machines are what the page opens with. */}
        <GameShelf ref={shelf} className={styles.shelf} />
        <details className={styles.all}>
          <summary><span>ぜんぶ一覧で見る</span><i aria-hidden="true" /></summary>
          {/* Names only. The machines above are where a game is chosen; this
              is where the whole catalog is checked, and drawing all eight a
              second way gave the same games two different looks. */}
          <ol className={styles.list}>
            {bitGames.map((game) => (
              <li key={game.id} style={{ "--pkg-color": game.color } as CSSProperties}>
                <a href={game.href}>
                  <span className={styles.listNumber}>{game.number}</span>
                  <strong className={styles.listName}>{game.name}</strong>
                  <span className={styles.listKana}>‐{game.kana}‐</span>
                  <span className={styles.listKind}>{game.kind}</span>
                </a>
              </li>
            ))}
          </ol>
        </details>

        {/* The fold left a stretch of empty floor under it. One machine
            picked from the date fills it with something to actually open. */}
        <section className={styles.pick} aria-labelledby="bit-pick-title">
          <GameUnit game={pick} card className={styles.pickUnit} />
          <div className={styles.pickCopy}>
            <p className={styles.pickEyebrow}>TODAY'S GAME</p>
            <h2 id="bit-pick-title" className={styles.pickTitle}>今日のゲーム</h2>
            <p className={styles.pickKana}>‐{pick.kana}‐</p>
            <p className={styles.pickName}>{pick.name}</p>
            <p className={styles.pickText}>{pick.description}</p>
            <a className={styles.pickPlay} href={pick.href}>このゲームで遊ぶ</a>
          </div>
          {/* The game's own screen, photographed rather than embedded: a live
              frame would pull the game's assets and run its animation loop on
              a page nobody is playing on. */}
          <p className={styles.pickShot}>
            <img src={`/games/shots/${pick.id}.webp`} width={1280} height={960} alt={`${pick.name}の画面`} loading="lazy" decoding="async" />
          </p>
        </section>
      </section>
    </>
  );
}
