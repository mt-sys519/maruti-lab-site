import { execFile } from "node:child_process";
import { mkdtemp, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

// Captures a MarutiBit share card from /og-preview with headless Chrome. The
// cards use Baloo 2, Yu Gothic and the site's dot-grid, so they have to come
// from a real browser - an SVG rasteriser has none of those. Run the dev
// server first:
//
//   npm run dev
//   node scripts/capture-bit-ogp.mjs neonbreak [--port 3001]
const run = promisify(execFile);

const chrome = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((path) => existsSync(path));
if (!chrome) throw new Error("No Chrome or Edge found to capture with.");

const args = process.argv.slice(2);
const game = args.find((a) => !a.startsWith("--")) ?? "neonbreak";
const portFlag = args.indexOf("--port");
const port = portFlag === -1 ? "3000" : args[portFlag + 1];
const suffix = args.includes("--v2") ? "-v2" : "";

const outputDirectory = fileURLToPath(new URL("../public/og/bit/", import.meta.url));

async function shot(selector, width, height, fileName) {
  const profile = await mkdtemp(join(tmpdir(), "bit-ogp-"));
  const target = join(profile, "screenshot.png");
  await run(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    `--screenshot=${target}`,
    // Chrome's --screenshot captures the viewport, so the card is positioned
    // at the origin and the window sized to it rather than clipped afterwards.
    `http://localhost:${port}/og-preview?game=${game}&only=${selector}`,
  ]);
  await rename(target, join(outputDirectory, fileName));
  await rm(profile, { recursive: true, force: true });
  console.log(`  ${fileName}  ${width}x${height}`);
}

console.log(`Capturing ${game} cards from http://localhost:${port}/og-preview`);
await shot("wide", 1200, 630, `${game}${suffix}.png`);
await shot("square", 630, 630, `${game}${suffix}-square.png`);
