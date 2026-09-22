import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { BitCartridgeNav } from "../BitCartridgeNav";
import { BitFooter } from "../BitFooter";
import { BitHeader } from "../BitHeader";
import { BitHowToPlay } from "../BitHowToPlay";
import { BitSeriesNav } from "../BitSeriesNav";
import { MixPopGame } from "../MixPopGame";
import "../mixPop.css";

const title = "MarutiBit — MIX POP（ドリンク調合トイ）";
const description =
  "六つのジュースを好きなだけ混ぜて、氷を入れて、自分の一杯に名前をつける。注ぐ音も飲む音も本物の録音。無料、登録不要。";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/bit/mixpop" },
  openGraph: {
    title,
    description,
    url: "/bit/mixpop",
    images: [
      { url: "/og/bit/mixpop.png", width: 1200, height: 630, alt: "MarutiBit MIX POP" },
      { url: "/og/bit/mixpop-square.png", width: 630, height: 630, alt: "MarutiBit MIX POP" },
    ],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og/bit/mixpop.png"] },
};

export default function MixPopPage() {
  return (
    <>
      {/* Poppins 800 for the logotype only: the same geometric bones as the
          lettering painted on the machine, thick enough to hold a drink.
          React hoists this into <head>, and it only loads on this route. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@800&display=swap" />
    <main className="bitPage bitPageMilk" style={{ "--pkg-color": "#FF7A5C" } as CSSProperties}>
      <BitHeader current="MIX POP" />

      <BitSeriesNav active="mixpop" />

      <section className="bitIntro">
        <p className="bitSerial">MB / GAME 009</p>
        <h1>
          {/* The one exception to the house pattern. The other eight wear a
              small mark beside their name in the series' own type; this one
              has a logotype of its own, with the drink moving inside the
              letters, so the band wears that instead - at full size, which is
              why the shrunk .bitIntroNamed band is off here. */}
          <svg className="mixpopLogo" viewBox="-7 2 336 104" role="img" aria-label="MIX POP">
            <defs>
              <clipPath id="mixpopLetters">
                <text className="mpType" x="160" y="76" textAnchor="middle">MIX POP</text>
              </clipPath>
            </defs>
            <rect className="mpEmpty" x="-7" y="2" width="336" height="104" clipPath="url(#mixpopLetters)" />
            <g clipPath="url(#mixpopLetters)">
              <g transform="translate(-80,0)">
                <g className="mpSwell">
                  <path className="mpDeepWave" d="M0 46q40-13 80 0t80 0 80 0 80 0 80 0 80 0 80 0 80 0V104H0Z" />
                  <path className="mpTopWave" d="M0 52q40-11 80 0t80 0 80 0 80 0 80 0 80 0 80 0 80 0V104H0Z" />
                </g>
              </g>
            </g>
            <text className="mpType mpEdge" x="160" y="76" textAnchor="middle" aria-hidden="true">MIX POP</text>
          </svg>
        </h1>
        <p>
          <strong>ドリンク調合トイ。</strong>
          <br />
          <span className="bitIntroSub">ジュースを好きにまぜて、好きなだけ飲めるドリンクバー</span>
        </p>
      </section>

      <div className="mixpopPanel">

      <MixPopGame />
      </div>

      <BitHowToPlay
        aboutLead={<>六つのジュースを混ぜて作る<strong>ドリンク調合トイ</strong>。</>}
        aboutSub="ファミレスのドリンクバーで、混ぜていたあの感じです。"
        playLead={<>味を<strong>タップして注ぐ</strong>。長押しでもう少し。</>}
        playSub="1タップ30ml、グラスは300mlまで。氷も入れられます。"
        rulesLead={<>勝ち負けは<strong>ありません</strong>。</>}
        rulesSub="できた一杯には名前がつき、カードにしてシェアできます。"
      />


      <BitCartridgeNav current="mixpop" />
      <BitFooter />
    </main>
    </>
  );
}
