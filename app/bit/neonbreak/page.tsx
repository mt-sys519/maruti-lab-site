import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { BitCartridgeNav } from "../BitCartridgeNav";
import { BitFooter } from "../BitFooter";
import { BitHeader } from "../BitHeader";
import { BitHowToPlay } from "../BitHowToPlay";
import { BitSeriesNav } from "../BitSeriesNav";
import { NeonBreakGame } from "../NeonBreakGame";

const title = "MarutiBit — NEON BREAK（ナインボール）";
const description = "ネオンの台で9番を狙うナインボール。ひとりで詰めるSOLO、AIKAと撞くVS CPU、一打勝負のSTAGE。";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/bit/neonbreak" },
  openGraph: {
    title,
    description,
    url: "/bit/neonbreak",
    images: [
      { url: "/og/bit/neonbreak-v2.png", width: 1200, height: 630, alt: "MarutiBit NEON BREAK" },
      { url: "/og/bit/neonbreak-v2-square.png", width: 630, height: 630, alt: "MarutiBit NEON BREAK" },
    ],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og/bit/neonbreak-v2.png"] },
};

export default function NeonBreakPage() {
  return (
    <main className="bitPage" style={{ "--pkg-color": "#6B3FA0" } as CSSProperties}>
      <BitHeader current="NEON BREAK" />
      <BitSeriesNav active="neonbreak" />
      <section className="bitIntro">
        <p className="bitSerial">MB / GAME 008</p>
        <h1>
          <svg className="bitNeonBreakLogo" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="9" />
            <path d="M6.4 17.6 17.6 6.4" />
            <circle className="bitNeonBreakLogoDot" cx="8.6" cy="8.6" r="1.5" />
          </svg>
          <span>NEON BREAK</span>
        </h1>
        <p><strong>ネオンの台のナインボール。</strong><br />台につくのは、三人のオペレーター。</p>
      </section>
      {/* Wider than the other cartridges: this one is a full table with a side
          panel, and at the standard 1120px the felt gets squeezed to the point
          where aiming stops being readable. */}
      <div className="bitGameShell bitGameShellWide">
        <NeonBreakGame />
      </div>
      <BitHowToPlay
        aboutLead={<>ネオンの台で撞く<strong>ナインボール</strong>。</>}
        aboutSub="ひとりで詰めるか、AIKAと対戦するか、一打勝負を解くか。"
        playLead={<>手球を<strong>引いて、離す</strong>。引いた距離が強さ。</>}
        playSub="離す方向と反対に飛びます。やり直すときは右クリックかESC。"
        rulesLead={<>台に残った<strong>いちばん小さい番号</strong>に、先に当てる。</>}
        rulesSub="当てそこねるとファウル。9番を落とせば決着です。"
        chips={[
          "SOLO：何打で上がれるか",
          "VS CPU：AIKAと交互に",
          "STAGE：一打で9番を落とす",
        ]}
      />
      <BitCartridgeNav current="neonbreak" />
      <BitFooter label="MARUTIBIT / GAME 008" />
    </main>
  );
}
