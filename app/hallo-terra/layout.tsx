/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */
import type { ReactNode } from "react";
import "./hallo-terra.css";
import { LabMark } from "../icons";

/**
 * Everything under /hallo-terra, with the lab's header above it: the map is a
 * room in this house and not a separate site.
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
      <header className="siteHeader">
        <a className="brand" href="/" aria-label="Maruti Lab トップ">
          <span className="brandMark" aria-hidden="true">
            <LabMark />
          </span>
          <span>Maruti Lab</span>
        </a>
        <nav aria-label="ページナビゲーション">
          <a href="/">Works</a>
        </nav>
      </header>
      <div className="terraSkin">{children}</div>
    </>
  );
}
