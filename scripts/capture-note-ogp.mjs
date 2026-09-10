import { execFile } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

// The note share cards, captured the same way the MarutiBit ones are: a real
// page in a real browser, because the cards use the site's own paper, grid and
// Japanese type. Run the dev server first.
//
//   npm run dev
//   node scripts/capture-note-ogp.mjs browser-only [--port 3000]
//
// It also writes `image:` into the post's front matter, so the article page
// knows the card exists without asking the filesystem - Workers cannot.
const run = promisify(execFile);

const chrome = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((path) => existsSync(path));
if (!chrome) throw new Error("No Chrome or Edge found to capture with.");

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
if (!slug) throw new Error("Usage: node scripts/capture-note-ogp.mjs <slug>");
const portFlag = args.indexOf("--port");
const port = portFlag === -1 ? "3000" : args[portFlag + 1];

const outputDirectory = fileURLToPath(new URL("../public/og/blog/", import.meta.url));
const postFile = fileURLToPath(new URL(`../content/posts/${slug}.md`, import.meta.url));
if (!existsSync(postFile)) throw new Error(`No such note: content/posts/${slug}.md`);

async function shot(selector, width, height, fileName) {
  const profile = await mkdtempProfile();
  const target = join(profile, "screenshot.png");
  await run(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    `--screenshot=${target}`,
    `http://localhost:${port}/og-preview?note=${encodeURIComponent(slug)}&only=${selector}`,
  ]);
  await mkdir(outputDirectory, { recursive: true });
  await rename(target, join(outputDirectory, fileName));
  await rm(profile, { recursive: true, force: true });
  console.log(`  ${fileName}  ${width}x${height}`);
}

async function mkdtempProfile() {
  const { mkdtemp } = await import("node:fs/promises");
  return mkdtemp(join(tmpdir(), "note-ogp-"));
}

console.log(`Capturing ${slug} from http://localhost:${port}/og-preview`);
await shot("wide", 1200, 630, `${slug}.png`);
await shot("square", 630, 630, `${slug}-square.png`);

// Record the card on the post so the article page can point at it.
const source = await readFile(postFile, "utf8");
const line = `image: /og/blog/${slug}.png`;
if (source.includes(line)) {
  console.log("  front matter already points at the card");
} else {
  const updated = source.replace(/^(---\r?\n[\s\S]*?)(\r?\n---)/, `$1\n${line}$2`);
  await writeFile(postFile, updated, "utf8");
  console.log(`  wrote "${line}" into content/posts/${slug}.md`);
}
