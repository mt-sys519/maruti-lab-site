import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { BitFooter } from "../BitFooter";
import { BitHeader } from "../BitHeader";
import { BitHowToPlay } from "../BitHowToPlay";
import { HyperPropGame } from "../HyperPropGame";
import "../hyperProp.css";

const title = "MarutiBit — HYPER PROP（人力飛行ゲーム）";
const description = "高台から機体を抱えて走り、飛び乗って、漕いで湖を越える。ペダルを左右交互に叩く人力飛行ゲーム。無料、登録不要。";

// On test while it is played on real phones: kept out of search, the sitemap and
// every shelf and nav (it is not in games.ts yet), so only the address reaches it.
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/bit/hyperprop" },
  robots: { index: false, follow: false },
};

export default function HyperPropPage() {
  return (
    <>
      {/* DotGothic16 for the handheld only: its printed labels and the dot-matrix
          sub display. It loads on this route and nowhere else. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DotGothic16&display=swap" />
      <main className="bitPage bitPageMilk" style={{ "--pkg-color": "#2BB3A3" } as CSSProperties}>
        <BitHeader current="HYPER PROP" />
        <section className="bitIntro">
          <p className="bitSerial">MB / GAME 010</p>
          <h1><span>HYPER PROP</span></h1>
          <p>
            <strong>人力飛行ゲーム。</strong>
            <br />
            <span className="bitIntroSub">走って、飛び乗って、漕いで、湖を越える。</span>
          </p>
        </section>

        <HyperPropGame />

        <BitHowToPlay
          aboutLead={<>人力飛行機で湖を越える<strong>人力飛行ゲーム</strong>。</>}
          aboutSub="いちばん難しいのは、飛び立つ瞬間です。"
          playLead={<>PEDALを<strong>左右交互に</strong>叩いて、走って漕ぐ。</>}
          playSub="崖の手前の赤い杭で ▲ を押して乗り込み、▲ ▼ で機首を操ります。"
          rulesLead={<>400m先の<strong>GOAL</strong>まで飛べばクリア。</>}
          rulesSub="湖に着水すると、そこまでの距離が記録に残ります。"
        />
        <BitFooter label="MARUTIBIT / GAME 010" />
      </main>
    </>
  );
}
