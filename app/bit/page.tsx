import type { Metadata } from "next";
import { BitFooter } from "./BitFooter";
import { BitHeader } from "./BitHeader";
import { BitHub } from "./BitHub";

const title = "MarutiBit — 小さなゲームの入口";
const description = "考える。見抜く。打ち込む。短い時間で遊べる、Maruti Labのミニゲームシリーズ。";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/bit" },
  openGraph: { title, description, url: "/bit", images: [{ url: "/og/bit/index.png", width: 1200, height: 630, alt: "MarutiBit ゲームシリーズ" }] },
  twitter: { card: "summary_large_image", title, description, images: ["/og/bit/index.png"] },
};

export default function MarutiBitPage() {
  return (
    <main className="bitPage">
      <BitHeader />
      <BitHub />
      <BitFooter />
    </main>
  );
}
