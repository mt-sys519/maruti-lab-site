/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */
import type { ReactNode } from "react";
import { AboutMark, BitMark, CoffeeMark, LabMark, NoteMark, ToolsMark } from "./icons";

/**
 * The bar across the top of the site. The mark and the name are the same
 * wherever it appears; the links are not, so a page that has its own set
 * passes them in and everything else gets the site's.
 *
 * The front page keeps its own copy because its Works and About links are
 * anchors into itself rather than journeys to another page.
 */
export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="siteHeader">
      <a className="brand" href="/" aria-label="Maruti Lab トップ">
        <span className="brandMark" aria-hidden="true">
          <LabMark />
        </span>
        <span>Maruti Lab</span>
      </a>
      <nav aria-label="ページナビゲーション">{children ?? <SiteNav />}</nav>
    </header>
  );
}

function SiteNav() {
  return (
    <>
      <a className="navWithMark" href="/#works">
        <span className="navIcon" aria-hidden="true"><ToolsMark /></span>
        道具たち
      </a>
      <a className="navWithMark" href="/bit">
        <span className="navIcon" aria-hidden="true"><BitMark /></span>
        MarutiBit
      </a>
      <a className="navWithMark" href="/blog">
        <span className="navIcon" aria-hidden="true"><NoteMark /></span>
        LabNote
      </a>
      <a className="navWithMark" href="/about">
        <span className="navIcon" aria-hidden="true"><AboutMark /></span>
        About
      </a>
      <a className="supportLink navWithMark" href="https://buymeacoffee.com/marutilab" target="_blank" rel="noreferrer">
        <span className="navIcon" aria-hidden="true"><CoffeeMark /></span>
        Coffee
      </a>
    </>
  );
}
