"use client";

import { useState } from "react";
import styles from "./ShareButton.module.css";

type ShareButtonProps = {
  title: string;
  text: string;
  url: string;
};

// The X-specific composer (XShareButton) always opens the same app. This one
// hands off to the OS share sheet via the Web Share API, so the viewer can
// pick LINE, Messages, another app, or just copy the link - whatever they'd
// actually use isn't necessarily X.
export function ShareButton({ title, text, url }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // AbortError from the viewer cancelling the share sheet, or the platform
        // rejecting the call - either way there's nothing to recover from here.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access denied/unavailable and there's no further fallback to offer.
    }
  }

  return (
    <button className={styles.button} type="button" onClick={() => void share()}>
      {copied ? "コピーしました" : "SHARE"}
    </button>
  );
}
