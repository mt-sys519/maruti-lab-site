import type { Metadata } from "next";
import { BitFooter } from "./BitFooter";
import { BitHeader } from "./BitHeader";
import { BitHub } from "./BitHub";
import "./retro/retro.css";

const title = "MarutiBit — 小さなゲームの入口";
const description = "考える。打ち込む。眺める。触ってみる。短い時間で遊べる、Maruti Labのミニゲームシリーズ。";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/bit" },
  openGraph: { title, description, url: "/bit", images: [{ url: "/og/bit/index-v2.png", width: 1200, height: 630, alt: "MarutiBit ゲームシリーズ" }] },
  twitter: { card: "summary_large_image", title, description, images: ["/og/bit/index-v2.png"] },
};

export default function MarutiBitPage() {
  return (
    <main className="bitPage">
      {/* The RETRO faces for the series block: Press Start 2P and DotGothic16. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DotGothic16&family=Press+Start+2P&display=swap" />
      <BitHeader />
      <BitHub />
      <BitFooter />
    </main>
  );
}
