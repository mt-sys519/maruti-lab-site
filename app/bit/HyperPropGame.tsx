"use client";

import { useEffect, useRef } from "react";
import { mountHyperProp } from "./hyperPropEngine.js";

// The handheld's markup. Everything that moves - the canvas, the sub display, the
// sound switch, the buttons - is driven by hyperPropEngine.js, which finds its parts
// by data-hp / data-k and hands back a cleanup for when the page goes away.
export function HyperPropGame() {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!stage.current) return;
    return mountHyperProp(stage.current);
  }, []);

  return (
    <div className="hpStage" ref={stage}>
      <div className="hpDevice">
        <span className="hpScrew" style={{ left: 9, top: 32 }} />
        <span className="hpScrew" style={{ right: 9, top: 32 }} />
        <span className="hpScrew" style={{ left: 9, bottom: 16 }} />
        <div className="hpUpper">
          <div className="hpSeam">
            <button className="hpSwitch" data-hp="sound" type="button" aria-label="サウンド" aria-pressed="false">
              ◀ OFF<b />ON ▶
            </button>
          </div>
          <div className="hpBezel" data-hp="bezel">
            <span className="hpRule">PIXEL VISION</span>
            <span className="hpLed"><i />POWER</span>
            <div className="hpScreen" data-hp="wrap">
              <canvas data-hp="c" width={256} height={192} aria-label="HYPER PROP のゲーム画面" />
            </div>
          </div>
          <div className="hpPlate" aria-live="polite">
            <span data-hp="l1" />
            <span data-hp="l2" />
          </div>
        </div>
        <div className="hpLower">
          <div className="hpPad">
            <div className="hpRocker">
              <div className="hpRockerBody">
                <button className="hpBtn" data-k="up" type="button" aria-label="機首上げ／乗り込む">▲</button>
                <button className="hpBtn" data-k="down" type="button" aria-label="機首下げ">▼</button>
              </div>
              <span className="hpCap" data-hp="upCap">PITCH</span>
            </div>
            <div className="hpPedals">
              <div className="hpPbox">
                <button className="hpBtn hpPedal" data-k="L" type="button" aria-label="ペダル左" />
                <span className="hpCap">PEDAL</span>
              </div>
              <div className="hpPbox">
                <button className="hpBtn hpPedal" data-k="R" type="button" aria-label="ペダル右" />
                <span className="hpCap">PEDAL</span>
              </div>
            </div>
          </div>
          <div className="hpFoot">
            <div className="hpStartBox">
              <button className="hpBtn hpStart" data-k="start" type="button" aria-label="スタート" />
              <span className="hpCap">START</span>
            </div>
            <div className="hpSpeaker" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
