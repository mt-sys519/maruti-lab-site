import Image from "next/image";
import { LabHero } from "./LabHero";
import { ClockPreview } from "./ClockPreview";
import { formatDate, posts } from "./blog/posts";
import { SiteFooter } from "./SiteFooter";
import { AboutMark, BitMark, CoffeeMark, LabMark, NoteMark, ToolsMark } from "./icons";

const yuramekiUrl = "/yurameki";

const works = [
  {
    name: "HALLO TERRA",
    label: "WORLD GREETINGS",
    copy: "世界地図から場所を選ぶと、その土地の挨拶・お礼・お詫びが、現地の文字とカタカナの読みで出てきます。",
    image: "/og/hallo-terra.jpg",
    href: "/hallo-terra",
    action: "使ってみる",
    external: false,
  },
  {
    name: "SwiftCrop",
    label: "IMAGE UTILITY",
    copy: "画像を外へ送らず、必要な比率とサイズへ。複数枚もブラウザだけで整える画像ツール。",
    image: "/works/swiftcrop.png",
    href: "/swiftcrop",
    action: "使ってみる",
    external: false,
  },
  {
    name: "COLOR RE:FINE",
    label: "LOCAL COLORIZATION",
    copy: "白黒写真に、もう一度、あの日の色を。端末の中だけで写真をカラー化します。",
    image: "/works/color-refine.png",
    href: "/color-refine",
    action: "使ってみる",
    external: false,
  },
  {
    name: "4TRACK CASSETTE SAMPLER",
    label: "BROWSER SAMPLER",
    copy: "音を切る、並べる、録る。4トラック、PAN、マイク録音、LO-FIをブラウザだけで扱うサンプラー。",
    image: "/og/4track.png",
    href: "/4track",
    action: "使ってみる",
    external: false,
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

      <section className="feature featureClock" aria-labelledby="clock-title">
        <div className="clockCopy">
          <p className="workNumber">NEW RELEASE</p>
          <h2 id="clock-title">PromptTerm<br />CLOCK</h2>
          <p className="workTagline">秒まで刻み続ける、6管の端末時計。</p>
          <p>架空の端末環境PromptTermに組み込まれた、Windowsデスクトップ時計。無料、登録不要、オフラインで動きます。</p>
          <a className="lightButton" href="/clock">作品を見る・ダウンロード</a>
        </div>
        <a className="clockImage imageLink" href="/clock" aria-label="PromptTerm CLOCKの作品ページを開く">
          <ClockPreview />
        </a>
      </section>

      <section id="works" className="worksSection" aria-labelledby="works-title">
        <div className="sectionHeading">
          <p className="eyebrow">OTHER WORKS</p>
          <h2 id="works-title">ちいさな道具が、<br />日々を少したのしくする。</h2>
        </div>
        <div className="worksGrid">
          {works.map((work) => (
            <article className="workCard" key={work.name}>
              <a className="cardImage imageLink" href={work.href} target={work.external ? "_blank" : undefined} rel={work.external ? "noreferrer" : undefined} aria-label={`${work.name}を開く`}><Image src={work.image} alt={`${work.name}の画面`} fill sizes="(max-width: 700px) 100vw, 66vw" /></a>
              <div className="cardBody">
                <div className="cardMeta"><span>{work.label}</span></div>
                <h3>{work.name}</h3>
                <p>{work.copy}</p>
                <a className="cardLink refinedLink" href={work.href} target={work.external ? "_blank" : undefined} rel={work.external ? "noreferrer" : undefined}><span>{work.action}</span></a>
              </div>
            </article>
          ))}
        </div>
        <p className="smallWork"><span>LINE STICKER</span><a href="https://store.line.me/stickershop/product/35520055/ja" target="_blank" rel="noreferrer">PromptTerm StickerをLINE STOREで見る</a></p>
      </section>

      <section id="yurameki" className="feature featureYurameki" aria-labelledby="yurameki-title">
        <a className="featureImage yuramekiImage imageLink" href={yuramekiUrl} aria-label="YURAMEKIを開く">
          <Image src="/works/yurameki-breath.png" alt="YURAMEKIの呼吸する作例" fill sizes="(max-width: 800px) 100vw, 62vw" />
        </a>
        <div className="featureCopy">
          <p className="workNumber">MAIN WORK</p>
          <h2 id="yurameki-title">YURAMEKI</h2>
          <p className="workTagline">一枚の絵に、息を宿す。</p>
          <p>風、衣、髪、光の気配。息づく場所を静かに囲み、止まっていた一瞬へ時間を結びます。作品は端末の中だけで息づきます。</p>
          <a className="textButton refinedLink" href={yuramekiUrl}><span>YURAMEKIを開く</span></a>
          <a className="featureSubLink refinedLink" href="/yurameki/about"><span>YURAMEKIについて</span></a>
        </div>
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
          <h2 id="about-title">小さな道具を、<br />AIと一緒に作っています。</h2>
          <p>画像を動かす。整える。色を戻す。時間を表示する。Maruti Labは、思いつきを実際に触れる道具へ変え、公開し、使いながら直していく個人ラボです。</p>
          <a className="textButton refinedLink" href="/about"><span>運営者情報を見る</span></a>
        </div>
      </section>

      <section className="supportSection" aria-label="Maruti Labを支援">
        <div><p className="eyebrow">KEEP THE LAB OPEN</p><h2>気に入ったら、コーヒーを一杯。</h2></div>
        <a className="refinedLink" href="https://buymeacoffee.com/marutilab" target="_blank" rel="noreferrer"><span>コーヒーをおごる</span></a>
      </section>

      <SiteFooter />
    </main>
  );
}
