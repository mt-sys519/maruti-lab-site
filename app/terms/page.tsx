/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */
import type { Metadata } from "next";

export const metadata: Metadata = { title: "利用規約" };

export default function TermsPage() {
  return (
    <main className="legalPage">
      <header className="legalHeader"><a href="/">Maruti Lab</a><a href="/">トップへ戻る</a></header>
      <article className="legalDocument">
        <p className="eyebrow">TERMS OF USE / 2026</p>
        <h1>利用規約</h1>
        <section><h2>1. 適用</h2><p>本規約は、Maruti Lab（marutilab.com）内で提供するWebページ、MarutiBitのゲーム、Maruti Labから直接提供するソフトウェア等の利用に適用します。</p><p>Maruti Labからリンクしている外部サイト・外部サービスについては、本規約の対象外とし、それぞれのサービスの利用条件に従います。</p></section>
        <section><h2>2. 利用について</h2><p>利用者は、当サイトおよび提供されるゲーム・ソフトウェア等を、それぞれの本来の用途に従って利用できます。</p><p>個別のゲーム・ソフトウェア・配布ページに別途利用条件が記載されている場合は、その個別条件を優先します。</p></section>
        <section>
          <h2>3. 禁止事項</h2>
          <p>以下の行為を禁止します。</p>
          <ul>
            <li>法令または公序良俗に反する行為</li>
            <li>当サイトやサービスの運営を妨害する行為</li>
            <li>サーバー等へ過度な負荷を与える行為</li>
            <li>不正アクセスやセキュリティ上の仕組みを不正に回避する行為</li>
            <li>Maruti Labまたは第三者の権利を侵害する行為</li>
            <li>Maruti Labが提供するゲーム・ソフトウェア・素材等を、許可なく再配布・転載・販売する行為</li>
            <li>その他、運営者が不適切と判断する行為</li>
          </ul>
        </section>
        <section><h2>4. サービス・ソフトウェアの変更と終了</h2><p>Maruti Labは、提供しているページ、ゲーム、ソフトウェア等について、予告なく内容を変更、更新、公開停止または提供終了する場合があります。</p><p>継続的なアップデート、将来のOSへの対応、恒久的な保守・サポートは保証しません。</p></section>
        <section><h2>5. 免責</h2><p>利用にあたっての免責事項については、<a href="/disclaimer">免責事項</a>のページをご確認ください。</p></section>
        <section><h2>6. 規約の変更</h2><p>必要に応じて本規約を変更する場合があります。変更後の規約は、当サイトに掲載した時点から適用します。</p></section>
        <section><h2>7. お問い合わせ</h2><p>本規約に関する連絡は、<a href="/contact">お問い合わせフォーム</a>からお願いします。</p></section>
        <p className="legalUpdated">制定日：2026年8月28日</p>
      </article>
    </main>
  );
}
