import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Turns Natural Earth's 1:50m countries into the one file the map page draws:
// Miller-projected SVG paths, Japanese names, a label point per country, and a
// flag for the ones too small to hit with a finger.
//
//   node scripts/hallo-terra-map.mjs
//
// The source GeoJSON is 3MB and is only needed here, so it is cached outside
// the repo and re-downloaded if missing. The generated file IS committed, and
// it lands in public/ rather than being imported: 330KB belongs in a cached
// static file the map fetches once, not in the page's JavaScript bundle.
const SOURCE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";
const here = dirname(fileURLToPath(import.meta.url));
const cache = join(here, "..", ".cache", "ne_50m_admin_0_countries.geojson");
const out = join(here, "..", "public", "hallo-terra", "world.json");

// Miller's cylindrical projection, straight from its definition. Writing the
// four lines costs less than four npm packages, and being cylindrical is the
// whole reason it was chosen: x depends only on longitude, so the map repeats
// sideways forever.
const WIDTH = 2000;
const K = WIDTH / (2 * Math.PI);
const millerX = (lon) => K * (lon * Math.PI) / 180;
const millerY = (lat) =>
  -1.25 * K * Math.log(Math.tan(Math.PI / 4 + (0.4 * lat * Math.PI) / 180));

const TOP = millerY(90);
const BOTTOM = millerY(-90);
const HEIGHT = BOTTOM - TOP;
const project = ([lon, lat]) => [millerX(lon) + WIDTH / 2, millerY(lat) - TOP];

// One decimal in a 2000-unit world is about two kilometres, well under a pixel
// at any zoom the map offers, and it halves the file.
const round = (n) => Math.round(n * 10) / 10;

// Natural Earth carries more vertices than most of this map can show, but not
// as many more as it first looked. The tolerance is in projected units, and at
// the deepest zoom the map allows one unit is about five pixels - so the old
// 0.45 was throwing away two pixels of coastline, which is exactly the
// "roughly right" look Japan had when you leaned in. Halving it costs 46KB
// over the wire and buys back the bays.
const TOLERANCE = 0.25;

function simplify(points, tolerance) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const squared = tolerance * tolerance;
  while (stack.length) {
    const [first, last] = stack.pop();
    const [x1, y1] = points[first];
    const [x2, y2] = points[last];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = dx * dx + dy * dy;
    let worst = 0;
    let at = -1;
    for (let i = first + 1; i < last; i++) {
      const [x, y] = points[i];
      let d;
      if (length === 0) {
        d = (x - x1) ** 2 + (y - y1) ** 2;
      } else {
        let t = ((x - x1) * dx + (y - y1) * dy) / length;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        d = (x - (x1 + t * dx)) ** 2 + (y - (y1 + t * dy)) ** 2;
      }
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > squared && at > 0) {
      keep[at] = 1;
      stack.push([first, at], [at, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function ring(points) {
  const projected = simplify(points.map(project), TOLERANCE);
  let d = "";
  let last = null;
  for (const point of projected) {
    const [x, y] = point.map(round);
    if (last && x === last[0] && y === last[1]) continue; // quantising makes duplicates
    d += `${last ? "L" : "M"}${x} ${y}`;
    last = [x, y];
  }
  return d.length > 24 ? `${d}Z` : ""; // a ring reduced to a speck is not a coastline
}

// A diamond two units across: visible as a dot, and something for the finger
// target to sit on.
function speck([x, y]) {
  const r = 1.6;
  return `M${round(x)} ${round(y - r)}L${round(x + r)} ${round(y)}L${round(x)} ${round(y + r)}L${round(x - r)} ${round(y)}Z`;
}

function toPath(geometry) {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates]
    : geometry.type === "MultiPolygon" ? geometry.coordinates
    : [];
  return polygons.map((rings) => rings.map(ring).join("")).join("");
}

// The drawn extent of a country, so a tap can rule out all but a handful of
// paths before asking the expensive question of whether the point is inside.
function bbox(d) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pair of d.matchAll(/([ML])(-?[\d.]+) (-?[\d.]+)/g)) {
    const x = Number(pair[2]);
    const y = Number(pair[3]);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return [round(minX), round(minY), round(maxX), round(maxY)];
}

// The shape people picture when they hear a country's name, as a box.
//
// The full extent is no use for a portrait: the United States measured to the
// Aleutians, or Russia wrapped past the antimeridian, is a band the width of
// the world with specks in it. But the largest single piece is no use either -
// that would draw Japan as Honshu and throw away Hokkaido. So: start from the
// biggest piece, and take in any other piece that is a real part of the
// picture (at least a twelfth of it) as long as doing so does not pull the box
// more than three times wider than the piece we started with.
function portrait(d) {
  const pieces = d
    .split("M")
    .slice(1)
    .map((part) => bbox(`M${part}`))
    .map((box) => ({ box, w: box[2] - box[0], area: (box[2] - box[0]) * (box[3] - box[1]) }))
    .sort((a, b) => b.area - a.area);
  if (!pieces.length) return null;
  const first = pieces[0];
  const box = [...first.box];
  for (const piece of pieces.slice(1)) {
    if (piece.area < first.area / 12) continue;
    const width = Math.max(box[2], piece.box[2]) - Math.min(box[0], piece.box[0]);
    if (width > Math.max(first.w * 3, 40)) continue;
    box[0] = Math.min(box[0], piece.box[0]);
    box[1] = Math.min(box[1], piece.box[1]);
    box[2] = Math.max(box[2], piece.box[2]);
    box[3] = Math.max(box[3], piece.box[3]);
  }
  return box.map(round);
}

// Shoelace on the projected rings: a rough on-screen area, used only to decide
// which countries need a tap dot of their own.
function area(geometry) {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates]
    : geometry.type === "MultiPolygon" ? geometry.coordinates
    : [];
  let total = 0;
  for (const rings of polygons) {
    const points = rings[0].map(project);
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      sum += x1 * y2 - x2 * y1;
    }
    total += Math.abs(sum) / 2;
  }
  return total;
}

const REGIONS = {
  "Eastern Asia": "東アジア",
  "South-Eastern Asia": "東南アジア",
  "Southern Asia": "南アジア",
  "Central Asia": "中央アジア",
  "Western Asia": "西アジア",
  "Northern Europe": "北ヨーロッパ",
  "Western Europe": "西ヨーロッパ",
  "Southern Europe": "南ヨーロッパ",
  "Eastern Europe": "東ヨーロッパ",
  "Northern Africa": "北アフリカ",
  "Western Africa": "西アフリカ",
  "Middle Africa": "中部アフリカ",
  "Eastern Africa": "東アフリカ",
  "Southern Africa": "南部アフリカ",
  "Northern America": "北アメリカ",
  "Central America": "中央アメリカ",
  "South America": "南アメリカ",
  Caribbean: "カリブ",
  "Australia and New Zealand": "オセアニア",
  Melanesia: "メラネシア",
  Micronesia: "ミクロネシア",
  Polynesia: "ポリネシア",
};

async function source() {
  if (existsSync(cache)) return JSON.parse(await readFile(cache, "utf8"));
  process.stdout.write("downloading Natural Earth 1:50m...\n");
  const response = await fetch(SOURCE);
  if (!response.ok) throw new Error(`Natural Earth: ${response.status}`);
  const text = await response.text();
  await mkdir(dirname(cache), { recursive: true });
  await writeFile(cache, text);
  return JSON.parse(text);
}

const geo = await source();
const countries = [];
for (const feature of geo.features) {
  const p = feature.properties;
  // ISO_A3 is "-99" for places without one of their own (Kosovo, Somaliland,
  // Northern Cyprus). They are still places people greet each other in, so
  // they keep their Natural Earth code rather than being dropped.
  const iso = p.ISO_A3 && p.ISO_A3 !== "-99" ? p.ISO_A3 : p.ADM0_A3 || p.SU_A3;
  const label = project([p.LABEL_X, p.LABEL_Y]);
  // Tuvalu, Nauru and the Vatican survive 1:50m as specks and then lose even
  // that to simplification. A country that disappears cannot be greeted, so
  // whatever is left of it is replaced by a mark at its label point.
  const d = toPath(feature.geometry) || speck(label);
  countries.push({
    box: bbox(d),
    crop: portrait(d),
    iso,
    ja: p.NAME_JA || p.NAME,
    en: p.NAME,
    region: REGIONS[p.SUBREGION] || p.SUBREGION || "",
    label: [round(label[0]), round(label[1])],
    small: area(feature.geometry) < 60,
    d,
  });
}
countries.sort((a, b) => a.iso.localeCompare(b.iso));

const world = { width: WIDTH, height: round(HEIGHT), countries };
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(world));
const kb = (JSON.stringify(world).length / 1024).toFixed(0);
process.stdout.write(
  `${countries.length} countries, ${countries.filter((c) => c.small).length} too small to tap, ${kb} KB\n`,
);
