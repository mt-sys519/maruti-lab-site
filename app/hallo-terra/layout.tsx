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
      {children}
    </>
  );
}
