import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// AIR HOCKEY's result cards: the card X shows under a shared result
// (/bit/airhockey?r=<slug>, swapped in by worker/index.ts). The score stays in
// the post's text, so a card only says the stage, the level and who won:
// 14 of them, not one per score. The two tables are frames of the real game
// (scripts/airhockey-og/*.jpg: the replay's camera on the CPU's end, the puck
// set down on the table well inside the edge - a frame of the replay itself
// caught it tipping into the goal, floating), the words laid over them. No URL
// on the card: X prints the domain under it, and at a timeline's size it was
// too small to read anyway.
//
//   node scripts/generate-airhockey-result-og.mjs
const outputDir = path.resolve("public/og/bit/airhockey");
await fs.mkdir(outputDir, { recursive: true });

const W = 1200;
const H = 630;
const mono = "Consolas, 'Courier New', monospace";

const cards = [];
for (const level of ["easy", "normal", "hard"]) {
  for (const won of [true, false]) cards.push({ slug: `arcade-${level}-${won ? "win" : "lose"}`, table: "arcade", line: `ARCADE · ${level.toUpperCase()}`, head: won ? "YOU WIN" : "YOU LOSE", color: won ? "#ff3a2c" : "#9aa6b8" });
}
for (const level of ["elite", "champion", "legend"]) {
  for (const won of [true, false]) cards.push({ slug: `pro-${level}-${won ? "win" : "lose"}`, table: "pro", line: `PRO STAGE · ${level.toUpperCase()}`, head: won ? "YOU WIN" : "YOU LOSE", color: won ? "#ff3a2c" : "#9aa6b8" });
}
cards.push({ slug: "2p-blue", table: "arcade", line: "2 PLAYERS", head: "BLUE WINS", color: "#3d8bff" });
cards.push({ slug: "2p-yellow", table: "arcade", line: "2 PLAYERS", head: "YELLOW WINS", color: "#f5b82e" });

const overlay = ({ line, head, color }) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="shade" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#08090c" stop-opacity=".92"/>
      <stop offset=".45" stop-color="#08090c" stop-opacity=".72"/>
      <stop offset=".72" stop-color="#08090c" stop-opacity="0"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="12"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#shade)"/>
  <text x="64" y="110" fill="#a3a8b4" font-family="${mono}" font-size="34" font-weight="700">MarutiBit  AIR HOCKEY</text>
  <text x="64" y="184" fill="#e8e6df" font-family="${mono}" font-size="40" font-weight="700">${line}</text>
  <text x="58" y="390" fill="${color}" opacity=".55" filter="url(#glow)" font-family="${mono}" font-size="112" font-weight="700">${head}</text>
  <text x="58" y="390" fill="${color}" font-family="${mono}" font-size="112" font-weight="700">${head}</text>
</svg>`);

const bases = {};
for (const table of ["arcade", "pro"]) {
  bases[table] = await sharp(path.resolve(`scripts/airhockey-og/${table}.jpg`)).resize(W, H, { fit: "cover" }).toBuffer();
}
for (const card of cards) {
  await sharp(bases[card.table])
    .composite([{ input: overlay(card) }])
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(path.join(outputDir, `${card.slug}.jpg`));
}
console.log(`${cards.length} cards in ${outputDir}`);
