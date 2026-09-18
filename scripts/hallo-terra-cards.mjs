import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// HALLO TERRA's picture of itself: the card that goes out when the link is
// shared, which is also the card on the front page. A photograph of a real
// page in a real browser, the way the rest of the site's cards are made - the
// drawing, the drawn wordmark and the rounded face are all things a standalone
// rasteriser would get wrong. One size, 1200x630, because the front page fits
// every card into the same box and a picture of another shape sits narrower
// than its neighbours - which is exactly what the first one did.
//
// Chrome only writes PNG, and a PNG of a crayon drawing is a megabyte of paper
// grain, so each shot is re-encoded as a JPEG on the way out: the same picture
// at a twentieth of the weight, and jpg is what a crawler is happiest with.
//
//   npm run dev
//   node scripts/hallo-terra-cards.mjs [--port 3000]
const run = promisify(execFile);
const chrome = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((path) => existsSync(path));
if (!chrome) throw new Error("No Chrome or Edge found to capture with.");

const args = process.argv.slice(2);
const portFlag = args.indexOf("--port");
const port = portFlag === -1 ? "3000" : args[portFlag + 1];
const at = (target) => fileURLToPath(new URL(`../${target}`, import.meta.url));

async function shot(url, width, height, target) {
  const profile = await mkdtemp(join(tmpdir(), "terra-card-"));
  const shotPath = join(profile, "screenshot.png");
  await run(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    // The drawing and the fonts both arrive over the network; without this the
    // shutter opens on an empty page.
    "--virtual-time-budget=6000",
    `--screenshot=${shotPath}`,
    url,
  ]);
  await sharp(shotPath).jpeg({ quality: 86, chromaSubsampling: "4:4:4", mozjpeg: true }).toFile(at(target));
  await rm(profile, { recursive: true, force: true });
  const kb = ((await stat(at(target))).size / 1024).toFixed(0);
  process.stdout.write(`  ${target}  ${width}x${height}  ${kb} KB\n`);
}

await mkdir(at("public/og"), { recursive: true });
await shot(`http://localhost:${port}/hallo-terra/card`, 1200, 630, "public/og/hallo-terra.jpg");
