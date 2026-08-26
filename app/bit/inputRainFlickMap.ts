/**
 * Character map for INPUT RAIN's in-game 12-key flick pad. No OS IME involved — this
 * commits hiragana directly. Direction convention (per explicit spec): tap = あ段,
 * left = い段, up = う段, right = え段, down = お段.
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
  { id: "a", kind: "char", chars: { tap: "あ", left: "い", up: "う", right: "え", down: "お" } },
  { id: "ka", kind: "char", chars: { tap: "か", left: "き", up: "く", right: "け", down: "こ" } },
  { id: "sa", kind: "char", chars: { tap: "さ", left: "し", up: "す", right: "せ", down: "そ" } },
  { id: "ta", kind: "char", chars: { tap: "た", left: "ち", up: "つ", right: "て", down: "と" } },
  { id: "na", kind: "char", chars: { tap: "な", left: "に", up: "ぬ", right: "ね", down: "の" } },
  { id: "ha", kind: "char", chars: { tap: "は", left: "ひ", up: "ふ", right: "へ", down: "ほ" } },
  { id: "ma", kind: "char", chars: { tap: "ま", left: "み", up: "む", right: "め", down: "も" } },
  { id: "ya", kind: "char", chars: { tap: "や", up: "ゆ", down: "よ" } },
  { id: "ra", kind: "char", chars: { tap: "ら", left: "り", up: "る", right: "れ", down: "ろ" } },
  { id: "mutate", kind: "mutate", label: "゛゜小" },
  { id: "wa", kind: "char", chars: { tap: "わ", left: "を", up: "ー", down: "ん" } },
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
