import type { Metadata } from "next";
import TerraMap from "./TerraMap";

/* The map is the page, and the map is a client component, so the metadata
   lives out here. */
export const metadata: Metadata = {
  title: { absolute: "世界の挨拶を地図から｜HALLO TERRA" },
  description:
    "世界地図から国や地域を選ぶと、その土地の挨拶・お礼・お詫びが、現地の文字とカタカナの読み、意味、挨拶の仕草とあわせて出てきます。登録不要、ブラウザだけで動く無料の世界挨拶地図。",
  keywords: ["世界の挨拶", "挨拶 世界", "こんにちは 各国語", "ありがとう 世界の言葉", "世界地図", "HALLO TERRA"],
  alternates: { canonical: "https://marutilab.com/hallo-terra" },
  // The URL is live before the content is. An unlinked page is still a page
  // anyone can reach, and a map with 36 countries written up is exactly the
  // thin thing not to hand a crawler; this comes off when HALLO TERRA joins
  // Works and the sitemap.
  robots: { index: false, follow: true },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "Maruti Lab",
    title: "HALLO TERRA — 世界の挨拶を、地図から",
    description: "地図から場所を選ぶと、その土地の挨拶・お礼・お詫びと、挨拶の仕草が分かります。",
  },
  twitter: { card: "summary_large_image" },
};

export default function HalloTerraPage() {
  return <TerraMap />;
}
