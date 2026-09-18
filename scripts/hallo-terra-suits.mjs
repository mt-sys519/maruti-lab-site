import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import roughModule from "roughjs";

// Four suits, drawn rather than typed, each sitting in a square someone drew
// round it. Not part of the site - this is the workbench. Run it and look:
//
//   node scripts/hallo-terra-suits.mjs
const rough = roughModule.default ?? roughModule;
const gen = rough.generator();
const here = dirname(fileURLToPath(import.meta.url));

const round = (d) => d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n) * 10) / 10));
const paths = (drawable) =>
  gen.toPaths(drawable).map((part) => ({
    d: round(part.d),
    filled: Boolean(part.fill && part.fill !== "none"),
  }));

// Drawn once with a fill and once again round the edge, which is how a shape
// like this gets its weight in a hand-drawn set: the fill wanders a little
// inside the line rather than meeting it exactly.
const pen = { roughness: 1.05, bowing: 1.3, disableMultiStroke: true, fill: "#000", fillStyle: "solid" };
const shape = (d, seed) => paths(gen.path(d, { ...pen, seed }));

const HEART =
  "M32 51 C17 40 11 32 11 25 C11 18 16 13 22 13 C27 13 31 17 32 21 C33 17 37 13 42 13 C48 13 53 18 53 25 C53 32 47 40 32 51 Z";
const SPADE =
  "M32 12 C41 23 53 30 53 38 C53 45 48 48 43 48 C38 48 35 45 34 43 C34 47 36 51 39 54 L25 54 C28 51 30 47 30 43 C29 45 26 48 21 48 C16 48 11 45 11 38 C11 30 23 23 32 12 Z";
const DIAMOND = "M32 10 L51 32 L32 55 L13 32 Z";
// The club is three lobes and a stalk, and it has to be drawn as one outline.
// Three overlapping circles leave their crossings inside the shape, and a club
// with lines through it is a bunch of grapes.
const CLUB =
  "M32 11 C38 11 43 16 43 22 C43 24 42.5 26 41.6 27.6 C43 27 44.5 26.6 46 26.6 " +
  "C52 26.6 57 31.6 57 37.6 C57 43.6 52 48.6 46 48.6 C41 48.6 36.8 45.3 35.6 40.8 " +
  "C34.6 42.6 34 45 34 47 C34 50 35 52.5 37 54.5 L27 54.5 C29 52.5 30 50 30 47 " +
  "C30 45 29.4 42.6 28.4 40.8 C27.2 45.3 23 48.6 18 48.6 C12 48.6 7 43.6 7 37.6 " +
  "C7 31.6 12 26.6 18 26.6 C19.5 26.6 21 27 22.4 27.6 C21.5 26 21 24 21 22 " +
  "C21 16 26 11 32 11 Z";

const SUITS = {
  heart: shape(HEART, 4),
  spade: shape(SPADE, 17),
  diamond: shape(DIAMOND, 26),
  club: shape(CLUB, 31),
};

// The square each one stands in, scribbled full of lines rather than washed
// with a flat colour. This is the one thing rough.js does that nothing else
// does as easily: a fill made of strokes, going one way, not quite parallel,
// overshooting the edges - which is what filling a box in by hand looks like
// and what a flat rectangle of colour never will.
const scribble = (seed, angle) =>
  paths(
    gen.rectangle(4, 4, 56, 56, {
      roughness: 1.1,
      bowing: 1.4,
      disableMultiStroke: true,
      fill: "#000",
      fillStyle: "hachure",
      hachureAngle: angle,
      hachureGap: 5.5,
      fillWeight: 1.6,
      seed,
    }),
  );

// Four colours a six-year-old would pick, each with a deeper one of itself for
// the shape that stands on it.
const SUITS_INK = {
  heart: { light: "#f2a0b8", dark: "#c4526f" },
  spade: { light: "#7cc0e8", dark: "#3d7fad" },
  diamond: { light: "#f5c95a", dark: "#c08a1e" },
  club: { light: "#8ed07f", dark: "#4d8f45" },
};
const TILES = {
  heart: scribble(5, -41),
  spade: scribble(16, 38),
  diamond: scribble(29, -37),
  club: scribble(41, 44),
};

const stroke = (part, colour, width) =>
  `<path d="${part.d}" fill="none" stroke="${colour}" stroke-width="${width}"/>`;

const tile = (name, size, sw) => {
  const colour = SUITS_INK[name];
  return `
<svg viewBox="0 0 64 64" width="${size}" fill="none" stroke-linecap="round" stroke-linejoin="round">
  ${TILES[name].map((part) => stroke(part, colour.light, part.filled ? sw * 0.7 : sw * 0.8)).join("")}
  ${SUITS[name]
    .map((part) =>
      part.filled
        ? // The shape is filled with the colour its own outline is drawn in.
          // Filled with the pale one it read as a sticker sitting on the
          // scribble rather than as something drawn and then coloured in.
          `<path d="${part.d}" fill="${colour.dark}" stroke="none" opacity="0.92"/>`
        : stroke(part, colour.dark, sw * 1.15),
    )
    .join("")}
</svg>`;
};

const row = (size, sw) =>
  `<div style="display:flex;gap:18px;align-items:center;margin-bottom:26px">
    ${["heart", "spade", "diamond", "club"].map((name) => tile(name, size, sw)).join("")}
  </div>`;

const page = `<!doctype html><meta charset="utf-8"><body style="background:#fdfaec;padding:46px;color:#1c211e;font:12px/1.6 sans-serif">
<p style="letter-spacing:.2em;color:#4a504a">♥ ♠ ◆ ♣</p>
${row(150, 2)}${row(72, 2.4)}${row(34, 3.2)}${row(22, 4)}
</body>`;

await writeFile(join(here, "..", ".cache", "suits.html"), page);
process.stdout.write(`four suits, ${Object.values(SUITS).reduce((n, s) => n + s.length, 0)} strokes\n`);
