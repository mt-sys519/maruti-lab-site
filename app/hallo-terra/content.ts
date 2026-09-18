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
  small: boolean;
  d: string;
};

export type World = {
  width: number;
  height: number;
  countries: Country[];
};
