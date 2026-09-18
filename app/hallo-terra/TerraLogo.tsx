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

const PEN: Record<Size, { mark: number; name: number; marker: boolean }> = {
  lg: { mark: 4.2, name: 5.2, marker: true },
  md: { mark: 2.4, name: 3, marker: true },
  sm: { mark: 1.8, name: 2.4, marker: false },
};

export function TerraMark({ size = "md" }: { size?: Size }) {
  const pen = PEN[size];
  return (
    <svg
      className="terraLogoMark"
      viewBox="0 0 68 62"
      fill="none"
      stroke="currentColor"
      strokeWidth={pen.mark}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {(pen.marker ? MARK_MARKER : MARK).map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function TerraName({ size = "md" }: { size?: Size }) {
  const pen = PEN[size];
  return (
    <svg
      className="terraLogoName"
      viewBox={pen.marker ? WORDMARK_MARKER_BOX : WORDMARK_BOX}
      fill="none"
      stroke="currentColor"
      strokeWidth={pen.name}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="HALLO TERRA"
    >
      {(pen.marker ? WORDMARK_MARKER : WORDMARK).map((d) => (
        <path key={d} d={d} />
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
