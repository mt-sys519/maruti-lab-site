import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import sharp from "sharp";

// Photographs each game's real screen from /shot-preview, for the machine of
// the day on /bit. The alternative was an iframe of the live game, which on a
// NEON BREAK day would have pulled 4.3MB of assets and run its animation loop
// on a page nobody is playing on.
//
//   npm run dev
//   node scripts/capture-game-shots.mjs            (all of them)
//   node scripts/capture-game-shots.mjs paku       (just one)
const run = promisify(execFile);

const chrome = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((path) => existsSync(path));
if (!chrome) throw new Error("No Chrome or Edge found to capture with.");

const ids = ["angle", "blank", "sequence", "input-rain", "paku", "liltorb", "avenue", "neonbreak"];
const args = process.argv.slice(2);
const portFlag = args.indexOf("--port");
const port = portFlag === -1 ? "3000" : args[portFlag + 1];
const wanted = args.filter((a) => !a.startsWith("--") && a !== port);
const games = wanted.length ? wanted : ids;

const width = 900;
const height = 700;
const outputDirectory = fileURLToPath(new URL("../public/games/shots/", import.meta.url));
await mkdir(outputDirectory, { recursive: true });

for (const game of games) {
  const profile = await mkdtemp(join(tmpdir(), "bit-shot-"));
  const target = join(profile, "screenshot.png");
  await run(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    // The animated ones need a moment before they have anything to show:
    // fish have to swim out, rain has to fall, particles have to gather.
    "--virtual-time-budget=6000",
    `--screenshot=${target}`,
    `http://localhost:${port}/shot-preview?game=${game}`,
  ]);
  // PNG is the only thing Chrome will write, and it is the wrong format for
  // these: AVENUE's rainy room came out at 680KB. WebP puts the same picture
  // in a tenth of that.
  const file = join(outputDirectory, `${game}.webp`);
  const { size } = await sharp(target).webp({ quality: 82 }).toFile(file);
  await rm(profile, { recursive: true, force: true });
  console.log(`  ${game}.webp  ${width}x${height}  ${Math.round(size / 1024)}KB`);
}
