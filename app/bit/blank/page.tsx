import type { Metadata } from "next";
import Link from "next/link";
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
        <Link className="bitBrand" href="/bit" aria-label="MarutiBit トップ">
          <span>Maruti</span><b>Bit</b>
        </Link>
        <a className="bitBack" href="https://marutilab.com/">Maruti Labへ戻る</a>
      </header>

      <nav className="bitSeriesNav" aria-label="ゲームを選ぶ">
        <Link href="/bit"><small>001</small>ANGLE</Link>
        <Link className="isActive" href="/bit/blank"><small>002</small>BLANK</Link>
      </nav>

      <section className="bitIntro bitBlankIntro">
        <p className="bitSerial">MB / GAME 002</p>
        <h1><span>BLANK</span></h1>
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
