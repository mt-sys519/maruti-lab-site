import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { SequenceGame } from "../SequenceGame";
import { BitFooter } from "../BitFooter";
import { BitHeader } from "../BitHeader";
import { BitSeriesNav } from "../BitSeriesNav";

export const metadata: Metadata = {
  title: "MarutiBit — SEQUENCE（順番推理ゲーム）",
  description: "数の並びに隠れた規則を見抜く順番推理ゲーム。全5問の数列パズル、初級・中級・上級の3段階。",
  alternates: { canonical: "/bit/sequence" },
  openGraph: {
    title: "MarutiBit — SEQUENCE（順番推理ゲーム）", description: "数の並びに隠れた規則を見抜く順番推理ゲーム。全5問の数列パズル。", url: "/bit/sequence",
    images: [
      { url: "/og/bit/sequence.png", width: 1200, height: 630, alt: "MarutiBit SEQUENCE" },
      { url: "/og/bit/sequence-square.png", width: 630, height: 630, alt: "MarutiBit SEQUENCE" },
    ],
  },
  twitter: { card: "summary_large_image", title: "MarutiBit — SEQUENCE（順番推理ゲーム）", description: "数の並びに隠れた規則を見抜く順番推理ゲーム。全5問の数列パズル。", images: ["/og/bit/sequence.png"] },
};

export default function SequencePage() {
  return (
    <main className="bitPage" style={{ "--pkg-color": "#7B8CDE" } as CSSProperties}>
      <BitHeader current="SEQUENCE" />
      <BitSeriesNav active="sequence" />
      <section className="bitIntro bitSequenceIntro">
        <p className="bitSerial">MB / GAME 003</p>
        <h1>
          <svg className="bitSequenceLogo" viewBox="0 0 72 64" aria-hidden="true" focusable="false">
            <path d="M17 42.6 32 33.4M40 28.6 55 19.4M9 56h12" />
            <circle cx="13" cy="45" r="4" /><circle cx="36" cy="31" r="4" /><circle cx="59" cy="17" r="4" />
          </svg>
          <span>SEQUENCE</span>
        </h1>
        <p><strong>順番推理ゲーム。</strong><br />数の並びに隠れた規則を見つけて「？」を求める、全5問のミニゲーム。</p>
      </section>
      <SequenceGame />
      <BitFooter label="MARUTIBIT / GAME 003" />
    </main>
  );
}
