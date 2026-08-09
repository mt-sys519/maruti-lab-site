"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export function LabHero() {
  const hero = useRef<HTMLElement>(null);
  const [motionReady, setMotionReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMotionReady(true), 1550);
    return () => window.clearTimeout(timer);
  }, []);

  function trackPointer(event: React.PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--pointer-x", `${((event.clientX - rect.left) / rect.width) * 100}%`);
    event.currentTarget.style.setProperty("--pointer-y", `${((event.clientY - rect.top) / rect.height) * 100}%`);
  }

  return (
    <section id="top" ref={hero} className="labHero" onPointerMove={trackPointer} aria-labelledby="lab-title">
      <div className="labRail" aria-hidden="true">
        <span>ML-00</span><span>2026</span><span>JPN</span>
      </div>
      <div className="labIntro">
        <p className="labKicker"><i /> MARUTI LAB / WORKS IN PROGRESS</p>
        <h1 id="lab-title"><span>画像を動かす。写真を整える。</span><br />色を戻す。時間を灯す。</h1>
        <p>ブラウザとデスクトップで動く、<br />小さな道具をつくる個人ラボです。</p>
        <a className="labEntry refinedLink" href="#yurameki"><span>現在の実験を見る</span></a>
      </div>
      <div className="specimenStage">
        <a className="specimenFrame" href="https://yurameki.tokyo/" target="_blank" rel="noreferrer" aria-label="YURAMEKIを開く">
          <Image className={`specimenStill ${motionReady ? "isScanned" : ""}`} src="/works/yurameki-breath.png" alt="" fill priority sizes="(max-width: 800px) 92vw, 52vw" aria-hidden="true" />
          {motionReady && <Image className="specimenMotion" src="/works/yurameki-breath.webp" alt="YURAMEKIによって静かに息づく、花魁と黒猫の作例" fill priority unoptimized sizes="(max-width: 800px) 92vw, 52vw" />}
          <span className="scanLine" aria-hidden="true" />
          <span className="focusCorner cornerA"/><span className="focusCorner cornerB"/><span className="focusCorner cornerC"/><span className="focusCorner cornerD"/>
        </a>
        <div className="specimenLabel"><span>PROJECT 001</span><strong>YURAMEKI / 呼吸</strong><span>LIVE PREVIEW</span></div>
        <div className="measure measureX" aria-hidden="true">0 / 10 / 20 / 30 / 40 / 50 / 60 / 70 / 80 / 90</div>
        <div className="measure measureY" aria-hidden="true">01 / 02 / 03 / 04 / 05 / 06 / 07</div>
      </div>
      <div className="labReadout" aria-label="稼働中の作品">
        <span>ACTIVE EXPERIMENTS</span><strong>05</strong><span>LOCAL / BROWSER / DESKTOP</span>
      </div>
    </section>
  );
}
