import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TOLERANCE, toPath } from "./hallo-terra-geo.mjs";

// The same countries at 1:10m, for the ones being looked at closely.
//
// The base map is 1:50m, which is all a whole world needs and which a phone
// can push around at sixty frames a second. It is not enough when you lean in:
// at that scale Japan has no small islands to give, however carefully it is
// drawn. The whole world at 1:10m would answer that and cost the smoothness -
// measured at 18ms a frame against 7 - so it is not the base map. It is this,
// fetched once the first time somebody zooms in, and applied only to the
// countries actually on screen.
//
//   node scripts/hallo-terra-detail.mjs
const SOURCE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson";
const here = dirname(fileURLToPath(import.meta.url));
const cache = join(here, "..", ".cache", "ne_10m_admin_0_countries.geojson");
const out = join(here, "..", "public", "hallo-terra", "world-detail.json");

// Finer than the base map's thinning, because this is the file that exists to
// be looked at closely. At the deepest zoom one unit is about five pixels, so
// this throws away half a pixel.
const FINE = 0.1;

async function source() {
  if (existsSync(cache)) return JSON.parse(await readFile(cache, "utf8"));
  process.stdout.write("downloading Natural Earth 1:10m (13MB)...\n");
  const response = await fetch(SOURCE);
  if (!response.ok) throw new Error(`Natural Earth: ${response.status}`);
  const text = await response.text();
  await mkdir(dirname(cache), { recursive: true });
  await writeFile(cache, text);
  return JSON.parse(text);
}

const geo = await source();
const detail = {};
let points = 0;
for (const feature of geo.features) {
  const p = feature.properties;
  const iso = p.ISO_A3 && p.ISO_A3 !== "-99" ? p.ISO_A3 : p.ADM0_A3 || p.SU_A3;
  const drawn = toPath(feature.geometry, FINE);
  if (!drawn.packed) continue;
  // 1:10m splits a few countries into pieces the 1:50m file keeps whole; the
  // first one wins and the rest are appended, which is what the map wants.
  detail[iso] = (detail[iso] ?? "") + drawn.packed;
  points += drawn.rings.reduce((n, ring) => n + ring.length, 0);
}

await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(detail));
const kb = (JSON.stringify(detail).length / 1024).toFixed(0);
process.stdout.write(
  `${Object.keys(detail).length} countries at 1:10m, ${points} points, ${kb} KB (base map thins at ${TOLERANCE}, this at ${FINE})\n`,
);
