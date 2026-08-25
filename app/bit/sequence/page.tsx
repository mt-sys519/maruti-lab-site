import type { Metadata } from "next";
import { SequenceGame } from "../SequenceGame";

export const metadata: Metadata = {
  title: "MarutiBit — SEQUENCE",
  description: "数の並びに隠れた規則を見抜く、全5問の数列パズル。初級・中級・上級の3段階。",
  openGraph: { title: "MarutiBit — SEQUENCE", description: "数の並びに隠れた規則を見抜く、全5問の数列パズル。", url: "/bit/sequence", images: [] },
  twitter: { card: "summary", title: "MarutiBit — SEQUENCE", description: "数の並びに隠れた規則を見抜く、全5問の数列パズル。", images: [] },
};

export default function SequencePage() {
  return (
    <main className="bitPage">
      <header className="bitHeader">
        <a className="bitBrand" href="/bit" aria-label="MarutiBit トップ"><span>Maruti</span><b>Bit</b></a>
        <a className="bitBack" href="https://marutilab.com/">Maruti Labへ戻る</a>
      </header>
      <nav className="bitSeriesNav" aria-label="ゲームを選ぶ">
        <a href="/bit"><small>001</small>ANGLE</a>
        <a href="/bit/blank"><small>002</small>BLANK</a>
        <a className="isActive" href="/bit/sequence"><small>003</small>SEQUENCE</a>
      </nav>
      <section className="bitIntro bitSequenceIntro">
        <p className="bitSerial">MB / GAME 003</p>
        <h1>
          <svg className="bitSequenceLogo" viewBox="0 0 72 64" aria-hidden="true" focusable="false">
            <path d="M17 42.6 32 33.4M40 28.6 55 19.4M9 56h12" />
            <circle cx="13" cy="45" r="4" /><circle cx="36" cy="31" r="4" /><circle cx="59" cy="17" r="4" />
          </svg>
          <span>SEQUENCE</span>
        </h1>
        <p><strong>数の並びを読むパズル。</strong><br />隠れた規則を見つけて「？」を求める、全5問のミニゲーム。</p>
      </section>
      <SequenceGame />
      <footer className="bitFooter"><span>MARUTIBIT / GAME 003</span><span>© 2026 MARUTI LAB</span></footer>
    </main>
  );
}
