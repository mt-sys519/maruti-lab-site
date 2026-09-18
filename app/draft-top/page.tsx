/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */
import type { Metadata } from "next";
import Image from "next/image";
import { formatDate, posts } from "../blog/posts";
import "./draft.css";

/**
 * A draft of the front page, kept at its own URL so the real one is untouched
 * and the two can be opened side by side. Not linked from anywhere, not in the
 * sitemap, and noindex - delete the folder and nothing else changes.
 */
export const metadata: Metadata = {
  title: "下書き：トップページ",
  robots: { index: false, follow: false },
};

/* Each work's mark, drawn to match the nav icons already in app/page.tsx:
   an 18x18 box, no fill, 1.4 stroke, round caps. */
const marks: Record<string, React.ReactNode> = {
  YURAMEKI: <><path d="M2.6 11.4c1.6-2 3.2-2 4.8 0s3.2 2 4.8 0 3.2-2 3.2-2" /><path d="M2.6 7.2c1.6-2 3.2-2 4.8 0s3.2 2 4.8 0 3.2-2 3.2-2" /></>,
  MarutiBit: <><path d="M4.8 6.2h8.4a3 3 0 0 1 2.95 3.52l-.5 2.75a2.1 2.1 0 0 1-3.66.95L10.6 12H7.4l-1.39 1.42a2.1 2.1 0 0 1-3.66-.95l-.5-2.75A3 3 0 0 1 4.8 6.2Z" /><path d="M5.9 8.4v2.1M4.85 9.45h2.1" /><circle cx="12.3" cy="8.7" r=".6" fill="currentColor" stroke="none" /></>,
  "PromptTerm CLOCK": <><circle cx="9" cy="9" r="6.4" /><path d="M9 5.4V9l2.5 1.6" /></>,
  SwiftCrop: <><path d="M5.6 2.6v9.8h9.8" /><path d="M2.6 5.6h9.8v9.8" /></>,
  "COLOR RE:FINE": <><circle cx="9" cy="9" r="6.4" /><path d="M9 2.6a6.4 6.4 0 0 0 0 12.8Z" fill="currentColor" stroke="none" /></>,
  "4TRACK CASSETTE SAMPLER": <><rect x="2.4" y="4.4" width="13.2" height="9.2" rx="1.2" /><circle cx="6.6" cy="9" r="1.5" /><circle cx="11.4" cy="9" r="1.5" /></>,
};

const works = [
  {
    name: "YURAMEKI",
    ratio: "720 / 720",
    accent: "#c8392a",
    accentInk: "#a52d20",
    label: "MOTION STUDIO",
    tagline: "一枚の絵に、息を宿す。",
    copy: "イラストや写真の動かしたい場所だけを囲んで、呼吸・たなびき・灯り・波紋の動きをつけ、GIFやMP4として書き出せます。画像は端末の外へ出ません。",
    image: "/works/yurameki-breath.webp",
    href: "/yurameki",
  },
  {
    name: "MarutiBit",
    ratio: "1200 / 630",
    accent: "#2bb3a3",
    accentInk: "#15756a",
    label: "SMALL GAMES",
    tagline: "短い時間で、頭を少し動かす。",
    copy: "考える。見抜く。打ち込む。ひと息で遊べる小さなゲームを、少しずつ増やしています。いまは8本。",
    image: "/og/bit/index-v2.png",
    href: "/bit",
  },
  {
    name: "PromptTerm CLOCK",
    ratio: "1920 / 1080",
    accent: "#5f9c2e",
    accentInk: "#456f22",
    label: "DESKTOP CLOCK",
    tagline: "秒まで刻み続ける、6管の端末時計。",
    copy: "架空の端末環境PromptTermに組み込まれた時計を、Windowsのデスクトップで動くアプリとして取り出したもの。",
    image: "/works/promptterm-clock-green-hero.jpg",
    href: "/clock",
  },
  {
    name: "SwiftCrop",
    ratio: "1200 / 630",
    accent: "#2c9b8f",
    accentInk: "#1e6b63",
    label: "IMAGE UTILITY",
    tagline: "切り抜きも、リサイズも、まとめて軽く。",
    copy: "画像を外へ送らず、必要な比率とサイズへ。複数枚もブラウザだけで整える画像ツール。",
    image: "/works/swiftcrop.png",
    href: "/swiftcrop",
  },
  {
    name: "COLOR RE:FINE",
    ratio: "1200 / 630",
    accent: "#b75f3b",
    accentInk: "#8d472b",
    label: "LOCAL COLORIZATION",
    tagline: "白黒写真に、もう一度、あの日の色を。",
    copy: "端末の中だけで写真をカラー化します。写真はどこへも送られません。",
    image: "/works/color-refine.png",
    href: "/color-refine",
  },
  {
    name: "4TRACK CASSETTE SAMPLER",
    ratio: "1200 / 630",
    accent: "#c24b3a",
    accentInk: "#96382a",
    label: "BROWSER SAMPLER",
    tagline: "音を切る、並べる、録る。",
    copy: "4トラック、PAN、マイク録音、LO-FIを、ブラウザだけで扱うサンプラー。",
    image: "/og/4track.png",
    href: "/4track",
  },
];

export default function DraftTop() {
  return (
    <main className="draftTop">
      <p className="draftNotice">
        下書き — 公開されていません。色は今のまま、構造と文字の大きさだけ変えてあります。
      </p>
      <div className="draftFrame">
        <div className="draftHead">
          <b>Maruti Lab</b>
          <nav aria-label="ナビゲーション（下書き）">
            <a href="#works">Works</a>
            <a href="/bit">MarutiBit</a>
            <a href="/blog">LabNote</a>
            <a href="/about">About</a>
          </nav>
        </div>

        <div className="draftIntro">
          <h1>小さなデジタル道具をつくっています。</h1>
          <p>
            画像を動かす。整える。色を戻す。音を組む。時間を表示する。
            思いつきを、実際に触れる道具へ変えて、公開して、使いながら直していく個人のラボです。
          </p>
        </div>

        <section id="works" aria-label="作品">
          {works.map((work) => (
            <article className="work" key={work.name} style={{ "--accent": work.accent, "--accent-ink": work.accentInk, "--shot": work.ratio } as React.CSSProperties}>
              <a className="workShot" href={work.href} aria-label={`${work.name}を開く`}>
                <Image src={work.image} alt={`${work.name}の画面`} fill sizes="(max-width:760px) 100vw, 460px" />
              </a>
              <div className="workText">
                <p className="draftLabel">
                  <svg className="workMark" viewBox="0 0 18 18" aria-hidden="true" focusable="false">{marks[work.name]}</svg>
                  {work.label}
                </p>
                <h2>{work.name}</h2>
                <p className="tagline">{work.tagline}</p>
                <p>{work.copy}</p>
                <a className="go" href={work.href}><span>ひらく</span><i aria-hidden="true" /></a>
              </div>
            </article>
          ))}
        </section>

        {posts.length > 0 && (
          <section className="draftNotes" aria-label="LabNote">
            <p className="draftLabel">LABNOTE</p>
            {/* Every note already has a square card drawn for it by
                scripts/capture-note-ogp.mjs and sitting unused in
                public/og/blog. A row of date-then-title reads like a company
                announcements page; the art is the reason to click. */}
            <ol className="noteGrid">
              {posts.slice(0, 4).map((post) => (
                <li key={post.slug}>
                  <a href={`/blog/${post.slug}`}>
                    <span className="noteArt">
                      <Image src={`/og/blog/${post.slug}-square.png`} alt="" fill sizes="(max-width:760px) 50vw, 280px" />
                    </span>
                    {/* The title is already set inside the card art - these
                        were drawn as share cards, not thumbnails - so it is
                        not repeated underneath. The heading stays in the
                        document for anyone not seeing the image. */}
                    <h3 className="srOnly">{post.title}</h3>
                    <time dateTime={post.date}>{formatDate(post.date)}</time>
                  </a>
                </li>
              ))}
            </ol>
            <p className="draftMore"><a href="/blog">LabNoteをすべて見る</a></p>
          </section>
        )}

        <section className="draftAbout" aria-label="このラボについて">
          <p className="draftLabel">ABOUT</p>
          <h2>小さくつくる。ちゃんと使えるところまで。</h2>
          <p>
            Maruti Labは、思いつきを実際に触れる道具へ変え、公開し、使いながら直していく個人ラボです。
            つくっている途中のことはLabNoteに書いています。
          </p>
          <p className="draftMore"><a href="/about">運営者情報を見る</a></p>
        </section>
        <section className="draftSupport" aria-label="支援">
          <div>
            <p className="draftLabel">KEEP THE LAB OPEN</p>
            <h2>気に入ったら、コーヒーを一杯。</h2>
          </div>
          <a href="https://buymeacoffee.com/marutilab" target="_blank" rel="noreferrer">Coffeeで支援する</a>
        </section>

        {/* The shared SiteFooter sets its links at 12px, which is outside the
            four sizes this draft is testing, so it is rebuilt here at the
            draft's own scale rather than imported. If the skeleton is kept,
            the real footer follows it. */}
        <footer className="draftFoot">
          <b>Maruti Lab</b>
          <nav aria-label="フッター（下書き）">
            <span>
              <a href="#works">Works</a>
              <a href="/bit">MarutiBit</a>
              <a href="/blog">LabNote</a>
            </span>
            <span>
              <a href="/about">About</a>
              <a href="/contact">Contact</a>
            </span>
            <span>
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
              <a href="/disclaimer">Disclaimer</a>
            </span>
            <span>
              <a href="https://x.com/maruti_lab" target="_blank" rel="noreferrer">X / @maruti_lab</a>
              <a href="https://note.com/a_tkms" target="_blank" rel="noreferrer">note</a>
            </span>
          </nav>
          <small>© 2026 Maruti Lab</small>
        </footer>
      </div>
    </main>
  );
}
