import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Who to thank, and what they asked for in return.
//
// Half the voices are CC-BY or ShareAlike, and both of those are conditions
// rather than courtesies: name the source, link the licence, and - for the
// ShareAlike ones - pass the same terms on to whatever you make with them.
// A list of file names was not that. This reads the model card of every voice
// actually used and writes down the dataset it came from, so the credits page
// is the truth rather than a retyping of it.
//
//   node scripts/hallo-terra-credits.mjs
const here = dirname(fileURLToPath(import.meta.url));
const audio = JSON.parse(await readFile(join(here, "..", "app", "hallo-terra", "audio.generated.json"), "utf8"));
const out = join(here, "..", "app", "hallo-terra", "credits.generated.json");

const card = (voice) => {
  // bg_BG-dimitar-medium -> bg/bg_BG/dimitar/medium
  const [tongue, name, quality] = voice.split("-");
  return `https://huggingface.co/rhasspy/piper-voices/resolve/main/${tongue.split("_")[0]}/${tongue}/${name}/${quality}/MODEL_CARD`;
};

// The cards are a handful of "* Label: value" lines, so they are read as
// lines rather than with a pattern - there is nothing here worth a regex.
const field = (text, label) => {
  for (const raw of text.split("\n")) {
    const line = raw.replace(/^[*\s]+/, "");
    if (line.toLowerCase().startsWith(`${label.toLowerCase()}:`)) return line.slice(label.length + 1).trim();
  }
  return "";
};

const voices = [...new Set(Object.values(audio).map((a) => a.voice))].sort();
const credits = {};
for (const voice of voices) {
  const response = await fetch(card(voice));
  if (!response.ok) throw new Error(`${voice}: ${response.status}`);
  const text = await response.text();
  credits[voice] = {
    language: field(text, "Language"),
    quality: field(text, "Quality"),
    dataset: field(text, "URL"),
    licence: field(text, "License"),
    card: card(voice),
  };
  process.stdout.write(`  ${voice.padEnd(30)} ${credits[voice].licence}\n`);
}

await writeFile(out, `${JSON.stringify(credits, null, 2)}\n`);
process.stdout.write(`\n${voices.length} voices written to app/hallo-terra/credits.generated.json\n`);
