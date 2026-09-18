import type { Metadata } from "next";
import { SiteFooter } from "../../SiteFooter";
import TerraLogo, { TerraShapes } from "../TerraLogo";
import credits from "../credits.generated.json";
import { audio } from "../content";

/**
 * Who to thank, and what they asked for in return.
 *
 * Most of the voices are CC0 or public domain and owe nobody anything. Four
 * are not: two want their source named, and two want that plus the same terms
 * passed on to whatever is made with them. That is a condition, not a
 * courtesy, so it is written out here in full rather than implied by a list
 * of file names - which is all the page had before.
 *
 * The table is generated: scripts/hallo-terra-credits.mjs reads each voice's
 * model card and writes down where it came from, so this cannot drift from
 * what is actually being played.
 */
export const metadata: Metadata = {
  title: { absolute: "クレジットと利用条件｜HALLO TERRA" },
  description: "HALLO TERRA が使っている音声・地図・書体の出どころと、その利用条件。",
  alternates: { canonical: "https://marutilab.com/hallo-terra/credits" },
};

const SHARE_ALIKE = ["CC BY-SA 3.0 ES", "Attribution-ShareAlike 4.0 International"];
const NAMED = ["CC-BY 4.0", "CC-BY-4.0", ...SHARE_ALIKE];

type Credit = { language: string; quality: string; dataset: string; licence: string; card: string };
const voices = Object.entries(credits as Record<string, Credit>);
const asked = voices.filter(([, c]) => NAMED.includes(c.licence) || /apache|mit/i.test(c.licence));
const free = voices.filter(([voice]) => !asked.some(([named]) => named === voice));
const shareAlike = voices.filter(([, c]) => SHARE_ALIKE.includes(c.licence));

/** The languages a clip is played in, for the voices that carry conditions. */
const spokenBy = (voice: string) =>
  Object.entries(audio)
    .filter(([, a]) => a.voice === voice)
    .map(([variety]) => variety);

function Row({ voice, credit }: { voice: string; credit: Credit }) {
  return (
    <li>
      <code>{voice}</code>
      <span className="terraCreditWhere">
        {credit.language || "—"} ／{" "}
        {credit.dataset ? (
          <a href={credit.dataset} target="_blank" rel="noreferrer">
            元データ
          </a>
        ) : (
          <a href={credit.card} target="_blank" rel="noreferrer">
            モデルカード
          </a>
        )}{" "}
        ／ {credit.licence}
      </span>
    </li>
  );
}

export default function CreditsPage() {
  return (
    <>
      <div className="terraTitle">
        <TerraLogo size="md" />
        <p>クレジットと利用条件</p>
      </div>

      <section className="terraNotes">
        <article className="terraAbout">
          <section>
            <TerraShapes tone="greeting" at={0} />
            <p className="terraEyebrow">CREDITS</p>
            <h2>お借りしているもの</h2>
            <p className="terraLede">
              HALLO TERRA の音声と地図は、他の方が作って公開してくださったものを使わせてもらっています。そのうちいくつかは、名前を書くことや、同じ条件で公開することを条件にしています。ここはその条件を果たすためのページです。
            </p>
          </section>

          <section>
            <TerraShapes tone="wax" at={3} />
            <h2>どうやって作ったか</h2>
            <p>
              音声は Piper という音声合成を手元で動かして、一度だけ作ったものを置いています。声を選ぶときの条件は二つで、広告のあるサイトで公開してよいと明記されていること、そして、ひとりの声から作られたものであることです。大勢の声を混ぜて作られた音声は、誰の話し方でもない発音になることがあって、フランス語とベンガル語で実際にそうなりました。条件に合う声が見つからない言語は、鳴らないままにしてあります。
            </p>
            <p>
              人の声の録音と混ぜることはしていません。半分が人の声で半分が合成だと、同じ道具の中に声が二種類あることになるからです。
            </p>
          </section>

          <section>
            <TerraShapes tone="thanks" at={1} />
            <h2>名前を書く約束のある声</h2>
            <p>
              下の{asked.length}件は、出どころを示すことが条件です。声の名前、言語、元になった音声データ、ライセンスの順に並べています。
            </p>
            <ul className="terraCreditList">
              {asked.map(([voice, credit]) => (
                <Row key={voice} voice={voice} credit={credit} />
              ))}
            </ul>
          </section>

          <section>
            <TerraShapes tone="apology" at={2} />
            <h2>同じ条件で渡すもの</h2>
            <p>
              このうちカタルーニャ語とスペイン語の声は ShareAlike、つまり「これで作ったものも同じ条件で公開すること」を求めています。したがって、この二つの声で作った音声ファイル（このサイトが配信している{shareAlike.flatMap(([voice]) => spokenBy(voice)).length}の地域ぶん）は、元と同じ条件のもとで提供します。ほかの音声や、ページの文章、地図はこの条件には含まれません。
            </p>
          </section>

          <section>
            <TerraShapes tone="sky" at={3} />
            <h2>そのほかの声</h2>
            <p>
              残りの{free.length}件は CC0 かパブリックドメインで、条件はありません。それでも、この道具はこの方々の仕事の上に立っているので、同じように書いておきます。
            </p>
            <ul className="terraCreditList">
              {free.map(([voice, credit]) => (
                <Row key={voice} voice={voice} credit={credit} />
              ))}
            </ul>
          </section>

          <section>
            <TerraShapes tone="rose" at={0} />
            <h2>地図と、声を作った道具</h2>
            <p>
              国境と海岸線は Natural Earth（1:50m および 1:10m、パブリックドメイン）です。音声は{" "}
              <a href="https://github.com/OHF-voice/piper1-gpl" target="_blank" rel="noreferrer">
                Piper
              </a>
              （MIT）を手元で動かして作りました。声のモデルは{" "}
              <a href="https://huggingface.co/rhasspy/piper-voices" target="_blank" rel="noreferrer">
                rhasspy/piper-voices
              </a>
              から取っています。書体は Zen Maru Gothic と Inter（どちらも SIL Open Font License）です。
            </p>
            <p className="terraNote">
              誤りや、書き漏らしている条件がありましたら、
              <a href="/contact">問い合わせ</a>から教えてください。すぐ直します。
            </p>
          </section>
        </article>
        <SiteFooter />
      </section>
    </>
  );
}
