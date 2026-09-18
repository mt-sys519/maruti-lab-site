import type { Metadata } from "next";
import TerraMap from "./TerraMap";

/* The map is the page, and the map is a client component, so the metadata
   lives out here. */
export const metadata: Metadata = {
  title: { absolute: "世界の挨拶を地図から｜HALLO TERRA" },
  description:
    "世界地図から国や地域を選ぶと、その土地の挨拶・お礼・お詫びが、現地の文字とカタカナの読み、意味、挨拶の仕草とあわせて出てきます。登録不要、ブラウザだけで動く無料の世界挨拶地図。",
  keywords: ["世界の挨拶", "挨拶 世界", "こんにちは 各国語", "ありがとう 世界の言葉", "世界地図", "HALLO TERRA"],
  alternates: { canonical: "https://marutilab.com/hallo-terra" },
  // The URL is live before the content is. An unlinked page is still a page
  // anyone can reach, and a map with 36 countries written up is exactly the
  // thin thing not to hand a crawler; this comes off when HALLO TERRA joins
  // Works and the sitemap.
  robots: { index: false, follow: true },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "Maruti Lab",
    title: "HALLO TERRA — 世界の挨拶を、地図から",
    description: "地図から場所を選ぶと、その土地の挨拶・お礼・お詫びと、挨拶の仕草が分かります。",
  },
  twitter: { card: "summary_large_image" },
};

export default function HalloTerraPage() {
  return (
    <>
      <TerraMap />

      <p className="terraScroll">
        <i aria-hidden="true" />
        このツールについて
      </p>

      <article className="terraAbout">
        <section>
          <p className="terraEyebrow">ABOUT HALLO TERRA</p>
          <h2>世界の挨拶を、地図から。</h2>
          <p className="terraLede">
            HALLO TERRA は、世界地図から場所を選ぶと、その土地の挨拶・お礼・お詫びが、現地の文字と、カタカナの読みと、日本語の意味で出てくる地図です。無料で、登録は要りません。
          </p>
        </section>

        <section>
          <h2>使い方</h2>
          <ol className="terraSteps">
            <li>
              地図を指で動かします。左右はどこまでも続いていて、太平洋をまたいでも途切れません。二本指でつまめば拡大、離せば縮小。右下の＋と−、RESET でも同じことができます。
            </li>
            <li>
              国に触れると、その場所の挨拶・お礼・お詫びが下のカード（パソコンでは右側）に出ます。小さすぎて指で狙えない国には印を置いてあるので、そこを触ってください。左上の検索からも探せます。
            </li>
            <li>言葉の下の「音で聞く」で、その言語の音が鳴ります。</li>
          </ol>
        </section>

        <section>
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
          <h2>なぜ地図なのか</h2>
          <p>
            一覧表ではなく地図にしたのは、どのあたりで話されている言葉なのか、隣は何語なのかが同時に見えるからです。左右に果てがないのも同じ理由で、太平洋のむこうにも人がいます。
          </p>
        </section>

        <section>
          <h2>言葉と読みについて</h2>
          <p>
            カタカナは必ず付けていますが、近似です。日本語にない音は書き表せませんし、タイ語やベトナム語、中国語のように声調のある言語では、音の高さまでは示せません。まねる出発点として使ってください。
          </p>
          <p>
            国と言語は一対一ではないので、挨拶は国ではなく話され方に結び付けています。スイスのように複数の言葉を持つ場所も、スペイン語のように国をまたぐ言葉もあります。
          </p>
        </section>

        <section>
          <h2>仕草のこと</h2>
          <p>
            挨拶は言葉だけでできてはいないので、仕草も短く添えています。ただ、同じ国でも世代や間柄で変わるので、断定する書き方は避けています。
          </p>
        </section>

        <section>
          <h2>地図のデータ</h2>
          <p>
            国境と海岸線は Natural Earth（1:50m、パブリックドメイン）を、ミラー図法で描いています。道路や店舗は載せていません。国境の引き方は、地域によって見解が分かれます。
          </p>
        </section>

        <aside className="terraAside">
          <h2>まだできていないこと</h2>
          <p>
            挨拶を書けている場所はまだ一部で、多くの国は「まだ書けていません」と出ます。音声もお使いの端末に入っているものを借りているため、言語によっては鳴りません。
          </p>
        </aside>
      </article>
    </>
  );
}
