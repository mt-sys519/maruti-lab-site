import type { ReactNode } from "react";
import "./aogane.css";

/**
 * Everything under /aogane except the game itself, which is a static page
 * at /aogane/play/ (public/aogane/play, copied in by
 * scripts/sync-aogane.mjs) because it needs pointer lock, full screen and
 * the camera, and an iframe would stand between it and all three.
 *
 * AOGANE is not a MarutiBit game and does not wear the shelf's clothes:
 * dark, thin lines, the HMD's off-white.
 */
export default function AoganeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="hfSkin">
      <header className="hfHeader">
        <a className="hfBrand" href="/aogane" aria-label="蒼鉄 -AOGANE- トップ">
          <span>
            蒼鉄 -AOGANE-
            <small>by Maruti Lab</small>
          </span>
        </a>
        <nav aria-label="ページナビゲーション">
          <a href="/aogane#controls">操作</a>
          <a href="/aogane#camera">カメラについて</a>
        </nav>
      </header>
      {children}
    </div>
  );
}
