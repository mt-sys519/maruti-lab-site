"use client";

import { useEffect, useRef, useState } from "react";
import { a8Banners, rakutenWidget } from "./adBanners";
import styles from "./PrAds.module.css";

// The PR block at the foot of a game or tool: A8.net's four small banners under the games
// (four in a row, two by two on a phone), the Rakuten widget under everything else.
// Every banner opens in a new tab so a game or a half-done edit is not lost. A banner that
// does not load (an ad blocker, no connection) takes its cell with it, and the block goes
// when nothing is left, so no empty frame is ever shown.
export function PrAds({ kind, className }: { kind: "a8" | "rakuten"; className?: string }) {
  if (kind === "rakuten") return <RakutenWidget className={className} />;
  return <A8Ads className={className} />;
}

// The widget's size is picked once the screen is known; until then the slot keeps the room the
// widget will take (PrAds.module.css), so nothing below it jumps when it arrives.
function RakutenWidget({ className }: { className?: string }) {
  const [narrow, setNarrow] = useState<boolean | null>(null);
  const [gone, setGone] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const mq = window.matchMedia(rakutenWidget.narrowQuery);
    const pick = () => setNarrow(mq.matches);
    pick();
    mq.addEventListener("change", pick);
    return () => mq.removeEventListener("change", pick);
  }, []);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const drop = () => setGone(true);
    el.addEventListener("adgone", drop);
    return () => el.removeEventListener("adgone", drop);
  }, [narrow]);

  if (gone) return null;
  const size = narrow ? rakutenWidget.narrow : rakutenWidget.wide;
  return (
    <aside className={[styles.pr, className].filter(Boolean).join(" ")} aria-label="広告">
      <p className={styles.label}>PR</p>
      <div className={styles.rakuten}>
        {narrow !== null && (
          <iframe
            key={size.s}
            ref={frame}
            src={`${rakutenWidget.src}?s=${size.s}`}
            width={size.width}
            height={size.height}
            title="楽天市場の広告"
            loading="lazy"
          />
        )}
      </div>
    </aside>
  );
}

function A8Ads({ className }: { className?: string }) {
  const [gone, setGone] = useState<Set<number>>(() => new Set());
  const drop = (i: number) => setGone((s) => new Set(s).add(i));

  if (gone.size === a8Banners.length) return null;
  return (
    <aside className={[styles.pr, className].filter(Boolean).join(" ")} aria-label="広告">
      <p className={styles.label}>PR</p>
      <ul className={styles.a8}>
        {a8Banners.map((b, i) => gone.has(i) ? null : (
          <li key={b.name}>
            <a href={b.href} target="_blank" rel="nofollow sponsored noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- A8.net's own banner, used as issued */}
              <img src={b.img} width={120} height={60} alt={b.name} onError={() => drop(i)} />
            </a>
            {/* eslint-disable-next-line @next/next/no-img-element -- A8.net's view counter */}
            <img className={styles.pixel} src={b.pixel} width={1} height={1} alt="" />
          </li>
        ))}
      </ul>
    </aside>
  );
}
