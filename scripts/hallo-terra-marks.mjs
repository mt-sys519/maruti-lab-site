import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import roughModule from "roughjs";

// HALLO TERRA's drawn furniture: the mark, and the few shapes the interface is
// built out of. rough.js draws them once, here, and what ships is the path
// strings - the library itself never reaches the browser.
//
//   node scripts/hallo-terra-marks.mjs
const rough = roughModule.default ?? roughModule;
const gen = rough.generator();
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "app", "hallo-terra", "marks.generated.ts");

const round = (d) => d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n) * 10) / 10));
const paths = (drawable) => gen.toPaths(drawable).map((p) => round(p.d));

// A world with something being said about it. The bubble breaks the circle's
// outline on purpose: a globe with a sticker on it reads as one object, a
// globe beside a bubble reads as two.
// Single strokes, not rough.js's default two: drawn twice, a circle this size
// reads as a scribble rather than a line.
const pen = { roughness: 0.9, bowing: 1.5, disableMultiStroke: true };

// A world with something being said about it.
const mark = [
  // the world
  ...paths(gen.circle(28, 36, 42, { ...pen, seed: 11 })),
  // its equator, seen from slightly above
  ...paths(gen.ellipse(28, 36, 42, 15, { ...pen, seed: 4 })),
  // and one meridian, which is what makes a circle a globe
  ...paths(gen.ellipse(28, 36, 16, 42, { ...pen, seed: 9 })),
  // the hello, clear of the globe so it reads as speech and not as a moon
  ...paths(gen.ellipse(52, 13, 24, 18, { ...pen, seed: 21 })),
  ...paths(gen.linearPath([[45, 20], [40, 27], [50, 22]], { ...pen, roughness: 0.7, seed: 6 })),
];

// The name, drawn rather than typeset. Each letter is a few strokes on an
// 80-tall grid, put through the same pen as the mark, so the wordmark is in
// the same hand as the globe instead of being a font that happens to sit
// beside it. Only seven letters are needed for HALLO TERRA.
const H = 80;
const LETTERS = {
  H: { w: 60, s: [[[0, 0], [0, H]], [[60, 0], [60, H]], [[0, 41], [60, 39]]] },
  A: { w: 62, s: [[[0, H], [31, 0]], [[31, 0], [62, H]], [[13, 53], [49, 53]]] },
  L: { w: 52, s: [[[0, 0], [0, H]], [[0, H], [52, H]]] },
  T: { w: 60, s: [[[0, 2], [60, 0]], [[30, 1], [30, H]]] },
  E: { w: 52, s: [[[0, 0], [0, H]], [[0, 1], [52, 0]], [[0, 40], [43, 39]], [[0, H], [52, H]]] },
  R: {
    w: 60,
    s: [
      [[0, 0], [0, H]],
      [[0, 1], [38, 0], [56, 19], [38, 38], [0, 39]],
      [[33, 38], [60, H]],
    ],
  },
};
const GAP = 17;
const SPACE = 40;

function wordmark(word, ink = pen) {
  const strokes = [];
  let x = 0;
  let seed = 100;
  for (const letter of word) {
    if (letter === " ") {
      x += SPACE;
      continue;
    }
    if (letter === "O") {
      strokes.push(...paths(gen.ellipse(x + 31, 40, 62, H, { ...ink, seed: seed++ })));
      x += 62 + GAP;
      continue;
    }
    const glyph = LETTERS[letter];
    for (const stroke of glyph.s) {
      const moved = stroke.map(([px, py]) => [px + x, py]);
      strokes.push(...paths(gen.linearPath(moved, { ...ink, roughness: (ink.roughness ?? 1) * 0.85, seed: seed++ })));
    }
    x += glyph.w + GAP;
  }
  return { strokes, width: Math.round(x - GAP) };
}

const name = wordmark("HALLO TERRA");

// A felt tip: an even, generous line that wanders only a little, with no
// texture at all. A marker does not skip and it does not thin out; what makes
// it look handmade is the weight and the rounded ends, not grain. This is the
// hand the site uses at display sizes; the thinner pen above takes over when
// the mark gets small enough that a heavy line would fill the globe in.
const marker = { roughness: 0.65, bowing: 1.05, disableMultiStroke: true };
const markMarker = [
  ...paths(gen.circle(28, 36, 42, { ...marker, seed: 11 })),
  ...paths(gen.ellipse(28, 36, 42, 15, { ...marker, seed: 4 })),
  ...paths(gen.ellipse(28, 36, 16, 42, { ...marker, seed: 9 })),
  ...paths(gen.ellipse(52, 13, 24, 18, { ...marker, seed: 21 })),
  ...paths(gen.linearPath([[45, 20], [40, 27], [50, 22]], { ...marker, roughness: 0.5, seed: 6 })),
];
const nameMarker = wordmark("HALLO TERRA", marker);

// The boxes the interface is made of. Drawn in a 100x40 frame and stretched
// to whatever the button or field needs: the wobble stretches with it, which
// is what a drawn box does, while the stroke is held to a real width in the
// stylesheet so a wide box is not drawn with a fatter pen than a narrow one.
// Three of them, so a row of buttons is not the same box three times.
const FRAMES = [3, 12, 27].map((seed) =>
  paths(gen.rectangle(2, 2, 96, 36, { roughness: 1.1, bowing: 1.5, disableMultiStroke: true, seed })),
);

// Shapes to scatter behind the writing. Blobs rather than boxes, and drawn in
// a square box that is never stretched: the earlier sheets were drawn 100
// units wide and shown 700 wide, and a wobble stretched seven times over stops
// being a wobble and becomes a slack curve. Held square, the hand survives.
function blob(seed, wander) {
  const points = [];
  const n = 11;
  let r = 42;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    // A wander that comes back to where it started, so the shape closes.
    r += Math.sin(seed + i * 1.7) * wander + Math.cos(seed * 2 + i * 0.9) * wander * 0.6;
    r = Math.max(30, Math.min(48, r));
    points.push([50 + Math.cos(a) * r, 50 + Math.sin(a) * r * 0.92]);
  }
  const drawn = gen.curve([...points, points[0], points[1]], {
    roughness: 1.3,
    bowing: 1.1,
    disableMultiStroke: true,
    fill: "#000",
    fillStyle: "solid",
    seed: Math.round(seed * 13),
  });
  const parts = gen.toPaths(drawn);
  return {
    fill: parts.filter((part) => part.fill && part.fill !== "none").map((part) => round(part.d)),
    line: parts.filter((part) => part.stroke && part.stroke !== "none").map((part) => round(part.d)),
  };
}

const BLOBS = [1.1, 2.4, 3.9, 5.2, 6.6, 7.8].map((seed, i) => blob(seed, 2 + (i % 3)));

// A ring to draw round the place being looked at, in a 100-wide box so it can
// be scaled to whatever the country needs.
const ring = paths(gen.circle(50, 50, 92, { roughness: 1.5, bowing: 1.6, seed: 31 }));

// A line under a heading, drawn rather than ruled.
const rule = paths(gen.linearPath([[0, 6], [200, 6]], { roughness: 1.1, bowing: 2.2, seed: 17 }));

const file = `// Generated by scripts/hallo-terra-marks.mjs - do not edit by hand.
// rough.js drew these once; nothing here costs the browser a library.

export const MARK: string[] = ${JSON.stringify(mark, null, 2)};

/** The name, drawn. Sits in a ${name.width} x 80 box. */
export const WORDMARK: string[] = ${JSON.stringify(name.strokes, null, 2)};
export const WORDMARK_BOX = "0 -6 ${name.width + 6} 92";
export const WORDMARK_MARKER_BOX = "0 -6 ${nameMarker.width + 6} 92";

/** The same two with a felt tip: heavier, even, no texture. */
export const MARK_MARKER: string[] = ${JSON.stringify(markMarker, null, 2)};
export const WORDMARK_MARKER: string[] = ${JSON.stringify(nameMarker.strokes, null, 2)};


/** A hand-drawn circle in a 100x100 box, for ringing the chosen place. */
export const RING: string[] = ${JSON.stringify(ring, null, 2)};

/** Loose shapes in a square box, to be scattered behind the writing. */
export const BLOBS: { fill: string[]; line: string[] }[] = ${JSON.stringify(BLOBS, null, 2)};

/** Hand-drawn boxes in a 100x40 frame, to be stretched over a control. */
export const FRAMES: string[][] = ${JSON.stringify(FRAMES, null, 2)};

/** A hand-drawn line 200 units wide, for underlining. */
export const RULE: string[] = ${JSON.stringify(rule, null, 2)};
`;

await writeFile(out, file);
process.stdout.write(`mark ${mark.length} strokes, ring ${ring.length}, rule ${rule.length}\n`);

// A page to look at them on, thrown away after.
const line = (d) => `<path d="${d}"/>`;
const markSvg = (w, sw, color) =>
  `<svg viewBox="0 0 68 62" width="${w}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${mark.map(line).join("")}</svg>`;
const nameSvg = (w, sw, color) =>
  `<svg viewBox="${`0 -6 ${name.width + 6} 92`}" width="${w}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${name.strokes.map(line).join("")}</svg>`;
const lockup = (h, sw, color) =>
  `<div style="display:flex;align-items:center;gap:${h / 4}px;margin-bottom:34px">${markSvg(h, sw * 1.3, color)}${nameSvg(h * 5.2, sw, color)}</div>`;

const markerMarkSvg = (w, sw, color) =>
  `<svg viewBox="0 0 68 62" width="${w}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${markMarker.map(line).join("")}</svg>`;
const markerNameSvg = (w, sw, color) =>
  `<svg viewBox="${`0 -6 ${nameMarker.width + 6} 92`}" width="${w}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${nameMarker.strokes.map(line).join("")}</svg>`;

const preview = `<!doctype html><meta charset="utf-8"><body style="background:#f2f0e9;padding:46px;color:#1c211e;font:12px/1.6 sans-serif">
<p style="letter-spacing:.2em;color:#4a504a">大 - 太</p>
<div style="display:flex;align-items:center;gap:22px;margin-bottom:34px">${markerMarkSvg(120, 4.2, "#1c211e")}${markerNameSvg(500, 5.2, "#1c211e")}</div>
<p style="letter-spacing:.2em;color:#4a504a">中 - 細</p>
<div style="display:flex;align-items:center;gap:14px;margin-bottom:34px">${markerMarkSvg(54, 2.4, "#1c211e")}${markerNameSvg(230, 3, "#1c211e")}</div>
<p style="letter-spacing:.2em;color:#4a504a">中 - 細 (朱)</p>
<div style="display:flex;align-items:center;gap:14px;margin-bottom:34px">${markerMarkSvg(44, 2.4, "#ad4434")}${markerNameSvg(190, 3, "#ad4434")}</div>
<p style="letter-spacing:.2em;color:#4a504a">小 - ペン</p>
<div style="display:flex;align-items:center;gap:10px">${markSvg(30, 1.8, "#1c211e")}${nameSvg(130, 2.4, "#1c211e")}</div>
</body>`;
// Kept out of public/ on purpose: it is a workbench, not part of the site.
await writeFile(join(here, "..", ".cache", "marks-preview.html"), preview);
