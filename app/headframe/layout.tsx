import type { ReactNode } from "react";
import "./headframe.css";

/**
 * Everything under /headframe except the game itself, which is a static page
 * at /headframe/play/ (public/headframe/play, copied in by
 * scripts/sync-headframe.mjs) because it needs pointer lock, full screen and
 * the camera, and an iframe would stand between it and all three.
 *
 * HEADFRAME is not a MarutiBit game and does not wear the shelf's clothes:
 * dark, thin lines, the HMD's off-white.
 */
export default function HeadframeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="hfSkin">
      <header className="hfHeader">
        <a className="hfBrand" href="/headframe" aria-label="HEADFRAME トップ">
          <span className="hfMark" aria-hidden="true">HF</span>
          <span>
            HEADFRAME
            <small>by Maruti Lab</small>
          </span>
        </a>
        <nav aria-label="ページナビゲーション">
          <a href="/headframe#controls">操作</a>
          <a href="/headframe#camera">カメラについて</a>
        </nav>
      </header>
      {children}
    </div>
  );
}
