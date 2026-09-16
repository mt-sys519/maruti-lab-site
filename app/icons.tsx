/**
 * The lab's icons. Every one is drawn on the same 24x24 grid with a 1.55
 * stroke, round caps and round joins, and carries no colour of its own - the
 * caller sets `color` and the icon follows it.
 *
 * They replace a set drawn on an 18x18 grid at stroke 1.3 to 1.9, which is why
 * .brandMark and .navIcon in globals.css (and 4TRACK's own copy) now say 1.55:
 * stroke-width is in the viewBox's units, so the same number reads heavier on
 * the smaller grid.
 *
 * Shapes that are meant to be solid - the four buttons on the game pad, the
 * dot on the About mark - set their own fill and turn the stroke off, since
 * the stroke around a radius that small is most of the dot.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

/** YURAMEKI — 波紋 */
export function YuramekiMark(props: IconProps) {
  return <Icon {...props}><rect x='3.5' y='4.5' width='17' height='15' rx='1.6'/><path d='M6.6 16.6 10.6 11.2 14.6 16.6'/><circle cx='15.6' cy='8.6' r='1.35'/></Icon>;
}

/** MarutiBit — ゲームパッド */
export function BitMark(props: IconProps) {
  return <Icon {...props}><path d='M8.7 6.9h6.6a5.6 5.6 0 0 1 5.5 6.6l-.66 3.5a2.5 2.5 0 0 1-4.47 1.05L13.9 15.5h-3.8l-1.77 2.45a2.5 2.5 0 0 1-4.47-1.05L3.2 13.5A5.6 5.6 0 0 1 8.7 6.9Z'/><path d='M8.5 10.1v3.6M6.7 11.9h3.6'/><g fill='currentColor' stroke='none'><circle cx='15.6' cy='10.63' r='.62'/><circle cx='17.02' cy='12.05' r='.62'/><circle cx='14.18' cy='12.05' r='.62'/><circle cx='15.6' cy='13.47' r='.62'/></g></Icon>;
}

/** PromptTerm CLOCK — 画面と時刻 */
export function ClockMark(props: IconProps) {
  return <Icon {...props}><rect x='2.6' y='6.4' width='18.8' height='11.2' rx='1.9'/><g strokeWidth='0.65'><path d='M7.49 9.10v2.65M7.49 11.75v2.65M8.49 9.10h2.49M8.49 9.10v2.65M10.98 9.10v2.65M8.49 11.75v2.65M10.98 11.75v2.65M8.49 14.40h2.49M13.03 9.10h2.49M15.51 9.10v2.65M13.03 11.75h2.49M13.03 11.75v2.65M13.03 14.40h2.49M16.51 9.10v2.65M19.00 9.10v2.65M16.51 11.75h2.49M19.00 11.75v2.65M12.00 10.55v.01M12.00 12.95v.01'/></g></Icon>;
}

/** SwiftCrop — トンボ */
export function SwiftCropMark(props: IconProps) {
  return <Icon {...props}><path d='M8.2 3.4v12.4h12.4'/><path d='M3.4 8.2h12.4v12.4'/></Icon>;
}

/** COLOR RE:FINE — 三色の円 */
export function ColorRefineMark(props: IconProps) {
  return <Icon {...props}><circle cx='9.5' cy='10' r='4.6'/><circle cx='14.5' cy='10' r='4.6'/><circle cx='12' cy='14.3' r='4.6'/></Icon>;
}

/** 4TRACK — カセット */
export function FourTrackMark(props: IconProps) {
  return <Icon {...props}><rect x='2.6' y='5.4' width='18.8' height='13.2' rx='1.9'/><rect x='6.1' y='9.1' width='11.8' height='5.2' rx='1'/><circle cx='9.2' cy='11.7' r='1.5'/><circle cx='14.8' cy='11.7' r='1.5'/><path d='M7.6 17.4h8.8'/></Icon>;
}

/** Maruti Lab */
export function LabMark(props: IconProps) {
  return <Icon {...props}><path d='M3.4 10.3 12 2.9l8.6 7.4'/><path d='M5.6 8.4V20.4h12.8V8.4'/><path d='M9.4 20.4v-5.6h5.2v5.6'/></Icon>;
}

/** 道具たち */
export function ToolsMark(props: IconProps) {
  return <Icon {...props}><path d='M9 8.4V7.2a3 3 0 0 1 6 0v1.2'/><rect x='2.9' y='8.4' width='18.2' height='11.4' rx='1.7'/><path d='M2.9 13.2h18.2'/><rect x='10.4' y='11.1' width='3.2' height='4.2' rx='.7'/></Icon>;
}

/** ノート */
export function NoteMark(props: IconProps) {
  return <Icon {...props}><rect x='4.4' y='3.2' width='15.2' height='17.6' rx='1.6'/><path d='M8.4 3.2v17.6'/><path d='M11.4 8.2h5M11.4 11.6h5M11.4 15h3'/></Icon>;
}

/** このラボについて */
export function AboutMark(props: IconProps) {
  return <Icon {...props}><circle cx='12' cy='12' r='8.6'/><path d='M12 11.2v5.4'/><circle cx='12' cy='7.9' r='.85' fill='currentColor' stroke='none'/></Icon>;
}

/** コーヒーをおごる */
export function CoffeeMark(props: IconProps) {
  return <Icon {...props}><path d='M4.8 9.6h10.8v4.9a4.9 4.9 0 0 1-4.9 4.9H9.7a4.9 4.9 0 0 1-4.9-4.9Z'/><path d='M15.6 11h1.5a2.7 2.7 0 0 1 0 5.4h-1.5'/><path d='M8.2 7.6c.55-.9.55-1.6 0-2.5M12.2 7.6c.55-.9.55-1.6 0-2.5'/></Icon>;
}

/** お問い合わせ */
export function ContactMark(props: IconProps) {
  return <Icon {...props}><rect x='2.8' y='5.4' width='18.4' height='13.2' rx='1.8'/><path d='m2.8 7 9.2 6.4L21.2 7'/></Icon>;
}

/** さがす */
export function SearchMark(props: IconProps) {
  return <Icon {...props}><circle cx='10.6' cy='10.6' r='6.6'/><path d='m15.4 15.4 4.4 4.4'/></Icon>;
}
