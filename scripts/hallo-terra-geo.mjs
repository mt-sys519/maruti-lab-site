// The geometry HALLO TERRA's two map files are both built out of: the
// projection, the thinning, and the packing. Kept in one place so the detailed
// coastlines and the base map cannot drift apart - they have to land on the
// same grid or a country swapped from one to the other would jump.

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

// Coordinates as text - "1740.9 522.9" - is most of this file, and most of
// that is the same few digits over and over. Written as the step from the
// previous point instead, at a tenth of a unit, each number is nearly always
// small enough to fit in one character. Zigzag first, so that -3 costs what 3
// costs; five bits a character with the sixth marking "more to come".
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function packNumber(n) {
  let v = n < 0 ? -n * 2 - 1 : n * 2;
  let out = "";
  do {
    const chunk = v & 31;
    v >>= 5;
    out += ALPHABET[chunk | (v > 0 ? 32 : 0)];
  } while (v > 0);
  return out;
}

function ring(points, tolerance = TOLERANCE) {
  const projected = points.map(project);
  // Thin a country in proportion to its own size, not the world's. A quarter
  // of a unit is nothing along the coast of Brazil and is most of Monaco: at a
  // flat tolerance, forty-four countries came out as four-point diamonds. No
  // ring gives up more than a fiftieth of its own width.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of projected) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const span = Math.max(maxX - minX, maxY - minY);
  const thinned = simplify(projected, Math.min(tolerance, span / 50));
  let packed = "";
  let count = 0;
  let px = 0;
  let py = 0;
  for (const [x, y] of thinned) {
    const qx = Math.round(x * 10);
    const qy = Math.round(y * 10);
    if (count && qx === px && qy === py) continue; // quantising makes duplicates
    packed += packNumber(qx - px) + packNumber(qy - py);
    px = qx;
    py = qy;
    count++;
  }
  // Three points is a shape. Fewer than that is a place with no coastline in
  // the data at all, and those get a mark of their own instead.
  return count >= 3 ? { packed: `${packed}!`, points: thinned } : null;
}

// A diamond two units across: visible as a dot, and something for the finger
// target to sit on.
function speck([x, y]) {
  const r = 1.6;
  const points = [[x, y - r], [x + r, y], [x, y + r], [x - r, y]];
  let packed = "";
  let px = 0;
  let py = 0;
  for (const [cx, cy] of points) {
    const qx = Math.round(cx * 10);
    const qy = Math.round(cy * 10);
    packed += packNumber(qx - px) + packNumber(qy - py);
    px = qx;
    py = qy;
  }
  return `${packed}!`;
}

function toPath(geometry, tolerance = TOLERANCE) {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates]
    : geometry.type === "MultiPolygon" ? geometry.coordinates
    : [];
  let packed = "";
  const rings = [];
  for (const polygon of polygons) {
    for (const each of polygon) {
      const drawn = ring(each, tolerance);
      if (!drawn) continue;
      packed += drawn.packed;
      rings.push(drawn.points);
    }
  }
  return { packed, rings };
}

// The drawn extent of a country, so a tap can rule out all but a handful of
// paths before asking the expensive question of whether the point is inside.
function extent(rings) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const points of rings) {
    for (const [x, y] of points) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
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
function portrait(rings) {
  const pieces = rings
    .map((points) => extent([points]))
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


export { WIDTH, HEIGHT, project, round, simplify, ring, speck, toPath, extent, portrait, packNumber, area, TOLERANCE };
