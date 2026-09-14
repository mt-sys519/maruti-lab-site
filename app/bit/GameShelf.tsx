"use client";

import { useEffect, useRef } from "react";
import { bitGames } from "./games";
import { GameUnit } from "./GameUnit";
import styles from "./GameShelf.module.css";

// Past this many pixels a pointer gesture is a drag, not a click, and the
// unit under the cursor must not open its game when the button comes up.
const DRAG_THRESHOLD = 6;

// The shelf has no ends. Three copies of the catalog are laid end to end and
// the scroll position is pushed back by exactly one copy whenever it leaves
// the middle one, so the reader can keep going either way and the seam never
// shows: the unit arriving is the same unit that just left.
const COPIES = [0, 1, 2];


/** The whole catalog on one row, as a shelf of handhelds. Shared by the home
 *  hero and the /bit index - the two pages show the same shelf rather than
 *  two versions of it. */
export function GameShelf({ className }: { className?: string }) {
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: false });

  function copyWidth(strip: HTMLDivElement) {
    const units = strip.children as HTMLCollectionOf<HTMLElement>;
    if (units.length <= bitGames.length) return 0;
    return units[bitGames.length].offsetLeft - units[0].offsetLeft;
  }

  // Start on the middle copy so there is a whole catalog of room in both
  // directions before the first wrap is needed.
  useEffect(() => {
    const strip = rail.current;
    if (strip) strip.scrollLeft = copyWidth(strip);
  }, []);


  function keepLooping() {
    const strip = rail.current;
    if (!strip) return;
    const width = copyWidth(strip);
    if (width <= 0) return;
    const shift = strip.scrollLeft >= width * 2 ? -width : strip.scrollLeft < width ? width : 0;
    if (!shift) return;
    strip.scrollLeft += shift;
    // A drag in progress measures from where it began, so that has to move
    // with it or the shelf lurches out from under the cursor.
    drag.current.startLeft += shift;
  }

  // Snapping has to be off while a gesture is moving the shelf by hand: left
  // on, it pulls back toward the nearest machine after every single step and
  // eats most of the travel. It goes back on once the gesture has settled.
  function holdSnap(strip: HTMLDivElement) {
    strip.style.scrollSnapType = "none";
  }

  function settle() {
    const strip = rail.current;
    if (!strip) return;
    strip.style.scrollSnapType = "";
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
      holdSnap(rail.current);
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
      onScroll={keepLooping}
      onClickCapture={suppressClick}
    >
      {COPIES.flatMap((copy) =>
        bitGames.map((game) => (
          <GameUnit
            game={game}
            key={`${copy}-${game.id}`}
            className={styles.railUnit}
            aria-hidden={copy === 1 ? undefined : true}
            tabIndex={copy === 1 ? undefined : -1}
          />
        ))
      )}
    </div>
  );
}
