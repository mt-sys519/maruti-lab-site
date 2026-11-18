"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { BitGameId } from "./games";
import { bitGames as games } from "./games";

type BitSeriesNavProps = { active: BitGameId };

// The nav is one row of nine names that has always scrolled sideways once the
// window is narrower than they are. Nothing said so: the scrollbar is hidden,
// and the row runs to the edge of the screen with no sign there is more of it.
// These two steps say so, each one only on the side that has something left.
const Chevron = ({ back }: { back?: boolean }) => (
  <svg viewBox="0 0 9 11" aria-hidden="true" focusable="false">
    <path d={back ? "M7 1 2 5.5 7 10" : "M2 1l5 4.5L2 10"} />
  </svg>
);

export function BitSeriesNav({ active }: BitSeriesNavProps) {
  const rail = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ back: false, on: false });

  const measure = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    // A pixel of slack: fractional widths leave a fraction of a scroll behind
    // at the far end, and a step that scrolls nothing is worse than no step.
    const left = Math.round(el.scrollLeft);
    setEdges({ back: left > 1, on: left + el.clientWidth < el.scrollWidth - 1 });
  }, []);

  // The row starts at the game that is open, not at 001: on a phone the later
  // games' own names were off the screen on their own pages (2026-11-18). It
  // stops clear of the back step drawn over the left edge; where the row
  // can't scroll that far (the last few, or a screen wide enough for all) it
  // simply goes as far as it can. Before paint, so the row doesn't jump.
  useLayoutEffect(() => {
    const el = rail.current;
    const here = el?.querySelector<HTMLElement>("a.isActive");
    if (!el || !here) return;
    const x = here.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
    // 44px clears the 38px step; a wide screen's own padding is already more
    el.scrollLeft = Math.max(0, x - Math.max(44, parseFloat(getComputedStyle(el).paddingLeft) || 0));
  }, [active]);

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      watch.disconnect();
    };
  }, [measure]);

  // Most of a screenful, not all of it: the name you were looking at stays on
  // screen as an anchor instead of the row jumping to somewhere unrelated.
  const step = (way: number) => {
    const el = rail.current;
    if (el) el.scrollBy({ left: way * el.clientWidth * 0.72, behavior: "smooth" });
  };

  return (
    <div className="bitSeriesNavWrap">
      {edges.back && (
        <button type="button" className="bitSeriesNavStep isPrev" onClick={() => step(-1)} aria-label="前のゲームを見る">
          <Chevron back />
        </button>
      )}
      <nav className="bitSeriesNav" aria-label="ゲームを選ぶ" ref={rail}>
        {games.map((game) => (
          <a
            key={game.id}
            className={active === game.id ? "isActive" : undefined}
            href={game.href}
            style={{ "--pkg-color": game.color } as CSSProperties}
          >
            <small>{game.number}</small>{game.name}
          </a>
        ))}
      </nav>
      {edges.on && (
        <button type="button" className="bitSeriesNavStep isNext" onClick={() => step(1)} aria-label="次のゲームを見る">
          <Chevron />
        </button>
      )}
    </div>
  );
}
