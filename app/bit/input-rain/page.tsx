import type { Metadata } from "next";
import { BitFooter } from "../BitFooter";
import { BitHeader } from "../BitHeader";
import { BitSeriesNav } from "../BitSeriesNav";
import { InputRainGame } from "../InputRainGame";

export const metadata: Metadata = {
  title: "MarutiBit — INPUT RAIN",
  description: "PromptTermの端末入力を、文字が落ちきる前に打ち込むタイピングゲーム。初級・中級・上級の3段階。",
  alternates: { canonical: "/bit/input-rain" },
  openGraph: {
    title: "MarutiBit — INPUT RAIN",
    description: "落下する端末入力を処理する、PromptTermタイピングゲーム。",
    url: "/bit/input-rain",
    images: [{ url: "/og/bit/input-rain.png", width: 1200, height: 630, alt: "MarutiBit INPUT RAIN" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MarutiBit — INPUT RAIN",
    description: "落下する端末入力を処理する、PromptTermタイピングゲーム。",
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
        <p><strong>落下する端末入力を処理。</strong><br />届いた文字列を、消える前に入力する。</p>
      </section>
      <InputRainGame />
      <BitFooter label="MARUTIBIT / GAME 004" />
    </main>
  );
}
