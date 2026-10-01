/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */
import type { Metadata } from "next";

export const metadata: Metadata = { title: "プライバシーポリシー", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <main className="legalPage">
      <header className="legalHeader"><a href="/">Maruti Lab</a><a href="/">トップへ戻る</a></header>
      <article className="legalDocument">
        <p className="eyebrow">PRIVACY POLICY / 2026</p>
        <h1>プライバシーポリシー</h1>
        <section><h2>基本方針</h2><p>Maruti Lab（以下「当サイト」）は、利用者のプライバシーを尊重します。当サイトでは、必要のない個人情報を積極的に収集しません。</p></section>
        <section><h2>アクセス時に送信される情報</h2><p>当サイトの閲覧時には、配信・保守・不正アクセス対策のため、IPアドレス、ブラウザや端末の種類、閲覧日時、参照元などがホスティング事業者のサーバーログに記録される場合があります。これらはサイトの安定運用と安全確保のために利用されます。</p></section>
        <section><h2>Cookieとアクセス解析</h2><p>当サイトは、Googleアナリティクスを利用してアクセス状況を解析しています。Googleアナリティクスは、Cookie等を利用して匿名のアクセス情報を収集します。収集した情報は、当サイトの利用状況の把握およびサイト改善の目的にのみ使用します。収集された情報の取り扱いについては、Googleのプライバシーポリシーに基づいて管理されます。詳細は<a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Googleのプライバシーポリシー</a>をご確認ください。</p></section>
        <section><h2>広告配信について</h2><p>当サイトは、第三者配信の広告サービス「Googleアドセンス」の利用を予定しています。広告配信事業者は、利用者の興味に応じた広告を表示するために、Cookieを使用して当サイトや他のサイトへのアクセス情報を利用することがあります。この情報に氏名・住所・メールアドレス・電話番号は含まれません。</p><p>パーソナライズ広告は、<a href="https://myadcenter.google.com/" target="_blank" rel="noreferrer">Google広告設定</a>から無効にできます。第三者配信事業者による広告配信を停止する方法については、<a href="https://policies.google.com/technologies/ads" target="_blank" rel="noreferrer">広告 – ポリシーと規約 – Google</a>をご確認ください。</p></section>
        <section><h2>アフィリエイトプログラムについて</h2><p>当サイトは、Amazon.co.jpを宣伝しリンクすることによって紹介料を獲得できる手段を提供することを目的に設定されたアフィリエイトプログラムである、Amazonアソシエイト・プログラムの参加者です。Amazonのアソシエイトとして、Maruti Labは適格販売により収入を得ています。また、株式会社ファンコミュニケーションズが運営するアフィリエイトサービス「A8.net」を利用しています。</p><p>これらの広告は、バナー画像を各事業者のサーバーから読み込んで表示します。その際、IPアドレスやブラウザの情報が各事業者に送信されます。Amazonを含む第三者が、利用者のブラウザでCookieを設定・認識したり、ウェブビーコンを利用したりして、広告の表示や紹介の記録のために情報を収集する場合があります。これらの情報に氏名・住所・メールアドレス・電話番号は含まれません。各事業者での取り扱いは、それぞれのプライバシーポリシーをご確認ください。</p></section>
        <section><h2>ブラウザ内で扱う音源とマイク</h2><p>4TRACK CASSETTE SAMPLERで読み込んだ音源ファイル、マイクから録音した音声および編集中のデータは、利用者のブラウザ内で処理され、Maruti Labのサーバーへ送信されません。マイクは、利用者がブラウザ上で許可した場合に限り使用します。作業内容はサーバーに保存されず、ページを閉じたり再読み込みしたりすると失われます。</p></section>
        <section><h2>ブラウザ内で扱う写真（piclea）</h2><p>picleaで選んだ写真と入力した文字は、利用者のブラウザ内で処理され、Maruti Labのサーバーへ送信されません。作品と型は利用者の端末のブラウザ内にのみ保存され、Maruti Labが取得することはありません。ブラウザのデータを削除すると、これらも削除されます。</p><p>書体を表示するため、picleaはGoogle Fontsから書体のデータを読み込みます。その際、IPアドレスやブラウザの情報がGoogleに送信されますが、写真や入力した文字は送信されません。Googleでの取り扱いは、<a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Googleのプライバシーポリシー</a>をご確認ください。</p><p>picleaの画面には、Amazonアソシエイトおよび A8.net の広告を表示します。広告の読み込みでは上記のとおりIPアドレスやブラウザの情報が各事業者に送信されますが、写真や入力した文字が広告に渡ることはありません。</p></section>
        <section><h2>外部サービスへのリンク</h2><p>当サイトには、X、note、Buy Me a Coffee、LINE STORE、各プロダクトサイトおよび広告の掲載先へのリンクがあります。移動先で取り扱われる情報には、各サービスのプライバシーポリシーが適用されます。</p></section>
        <section><h2>お問い合わせ</h2><p>本方針に関する連絡は、<a href="/contact">お問い合わせフォーム</a>からお願いします。フォームでは、お名前・メールアドレス・お問い合わせ内容をご入力いただきます。送信には外部フォームサービスのFormspreeを利用しており、送信いただいた情報はお問い合わせへの対応の目的にのみ使用します。</p></section>
        <section><h2>改定</h2><p>サービス内容や法令の変更に応じて、本方針を改定することがあります。重要な変更は当サイト上でお知らせします。</p></section>
        <p className="legalUpdated">制定日：2026年8月9日<br />最終改定日：2026年10月1日</p>
      </article>
    </main>
  );
}
