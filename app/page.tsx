import Image from "next/image";
import { LabHero } from "./LabHero";
import { ClockPreview } from "./ClockPreview";

const yuramekiUrl = "https://yurameki.tokyo/";

const works = [
  {
    number: "03",
    name: "SwiftCrop",
    label: "IMAGE UTILITY",
    copy: "画像を外へ送らず、必要な比率とサイズへ。複数枚もブラウザだけで整える画像ツール。",
    image: "/works/swiftcrop.png",
    href: "https://swiftcrop.jp/",
    action: "使ってみる",
  },
  {
    number: "04",
    name: "COLOR RE:FINE",
    label: "LOCAL COLORIZATION",
    copy: "白黒写真に、もう一度、あの日の色を。端末の中だけで写真をカラー化します。",
    image: "/works/color-refine.png",
    href: "https://color-refine.com/",
    action: "使ってみる",
  },
];

export default function Home() {
  return (
    <main>
      <header className="siteHeader">
        <a className="brand" href="#top" aria-label="Maruti Lab トップ">
          <span className="brandMark"><img src="/icon-512.png" alt="" /></span>
          <span>Maruti Lab</span>
        </a>
        <nav aria-label="メインナビゲーション">
          <a href="#works">Works</a>
          <a href="#about">About</a>
          <a className="supportLink" href="https://buymeacoffee.com/marutilab" target="_blank" rel="noreferrer">Coffee</a>
        </nav>
      </header>

      <LabHero />

      <section id="yurameki" className="feature featureYurameki" aria-labelledby="yurameki-title">
        <a className="featureImage yuramekiImage imageLink" href={yuramekiUrl} target="_blank" rel="noreferrer" aria-label="YURAMEKIを開く">
          <Image src="/works/yurameki-breath.png" alt="YURAMEKIの呼吸する作例" fill priority sizes="(max-width: 800px) 100vw, 62vw" />
        </a>
        <div className="featureCopy">
          <p className="workNumber">01 / MAIN WORK</p>
          <h2 id="yurameki-title">YURAMEKI</h2>
          <p className="workTagline">一枚の絵に、息を宿す。</p>
          <p>風、衣、髪、光の気配。息づく場所を静かに囲み、止まっていた一瞬へ時間を結びます。作品は端末の中だけで息づきます。</p>
          <a className="textButton refinedLink" href={yuramekiUrl} target="_blank" rel="noreferrer"><span>YURAMEKIを開く</span></a>
        </div>
      </section>

      <section className="feature featureClock" aria-labelledby="clock-title">
        <div className="clockCopy">
          <p className="workNumber">02 / NEW RELEASE</p>
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
          <h2 id="works-title">画像を扱う、ふたつの道具。</h2>
        </div>
        <div className="worksGrid">
          {works.map((work) => (
            <article className="workCard" key={work.name}>
              <a className="cardImage imageLink" href={work.href} target="_blank" rel="noreferrer" aria-label={`${work.name}を開く`}><Image src={work.image} alt={`${work.name}の画面`} fill sizes="(max-width: 700px) 100vw, 66vw" /></a>
              <div className="cardBody">
                <div className="cardMeta"><span>{work.number}</span><span>{work.label}</span></div>
                <h3>{work.name}</h3>
                <p>{work.copy}</p>
                <a className="cardLink refinedLink" href={work.href} target="_blank" rel="noreferrer"><span>{work.action}</span></a>
              </div>
            </article>
          ))}
        </div>
        <p className="smallWork"><span>05 / LINE STICKER</span><a href="https://store.line.me/stickershop/product/35520055/ja" target="_blank" rel="noreferrer">PromptTerm StickerをLINE STOREで見る</a></p>
      </section>

      <section id="about" className="aboutSection" aria-labelledby="about-title">
        <p className="eyebrow">LAB NOTE / 000</p>
        <div>
          <h2 id="about-title">小さくつくる。<br />ちゃんと使えるところまで。</h2>
          <p>画像を動かす。整える。色を戻す。時間を表示する。Maruti Labは、思いつきを実際に触れる道具へ変え、公開し、使いながら直していく個人ラボです。</p>
        </div>
      </section>

      <section className="supportSection" aria-label="Maruti Labを支援">
        <div><p className="eyebrow">KEEP THE LAB OPEN</p><h2>気に入ったら、コーヒーを一杯。</h2></div>
        <a className="refinedLink" href="https://buymeacoffee.com/marutilab" target="_blank" rel="noreferrer"><span>Coffeeで支援する</span></a>
      </section>

      <footer>
        <div className="footerBrand">Maruti Lab</div>
        <div className="footerLinks"><a href="https://x.com/maruti_lab" target="_blank" rel="noreferrer">X / @maruti_lab</a><a href="https://note.com/a_tkms" target="_blank" rel="noreferrer">note</a><a href="https://buymeacoffee.com/marutilab" target="_blank" rel="noreferrer">Coffee</a><a href="/privacy">Privacy</a><a href="/disclaimer">Disclaimer</a></div>
        <small>© 2026 Maruti Lab</small>
      </footer>
    </main>
  );
}
