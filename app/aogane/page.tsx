import type { Metadata } from "next";
import { SiteFooter } from "../SiteFooter";

const playUrl = "/aogane/play/";

export const metadata: Metadata = {
  title: { absolute: "蒼鉄 -AOGANE-｜WEBカメラ式ヘッドトラッキングFPS" },
  description:
    "ウェブカメラで頭の動きを読み取り、機体に乗り込んだように周りを見回して戦うヘッドトラッキングFPS。カメラなしでも、ゲームパッドでも遊べます。PCのブラウザで動く、Maruti Labの開発中のゲームです。",
  alternates: { canonical: "https://marutilab.com/aogane" },
  // Live before it is announced: the game is unfinished and the page is not
  // linked from anywhere yet. This comes off, and /aogane joins the
  // sitemap and the front page, on the day it is published.
  robots: { index: false, follow: false },
};

// [keyboard / mouse, Xbox-layout pad, what it does]
const controls: [string, string, string][] = [
  ["W A S D", "左スティック", "移動"],
  ["SHIFT", "B", "ブースト"],
  ["SPACE", "A", "ジャンプ"],
  ["マウス", "右スティック", "武器の向き"],
  ["左クリック", "RT", "撃つ・振る"],
  ["右クリック", "LT", "スコープ（ARBALEST）"],
  ["ホイール / 1・2・3", "Y", "武器の切り替え（3は斧）"],
  ["V", "X", "斧をとっさに振る"],
  ["Q / E", "LB / RB", "視点を左右へ（カメラなしのとき）"],
  ["C", "R3", "視点を正面に戻す"],
  ["ESC", "メニュー", "メニュー"],
  ["R", "—", "再出撃"],
];

export default function AoganePage() {
  return (
    <>
      <main className="hfMain">
        <section className="hfHero">
          {/* Key art: AOI beside her frame. It is the first thing to catch the eye, so it sits beside the
              name on a wide screen and under it on a phone. The art may still change. poster-1024.webp (the same scene with 蒼鉄 lettered on it) waits for the front page and the OG image on the day it is announced. */}
          <figure className="hfKey">
            {/* eslint-disable-next-line @next/next/no-img-element -- two fixed WebP sizes, served as is */}
            <img
              src="/aogane/key-900.webp?v=2"
              srcSet="/aogane/key-560.webp?v=2 560w, /aogane/key-900.webp?v=2 900w"
              sizes="(max-width: 860px) 100vw, 420px"
              width={900}
              height={1350}
              alt="ヘルメットを手に提げたパイロットのAOIと、背後に立つ白と黒の機体「蒼鉄」。格納庫の向こうに月面と地球が見える"
            />
          </figure>
          <p className="hfEyebrow">MANNED FRAME / IN DEVELOPMENT</p>
          <h1>
            蒼鉄
            <small>-AOGANE-</small>
          </h1>
          <p className="hfLead">
            WEBカメラ式ヘッドトラッキングFPS
          </p>
          <dl className="hfCast">
            <div>
              <dt>
                AOI<span>パイロット</span>
              </dt>
              <dd>
                補正も制御もない旧式の機体を、自分の目と手だけで乗りこなすエース。地球へ帰るために、暴走した施設の奥へ向かう。
              </dd>
            </div>
            <div>
              <dt>
                蒼鉄<span>有人機</span>
              </dt>
              <dd>
                どこにも通信がつながっていない旧式の機体。窓はなく、パイロットはヘルメットに映る外の映像だけを頼りに戦う。足の車輪で月面を走り、背中の噴射で跳ぶ。
              </dd>
            </div>
          </dl>
          <div className="hfActions">
            <a className="hfPlay" href={playUrl}>
              ゲームを開く
            </a>
            <p className="hfNeed">
              <span>PC専用</span>
              <span>マウスとキーボード、またはゲームパッド</span>
              <span>ウェブカメラは任意</span>
            </p>
          </div>
          <p className="hfTouchNote">
            スマートフォンとタブレットでは遊べません。PCで開いてください。
          </p>
        </section>

        <section className="hfSection" id="story">
          <h2>あらすじ</h2>
          <p>
            地球へ電力を送る月面の送電施設で、管理AIが暴走した。AIは送電を守るために人を脅威とみなし、施設のネットワークにつながる機械をすべて乗っ取った。遠隔で操る機体は、施設に入ったとたんに敵へ寝返ってしまう。
          </p>
          <p>
            残された手は、どこにもつながっていない旧式の有人機「蒼鉄」だけ。照準の補正も姿勢の制御もなく、自分の目と手で動かすしかないこの機体を乗りこなせるのは、パイロットのAOIしかいない。
          </p>
          <p>
            目的はAIの中枢を押さえ、地球へ帰ること。AOIと蒼鉄は、施設街から貨物トンネル、そして夜明けの発着場へと進んでいく。
          </p>
        </section>

        <section className="hfSection">
          <h2>どんなゲームか</h2>
          <p>
            ウェブカメラが顔の向きを読み取り、頭を動かすと、ヘルメットの中から見る視界（HMD）がそのまま動きます。画面の前に座ったまま、機体に乗り込んで周りを見回している感覚で戦えるのが、このゲームの醍醐味です。
          </p>
          <p>
            銃は頭とは別に、マウスかパッドの右スティックで狙います。カメラがなくても、Q と E（パッドなら LB と RB）で視点を左右に振って遊べます。
          </p>
        </section>

        <section className="hfSection" id="controls">
          <h2>操作</h2>
          <dl className="hfKeys">
            <div className="hfKeysHead" aria-hidden="true">
              <span>キーボード・マウス</span>
              <span>パッド</span>
              <span />
            </div>
            {controls.map(([key, padKey, what]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dt className="hfPadKey">{padKey}</dt>
                <dd>{what}</dd>
              </div>
            ))}
          </dl>
          <p className="hfSmall">
            ゲームを開いたら「ミッション」で出撃、「サバイバル」は倒れるまで戦い続けるモードです。「カメラで遊ぶ」で顔の向きで視点が動くようになり、「全画面」で全画面になります。
          </p>
          <p className="hfSmall">
            ゲームパッドは Xbox 配置です。パッドを触ると、ゲーム内の画面下の操作表示がパッド用に切り替わります。
          </p>
        </section>

        <section className="hfSection" id="camera">
          <h2>カメラについて</h2>
          <p>
            カメラは「カメラで遊ぶ」を押したときだけ使い、そのときブラウザが許可を求めます。映像はお使いの端末の中で顔の向きを計算するためだけに使い、録画も保存もせず、Maruti Lab を含めどこへも送りません。
          </p>
          <p>
            顔の向きの計算には Google の MediaPipe を使っています。そのプログラムと学習済みモデルは、初めてカメラを使うときに jsDelivr（cdn.jsdelivr.net）と Google（storage.googleapis.com）から読み込みます。この読み込みにカメラの映像は含まれません。
          </p>
        </section>

        <section className="hfSection" id="caution">
          <h2>遊ぶ前に</h2>
          <ul>
            <li>画面が大きく動くゲームです。画面酔いしやすい方はご注意ください。気分が悪くなったら、すぐにやめて休んでください。視点の動きの大きさは、ゲーム内の「設定」にある「トラッキングの感度」で下げられます。</li>
            <li>カメラを使うときは、明るい部屋で遊んでください。暗い部屋や、窓を背にした逆光では顔を見つけられず、視点が動かなくなります。</li>
          </ul>
        </section>

        <section className="hfSection">
          <h2>動作環境</h2>
          <ul>
            <li>PC（マウスとキーボード、または Xbox 配置のゲームパッド）。スマートフォンとタブレットには対応していません。</li>
            <li>Google Chrome または Microsoft Edge の最新版（Firefox と Safari は動作未確認）。WebGL 2 が使えない環境では軽い描画方式に切り替わりますが、動きが重くなります。</li>
            <li>ウェブカメラは任意です。</li>
            <li>動きが重いときは、ゲーム内の「設定」で「解像度」を下げるか、「発光」を弱にしてください。解像度の％は今の画面の大きさに対する割合で、たとえば 1920×1080 の全画面なら 75% で 1440×810、50% で 960×540 で描きます。</li>
          </ul>
          <p className="hfSmall">開発中のゲームです。内容やバランスは予告なく変わります。</p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
