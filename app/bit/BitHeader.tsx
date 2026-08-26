import styles from "./BitHeader.module.css";

const coffeeUrl = "https://buymeacoffee.com/marutilab";

export function BitHeader() {
  return (
    <header className="bitHeader">
      <a className="bitBrand" href="/bit" aria-label="MarutiBit トップ">
        <span>Maruti</span><b>Bit</b>
      </a>
      <nav className={styles.actions} aria-label="MarutiBit 補助ナビゲーション">
        <a className={styles.support} href={coffeeUrl} target="_blank" rel="noreferrer">
          <span>MarutiBitを支援</span><b aria-hidden="true">☕</b>
        </a>
        <a className="bitBack" href="/">Maruti Labへ戻る</a>
      </nav>
    </header>
  );
}
