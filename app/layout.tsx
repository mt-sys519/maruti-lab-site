import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marutilab.com";
const GA_MEASUREMENT_ID = "G-HCHV1Y4GPS";

// The site has no dark-mode styling at all, but Android Chrome's "force dark"
// heuristic will still repaint unstyled pages (canvas included) toward dark
// when the OS is in dark mode - most visible on PAKU's aquarium canvas, whose
// background went black while fish drawn on top kept their real colors.
// This opts the whole site out of that heuristic.
export const viewport: Viewport = {
  colorScheme: "light",
  // Without this, the layout viewport is clamped to the OS safe area no matter
  // what fullscreen CSS says - PAKU's fullscreen tank couldn't reach past the
  // status bar strip at the top even with inset:0, because the page was never
  // allowed to draw there in the first place.
  viewportFit: "cover",
};

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
        {/* React 19 hoists these into <head> regardless of where they render - used for
            the "MarutiBit" wordmark (header + home hero), which switched from a serif
            fallback stack to Inter. The next/next/no-page-custom-font rule assumes the
            Pages Router, where a <link> outside _document.js only loads on one route;
            here this is the root layout, so it's already applied to every route. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800&display=swap" />
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
