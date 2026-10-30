import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { BitCartridgeNav } from "../BitCartridgeNav";
import { BitFooter } from "../BitFooter";
import { BitHeader } from "../BitHeader";
import { BitHowToPlay } from "../BitHowToPlay";
import { BitSeriesNav } from "../BitSeriesNav";
import { MagnetBoardGame } from "../MagnetBoardGame";
import "../magnetBoard.css";
import { PrAds } from "../../PrAds";

const title = "ブラウザで描ける磁気お絵かきボード｜MAGNET BOARD";
const description =
  "砂鉄で描いて、つまみでシャーッと消す、磁気お絵かきボード。ひらがな・たしざん・ひきざん・かたちのお手本も出せる。無料、登録不要。";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/bit/magnetboard" },
  openGraph: {
    title,
    description,
    url: "/bit/magnetboard",
    images: [
      { url: "/og/bit/magnetboard.png", width: 1200, height: 630, alt: "MarutiBit MAGNET BOARD" },
      { url: "/og/bit/magnetboard-square.png", width: 630, height: 630, alt: "MarutiBit MAGNET BOARD" },
    ],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og/bit/magnetboard.png"] },
};

export default function MagnetBoardPage() {
  return (
    <>
      {/* Klee One for the practice sheets and the kana picker: a schoolbook
          hand a child would copy from. It loads on this route only. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Klee+One:wght@600&display=swap" />
      <main className="bitPage bitPageMilk" style={{ "--pkg-color": "#7B8CDE" } as CSSProperties}>
        <BitHeader current="MAGNET BOARD" />
        <BitSeriesNav active="magnetboard" />
        <section className="bitIntro">
          <p className="bitSerial">MB / GAME 010</p>
          <h1><span>MAGNET BOARD</span></h1>
          <p>
            <strong>磁気お絵かきボード。</strong>
            <br />
            <span className="bitIntroSub">砂鉄で描いて、つまみでシャーッと消す。</span>
          </p>
        </section>

        <MagnetBoardGame />

        <BitHowToPlay
          aboutLead={<>砂鉄で描く<strong>磁気お絵かきボード</strong>。</>}
          aboutSub="ゆっくり引くと濃く、すばやく引くとかすれます。"
          playLead={<>画面を<strong>なぞって描き</strong>、下のつまみを動かして消す。</>}
          playSub="つまみが通ったところだけ消えます。線の太さは下の丸で選べます。"
          rulesLead={<>勝ち負けは<strong>ありません</strong>。</>}
          rulesSub="「あいう」「1+2」「○△」で、ひらがな・たしざん・ひきざん・かたちのお手本が画面の下に出ます。"
        />
        <PrAds kind="a8" />

        <BitCartridgeNav current="magnetboard" />
        <BitFooter label="MARUTIBIT / GAME 010" />
      </main>
    </>
  );
}
