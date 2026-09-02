/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */
import styles from "./BitHeader.module.css";

const coffeeUrl = "https://buymeacoffee.com/marutilab";

export function BitHeader({ current }: { current?: string }) {
  return (
    <header className="bitHeader">
      <div className={styles.hierarchy}>
        <a className="bitBrand" href="/bit" aria-label="MarutiBit トップ"><span>Maruti</span><b>Bit</b></a>
        {current && <><span className={styles.currentSeparator} aria-hidden="true">/</span><strong>{current}</strong></>}
      </div>
      <nav className={styles.actions} aria-label="MarutiBit 補助ナビゲーション">
        <a className="brand" href="/" aria-label="Maruti Lab トップ">
          <span className="brandMark" aria-hidden="true">
            <svg viewBox="0 0 18 18" focusable="false"><path d="M3 8.6 9 3.2l6 5.4" /><path d="M4.6 7.3V15h8.8V7.3" /><path d="M7.3 15v-4.3h3.4V15" /></svg>
          </span>
          <span>Maruti Lab</span>
        </a>
        <a className={styles.support} href={coffeeUrl} target="_blank" rel="noreferrer">
          <span>MarutiBitを支援</span><b aria-hidden="true">☕</b>
        </a>
      </nav>
    </header>
  );
}
