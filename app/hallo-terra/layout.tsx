import type { ReactNode } from "react";
import "./hallo-terra.css";
import TerraLogo from "./TerraLogo";

/**
 * Everything under /hallo-terra, under its own name the way every tool is now.
 * The drawn name is the bar itself - it used to sit in a band of its own
 * under a bar that said the same thing in type. The lab is one step away, in
 * the footer.
 */
export default function HalloTerraLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* React hoists this into <head>, and it only loads on these routes:
          the rounded face is for headings here, not for the whole lab. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700&display=swap"
      />
      <header className="siteHeader terraHeader">
        <a className="terraBrand" href="/hallo-terra" aria-label="HALLO TERRA トップ">
          <TerraLogo size="md" />
          <small>by Maruti Lab</small>
        </a>
        <nav aria-label="ページナビゲーション">
          <a href="/hallo-terra#how">使い方</a>
          <a href="/hallo-terra/credits">クレジット</a>
        </nav>
      </header>
      <div className="terraSkin">{children}</div>
    </>
  );
}
