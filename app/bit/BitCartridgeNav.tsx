"use client";

import type { BitGameId } from "./games";
import { bitGames } from "./games";
import styles from "./BitCartridgeNav.module.css";

type BitCartridgeNavProps = { current: BitGameId };

export function BitCartridgeNav({ current }: BitCartridgeNavProps) {
  const index = bitGames.findIndex((game) => game.id === current);
  const prev = bitGames[(index - 1 + bitGames.length) % bitGames.length];
  const next = bitGames[(index + 1) % bitGames.length];

  function playRandom(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const others = bitGames.filter((game) => game.id !== current);
    const pick = others[Math.floor(Math.random() * others.length)];
    window.location.href = pick.href;
  }

  return (
    <nav className={styles.nav} aria-label="他のゲームへ移動">
      <a href={prev.href} className={styles.side}>
        <span className={styles.label}><span aria-hidden="true">‹</span> PREV</span>
        <small>{prev.name}</small>
      </a>
      <a href={bitGames[0].href} onClick={playRandom} className={styles.random}>
        <span aria-hidden="true">🎲</span> RANDOM
      </a>
      <a href={next.href} className={`${styles.side} ${styles.next}`}>
        <span className={styles.label}>NEXT <span aria-hidden="true">›</span></span>
        <small>{next.name}</small>
      </a>
    </nav>
  );
}
