"use client";

import { useEffect } from "react";

/* The three scripts the tool's own document loaded with `defer`, in the order
 * it loaded them: the zip library, then the English string swap, then the app.
 *
 * They cannot ride along in the markup - injected HTML never runs its scripts -
 * and `defer` is not available to something added after the document is parsed.
 * Setting `async = false` on a script inserted from JavaScript is the one thing
 * that still promises execution in insertion order, which is what `defer` was
 * promising here.
 */
const sources = [
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  "/swiftcrop-app/i18n.js?v=4.0.3-ratio-sizes-support",
  "/swiftcrop-app/app.js?v=4.0.3-export-time",
];

export function ToolScripts() {
  useEffect(() => {
    // A second run would give the app a second set of event listeners.
    if (document.querySelector("script[data-swiftcrop]")) return;
    for (const src of sources) {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.dataset.swiftcrop = "";
      document.body.appendChild(script);
    }
  }, []);

  return null;
}
