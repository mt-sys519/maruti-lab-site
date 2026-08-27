import type { Metadata } from "next";
import { BlankGame } from "../BlankGame";
import { BitFooter } from "../BitFooter";
import { BitHeader } from "../BitHeader";
import { BitSeriesNav } from "../BitSeriesNav";

export const metadata: Metadata = {
  title: "MarutiBit — BLANK",
  description: "四則演算の空欄を逆算して埋める、全5問の計算パズル。初級・中級・上級の3段階。",
  alternates: { canonical: "/bit/blank" },
  openGraph: {
    title: "MarutiBit — BLANK",
    description: "四則演算の空欄を逆算して埋める、全5問の計算パズル。",
    url: "/bit/blank",
    images: [{ url: "/og/bit/blank.png", width: 1200, height: 630, alt: "MarutiBit BLANK" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MarutiBit — BLANK",
    description: "四則演算の空欄を逆算して埋める、全5問の計算パズル。",
    images: ["/og/bit/blank.png"],
  },
};

export default function BlankPage() {
  return (
    <main className="bitPage">
      <BitHeader current="BLANK" />

      <BitSeriesNav active="blank" />

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

      <BitFooter label="MARUTIBIT / GAME 002" />
    </main>
  );
}
