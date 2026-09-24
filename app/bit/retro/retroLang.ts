"use client";

import { useCallback, useEffect, useState } from "react";

// RETRO pages speak Japanese or English, chosen with the switch in the RETRO bar. One
// choice covers the page's words and the game's own (the sub display, the messages), and
// it is shared by every RETRO page. First visit: the browser's language decides. The page
// is rendered in Japanese on the server and switches on arrival, so the URL stays one.
export type RetroLang = "ja" | "en";

const KEY = "marutibit:retro-lang";

export function useRetroLang(): [RetroLang, (lang: RetroLang) => void] {
  const [lang, setLangState] = useState<RetroLang>("ja");

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      /* storage is optional */
    }
    const first: RetroLang = saved === "ja" || saved === "en" ? saved : navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the saved choice only exists in the browser
    setLangState(first);
  }, []);

  const setLang = useCallback((next: RetroLang) => {
    setLangState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage is optional */
    }
  }, []);

  return [lang, setLang];
}
