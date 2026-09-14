"use client";

import { useRef } from "react";
import type { CSSProperties } from "react";
import { bitGames } from "./bit/games";
import { GameMark } from "./bit/GameMark";
import styles from "./LabHero.module.css";

// Past this many pixels a pointer gesture is a drag, not a click, and the
// card under the cursor must not open its game when the button comes up.
const DRAG_THRESHOLD = 6;

export function LabHero() {
  const hero = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: false });
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

  function settle() {
    const strip = rail.current;
    if (!strip) return;
    // Already parked against the right end: snapping back would fight the
    // reader, who can see there is nothing further along.
    if (strip.scrollLeft >= strip.scrollWidth - strip.clientWidth - 2) return;
    const nearest = cardsOf(strip).reduce((best, card) =>
      Math.abs(card.offsetLeft - strip.scrollLeft) < Math.abs(best.offsetLeft - strip.scrollLeft)
        ? card
        : best,
    );
    strip.scrollTo({ left: nearest.offsetLeft, behavior: glide() });
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    // Touch already has a good horizontal gesture of its own, with the
    // momentum the OS gives it. Only the mouse needs a hand here.
    if (event.pointerType === "touch" || !rail.current) return;
    drag.current = {
      active: true,
      startX: event.clientX,
      startLeft: rail.current.scrollLeft,
      moved: false,
    };
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current.active || !rail.current) return;
    const travelled = event.clientX - drag.current.startX;
    if (!drag.current.moved) {
      if (Math.abs(travelled) <= DRAG_THRESHOLD) return;
      drag.current.moved = true;
      // Capture only once this is definitely a drag. Capturing on pointerdown
      // retargets the rest of the gesture to the rail, and then an ordinary
      // click never reaches the card underneath and the game never opens.
      rail.current.setPointerCapture(event.pointerId);
    }
    rail.current.scrollLeft = drag.current.startLeft - travelled;
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current.active || !rail.current) return;
    drag.current.active = false;
    if (rail.current.hasPointerCapture(event.pointerId))
      rail.current.releasePointerCapture(event.pointerId);
    settle();
  }

  function suppressClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!drag.current.moved) return;
    drag.current.moved = false;
    event.preventDefault();
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
          <span>GAME INDEX<i className={styles.hint}>DRAG</i></span>
          <strong>{gameCount} / ONLINE</strong>
        </div>
        <div
          className={styles.shelf}
          ref={rail}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={suppressClick}
        >
          {bitGames.map((game) => (
            <a href={game.href} key={game.id} className={styles.unit} style={{ "--pkg-color": game.color } as CSSProperties} draggable={false}>
              <span className={styles.bezel}>
                <span className={styles.screen}>
                  <span className={styles.serial}>{game.number}</span>
                  <span className={styles.visual}><GameMark id={game.id} /></span>
                </span>
                <span className={styles.plate}>
                  <strong className={styles.gameName}>{game.name}</strong>
                  <small className={styles.gameKind}>{game.kind}</small>
                </span>
              </span>
              <span className={styles.controls} aria-hidden="true">
                <i className={styles.pad} />
                <i className={styles.buttons} />
              </span>
            </a>
          ))}
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
