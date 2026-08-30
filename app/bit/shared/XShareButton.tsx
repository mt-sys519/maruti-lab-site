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
    const win = window.open(intent, "_blank", "noopener,noreferrer");
    if (!win) window.location.href = intent;
  }

  const className = variant === "compact" ? styles.compact : styles.button;
  return <button className={className} type="button" onClick={openComposer}>X SHARE</button>;
}
