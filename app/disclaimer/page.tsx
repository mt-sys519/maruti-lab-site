/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */
import type { Metadata } from "next";

export const metadata: Metadata = { title: "免責事項" };

export default function DisclaimerPage() {
  return (
    <main className="legalPage">
      <header className="legalHeader"><a href="/">Maruti Lab</a><a href="/">トップへ戻る</a></header>
      <article className="legalDocument">
        <p className="eyebrow">DISCLAIMER / 2026</p>
        <h1>免責事項</h1>
        <section><h2>掲載内容について</h2><p>当サイトでは、掲載内容の正確性と安全性に配慮していますが、完全性、最新性、特定目的への適合性を保証するものではありません。内容は予告なく変更または公開を終了する場合があります。</p></section>
        <section><h2>配布ソフトウェアについて</h2><p>Maruti Labが配布するソフトウェアは、各配布ページに記載した条件で提供されます。利用者自身の判断と責任でご利用ください。利用、インストールまたは利用不能によって生じた損害について、Maruti Labは法令上認められる範囲で責任を負いません。重要なデータは事前にバックアップしてください。</p></section>
        <section><h2>外部リンクについて</h2><p>当サイトから移動できる外部サイトやサービスは、それぞれの運営者が管理しています。移動先の内容、提供物、個人情報の取り扱いについて、Maruti Labは責任を負いません。</p></section>
        <section><h2>知的財産権</h2><p>当サイトに掲載する文章、画像、ロゴ、画面デザイン等の権利は、Maruti Labまたは正当な権利者に帰属します。法令で認められる場合を除き、無断での転載、複製、再配布はお控えください。</p></section>
        <section><h2>お問い合わせ</h2><p>掲載内容に関する連絡は、<a href="https://x.com/maruti_lab" target="_blank" rel="noreferrer">Maruti Lab公式X（@maruti_lab）</a>からお願いします。</p></section>
        <p className="legalUpdated">制定日：2026年8月9日</p>
      </article>
    </main>
  );
}
