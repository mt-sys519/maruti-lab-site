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

/**
 * The name at the top left of a tool's own pages. A tool is its own front
 * door, the way PICLEA is: the name leads back to the tool, not to the lab,
 * and the lab signs underneath and is reached from the footer.
 *
 * Only the link is shared - each tool keeps its own bar and its own links, so
 * the classes can be swapped for a page that styles its header itself.
 */
export function ToolBrand({
  name,
  href,
  mark,
  className = "brand",
  markClassName = "brandMark",
}: {
  name: string;
  href: string;
  mark: ReactNode;
  className?: string;
  markClassName?: string;
}) {
  return (
    <a className={className} href={href} aria-label={`${name} トップ`}>
      <span className={markClassName} aria-hidden="true">
        {mark}
      </span>
      <span className="toolBrandName">
        {name}
        <small>by Maruti Lab</small>
      </span>
    </a>
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
