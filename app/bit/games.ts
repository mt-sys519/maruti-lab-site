export const bitGames = [
  { id: "angle", number: "001", name: "ANGLE", kind: "角度", href: "/bit/angle", description: "三角形を組み合わせ、示された角度から答えを導く。" },
  { id: "blank", number: "002", name: "BLANK", kind: "穴埋め", href: "/bit/blank", description: "四則演算の空欄に入る数字を逆算する。" },
  { id: "sequence", number: "003", name: "SEQUENCE", kind: "数列", href: "/bit/sequence", description: "数の並びに隠れた規則を見抜く。" },
  { id: "input-rain", number: "004", name: "INPUT RAIN", kind: "入力", href: "/bit/input-rain", description: "落下する端末入力を、消える前に打ち込む。" },
] as const;

export type BitGameId = (typeof bitGames)[number]["id"];
