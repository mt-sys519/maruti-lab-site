/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires document navigation for local routes */
import type { Metadata } from "next";
import styles from "./FourTrackPage.module.css";

const title = "4TRACK CASSETTE SAMPLER";
const description = "音を切る、並べる、録る。ブラウザだけで使える4トラック・カセットサンプラー。";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/4track" },
  openGraph: {
    type: "website",
    url: "/4track",
    title: `${title} | Maruti Lab`,
    description,
    images: [{ url: "/og/4track.png", width: 1200, height: 630, alt: "4TRACK CASSETTE SAMPLER" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} | Maruti Lab`,
    description,
    images: ["/og/4track.png"],
  },
};

export default function FourTrackPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: title,
    url: "https://marutilab.com/4track",
    description,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web browser",
    offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
    creator: { "@type": "Organization", name: "Maruti Lab", url: "https://marutilab.com/" },
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="Maruti Lab トップ">
          <span className={styles.brandMark} aria-hidden="true">
            <svg viewBox="0 0 18 18" focusable="false"><path d="M3 8.6 9 3.2l6 5.4" /><path d="M4.6 7.3V15h8.8V7.3" /><path d="M7.3 15v-4.3h3.4V15" /></svg>
          </span>
          <span>Maruti Lab</span>
        </a>
        <nav aria-label="ページナビゲーション">
          <a href="#guide">使い方</a>
          <a href="/privacy">Privacy</a>
          <a className={styles.support} href="https://buymeacoffee.com/marutilab" target="_blank" rel="noreferrer">Coffee</a>
        </nav>
      </header>

      <section className={styles.intro} aria-labelledby="fourtrack-title">
        <div>
          <p className={styles.kicker}>MARUTI LAB / BROWSER TOOL</p>
          <h1 id="fourtrack-title">4TRACK <span>CASSETTE SAMPLER</span></h1>
        </div>
        <div className={styles.lead}>
          <p>音を切る、並べる、録る。<br />ブラウザだけで使える4トラック・サンプラー。</p>
          <span>LOCAL PROCESSING · FREE · NO SIGN-UP</span>
        </div>
      </section>

      <section className={styles.toolSection} aria-label="4TRACK CASSETTE SAMPLER 本体">
        <div className={styles.toolBar}>
          <span>STUDIO / READY</span>
          <span>PC・タブレット推奨</span>
          <a href="/tools/4track/index.html" target="_blank" rel="noreferrer">大きな画面で開く</a>
        </div>
        <div className={styles.portraitNotice}>
          <strong>画面を横向きにしてください</strong>
          <p>4トラック編集画面は横向きで使用できます。</p>
        </div>
        <iframe
          className={styles.studioFrame}
          src="/tools/4track/index.html"
          title="4TRACK CASSETTE SAMPLER"
          allow="microphone"
          sandbox="allow-scripts allow-same-origin allow-downloads"
        />
      </section>

      <section id="guide" className={styles.guide} aria-labelledby="guide-title">
        <div className={styles.guideHeading}>
          <p>QUICK START</p>
          <h2 id="guide-title">音を置いて、<br />4本のテープへ。</h2>
        </div>
        <ol>
          <li><span>01</span><div><strong>音源を読み込む</strong><p>WAVまたはMP3をドロップします。音源は外部へ送信されません。</p></div></li>
          <li><span>02</span><div><strong>範囲を選んで配置</strong><p>波形から使う部分を選び、4つのトラックへ追加します。</p></div></li>
          <li><span>03</span><div><strong>音を整える</strong><p>音量、PAN、フェード、MASTERとLO-FIの質感を調整します。</p></div></li>
          <li><span>04</span><div><strong>WAVで書き出す</strong><p>完成したミックスを端末へ保存します。ページを閉じる前に書き出してください。</p></div></li>
        </ol>
      </section>

      <aside className={styles.notes} aria-label="利用上の注意">
        <div><span>LOCAL</span><p>音源とマイク録音はブラウザ内で処理され、Maruti Labのサーバーへ送信されません。</p></div>
        <div><span>MIC</span><p>録音機能はブラウザのマイク許可が必要です。許可はいつでも端末側で取り消せます。</p></div>
        <div><span>SAVE</span><p>作業内容はブラウザに自動保存され、次に開いたときに復元されます。別端末・別ブラウザには引き継がれないため、完成したら必ずWAVで書き出してください。</p></div>
      </aside>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>Maruti Lab</div>
        <div className={styles.footerLinks}>
          <a href="/">Top</a><a href="/contact">Contact</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/disclaimer">Disclaimer</a>
        </div>
        <small>© 2026 Maruti Lab</small>
      </footer>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    </main>
  );
}
