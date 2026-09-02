import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { BitFooter } from "../BitFooter";
import { BitHeader } from "../BitHeader";
import { BitSeriesNav } from "../BitSeriesNav";
import { RainChimeGame } from "../RainChimeGame";

const title = "MarutiBit — AVENUE（ピクセルアート・アンビエント）";
const description = "1996年のニューヨーク。雨、ウインドチャイム、Steel Tongue Drumを眺めて聴くピクセルアート・アンビエント。";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/bit/avenue" },
  openGraph: {
    title,
    description,
    url: "/bit/avenue",
    images: [
      { url: "/og/bit/avenue.png", width: 1200, height: 630, alt: "MarutiBit AVENUE" },
      { url: "/og/bit/avenue-square.png", width: 630, height: 630, alt: "MarutiBit AVENUE" },
    ],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og/bit/avenue.png"] },
};

export default function AvenuePage() {
  return (
    <main className="bitPage" style={{ "--pkg-color": "#7B8CDE" } as CSSProperties}>
      <BitHeader current="AVENUE" />
      <BitSeriesNav active="avenue" />
      <section className="bitIntro bitRainChimeIntro">
        <p className="bitSerial">MB / GAME 007</p>
        <h1>
          <svg className="bitAvenueLogo" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M7 5.5 H17" />
            <path d="M9 5.5 V16" />
            <path d="M12 5.5 V19" />
            <path d="M15 5.5 V14.5" />
            <circle className="bitAvenueLogoDot" cx="12" cy="21.3" r="1" />
          </svg>
          <span>AVENUE</span>
        </h1>
        <p><strong>眺めるアンビエント。</strong><br />雨、ウインドチャイム、タングドラムがつくる部屋の時間。</p>
      </section>
      <div className="bitGameShell">
        <RainChimeGame />
      </div>
      <BitFooter label="MARUTIBIT / GAME 007" />
    </main>
  );
}
