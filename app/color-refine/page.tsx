/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires document navigation for local routes */
import type { Metadata } from "next";
import styles from "../swiftcrop/SwiftCropPage.module.css";
import { SiteFooter } from "../SiteFooter";

const title = "COLOR RE:FINE";
const description =
  "白黒写真に、もう一度、あの日の色を。AIモデルを端末へ読み込んで、写真を送らずにカラー化するブラウザツール。";

const features = [
  {
    label: "端末の中でカラー化",
    copy: "写真はサーバーへ送られません。AIモデルのほうを端末へ読み込み、計算はブラウザの中で行います。カラー化した写真が外に出るのは、あなたが保存したときだけです。",
  },
  {
    label: "初回だけ約215MBの読み込み",
    copy: "使うAIモデルが約215MBあり、初回はこれをダウンロードします。20MBずつ11個に分けて配っているので、途中の進み具合が見えます。2回目以降はブラウザに残ったものが使われます。",
  },
  {
    label: "色味の調整",
    copy: "カラー化したあと、プリセットで色の傾向を変えられます。元の白黒写真が上書きされることはありません。",
  },
  {
    label: "向いている写真",
    copy: "人物や風景の入った、ふつうの白黒写真に向いています。AIが推測して色を置くので、実際にその色だったとは限りません。資料として正確さが要る用途には向きません。",
  },
];

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://marutilab.com/color-refine" },
  openGraph: {
    type: "website",
    url: "https://marutilab.com/color-refine",
    title: `${title} | Maruti Lab`,
    description,
  },
};

export default function ColorRefinePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: title,
    url: "https://marutilab.com/color-refine",
    description,
    applicationCategory: "MultimediaApplication",
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
      <header className="siteHeader">
        <a className="brand" href="/" aria-label="Maruti Lab トップ">
          <span className="brandMark" aria-hidden="true">
            <svg viewBox="0 0 18 18" focusable="false"><path d="M3 8.6 9 3.2l6 5.4" /><path d="M4.6 7.3V15h8.8V7.3" /><path d="M7.3 15v-4.3h3.4V15" /></svg>
          </span>
          <span>Maruti Lab</span>
        </a>
        <nav aria-label="ページナビゲーション">
          <a href="#guide">使い方</a>
          <a href="/color-refine/help">よくある質問</a>
          <a href="/blog/browser-only">なぜ送らないのか</a>
        </nav>
      </header>

      <section className={styles.intro} aria-labelledby="cr-title">
        <p className={styles.kicker}>MARUTI LAB / BROWSER TOOL</p>
        <h1 id="cr-title">COLOR RE:FINE</h1>
        <p className={styles.lead}>
          白黒写真に、もう一度、<br />あの日の色を。
        </p>
        <p className={styles.sub}>
          色を推測するAIモデルを、あなたの端末へ読み込んで動かします。写真のほうは、どこへも送りません。
        </p>
        <p className={styles.badges}>
          <span>完全無料</span>
          <span>登録不要</span>
          <span>アップロードなし</span>
        </p>
      </section>

      <section className={styles.toolSection} aria-label="COLOR RE:FINE 本体">
        <div className={styles.toolBar}>
          <span>COLOR RE:FINE / READY</span>
          <a href="/color-refine-app/index.html" target="_blank" rel="noreferrer">大きな画面で開く</a>
        </div>
        <iframe className={styles.frame} src="/color-refine-app/index.html" title="COLOR RE:FINE" loading="lazy" />
      </section>

      <section className={styles.guide} id="guide" aria-labelledby="cr-guide-title">
        <div className={styles.guideHead}>
          <p className={styles.kicker}>HOW TO USE</p>
          <h2 id="cr-guide-title">使い方</h2>
          <p>
            白黒写真を選ぶと、AIモデルの読み込みが始まります。初回は215MBあるので、通信環境によっては数分かかります。読み込みが終われば、あとは写真を選ぶたびにすぐ色がつきます。
          </p>
        </div>
        <ol className={styles.steps}>
          <li>
            <b>写真を選ぶ</b>
            <p>白黒またはセピアの写真を読み込みます。ドラッグ＆ドロップでも、ファイル選択でも構いません。</p>
          </li>
          <li>
            <b>モデルの読み込みを待つ</b>
            <p>初回だけ約215MBを読み込みます。2回目以降はブラウザに残ったものが使われるので、待ち時間はありません。</p>
          </li>
          <li>
            <b>色味を整えて保存する</b>
            <p>プリセットで色の傾向を変えられます。元の写真はそのまま残ります。</p>
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
          <h3>写真はどこにも送られません</h3>
          <p>
            ふつう、この手の処理はサーバーで行います。そのほうが速いからです。COLOR RE:FINEは逆に、モデルのほうを端末へ届けて動かしています。215MBを配るという手間は、そのためのものです。
          </p>
          <p>
            なぜそう作っているのかは、<a href="/blog/browser-only">LabNoteに書きました</a>。
          </p>
        </div>
        <p className={styles.faqLink}>
          AIモデルの保存先と消し方、対応ブラウザ、うまくいかないときの確認手順は
          <a href="/color-refine/help">よくある質問</a>に、利用しているモデルとソフトウェアの権利表示は
          <a href="/color-refine/licenses">第三者ライセンス</a>にまとめてあります。
        </p>
      </section>

      <SiteFooter extra={[{ href: "/color-refine/licenses", label: "Licenses" }]} />
    </main>
  );
}
