import type { CSSProperties } from "react";
import type { bitGames } from "./games";
import { GameMark } from "./GameMark";
import styles from "./GameUnit.module.css";

export type BitGame = (typeof bitGames)[number];

/** One game as a handheld: the shell in the game's package color, the name
 *  on the dark bezel where light text is readable whatever the shell is.
 *  Shared by the shelf and by the machine of the day, so they cannot drift. */
export function GameUnit({ game, className, ...rest }: {
  game: BitGame;
  className?: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={game.href}
      className={className ? `${styles.unit} ${className}` : styles.unit}
      style={{ "--pkg-color": game.color } as CSSProperties}
      draggable={false}
      {...rest}
    >
      {"tag" in game && (
        <b className={styles.tag}>
          <svg viewBox="0 0 72 72" aria-hidden="true">
            <path d="M36.0 2.0 L43.1 9.4 L53.0 6.6 L55.4 16.6 L65.4 19.0 L62.6 28.9 L70.0 36.0 L62.6 43.1 L65.4 53.0 L55.4 55.4 L53.0 65.4 L43.1 62.6 L36.0 70.0 L28.9 62.6 L19.0 65.4 L16.6 55.4 L6.6 53.0 L9.4 43.1 L2.0 36.0 L9.4 28.9 L6.6 19.0 L16.6 16.6 L19.0 6.6 L28.9 9.4 Z" />
          </svg>
          <span>{game.tag}</span>
        </b>
      )}
      <span className={styles.bezel}>
        <span className={styles.screen}>
          <span className={styles.serial}>{game.number}</span>
          <span className={styles.visual}><GameMark id={game.id} /></span>
        </span>
        <span className={styles.plate}>
          <strong className={styles.name}>{game.name}</strong>
          <small className={styles.kind}>{game.kind}</small>
        </span>
      </span>
      <span className={styles.controls} aria-hidden="true">
        <i className={styles.pad} />
        <i className={styles.buttons} />
      </span>
    </a>
  );
}
