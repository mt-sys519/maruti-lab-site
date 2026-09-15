import type { Metadata } from "next";
import YuramekiStudio from "./YuramekiStudio";

/* The studio is the page. It is a client component - it was the whole of
   YURAMEKI's own home page - so the metadata lives out here. */
export const metadata: Metadata = {
  title: "YURAMEKI — 一枚の絵に、静かな呼吸を",
  description:
    "一枚の絵に、静かな呼吸を。画像を外部へ送信せず、ブラウザ内でGIF・APNG・アニメーションWebPを制作できます。",
  keywords: [
    "画像アニメーション",
    "GIF作成",
    "APNG",
    "アニメーションWebP",
    "写真を動かす",
    "YURAMEKI",
  ],
  alternates: { canonical: "https://marutilab.com/yurameki" },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "Maruti Lab",
    title: "YURAMEKI — 一枚の絵に、静かな呼吸を",
    description: "一枚の絵に、静かな呼吸を。ブラウザの中だけでつくるモーションスタジオ。",
    images: [{ url: "https://marutilab.com/yurameki/og.png", width: 1731, height: 909 }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["https://marutilab.com/yurameki/og.png"],
  },
};

export default function YuramekiPage() {
  return <YuramekiStudio />;
}
