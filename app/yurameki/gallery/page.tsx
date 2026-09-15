import type { Metadata } from "next";
import { InfoPage } from "../info-shell";

export const metadata:Metadata={title:"動きのサンプル｜呼吸",description:"YURAMEKIで実際に書き出した1080のMP4。囲んだところだけが動き、それ以外は止まったままであることを見られます。",alternates:{canonical:"/yurameki/gallery"}};

/* The page called these 作例 and showed the same still twice, which was the
   old site's plan for artwork that never arrived. They are samples of what the
   tool does, so one real export stands here instead - the poster is the frame
   the studio starts from, and the video is that same frame with two ranges
   breathing in it. The other three motions follow when they are made. */
export default function Gallery(){return <InfoPage eyebrow="MOTION SAMPLES" title="動きのサンプル" lead="YURAMEKIで書き出したものです。囲んだところだけが動き、ほかは止まったままです。"><div className="studyGrid studyGridSingle"><article><div className="studyImage"><video src="/yurameki/sample-breath.mp4" poster="/yurameki/demo-breath.webp" autoPlay muted loop playsInline preload="metadata" aria-label="女性と黒猫の絵に呼吸の動きをつけたYURAMEKIのサンプル"/></div><p className="eyebrow">01 — 呼吸 / KOKYŪ</p><h2>人物と猫に、静かな満ち引きを。</h2><p>胸元と猫の胴体を別々の範囲として選び、わずかに異なる間で呼吸させています。1080のMP4として書き出したものをそのまま置いています。</p></article><article className="studyBlank"><span>YOUR IMAGE</span><h2>次の景色は、あなたの一枚から。</h2><p>画像を置き、動かしたい場所を囲むだけで、同じものをつくれます。</p><a className="backToStudio" href="/yurameki">制作画面をひらく</a></article></div><p className="galleryNote">使っている絵はYURAMEKIのオリジナルDEMOです。たなびき・灯り・波紋のサンプルは準備中です。</p></InfoPage>}
