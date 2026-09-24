"use client";

import { useEffect, useRef } from "react";
import { mountHyperProp } from "./hyperPropEngine.js";

// The handheld's markup. Everything that moves - the canvas, the sub display, the
// sound switch, the buttons - is driven by hyperPropEngine.js, which finds its parts
// by data-hp / data-k and hands back a cleanup for when the page goes away.
// lang drives the words on the sub display and the buttons' labels; the engine reads it
// from data-lang, so switching needs no remount.
export function HyperPropGame({ lang = "ja" }: { lang?: "ja" | "en" }) {
  const stage = useRef<HTMLDivElement>(null);
  const en = lang === "en";

  useEffect(() => {
    if (!stage.current) return;
    return mountHyperProp(stage.current);
  }, []);

  return (
    <div className="hpStage" ref={stage} data-lang={lang}>
      <div className="hpDevice">
        <span className="hpScrew" style={{ left: 9, top: 32 }} />
        <span className="hpScrew" style={{ right: 9, top: 32 }} />
        <span className="hpScrew" style={{ left: 9, bottom: 16 }} />
        <div className="hpUpper">
          <div className="hpSeam">
            {/* The sound switch, moulded into the seam. The speaker is the same mark every
                MarutiBit sound switch wears: waves while on, the cone alone while off. */}
            <button className="hpSwitch" data-hp="sound" type="button" aria-label={en ? "Sound" : "サウンド"} aria-pressed="false">
              <svg className="hpSoundMark" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                <path className="hpSoundCone" d="M1.5 4.5h2L6.2 2.2v7.6L3.5 7.5h-2z" />
                <path className="hpSoundWave" d="M8 4.4a2.5 2.5 0 0 1 0 3.2" />
                <path className="hpSoundWave" d="M9.7 3a4.6 4.6 0 0 1 0 6" />
              </svg>
              SOUND<span className="hpSwitchGap" />OFF<b />ON
            </button>
          </div>
          <div className="hpBezel" data-hp="bezel">
            <span className="hpRule">MB-01 RETRO</span>
            <span className="hpLed"><i />POWER</span>
            <div className="hpScreen" data-hp="wrap">
              <canvas data-hp="c" width={256} height={192} aria-label={en ? "HYPER PROP game screen" : "HYPER PROP のゲーム画面"} />
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
              <div className="hpWell hpRockerWell">
                <div className="hpRockerBody">
                  <button className="hpBtn" data-k="up" type="button" aria-label={en ? "Nose up / board" : "機首上げ／乗り込む"}>▲</button>
                  <button className="hpBtn" data-k="down" type="button" aria-label={en ? "Nose down" : "機首下げ"}>▼</button>
                </div>
              </div>
              <span className="hpCap">PITCH</span>
            </div>
            <div className="hpWell hpPedals">
              <div className="hpPbox">
                <button className="hpBtn hpPedal" data-k="L" type="button" aria-label={en ? "Pedal left" : "ペダル左"} />
                <span className="hpCap">PEDAL</span>
              </div>
              <div className="hpPbox">
                <button className="hpBtn hpPedal" data-k="R" type="button" aria-label={en ? "Pedal right" : "ペダル右"} />
                <span className="hpCap">PEDAL</span>
              </div>
            </div>
          </div>
          <div className="hpFoot">
            <div className="hpWell hpStartBox">
              <button className="hpBtn hpStart" data-k="start" type="button" aria-label={en ? "Start" : "スタート"} />
              <span className="hpCap">START</span>
            </div>
            <div className="hpSpeaker" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
