import type { Metadata } from "next";
import Image from "next/image";
import { LabHero } from "./LabHero";
import { BitRetro } from "./bit/BitRetro";
import "./bit/retro/retro.css";
import { ClockPreview } from "./ClockPreview";
import { formatDate, posts } from "./blog/posts";
import { SiteFooter } from "./SiteFooter";
import { AboutMark, BitMark, CoffeeMark, LabMark, NoteMark, ToolsMark } from "./icons";
import { PrAds } from "./PrAds";

// Only the canonical is set here; the title and description are the root
// layout's defaults, which are written for this page.
export const metadata: Metadata = { alternates: { canonical: "/" } };

// Every tool gets the same card, in one grid: the image tools first, then the
// games and apps. `bg` is the tool's own colour, shown behind its picture.
// A card with `clock` shows the live PromptTerm CLOCK instead of a picture.
type Work = {
  name: string;
  label: string;
  copy: string;
  image?: string;
  clock?: boolean;
  bg: string;
  href: string;
  action: string;
};

const works: Work[] = [
  {
    name: "PICLEA",
    label: "PHOTO LETTERING",
    copy: "自分の写真の上で、200以上の書体を仕上がりのまま見比べて選べる文字入れツール。写真は端末の外へ出ません。",
    image: "/piclea/og.png",
    bg: "#f3e6e8",
    href: "/piclea/",
    action: "使ってみる",
  },
  {
    name: "YURAMEKI",
    label: "LIVING PICTURE",
    copy: "一枚の絵に、息を宿す。風や衣、髪や光が静かに動き出します。作品は端末の中だけで息づきます。",
    image: "/yurameki/og.png",
    bg: "#efe9dc",
    href: "/yurameki",
    action: "使ってみる",
  },
  {
    name: "SwiftCrop",
    label: "IMAGE UTILITY",
    copy: "画像を外へ送らず、必要な比率とサイズへ。複数枚もブラウザだけで整える画像ツール。",
    image: "/works/swiftcrop.png",
    bg: "#e6edf3",
    href: "/swiftcrop",
    action: "使ってみる",
  },
  {
    name: "COLOR RE:FINE",
    label: "LOCAL COLORIZATION",
    copy: "白黒写真に、もう一度、あの日の色を。端末の中だけで写真をカラー化します。",
    image: "/works/color-refine.png",
    bg: "#efe7da",
    href: "/color-refine",
    action: "使ってみる",
  },
  {
    name: "FILMEA",
    label: "FILM LOOKS",
    copy: "手持ちの写真にフィルムの色をあてて見比べ、気に入った色で保存できるツール。写真は端末の外へ出ません。",
    image: "/filmea/og.png",
    bg: "#ebe9e2",
    href: "/filmea/",
    action: "使ってみる",
  },
  {
    name: "蒼鉄 -AOGANE-",
    label: "PC GAME",
    copy: "顔を向けた方へ視界が動く、WEBカメラ式ヘッドトラッキングFPS。PCのブラウザで遊べます。",
    image: "/aogane/play/assets/cover.webp",
    bg: "#0a0f12",
    href: "/aogane",
    action: "遊んでみる",
  },
  {
    name: "PromptTerm CLOCK",
    label: "DESKTOP APP",
    copy: "秒まで刻み続ける、6管の端末時計。無料・登録不要、オフラインで動くWindowsのデスクトップ時計です。",
    clock: true,
    bg: "#020504",
    href: "/clock",
    action: "ダウンロード",
  },
  {
    name: "HALLO TERRA",
    label: "WORLD GREETINGS",
    copy: "世界地図から場所を選ぶと、その土地の挨拶・お礼・お詫びが、現地の文字とカタカナの読みで出てきます。",
    image: "/og/hallo-terra-2.jpg",
    bg: "#e1efe8",
    href: "/hallo-terra",
    action: "使ってみる",
  },
  {
    name: "4TRACK CASSETTE SAMPLER",
    label: "BROWSER SAMPLER",
    copy: "音を切る、並べる、録る。4トラック、PAN、マイク録音、LO-FIをブラウザだけで扱うサンプラー。",
    image: "/og/4track.png",
    bg: "#f1e4e2",
    href: "/4track",
    action: "使ってみる",
  },
];

export default function Home() {
  return (
    <main>
      <header className="siteHeader">
        <a className="brand" href="#top" aria-label="Maruti Lab トップ">
          <span className="brandMark" aria-hidden="true">
            <LabMark />
          </span>
          <span>Maruti Lab</span>
        </a>
        <nav aria-label="メインナビゲーション">
          <a className="navWithMark" href="#works">
            <span className="navIcon" aria-hidden="true">
              <ToolsMark />
            </span>
            Works
          </a>
          <a className="navWithMark" href="/bit">
            <span className="navIcon" aria-hidden="true">
              <BitMark />
            </span>
            MarutiBit
          </a>
          <a className="navWithMark" href="/blog">
            <span className="navIcon" aria-hidden="true">
              <NoteMark />
            </span>
            LabNote
          </a>
          <a className="navWithMark" href="#about">
            <span className="navIcon" aria-hidden="true">
              <AboutMark />
            </span>
            About
          </a>
          <a className="supportLink navWithMark" href="https://buymeacoffee.com/marutilab" target="_blank" rel="noreferrer">
            <span className="navIcon" aria-hidden="true">
              <CoffeeMark />
            </span>
            Coffee
          </a>
        </nav>
      </header>

      <LabHero />

      {/* The RETRO faces for the series block: Press Start 2P and DotGothic16. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DotGothic16&family=Press+Start+2P&display=swap" />
      <BitRetro />

      <section id="works" className="worksSection" aria-labelledby="works-title">
        <div className="sectionHeading">
          <p className="eyebrow">WORKS</p>
          <h2 id="works-title">思いついたものを、<br />触れる形に。</h2>
        </div>
        <div className="worksGrid">
          {works.map((work) => (
            <article className="workCard" key={work.name}>
              <a className="cardImage imageLink" href={work.href} style={{ background: work.bg }} aria-label={`${work.name}を開く`}>
                {work.clock ? <ClockPreview /> : <Image src={work.image!} alt={`${work.name}の画面`} fill sizes="(max-width: 640px) 100vw, (max-width: 900px) 50vw, 33vw" />}
              </a>
              <div className="cardBody">
                <div className="cardMeta"><span>{work.label}</span></div>
                <h3>{work.name}</h3>
                <p>{work.copy}</p>
                <a className="cardLink refinedLink" href={work.href}><span>{work.action}</span></a>
              </div>
            </article>
          ))}
        </div>
        <p className="smallWork"><span>LINE STICKER</span><a href="https://store.line.me/stickershop/product/35520055/ja" target="_blank" rel="noreferrer">PromptTerm StickerをLINE STOREで見る</a></p>
      </section>

      {posts.length > 0 && (
        <section id="notes" className="notesSection" aria-labelledby="notes-title">
          <div className="sectionHeading notesHeading">
            {/* LabNote is a thing this lab made and named, the way MarutiBit
                and YURAMEKI are, so its name is the heading rather than a
                13px label above one. The eyebrow that used to say LABNOTE is
                gone with it - the wordmark says it. */}
            <h2 id="notes-title" className="notesMark">
              <a className="notesMarkLink" href="/blog">
                <span className="notesMarkIcon" aria-hidden="true"><NoteMark /></span>
                <span className="notesMarkWord">LabNote</span>
              </a>
            </h2>
            <p className="notesCatch">つくる途中の考えごと。</p>
          </div>
          {/* Each note already has a square card drawn for it by
              scripts/capture-note-ogp.mjs, sitting unused in public/og/blog.
              A row of date-then-title reads like a company announcements page;
              the card is the reason to click, and it carries the title inside
              it, so the title is not set again underneath. */}
          <ol className="notesGrid">
            {posts.slice(0, 3).map((post) => (
              <li key={post.slug}>
                <a href={`/blog/${post.slug}`}>
                  <span className="notesArt">
                    <Image src={`/og/blog/${post.slug}-square.png`} alt="" fill sizes="(max-width:700px) 50vw, 300px" />
                  </span>
                  <h3 className="srOnly">{post.title}</h3>
                  <time dateTime={post.date}>{formatDate(post.date)}</time>
                </a>
              </li>
            ))}
          </ol>
          <a className="textButton refinedLink notesAll" href="/blog"><span>LabNoteをすべて見る</span></a>
        </section>
      )}

      <section id="about" className="aboutSection" aria-labelledby="about-title">
        <p className="eyebrow">ABOUT</p>
        <div>
          <h2 id="about-title">道具とゲームを、<br />AIと一緒に作っています。</h2>
          <p>画像を動かす。整える。色を戻す。時間を表示する。Maruti Labは、思いつきを実際に触れる道具へ変え、公開し、使いながら直していく個人ラボです。</p>
          <a className="textButton refinedLink" href="/about"><span>運営者情報を見る</span></a>
        </div>
      </section>

      <section className="supportSection" aria-label="Maruti Labを支援">
        <div><p className="eyebrow">KEEP THE LAB OPEN</p><h2>気に入ったら、コーヒーを一杯。</h2></div>
        <a className="refinedLink" href="https://buymeacoffee.com/marutilab" target="_blank" rel="noreferrer"><span>コーヒーをおごる</span></a>
      </section>

      <PrAds kind="rakuten" />
      <SiteFooter />
    </main>
  );
}
