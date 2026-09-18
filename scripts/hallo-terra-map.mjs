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

import { HEIGHT, WIDTH, area, extent, portrait, project, round, speck, toPath } from "./hallo-terra-geo.mjs";

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
  const drawn = toPath(feature.geometry);
  // Tuvalu, Nauru and the Vatican survive 1:50m as specks and then lose even
  // that to simplification. A country that disappears cannot be greeted, so
  // whatever is left of it is replaced by a mark at its label point.
  const rings = drawn.rings.length ? drawn.rings : [[[label[0] - 1.6, label[1] - 1.6], [label[0] + 1.6, label[1] + 1.6]]];
  const d = drawn.packed || speck(label);
  countries.push({
    box: extent(rings),
    crop: portrait(rings),
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
