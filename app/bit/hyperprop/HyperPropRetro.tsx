"use client";

/* eslint-disable @next/next/no-img-element -- small fixed pixel-art screenshots, served as is */
import { HyperPropGame } from "../HyperPropGame";
import { RetroBar, RetroFooter } from "../retro/RetroBar";
import { RetroCart } from "../retro/RetroCart";
import { useRetroLang } from "../retro/retroLang";

const LABEL = "/bit/retro/hyperprop-label.jpg";

// Every word on the page, in both languages. The game's own words live in the engine.
const TEXT = {
  ja: {
    kind: "人力飛行ゲーム",
    lead: "高台で機体を抱えて走り、飛び乗って、漕いで湖を越える。ペダルを連打する人力飛行ゲーム。",
    goal: "400m 先の GOAL まで飛べばクリア。水に落ちると、そこまでの距離が記録に残ります。",
    feat: ["1 PLAYER", "9 STAGES", "RAPID TAP", "JP / EN"],
    how: [
      ["RUN", "ペダルを人差し指と中指で連打して走る"],
      ["BOARD", "赤い杭のところで ▲ を押して飛び乗る"],
      ["PITCH", "▲ ▼ で機首を上げ下げ。水に落ちないように"],
    ],
    // the data box a magazine ran with a new release; the date waits for the public launch
    spec: [
      ["発売日", "COMING SOON"],
      ["ジャンル", "人力飛行アクション"],
      ["プレイ人数", "1人"],
      ["ステージ", "9"],
      ["対応機種", "MB-01 RETRO"],
      ["価格", "FREE"],
      ["セーブ", "ベストタイム記録"],
    ],
    care: "連打は指や手首に負担がかかります。続けて長く遊ばず、痛みやしびれを感じたらすぐに休んでください。",
    shots: ["湖の上を飛ぶところ", "4面、ナイルの上を飛ぶところ"],
    label: "HYPER PROP のカートリッジ",
    soon: "COMING SOON",
  },
  en: {
    kind: "A human-powered flight game",
    lead: "Run with the plane along the hilltop, jump aboard, pedal hard and cross the lake. A flight game about drumming the pedals.",
    goal: "Fly 400m to the GOAL to clear a stage. Come down in the water and the distance you made is kept as your record.",
    feat: ["1 PLAYER", "9 STAGES", "RAPID TAP", "JP / EN"],
    how: [
      ["RUN", "Drum the pedals with your index and middle fingers to run"],
      ["BOARD", "At the red stake, press ▲ to jump aboard"],
      ["PITCH", "▲ ▼ tip the nose. Keep out of the water"],
    ],
    spec: [
      ["RELEASE", "COMING SOON"],
      ["GENRE", "Human-powered flight"],
      ["PLAYERS", "1"],
      ["STAGES", "9"],
      ["SYSTEM", "MB-01 RETRO"],
      ["PRICE", "FREE"],
      ["SAVE", "Best times"],
    ],
    care: "Drumming is hard on fingers and wrists. Don't play for too long at a stretch, and stop right away if anything hurts or goes numb.",
    shots: ["Flying over the lake", "Stage 4, flying over the Nile"],
    label: "The HYPER PROP cartridge",
    soon: "COMING SOON",
  },
} as const;

export function HyperPropRetro() {
  const [lang, setLang] = useRetroLang();
  const t = TEXT[lang];

  return (
    <main className="rtPage" lang={lang}>
      <RetroBar serial="RETRO 01" lang={lang} onLang={setLang} />

      <section className="rtStage">
        <HyperPropGame lang={lang} />
        <div className="rtSide">
          <RetroCart label={LABEL} alt={t.label} />
          <div className="rtInfo">
            <p>
              RETRO 01
              <br />
              HYPER PROP
            </p>
            <dl className="rtSpec">
              {t.spec.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="rtBack">
        <h1>HYPER PROP</h1>
        <p className="rtKind">{t.kind}</p>
        <p className="rtLead">{t.lead}</p>
        <p className="rtGoal">{t.goal}</p>
        <ul className="rtFeat">
          {t.feat.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <div className="rtShots">
          <img src="/bit/retro/hyperprop-shot-flight.png" alt={t.shots[0]} width={256} height={192} />
          <img src="/bit/retro/hyperprop-shot-nile.png" alt={t.shots[1]} width={256} height={192} />
        </div>
        <ol className="rtHow">
          {t.how.map(([k, v]) => (
            <li key={k}>
              <b>{k}</b>
              {v}
            </li>
          ))}
        </ol>
        <p className="rtCare">{t.care}</p>
      </section>

      <section className="rtShelf">
        <h2>RETRO SERIES</h2>
        <div className="rtRow">
          <RetroCart label={LABEL} alt={t.label} />
          <RetroCart soon={t.soon} />
          <RetroCart soon={t.soon} />
        </div>
      </section>

      <RetroFooter />
    </main>
  );
}
