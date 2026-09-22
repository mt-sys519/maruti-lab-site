/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires document navigation for local routes */
import type { Metadata } from "next";
import styles from "./SwiftCropPage.module.css";
import { SiteFooter } from "../SiteFooter";
import { ToolScripts } from "./ToolScripts";
import { LabMark } from "../icons";
import appHtml from "../../public/swiftcrop-app/index.html?raw";

const title = "SwiftCrop";
const description =
  "画像を外へ送らずに、切り抜き・リサイズ・形式変換をまとめて。複数枚を同じ設定で処理して、1枚ずつでもZIPでも保存できるブラウザの画像ツール。";

/* The tool used to sit in an iframe, which meant none of it - not the heading,
 * not a word of the copy around it - was part of this page as far as anything
 * reading the page was concerned, and the document inside was a second URL
 * saying the same things as this one.
 *
 * So the markup comes from that same file, read at build time. One copy, still
 * served on its own at /swiftcrop-app/index.html, and now also the body of this
 * page. What is dropped is the parts a page cannot have twice: everything in
 * <head>, and the three <script> tags, which ToolScripts loads in their order -
 * markup injected this way never runs its own scripts.
 */
const toolMarkup = appHtml
  .slice(appHtml.indexOf(">", appHtml.indexOf("<body")) + 1, appHtml.lastIndexOf("</body>"))
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")
  .trim();

// Everything below is what the tool's own interface offers - no feature is
// described here that is not in the panel.
const features = [
  {
    label: "出力サイズ",
    copy: "幅と高さをpxで指定します。比率を固定しておけば、片方を変えるともう片方が追従します。1:1・16:9・9:16のほか、Instagramの1080×1080やOGPの1200×630といった用途別のサイズも選べます。一度使ったサイズは履歴に残ります。",
  },
  {
    label: "フォーマットと品質",
    copy: "JPEG・PNG・WebPへ変換できます。写真やSNS向けはJPEG、透明を残すならPNG、Webサイトに載せるならWebP。JPEGとWebPは品質をパーセントで調整できます。",
  },
  {
    label: "まとめて自動調整",
    copy: "顔や被写体が枠に収まりやすい位置へ、読み込んだ画像をまとめて寄せます。結果はあとから1枚ずつ手で直せます。位置調整はホイールとピンチでズーム、Shift＋ホイールで微調整、ダブルクリックで元に戻ります。",
  },
  {
    label: "保存方法",
    copy: "1枚ずつ保存・共有するか、ZIPでまとめて保存するかを選べます。スマートフォンは1枚ずつ、枚数が多いときはZIPが向いています。ファイル名は連番にでき、###の桁数がそのまま番号の桁数になります。",
  },
  {
    label: "AI学習用オプション",
    copy: "必要な場合だけ開くパネルです。画像と同じ名前のCaption TXTを生成し、Trigger wordやテンプレートを指定して、画像とテキストの対をZIPにまとめて書き出せます。使わなければ何も起きません。",
  },
];

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://marutilab.com/swiftcrop" },
  openGraph: {
    type: "website",
    url: "https://marutilab.com/swiftcrop",
    title: `${title} | Maruti Lab`,
    description,
  },
};

export default function SwiftCropPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: title,
    url: "https://marutilab.com/swiftcrop",
    description,
    applicationCategory: "DesignApplication",
    operatingSystem: "Web browser",
    offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
    creator: { "@type": "Organization", name: "Maruti Lab", url: "https://marutilab.com/" },
  };

  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {/* What the tool's own document loaded in its head. React hoists these,
          and the stylesheet only reaches the tool: every rule in it that used to
          address html, body or a bare element is scoped to .swiftcrop-app. */}
      {/* The rule is written for the Pages Router, where a <link> outside
          _document.js loads on one route only. That is the intent here: these
          three belong to the tool and to no other page on the site. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;600;700;800&display=swap"
      />
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
      />
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/swiftcrop-app/style.css?v=4.0.3-export-time" />

      <header className="siteHeader">
        <a className="brand" href="/" aria-label="Maruti Lab トップ">
          <span className="brandMark" aria-hidden="true">
            <LabMark />
          </span>
          <span>Maruti Lab</span>
        </a>
        <nav aria-label="ページナビゲーション">
          <a href="#guide">使い方</a>
          <a href="/swiftcrop/faq">よくある質問</a>
          <a href="/blog/browser-only">なぜ送らないのか</a>
          <a href="/">Works</a>
        </nav>
      </header>

      {/* The tool, and the page's only h1, which lives in its hero. */}
      <div className="swiftcrop-app" dangerouslySetInnerHTML={{ __html: toolMarkup }} />
      <ToolScripts />

      <section className={styles.guide} id="guide" aria-labelledby="guide-title">
        <div className={styles.guideHead}>
          <p className={styles.kicker}>HOW TO USE</p>
          <h2 id="guide-title">使い方</h2>
          <p>
            三手で終わります。画像を入れて、出したい形を決めて、保存する。設定は次に開いたときも残っているので、同じ作業を繰り返す日ほど楽になります。
          </p>
        </div>
        <ol className={styles.steps}>
          <li>
            <b>画像を追加する</b>
            <p>
              ドラッグ＆ドロップ、ファイル選択、Ctrl＋Vでのスクリーンショット貼り付けに対応しています。JPEG・PNG・WebPをまとめて入れられます。
            </p>
          </li>
          <li>
            <b>出したい形を決める</b>
            <p>
              サイズと比率、フォーマットと品質、ファイル名を指定します。「まとめて自動調整」を押すと、顔や被写体の位置に合わせて全体を寄せられます。
            </p>
          </li>
          <li>
            <b>保存する</b>
            <p>
              「画像を処理」のあと、1枚ずつ保存するかZIPでまとめて保存するかを選びます。処理も書き出しも、この端末の中で終わります。
            </p>
          </li>
        </ol>
        <dl className={styles.features}>
          {features.map((feature) => (
            <div key={feature.label}>
              <dt>{feature.label}</dt>
              <dd>{feature.copy}</dd>
            </div>
          ))}
        </dl>
        <div className={styles.note}>
          <h3>画像はどこにも送られません</h3>
          <p>
            SwiftCropは、読み込んだ画像をサーバーへ送りません。切り抜きも、リサイズも、形式の変換も、あなたのブラウザの中だけで実行されます。処理した画像が外に出るのは、あなたが保存したときだけです。
          </p>
          <p>
            なぜそう作っているのかは、<a href="/blog/browser-only">LabNoteに書きました</a>。
          </p>
        </div>
        <p className={styles.faqLink}>
          対応形式、保存の仕方、AI学習用データセットの書き出し、うまくいかないときの確認手順は
          <a href="/swiftcrop/faq">よくある質問</a>にまとめてあります。
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
