import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { bitGames } from "../bit/games";
import styles from "./ogPreview.module.css";

// The MarutiBit share cards are captured from this page with headless Chrome
// rather than drawn in SVG, because they use Baloo 2 and Yu Gothic and the
// site's own dot-grid - none of which an SVG rasteriser has access to. It has
// been built and thrown away twice now (see b128cd0 and 5281b2d), so it stays
// checked in this time. It is noindex and linked from nowhere.
//
//   npm run dev
//   node scripts/capture-bit-ogp.mjs neonbreak
//
// Add a card by adding the game to bit/games.ts; the copy below is the only
// per-game thing this page needs.
export const metadata: Metadata = {
  title: "OGP preview",
  robots: { index: false, follow: false },
};

type Card = { lead: string; sub: string; art?: string };

const copy: Record<string, Card> = {
  angle: { lead: "角度当てゲーム。", sub: "三角形を組み合わせ、示された角度から答えを導く。" },
  blank: { lead: "空欄補完ゲーム。", sub: "四則演算の空欄に入る数字を逆算する。" },
  sequence: { lead: "順番推理ゲーム。", sub: "数の並びに隠れた規則を見抜く。" },
  "input-rain": { lead: "タイピングゲーム。", sub: "落下する端末入力を、消える前に打ち込む。" },
  paku: { lead: "エサやりゲーム。", sub: "水槽の熱帯魚に、タップで餌をあげる。" },
  liltorb: { lead: "粒子操作トイ。", sub: "触れると粒子が集まる、癒しと刺激の球体トイ。" },
  avenue: {
    lead: "ピクセルアート・アンビエント。",
    sub: "1996年の雨の部屋で、偶然生まれる音を眺めて聴く。",
    art: "/games/rain-chime/room-lap.webp",
  },
  neonbreak: {
    lead: "ネオンの台のナインボール。",
    sub: "台につくのは、三人のオペレーター。",
    art: "/games/neonbreak/neon-operator-wide.webp",
  },
};

function Card({ id, square }: { id: string; square?: boolean }) {
  const game = bitGames.find((g) => g.id === id);
  if (!game) return null;
  const card = copy[id];
  return (
    <div
      className={`${styles.card} ${square ? styles.square : styles.wide}`}
      style={{ "--pkg-color": game.color } as CSSProperties}
      id={square ? `${id}-square` : id}
    >
      <p className={styles.serial}>MB / GAME {game.number}</p>
      <span className={styles.dot} />
      <div className={styles.text}>
        <h1>{game.name}</h1>
        {square ? (
          <p>
            <span className={styles.lead}>{card.lead}</span>
            <span className={styles.sub}>{card.sub}</span>
          </p>
        ) : (
          <>
            <p className={styles.lead}>{card.lead}</p>
            <p className={styles.sub}>{card.sub}</p>
          </>
        )}
      </div>
      <div className={styles.thumb}>
        {card.art ? <img src={card.art} alt="" /> : null}
      </div>
      <p className={styles.foot}>MARUTILAB.COM/BIT</p>
      {!square && <p className={styles.tagline}>THINK / SEE / PLAY</p>}
    </div>
  );
}

export default function OgPreviewPage({
  searchParams,
}: {
  searchParams?: { game?: string; only?: string };
}) {
  const id = searchParams?.game ?? "neonbreak";
  // `only` is what the capture script uses: one card, flush to the origin, so
  // a viewport screenshot at the card's size is the card and nothing else.
  const only = searchParams?.only;
  if (only === "wide" || only === "square") {
    return (
      <main className={styles.bare}>
        <Card id={id} square={only === "square"} />
      </main>
    );
  }
  return (
    <main className={styles.stage}>
      <Card id={id} />
      <Card id={id} square />
    </main>
  );
}
