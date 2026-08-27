/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */
import styles from "./BitFooter.module.css";

type BitFooterProps = {
  label?: string;
};

export function BitFooter({ label = "MARUTIBIT / SERIES INDEX" }: BitFooterProps) {
  return (
    <footer className={`bitFooter ${styles.footer}`}>
      <span>{label}</span>
      <nav aria-label="MarutiBit フッター">
        <a href="/">Maruti Lab</a>
        <a href="/contact">Contact</a>
        <a href="/privacy">Privacy</a>
        <a href="/disclaimer">Disclaimer</a>
      </nav>
      <span>© 2026 MARUTI LAB</span>
    </footer>
  );
}
