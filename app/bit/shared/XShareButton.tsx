"use client";

import styles from "./XShareButton.module.css";

type XShareButtonProps = {
  text: string;
  url: string;
};

export function XShareButton({ text, url }: XShareButtonProps) {
  function openComposer() {
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
  }

  return <button className={styles.button} type="button" onClick={openComposer}>X SHARE</button>;
}
