"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TerraLogo from "./TerraLogo";
import { varieties } from "./content";

/* The opening: a crowd with a space in the middle, and a turning globe in it.
   The globe is a 2D canvas re-projecting the coastlines each frame rather
   than a WebGL sphere - at this size nobody can tell, it costs 27KB over the
   wire, and a phone does not have to wake its GPU to be greeted.

   Going in is not a page change. The scene scales up about the globe and
   fades, and the map that was underneath all along is what is left. */

type Ring = [number, number][];

const TILT = 14; // degrees; the north pole leans away, as globes do on a stand
const SPIN = 7; // degrees a second
const DWELL = 2800; // how long the world turns before it opens
const DIVE = 900;
const WORD = 850; // how long each greeting stays

// Short enough to read at a glance and to fit across a globe.
const POOL = Object.values(varieties)
  .map((v) => v.expressions.greeting?.text?.split(" / ")[0]?.trim())
  .filter((t): t is string => !!t && t.length <= 12);

// Two drawings of the same gathering: one lying down for a window, one
// standing up for a phone, where the wide one could only ever be a strip of
// somebody's jumper. Each leaves its own space for the globe, and each space
// was measured off the artwork rather than guessed. In the crayon drawing the
// circle is barely brighter than the paper - what separates them is blue,
// since the paper is cream and the circle is not - so each was found by
// looking for the widest run of pixels that are bright without being warm.
// The globe is drawn a little larger than the space so the circle's soft edge
// is covered rather than left showing as a ring.
// The numbers themselves live in the stylesheet, next to the drawing each one
// belongs to: which drawing is shown is a media query, and a media query is
// something the server can send in the HTML. Asking the window in JavaScript
// meant the opening could not exist until JavaScript ran, and what ran first
// was the site itself.

export default function TerraIntro({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [leaving, setLeaving] = useState(false);
  const [word, setWord] = useState(0);
  const closing = useRef(false);

  // Real greetings out of the real data, a different few each visit. Waiting
  // is only long when there is nothing to do, and reading three words in
  // three languages is both something to do and the whole pitch.
  const [greetings, setGreetings] = useState<string[]>(() => POOL.slice(0, 4));
  useEffect(() => {
    // After the first frame, because shuffling during a render is not a thing
    // a component is allowed to do.
    const frame = requestAnimationFrame(() => {
      const pool = [...POOL];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      setGreetings(pool.slice(0, 4));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const leave = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setLeaving(true);
    window.setTimeout(onDone, DIVE);
  }, [onDone]);

  useEffect(() => {
    // Somebody who has asked for less movement gets none: the stylesheet keeps
    // the opening off their screen, and this takes it off the page. On a tick
    // rather than here, so nothing is set during the effect itself.
    const still =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.location.hash === "#map";
    const timer = window.setTimeout(leave, still ? 0 : DWELL);
    const cycle = window.setInterval(() => setWord((n) => n + 1), WORD);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(cycle);
    };
  }, [leave]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let rings: Ring[] = [];
    let raf = 0;
    let live = true;

    fetch("/hallo-terra/globe.json")
      .then((r) => r.json())
      .then((data: { rings: Ring[] }) => {
        if (live) rings = data.rings;
      })
      .catch(() => {
        /* the crowd alone is still a picture */
      });

    // The globe takes its colours from the stylesheet rather than keeping its
    // own copy, so the sea in the opening is the sea on the map.
    const skin = getComputedStyle(canvas);
    const sea = skin.getPropertyValue("--terra-sea").trim() || "#cfe2e8";
    const land = skin.getPropertyValue("--terra-land").trim() || "#ecdfc6";
    const edge = skin.getPropertyValue("--terra-line").trim() || "#c2b49a";

    const draw = (now: number) => {
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(box.width * dpr)) {
        canvas.width = Math.round(box.width * dpr);
        canvas.height = Math.round(box.height * dpr);
      }
      const size = canvas.width;
      const r = (size / 2) * 0.99;
      const cx = size / 2;
      const cy = canvas.height / 2;
      context.clearRect(0, 0, canvas.width, canvas.height);

      context.beginPath();
      context.arc(cx, cy, r, 0, Math.PI * 2);
      context.fillStyle = sea;
      context.fill();
      context.save();
      context.clip();

      const spin = ((now / 1000) * SPIN + 138) * (Math.PI / 180);
      const tilt = (TILT * Math.PI) / 180;
      const sinTilt = Math.sin(tilt);
      const cosTilt = Math.cos(tilt);

      context.fillStyle = land;
      context.strokeStyle = edge;
      context.lineWidth = Math.max(1, dpr * 0.75);

      // A coastline that goes round the back comes back in pieces, and a piece
      // has to be closed somehow before it can be filled. Closed with a
      // straight line - which is what a path does by itself - the closing line
      // cuts across the globe and fills a wedge of land over the sea, which is
      // what Siberia looked like. Each piece is closed along the rim instead,
      // the way the real edge of the world runs. The rim is only used to fill:
      // it is not a coastline, so it is not drawn.
      for (const ring of rings) {
        let run: [number, number][] = [];
        // Whether this ring ever went round the back. An island that never
        // does is closed the ordinary way: flinging its ends out to the rim,
        // which is right for a cut coastline, would drag a line across the
        // ocean for one that was never cut.
        let cut = false;
        const flush = () => {
          if (run.length > 1 && !cut) {
            context.beginPath();
            context.moveTo(run[0][0], run[0][1]);
            for (const [px, py] of run.slice(1)) context.lineTo(px, py);
            context.closePath();
            context.fill();
            context.stroke();
          } else if (run.length > 1) {
            // Pull the two ends out onto the rim so the arc meets them.
            const ends = [run[0], run[run.length - 1]].map(([px, py]) => {
              const dx = px - cx;
              const dy = py - cy;
              const length = Math.hypot(dx, dy) || 1;
              return [cx + (dx / length) * r, cy + (dy / length) * r] as [number, number];
            });
            context.beginPath();
            context.moveTo(ends[0][0], ends[0][1]);
            for (const [px, py] of run.slice(1)) context.lineTo(px, py);
            context.lineTo(ends[1][0], ends[1][1]);
            const from = Math.atan2(ends[1][1] - cy, ends[1][0] - cx);
            const to = Math.atan2(ends[0][1] - cy, ends[0][0] - cx);
            let sweep = to - from;
            while (sweep > Math.PI) sweep -= Math.PI * 2;
            while (sweep < -Math.PI) sweep += Math.PI * 2;
            context.arc(cx, cy, r, from, to, sweep < 0);
            context.closePath();
            context.fill();

            context.beginPath();
            context.moveTo(run[0][0], run[0][1]);
            for (const [px, py] of run.slice(1)) context.lineTo(px, py);
            context.stroke();
          }
          run = [];
        };
        for (const [lon, lat] of ring) {
          const l = (lon * Math.PI) / 180 - spin;
          const p = (lat * Math.PI) / 180;
          const cosP = Math.cos(p);
          // The far side of the world is behind the near side, so it is not
          // drawn: the sign of this is which hemisphere the point is on.
          if (sinTilt * Math.sin(p) + cosTilt * cosP * Math.cos(l) <= 0) {
            cut = true;
            flush();
            continue;
          }
          run.push([
            cx + r * cosP * Math.sin(l),
            cy - r * (cosTilt * Math.sin(p) - sinTilt * cosP * Math.cos(l)),
          ]);
        }
        flush();
      }
      context.restore();

      context.beginPath();
      context.arc(cx, cy, r, 0, Math.PI * 2);
      context.strokeStyle = "rgba(28, 33, 30, 0.14)";
      context.lineWidth = Math.max(1, dpr);
      context.stroke();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      live = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className={`terraIntro${leaving ? " leaving" : ""}`} role="presentation" onClick={leave}>
      {/* The picture fills the screen rather than sitting on it as a
          rectangle, and the globe is positioned inside the picture's own
          frame, so the two stay locked together however the window is cropped.
          The zoom layer is separate from the name and the button: they belong
          to the page, not to the scene being dived into. */}
      <div className="terraIntroZoom">
        <div className="terraIntroScene">
          {/* Two drawings of the same gathering, one lying down and one
              standing up, chosen by the browser before a line of ours runs.
              A plain picture element rather than next/image: these are already
              webp at the size they are shown, and this one has to be in the
              first paint. */}
          <picture>
            <source media="(max-width: 860px)" srcSet="/hallo-terra/intro-tall.webp" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hallo-terra/intro.webp" alt="" fetchPriority="high" decoding="sync" />
          </picture>
          <canvas
            ref={canvasRef}
            /* Width only: the height follows from aspect-ratio, because a
               percentage height here would answer to the frame, not the circle. */
          />
          {!leaving && (
            <p className="terraIntroWord">
              <span key={word}>{greetings[word % Math.max(1, greetings.length)] ?? ""}</span>
            </p>
          )}
        </div>
      </div>

      <div className="terraIntroFoot">
        <TerraLogo size="lg" />
        <button type="button" className="terraIntroSkip" onClick={leave}>
          地図をひらく
        </button>
      </div>
    </div>
  );
}
