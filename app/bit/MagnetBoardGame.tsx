"use client";

import { useEffect, useRef } from "react";
import { mountMagnetBoard } from "./magnetBoardEngine.js";

const FRAME_COLORS = [
  { color: "#e4473c", label: "あか" },
  { color: "#2f7fd8", label: "あお" },
  { color: "#f0b72c", label: "きいろ" },
];

const MODES = [
  { mode: "free", label: "じゆう" },
  { mode: "hira", label: "あいう" },
  { mode: "math", label: "1+2" },
  { mode: "shape", label: "○△" },
];

// The board's markup. Everything that moves - the screen, the eraser knob, the
// pen width, the practice sheets and the kana picker - is driven by
// magnetBoardEngine.js, which finds its parts by data-mb and hands back a
// cleanup for when the page goes away.
export function MagnetBoardGame() {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!stage.current) return;
    return mountMagnetBoard(stage.current);
  }, []);

  return (
    <div className="mbPanel">
      <div className="mbStage" ref={stage}>
        <div className="mbFrame">
          <div className="mbTop">
            <span className="mbLogo">MAGNET BOARD</span>
            <div className="mbControls">
              {FRAME_COLORS.map(({ color, label }) => (
                <button
                  key={color}
                  className="mbDot"
                  type="button"
                  data-mb-color={color}
                  style={{ background: color }}
                  aria-label={label}
                  aria-pressed="false"
                />
              ))}
              <button className="mbSound" data-mb="sound" type="button" aria-label="サウンド" aria-pressed="false">
                <svg className="mbSoundOn" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M2 6h3l4-3v10L5 10H2z" />
                  <path d="M11 5.2a4 4 0 0 1 0 5.6M12.8 3.5a6.4 6.4 0 0 1 0 9" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                </svg>
                <svg className="mbSoundOff" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M2 6h3l4-3v10L5 10H2z" />
                  <path d="M11 6l4 4M15 6l-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
          <div className="mbScreen" data-mb="screen">
            <canvas data-mb="board" aria-label="MAGNET BOARD のお絵かき画面" />
          </div>
          <div className="mbSlider" data-mb="slider">
            <div className="mbGroove" />
            <div className="mbArrow" aria-hidden="true">◀ けす ▶</div>
            <div
              className="mbKnob"
              data-mb="knob"
              role="slider"
              tabIndex={0}
              aria-label="けす"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={0}
            >
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>
        <div className="mbBottom" data-mb="bottom">
          <div className="mbTray">
            <span className="mbEnd" style={{ width: 3, height: 3 }} />
            <input className="mbWidth" data-mb="width" type="range" min="1.2" max="4.6" step="0.05" defaultValue="3.2" aria-label="ペンのふとさ" />
            <span className="mbEnd" style={{ width: 9, height: 9 }} />
          </div>
          <div className="mbLesson">
            {MODES.map(({ mode, label }) => (
              <button key={mode} className="mbMode" type="button" data-mb-mode={mode} aria-pressed={mode === "free"}>
                {label}
              </button>
            ))}
            <button className="mbNext" data-mb="next" type="button" disabled>
              つぎ
            </button>
          </div>
          <div className="mbKanaWrap" data-mb="kana" hidden>
            <div className="mbKana">
              <div className="mbGyou" data-mb="gyou" />
              <div className="mbDan" data-mb="dan" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
