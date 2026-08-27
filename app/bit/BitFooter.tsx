import Link from "next/link";
import styles from "./BitFooter.module.css";

type BitFooterProps = {
  label?: string;
};

export function BitFooter({ label = "MARUTIBIT / SERIES INDEX" }: BitFooterProps) {
  return (
    <footer className={`bitFooter ${styles.footer}`}>
      <span>{label}</span>
      <nav aria-label="MarutiBit フッター">
        <Link href="/">Maruti Lab</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/disclaimer">Disclaimer</Link>
      </nav>
      <span>© 2026 MARUTI LAB</span>
    </footer>
  );
}
