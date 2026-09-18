"use client";

import Image from "next/image";
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

// Where the illustration left a space for the globe, measured off the artwork:
// the circle is 40.1% of the width, centred at 50.09% / 39.1%. The globe is
// drawn a little larger than that so the pale edge of the painted circle is
// covered rather than left showing as a ring.
const DISC_X = 50.09;
const DISC_Y = 39.1;
const DISC_SIZE = 41.4;

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
    const timer = window.setTimeout(leave, DWELL);
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
      context.fillStyle = "#dce3e4";
      context.fill();
      context.save();
      context.clip();

      const spin = ((now / 1000) * SPIN + 138) * (Math.PI / 180);
      const tilt = (TILT * Math.PI) / 180;
      const sinTilt = Math.sin(tilt);
      const cosTilt = Math.cos(tilt);

      // Slightly deeper than the flat map's land, and outlined: at this size
      // the map's own pairing of paper on water has almost no contrast left.
      context.fillStyle = "#e0d9c7";
      context.strokeStyle = "rgba(122, 130, 118, 0.5)";
      context.lineWidth = Math.max(1, dpr * 0.75);
      context.beginPath();
      for (const ring of rings) {
        let open = false;
        for (const [lon, lat] of ring) {
          const l = (lon * Math.PI) / 180 - spin;
          const p = (lat * Math.PI) / 180;
          const cosP = Math.cos(p);
          // The far side of the world is behind the near side, so it is not
          // drawn: the sign of this is which hemisphere the point is on.
          if (sinTilt * Math.sin(p) + cosTilt * cosP * Math.cos(l) <= 0) {
            open = false;
            continue;
          }
          const x = cx + r * cosP * Math.sin(l);
          const y = cy - r * (cosTilt * Math.sin(p) - sinTilt * cosP * Math.cos(l));
          if (open) context.lineTo(x, y);
          else context.moveTo(x, y);
          open = true;
        }
      }
      context.fill();
      context.stroke();
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
      <div className="terraIntroScene">
        <Image src="/hallo-terra/intro.jpg" alt="" fill priority sizes="100vw" style={{ objectFit: "contain" }} />
        {/* The word belongs to the waiting, not to the dive: at seven times
            the size it would be a wall of letters across the whole screen. */}
        {!leaving && (
          <p className="terraIntroWord" style={{ left: `${DISC_X}%`, top: `${DISC_Y}%` }}>
            <span key={word}>{greetings[word % Math.max(1, greetings.length)] ?? ""}</span>
          </p>
        )}
        <canvas
          ref={canvasRef}
          /* Width only: the height follows from aspect-ratio, because a
             percentage height here would answer to the frame, not the circle. */
          style={{ left: `${DISC_X}%`, top: `${DISC_Y}%`, width: `${DISC_SIZE}%` }}
        />
      </div>
      <span className="terraIntroName">
        <TerraLogo size="lg" />
      </span>
      <button type="button" className="terraIntroSkip" onClick={leave}>
        地図をひらく
      </button>
    </div>
  );
}
