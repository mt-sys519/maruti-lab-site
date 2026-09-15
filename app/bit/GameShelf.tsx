"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
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
export type ShelfHandle = { step: (direction: -1 | 1) => void };

export const GameShelf = forwardRef<ShelfHandle, { className?: string }>(function GameShelf(
  { className },
  handle,
) {
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: false });
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Where the shelf has to be scrolled for this machine to sit in the middle
  // of the window. Snapping is centred too, so a gesture always leaves one
  // machine in the middle rather than one flush against the left edge.
  function centreOf(strip: HTMLDivElement, unit: HTMLElement) {
    return unit.offsetLeft - (strip.clientWidth - unit.offsetWidth) / 2;
  }

  function copyWidth(strip: HTMLDivElement) {
    const units = strip.children as HTMLCollectionOf<HTMLElement>;
    if (units.length <= bitGames.length) return 0;
    return units[bitGames.length].offsetLeft - units[0].offsetLeft;
  }

  // Open on the tagged machine, in the middle - the one the shelf is meant to
  // show off. Within the middle copy, so there is a whole catalog of room in
  // both directions before the first wrap is needed.
  useEffect(() => {
    const strip = rail.current;
    if (!strip) return;
    const featured = Math.max(0, bitGames.findIndex((game) => "tag" in game));
    const unit = strip.children[bitGames.length + featured] as HTMLElement | undefined;
    if (!unit) return;
    const width = copyWidth(strip);
    let left = centreOf(strip, unit);
    if (left < width) left += width;
    if (left >= width * 2) left -= width;
    strip.scrollLeft = left;

    // Where the browser has it, this is exact, and the timer above is only
    // there for the browsers that do not.
    if (!("onscrollend" in strip)) return;
    const onEnd = () => {
      if (drag.current.active) return;
      clearTimeout(idle.current);
      wrap();
    };
    strip.addEventListener("scrollend", onEnd);
    return () => {
      strip.removeEventListener("scrollend", onEnd);
      clearTimeout(idle.current);
    };
  }, []);


  // The arrows live with whatever section is using the shelf, so it hands out
  // the one move they need rather than drawing buttons of its own.
  useImperativeHandle(handle, () => ({
    step(direction) {
      const strip = rail.current;
      if (!strip) return;
      const units = Array.from(strip.children) as HTMLElement[];
      const next = direction === 1
        ? units.find((unit) => centreOf(strip, unit) > strip.scrollLeft + 4)
        : [...units].reverse().find((unit) => centreOf(strip, unit) < strip.scrollLeft - 4);
      if (!next) return;
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      strip.scrollTo({ left: centreOf(strip, next), behavior });
    },
  }));

  function wrap() {
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

  // Moving the scroll position while a flick is still travelling is what made
  // the shelf shake on a phone: the browser is animating toward a target it
  // worked out before the jump, so it carries on to where that target used to
  // be and drags the row back. Under `scroll-snap-type: x mandatory` it then
  // re-snaps from there, and the two fight for as long as the momentum lasts.
  // A mouse drag has no momentum - the position is ours - so that still wraps
  // as it goes; everything else waits for the scrolling to stop. There are
  // three copies of the catalog, so there is a whole shelf of room to wait in.
  function keepLooping() {
    if (drag.current.active) {
      wrap();
      return;
    }
    clearTimeout(idle.current);
    idle.current = setTimeout(wrap, 140);
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
    // Against centreOf, not offsetLeft: the units snap to centre, so aiming at
    // a unit's left edge landed a half-unit off and the browser pulled it back
    // afterwards - one gesture, two moves, and the second one visible.
    const nearest = units.reduce((best, unit) =>
      Math.abs(centreOf(strip, unit) - strip.scrollLeft) <
      Math.abs(centreOf(strip, best) - strip.scrollLeft)
        ? unit
        : best,
    );
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
    strip.scrollTo({ left: centreOf(strip, nearest), behavior });
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
});
