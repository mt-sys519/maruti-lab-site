import styles from "./GameMark.module.css";
import type { BitGameId } from "./games";

// One definition of each game's mark, used by the /bit hub cards and by the
// home page list. They used to be two copies of the same switch in two files,
// keyed on the id in one and the display name in the other, and they had
// drifted: AVENUE was a photo of its room in both, INPUT RAIN its own name
// spelled out, and a new game got whatever the last branch happened to return.
//
// Each mark is the one its own game page sets beside the title. Size comes
// from --mark-size on the wrapper so a caller can scale it without knowing
// which shape it is.
export function GameMark({ id }: { id: BitGameId }) {
  if (id === "angle")
    return (
      <span className={`${styles.mark} ${styles.stroke}`} aria-hidden="true">
        <svg viewBox="0 0 100 76" focusable="false">
          <path d="M12 66 L92 66 L60 14 Z" />
          <path className={styles.accent} d="M34 66 A22 22 0 0 0 27 50" />
          <text className={styles.glyph} x="43" y="58" textAnchor="middle">?</text>
        </svg>
      </span>
    );
  if (id === "blank")
    return (
      <span className={`${styles.mark} ${styles.type}`} aria-hidden="true">
        <span>8</span>
        <i>＋</i>
        <b className={styles.slot}>?</b>
        <i>＝</i>
        <span>13</span>
      </span>
    );
  if (id === "sequence")
    return (
      <span className={`${styles.mark} ${styles.type} ${styles.sequence}`} aria-hidden="true">
        <span className={styles.numSmall}>2</span>
        <span className={styles.numMed}>4</span>
        <span className={styles.numLarge}>8</span>
        <b className={styles.slot}>?</b>
      </span>
    );
  if (id === "input-rain")
    return (
      <span className={`${styles.mark} ${styles.inputRain}`} aria-hidden="true">
        {/* .inputRainTitleMark lives in globals.css, next to the styles its own
            page uses for the same shape. */}
        <span className="inputRainTitleMark">
          <i />
          <i />
          <i />
        </span>
      </span>
    );
  if (id === "paku")
    return (
      <span className={`${styles.mark} ${styles.stroke}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M3.5 12 C7 7.5 12 6.7 16.2 9.2 L21 6.6 L19.4 12 L21 17.4 L16.2 14.8 C12 17.3 7 16.5 3.5 12 Z" />
          <circle className={styles.dot} cx="8.1" cy="11" r="1" />
        </svg>
      </span>
    );
  if (id === "liltorb")
    return (
      <span className={`${styles.mark} ${styles.stroke}`} aria-hidden="true">
        <svg viewBox="0 0 100 100" focusable="false">
          <circle className={styles.faint} cx="50" cy="50" r="34" />
          <circle className={styles.dot} cx="38" cy="42" r="2.6" />
          <circle className={styles.dot} cx="59" cy="35" r="1.9" />
          <circle className={styles.dot} cx="61" cy="59" r="2.3" />
          <circle className={styles.dot} cx="42" cy="62" r="1.7" />
        </svg>
      </span>
    );
  if (id === "avenue")
    return (
      <span className={`${styles.mark} ${styles.stroke}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M7 5.5 H17" />
          <path d="M9 5.5 V16" />
          <path d="M12 5.5 V19" />
          <path d="M15 5.5 V14.5" />
          <circle className={styles.dot} cx="12" cy="21.3" r="1" />
        </svg>
      </span>
    );
  if (id === "neonbreak")
    return (
      <span className={`${styles.mark} ${styles.stroke}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <circle cx="12" cy="12" r="9" />
          <path d="M6.4 17.6 17.6 6.4" />
          <circle className={styles.dot} cx="8.6" cy="8.6" r="1.5" />
        </svg>
      </span>
    );
  // Deliberately empty rather than a fallback picture: a game added without a
  // mark should show a gap, not another game's artwork.
  return <span className={styles.mark} aria-hidden="true" />;
}
