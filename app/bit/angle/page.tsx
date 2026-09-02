import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { AngleGame } from "../AngleGame";
import { BitCartridgeNav } from "../BitCartridgeNav";
import { BitFooter } from "../BitFooter";
import { BitHeader } from "../BitHeader";
import { BitHowToPlay } from "../BitHowToPlay";
import { BitSeriesNav } from "../BitSeriesNav";

const title = "MarutiBit — ANGLE（角度当てゲーム）";
const description = "三角形の角度を順番に解く角度当てゲーム。全5問の図形パズル、初級・中級・上級の3段階。";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/bit/angle" },
  openGraph: {
    title, description, url: "/bit/angle",
    images: [
      { url: "/og/bit/angle.png", width: 1200, height: 630, alt: "MarutiBit ANGLE" },
      { url: "/og/bit/angle-square.png", width: 630, height: 630, alt: "MarutiBit ANGLE" },
    ],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og/bit/angle.png"] },
};

export default function AnglePage() {
  return (
    <main className="bitPage" style={{ "--pkg-color": "#FF7A5C" } as CSSProperties}>
      <BitHeader current="ANGLE" />
      <BitSeriesNav active="angle" />
      <section className="bitIntro">
        <p className="bitSerial">MB / GAME 001</p>
        <h1>
          <svg className="bitAngleLogo" viewBox="0 0 72 64" aria-hidden="true" focusable="false">
            <path d="M36 4.5 67 59.5H5Z" />
            <path d="M13.5 53.5h11" />
          </svg>
          <span>ANGLE</span>
        </h1>
        <p><strong>角度当てゲーム。</strong><br />三角形の角度を組み合わせ、示された「？」を求める、全5問のミニゲーム。</p>
      </section>
      <AngleGame />
      <BitHowToPlay
        aboutLead={<>三角形の<strong>角度</strong>を読む。</>}
        aboutSub="全5問の推理パズル。"
        playLead={<>角度を読み取り、<strong>数字を入力</strong>。</>}
        playSub="答えが決まったら決定。"
        rulesLead={<><strong>正解数×回答速度</strong>でスコアが決まる。</>}
        rulesSub="時間制限なし。"
        chips={["初級：内角の和", "中級：複数図形", "上級：対頂角"]}
      />
      <BitCartridgeNav current="angle" />
      <BitFooter label="MARUTIBIT / GAME 001" />
    </main>
  );
}
