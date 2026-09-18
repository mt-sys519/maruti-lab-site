import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The land, kept as longitude and latitude rather than as a picture, because
// the globe in the opening is re-projected every frame as it turns. The flat
// map's data is no use here: those paths are already flattened.
//
//   node scripts/hallo-terra-globe.mjs   (after hallo-terra-map.mjs has cached the source)
const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "..", ".cache", "ne_50m_admin_0_countries.geojson");
const out = join(here, "..", "public", "hallo-terra", "globe.json");

// Degrees. On a globe drawn at about 460px across, this is roughly a pixel.
const TOLERANCE = 0.35;
// Islands smaller than this never read as anything but a speck of noise at
// that size, and there are thousands of them.
const MIN_AREA = 1.2;

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
      let distance;
      if (length === 0) {
        distance = (x - x1) ** 2 + (y - y1) ** 2;
      } else {
        let t = ((x - x1) * dx + (y - y1) * dy) / length;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        distance = (x - (x1 + t * dx)) ** 2 + (y - (y1 + t * dy)) ** 2;
      }
      if (distance > worst) { worst = distance; at = i; }
    }
    if (worst > squared && at > 0) {
      keep[at] = 1;
      stack.push([first, at], [at, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function area(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

const geo = JSON.parse(await readFile(source, "utf8"));
const rings = [];
for (const feature of geo.features) {
  const { type, coordinates } = feature.geometry;
  const polygons = type === "Polygon" ? [coordinates] : type === "MultiPolygon" ? coordinates : [];
  for (const polygon of polygons) {
    const outer = polygon[0];
    if (area(outer) < MIN_AREA) continue;
    const simple = simplify(outer, TOLERANCE);
    if (simple.length < 4) continue;
    // Two decimals of a degree is about a kilometre, and the globe is never
    // drawn large enough to tell.
    rings.push(simple.map(([lon, lat]) => [Math.round(lon * 100) / 100, Math.round(lat * 100) / 100]));
  }
}

await writeFile(out, JSON.stringify({ rings }));
const kb = (JSON.stringify({ rings }).length / 1024).toFixed(0);
process.stdout.write(`${rings.length} rings, ${rings.reduce((n, r) => n + r.length, 0)} points, ${kb} KB\n`);
