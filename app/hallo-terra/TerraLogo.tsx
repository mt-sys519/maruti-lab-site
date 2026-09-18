import {
  FRAMES,
  BLOBS,
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


/**
 * Shapes behind the writing, scattered rather than framing it.
 *
 * Each is drawn in a square box and shown square, never stretched: a wobble
 * pulled seven times wider than it was drawn stops reading as a hand and
 * starts reading as a slack curve, which is what the first attempt at this
 * did. Two or three per section, some of them running off the edges, so the
 * page looks like paper someone put shapes on rather than a stack of cards.
 */
const SCATTER: { blob: number; x: string; y: string; size: string; turn: number }[][] = [
  [
    { blob: 0, x: "-30%", y: "-14%", size: "clamp(120px, 24vw, 190px)", turn: -8 },
    { blob: 3, x: "96%", y: "48%", size: "clamp(64px, 12vw, 96px)", turn: 14 },
  ],
  [
    { blob: 1, x: "92%", y: "-20%", size: "clamp(115px, 23vw, 180px)", turn: 10 },
    { blob: 4, x: "-24%", y: "55%", size: "clamp(58px, 11vw, 88px)", turn: -16 },
  ],
  [
    { blob: 2, x: "-33%", y: "26%", size: "clamp(130px, 26vw, 205px)", turn: 6 },
    { blob: 5, x: "98%", y: "-10%", size: "clamp(56px, 10vw, 84px)", turn: -10 },
  ],
  [
    { blob: 4, x: "95%", y: "22%", size: "clamp(118px, 24vw, 185px)", turn: -12 },
    { blob: 0, x: "-27%", y: "-10%", size: "clamp(60px, 11vw, 92px)", turn: 18 },
  ],
];

export function TerraShapes({ tone, at = 0 }: { tone: string; at?: number }) {
  const shapes = SCATTER[at % SCATTER.length];
  return (
    <span className="terraShapes" aria-hidden="true" style={{ color: `var(--terra-${tone})` }}>
      {shapes.map((shape, i) => (
        <svg
          key={i}
          className="terraShape"
          viewBox="0 0 100 100"
          style={{ left: shape.x, top: shape.y, width: shape.size, transform: `rotate(${shape.turn}deg)` }}
        >
          {BLOBS[shape.blob].fill.map((d) => (
            <path key={d} d={d} className="terraShapeFill" />
          ))}
          {BLOBS[shape.blob].line.map((d) => (
            <path key={d} d={d} className="terraShapeLine" />
          ))}
        </svg>
      ))}
    </span>
  );
}
