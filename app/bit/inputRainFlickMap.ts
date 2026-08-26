/**
 * Character map for INPUT RAIN's in-game 12-key flick pad. No OS IME involved — this
 * commits hiragana directly. Direction convention (verified against the standard
 * established when iPhone adopted flick input in 2008): tap = あ段, up = い段,
 * right = う段, down = え段, left = お段.
 */

export type FlickDir = "tap" | "up" | "right" | "down" | "left";

export type FlickCharKey = {
  id: string;
  kind: "char";
  chars: Partial<Record<FlickDir, string>>;
};

export type FlickFunctionKey = {
  id: string;
  kind: "mutate";
  label: string;
};

export type FlickKeyDef = FlickCharKey | FlickFunctionKey;

/** Row-major 4x3 layout: あかさ / たなは / まやら / 濁点・小 わ 、。 */
export const FLICK_KEYS: FlickKeyDef[] = [
  { id: "a", kind: "char", chars: { tap: "あ", up: "い", right: "う", down: "え", left: "お" } },
  { id: "ka", kind: "char", chars: { tap: "か", up: "き", right: "く", down: "け", left: "こ" } },
  { id: "sa", kind: "char", chars: { tap: "さ", up: "し", right: "す", down: "せ", left: "そ" } },
  { id: "ta", kind: "char", chars: { tap: "た", up: "ち", right: "つ", down: "て", left: "と" } },
  { id: "na", kind: "char", chars: { tap: "な", up: "に", right: "ぬ", down: "ね", left: "の" } },
  { id: "ha", kind: "char", chars: { tap: "は", up: "ひ", right: "ふ", down: "へ", left: "ほ" } },
  { id: "ma", kind: "char", chars: { tap: "ま", up: "み", right: "む", down: "め", left: "も" } },
  { id: "ya", kind: "char", chars: { tap: "や", right: "ゆ", left: "よ" } },
  { id: "ra", kind: "char", chars: { tap: "ら", up: "り", right: "る", down: "れ", left: "ろ" } },
  { id: "mutate", kind: "mutate", label: "゛゜小" },
  { id: "wa", kind: "char", chars: { tap: "わ", right: "ん", down: "ー", left: "を" } },
  { id: "punct", kind: "char", chars: { tap: "、", up: "！", right: "。", down: "？" } },
];

/** Dakuten / handakuten / small-kana cycles, all on the single toggle key. */
const MUTATION_CYCLES: string[][] = [
  ["か", "が"], ["き", "ぎ"], ["く", "ぐ"], ["け", "げ"], ["こ", "ご"],
  ["さ", "ざ"], ["し", "じ"], ["す", "ず"], ["せ", "ぜ"], ["そ", "ぞ"],
  ["た", "だ"], ["ち", "ぢ"], ["つ", "づ", "っ"], ["て", "で"], ["と", "ど"],
  ["は", "ば", "ぱ"], ["ひ", "び", "ぴ"], ["ふ", "ぶ", "ぷ"], ["へ", "べ", "ぺ"], ["ほ", "ぼ", "ぽ"],
  ["あ", "ぁ"], ["い", "ぃ"], ["う", "ぅ"], ["え", "ぇ"], ["お", "ぉ"],
  ["や", "ゃ"], ["ゆ", "ゅ"], ["よ", "ょ"],
  ["わ", "ゎ"],
];

export function nextMutation(char: string): string {
  for (const cycle of MUTATION_CYCLES) {
    const index = cycle.indexOf(char);
    if (index !== -1) return cycle[(index + 1) % cycle.length];
  }
  return char;
}

/**
 * True if `typed` is either exactly `expected` or another step on the same dakuten /
 * handakuten / small-kana cycle as `expected` — e.g. typing base "そ" is a valid partial
 * entry toward target "ぞ", since the mutate key still needs to be pressed to get there.
 */
export function isReachableTowards(typed: string, expected: string | undefined): boolean {
  if (expected === undefined) return false;
  if (typed === expected) return true;
  return MUTATION_CYCLES.some((cycle) => cycle.includes(typed) && cycle.includes(expected));
}
