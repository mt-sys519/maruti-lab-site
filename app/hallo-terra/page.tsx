import type { Metadata } from "next";
import { SiteFooter } from "../SiteFooter";
import TerraLogo, { TerraShapes } from "./TerraLogo";
import { audio, places } from "./content";
import TerraMap from "./TerraMap";

/* The map is the page, and the map is a client component, so the metadata
   lives out here. */
export const metadata: Metadata = {
  title: { absolute: "世界の挨拶を地図から｜HALLO TERRA" },
  description:
    "世界地図から国や地域を選ぶと、その土地の挨拶・お礼・お詫びが、現地の文字とカタカナの読み、意味、挨拶の仕草とあわせて出てきます。登録不要、ブラウザだけで動く無料の世界挨拶地図。",
  keywords: ["世界の挨拶", "挨拶 世界", "こんにちは 各国語", "ありがとう 世界の言葉", "世界地図", "HALLO TERRA"],
  alternates: { canonical: "https://marutilab.com/hallo-terra" },
  // Its own tab icon: the mark with its meridian dropped, because at thirty-two
  // pixels a line inside a circle is a smudge inside a circle. Drawn once as
  // SVG, which is what almost everything asks for now, with a PNG behind it.
  icons: {
    icon: [
      { url: "/hallo-terra/icon.svg", type: "image/svg+xml" },
      { url: "/hallo-terra/icon-32.png", sizes: "32x32", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "Maruti Lab",
    title: "HALLO TERRA — 世界の挨拶を、地図から",
    description: "地図から場所を選ぶと、その土地の挨拶・お礼・お詫びと、挨拶の仕草が分かります。",
    url: "/hallo-terra",
    images: [{ url: "/og/hallo-terra-2.jpg", width: 1200, height: 630, alt: "HALLO TERRA — 世界の挨拶を、地図から" }],
  },
  twitter: { card: "summary_large_image", images: ["/og/hallo-terra-2.jpg"] },
};

export default function HalloTerraPage() {
  // Counted rather than claimed: this paragraph is the one that goes stale
  // fastest, and it had been saying most countries were empty long after they
  // had stopped being empty.
  const written = Object.keys(places).length;
  const gestured = Object.values(places).filter((p) => p.gesture).length;
  return (
    <>
      <div className="terraTitle">
        <TerraLogo size="md" />
        <p>世界の挨拶を、地図から。</p>
      </div>

      <TerraMap />

      <section className="terraNotes">
      <article className="terraAbout">
        <section>
          <TerraShapes tone="greeting" at={0} />
          <p className="terraEyebrow">ABOUT HALLO TERRA</p>
          <h2>世界の挨拶を、地図から。</h2>
          <p className="terraLede">
            HALLO TERRA は、世界地図から場所を選ぶと、その土地の挨拶・お礼・お詫びが、現地の文字と、カタカナの読みと、日本語の意味で出てくる地図です。無料で、登録は要りません。
          </p>
        </section>

        <section>
          <TerraShapes tone="thanks" at={1} />
          <h2>使い方</h2>
          <ol className="terraSteps">
            <li>
              地図を指で動かします。左右はどこまでも続いていて、太平洋をまたいでも途切れません。二本指でつまめば拡大、離せば縮小。右下の＋と−、RESET でも同じことができます。
            </li>
            <li>
              国に触れると、その場所の挨拶・お礼・お詫びが下のカード（パソコンでは右側）に出ます。小さすぎて指で狙えない国には印を置いてあるので、そこを触ってください。左上の検索からも探せます。
            </li>
            <li>
              言葉の下に「音で聞く」があれば、その言語の音が鳴ります。音のない言語のほうがまだ多いので、そのときは「相手に見せる」で文字を大きく出して、お相手に読んでもらってください。
            </li>
          </ol>
        </section>

        <section>
          <TerraShapes tone="apology" at={2} />
          <h2>この道具の願い</h2>
          <p>
            初対面のお相手にその方の言語で挨拶だけでもすると、とても素敵な笑顔で返してくれることがあります。わたしはその交流がとても大好きで、その瞬間を少しでも多くの方に体験してほしくてこのツールを作りました。
          </p>
          <p>
            まだまだ詳細まではできていないというのが実情ですので、アドバイスなどありましたら、
            <a href="/contact">問い合わせ</a>や
            <a href="https://x.com/maruti_lab" target="_blank" rel="noreferrer">Xアカウント</a>
            からいただけたら嬉しいです。
          </p>
        </section>

        <section>
          <TerraShapes tone="sky" at={3} />
          <h2>なぜ地図なのか</h2>
          <p>
            一覧表ではなく地図にしたのは、どのあたりで話されている言葉なのか、隣は何語なのかが同時に見えるからです。左右に果てがないのも同じ理由で、太平洋のむこうにも人がいます。
          </p>
        </section>

        <section>
          <TerraShapes tone="rose" at={0} />
          <h2>言葉と読みについて</h2>
          <p>
            カタカナは必ず付けていますが、近似です。日本語にない音は書き表せませんし、タイ語やベトナム語、中国語のように声調のある言語では、音の高さまでは示せません。まねる出発点として使ってください。
          </p>
          <p>
            国と言語は一対一ではないので、挨拶は国ではなく話され方に結び付けています。スイスのように複数の言葉を持つ場所も、スペイン語のように国をまたぐ言葉もあります。
          </p>
        </section>

        <section>
          <TerraShapes tone="wax" at={1} />
          <h2>仕草のこと</h2>
          <p>
            挨拶は言葉だけでできてはいないので、仕草も短く添えています。ただ、確かめられた場所だけなので、まだ一部です。同じ国でも世代や間柄で変わるので、断定する書き方も避けています。
          </p>
        </section>

        <section>
          <TerraShapes tone="greeting" at={2} />
          <h2>地図のデータ</h2>
          <p>
            国境と海岸線は Natural Earth（1:50m、パブリックドメイン）を、ミラー図法で描いています。道路や店舗は載せていません。国境の引き方は、地域によって見解が分かれます。
          </p>
        </section>

        <section>
          <TerraShapes tone="sky" at={3} />
          <h2>音声について</h2>
          <p>
            音声は Piper という音声合成で、こちらの手元で一度だけ作ったものを置いています。作るときに使った声は、広告のあるサイトで公開してよいと明記されていて、なおかつ、ひとりの声から作られたものだけに絞りました。大勢の声を混ぜて作られた音声は、誰の話し方でもない発音になることがあって、フランス語とベンガル語で実際にそうなりました。そのため用意できたのは{" "}
            {Object.keys(audio).length}の言語ぶんで、ほかは端末に入っている音声に頼るか、鳴らないかのどちらかです。日本語の声はこの条件で使えるものが見つからず、いまは鳴りません。鳴らないときは、画面をお相手に見せて発音を聞いてみてください。
          </p>
          <p>
            人の声の録音と混ぜることはしていません。半分が人の声で半分が合成だと、同じ道具の中で声が二種類あることになるからです。
          </p>
          <p className="terraNote">
            声ごとの出どころと利用条件は<a href="/hallo-terra/credits">クレジットのページ</a>にまとめています。
          </p>
          <details className="terraVoices">
            <summary>使った声と、その利用条件</summary>
            <ul>
              {[...new Map(Object.values(audio).map((a) => [a.voice, a.licence])).entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([voice, licence]) => (
                  <li key={voice}>
                    <code>{voice}</code> — {licence}
                  </li>
                ))}
            </ul>
          </details>
        </section>

        <aside className="terraAside">
          <TerraShapes tone="thanks" at={3} />
          <h2>まだできていないこと</h2>
          <p>
            挨拶そのものは{written}か所に入りましたが、深さはまだばらばらです。仕草まで添えられたのはそのうち{gestured}か所で、使い分けや発音の注意まで書けている言葉はもっと少なく、首都の名前が英語のままの場所も残っています。音声のない言語も多く、中国語とアラビア語と日本語はその中に入っています。
          </p>
        </aside>
      </article>
        <SiteFooter />
      </section>
    </>
  );
}
