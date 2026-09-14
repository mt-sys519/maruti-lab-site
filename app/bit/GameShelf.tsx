"use client";

import { useRef } from "react";
import type { CSSProperties } from "react";
import { bitGames } from "./games";
import { GameMark } from "./GameMark";
import styles from "./GameShelf.module.css";

// Past this many pixels a pointer gesture is a drag, not a click, and the
// unit under the cursor must not open its game when the button comes up.
const DRAG_THRESHOLD = 6;

/** The whole catalog on one row, as a shelf of handhelds. Shared by the home
 *  hero and the /bit index - the two pages show the same shelf rather than
 *  two versions of it. */
export function GameShelf({ className }: { className?: string }) {
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: false });

  function settle() {
    const strip = rail.current;
    if (!strip) return;
    // Already parked against the right end: snapping back would fight the
    // reader, who can see there is nothing further along.
    if (strip.scrollLeft >= strip.scrollWidth - strip.clientWidth - 2) return;
    const units = Array.from(strip.children) as HTMLElement[];
    const nearest = units.reduce((best, unit) =>
      Math.abs(unit.offsetLeft - strip.scrollLeft) < Math.abs(best.offsetLeft - strip.scrollLeft)
        ? unit
        : best,
    );
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
    strip.scrollTo({ left: nearest.offsetLeft, behavior });
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
      // click never reaches the unit underneath and the game never opens.
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
    <div
      className={className ? `${styles.shelf} ${className}` : styles.shelf}
      ref={rail}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={suppressClick}
    >
      {bitGames.map((game) => (
        <a
          href={game.href}
          key={game.id}
          className={styles.unit}
          style={{ "--pkg-color": game.color } as CSSProperties}
          draggable={false}
        >
          <span className={styles.bezel}>
            <span className={styles.screen}>
              <span className={styles.serial}>{game.number}</span>
              <span className={styles.visual}>
                <GameMark id={game.id} />
              </span>
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
      ))}
    </div>
  );
}
