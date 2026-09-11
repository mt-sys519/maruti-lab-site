/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires document navigation for local routes */
import type { Metadata } from "next";
import { SiteFooter } from "../SiteFooter";

export const metadata: Metadata = {
  title: "PromptTerm CLOCK",
  description: "秒まで刻み続ける6管のWindowsデスクトップ時計。無料、登録不要、オフライン動作。",
};

export default function ClockPage() {
  return <main className="clockPage">
    <header className="siteHeader clockHeader"><a className="brand" href="/"><span className="brandMark" aria-hidden="true"><svg viewBox="0 0 18 18" focusable="false"><path d="M3 8.6 9 3.2l6 5.4" /><path d="M4.6 7.3V15h8.8V7.3" /><path d="M7.3 15v-4.3h3.4V15" /></svg></span><span>Maruti Lab</span></a><a href="/">Worksへ戻る</a></header>
    <section className="clockHero">
      <div className="clockHeroCopy"><p className="eyebrow">WINDOWS DESKTOP APP · FREE</p><h1>PromptTerm<br />CLOCK</h1><p className="clockLead">秒まで刻み続ける、<br />6管の端末時計。</p><a className="downloadButton" href="/downloads/PromptTerm_CLOCK_1.0.0_setup.exe" download>Windows版を無料ダウンロード <small>v1.0.0 · 1.8MB</small></a><p className="downloadNote">Windows 10 / 11・64bit · 登録不要 · オフライン動作</p></div>
      <div className="clockHeroLive">
        <iframe
          src="/demos/promptterm-clock.html"
          title="現在時刻を表示するPromptTerm CLOCKのライブデモ"
          loading="eager"
          allow="fullscreen"
          allowFullScreen
        />
      </div>
    </section>
    <section className="clockStatement"><p className="eyebrow">A CHRONOMETRIC TERMINAL</p><h2>時計ではなく、<br />時間を表示する端末。</h2><p>PromptTermという架空の端末環境に組み込まれたクロックモジュール。GREEN、AMBER、BLUE、REDの発光色と、4種類の分切替エフェクトを備えています。</p></section>
    <section className="clockSpecs">
      <div><span>01</span><h3>6 TUBES</h3><p>HH:MM:SS。秒を省かず、現在時刻を6本のreNix管で刻み続けます。</p></div>
      <div><span>02</span><h3>CLOCK MODE</h3><p>端末の外枠を消し、時計だけを静かにデスクトップへ残せます。</p></div>
      <div><span>03</span><h3>LOCAL & QUIET</h3><p>アカウント登録も通信もTelemetryもなし。すべて端末内で動作します。</p></div>
    </section>
    <section className="clockGuide" aria-labelledby="clock-guide-title">
      <div className="clockGuideHead">
        <p className="eyebrow">HOW TO USE</p>
        <h2 id="clock-guide-title">使い方</h2>
        <p>このページの右（スマートフォンでは上）で動いている画面は、実際のアプリと同じものです。ボタンを押すと、ここで試せます。</p>
      </div>
      <dl className="clockGuideList">
        <div>
          <dt>時刻表示</dt>
          <dd><code>HH:MM:SS</code>の24時間表示に固定しています。秒を省きません。時刻はお使いのWindowsの時計に従います。</dd>
        </div>
        <div>
          <dt>CLOCK MODE</dt>
          <dd>端末の外枠と情報表示を消し、6本の管だけをデスクトップに残します。<b>RETURN</b>でもとの画面へ戻ります。</dd>
        </div>
        <div>
          <dt>COLOR</dt>
          <dd>管の発光色を<b>GREEN → AMBER → BLUE → RED</b>の順に切り替えます。押すたびに次の色へ進みます。</dd>
        </div>
        <div>
          <dt>EFFECT</dt>
          <dd>分が変わる瞬間の切り替え演出を<b>NORMAL / RAIN / GLITCH / CORRUPT</b>から選びます。時刻の読み取りには影響しません。</dd>
        </div>
        <div>
          <dt>PIN</dt>
          <dd>ONにすると、ほかのウィンドウより手前に固定されます。作業しながら時刻を見続けたいときに。</dd>
        </div>
        <div>
          <dt>INFO</dt>
          <dd>画面右側の状態表示（管の状態、UTCオフセット、ビルド番号など）を出し入れします。</dd>
        </div>
        <div>
          <dt>フルスクリーン</dt>
          <dd>画面いっぱいに広げます。据え置きの時計として使うときに。</dd>
        </div>
      </dl>
      <div className="clockGuideNote">
        <h3>動作環境と、しないこと</h3>
        <p>Windows 10 / 11（64bit）。インストーラーは1.8MBです。</p>
        <p>アカウント登録、通信、アクセス解析、自動更新のいずれもありません。インストール後はオフラインのまま動きます。新しい版が出ても勝手に入れ替わらないので、更新はこのページから改めてダウンロードしてください。</p>
      </div>
    </section>
    <section className="downloadSection"><div><p className="eyebrow">DOWNLOAD</p><h2>PromptTerm CLOCK 1.0.0</h2><p>未署名の個人制作アプリのため、Windows SmartScreenの青い警告画面が表示される場合があります。その場合は「詳細情報」を開き、「実行」を選択してください。ファイルの同一性はSHA-256で確認できます。</p></div><div className="downloadActions"><a className="downloadButton" href="/downloads/PromptTerm_CLOCK_1.0.0_setup.exe" download>セットアップをダウンロード</a><a href="/downloads/SHA256SUMS.txt" download>SHA-256を確認</a><code>E8DF275BE2505690474CF663FC1E876F0B9600691DD1F8BF83D599E9219EC34E</code></div></section>
    <SiteFooter />
  </main>;
}
