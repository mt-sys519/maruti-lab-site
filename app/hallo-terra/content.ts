import placesJson from "./data/places.json";
import varietiesJson from "./data/varieties.json";

/**
 * HALLO TERRA's content model.
 *
 * A greeting belongs to a way of speaking, not to a country. Switzerland has
 * four, Spanish is one thing shared by twenty places, and a country's borders
 * were never a promise about the language inside them. So places point at
 * varieties, varieties own the words, and neither has to know how many of the
 * other there are.
 *
 * The map data (public/hallo-terra/world.json) is generated and carries every
 * country there is. These two files carry only the ones somebody has actually
 * written up, which will be far fewer for a long time.
 */

export type ExpressionKind = "greeting" | "thanks" | "apology";

export type Expression = {
  /** As it is written where it is spoken. */
  text: string;
  /** Katakana. Never optional: it is the whole point for a Japanese reader. */
  reading: string;
  /** What it means in Japanese. */
  meaning: string;
  /**
   * The one line to say out loud, when `text` offers a choice - "Obrigado /
   * Obrigada", or Thai's ครับ and ค่ะ. Speech reads this, never the katakana:
   * the katakana is a Japanese reader's foothold, not a pronunciation.
   */
  audioText?: string | null;
  /** How formal it is, and so who it can be said to. */
  register?: Register | null;
  /** The situation it belongs in. */
  usage?: string | null;
  /** What the katakana cannot carry - tone, a sound Japanese does not have. */
  pronunciationNote?: string | null;
  /** Where the wording was checked. */
  sources?: string[] | null;
};

export type Register = "polite" | "neutral" | "casual" | "formal";

export const REGISTER_LABEL: Record<Register, string> = {
  formal: "あらたまった言い方",
  polite: "ていねいな言い方",
  neutral: "ふつうの言い方",
  casual: "くだけた言い方",
};

export type Variety = {
  name: string;
  /** BCP 47, handed to speech synthesis until real audio exists. */
  speech: string;
  expressions: Partial<Record<ExpressionKind, Expression>>;
};

export type Place = {
  capital?: string | null;
  varieties: string[];
  gesture?: string | null;
  culture?: string | null;
  /** A line for the reader. */
  note?: string | null;
  /** A line for whoever is writing this up. Never rendered, ever. */
  internalNote?: string | null;
  sources?: string[] | null;
};

export const varieties = varietiesJson as Record<string, Variety>;
export const places = placesJson as Record<string, Place>;

export const KIND_LABEL: Record<ExpressionKind, string> = {
  greeting: "挨拶",
  thanks: "お礼",
  apology: "お詫び",
};

export const KINDS: ExpressionKind[] = ["greeting", "thanks", "apology"];

/** Every country the map can draw, whether or not anyone has written it up. */
export type Country = {
  iso: string;
  ja: string;
  en: string;
  region: string;
  label: [number, number];
  box: [number, number, number, number];
  /** The frame that holds the shape people picture, outliers left out. */
  crop: [number, number, number, number];
  small: boolean;
  d: string;
};

export type World = {
  width: number;
  height: number;
  countries: Country[];
};

/**
 * Coordinates come over the wire as steps rather than positions.
 *
 * The map is mostly numbers, and written out as text - "1740.9 522.9" - most of
 * those numbers are the same few digits again and again. Each point is stored
 * instead as how far it moved from the one before, at a tenth of a unit, which
 * is nearly always small enough to fit in a single character: 480KB of text
 * becomes 133KB, and 180KB over the wire becomes 80KB. Nothing is lost - the
 * coordinates come back exactly as they went in.
 *
 * Zigzag, so a step of -3 costs what a step of 3 costs. Five bits a character,
 * the sixth marking "there is more of this number". A "!" ends a ring, and the
 * next one starts from zero again.
 */
const UNPACK = new Map<string, number>();
"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  .split("")
  .forEach((character, index) => UNPACK.set(character, index));

export function unpack(packed: string): string {
  let d = "";
  let x = 0;
  let y = 0;
  let at = 0;
  let started = false;
  const step = () => {
    let value = 0;
    let shift = 0;
    for (;;) {
      const bits = UNPACK.get(packed[at++]) ?? 0;
      value |= (bits & 31) << shift;
      if (!(bits & 32)) break;
      shift += 5;
    }
    return value & 1 ? -((value + 1) / 2) : value / 2;
  };
  while (at < packed.length) {
    if (packed[at] === "!") {
      d += "Z";
      x = 0;
      y = 0;
      started = false;
      at++;
      continue;
    }
    x += step();
    y += step();
    d += `${started ? "L" : "M"}${x / 10} ${y / 10}`;
    started = true;
  }
  return d;
}
