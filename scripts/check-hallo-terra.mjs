import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// HALLO TERRA's content is added by hand, in batches, by whoever is writing it
// up that week. The rule that matters most - every phrase carries a katakana
// reading - is the one that went missing in the prototype, and it went missing
// because nothing broke when it did. Now something breaks.
//
//   node scripts/check-hallo-terra.mjs
const here = dirname(fileURLToPath(import.meta.url));
const read = async (path) => JSON.parse(await readFile(join(here, "..", path), "utf8"));

const varieties = await read("app/hallo-terra/data/varieties.json");
const places = await read("app/hallo-terra/data/places.json");
const world = await read("public/hallo-terra/world.json");

const onTheMap = new Set(world.countries.map((country) => country.iso));
const KINDS = ["greeting", "thanks", "apology"];
const REGISTERS = ["formal", "polite", "neutral", "casual"];
const KATAKANA = /[゠-ヿ]/;

const problems = [];
const notices = [];
const complain = (where, what) => problems.push(`${where}: ${what}`);
const note = (where, what) => notices.push(`${where}: ${what}`);

for (const [id, variety] of Object.entries(varieties)) {
  if (!variety.name?.trim()) complain(id, "name がありません");
  if (!variety.speech?.trim()) complain(id, "speech（音声の言語コード）がありません");
  const kinds = Object.keys(variety.expressions ?? {});
  if (!kinds.length) complain(id, "expressions が空です");
  for (const kind of kinds) {
    if (!KINDS.includes(kind)) complain(id, `${kind} は挨拶・お礼・お詫びのどれでもありません`);
    const expression = variety.expressions[kind];
    const at = `${id}.${kind}`;
    if (!expression.text?.trim()) complain(at, "現地表記 (text) がありません");
    if (!expression.meaning?.trim()) complain(at, "日本語の意味 (meaning) がありません");
    // The one that has to hold.
    if (!expression.reading?.trim()) complain(at, "カタカナの読み (reading) がありません");
    else if (!KATAKANA.test(expression.reading)) complain(at, `reading にカタカナがありません: ${expression.reading}`);
    if (expression.register && !REGISTERS.includes(expression.register)) {
      complain(at, `register が ${REGISTERS.join(" / ")} のどれでもありません: ${expression.register}`);
    }
    // Speech is given `audioText ?? text`, so a text offering a choice has to
    // say which half to read, or the synthesiser reads the slash too.
    if (expression.text?.includes("/") && !expression.audioText?.trim()) {
      complain(at, `text が「${expression.text}」と複数候補なので audioText が要ります`);
    }
    if (expression.audioText?.includes("/")) complain(at, "audioText は読み上げる1つだけにしてください");
    if (expression.audioText && KATAKANA.test(expression.audioText) && !KATAKANA.test(expression.text)) {
      complain(at, "audioText にカタカナが入っています（読み上げるのは現地表記です）");
    }
    if (expression.sources && !Array.isArray(expression.sources)) complain(at, "sources が配列ではありません");
    for (const source of expression.sources ?? []) {
      if (typeof source !== "string" || !/^https?:\/\//.test(source)) complain(at, `出典がURLではありません: ${source}`);
    }
  }
}

for (const [iso, place] of Object.entries(places)) {
  if (!/^[A-Z]{3}$/.test(iso)) complain(iso, "場所のキーはISOの3文字コードです");
  // Natural Earth's 1:50m countries layer folds a handful of places into the
  // country that administers them - France's overseas departments, the
  // Caribbean Netherlands, Gibraltar, Tokelau - so they have no shape of their
  // own to tap. Written up and unreachable is not an error, it is a queue: the
  // day those shapes are added, the words are already here.
  else if (!onTheMap.has(iso)) note(iso, "地図に形がないので、いまは出せません");
  if (!place.varieties?.length) complain(iso, "varieties が空です");
  // note is printed on the page and internalNote is not, so a working memo
  // that lands in the wrong one is a memo published to the world.
  if (place.note && /未検証|要レビュー|要確認|TODO/i.test(place.note)) {
    complain(iso, `note は読者に出ます。作業メモは internalNote へ: ${place.note}`);
  }
  for (const id of place.varieties ?? []) {
    if (!varieties[id]) complain(iso, `varieties.json にない言語変種を指しています: ${id}`);
  }
}

// Not an error, but worth saying out loud each time.
const unused = Object.keys(varieties).filter(
  (id) => !Object.values(places).some((place) => place.varieties?.includes(id)),
);

if (problems.length) {
  process.stderr.write(`HALLO TERRA のデータに ${problems.length} 件の問題があります\n`);
  for (const problem of problems) process.stderr.write(`  - ${problem}\n`);
  process.exit(1);
}

for (const notice of notices) process.stdout.write(`  · ${notice}
`);
process.stdout.write(
  `HALLO TERRA: ${Object.keys(places).length} の場所、${Object.keys(varieties).length} の言葉、すべて読みがあります` +
    (notices.length ? `（うち ${notices.length} は地図に形がなく未表示）` : "") +
    (unused.length ? `（どの場所からも参照されていない変種: ${unused.join(", ")}）` : "") +
    "\n",
);
