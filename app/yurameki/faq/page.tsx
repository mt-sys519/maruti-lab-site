import type { Metadata } from "next";
import { InfoPage } from "../info-shell";
export const metadata:Metadata={title:"よくある質問",description:"YURAMEKIの画像処理、権利、対応形式、書き出しに関するよくある質問。",alternates:{canonical:"/yurameki/faq"}};
const faq=[
 ["選んだ画像はアップロードされますか？","いいえ。選択・貼り付け・ドロップした画像の加工と書き出しは、お使いのブラウザ内で行われます。Maruti Labのサーバーへ画像ファイルを送信・保存する処理はありません。"],
 ["他人のイラストや写真を使えますか？","著作権者などから、加工と目的とする利用について必要な許可を得ている場合に限り使用してください。閲覧や保存ができることと、加工・公開・販売できることは別です。"],
 ["SNSで見つけた画像を加工できますか？","SNSで公開されていても、自由な加工や再公開が許可されているとは限りません。投稿者が権利者とも限らないため、権利者と利用条件を確認してください。"],
 ["人物写真で注意することはありますか？","撮影者の著作権に加え、写っている方の肖像権、プライバシー、パブリシティ権などに配慮し、必要な同意を得てください。"],
 ["作ったGIFやWebPを公開・販売できますか？","元画像について、加工だけでなく公開、公衆送信、配布、販売など目的に応じた権利や許諾がある場合に限ります。YURAMEKIの利用は、元画像に関する許諾を与えるものではありません。"],
 ["AIで生成した画像を使えますか？","利用した生成サービスの規約を確認し、既存作品や第三者の権利を侵害しないことを確認してください。AI生成であることだけを理由に安全性や権利が保証されるわけではありません。"],
 ["どの形式で保存できますか？","GIF、APNG、アニメーションWebPに対応しています。投稿先によって対応形式が異なるため、公開先の仕様もご確認ください。"],
 ["1080書き出しは何が違いますか？","元画像がある場合、プレビュー画像を単純に拡大せず、元画像を使って1080×1080で生成します。端末によっては処理に時間がかかります。"],
];
export default function FAQ(){const data={"@context":"https://schema.org","@type":"FAQPage",mainEntity:faq.map(([name,text])=>({"@type":"Question",name,acceptedAnswer:{"@type":"Answer",text}}))};return <InfoPage eyebrow="FAQ" title="よくある質問" lead="作品を安心して動かすための、短い確認事項です。"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(data).replace(/</g,"\\u003c")}}/><div className="faqList">{faq.map(([question,answer],index)=><details key={question} open={index===0}><summary>{question}</summary><p>{answer}</p></details>)}</div></InfoPage>}
