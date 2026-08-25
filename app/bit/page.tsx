import type { Metadata } from "next";
import Link from "next/link";
import { AngleGame } from "./AngleGame";

export const metadata: Metadata = {
  title: "MarutiBit — ANGLE",
  description: "三角形の角度を順番に解く、全5問の図形パズル。初級・中級・上級の3段階。",
  openGraph: {
    title: "MarutiBit — ANGLE",
    description: "三角形の角度を順番に解く、全5問の図形パズル。",
    url: "/bit",
    images: [],
  },
  twitter: {
    card: "summary",
    title: "MarutiBit — ANGLE",
    description: "三角形の角度を順番に解く、全5問の図形パズル。",
    images: [],
  },
};

export default function MarutiBitPage() {
  return (
    <main className="bitPage">
      <header className="bitHeader">
        <Link className="bitBrand" href="/bit" aria-label="MarutiBit トップ">
          <span>Maruti</span><b>Bit</b>
        </Link>
        <a className="bitBack" href="https://marutilab.com/">Maruti Labへ戻る</a>
      </header>

      <section className="bitIntro">
        <p className="bitSerial">MB / GAME 001</p>
        <h1>
          <svg className="bitAngleLogo" viewBox="0 0 72 64" aria-hidden="true" focusable="false">
            <path d="M36 4.5 67 59.5H5Z" />
            <path d="M13.5 53.5h11" />
          </svg>
          <span>ANGLE</span>
        </h1>
        <p><strong>三角形の角度パズル。</strong><br />示された角度から「？」を求める、全5問のミニゲーム。</p>
      </section>

      <AngleGame />

      <footer className="bitFooter">
        <span>MARUTIBIT / GAME 001</span>
        <span>© 2026 MARUTI LAB</span>
      </footer>
    </main>
  );
}
