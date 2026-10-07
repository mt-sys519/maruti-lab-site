import type { Metadata } from "next";
import { SiteFooter } from "../SiteFooter";

const playUrl = "/aogane/play/";

export const metadata: Metadata = {
  title: { absolute: "蒼鉄 -AOGANE-｜首で探して、マウスで撃つ" },
  description:
    "首の向きで索敵し、マウスで武器を向ける一人称のメカアクション。ウェブカメラで頭の動きを読み取れます（なくても遊べます）。PCのブラウザで動く、Maruti Labの開発中のゲームです。",
  alternates: { canonical: "https://marutilab.com/aogane" },
  // Live before it is announced: the game is unfinished and the page is not
  // linked from anywhere yet. This comes off, and /aogane joins the
  // sitemap and the front page, on the day it is published.
  robots: { index: false, follow: false },
};

const controls: [string, string][] = [
  ["W A S D", "移動"],
  ["SHIFT", "ブースト"],
  ["SPACE", "ジャンプ"],
  ["マウス", "武器の向き"],
  ["左クリック", "撃つ・振る"],
  ["右クリック", "スコープ（ARBALEST）"],
  ["ホイール / 1・2・3", "武器の切り替え（3は斧）"],
  ["V", "斧をとっさに振る"],
  ["Q / E", "首を左右へ（カメラなしのとき）"],
  ["C", "首の向きを正面に戻す"],
  ["ESC", "メニュー"],
  ["R", "再出撃"],
];

export default function AoganePage() {
  return (
    <>
      <main className="hfMain">
        <section className="hfHero">
          {/* Key art: AOI beside her frame. It is the first thing to catch the eye, so it sits beside the
              name on a wide screen and under it on a phone. The art may still change. */}
          <figure className="hfKey">
            {/* eslint-disable-next-line @next/next/no-img-element -- two fixed WebP sizes, served as is */}
            <img
              src="/aogane/key-900.webp"
              srcSet="/aogane/key-560.webp 560w, /aogane/key-900.webp 900w"
              sizes="(max-width: 860px) 100vw, 420px"
              width={900}
              height={1125}
              alt="パイロットのAOIと、白と黒の装甲に青い光のラインが走る機体。格納庫に並んで立っている"
            />
          </figure>
          <p className="hfEyebrow">MANNED FRAME / IN DEVELOPMENT</p>
          <h1>
            蒼鉄
            <small>-AOGANE-</small>
          </h1>
          <p className="hfLead">
            首は索敵、マウスは武器、機体は遅れてついてくる。
            <br />
            頭の向きと銃の向きを切り離したまま戦う、一人称のメカアクションです。
          </p>
          <p className="hfLead">
            地球へ電力を送る月面施設で、管理AIが暴走しました。施設のネットワークにつながる機械は、遠隔で操る機体も含めてすべてAIに乗っ取られます。
            <br />
            通信を持たない旧式の有人機「蒼鉄」に乗り、エースパイロットのAOIがAIの中枢を奪いに向かいます。
          </p>
          <div className="hfActions">
            <a className="hfPlay" href={playUrl}>
              ゲームを開く
            </a>
            <p className="hfNeed">
              <span>PC専用</span>
              <span>マウスとキーボードが要ります</span>
              <span>ウェブカメラは任意</span>
            </p>
          </div>
          <p className="hfTouchNote">
            スマートフォンとタブレットでは遊べません。マウスとキーボードのあるPCで開いてください。
          </p>
        </section>

        <section className="hfSection">
          <h2>どんなゲームか</h2>
          <p>
            ヘルメットの中から見る視界（HMD）は、首を向けた方向を映します。武器は首とは別に、マウスで向けます。正面の敵を撃ちながら、首だけ横へ振って次の敵を探す。その二つを同時に扱うのがこのゲームの中心です。
          </p>
          <p>
            ウェブカメラがあれば、実際に頭を動かすと視界が動きます。カメラがなくても、Q と E のキーで首を振って遊べます。
          </p>
        </section>

        <section className="hfSection" id="controls">
          <h2>操作</h2>
          <dl className="hfKeys">
            {controls.map(([key, what]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{what}</dd>
              </div>
            ))}
          </dl>
          <p className="hfSmall">
            ゲームを開いたら DEPLOY で出撃、ENDURANCE は耐久モードです。HEAD TRACKING でカメラを使った首の操作に切り替わり、FULL SCREEN で全画面になります。
          </p>
        </section>

        <section className="hfSection" id="camera">
          <h2>カメラについて</h2>
          <p>
            カメラは HEAD TRACKING を押したときだけ使い、そのときブラウザが許可を求めます。映像はお使いの端末の中で顔の向きを計算するためだけに使い、録画も保存もせず、Maruti Lab を含めどこへも送りません。
          </p>
          <p>
            顔の向きの計算には Google の MediaPipe を使っています。そのプログラムと学習済みモデルは、初めてカメラを使うときに jsDelivr（cdn.jsdelivr.net）と Google（storage.googleapis.com）から読み込みます。この読み込みにカメラの映像は含まれません。
          </p>
        </section>

        <section className="hfSection">
          <h2>動作環境</h2>
          <ul>
            <li>マウスとキーボードのあるPC。スマートフォンとタブレットには対応していません。</li>
            <li>WebGL 2 が使えるブラウザ。使えない環境では軽い描画方式に切り替わりますが、動きが重くなります。</li>
            <li>ウェブカメラは任意です。</li>
          </ul>
          <p className="hfSmall">開発中のゲームです。内容やバランスは予告なく変わります。</p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
