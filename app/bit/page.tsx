import type { Metadata } from "next";
import Link from "next/link";
import { AngleGame } from "./AngleGame";

export const metadata: Metadata = {
  title: "MarutiBit — ANGLE",
  description: "線と角度を読み解く、短い幾何パズル。初級・中級・上級の3段階。",
  openGraph: {
    title: "MarutiBit — ANGLE",
    description: "線と角度を読み解く、短い幾何パズル。",
    url: "/bit",
    images: [],
  },
  twitter: {
    card: "summary",
    title: "MarutiBit — ANGLE",
    description: "線と角度を読み解く、短い幾何パズル。",
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
        <Link className="bitBack" href="/">Maruti Labへ戻る</Link>
      </header>

      <section className="bitIntro">
        <p className="bitSerial">MB / GAME 001</p>
        <h1>ANGLE</h1>
        <p>線を追い、角度をつなぐ。<br />未知の角をひとつ見つける。</p>
      </section>

      <AngleGame />

      <footer className="bitFooter">
        <span>MARUTIBIT / GAME 001</span>
        <span>© 2026 MARUTI LAB</span>
      </footer>
    </main>
  );
}
