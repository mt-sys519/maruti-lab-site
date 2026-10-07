// Copy the playable AOGANE (蒼鉄) build into public/aogane/play.
//
// The game lives in its own repository and keeps changing there; this copies
// only what the browser needs, so proto/, tests/, design/, tools/ and
// launch.py stay behind. The game opens in a page of its own rather than an
// iframe: it asks for pointer lock, full screen and the camera.
//
//   node scripts/sync-aogane.mjs [path-to-aogane-repo]
//
// assets/voice ships the script (aoi_lines.csv) and AOI's recorded lines as
// aoi_<id>.mp3 (2026-10-07); the loader asks for each id's MP3 first, so no
// directory listing is needed and nothing 404s.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(process.argv[2] ?? "C:/Users/a_tkm/Documents/GitHub/aogane");
const dest = join(root, "public", "aogane", "play");

const files = ["main.js", "three-cel.js", "styles.css", "head-tracker.worker.js", "assets/cover.webp"];
const dirs = ["vendor", "assets/pilot", "assets/fonts", "assets/voice"];

for (const f of ["index.html", ...files, ...dirs]) {
  if (!existsSync(join(src, f))) throw new Error(`missing in ${src}: ${f}`);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const f of files) { mkdirSync(dirname(join(dest, f)), { recursive: true }); cpSync(join(src, f), join(dest, f)); }
for (const d of dirs) cpSync(join(src, d), join(dest, d), { recursive: true });

// The tab says what it is instead of the build number. (Until 2026-10-08 the
// page also carried noindex; that came off when AOGANE was announced.)
let html = readFileSync(join(src, "index.html"), "utf8");
html = html.replace(/<title>[^<]*<\/title>/, "<title>蒼鉄 -AOGANE- | Maruti Lab</title>");
writeFileSync(join(dest, "index.html"), html);

console.log(`AOGANE copied from ${src} to ${dest}`);
