/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "運営者情報",
  description:
    "Maruti Labは、ブラウザや手元の端末だけで動く小さな道具とゲームを作っている個人の制作ラボです。運営者、連絡方法、公開しているものについて。",
  alternates: { canonical: "https://marutilab.com/about" },
};

export default function AboutPage() {
  return (
    <main className="legalPage">
      <header className="legalHeader">
        <a href="/">Maruti Lab</a>
        <a href="/">トップへ戻る</a>
      </header>
      <article className="legalDocument">
        <p className="eyebrow">ABOUT / 2026</p>
        <h1>運営者情報</h1>
        <section className="aboutOperator">
          <img src="/maruti-avatar.jpg" alt="運営者マルティの似顔絵" width={112} height={112} />
          <div>
            <h2>maruti（マルティ）</h2>
            <p>
              Maruti Labは、日本の個人が運営している制作ラボです。ブラウザや手元の端末だけで動く小さな道具と、ひと息で遊べるゲームを作って公開しています。思いついたものを実際に触れる形にして、公開して、使いながら直していく、という進め方をしています。
            </p>
            <p>
              Xでは<a href="https://x.com/maruti_lab" target="_blank" rel="noreferrer">@maruti_lab</a>として、作っているものと、その途中を書いています。
            </p>
          </div>
        </section>
        <section>
          <h2>作っているもの</h2>
          <ul>
            <li><a href="https://swiftcrop.jp/" target="_blank" rel="noreferrer">SwiftCrop</a> — 画像のトリミングとリサイズ</li>
            <li><a href="https://color-refine.com/" target="_blank" rel="noreferrer">COLOR RE:FINE</a> — 白黒写真のカラー化</li>
            <li><a href="https://yurameki.tokyo/" target="_blank" rel="noreferrer">YURAMEKI</a> — 静止画に揺れを加えるモーションメーカー</li>
            <li><a href="/clock">PromptTerm CLOCK</a> — Windowsデスクトップ時計</li>
            <li><a href="/4track">4TRACK CASSETTE SAMPLER</a> — ブラウザのサンプラー</li>
            <li><a href="/bit">MarutiBit</a> — 短時間で遊べる小さなゲーム集</li>
          </ul>
          <p>
            道具はどれも、読み込んだデータを外部のサーバーへ送りません。なぜそうしているのかは<a href="/blog/browser-only">ノートに書きました</a>。
          </p>
        </section>
        <section>
          <h2>制作について</h2>
          <p>
            開発にはAIを利用しています。一方で、サイトに掲載している文章は運営者自身が書いたもので、実際に作り、使ってみて分かったことだけを書いています。
          </p>
        </section>
        <section>
          <h2>連絡先</h2>
          <p>
            ご質問、ご要望、不具合のご報告は<a href="/contact">お問い合わせフォーム</a>からお願いします。掲載内容や権利に関するご連絡も、同じフォームで受け付けています。
          </p>
        </section>
        <section>
          <h2>そのほか</h2>
          <ul>
            <li><a href="https://x.com/maruti_lab" target="_blank" rel="noreferrer">X / @maruti_lab</a></li>
            <li><a href="https://note.com/a_tkms" target="_blank" rel="noreferrer">note</a></li>
            <li><a href="https://buymeacoffee.com/marutilab" target="_blank" rel="noreferrer">Buy Me a Coffee</a></li>
          </ul>
          <p>
            当サイトの取り扱いについては<a href="/privacy">プライバシーポリシー</a>、<a href="/terms">利用規約</a>、<a href="/disclaimer">免責事項</a>もあわせてご確認ください。
          </p>
        </section>
      </article>
      <footer>
        <div className="footerBrand">Maruti Lab</div>
        <div className="footerLinks"><a href="/">Works</a><a href="/bit">MarutiBit</a><a href="/4track">4TRACK</a><a href="/blog">ノート</a><a href="/about">About</a><a href="/contact">Contact</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/disclaimer">Disclaimer</a></div>
        <small>© 2026 Maruti Lab</small>
      </footer>
    </main>
  );
}
