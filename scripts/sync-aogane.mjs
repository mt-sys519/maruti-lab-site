// Copy the playable AOGANE (蒼鉄) build into public/aogane/play.
//
// The game lives in its own repository and keeps changing there; this copies
// only what the browser needs, so proto/, tests/, design/, tools/ and
// launch.py stay behind. The game opens in a page of its own rather than an
// iframe: it asks for pointer lock, full screen and the camera.
//
//   node scripts/sync-aogane.mjs [path-to-aogane-repo]
//
// assets/voice is left out on purpose. Without aoi_lines.csv the voice loader
// stops at its first request; with it, and no directory listing to read, it
// probes four extensions for every line and fills the console with 404s.
// Copy it in once the recorded lines exist and the loader no longer needs a
// listing.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(process.argv[2] ?? "C:/Users/a_tkm/Documents/GitHub/aogane");
const dest = join(root, "public", "aogane", "play");

const files = ["main.js", "three-cel.js", "styles.css", "head-tracker.worker.js", "assets/cover.webp"];
const dirs = ["vendor", "assets/pilot", "assets/fonts"];

for (const f of ["index.html", ...files, ...dirs]) {
  if (!existsSync(join(src, f))) throw new Error(`missing in ${src}: ${f}`);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const f of files) { mkdirSync(dirname(join(dest, f)), { recursive: true }); cpSync(join(src, f), join(dest, f)); }
for (const d of dirs) cpSync(join(src, d), join(dest, d), { recursive: true });

// Unlisted until it is announced: the page says noindex itself, and the tab
// says what it is instead of the build number.
let html = readFileSync(join(src, "index.html"), "utf8");
html = html.replace(/<title>[^<]*<\/title>/, "<title>蒼鉄 -AOGANE- | Maruti Lab</title>");
html = html.replace(
  /(<meta name="viewport"[^>]*>)/,
  '$1\n  <meta name="robots" content="noindex,nofollow">',
);
if (!html.includes('name="robots"')) throw new Error("could not add the robots meta");
writeFileSync(join(dest, "index.html"), html);

console.log(`AOGANE copied from ${src} to ${dest}`);
