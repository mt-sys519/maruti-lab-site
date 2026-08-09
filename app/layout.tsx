import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4188";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Maruti Lab — 小さなデジタル道具のラボ", template: "%s | Maruti Lab" },
  description: "画像を動かす。写真を整える。色を戻す。時間を灯す。YURAMEKI、SwiftCrop、COLOR RE:FINE、PromptTermをつくる個人ラボ。",
  applicationName: "Maruti Lab",
  creator: "Maruti Lab",
  publisher: "Maruti Lab",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "Maruti Lab",
    title: "Maruti Lab — 小さなデジタル道具のラボ",
    description: "画像を動かす。写真を整える。色を戻す。時間を灯す。",
  },
  twitter: { card: "summary", title: "Maruti Lab", description: "画像を動かす。写真を整える。色を戻す。時間を灯す。" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
