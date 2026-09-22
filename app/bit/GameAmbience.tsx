"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { bitGames } from "./games";
import styles from "./GameAmbience.module.css";

// Long enough that it reads as a mood rather than a slideshow. The fade
// keyframes are written against the same span.
const HOLD_MS = 9000;

/** Each game's own motion, drawn large and faint behind the hero copy: the
 *  angle opening, the slot waiting, the fish crossing the tank. One at a
 *  time, in catalog order. */
const scenes: Record<string, ReactNode> = {
  angle: (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path stroke="" d="M20 80 H86" />
      <path className={styles.angleRay} stroke="" d="M20 80 L78 30" />
      <path stroke="" d="M44 80 A24 24 0 0 0 40 66" />
    </svg>
  ),
  blank: (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path stroke="" d="M14 50 H34" />
      <path stroke="" d="M66 50 H86" />
      <rect className={styles.blankSlot} stroke="" x="40" y="36" width="22" height="28" rx="4" strokeDasharray="5 4" />
    </svg>
  ),
  sequence: (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path stroke="" d="M10 74 H90" />
      <circle className={styles.seqDot} data-fill="" cx="24" cy="62" r="6" />
      <circle className={styles.seqDot} data-fill="" cx="44" cy="62" r="6" />
      <circle className={styles.seqDot} data-fill="" cx="64" cy="62" r="6" />
      <circle className={styles.seqDot} stroke="" cx="84" cy="62" r="6" strokeDasharray="4 3" />
    </svg>
  ),
  "input-rain": (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path stroke="" d="M12 78 H88" />
      <rect className={styles.drop} stroke="" x="22" y="26" width="16" height="16" rx="3" />
      <rect className={styles.drop} stroke="" x="44" y="26" width="16" height="16" rx="3" />
      <rect className={styles.drop} stroke="" x="66" y="26" width="16" height="16" rx="3" />
    </svg>
  ),
  paku: (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path stroke="" d="M8 84 H92" />
      <g className={styles.fish}>
        <path stroke="" d="M34 50 C44 38 60 36 72 44 L84 36 L80 50 L84 64 L72 56 C60 64 44 62 34 50 Z" />
        <circle data-fill="" cx="48" cy="48" r="2.4" />
      </g>
    </svg>
  ),
  liltorb: (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle stroke="" cx="50" cy="50" r="36" strokeDasharray="3 6" />
      <circle className={styles.orbDot} data-fill="" cx="30" cy="38" r="4" />
      <circle className={styles.orbDot} data-fill="" cx="68" cy="32" r="3" />
      <circle className={styles.orbDot} data-fill="" cx="72" cy="64" r="3.6" />
      <circle className={styles.orbDot} data-fill="" cx="34" cy="68" r="2.6" />
    </svg>
  ),
  avenue: (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect stroke="" x="18" y="16" width="64" height="68" rx="3" />
      <path stroke="" d="M50 16 V84" />
      <path className={styles.rain} stroke="" d="M30 28 V42" />
      <path className={styles.rain} stroke="" d="M40 24 V36" />
      <path className={styles.rain} stroke="" d="M62 28 V41" />
      <path className={styles.rain} stroke="" d="M72 23 V35" />
    </svg>
  ),
  mixpop: (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path stroke="" d="M34 26h32l-3 44a6 6 0 0 1-6 5.4H43a6 6 0 0 1-6-5.4z" />
      <path className={styles.ball} stroke="" d="M36 48h28" />
      <circle className={styles.ball} stroke="" cx="50" cy="60" r="4" />
    </svg>
  ),
  neonbreak: (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect stroke="" x="12" y="30" width="76" height="40" rx="6" />
      <circle className={styles.ball} stroke="" cx="50" cy="50" r="9" />
      <path className={styles.ball} stroke="" d="M50 41 V59" />
    </svg>
  ),
};

export function GameAmbience({ className }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = layer.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Scrolled past, the hero is doing nothing but burning battery. Stop the
    // rotation while it is off screen and pick it up again on the way back.
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      timer ??= setInterval(() => setIndex((current) => (current + 1) % bitGames.length), HOLD_MS);
    };
    const stop = () => {
      clearInterval(timer);
      timer = undefined;
    };
    const watcher = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()));
    watcher.observe(node);
    return () => {
      stop();
      watcher.disconnect();
    };
  }, []);

  const game = bitGames[index];

  return (
    <div className={className ? `${styles.ambience} ${className}` : styles.ambience} ref={layer} aria-hidden="true">
      <div className={styles.stage} key={game.id} style={{ "--pkg-color": game.color } as CSSProperties}>
        {scenes[game.id]}
      </div>
    </div>
  );
}
