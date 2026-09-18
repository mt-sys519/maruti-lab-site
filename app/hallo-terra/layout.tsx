import type { ReactNode } from "react";
import "./hallo-terra.css";
import { SiteHeader } from "../SiteHeader";

/**
 * Everything under /hallo-terra, under the lab's own header with the lab's own
 * links - the map is a room in this house, and a room you cannot leave by the
 * usual doors does not feel like one.
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
      <SiteHeader />
      <div className="terraSkin">{children}</div>
    </>
  );
}
