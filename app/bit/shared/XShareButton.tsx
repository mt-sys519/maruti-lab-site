"use client";

import styles from "./XShareButton.module.css";

type XShareButtonProps = {
  text: string;
  url: string;
};

export function XShareButton({ text, url }: XShareButtonProps) {
  function openComposer() {
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    // window.open(..., "_blank") can silently fail to produce a new tab on some
    // mobile/tablet browsers (popup blocking, split-screen/multi-window quirks) - when
    // that happens `win` comes back null, so fall back to navigating the current tab
    // rather than leaving the tap looking like it did nothing.
    const win = window.open(intent, "_blank", "noopener,noreferrer");
    if (!win) window.location.href = intent;
  }

  return <button className={styles.button} type="button" onClick={openComposer}>X SHARE</button>;
}
