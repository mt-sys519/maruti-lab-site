import type { Metadata } from "next";
import YuramekiStudio from "./YuramekiStudio";

/* The studio is the page. It is a client component - it was the whole of
   YURAMEKI's own home page - so the metadata lives out here. */
export const metadata: Metadata = {
  // The tagline is the face of the tool and stays on the share card below. A
  // search result is read by someone who has never heard the name, so the
  // title here says what the thing does; `absolute` keeps the site's
  // "%s | Maruti Lab" template from pushing that off the end.
  title: { absolute: "イラストを動かす｜GIF・MP4が作れるYURAMEKI" },
  description:
    "イラストや写真の動かしたい場所だけを囲んで、呼吸・たなびき・灯り・波紋の動きをつけられる無料のブラウザツール。画像は外部に送信せず、GIF・APNG・アニメーションWebP・MP4で書き出せます。登録不要。",
  keywords: [
    "イラストを動かす",
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
    images: [{ url: "https://marutilab.com/yurameki/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["https://marutilab.com/yurameki/og.png"],
  },
};

export default function YuramekiPage() {
  return <YuramekiStudio />;
}
