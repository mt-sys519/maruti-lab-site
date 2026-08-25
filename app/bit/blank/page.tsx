import type { Metadata } from "next";
import { BlankGame } from "../BlankGame";

export const metadata: Metadata = {
  title: "MarutiBit — BLANK",
  description: "四則演算の空欄を逆算して埋める、全5問の計算パズル。初級・中級・上級の3段階。",
  openGraph: {
    title: "MarutiBit — BLANK",
    description: "四則演算の空欄を逆算して埋める、全5問の計算パズル。",
    url: "/bit/blank",
    images: [],
  },
  twitter: {
    card: "summary",
    title: "MarutiBit — BLANK",
    description: "四則演算の空欄を逆算して埋める、全5問の計算パズル。",
    images: [],
  },
};

export default function BlankPage() {
  return (
    <main className="bitPage">
      <header className="bitHeader">
        <a className="bitBrand" href="/bit" aria-label="MarutiBit トップ">
          <span>Maruti</span><b>Bit</b>
        </a>
        <a className="bitBack" href="https://marutilab.com/">Maruti Labへ戻る</a>
      </header>

      <nav className="bitSeriesNav" aria-label="ゲームを選ぶ">
        <a href="/bit"><small>001</small>ANGLE</a>
        <a className="isActive" href="/bit/blank"><small>002</small>BLANK</a>
      </nav>

      <section className="bitIntro bitBlankIntro">
        <p className="bitSerial">MB / GAME 002</p>
        <h1>
          <svg className="bitBlankLogo" viewBox="0 0 72 64" aria-hidden="true" focusable="false">
            <rect x="9" y="5" width="54" height="54" />
            <path d="M17 51.5h12" />
          </svg>
          <span>BLANK</span>
        </h1>
        <p><strong>四則演算の穴埋めパズル。</strong><br />式の「？」に入る数字を逆算する、全5問のミニゲーム。</p>
      </section>

      <BlankGame />

      <footer className="bitFooter">
        <span>MARUTIBIT / GAME 002</span>
        <span>© 2026 MARUTI LAB</span>
      </footer>
    </main>
  );
}
