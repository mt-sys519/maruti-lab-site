import type { Metadata } from "next";
import { PakuGame } from "../PakuGame";
import { BitFooter } from "../BitFooter";
import { BitHeader } from "../BitHeader";
import { BitSeriesNav } from "../BitSeriesNav";

export const metadata: Metadata = {
  title: "MarutiBit — PAKU（エサやりゲーム）",
  description: "水槽の熱帯魚にタップで餌をあげるエサやりゲーム。",
  alternates: { canonical: "/bit/paku" },
  openGraph: {
    title: "MarutiBit — PAKU（エサやりゲーム）",
    description: "水槽の熱帯魚にタップで餌をあげるエサやりゲーム。",
    url: "/bit/paku",
    images: [
      { url: "/og/bit/paku.png", width: 1200, height: 630, alt: "MarutiBit PAKU" },
      { url: "/og/bit/paku-square.png", width: 630, height: 630, alt: "MarutiBit PAKU" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MarutiBit — PAKU（エサやりゲーム）",
    description: "水槽の熱帯魚にタップで餌をあげるエサやりゲーム。",
    images: ["/og/bit/paku.png"],
  },
};

export default function PakuPage() {
  return (
    <main className="bitPage">
      <BitHeader current="PAKU" />

      <BitSeriesNav active="paku" />

      <section className="bitIntro bitPakuIntro">
        <p className="bitSerial">MB / GAME 005</p>
        <h1>
          <svg className="bitPakuLogo" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M3.5 12 C7 7.5 12 6.7 16.2 9.2 L21 6.6 L19.4 12 L21 17.4 L16.2 14.8 C12 17.3 7 16.5 3.5 12 Z" />
            <circle cx="8.1" cy="11" r="1" />
          </svg>
          <span>PAKU</span>
        </h1>
        <p><strong>エサやりゲーム。</strong><br />水槽で泳ぐ熱帯魚に、タップで餌をあげるだけのミニゲーム。</p>
      </section>

      <PakuGame />

      <BitFooter label="MARUTIBIT / GAME 005" />
    </main>
  );
}
