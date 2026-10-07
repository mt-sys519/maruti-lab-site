import type { CSSProperties } from "react";
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

// [name, kind, what it is and how to use it, accent colour]
type Entry = [string, string, string, string?];

const weapons: Entry[] = [
  ["HALBERD", "30mm機関砲／全エリア・1", "左クリックを押している間、撃ち続けます。撃ち続けると砲身が熱を持ち、限界を超えると冷えるまで撃てなくなります。HMDで指定した敵に照準を重ねると SIGHT LINK になり、弾が速く、まとまり、威力が上がって、熱もたまりにくくなります。"],
  ["FLAIL", "散弾砲／SECTOR 01・2", "1クリックで9発の散弾。15m以内なら全弾の威力が乗り、45mあたりで3分の1まで落ちます。素早く飛び回る VANE を、照準が追いつく前に捉えるための武器です。"],
  ["MAUL", "バズーカ／SECTOR 02・2", "1クリックで1発のロケット。弾速は遅いものの、爆風が広く、当てた敵を大きくよろけさせます。弾は4発で、7秒ごとに1発戻り、ATLAS を倒すと2発戻ります。"],
  ["ARBALEST", "狙撃銃／SECTOR 03・2", "1発ずつ撃つボルトアクション。右クリックで2.6倍のスコープをのぞけます。次の弾までおよそ1秒かかるぶん、一発が重く、空の高いところを飛ぶ KITE に向いています。"],
  ["BARDICHE", "斧／全エリア・3", "近接武器。12m以内に敵がいれば踏み込んで斬りつけ、大きくよろけさせます。振りは重く、振っている間は機体の足も鈍ります。V を押すと、どの武器を持っていても一振りして元の武器に戻ります。"],
];

const hostiles: Entry[] = [
  ["VANE", "浮遊型・マゼンタ", "6〜8mの高さに浮いて、素早く横へ滑りながら2連射してきます。装甲は薄いので、見失わないことが一番の対策です。", "#ff4f86"],
  ["PIKE", "槍持ち・赤", "槍を構えて突っ込んできます。突進の最中に撃ってよろけさせると、攻撃を止められます（LANCE BREAK）。", "#ff5a4e"],
  ["BASTION", "砲台型・オレンジ", "4本脚で動きは遅いものの、長い砲身で溜めてから重い一発を撃ってきます。溜めている間によろけさせると、砲撃を止められます（CHARGE BREAK）。", "#ff9a62"],
  ["ATLAS", "大型歩行機・ガンメタルと深紅", "高さ15mの歩行機。70mほど離れたところから2門の砲で撃ってきます。撃つほど装甲板が剥がれていきます。MAUL の直撃と、足もとへ回り込む動きが効きます。", "#ff3a4a"],
  ["KITE", "飛行型・ライラック", "噴射で空を飛び、頭上を大きく旋回しては、1機ずつ急降下して撃ってきます。撃ったあとはまた上昇するので、高いところにいる間は ARBALEST で狙えます。", "#c27bff"],
];

const sectors: Entry[] = [
  ["SECTOR 01", "TRANSFER DISTRICT", "送電施設の街区。VANE・PIKE・BASTION が待ち構えています。2本目の武器は FLAIL。", "#5fd4e0"],
  ["SECTOR 02", "FREIGHT TUNNEL", "天井の低い貨物トンネル。PIKE と BASTION の奥に、ATLAS が2体並んでいます。2本目の武器は MAUL。", "#5fd4e0"],
  ["SECTOR 03", "SKYDECK", "夜明けの発着場。KITE の編隊と地上の機体を相手にします。2本目の武器は ARBALEST。", "#5fd4e0"],
];

const steps: [string, string][] = [
  ["見て、指定する", "敵を約0.3秒見つめると、HMD がその敵を指定して印を付けます。眠っている敵は、指定すると目を覚まします。カメラで遊んでいるなら、顔を向けて見つめるだけで指定できます。"],
  ["指定した敵に照準を重ねる（SIGHT LINK）", "指定した敵に HALBERD の照準を重ねると SIGHT LINK になり、弾が強くなります。顔で次の敵を見つけて指定し、マウスで照準を合わせる。これがこのゲームの基本の流れです。"],
  ["FLOW をためて SYNC DRIVE", "指定、SIGHT LINK での命中、突進や砲撃の阻止、ぎりぎりでの回避で FLOW がたまります。満タンになると、4.5秒の SYNC DRIVE に入ります。視界が金色に変わり、ブーストが回復して砲身が冷え、弾の威力も上がります。SYNC DRIVE 中に敵を倒すと、そのぶん時間が延びます。"],
  ["走る、跳ぶ", "蒼鉄は足の車輪で走ります。地上でブーストすると、車輪が一瞬空転してから一気に加速します。ジャンプ中のブーストは背中の噴射で、1回のジャンプにつき1回だけ使えます。見えていない敵の方角は、画面上の時計の下にあるソナーの帯で確かめられます。"],
];

const guide: [string, string][] = [
  ["play", "戦い方"],
  ["arms", "武器"],
  ["hostiles", "敵"],
  ["sectors", "エリアとモード"],
  ["controls", "操作"],
  ["camera", "カメラについて"],
  ["caution", "遊ぶ前に"],
  ["specs", "動作環境"],
];

function Entries({ items }: { items: Entry[] }) {
  return (
    <dl className="hfEntries">
      {items.map(([name, kind, text, color]) => (
        <div key={name} style={color ? ({ "--c": color } as CSSProperties) : undefined}>
          <dt>
            {name}
            <span>{kind}</span>
          </dt>
          <dd>{text}</dd>
        </div>
      ))}
    </dl>
  );
}

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
                どこにも通信がつながっていない旧式の機体。足の車輪で月面を走り、背中の噴射で跳ぶ。
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

        <nav className="hfGuide" aria-label="このページの目次">
          {guide.map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </nav>

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

        <div className="hfBand hfBand-play">
          <section className="hfSection" id="play" data-en="COMBAT">
            <h2>戦い方</h2>
            <ol className="hfSteps">
              {steps.map(([title, text], i) => (
                <li key={title}>
                  <span className="hfStepNo">{String(i + 1).padStart(2, "0")}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="hfBand hfBand-arms">
          <section className="hfSection" id="arms" data-en="ARMS">
            <h2>武器</h2>
            <p>
              持てる武器は3つです。1 が HALBERD、2 がそのエリアで渡される2本目の武器、3 が斧の BARDICHE です。SECTOR ごとに2本目が変わります。
            </p>
            <Entries items={weapons} />
          </section>
        </div>

        <div className="hfBand hfBand-hostiles">
          <section className="hfSection" id="hostiles" data-en="HOSTILES">
            <h2>敵</h2>
            <p>施設のネットワークに乗っ取られた機械たちです。種類ごとに色が分かれています。</p>
            <Entries items={hostiles} />
          </section>
        </div>

        <div className="hfBand hfBand-sectors">
          <section className="hfSection" id="sectors" data-en="SECTORS">
            <h2>エリアとモード</h2>
            <p>
              「ミッション」では3つのエリアを順に進み、SECTOR 03 を抜けると作戦完了です。はじめに操作説明があり、2回目からは Tab で飛ばせます。
            </p>
            <Entries items={sectors} />
            <p>
              「サバイバル」は、倒れるまで戦い続けるモードです。武器はすべて持った状態で始まり、6機倒すごとに敵が強くなり、途中からは KITE も加わります。機体の修理はありません。
            </p>
          </section>
        </div>

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

        <section className="hfSection" id="specs">
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
