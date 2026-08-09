/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */
import type { Metadata } from "next";

export const metadata: Metadata = { title: "プライバシーポリシー" };

export default function PrivacyPage() {
  return (
    <main className="legalPage">
      <header className="legalHeader"><a href="/">Maruti Lab</a><a href="/">トップへ戻る</a></header>
      <article className="legalDocument">
        <p className="eyebrow">PRIVACY POLICY / 2026</p>
        <h1>プライバシーポリシー</h1>
        <section><h2>基本方針</h2><p>Maruti Lab（以下「当サイト」）は、利用者のプライバシーを尊重します。当サイトでは、必要のない個人情報を積極的に収集しません。</p></section>
        <section><h2>アクセス時に送信される情報</h2><p>当サイトの閲覧時には、配信・保守・不正アクセス対策のため、IPアドレス、ブラウザや端末の種類、閲覧日時、参照元などがホスティング事業者のサーバーログに記録される場合があります。これらはサイトの安定運用と安全確保のために利用されます。</p></section>
        <section><h2>Cookieとアクセス解析</h2><p>当サイトは、現時点で独自のアクセス解析サービスや広告配信用Cookieを使用していません。将来これらを導入する場合は、本ページへ利用目的とサービス名を追記します。</p></section>
        <section><h2>外部サービスへのリンク</h2><p>当サイトには、X、note、Buy Me a Coffee、LINE STOREおよび各プロダクトサイトへのリンクがあります。移動先で取り扱われる情報には、各サービスのプライバシーポリシーが適用されます。</p></section>
        <section><h2>お問い合わせ</h2><p>本方針に関する連絡は、<a href="https://x.com/maruti_lab" target="_blank" rel="noreferrer">Maruti Lab公式X（@maruti_lab）</a>からお願いします。</p></section>
        <section><h2>改定</h2><p>サービス内容や法令の変更に応じて、本方針を改定することがあります。重要な変更は当サイト上でお知らせします。</p></section>
        <p className="legalUpdated">制定日：2026年8月9日</p>
      </article>
    </main>
  );
}
