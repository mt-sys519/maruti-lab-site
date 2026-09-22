// Package colors are the Memphis Pastel Arcade accents (see
// project_marutibit_toyshop_rebrand memory): coral #FF7A5C, teal #2BB3A3,
// yellow #F4C430, blush #F2A0C1, periwinkle #7B8CDE, plum #6B3FA0, and now
// orange #FE941A. Seven
// games share six colors, so sequence and avenue repeat periwinkle - they
// sit far apart in the grid (positions 3 and 7) so it doesn't read as a
// clash. Repeats are fine and expected from here on - the catalog is meant to
// keep growing well past the palette. What is not fine is a repeat that lands
// next to itself: the shelf runs as a loop, so the ninth machine stands
// beside the first, and mixpop in coral put two coral machines shoulder to
// shoulder with angle. It takes a seventh colour rather than one of the six:
// orange #FE941A, which is the juice the machine is pouring in its own
// artwork. Coral next to it is a redder thing, and the shelf has no other
// orange to sit beside.
export const bitGames = [
  { id: "angle", number: "001", name: "ANGLE", kana: "アングル", kind: "角度当てゲーム", href: "/bit/angle", description: "三角形を組み合わせ、示された角度から答えを導く。", featured: true, color: "#FF7A5C" },
  { id: "blank", number: "002", name: "BLANK", kana: "ブランク", kind: "空欄補完ゲーム", href: "/bit/blank", description: "四則演算の空欄に入る数字を逆算する。", featured: true, color: "#F4C430" },
  { id: "sequence", number: "003", name: "SEQUENCE", kana: "シークエンス", kind: "順番推理ゲーム", href: "/bit/sequence", description: "数の並びに隠れた規則を見抜く。", featured: true, color: "#7B8CDE" },
  { id: "input-rain", number: "004", name: "INPUT RAIN", kana: "インプットレイン", kind: "タイピング／フリック入力ゲーム", href: "/bit/input-rain", description: "落下する端末入力を、消える前に打ち込む。", featured: true, color: "#6B3FA0" },
  { id: "paku", number: "005", name: "PAKU", kana: "パク", kind: "エサやりゲーム", href: "/bit/paku", description: "水槽の熱帯魚に、タップで餌をあげる。", featured: false, color: "#2BB3A3" },
  { id: "liltorb", number: "006", name: "LILT ORB", kana: "リルトオーブ", kind: "粒子操作トイ", href: "/bit/liltorb", description: "触れると粒子が集まる、癒しと刺激の球体トイ。", featured: false, color: "#F2A0C1" },
  { id: "avenue", number: "007", name: "AVENUE", kana: "アベニュー", kind: "ピクセルアート・アンビエント", href: "/bit/avenue", description: "1996年の雨の部屋で、偶然生まれる音を眺めて聴く。", featured: false, color: "#7B8CDE" },
  { id: "neonbreak", number: "008", name: "NEON BREAK", kana: "ネオンブレイク", kind: "ナインボール", href: "/bit/neonbreak", description: "ネオンの台で9番を狙う、ナインボール。", featured: false, color: "#6B3FA0" },
  { id: "mixpop", number: "009", name: "MIX POP", kana: "ミックスポップ", kind: "ドリンク調合トイ", href: "/bit/mixpop", description: "六つのジュースを混ぜて、できた一杯に名前をつける。", featured: false, color: "#FE941A", tag: "NEW" },
] as const;

// The home hero only teases a handful of games (not the whole, ever-growing
// catalog) - /bit is the full index.
// A shelf tag, shown on the machine as a sticker over its top edge. Leave it
// off and nothing is drawn: adding "人気" or "おすすめ" later is a word on the
// row below, not a new piece of design.
export const featuredBitGames = bitGames.filter((game) => game.featured);

export type BitGameId = (typeof bitGames)[number]["id"];
