import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marutilab.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Maruti Lab — 小さなデジタル道具のラボ", template: "%s | Maruti Lab" },
  description: "画像を動かす。写真を整える。色を戻す。時間を灯す。YURAMEKI、SwiftCrop、COLOR RE:FINE、PromptTermをつくる個人ラボ。",
  applicationName: "Maruti Lab",
  creator: "Maruti Lab",
  publisher: "Maruti Lab",
  icons: {
    icon: [{ url: "/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icon-512.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "Maruti Lab",
    title: "Maruti Lab — 小さなデジタル道具のラボ",
    description: "画像を動かす。写真を整える。色を戻す。時間を灯す。",
    url: "/",
    images: [{ url: "/maruti-lab-og.jpg", width: 1200, height: 630, alt: "Maruti Lab — 小さなデジタル道具のラボ" }],
  },
  twitter: { card: "summary_large_image", title: "Maruti Lab", description: "画像を動かす。写真を整える。色を戻す。時間を灯す。", images: ["/maruti-lab-og.jpg"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
