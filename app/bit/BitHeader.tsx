import Link from "next/link";
import styles from "./BitHeader.module.css";

const coffeeUrl = "https://buymeacoffee.com/marutilab";

export function BitHeader({ current }: { current?: string }) {
  return (
    <header className="bitHeader">
      <div className={styles.hierarchy}>
        <Link className="brand" href="/" aria-label="Maruti Lab トップ">
          <span className="brandMark"><img src="/icon-512.png" alt="" /></span>
          <span>Maruti Lab</span>
        </Link>
        <Link className="bitBrand" href="/bit" aria-label="MarutiBit トップ"><span>Maruti</span><b>Bit</b></Link>
        {current && <><span className={styles.currentSeparator} aria-hidden="true">/</span><strong>{current}</strong></>}
      </div>
      <nav className={styles.actions} aria-label="MarutiBit 補助ナビゲーション">
        <a className={styles.support} href={coffeeUrl} target="_blank" rel="noreferrer">
          <span>MarutiBitを支援</span><b aria-hidden="true">☕</b>
        </a>
      </nav>
    </header>
  );
}
