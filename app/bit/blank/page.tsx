import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { BlankGame } from "../BlankGame";
import { BitCartridgeNav } from "../BitCartridgeNav";
import { BitFooter } from "../BitFooter";
import { BitHeader } from "../BitHeader";
import { BitHowToPlay } from "../BitHowToPlay";
import { BitSeriesNav } from "../BitSeriesNav";

export const metadata: Metadata = {
  title: "MarutiBit — BLANK（空欄補完ゲーム）",
  description: "四則演算の空欄を逆算して埋める空欄補完ゲーム。全5問の計算パズル、初級・中級・上級の3段階。",
  alternates: { canonical: "/bit/blank" },
  openGraph: {
    title: "MarutiBit — BLANK（空欄補完ゲーム）",
    description: "四則演算の空欄を逆算して埋める空欄補完ゲーム。全5問の計算パズル。",
    url: "/bit/blank",
    images: [
      { url: "/og/bit/blank.png", width: 1200, height: 630, alt: "MarutiBit BLANK" },
      { url: "/og/bit/blank-square.png", width: 630, height: 630, alt: "MarutiBit BLANK" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MarutiBit — BLANK（空欄補完ゲーム）",
    description: "四則演算の空欄を逆算して埋める空欄補完ゲーム。全5問の計算パズル。",
    images: ["/og/bit/blank.png"],
  },
};

export default function BlankPage() {
  return (
    <main className="bitPage" style={{ "--pkg-color": "#F4C430" } as CSSProperties}>
      <BitHeader current="BLANK" />

      <BitSeriesNav active="blank" />

      <section className="bitIntro bitBlankIntro">
        <p className="bitSerial">MB / GAME 002</p>
        <h1>
          <svg className="bitBlankLogo" viewBox="0 0 72 64" aria-hidden="true" focusable="false">
            <rect x="9" y="5" width="54" height="54" />
            <path d="M17 51.5h12" />
          </svg>
          <span>BLANK</span>
        </h1>
        <p><strong>空欄補完ゲーム。</strong><br />四則演算の式にある「？」に入る数字を逆算する、全5問のミニゲーム。</p>
      </section>

      <BlankGame />

      <BitHowToPlay
        aboutLead={<>式にひそむ<strong>「？」</strong>を逆算するパズル。</>}
        aboutSub="全5問の計算パズル。"
        playLead={<>数値キーパッドで<strong>答えを入力</strong>し決定。</>}
        playSub="初級は四則演算、上級は括弧を使います。"
        rulesLead={<><strong>正解数×回答速度</strong>でスコアが決まる。</>}
        rulesSub="時間制限なし。答えはすべて正の整数。"
        chips={["初級：四則演算", "中級：計算順序", "上級：括弧あり"]}
      />
      <BitCartridgeNav current="blank" />
      <BitFooter label="MARUTIBIT / GAME 002" />
    </main>
  );
}
