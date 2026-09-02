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
        about="三角形の内角にひそむ「？」の角度を答える、全5問の推理パズルです。"
        play="表示された角度をヒントに、数値キーパッドで答えを入力し「決定」で回答。初級は内角の和、中級・上級は対頂角や複数の三角形の関係を使って解きます。"
        rules="全5問。正解数と回答スピードでスコアが決まります。時間制限はありません。PC・スマホともにタップ／クリックで操作できます。"
        icon={
          <svg viewBox="0 0 24 24" focusable="false">
            <rect x="3" y="3" width="18" height="18" rx="4.5" />
            <circle cx="8" cy="8" r="1.7" />
            <circle cx="16" cy="8" r="1.7" />
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="8" cy="16" r="1.7" />
            <circle cx="16" cy="16" r="1.7" />
          </svg>
        }
      />
      <BitCartridgeNav current="angle" />
      <BitFooter label="MARUTIBIT / GAME 001" />
    </main>
  );
}
