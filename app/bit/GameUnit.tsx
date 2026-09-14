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
      {"tag" in game && <b className={styles.tag}>{game.tag}</b>}
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
