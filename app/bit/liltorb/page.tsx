import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { LiltOrbGame } from "../LiltOrbGame";
import { BitCartridgeNav } from "../BitCartridgeNav";
import { BitFooter } from "../BitFooter";
import { BitHeader } from "../BitHeader";
import { BitHowToPlay } from "../BitHowToPlay";
import { BitNotes } from "../BitNotes";
import { BitSeriesNav } from "../BitSeriesNav";

export const metadata: Metadata = {
  title: "MarutiBit — LILT ORB（粒子操作トイ）",
  description: "触れると粒子が集まる、癒しと刺激の球体トイ。",
  alternates: { canonical: "/bit/liltorb" },
  openGraph: {
    title: "MarutiBit — LILT ORB（粒子操作トイ）",
    description: "触れると粒子が集まる、癒しと刺激の球体トイ。",
    url: "/bit/liltorb",
    images: [
      { url: "/og/bit/liltorb.png", width: 1200, height: 630, alt: "MarutiBit LILT ORB" },
      { url: "/og/bit/liltorb-square.png", width: 630, height: 630, alt: "MarutiBit LILT ORB" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MarutiBit — LILT ORB（粒子操作トイ）",
    description: "触れると粒子が集まる、癒しと刺激の球体トイ。",
    images: ["/og/bit/liltorb.png"],
  },
};

export default function LiltOrbPage() {
  return (
    <main className="bitPage" style={{ "--pkg-color": "#F2A0C1" } as CSSProperties}>
      <BitHeader current="LILT ORB" />

      <BitSeriesNav active="liltorb" />

      <section className="bitIntro bitLiltOrbIntro">
        <p className="bitSerial">MB / GAME 006</p>
        <h1>
          <svg className="bitLiltOrbLogo" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle className="bitLiltOrbLogoRing" cx="12" cy="12" r="8.2" />
            <circle className="bitLiltOrbLogoDot" cx="9.2" cy="10" r="0.85" />
            <circle className="bitLiltOrbLogoDot" cx="14.2" cy="8.6" r="0.6" />
            <circle className="bitLiltOrbLogoDot" cx="14.6" cy="14.1" r="0.75" />
            <circle className="bitLiltOrbLogoDot" cx="10.1" cy="14.9" r="0.55" />
          </svg>
          <span>LILT ORB</span>
        </h1>
        <p><strong>粒子操作トイ。</strong><br /><span className="bitIntroSub">なぞって粒子を引き寄せる、感触のおもちゃ。NATURALは癒し、CYBERは刺激。</span></p>
      </section>

      <LiltOrbGame />

      <BitHowToPlay
        aboutLead={<>なぞって粒子を引き寄せる<strong>感触トイ</strong>。</>}
        aboutSub="NATURALは癒し、CYBERは刺激。"
        playLead={<>画面を<strong>なぞって、はなす</strong>だけ。</>}
        playSub="粒子が指に集まり、はなすと散らばります。"
        rulesLead={<>勝敗や得点は<strong>ありません</strong>。</>}
        rulesSub="テーマを切り替えて感触の違いを楽しめます。"
      />
      <BitNotes
        title="音と隠し機能"
        lead="LILT ORBの音はNATURALとCYBERで別々で、CYBERにはひとつ隠し機能があります。"
        entries={[
          {
            label: "HIDDEN",
            name: "タップテンポ",
            meta: "CYBERのみ",
            body: <>CYBERで球体を4回続けてタップすると、その間隔からテンポを読み取ってキックのループが始まります。速さはタップ次第で、毎分40〜220拍の範囲に収まります。もう4回タップすると止まり、NATURALに切り替えても止まります。</>,
          },
          {
            label: "SOUND / A",
            name: "NATURAL",
            body: <>最初にチャイムがひとつ鳴ったあとは、ほとんど静かなままです。触れたときの音も余韻の長いものを選んでいます。何もしないで置いておける方の面です。</>,
          },
          {
            label: "SOUND / B",
            name: "CYBER",
            body: <>アルペジオが走り、なぞっている間だけ粒のような音が左右を横切ります。指を離すと何も残りません。動かしている間だけ鳴る音です。</>,
          },
        ]}
        footnote="音はMarutiBit共通の設定です。ほかのゲームでオフにしていれば、ここでもオフのままになります。"
      />

      <BitCartridgeNav current="liltorb" />
      <BitFooter label="MARUTIBIT / GAME 006" />
    </main>
  );
}
