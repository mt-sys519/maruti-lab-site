/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./yurameki.css";
import { LabMark } from "../icons";

// YURAMEKI's own tab icon (the rose disc with its two ripples, from the tool's own site)
// instead of the lab's bottle; the header keeps the lab's mark.
export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/yurameki/icon.svg", type: "image/svg+xml" },
      { url: "/yurameki/icon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/yurameki/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

/**
 * Everything under /yurameki, with the lab's own header above it and
 * YURAMEKI's stylesheet held inside the wrapper below.
 *
 * The header sits outside that wrapper on purpose: YURAMEKI names a `.brand`
 * and an `.eyebrow` of its own, and so does this site. Keeping the header out
 * of the scope is what stops one from dressing the other.
 */
export default function YuramekiLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="siteHeader">
        <a className="brand" href="/" aria-label="Maruti Lab トップ">
          <span className="brandMark" aria-hidden="true">
            <LabMark />
          </span>
          <span>Maruti Lab</span>
        </a>
        <nav aria-label="ページナビゲーション">
          <a href="/yurameki/about">YURAMEKIについて</a>
          <a href="/yurameki/gallery">動きのサンプル</a>
          <a href="/yurameki/faq">よくある質問</a>
          <a href="/">Works</a>
        </nav>
      </header>
      <div className="yuramekiPage">{children}</div>
    </>
  );
}
