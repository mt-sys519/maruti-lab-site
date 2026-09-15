/* eslint-disable @next/next/no-img-element -- a single local artwork is intentionally cropped differently for each study */
import type { Metadata } from "next";
import { InfoPage } from "../info-shell";

export const metadata:Metadata={title:"作例",description:"YURAMEKIの呼吸とたなびきによる、静かな動きの作例。",alternates:{canonical:"/yurameki/gallery"}};

export default function Gallery(){return <InfoPage eyebrow="MOTION STUDIES" title="動きの余白。" lead="同じ一枚の絵でも、どこへ時間を渡すかで景色は変わります。"><div className="studyGrid"><article><div className="studyImage breathStudy"><img src="/yurameki/demo.png" alt="女性と黒猫のYURAMEKIデモ作品"/></div><p className="eyebrow">01 — 呼吸 / KOKYŪ</p><h2>人物と猫に、静かな満ち引きを。</h2><p>胸元と猫の胴体を別々の範囲として選び、わずかに異なる間で呼吸させています。</p></article><article><div className="studyImage flutterStudy"><img src="/yurameki/demo.png" alt="柳と桜を含むYURAMEKIデモ作品"/></div><p className="eyebrow">02 — たなびき / TANABIKI</p><h2>柳と桜へ、風の通り道を。</h2><p>人物には触れず、画面上部の柳と桜へ横方向のうねりを渡します。</p></article><article className="studyBlank"><span>YOUR IMAGE</span><h2>次の景色は、あなたの一枚から。</h2><p>画像を置き、動かしたい場所を囲むだけで、自分の作例をつくれます。</p><a className="backToStudio" href="/yurameki">制作画面をひらく</a></article></div><p className="galleryNote">掲載中の2例は、同じYURAMEKIオリジナルDEMOを使用しています。動きの違いを比較するための作例です。</p></InfoPage>}
