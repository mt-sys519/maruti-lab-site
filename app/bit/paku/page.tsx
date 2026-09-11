import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { PakuGame } from "../PakuGame";
import { BitCartridgeNav } from "../BitCartridgeNav";
import { BitFooter } from "../BitFooter";
import { BitHeader } from "../BitHeader";
import { BitHowToPlay } from "../BitHowToPlay";
import { BitNotes } from "../BitNotes";
import { BitSeriesNav } from "../BitSeriesNav";

export const metadata: Metadata = {
  title: "MarutiBit — PAKU（エサやりゲーム）",
  description: "水槽の熱帯魚にタップで餌をあげるエサやりゲーム。",
  alternates: { canonical: "/bit/paku" },
  openGraph: {
    title: "MarutiBit — PAKU（エサやりゲーム）",
    description: "水槽の熱帯魚にタップで餌をあげるエサやりゲーム。",
    url: "/bit/paku",
    images: [
      { url: "/og/bit/paku.png", width: 1200, height: 630, alt: "MarutiBit PAKU" },
      { url: "/og/bit/paku-square.png", width: 630, height: 630, alt: "MarutiBit PAKU" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MarutiBit — PAKU（エサやりゲーム）",
    description: "水槽の熱帯魚にタップで餌をあげるエサやりゲーム。",
    images: ["/og/bit/paku.png"],
  },
};

export default function PakuPage() {
  return (
    <main className="bitPage" style={{ "--pkg-color": "#2BB3A3" } as CSSProperties}>
      <BitHeader current="PAKU" />

      <BitSeriesNav active="paku" />

      <section className="bitIntro bitPakuIntro">
        <p className="bitSerial">MB / GAME 005</p>
        <h1>
          <svg className="bitPakuLogo" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M3.5 12 C7 7.5 12 6.7 16.2 9.2 L21 6.6 L19.4 12 L21 17.4 L16.2 14.8 C12 17.3 7 16.5 3.5 12 Z" />
            <circle cx="8.1" cy="11" r="1" />
          </svg>
          <span>PAKU</span>
        </h1>
        <p><strong>エサやりゲーム。</strong><br /><span className="bitIntroSub">水槽で泳ぐ熱帯魚に、タップで餌をあげるだけのミニゲーム。</span></p>
      </section>

      <PakuGame />

      <BitHowToPlay
        aboutLead={<>水槽で泳ぐ<strong>熱帯魚</strong>にエサをあげるだけ。</>}
        aboutSub="勝敗・スコアはありません。"
        playLead={<>水槽を<strong>タップ</strong>するとエサが落ちます。</>}
        playSub="魚が寄ってきて食べる様子を眺めます。"
        rulesLead={<>時間制限や得点は<strong>ありません</strong>。</>}
        rulesSub="好きなだけ眺めて遊べます。"
      />
      <BitNotes
        title="この水槽の3種"
        lead="水槽にいるのは熱帯魚が3種、あわせて18匹です。泳ぐ高さと餌の食べ方が種ごとに違います。"
        entries={[
          {
            label: "SURFACE",
            name: "アフリカンランプアイ",
            meta: "Poropanchax normani ／ 約4〜4.5cm ／ 6匹",
            body: <>水面のすぐ下を群れで巡回します。眼の上が青く光るのが特徴で、この水槽でもほとんど上層から降りてきません。餌には水面を素早くつつくように出ますが、沈んでしまったぶんは追いかけません。</>,
          },
          {
            label: "MID-WATER",
            name: "ネオンテトラ",
            meta: "Paracheirodon innesi ／ 約3〜4cm ／ 9匹",
            body: <>中層を群れで泳ぎます。餌を見つけると突っ込み、すぐ向きを変えて離れていくのがネオンテトラの食べ方の特徴です。</>,
          },
          {
            label: "BOTTOM",
            name: "パンダコリドラス",
            meta: "Hoplisoma panda ／ 約4.5〜5cm ／ 3匹",
            body: <>底だけを歩き、ヒゲで砂を探って食べます。物陰より開けた砂地を好むので姿を見失いにくい魚です。ときどき水面まで一気に上がって空気を吸い、また底へ戻ります。</>,
          },
        ]}
        footnote="上層と中層の魚は、沈みきった餌をある深さより下までは追いません。底に落ちたぶんはコリドラスの取り分になります。"
      />

      <BitCartridgeNav current="paku" />
      <BitFooter label="MARUTIBIT / GAME 005" />
    </main>
  );
}
