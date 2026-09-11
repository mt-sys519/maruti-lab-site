/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires document navigation for local routes */
import type { Metadata } from "next";
import content from "../faqContent.json";
import styles from "../SwiftCropPage.module.css";

const title = "SwiftCropのよくある質問";
const description =
  "SwiftCropの使い方、対応形式、画像がどこで処理されるか、AI学習用データセットの書き出し、うまくいかないときの確認手順をまとめました。";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://marutilab.com/swiftcrop/faq" },
};

export default function SwiftCropFaqPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.groups.flatMap((group) =>
      group.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
        },
      })),
    ),
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
          <a href="/swiftcrop">SwiftCropを使う</a>
          <a href="/blog/browser-only">なぜ送らないのか</a>
          <a href="/">Works</a>
        </nav>
      </header>

      <section className={styles.intro} aria-labelledby="faq-title">
        <p className={styles.kicker}>SWIFTCROP / GUIDE &amp; FAQ</p>
        <h1 id="faq-title" className={styles.faqTitle}>画像作業で迷ったときに。</h1>
        <p className={styles.sub}>
          はじめ方から保存、プライバシー、用途別の使い方、AI学習用データセットまで、SwiftCropを安心して使うための情報をまとめました。
        </p>
        <nav className={styles.toc} aria-label="目次">
          {content.groups.map((group) => (
            <a key={group.name} href={`#${encodeURIComponent(group.name)}`}>
              {group.name}
            </a>
          ))}
          <a href="#usecases">用途別の使い方</a>
        </nav>
      </section>

      <div className={styles.faqBody}>
        {content.groups.map((group) => (
          <section key={group.name} id={group.name} className={styles.faqGroup}>
            <h2>{group.name}</h2>
            <dl>
              {group.items.map((item) => (
                <div key={item.q}>
                  <dt>{item.q}</dt>
                  <dd dangerouslySetInnerHTML={{ __html: item.a }} />
                </div>
              ))}
            </dl>
          </section>
        ))}
        <section id="usecases" className={styles.faqGroup}>
          <h2>用途別の使い方</h2>
          <dl>
            {content.cases.map((useCase) => (
              <div key={useCase.t}>
                <dt>{useCase.t}</dt>
                <dd>{useCase.p}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className={styles.faqGroup}>
          <h2>まだ解決しないときは</h2>
          <dl>
            <div>
              <dt>問い合わせ</dt>
              <dd>
                <p>
                  ここに載っていないことや、うまく動かない状況があれば<a href="/contact">お問い合わせフォーム</a>からお知らせください。お使いの端末とブラウザ、どの操作で止まったかを書いていただけると、こちらで再現しやすくなります。
                </p>
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <footer>
        <div className="footerBrand">Maruti Lab</div>
        <div className="footerLinks"><a href="/swiftcrop">SwiftCrop</a><a href="/">Works</a><a href="/bit">MarutiBit</a><a href="/blog">ノート</a><a href="/about">About</a><a href="/contact">Contact</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/disclaimer">Disclaimer</a></div>
        <small>© 2026 Maruti Lab</small>
      </footer>
    </main>
  );
}
