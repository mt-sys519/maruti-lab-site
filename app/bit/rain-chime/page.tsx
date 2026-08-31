import type { Metadata } from "next";
import { BitFooter } from "../BitFooter";
import { BitHeader } from "../BitHeader";
import { BitSeriesNav } from "../BitSeriesNav";
import { RainChimeGame } from "../RainChimeGame";

const title = "MarutiBit — AVENUE（ピクセルアート・アンビエント）";
const description = "1996年のニューヨーク。雨、ウインドチャイム、Steel Tongue Drumを眺めて聴くピクセルアート・アンビエント。";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/bit/rain-chime" },
  openGraph: {
    title,
    description,
    url: "/bit/rain-chime",
    images: [
      { url: "/og/bit/rain-chime.png", width: 1200, height: 630, alt: "MarutiBit AVENUE" },
      { url: "/og/bit/rain-chime-square.png", width: 630, height: 630, alt: "MarutiBit AVENUE" },
    ],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og/bit/rain-chime.png"] },
};

export default function RainChimePage() {
  return (
    <main className="bitPage">
      <BitHeader current="AVENUE" />
      <BitSeriesNav active="rain-chime" />
      <section className="bitIntro bitRainChimeIntro">
        <p className="bitSerial">MB / GAME 007</p>
        <h1><span>AVENUE</span></h1>
        <p><strong>眺めるアンビエント。</strong><br />雨、ウインドチャイム、タングドラムがつくる部屋の時間。</p>
      </section>
      <div className="bitGameShell">
        <RainChimeGame />
      </div>
      <BitFooter label="MARUTIBIT / GAME 007" />
    </main>
  );
}
