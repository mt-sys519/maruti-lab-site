import { businessPrompts } from "./inputRainPromptsBusiness";
import { dailyPrompts } from "./inputRainPromptsDaily";
import { terminalPrompts } from "./inputRainPromptsTerminal";
import { yojiPrompts } from "./inputRainPromptsYoji";

export type InputRainDifficulty = "beginner" | "intermediate" | "advanced" | "pro";
export type InputRainGenre = "daily" | "yoji" | "business" | "terminal";

export type InputRainPrompt = {
  text: string;
  reading: string;
  /** Shown once the prompt is typed (the meaning of a four-character idiom). */
  note?: string;
  /** The word the note explains, when it isn't the whole prompt (PRO idiom sentences). */
  term?: string;
};

/** [text, reading, note?, term?] — kept as tuples so the authored lists stay scannable. */
export type InputRainPromptRow = [string, string] | [string, string, string] | [string, string, string, string];
export type InputRainPromptSet = Record<InputRainDifficulty, InputRainPromptRow[]>;

export const inputRainGenreOrder: InputRainGenre[] = ["daily", "yoji", "business", "terminal"];

export const inputRainGenres: Record<InputRainGenre, {
  label: string;
  /** One word for the chrome badge. */
  badge: string;
  scene: string;
  chrome: string;
  sample: string;
  sampleReading: string;
  notes: Record<InputRainDifficulty, string>;
}> = {
  daily: {
    label: "日常",
    badge: "日",
    scene: "窓辺の雨",
    chrome: "WINDOW SEAT / 日常",
    sample: "傘を持っていく",
    sampleReading: "かさをもっていく",
    notes: { beginner: "身近なことば", intermediate: "短いひとこと", advanced: "日常の一文", pro: "ふたつの文" },
  },
  yoji: {
    label: "四字熟語",
    badge: "四",
    scene: "和紙と墨",
    chrome: "SUMI / 四字熟語",
    sample: "晴耕雨読",
    sampleReading: "せいこううどく",
    notes: { beginner: "定番の熟語", intermediate: "よく聞く熟語", advanced: "難しい熟語", pro: "熟語の例文" },
  },
  business: {
    label: "ビジネス",
    badge: "B",
    scene: "夜のオフィス",
    chrome: "OFFICE 22F / ビジネス",
    sample: "お世話になっております",
    sampleReading: "おせわになっております",
    notes: { beginner: "職場のことば", intermediate: "決まり文句", advanced: "メールの一文", pro: "メール文" },
  },
  terminal: {
    label: "端末",
    badge: "Pt",
    scene: "PromptTerm",
    chrome: "PROMPTTERM / INPUT RAIN",
    sample: "PT> INPUT CHANNEL ARMED",
    sampleReading: "",
    notes: { beginner: "短い端末語", intermediate: "短い操作文", advanced: "端末ログ", pro: "長文ログ" },
  },
};

function toPrompts(set: InputRainPromptSet): Record<InputRainDifficulty, InputRainPrompt[]> {
  const convert = (rows: InputRainPromptRow[]) => rows.map(([text, reading, note, term]) => ({ text, reading, note, term }));
  return { beginner: convert(set.beginner), intermediate: convert(set.intermediate), advanced: convert(set.advanced), pro: convert(set.pro) };
}

export const inputRainPrompts: Record<InputRainGenre, Record<InputRainDifficulty, InputRainPrompt[]>> = {
  daily: toPrompts(dailyPrompts),
  yoji: toPrompts(yojiPrompts),
  business: toPrompts(businessPrompts),
  terminal: toPrompts(terminalPrompts),
};
