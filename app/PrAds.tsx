"use client";

import { useEffect, useState } from "react";
import { a8Banners, amazonBanner } from "./adBanners";
import styles from "./PrAds.module.css";

// The PR block at the foot of a game or tool: A8.net's four small banners under the games
// (four in a row, two by two on a phone), Amazon's sale banner under everything else.
// Every banner opens in a new tab so a game or a half-done edit is not lost. A banner that
// does not load (an ad blocker, no connection) takes its cell with it, and the block goes
// when nothing is left, so no empty frame is ever shown.
export function PrAds({ kind, className }: { kind: "a8" | "amazon"; className?: string }) {
  const [gone, setGone] = useState<Set<number>>(() => new Set());
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (kind !== "amazon") return;
    const left = Math.max(0, Date.parse(amazonBanner.until) - Date.now());
    const t = setTimeout(() => setExpired(true), Math.min(left, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [kind]);
  const drop = (i: number) => setGone((s) => new Set(s).add(i));

  if (kind === "amazon") {
    if (expired || gone.has(0)) return null;
    const b = amazonBanner;
    return (
      <aside className={[styles.pr, className].filter(Boolean).join(" ")} aria-label="広告">
        <p className={styles.label}>PR</p>
        <a className={styles.amazon} href={b.href} target="_blank" rel="nofollow sponsored noopener noreferrer">
          <picture>
            <source media="(max-width: 559px)" srcSet={b.narrow.src} width={b.narrow.width} height={b.narrow.height} />
            <img src={b.wide.src} width={b.wide.width} height={b.wide.height} alt={b.alt} loading="lazy" decoding="async" onError={() => drop(0)} />
          </picture>
        </a>
      </aside>
    );
  }

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
