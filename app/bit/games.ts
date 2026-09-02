// Package colors are the Memphis Pastel Arcade accents (see
// project_marutibit_toyshop_rebrand memory): coral #FF7A5C, teal #2BB3A3,
// yellow #F4C430, blush #F2A0C1, periwinkle #7B8CDE, plum #6B3FA0. Seven
// games share six colors, so sequence and avenue repeat periwinkle - they
// sit far apart in the grid (positions 3 and 7) so it doesn't read as a
// clash.
export const bitGames = [
  { id: "angle", number: "001", name: "ANGLE", kana: "アングル", kind: "角度当てゲーム", href: "/bit/angle", description: "三角形を組み合わせ、示された角度から答えを導く。", featured: true, color: "#FF7A5C" },
  { id: "blank", number: "002", name: "BLANK", kana: "ブランク", kind: "空欄補完ゲーム", href: "/bit/blank", description: "四則演算の空欄に入る数字を逆算する。", featured: true, color: "#F4C430" },
  { id: "sequence", number: "003", name: "SEQUENCE", kana: "シークエンス", kind: "順番推理ゲーム", href: "/bit/sequence", description: "数の並びに隠れた規則を見抜く。", featured: true, color: "#7B8CDE" },
  { id: "input-rain", number: "004", name: "INPUT RAIN", kana: "インプットレイン", kind: "タイピング／フリック入力ゲーム", href: "/bit/input-rain", description: "落下する端末入力を、消える前に打ち込む。", featured: true, color: "#6B3FA0" },
  { id: "paku", number: "005", name: "PAKU", kana: "パク", kind: "エサやりゲーム", href: "/bit/paku", description: "水槽の熱帯魚に、タップで餌をあげる。", featured: false, color: "#2BB3A3" },
  { id: "liltorb", number: "006", name: "LILT ORB", kana: "リルトオーブ", kind: "粒子操作トイ", href: "/bit/liltorb", description: "触れると粒子が集まる、癒しと刺激の球体トイ。", featured: false, color: "#F2A0C1" },
  { id: "avenue", number: "007", name: "AVENUE", kana: "アベニュー", kind: "ピクセルアート・アンビエント", href: "/bit/avenue", description: "1996年の雨の部屋で、偶然生まれる音を眺めて聴く。", featured: false, color: "#7B8CDE" },
] as const;

// The home hero only teases a handful of games (not the whole, ever-growing
// catalog) - /bit is the full index.
export const featuredBitGames = bitGames.filter((game) => game.featured);

export type BitGameId = (typeof bitGames)[number]["id"];
