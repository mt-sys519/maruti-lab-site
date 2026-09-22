/**
 * What to call a glass, from what is actually in it.
 *
 * The top flavour on its own, the top two, or - when a third is more than a
 * token - the top three. Five or six flavours at once is not a recipe, it is a
 * decision nobody made on purpose, and those get a name that says so with a
 * straight face. 47 names in all, picked from the amounts rather than at
 * random, so the same glass always keeps the same name.
 */
export type Drink = {
  id: string;
  label: string;
  en: string;
  rgb: [number, number, number];
  /** How it looks in the glass, where that is not the colour of its label. */
  liquid?: [number, number, number];
  /** And how it looks where the glass is barely covered. */
  thin?: [number, number, number];
  fizz: 0 | 1;
};

export const DRINKS: Drink[] = [
  { id: "cola", label: "コーラ", en: "COLA", rgb: [135, 50, 5], liquid: [70, 42, 25], thin: [156, 101, 48], fizz: 1 },
  { id: "melon", label: "メロンソーダ", en: "MELON SODA", rgb: [123, 180, 44], liquid: [112, 205, 55], thin: [176, 230, 126], fizz: 1 },
  { id: "orange", label: "オレンジ", en: "ORANGE", rgb: [254, 148, 26], thin: [255, 199, 124], fizz: 0 },
  { id: "lemon", label: "レモンソーダ", en: "LEMON SODA", rgb: [246, 214, 5], liquid: [249, 233, 126], thin: [253, 246, 196], fizz: 1 },
  { id: "grape", label: "ぶどう", en: "GRAPE", rgb: [129, 36, 175], liquid: [150, 84, 178], thin: [198, 155, 214], fizz: 0 },
  { id: "milky", label: "乳酸菌飲料", en: "LACTIC DRINK", rgb: [235, 228, 210], thin: [246, 242, 232], fizz: 0 },
];

export const juice = (d: Drink) => d.liquid ?? d.rgb;
export const thinly = (d: Drink) => d.thin ?? juice(d);

const FLAVOUR: Record<string, string> = {
  cola: "コーラ", melon: "メロン", orange: "オレンジ", lemon: "レモン", grape: "グレープ", milky: "ミルキー",
};
const SOLO: Record<string, string> = {
  cola: "コーラ・スパーク", melon: "メロン・スパーク", orange: "オレンジ・ブリーズ",
  lemon: "レモン・スパーク", grape: "グレープ・ブリーズ", milky: "ミルキー・クラウド",
};
const PAIR: Record<string, string> = {
  "cola-melon": "メロン・コーラ", "cola-orange": "オレンジ・コーラ", "cola-lemon": "レモン・コーラ",
  "cola-grape": "グレープ・コーラ", "cola-milky": "ミルキー・コーラ", "melon-orange": "サンセットメロン",
  "lemon-melon": "メロン・シトラス", "grape-melon": "メロン・グレープ", "melon-milky": "ミルキーメロン",
  "lemon-orange": "シトラス・スパーク", "grape-orange": "オレンジ・グレープ", "milky-orange": "オレンジ・クラウド",
  "grape-lemon": "グレープ・シトラス", "lemon-milky": "レモン・クラウド", "grape-milky": "グレープ・クラウド",
};
const TRIO: Record<string, string> = {
  "cola-melon-orange": "サンセット・コーラ", "cola-lemon-melon": "メロンレモン・コーラ",
  "cola-grape-melon": "メロングレープ・コーラ", "cola-melon-milky": "ミルキーメロン・コーラ",
  "cola-lemon-orange": "シトラス・コーラ", "cola-grape-orange": "トロピカル・コーラ",
  "cola-milky-orange": "オレンジミルク・コーラ", "cola-grape-lemon": "グレープシトラス・コーラ",
  "cola-lemon-milky": "レモンミルク・コーラ", "cola-grape-milky": "グレープミルク・コーラ",
  "lemon-melon-orange": "サンシャイン・トリオ", "grape-melon-orange": "レインボー・メロン",
  "melon-milky-orange": "クリーム・サンセット", "grape-lemon-melon": "グラスグリーン・ミックス",
  "lemon-melon-milky": "メロンクリーム・ソーダ", "grape-melon-milky": "パステル・ミックス",
  "grape-lemon-orange": "フルーツ・パンチ", "lemon-milky-orange": "シトラス・クリーム",
  "grape-milky-orange": "サンセット・クリーム", "grape-lemon-milky": "ラベンダー・クリーム",
};
const CROWD: Record<number, string[]> = {
  5: ["委員会の結論", "多数決の味", "妥協の一杯", "八方美人", "とりあえず全部"],
  6: ["ドリンクバーの限界", "責任者不在", "全部のせ、味は行方不明", "渾然一体", "記憶にございません"],
};

export type Ranked = Drink & { amount: number };

export function nameMix(amounts: number[]) {
  const ranked: Ranked[] = DRINKS.map((d, i) => ({ ...d, amount: amounts[i] }))
    .filter((d) => d.amount)
    .sort((a, b) => b.amount - a.amount);
  const total = amounts.reduce((a, b) => a + b, 0);
  const [a, b, c] = ranked;
  if (!a) return { name: "", ranked };
  const crowd = CROWD[ranked.length];
  if (crowd) {
    const seed = Math.floor(amounts.reduce((sum, n, i) => sum + n * (i + 3), 0) / 30);
    return { name: crowd[seed % crowd.length], ranked };
  }
  const name = !b
    ? SOLO[a.id]
    : b.amount / total < 0.15
      ? `${FLAVOUR[a.id]}・ブレンド`
      : c && c.amount / total >= 0.15
        ? TRIO[[a.id, b.id, c.id].sort().join("-")]
        : PAIR[[a.id, b.id].sort().join("-")];
  return { name, ranked };
}
