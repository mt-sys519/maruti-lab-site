"use client";

import { useEffect, useRef, useState } from "react";

export function ClockPreview() {
  const rootRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: "220px 0px", threshold: 0.01 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return (
    <span ref={rootRef} className="clockPreview" aria-hidden="true">
      {active ? (
        <iframe
          src="/demos/promptterm-clock.html?embed=clock"
          title="現在時刻を刻むPromptTerm CLOCKの6管表示"
          tabIndex={-1}
        />
      ) : null}
    </span>
  );
}
