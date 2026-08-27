import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marutilab.com";
// TODO: replace with the real GA4 measurement ID before relying on this data.
const GA_MEASUREMENT_ID = "G-XXXXXXXXXX";

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
  return (
    <html lang="ja">
      <body>
        {children}
        {/* Loaded once here in the root layout, so every route under Maruti Lab -
            the top-level site, the MarutiBit hub, and each individual game page -
            is covered by a single gtag.js load instead of one per page. */}
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}
