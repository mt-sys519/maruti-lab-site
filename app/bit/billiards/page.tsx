import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { BilliardsGame } from "../BilliardsGame";
import { BitCartridgeNav } from "../BitCartridgeNav";
import { BitFooter } from "../BitFooter";
import { BitHeader } from "../BitHeader";
import { BitHowToPlay } from "../BitHowToPlay";
import { BitSeriesNav } from "../BitSeriesNav";
import "../billiards.css";
import { WorkNotes } from "../../blog/NoteWork";
import { PrAds } from "../../PrAds";

const title = "ビリヤードのブラウザゲーム｜BILLIARDS";
const description =
  "7フィートの台で撞く、リアル志向のビリヤードをブラウザで。ナインボールとエイトボール、3段階のCPU戦、ひとりで取り切るSOLO、1台を交互に使う2人対戦、URLを送るだけのオンライン対戦も。無料、登録不要。";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/bit/billiards" },
  openGraph: {
    title,
    description,
    url: "/bit/billiards",
    images: [
      { url: "/og/bit/billiards.png", width: 1200, height: 630, alt: "MarutiBit BILLIARDS" },
      { url: "/og/bit/billiards-square.png", width: 630, height: 630, alt: "MarutiBit BILLIARDS" },
    ],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og/bit/billiards.png"] },
};

export default function BilliardsPage() {
  return (
    <main className="bitPage bitPageDark bitPageBilliards" style={{ "--pkg-color": "#F4C430" } as CSSProperties}>
      <BitHeader current="BILLIARDS" />
      <BitSeriesNav active="billiards" />
      <section className="bitIntro">
        <p className="bitSerial">MB / GAME 012</p>
        <h1>
          <svg className="blLogo" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="3.6" />
          </svg>
          <span>BILLIARDS</span>
        </h1>
        <p>
          <strong>リアル志向のビリヤード。</strong>
          <br />
          <span className="bitIntroSub">7フィートの台で、ナインボールとエイトボールを。</span>
        </p>
      </section>

      <BilliardsGame />

      <BitHowToPlay
        aboutLead={<><strong>本物の台のビリヤード</strong>を、ブラウザで。</>}
        aboutSub="玉の転がりとひねり、クッションでの跳ね返り、ポケットに落ちる音まで、本物の台に近づけました。"
        playLead={<>指（マウス）で<strong>引いて、離して撞く</strong>。</>}
        playSub="引いているあいだ右のゲージが上下し、離したときの強さで撞きます。引いたまま横にずらすと向きが変わり、ゆっくり動かすほど細かく合わせられます。左下の手玉をタップすると、撞点（押し・引き・ひねり）を選べます。"
        rulesLead={<>ナインボールは<strong>9番</strong>、エイトボールは<strong>自分の組を落としてから8番</strong>を落とせば勝ち。</>}
        rulesSub="ナインボールは、いちばん小さい番号の玉に先に当てます。エイトボールは、ブレイクのあと最初に落とした玉で、ソリッド（1〜7）かストライプ（9〜15）かが決まります。手玉を落とす、先に当てる玉を間違える、どの玉もクッションに届かない、はファウルで、相手が手玉を好きな所に置けます。"
        chips={[
          "9-BALL / 8-BALL",
          "VS CPU：EASY / NORMAL / HARD",
          "SOLO：ひとりで、少ない打数で取り切る",
          "LOCAL VS：1台を交互に使って、2人で対戦",
          "ONLINE VS：URLを送った相手と、それぞれの画面で対戦",
          "1ラック勝負 / 3ラック先取",
        ]}
      />
      <PrAds kind="a8" />

      <BitCartridgeNav current="billiards" />
      <WorkNotes href="/bit/billiards" />
      <BitFooter label="MARUTIBIT / GAME 012" />
    </main>
  );
}
