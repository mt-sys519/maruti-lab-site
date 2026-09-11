/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires document navigation for local routes */
import type { Metadata } from "next";
import content from "../crContent.json";
import styles from "../../swiftcrop/SwiftCropPage.module.css";

const title = "COLOR RE:FINEのよくある質問";
const description =
  "写真が送信されないこと、初回に読み込む約215MBのAIモデルの扱い、端末からの削除方法、対応ブラウザ、うまくいかないときの確認手順をまとめました。";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://marutilab.com/color-refine/help" },
};

export default function ColorRefineHelpPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.help.flatMap((group) =>
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
          <a href="/color-refine">カラー化を使う</a>
          <a href="/color-refine/licenses">第三者ライセンス</a>
          <a href="/">Works</a>
        </nav>
      </header>

      <section className={styles.intro} aria-labelledby="cr-help-title">
        <p className={styles.kicker}>COLOR RE:FINE / HELP &amp; FAQ</p>
        <h1 id="cr-help-title" className={styles.faqTitle}>よくある質問</h1>
        <p className={styles.sub}>{description}</p>
        <nav className={styles.toc} aria-label="目次">
          {content.help.map((group) => (
            <a key={group.name} href={`#${encodeURIComponent(group.name)}`}>{group.name}</a>
          ))}
        </nav>
      </section>

      <div className={styles.faqBody}>
        {content.help.map((group) => (
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
        <section className={styles.faqGroup}>
          <h2>まだ解決しないときは</h2>
          <dl>
            <div>
              <dt>問い合わせ</dt>
              <dd>
                <p>
                  ここに載っていないことがあれば<a href="/contact">お問い合わせフォーム</a>からお知らせください。お使いの端末とブラウザ、どの段階で止まったかを書いていただけると助かります。
                </p>
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <footer>
        <div className="footerBrand">Maruti Lab</div>
        <div className="footerLinks"><a href="/color-refine">COLOR RE:FINE</a><a href="/">Works</a><a href="/blog">ノート</a><a href="/about">About</a><a href="/contact">Contact</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/color-refine/licenses">Licenses</a></div>
        <small>© 2026 Maruti Lab</small>
      </footer>
    </main>
  );
}
