import type { Metadata } from "next";
import { InfoPage } from "../info-shell";
import { supportUrl } from "../site-links";

export const metadata:Metadata={title:"YURAMEKIについて",description:"YURAMEKIとMaruti Labが大切にしている、静止画へささやかな動きを宿すための考え方。",alternates:{canonical:"/yurameki/about"}};

export default function About(){return <InfoPage eyebrow="ABOUT YURAMEKI" title="動かしすぎない、という選択。" lead="YURAMEKIは、一枚の絵がもともと持っている気配を見つけ、ほんの少しだけ時間を渡すための道具です。"><section><h2>A Quiet Motion Studio</h2><p>呼吸、たなびき、ゆらぎ。日本語には、形を断定せず、移ろいの途中を受けとめる言葉があります。YURAMEKIでは、その言葉を翻訳で消さず、初めて触れる人にも感覚から覚えてもらえる設計を目指しています。</p></section><section><h2>絵が主役であり続けること</h2><p>操作画面は作品の前へ出ず、選ばれた画像と動きが中心に残ること。和紙の余白、墨の静けさ、和菓子のような繊細さを、現代のブラウザ上で扱える形へ整えています。</p><p><a href="/yurameki/gallery">現在の作例を見る</a></p></section><section><h2>Maruti Lab</h2><p>YURAMEKIは、静かで実用的なデジタル道具をつくるMaruti Labのプロジェクトです。制作画像を外部へ送らず、端末の中で扱えることを大切にしています。</p></section><section className="supportCallout"><h2>静かな道具を、育てていく。</h2><p>支援は任意です。YURAMEKIの利用機能や書き出し品質が、支援の有無によって変わることはありません。</p>{supportUrl?<a className="backToStudio" href={supportUrl} target="_blank" rel="noreferrer">Buy Me a Coffeeで支援する ↗</a>:<p className="policyDate">支援ページは準備中です。</p>}</section></InfoPage>}
