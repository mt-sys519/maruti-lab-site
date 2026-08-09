/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires document navigation for local routes */
import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "PromptTerm CLOCK",
  description: "秒まで刻み続ける6管のWindowsデスクトップ時計。無料、登録不要、オフライン動作。",
};

export default function ClockPage() {
  return <main className="clockPage">
    <header className="siteHeader clockHeader"><a className="brand" href="/"><span className="brandMark">M</span><span>Maruti Lab</span></a><a href="/">Worksへ戻る</a></header>
    <section className="clockHero">
      <div className="clockHeroCopy"><p className="eyebrow">WINDOWS DESKTOP APP · FREE</p><h1>PromptTerm<br />CLOCK</h1><p className="clockLead">秒まで刻み続ける、<br />6管の端末時計。</p><a className="downloadButton" href="/downloads/PromptTerm_CLOCK_1.0.0_setup.exe" download>Windows版を無料ダウンロード <small>v1.0.0 · 1.8MB</small></a><p className="downloadNote">Windows 10 / 11・64bit · 登録不要 · オフライン動作</p></div>
      <div className="clockHeroImage"><Image src="/works/promptterm-clock-green-hero.jpg" alt="CLOCK MODEでGREENに発光するPromptTerm CLOCKの6管表示" fill priority sizes="(max-width: 800px) 100vw, 60vw" /></div>
    </section>
    <section className="clockStatement"><p className="eyebrow">A CHRONOMETRIC TERMINAL</p><h2>時計ではなく、<br />時間を表示する端末。</h2><p>PromptTermという架空の端末環境に組み込まれたクロックモジュール。GREEN、AMBER、BLUE、REDの発光色と、4種類の分切替エフェクトを備えています。</p></section>
    <section className="clockSpecs">
      <div><span>01</span><h3>6 TUBES</h3><p>HH:MM:SS。秒を省かず、現在時刻を6本のreNix管で刻み続けます。</p></div>
      <div><span>02</span><h3>CLOCK MODE</h3><p>端末の外枠を消し、時計だけを静かにデスクトップへ残せます。</p></div>
      <div><span>03</span><h3>LOCAL & QUIET</h3><p>アカウント、広告、通信、Telemetryなし。すべて端末内で動作します。</p></div>
    </section>
    <section className="downloadSection"><div><p className="eyebrow">DOWNLOAD</p><h2>PromptTerm CLOCK 1.0.0</h2><p>未署名の個人制作アプリです。Windows SmartScreenが警告を表示する場合があります。ファイルの同一性はSHA-256で確認できます。</p></div><div className="downloadActions"><a className="downloadButton" href="/downloads/PromptTerm_CLOCK_1.0.0_setup.exe" download>セットアップをダウンロード</a><a href="/downloads/SHA256SUMS.txt" download>SHA-256を確認</a><code>28D02F8B39B84AF300388E425F74CAB001BDFEC1DC4271114120D7089C55D927</code></div></section>
    <footer><div className="footerBrand">Maruti Lab</div><div className="footerLinks"><a href="/">Works</a><a href="https://buymeacoffee.com/marutilab" target="_blank" rel="noreferrer">Coffee</a><a href="/privacy">Privacy</a><a href="/disclaimer">Disclaimer</a></div><small>© 2026 Maruti Lab</small></footer>
  </main>;
}
