import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { AirHockeyGame } from "../AirHockeyGame";
import { BitCartridgeNav } from "../BitCartridgeNav";
import { BitFooter } from "../BitFooter";
import { BitHeader } from "../BitHeader";
import { BitHowToPlay } from "../BitHowToPlay";
import { BitSeriesNav } from "../BitSeriesNav";
import "../airHockey.css";
import { PrAds } from "../../PrAds";

const title = "ブラウザで遊べるエアホッケー｜AIR HOCKEY";
const description =
  "カンッと打って、スーッと滑る。ゲームセンターのエアホッケーをブラウザで。途中でパックが増える15点先取、本物の球速と公式ルールで戦うPRO STAGE、スマホやタブレット1台での2人対戦も。無料、登録不要。";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/bit/airhockey" },
  openGraph: {
    title,
    description,
    url: "/bit/airhockey",
    images: [
      { url: "/og/bit/airhockey.png", width: 1200, height: 630, alt: "MarutiBit AIR HOCKEY" },
      { url: "/og/bit/airhockey-square.png", width: 630, height: 630, alt: "MarutiBit AIR HOCKEY" },
    ],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og/bit/airhockey.png"] },
};

export default function AirHockeyPage() {
  return (
    <main className="bitPage bitPageDark bitPageAirHockey" style={{ "--pkg-color": "#2BB3A3" } as CSSProperties}>
      <BitHeader current="AIR HOCKEY" />
      <BitSeriesNav active="airhockey" />
      <section className="bitIntro">
        <p className="bitSerial">MB / GAME 011</p>
        <h1>
          <svg className="ahLogo" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="3" y="2.5" width="18" height="19" rx="3" />
            <path d="M3 12h18" />
            <circle cx="12" cy="17" r="2.6" />
            <circle cx="12" cy="7.4" r="1.4" />
          </svg>
          <span>AIR HOCKEY</span>
        </h1>
        <p>
          <strong>リアル志向のエアホッケー。</strong>
          <br />
          <span className="bitIntroSub">ゲームセンターのあの台を、指一本で。</span>
        </p>
      </section>

      <AirHockeyGame />

      <BitHowToPlay
        aboutLead={<><strong>ゲームセンターのエアホッケー</strong>を、ブラウザで。</>}
        aboutSub="強く打てばカンッと速く、そっと当てればふわりと漂う。"
        playLead={<>指（マウス）で<strong>マレットを動かして</strong>、パックを打ち返す。</>}
        playSub="動かしたまま当てると強く飛びます。PRO STAGEでは、大きく振りかぶるほど速い球に。音はゲーム画面の右上で切り替え。"
        rulesLead={<>相手のゴールに入れて、<strong>先に7点</strong>取ったほうの勝ち。</>}
        rulesSub="15点先取では、合計6点ごとにパックが2つ（どちらかが10点を取ると3つ）同時に出ます。PRO STAGEの公式ルールは7点×4ゲーム先取で、自陣に来たパックを7秒以内に打ち返さないと相手のパックになります。"
        chips={[
          "ARCADE：EASY / NORMAL / HARD",
          "15点先取：途中でパックが増える",
          "PRO STAGE：ELITE / CHAMPION / LEGEND",
          "2人対戦：スマホ・タブレットを平らに置いて向かい合う",
          "エキシビジョンマッチ：CPU同士の対戦を見る",
        ]}
        note={<><strong>速いパックを目で追い続けるので、目が疲れやすいゲームです。</strong>長い時間続けて遊ばず、ときどき目を休めてください。</>}
      />
      <PrAds kind="a8" />

      <BitCartridgeNav current="airhockey" />
      <BitFooter label="MARUTIBIT / GAME 011" />
    </main>
  );
}
