"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared pause state for MarutiBit games.
 * A hidden page pauses once and never resumes without an explicit user action.
 */
export function useVisibilityPause(active: boolean) {
  const [paused, setPaused] = useState(false);
  const activeRef = useRef(active);
  const pausedRef = useRef(false);
  const pausedAtRef = useRef(0);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const pauseForBackground = () => {
      if (!activeRef.current || pausedRef.current || !document.hidden) return;
      pausedRef.current = true;
      pausedAtRef.current = Date.now();
      setPaused(true);
    };

    document.addEventListener("visibilitychange", pauseForBackground);
    window.addEventListener("pagehide", pauseForBackground);
    return () => {
      document.removeEventListener("visibilitychange", pauseForBackground);
      window.removeEventListener("pagehide", pauseForBackground);
    };
  }, []);

  const resume = useCallback(() => {
    if (!pausedRef.current || document.hidden) return 0;
    const pausedFor = Math.max(0, Date.now() - pausedAtRef.current);
    pausedRef.current = false;
    pausedAtRef.current = 0;
    setPaused(false);
    return pausedFor;
  }, []);

  return { paused, resume };
}
