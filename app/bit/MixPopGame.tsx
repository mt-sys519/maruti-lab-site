"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createMixPopAudio, type MixPopAudio } from "./mixPopAudio";
import { cardFile, drawMixPopCard } from "./mixPopCard";
import { DRINKS, juice, nameMix, thinly } from "./mixPopNames";

// Every MarutiBit game remembers the sound switch under the same key, so
// turning it off in one turns it off in all of them.
const SOUND_STORAGE_KEY = "marutibit:sound-enabled";
const CAP = 300;
const POUR = 30;
const ICE_MAX = 6;
// Where each cube sits and how it lies, fixed per cube so the ice does not
// rearrange itself every render.
const ICE_AT = [-34, 4, -12, 30, -24, 16];
const ICE_UP = [0, 2, -3, 1, -4, -1];
const ICE_TURN = [-11, 8, -3, 15, 6, -14];
const CUBE = 29;

const mix = (amounts: number[], pick: (i: number) => [number, number, number], fallback: number) => {
  const total = amounts.reduce((a, b) => a + b, 0);
  if (!total) return [fallback, fallback, fallback] as [number, number, number];
  return [0, 1, 2].map((c) => Math.round(amounts.reduce((sum, ml, i) => sum + pick(i)[c] * ml, 0) / total)) as [number, number, number];
};

// The drawn icons from the prototype: a glass for drinking it, a tag for
// naming it, a box-and-arrow for the share sheet, and X's own mark. Drawn
// here so they are the same line and the same size on every machine.
const CupIcon = () => (
  <svg className="mpIco" viewBox="0 0 12 12" aria-hidden="true">
    <path d="M3.2 2.2h5.6l-.7 7.3a.9.9 0 0 1-.9.8H4.8a.9.9 0 0 1-.9-.8z" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M3.5 5.7h5" stroke="currentColor" strokeWidth="1.1" />
  </svg>
);
const TagIcon = () => (
  <svg className="mpIco" viewBox="0 0 12 12" aria-hidden="true">
    <path d="M6.6 1.2h4.2v4.2L6 10.2 1.8 6z" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    <circle cx="8.9" cy="3.1" r=".9" fill="currentColor" />
  </svg>
);
const ShareIcon = () => (
  <svg className="mpIco" viewBox="0 0 12 12" aria-hidden="true">
    <path d="M6 1.4v6" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
    <path d="M3.7 3.5 6 1.3l2.3 2.2" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2.4 6.6v3.1c0 .4.3.7.7.7h5.8c.4 0 .7-.3.7-.7V6.6" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
  </svg>
);
const XIcon = () => (
  <svg className="mpIco" viewBox="0 0 12 12" aria-hidden="true">
    <path d="M1.6 1.6h2.3l6.5 8.8H8.1z" fill="currentColor" />
    <path d="M1.9 10.4 4.9 7M7.2 5 10.2 1.6" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
  </svg>
);

export function MixPopGame() {
  const [amounts, setAmounts] = useState<number[]>(() => DRINKS.map(() => 0));
  const [ice, setIce] = useState(0);
  const [cubes, setCubes] = useState(0);
  const [pouring, setPouring] = useState(-1);
  const [drinking, setDrinking] = useState(false);
  const [sip, setSip] = useState("");
  const [named, setNamed] = useState<{ name: string; rows: string[]; serial: number } | null>(null);
  const [message, setMessage] = useState("");
  const [sound, setSound] = useState(true);
  const [floatPx, setFloatPx] = useState(-CUBE);

  const audio = useRef<MixPopAudio | null>(null);
  const hold = useRef<{ delay?: number; repeat?: number }>({});
  const timers = useRef<number[]>([]);
  const effect = useRef<number | undefined>(undefined);
  const soundOff = useRef<number | undefined>(undefined);
  const serial = useRef(0);
  const pouringRef = useRef(-1);
  const innerRef = useRef<HTMLDivElement>(null);

  const total = amounts.reduce((a, b) => a + b, 0);
  const fizz = total ? amounts.reduce((sum, ml, i) => sum + DRINKS[i].fizz * ml, 0) / total : 0;
  const deep = useMemo(() => mix(amounts, (i) => juice(DRINKS[i]), 220), [amounts]);
  const thin = useMemo(() => mix(amounts, (i) => thinly(DRINKS[i]), 235), [amounts]);

  const ear = () => (audio.current ??= createMixPopAudio());

  useEffect(() => {
    // Off a tick, the way the other games read it: the server has no storage
    // to read, so the switch starts on and corrects itself once mounted.
    let alive = true;
    void (async () => {
      await Promise.resolve();
      if (!alive) return;
      let stored = true;
      try {
        stored = window.localStorage.getItem(SOUND_STORAGE_KEY) !== "false";
      } catch {
        /* Local storage is optional. */
      }
      if (!stored) {
        setSound(false);
        ear().toggle();
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSound = useCallback(() => {
    const next = ear().toggle();
    setSound(next);
    try {
      window.localStorage.setItem(SOUND_STORAGE_KEY, next ? "true" : "false");
    } catch {
      /* Local storage is optional. */
    }
  }, []);

  // The other games put up a PAUSED screen when the tab goes away. There is
  // nothing here for one to protect: no clock running down, no music to cut,
  // nothing you can lose by looking away. The one thing that must not carry
  // on is a held pour filling a glass nobody is watching, so a hidden page
  // simply puts the glass down - no wall to dismiss on the way back, and the
  // next pour wakes the sound up by itself the way the first one did.
  useEffect(() => {
    const putItDown = () => {
      if (!document.hidden) return;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      window.clearTimeout(hold.current.delay);
      window.clearInterval(hold.current.repeat);
      window.clearTimeout(effect.current);
      window.clearTimeout(soundOff.current);
      pouringRef.current = -1;
      setPouring(-1);
      setDrinking(false);
      setSip("");
      audio.current?.stop();
    };
    document.addEventListener("visibilitychange", putItDown);
    window.addEventListener("pagehide", putItDown);
    return () => {
      document.removeEventListener("visibilitychange", putItDown);
      window.removeEventListener("pagehide", putItDown);
    };
  }, []);

  // How high the cubes ride: resting on the glass when there is nothing to
  // float in, and mostly under the surface once there is.
  useLayoutEffect(() => {
    const box = innerRef.current?.getBoundingClientRect().height ?? 0;
    const depth = box * (total / CAP) * 0.85;
    setFloatPx(-(CUBE - Math.min(21, depth * 0.9)));
  }, [total]);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    window.clearTimeout(hold.current.delay);
    window.clearInterval(hold.current.repeat);
    window.clearTimeout(effect.current);
    window.clearTimeout(soundOff.current);
    audio.current?.stop();
  }, []);

  const endPour = useCallback((fade?: boolean) => {
    window.clearTimeout(effect.current);
    pouringRef.current = -1;
    setPouring(-1);
    window.clearTimeout(soundOff.current);
    // The picture stops when the pouring stops; the sound is given a little
    // longer, because a third of a second of running water is not a sound.
    if (fade) soundOff.current = window.setTimeout(() => audio.current?.stop(), 360);
    else audio.current?.stop();
  }, []);

  const pour = useCallback(
    (i: number) => {
      if (drinking) return;
      setAmounts((was) => {
        const now = was.reduce((a, b) => a + b, 0);
        if (now >= CAP) return was;
        const next = [...was];
        next[i] += Math.min(POUR, CAP - now);
        return next;
      });
      void ear().unlock();
      // Starting the loop inside a state updater was starting it twice: React
      // may call an updater more than once, and the second loop had nothing
      // holding it, so it ran on after everything else had stopped. The
      // current tap is kept in a ref, and the sound is started here, once.
      if (pouringRef.current !== i) {
        endPour();
        pouringRef.current = i;
        void ear().play(DRINKS[i].fizz ? "fizzy" : "pour", true);
      }
      setPouring(i);
      setNamed(null);
      setMessage("");
      window.clearTimeout(effect.current);
      effect.current = window.setTimeout(() => endPour(true), 360);
    },
    [drinking, endPour],
  );

  const release = useCallback(() => {
    window.clearTimeout(hold.current.delay);
    window.clearInterval(hold.current.repeat);
  }, []);

  const grab = useCallback(
    (i: number, e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 || drinking) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      pour(i);
      hold.current.delay = window.setTimeout(() => {
        pour(i);
        hold.current.repeat = window.setInterval(() => pour(i), 240);
      }, 300);
    },
    [drinking, pour],
  );

  const addIce = useCallback(() => {
    if (ice >= ICE_MAX || drinking) return;
    void ear().unlock();
    const from = ice;
    setIce(ICE_MAX);
    for (let k = from; k < ICE_MAX; k++) {
      timers.current.push(
        window.setTimeout(() => {
          setCubes((n) => n + 1);
          void ear().play("ice");
        }, (k - from) * 135),
      );
    }
  }, [drinking, ice]);

  const drink = useCallback(() => {
    if (drinking || !total) return;
    release();
    endPour();
    void ear().unlock();
    setDrinking(true);
    setSip("");
    const start = [...amounts];
    const gulps = Math.min(3, Math.ceil(total / 60));
    for (let step = 1; step <= gulps; step++) {
      timers.current.push(
        window.setTimeout(
          () => {
            void ear().play("gulp");
            setAmounts(start.map((n) => Math.round(n * (1 - step / gulps))));
            setSip(step === gulps ? "ごくっ。" : "ごく、ごく。");
          },
          380 + (step - 1) * 620,
        ),
      );
    }
    timers.current.push(
      window.setTimeout(
        () => {
          setDrinking(false);
          setSip("");
          setIce(0);
          setCubes(0);
          setNamed(null);
          setMessage("飲みきりました。もう一杯、どうぞ。");
          audio.current?.stop();
        },
        380 + gulps * 620,
      ),
    );
  }, [amounts, drinking, endPour, release, total]);

  const reset = useCallback(() => {
    release();
    endPour();
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setDrinking(false);
    setSip("");
    setAmounts(DRINKS.map(() => 0));
    setIce(0);
    setCubes(0);
    setNamed(null);
    setMessage("グラスを空にしました。");
  }, [endPour, release]);

  const finish = useCallback(() => {
    release();
    endPour();
    if (!total) return;
    const { name, ranked } = nameMix(amounts);
    let left = 100;
    const rows = ranked.map((d, i) => {
      const percent = i === ranked.length - 1 ? left : Math.round((d.amount / total) * 100);
      left -= percent;
      return `${d.label}  ${percent}% / ${d.amount} ml`;
    });
    serial.current += 1;
    setNamed({ name, rows, serial: serial.current });
  }, [amounts, endPour, release, total]);

  const card = useCallback(async () => {
    if (!named) return null;
    const box = innerRef.current?.getBoundingClientRect().height ?? 1;
    const canvas = drawMixPopCard({
      name: named.name,
      rows: named.rows,
      fill: Math.round(((box * (total / CAP) * 0.85) / box) * 306),
      deep: `rgb(${deep})`,
      thin: `rgba(${thin},.7)`,
      cubes: Array.from({ length: cubes }, (_, k) => ({ x: ICE_AT[k], y: ICE_UP[k], turn: ICE_TURN[k] })),
      fizz,
    });
    return { picture: await cardFile(canvas), text: [named.name, ...named.rows, "", "#MIXPOP #MarutiBit"].join("\n") };
  }, [cubes, deep, fizz, named, thin, total]);

  const keep = (picture: File, note: string) => {
    const save = document.createElement("a");
    save.href = URL.createObjectURL(picture);
    save.download = "mixpop.png";
    save.click();
    window.setTimeout(() => URL.revokeObjectURL(save.href), 4000);
    setMessage(note);
  };

  const share = useCallback(async () => {
    const made = await card();
    if (!made) return;
    if (navigator.canShare?.({ files: [made.picture] })) {
      try {
        await navigator.share({ files: [made.picture], text: made.text });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    keep(made.picture, "カードを保存しました。");
  }, [card]);

  const shareX = useCallback(async () => {
    const made = await card();
    if (!made) return;
    keep(made.picture, "カードを保存しました。Xの投稿画面で画像を添えてください。");
    // An anchor rather than window.open with a feature string: passing
    // features has twice sent the page we were on to the share URL.
    const post = document.createElement("a");
    post.href = `https://x.com/intent/post?text=${encodeURIComponent(made.text)}`;
    post.target = "_blank";
    post.rel = "noopener noreferrer";
    post.click();
  }, [card]);

  const status = drinking ? "ごく、ごく。" : total === 0 ? "まだ、空っぽ。" : total === CAP ? "ちょうど、いっぱい。" : "いい感じ。その調子。";

  return (
    <section className={`mpStage${drinking ? " isDrinking" : ""}${pouring >= 0 ? " isPouring" : ""}`} aria-label="ドリンクをつくる">
      {/* The prototype kept its logotype here. It is the page's title now -
          the band above wears it - so the row is the sound switch alone. */}
      <header className="mpHead">
        <button className={`bitSound ${sound ? "isOn" : ""}`} type="button" aria-pressed={sound} onClick={toggleSound}>
          <span className="bitSoundBars" aria-hidden="true"><i /><i /><i /></span>SOUND <strong>{sound ? "ON" : "OFF"}</strong>
        </button>
      </header>
      <span className="mpRainbow" aria-hidden="true" />

      {/* Above the picture rather than tucked into its corner: a line that
          introduces the machine reads as the page's own, where the same words
          under the drawing read as a caption on it. */}
      <p className="mpCatch">ジュースを、好きなだけ。</p>
      <figure className="mpMachine">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bit/mixpop/machine.webp" alt="六つの注ぎ口が並んだドリンクバーの機械" width={1448} height={1086} />
      </figure>
      <div className="mpGrid">
        <div className="mpPreview">
          <div className="mpLabel">
            <span>01 / YOUR GLASS</span>
            <span>{total} / {CAP} ml</span>
          </div>
          <div className="mpScene">
            <span className="mpNote" aria-hidden="true">MAKE IT<br />YOUR MIX.</span>
            <div className="mpGlass">
              <div className="mpInner" ref={innerRef}>
                <div
                  className="mpLiquid"
                  style={{
                    height: `${(total / CAP) * 85}%`,
                    ["--deep" as string]: `rgb(${deep})`,
                    ["--mid" as string]: `rgba(${deep},.88)`,
                    ["--thin" as string]: `rgba(${thin},.7)`,
                  }}
                >
                  <div className="mpSurface" />
                  <div className="mpBubbles" style={{ opacity: fizz * 0.6 }} />
                  <div className="mpIce" style={{ ["--float" as string]: `${floatPx.toFixed(1)}px` }} aria-hidden="true">
                    {Array.from({ length: cubes }, (_, k) => (
                      <i
                        key={k}
                        style={{
                          ["--x" as string]: `${ICE_AT[k]}px`,
                          ["--y" as string]: `${ICE_UP[k]}px`,
                          ["--turn" as string]: `${ICE_TURN[k]}deg`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="mpHighlight" />
            </div>
            <span className="mpMeasure" aria-hidden="true">300 ml<br /><span>—<br />—<br />—</span></span>
            {sip && <span className="mpSip" aria-hidden="true">{sip}</span>}
          </div>
          <div className="mpGlassFoot">
            <span>{status}</span>
            <span>炭酸 {total ? (fizz > 0.65 ? "しっかり" : fizz > 0 ? "ほんのり" : "なし") : "—"}</span>
          </div>
          <div className="mpTools">
            <button type="button" className="mpBtn" onClick={drink} disabled={!total || drinking}>
              {drinking ? "飲んでいます…" : <>ひと息で飲む <CupIcon /></>}
            </button>
          </div>
        </div>

        <div className="mpControls">
          <div className="mpLabel">
            <span>02 / MIX YOUR FAVORITES</span>
            <span>1 TAP = {POUR} ml</span>
          </div>
          <div className="mpFlavours">
            {DRINKS.map((d, i) => (
              <button
                key={d.id}
                type="button"
                className={`mpFlavour${pouring === i ? " isPouring" : ""}`}
                aria-label={`${d.label}を${POUR}ミリリットル注ぐ`}
                disabled={total >= CAP || drinking}
                onPointerDown={(e) => grab(i, e)}
                onPointerUp={release}
                onPointerCancel={release}
                onLostPointerCapture={release}
                onClick={(e) => { if (e.detail === 0) pour(i); }}
              >
                <span className="mpDot" style={{ background: `rgb(${d.rgb})` }} />
                <span className="mpFlavourName">{d.label}<small>{d.en}</small></span>
                <span className="mpAmount">{amounts[i] ? `${amounts[i]} ml` : "0"}</span>
                <span className="mpPlus" aria-hidden="true">＋</span>
              </button>
            ))}
          </div>
          <p className="mpHint">タップで注ぐ。長押しで、もう少し。</p>
          <div className="mpActions">
            <button type="button" className="mpBtn mpIceBtn" onClick={addIce} disabled={ice >= ICE_MAX || drinking}>
              氷を入れる
            </button>
            <button type="button" className="mpBtn mpResetBtn" onClick={reset} disabled={drinking}>
              やり直す
            </button>
            <button type="button" className="mpBtn mpFinish" onClick={finish} disabled={!total || drinking}>
              <span>{named ? "名前がつきました" : "この一杯に名前をつける"}</span>
              {named ? <span aria-hidden="true">✓</span> : <TagIcon />}
            </button>
          </div>
          <p className="mpMessage" role="status" aria-live="polite">{message}</p>
        </div>
      </div>

      {named && (
        <section className="mpResult" aria-live="polite">
          <div className="mpResultMeta">
            <span>YOUR ORIGINAL MIX</span>
            <span>/ {String(named.serial).padStart(3, "0")}</span>
          </div>
          <div className="mpResultBody">
            <div>
              <p className="mpToday">今日の一杯は、</p>
              <h3 className="mpName">{named.name}</h3>
            </div>
            <div className="mpRecipe">
              {named.rows.map((row) => (
                <p key={row}>{row}</p>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Last of all, under everything including the card: sharing is what you
          do after the glass is finished, and anywhere higher pushes the part
          you came for down the page. It stays in place and greys out until
          there is a drink with a name, so nothing shifts when one appears. */}
      <div className="mpShareRow">
        <button type="button" className="mpBtn" onClick={share} disabled={!named}>シェア <ShareIcon /></button>
        <button type="button" className="mpBtn" onClick={shareX} disabled={!named}>Xでシェア <XIcon /></button>
      </div>
    </section>
  );
}
