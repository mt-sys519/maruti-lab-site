import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { BitCartridgeNav } from "../BitCartridgeNav";
import { BitFooter } from "../BitFooter";
import { BitHeader } from "../BitHeader";
import { BitHowToPlay } from "../BitHowToPlay";
import { BitSeriesNav } from "../BitSeriesNav";
import { InputRainGame } from "../InputRainGame";
import { PrAds } from "../../PrAds";

export const metadata: Metadata = {
  title: { absolute: "落ちてくる文字を打つタイピングゲーム｜INPUT RAIN" },
  description: "落ちてくる言葉を、落ちきる前に打ち込むタイピングゲーム。日常・四字熟語・ビジネス・端末の4ジャンル、初級からPROまで。スマホはフリック入力で遊べます。",
  alternates: { canonical: "/bit/input-rain" },
  openGraph: {
    title: "落ちてくる文字を打つタイピングゲーム｜INPUT RAIN",
    description: "日常・四字熟語・ビジネス・端末。落ちてくる言葉を打つほど雨が強くなる、タイピング／フリック入力ゲーム。",
    url: "/bit/input-rain",
    images: [
      { url: "/og/bit/input-rain.png", width: 1200, height: 630, alt: "MarutiBit INPUT RAIN" },
      { url: "/og/bit/input-rain-square.png", width: 630, height: 630, alt: "MarutiBit INPUT RAIN" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "落ちてくる文字を打つタイピングゲーム｜INPUT RAIN",
    description: "日常・四字熟語・ビジネス・端末。落ちてくる言葉を打つほど雨が強くなる、タイピング／フリック入力ゲーム。",
    images: ["/og/bit/input-rain.png"],
  },
};

export default function InputRainPage() {
  return (
    <main className="bitPage inputRainPage" data-ir-genre="daily" style={{ "--pkg-color": "#6B3FA0" } as CSSProperties}>
      <BitHeader current="INPUT RAIN" />
      <BitSeriesNav active="input-rain" />
      <section className="bitIntro inputRainIntro">
        <p className="bitSerial">MB / GAME 004</p>
        <h1>
          <span className="inputRainTitleMark" aria-hidden="true"><i /><i /><i /></span>
          <span>INPUT RAIN</span>
        </h1>
        <p><strong>タイピング／フリック入力ゲーム。</strong><br /><span className="bitIntroSub">落ちてくる言葉を、消える前に打ち込む。</span></p>
      </section>
      <InputRainGame />
      <BitHowToPlay
        aboutLead={<>落ちてくる<strong>日本語</strong>を時間内に入力するゲーム。</>}
        aboutSub="日常・四字熟語・ビジネス・端末の4ジャンル。"
        playLead={<><strong>ローマ字</strong>かフリックを選んでタイプ。</>}
        playSub="速く正確に打つほど雨が強まり、音が重なります。"
        rulesLead={<>難易度ごとの<strong>制限時間</strong>でスコアが決まる。</>}
        rulesSub="入力方式は端末に記憶されます。"
        chips={["初級：20秒", "中級：40秒", "上級：60秒", "PRO：180秒"]}
      />
      <PrAds kind="a8" />

      <BitCartridgeNav current="input-rain" />
      <BitFooter label="MARUTIBIT / GAME 004" />
    </main>
  );
}
