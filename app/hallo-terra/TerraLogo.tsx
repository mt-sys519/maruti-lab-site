import {
  FRAMES,
  RULE,
  MARK,
  MARK_MARKER,
  WORDMARK,
  WORDMARK_BOX,
  WORDMARK_MARKER,
  WORDMARK_MARKER_BOX,
} from "./marks.generated";

/**
 * The name, in the hand it is written in.
 *
 * Two hands, not one. Big, the felt tip: a confident even line. Small, the
 * thinner pen, because a heavy stroke at that size fills the globe's meridian
 * and equator in until the mark is a black blob. So the weight goes *down* as
 * the logo gets smaller, which is the opposite of the usual advice and the
 * right answer for a drawing with lines inside it.
 */
type Size = "lg" | "md" | "sm";

// Which hand, per size. The widths themselves live in the stylesheet and are
// real pixels: a stroke width in the drawing's own units would thin out every
// time the logo is set smaller, which is how the big one ended up looking like
// the small one.
const MARKER: Record<Size, boolean> = { lg: true, md: true, sm: false };

export function TerraMark({ size = "md" }: { size?: Size }) {
  return (
    <svg
      className="terraLogoMark"
      viewBox="0 0 68 62"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {(MARKER[size] ? MARK_MARKER : MARK).map((d) => (
        <path key={d} d={d} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

export function TerraName({ size = "md" }: { size?: Size }) {
  return (
    <svg
      className="terraLogoName"
      viewBox={MARKER[size] ? WORDMARK_MARKER_BOX : WORDMARK_BOX}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="HALLO TERRA"
    >
      {(MARKER[size] ? WORDMARK_MARKER : WORDMARK).map((d) => (
        <path key={d} d={d} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

export default function TerraLogo({ size = "md" }: { size?: Size }) {
  return (
    <span className={`terraLogo terraLogo-${size}`}>
      <TerraMark size={size} />
      <TerraName size={size} />
    </span>
  );
}

/**
 * A drawn box behind a control, and a drawn line in place of a rule.
 *
 * Both stretch to whatever they are put on - the wobble stretches with them,
 * the way a box drawn round something does - while `non-scaling-stroke` keeps
 * the pen the same width whatever the shape ends up being. Three frames, so a
 * row of buttons is not one box repeated.
 */
export function TerraFrame({ variant = 0 }: { variant?: number }) {
  return (
    <svg className="terraFrame" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      {FRAMES[variant % FRAMES.length].map((d) => (
        <path key={d} d={d} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

export function TerraRule() {
  return (
    <svg className="terraRule" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">
      {RULE.map((d) => (
        <path key={d} d={d} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
