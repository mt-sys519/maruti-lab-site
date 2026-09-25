import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { bitGames } from "../bit/games";
import { GameUnit } from "../bit/GameUnit";
import { formatDate, posts } from "../blog/posts";
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
  mixpop: {
    lead: "ドリンク調合トイ。",
    sub: "ジュースを好きにまぜて、好きなだけ飲めるドリンクバー",
    art: "/bit/mixpop/machine.webp",
  },
  neonbreak: {
    lead: "ネオンの台のナインボール。",
    sub: "台につくのは、三人のオペレーター。",
    // The three of them together, which is what the line under the title
    // actually says - the single-operator shot only showed one of the three.
    art: "/games/neonbreak/neon-3operator.webp",
  },
};

/* The card for /bit itself. The old one was the same words over a row of
   coloured dots, and said 7 GAMES when there were eight. The dots were
   standing in for the machines; now there are machines. */
function IndexCard() {
  // Lead with the tagged machine, so the seal that is the news is on the card
  // rather than off its right edge.
  const first = Math.max(0, bitGames.findIndex((game) => "tag" in game));
  const shelf = [...bitGames.slice(first), ...bitGames.slice(0, first)];
  return (
    <div className={`${styles.card} ${styles.wide} ${styles.index}`} id="index">
      <p className={styles.serial}>MARUTI LAB / QUICK GAMES</p>
      {/* The wordmark itself, the way the home page writes it. A card for
          MarutiBit that never says MarutiBit is no card at all. */}
      <h1 className={styles.indexBrand}><span>Maruti</span><b>Bit</b></h1>
      <p className={styles.indexTitle}>短い時間で、頭と心を少し動かす。</p>
      <div className={styles.indexShelf}>
        {shelf.map((game) => <GameUnit game={game} key={game.id} className={styles.indexUnit} />)}
      </div>
      <p className={styles.foot}>MARUTILAB.COM/BIT</p>
      <p className={styles.tagline}>{String(bitGames.length).padStart(2, "0")} GAMES / ONLINE</p>
    </div>
  );
}

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


// A note whose subject is something you look at gets a picture of it on the
// wide card; the title alone is the right card for a note about a decision,
// but not for one about a tank of fish. Wide only - the square card has no
// room for it without becoming a different composition.
const noteArt: Record<string, string> = {
  paku: "/games/paku/tank.png",
};

// The notes get the same treatment: a real page captured by the same script,
// so a shared article looks like the site rather than like a default card.
//
//   node scripts/capture-note-ogp.mjs <slug>
function NoteCard({ slug, square }: { slug: string; square?: boolean }) {
  const post = posts.find((p) => p.slug === slug);
  if (!post) return null;
  const art = square ? undefined : noteArt[slug];
  return (
    <div
      className={`${styles.card} ${styles.note} ${art ? styles.hasArt : ""} ${square ? styles.square : styles.wide}`}
      id={square ? `${slug}-square` : slug}
    >
      <p className={styles.noteEyebrow}>LABNOTE / {formatDate(post.date)}</p>
      <h1>{post.title}</h1>
      {!square && <p className={styles.noteDesc}>{post.description}</p>}
      {art && (
        <div className={styles.noteArt}>
          <img src={art} alt="" />
        </div>
      )}
      <p className={styles.noteFoot}>
        <span className={styles.noteBrand}>MARUTI LAB</span>
        <span>MARUTILAB.COM/BLOG</span>
      </p>
    </div>
  );
}

/* A RETRO cartridge's card is drawn in the series' own dress, not MarutiBit's: the dark
   bar with its red and teal rules, cream stock with a halftone, the square label as it
   was drawn, Press Start 2P and DotGothic16. Captured by the same script:
     node scripts/capture-bit-ogp.mjs hyperprop */
const retroCopy: Record<string, { serial: string; name: string; kind: string; line: string; label: string; spec: [string, string][] }> = {
  hyperprop: {
    serial: "RETRO 01",
    name: "HYPER PROP",
    kind: "人力飛行ゲーム",
    line: "その指で、空を飛べ。",
    label: "/bit/retro/hyperprop-label.jpg",
    // no stage count: stages get added, and a picture cannot be updated with them
    spec: [["ジャンル", "人力飛行アクション"], ["プレイ人数", "1人"], ["対応機種", "MB-01 RETRO"], ["価格", "FREE"]],
  },
};

function RetroCard({ id, square }: { id: string; square?: boolean }) {
  const c = retroCopy[id];
  if (!c) return null;
  return (
    <div className={`${styles.card} ${styles.retro} ${square ? styles.square : styles.wide}`} id={square ? `${id}-square` : id}>
      <div className={styles.retroBar}>
        <span className={styles.retroBrand}>MARUTI BIT <b>RETRO</b></span>
        <span className={styles.retroSerial}>{c.serial}</span>
      </div>
      <div className={styles.retroLabel}><img src={c.label} alt="" /></div>
      <div className={styles.retroText}>
        <h1>{c.name}</h1>
        <p className={styles.retroKind}>{c.kind}</p>
        <p className={styles.retroLine}>{c.line}</p>
        {!square && (
          <dl className={styles.retroSpec}>
            {c.spec.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        )}
      </div>
      <p className={styles.retroFoot}>MARUTILAB.COM/BIT</p>
    </div>
  );
}

export default function OgPreviewPage({
  searchParams,
}: {
  searchParams?: { game?: string; note?: string; only?: string };
}) {
  const id = searchParams?.game ?? "neonbreak";
  const note = searchParams?.note;
  // `only` is what the capture script uses: one card, flush to the origin, so
  // a viewport screenshot at the card's size is the card and nothing else.
  const only = searchParams?.only;
  if (only === "index") {
    return <main className={styles.bare}><IndexCard /></main>;
  }
  if (retroCopy[id]) {
    return (
      <main className={only ? styles.bare : styles.stage}>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DotGothic16&family=Press+Start+2P&display=block" />
        {(!only || only === "wide") && <RetroCard id={id} />}
        {(!only || only === "square") && <RetroCard id={id} square />}
      </main>
    );
  }
  if (only === "wide" || only === "square") {
    return (
      <main className={styles.bare}>
        {note ? (
          <NoteCard slug={note} square={only === "square"} />
        ) : (
          <Card id={id} square={only === "square"} />
        )}
      </main>
    );
  }
  if (note) {
    return (
      <main className={styles.stage}>
        <NoteCard slug={note} />
        <NoteCard slug={note} square />
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
