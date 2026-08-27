import type { Metadata } from "next";
import { BitFooter } from "../BitFooter";
import { BitHeader } from "../BitHeader";
import { BitSeriesNav } from "../BitSeriesNav";
import { InputRainGame } from "../InputRainGame";

export const metadata: Metadata = {
  title: "MarutiBit — INPUT RAIN（タイピング／フリック入力ゲーム）",
  description: "PromptTermの端末入力を、文字が落ちきる前に打ち込むタイピング／フリック入力ゲーム。初級・中級・上級・PROの4段階。",
  alternates: { canonical: "/bit/input-rain" },
  openGraph: {
    title: "MarutiBit — INPUT RAIN（タイピング／フリック入力ゲーム）",
    description: "落下する端末入力を処理する、PromptTermのタイピング／フリック入力ゲーム。",
    url: "/bit/input-rain",
    images: [{ url: "/og/bit/input-rain.png", width: 1200, height: 630, alt: "MarutiBit INPUT RAIN" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MarutiBit — INPUT RAIN（タイピング／フリック入力ゲーム）",
    description: "落下する端末入力を処理する、PromptTermのタイピング／フリック入力ゲーム。",
    images: ["/og/bit/input-rain.png"],
  },
};

export default function InputRainPage() {
  return (
    <main className="bitPage">
      <BitHeader current="INPUT RAIN" />
      <BitSeriesNav active="input-rain" />
      <section className="bitIntro inputRainIntro">
        <p className="bitSerial">MB / GAME 004</p>
        <h1>
          <span className="inputRainTitleMark" aria-hidden="true"><i /><i /><i /></span>
          <span>INPUT RAIN</span>
        </h1>
        <p><strong>タイピング／フリック入力ゲーム。</strong><br />落下する端末入力を、消える前に入力する。</p>
      </section>
      <InputRainGame />
      <BitFooter label="MARUTIBIT / GAME 004" />
    </main>
  );
}
