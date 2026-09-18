"use client";

import { useEffect, useRef, useState } from "react";

type Line = { left: number; top: number; width: number; height: number };

/**
 * A title with a highlighter that runs across it the way a hand would: one
 * stroke, starting at the first character and ending at the last, carrying on
 * from the end of one line to the start of the next.
 *
 * CSS alone cannot do that. A background on the block is measured against the
 * whole height, so a wrapped title gets one band across its last line; moving
 * it onto the inline run and cloning the box decoration puts a band on every
 * line but fills them all at once, which reads as four pens rather than one.
 * So the lines are measured and given a bar each, and each bar waits for the
 * ones before it and takes time in proportion to its own width - which is
 * what keeps the pen at a constant speed rather than the same speed per line.
 */
export function NoteTitle({ text }: { text: string }) {
  const host = useRef<HTMLSpanElement>(null);
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const run = el.querySelector<HTMLElement>("[data-run]");
    if (!run) return;
    const measure = () => {
      const base = el.getBoundingClientRect();
      setLines(
        [...run.getClientRects()].map((r) => ({
          left: r.left - base.left,
          top: r.top - base.top,
          width: r.width,
          height: r.height,
        })),
      );
    };
    measure();
    // The card is fluid, so the line breaks move with the column.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  const total = lines.reduce((sum, line) => sum + line.width, 0) || 1;
  const stroke = 0.66;
  // How far the pen has already travelled when each line begins. A title runs
  // to one, two, at most three lines, so the repeated walk costs nothing and
  // keeps the render free of a counter being advanced as it goes.
  const travelled = lines.map((_, index) =>
    lines.slice(0, index).reduce((sum, line) => sum + line.width, 0),
  );

  return (
    <span className="noteTitle" ref={host}>
      <span className="noteTitleInk" aria-hidden="true">
        {lines.map((line, index) => {
          const delay = (travelled[index] / total) * stroke;
          return (
            <i
              key={index}
              style={{
                left: line.left - 3,
                top: line.top + line.height * 0.46,
                width: line.width + 6,
                transitionDelay: `${delay.toFixed(3)}s`,
                transitionDuration: `${((line.width / total) * stroke).toFixed(3)}s`,
                // Not quite level, the way a hand is not quite level.
                rotate: index % 2 ? "0.5deg" : "-0.7deg",
              }}
            />
          );
        })}
      </span>
      <span data-run>{text}</span>
    </span>
  );
}
