/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */
import type { RetroLang } from "./retroLang";

// The strip across the top of every RETRO page: where you are (MARUTI BIT, the way back
// to the shelf, and RETRO), which cartridge this is, and the language switch.
export function RetroBar({ serial, lang, onLang }: { serial: string; lang: RetroLang; onLang: (lang: RetroLang) => void }) {
  return (
    <header className="rtBar">
      <div className="rtLogo">
        <a href="/bit" className="rtHome">
          MARUTI BIT
        </a>
        <strong>RETRO</strong>
        <i aria-hidden="true" />
      </div>
      <div className="rtRight">
        <span>{serial}</span>
        <div className="rtLang" role="group" aria-label={lang === "en" ? "Language" : "言語"}>
          <button type="button" aria-pressed={lang === "ja"} onClick={() => onLang("ja")}>
            JP
          </button>
          <button type="button" aria-pressed={lang === "en"} onClick={() => onLang("en")}>
            EN
          </button>
        </div>
      </div>
    </header>
  );
}

// The foot of a RETRO page: the same links every Maruti Lab page carries.
export function RetroFooter() {
  return (
    <footer className="rtFoot">
      <span>MARUTI BIT / RETRO</span>
      <nav aria-label="Maruti Lab">
        <a href="/">Maruti Lab</a>
        <a href="/bit">MarutiBit</a>
        <a href="/contact">Contact</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/disclaimer">Disclaimer</a>
      </nav>
      <span>© 2026 MARUTI LAB</span>
    </footer>
  );
}
