"use client";

import { createPortal } from "react-dom";

type GamePauseOverlayProps = {
  active: boolean;
  onResume: () => void;
  onRestart?: () => void;
  onQuit?: () => void;
};

export function GamePauseOverlay({ active, onResume, onRestart, onQuit }: GamePauseOverlayProps) {
  if (!active || typeof document === "undefined") return null;

  // Portalled straight to <body>: some mobile browsers (notably iOS Safari) still clip a
  // position:fixed descendant to an ancestor's overflow:hidden box, which left this panel
  // stuck inside .inputRainTerminal's clipped bounds instead of covering the screen.
  return createPortal(
    <div className="bitPauseOverlay" role="dialog" aria-modal="true" aria-labelledby="bit-pause-title">
      <div className="bitPausePanel">
        <p>GAME SUSPENDED</p>
        <h2 id="bit-pause-title">PAUSED</h2>
        <span>BGMとタイマーを停止しています。</span>
        <div className="bitPauseActions">
          <button type="button" onClick={onResume}>続ける</button>
          {onRestart && <button type="button" className="isSecondary" onClick={onRestart}>最初から</button>}
          {onQuit && <button type="button" className="isSecondary" onClick={onQuit}>難易度選択へ</button>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
