"use client";

import styles from "./XShareButton.module.css";

type XShareButtonProps = {
  text: string;
  url: string;
  // "block": full-width button for a results screen (the original, default use).
  // "compact": small toolbar pill for games with no results screen (e.g. PAKU),
  // sized to sit next to the sound/fullscreen buttons instead of its own row.
  variant?: "block" | "compact";
};

export function XShareButton({ text, url, variant = "block" }: XShareButtonProps) {
  function openComposer() {
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    // window.open(..., "_blank") can silently fail to produce a new tab on some
    // mobile/tablet browsers (popup blocking, split-screen/multi-window quirks) - when
    // that happens `win` comes back null, so fall back to navigating the current tab
    // rather than leaving the tap looking like it did nothing.
    //
    // Passing "noopener" as a feature is deliberately NOT done here: per spec,
    // browsers (Chrome included) return null from window.open() whenever
    // noopener is set, even when the tab opened successfully - that made the
    // `if (!win)` fallback fire on every click, navigating the original tab to
    // the intent URL too. Get a real reference instead and null out `opener`
    // by hand, which gives the same tabnabbing protection without losing the
    // ability to tell success from failure.
    const win = window.open(intent, "_blank", "noreferrer");
    if (win) win.opener = null;
    else window.location.href = intent;
  }

  const className = variant === "compact" ? styles.compact : styles.button;
  return <button className={className} type="button" onClick={openComposer}>X SHARE</button>;
}
