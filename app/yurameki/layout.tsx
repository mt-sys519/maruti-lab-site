/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */
import type { ReactNode } from "react";
import "./yurameki.css";
import { LabMark } from "../icons";

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
