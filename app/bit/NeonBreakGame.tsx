"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBreakAudio } from "./neonBreakAudio";
import {
  planCpu,
  shotVerdict,
  parseProgress,
  type Difficulty,
  type Progress,
} from "./neonBreakLogic";
import {
  Crosshair,
  Loader2,
  RotateCcw,
  Shield,
  Volume2,
  VolumeX,
  Zap,
} from "./neonBreakIcons";
import { ShareButton } from "./shared/ShareButton";
import { XShareButton } from "./shared/XShareButton";
import "./neonBreak.css";

type Ball = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  active: boolean;
  flash: number;
};
type Point = { x: number; y: number };
type Phase = "aim" | "rolling" | "placing" | "gameover";
type GameMode = "solo" | "cpu" | "stage";
// Force-field wall - an obstacle segment on the cloth, not a rail. Balls
// bounce off it like a cushion.
type Wall = { x1: number; y1: number; x2: number; y2: number };
// A wormhole hazard pair on the open table (distinct from the 6 scoring
// pockets): anything that touches one is relocated to the other, not
// removed from play.
type Warp = { x: number; y: number; r: number; pair: number };
type Stage = { walls: Wall[]; warps: Warp[] };
type Shot = {
  target: number;
  first: number | null;
  pocketed: number[];
  railAfter: boolean;
  railObjects: Set<number>;
  scratch: boolean;
  power: boolean;
  isBreak: boolean;
  /** Cue speed as struck, so "you hit that far too hard" is answerable. */
  speed: number;
  /** A ball reached a pocket mouth and was spat back out. */
  rattled: boolean;
};
type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};
// Everything spatial below is built off this instead of fixed W/H/TX/TY/TR/TB
// constants, so the table can run as either a landscape rectangle (desktop,
// where there's room for the operator art beside it) or a portrait one
// (phones, where a landscape table squeezed into a narrow column left most
// of the screen as dead vertical space above/below a small board). Portrait
// mirrors the landscape margins onto the other axis (TX<->TY, TR<->TB) so
// the felt-to-cushion proportions read the same either way, just rotated -
// the long rail pair (720px) stays 720px, the short one (390px) stays 390px,
// it's just which axis is which that flips.
type Geometry = {
  W: number;
  H: number;
  TX: number;
  TY: number;
  TR: number;
  TB: number;
  portrait: boolean;
};
const R = 13;
// The playfield is 720x390 either way; only the dead margin around it
// changes here. It used to run 50-65px on a canvas that is drawn at the
// element's full width, so a good fifth of the picture was empty felt-less
// border - the table itself came out smaller than it needed to be. 44px clears
// the corner pockets (r=30) and their glow with a little air left over.
function buildGeometry(portrait: boolean): Geometry {
  return portrait
    ? { W: 478, H: 808, TX: 44, TY: 44, TR: 434, TB: 764, portrait: true }
    : { W: 808, H: 478, TX: 44, TY: 44, TR: 764, TB: 434, portrait: false };
}
const FRICTION = 0.996,
  BALL_REST = 0.97,
  WALL_REST = 0.96,
  MIN_V = 0.45,
  MAX_SHOT = 60;
const COLORS = [
  "#dffaff",
  "#ffe34e",
  "#2c96ff",
  "#ff3e58",
  "#a75cff",
  "#ff8b2d",
  "#3dff91",
  "#a53cff",
  "#ff4ec8",
  "#eaff66",
];
// Sized directly off the real ball/mouth ratio instead of by eye. A
// regulation ball is 2 1/4" (57.15mm); BCA/WPA corner-pocket mouths run
// ~4 7/8"-5 1/8" (avg ~5") and side-pocket mouths run wider still, ~5"-5 5/8".
// That's a mouth *radius* of ~2.1x the ball's radius at the corner and
// ~2.3x at the side - checked against this file's R=13 ball radius, the
// previous POCKET_CORNER=19/POCKET_SIDE=25 only worked out to 1.46x/1.92x,
// i.e. both pockets were drawn visibly narrower than a real table's mouths
// relative to the ball, the corner mouth especially so.
const POCKET_CORNER = Math.round(R * 2.1),
  POCKET_SIDE = Math.round(R * 2.3);
// A ball arriving too close to parallel with the rail rattles the jaw and
// stays out in real pool - the earlier version captured on distance alone,
// so a ball skimming past the mouth at a glancing angle dropped in exactly
// like a dead-straight shot. `accept` is the direction a ball must be
// travelling in (within halfAngle, sourced off the same ~142 degree BCA/WPA
// corner-jaw spec used for the rail notches - half of that is the cone a
// ball can arrive within and still be considered "into" the pocket rather
// than across it) to actually fall rather than bounce off the jaw.
type Pocket = Point & {
  r: number;
  kind: "corner" | "side";
  accept: Point;
  halfAngle: number;
  cap: number;
};
// Straight mouth-radius-minus-ball-radius clearance (see `cap` below) is the
// physically literal answer, and for the corner it's *correct* - a real
// corner mouth really is only about a ball-and-a-bit wider than the ball,
// which is exactly why corner shots are famously unforgiving. But that math
// assumes the pocket is a plain hole, and a real corner isn't: the jaws are
// backing cushions angled to catch a ball that's merely near the mouth and
// deflect it inward rather than just blocking it (the everyday "rattled in
// off the jaw" shot). A single capture circle has no jaw to deflect off of,
// so holding it to the literal clearance number makes it strictly harder
// than the real pocket it's modeling. CORNER_JAW_ASSIST stands in for that
// missing deflection by only charging the ball for half its radius instead
// of the whole thing.
//
// The side pocket needs the same allowance, for a reason that only shows up
// once the rail clamp is taken into account. Its capture is a circle around
// a point sitting ON the rail line, but a ball's centre can never get closer
// to that line than its own radius - the clamp in tick() sees to that. So of
// the literal mouth-minus-ball budget, the ball has already spent its whole
// radius before it has moved a single pixel sideways: a 30px mouth with a
// 17px capture left a horizontal window of +/-11px, and anything entering
// the visible mouth wider than that bounced off the rail instead of
// dropping. That is the "that was obviously in" shot. Charging half the
// radius here too puts the window at +/-20px, which is what the mouth
// actually looks like.
const CORNER_JAW_ASSIST = 0.5,
  SIDE_JAW_ASSIST = 0.5;
// 71 degrees (half of the sourced 142 degree BCA/WPA jaw spec) was still
// rejecting shots that read as clearly good in this arcade-physics table -
// real jaw geometry doesn't translate directly onto a simplified 2D
// simulation with an idealized ball/rail model. Loosened well past the
// sourced number so it only catches shots arriving almost exactly along the
// rail, rather than anything not perfectly on the corner's diagonal.
// How far a side pocket's void is allowed back onto the playfield side of
// the rail before the gradient has erased it completely. Purely cosmetic -
// capture geometry never reads it.
const POCKET_BLEED = 4;
// ...and how deep into the pocket the fade runs from there. The bleed decides
// how far the hole shows past the rail; this decides how long the gradient is.
const POCKET_FADE = 6;
const CORNER_HALF_ANGLE = (83 * Math.PI) / 180,
  SIDE_HALF_ANGLE = (78 * Math.PI) / 180;
const D = Math.SQRT1_2;
const CORNER_CAP = POCKET_CORNER - R * CORNER_JAW_ASSIST,
  SIDE_CAP = POCKET_SIDE - R * SIDE_JAW_ASSIST;
// Side pockets sit at the midpoint of the two LONG rails, same as a real
// table - which pair of rails counts as "long" is exactly what flips
// between orientations (top/bottom in landscape, left/right in portrait),
// so this is the one piece of pocket geometry that genuinely branches on
// orientation rather than just re-reading swapped TX/TY/TR/TB. Corners
// don't need a branch: a 45-degree diagonal into a corner is a corner is a
// corner regardless of which way the rectangle is turned.
function buildPockets(geo: Geometry): Pocket[] {
  const { TX, TY, TR, TB, portrait } = geo;
  const corner = (x: number, y: number, ax: number, ay: number): Pocket => ({
    x,
    y,
    r: POCKET_CORNER,
    kind: "corner",
    accept: { x: ax, y: ay },
    halfAngle: CORNER_HALF_ANGLE,
    cap: CORNER_CAP,
  });
  const side = (x: number, y: number, ax: number, ay: number): Pocket => ({
    x,
    y,
    r: POCKET_SIDE,
    kind: "side",
    accept: { x: ax, y: ay },
    halfAngle: SIDE_HALF_ANGLE,
    cap: SIDE_CAP,
  });
  // accept must point the same way as the pocket's own offset from table
  // center (toward smaller x/y toward that rail, toward larger x/y toward
  // the other) - sideA sits on the smaller-x/smaller-y rail in both
  // orientations, so it needs a negative accept component, not positive.
  // Landscape already had this right (0,-1 / 0,1); portrait had it backwards
  // (1,0 / -1,0 - swapped), which rejected legitimately-entered shots and,
  // once the rim became direction-aware, also drew the jaw facing into the
  // table instead of into the rail. Also dropped the old +/-2px nudge off
  // the rail line - it was small enough to not matter for capture, but it
  // meant the rim arc's flat edge (drawn exactly through the pocket's own
  // center) no longer lined up with where the straight rail line actually
  // is, leaving a visible step between the two.
  const sideA = portrait
    ? side(TX, (TY + TB) / 2, -1, 0)
    : side((TX + TR) / 2, TY, 0, -1);
  const sideB = portrait
    ? side(TR, (TY + TB) / 2, 1, 0)
    : side((TX + TR) / 2, TB, 0, 1);
  return [
    corner(TX, TY, -D, -D),
    sideA,
    corner(TR, TY, D, -D),
    corner(TX, TB, -D, D),
    sideB,
    corner(TR, TB, D, D),
  ];
}

// Every position below is [along, across] as a fraction of the table
// interior: `along` runs the long rail from the cue's end (0) to the far
// end (1), `across` runs the short rail. Writing layouts in this space
// rather than raw x/y is what lets one authored stage hold its shape in
// both orientations - portrait just maps `along` down the screen so the
// cue still sits near the thumb, exactly like the 9-ball rack does.
// In this space the six pockets are at [0,0] [0,1] [1,0] [1,1] (corners)
// and [.5,0] [.5,1] (sides), which is what the chains below are aimed at.
type StagePt = [number, number];
type StageDef = {
  cue: StagePt;
  nine: StagePt;
  walls: [StagePt, StagePt][];
  warps: [StagePt, StagePt][];
  hint: string;
};
// A wormhole preserves direction: a ball entering one hole leaves the other
// still travelling the way it went in (see the warp branch in tick()). That
// makes a warp stage a straight-line puzzle rather than a guess - entrance,
// exit, 9-ball and pocket are placed collinear on one direction vector, so
// there is always exactly one line that solves it and the aim guide, which
// traces through warps, can show it. Stages 1-5 have no wormhole on purpose:
// the rule has to be legible before it can be a puzzle.
//
// The odd-looking decimals are not eyeballed. An earlier hand-placed set had
// a "straight in" opening stage that mostly did not go in: a ball arriving at
// a corner along a shallow line reaches the rail before its centre gets
// within the pocket's capture radius, so it rattles out. Every layout here
// was run against a copy of tick()'s own physics and kept only if a potting
// line exists with a workable margin - roughly 3 degrees of aim tolerance on
// stage 1, tightening to under 1 on the cut.
//
// The hazards are checked the same way, because a hand-placed wall is very
// easily just decoration: the first pass had walls sitting off to the side of
// the shot entirely, and wormhole stages that could simply be shot straight
// at the 9. Each wormhole stage's wall now seals the 9-ball's half of the
// table outright - swept over every angle and power with the hole deleted,
// none of them can be potted at all - and the entrance sits on the far side
// of that wall, which is the part the first attempt had backwards. Stage 5's
// wall is measured too: the nearest line that still pots is 22 degrees off
// the straight aim, so going around it is the shot rather than a nudge.
const STAGE_DEFS: StageDef[] = [
  {
    cue: [0.813, 0.344],
    nine: [0.917, 0.154],
    walls: [],
    warps: [],
    hint: "手球・9番・右上ポケットが一直線に並んでいるわ。強く撞く必要はないの、そのまま押し出して。",
  },
  {
    cue: [0.28, 0.483],
    nine: [0.118, 0.782],
    walls: [],
    warps: [],
    hint: "同じ一直線、距離だけ長いわ。離れるほど角度の誤差が開くの。丁寧にね。",
  },
  {
    cue: [0.5, 0.667],
    nine: [0.5, 0.295],
    walls: [],
    warps: [],
    hint: "サイドポケットはレールの途中にあるわ。真横からは入らないの——垂直に押し出す線を探して。",
  },
  {
    cue: [0.813, 0.556],
    nine: [0.895, 0.853],
    walls: [],
    warps: [],
    hint: "一直線ではないわ。9番のポケットと反対側に触れるの。当たる厚みが、出ていく向きを決めるわ。",
  },
  {
    cue: [0.47, 0.55],
    nine: [0.902, 0.181],
    walls: [
      [
        [0.565, 0.015],
        [0.565, 0.58],
      ],
    ],
    warps: [],
    hint: "正面は壁ね。まっすぐは通らないわ。クッションを使って壁の先へ回り込むの——入射角と反射角は等しいから。",
  },
  {
    cue: [0.083, 0.148],
    nine: [0.907, 0.828],
    walls: [
      [
        [0.5, 0.03],
        [0.5, 0.97],
      ],
    ],
    warps: [
      [
        [0.23, 0.42],
        [0.813, 0.656],
      ],
    ],
    hint: "壁は越えられないわ。ワームホールは入った向きのまま反対側から出るの——出口の先に9番、その先がポケット。だから狙うのは入口よ。",
  },
  {
    cue: [0.923, 0.427],
    nine: [0.093, 0.172],
    walls: [
      [
        [0.008, 0.826],
        [0.447, 0.015],
      ],
    ],
    warps: [
      [
        [0.8, 0.2],
        [0.187, 0.344],
      ],
    ],
    hint: "左上の角が壁で切り離されているわ。入口に入る角度が、そのまま出口から出る角度になるの。",
  },
  {
    cue: [0.08, 0.896],
    nine: [0.5, 0.179],
    walls: [
      [
        [0.008, 0.436],
        [0.992, 0.436],
      ],
    ],
    warps: [
      [
        [0.08, 0.64],
        [0.5, 0.359],
      ],
    ],
    hint: "テーブルが上下に分かれているわね。上へ渡る道は穴だけよ。出口から真上——そこにサイドポケットがあるわ。",
  },
  {
    cue: [0.923, 0.133],
    nine: [0.098, 0.819],
    walls: [
      [
        [0.457, 0.985],
        [0.008, 0.156],
      ],
    ],
    warps: [
      [
        [0.8, 0.36],
        [0.192, 0.646],
      ],
    ],
    hint: "斜めの壁が左下を封じているわ。出口・9番・左下ポケットは既に一直線。同じ角度で入口へ。",
  },
  {
    cue: [0.061, 0.127],
    nine: [0.884, 0.838],
    walls: [
      [
        [0.981, 0.015],
        [0.585, 0.985],
      ],
    ],
    warps: [
      [
        [0.2, 0.32],
        [0.778, 0.691],
      ],
    ],
    hint: "距離が長いわ。入口での1度が、出口では大きなずれになるの。穴の中心を撃ち抜くつもりで。",
  },
  {
    cue: [0.077, 0.347],
    nine: [0.907, 0.172],
    walls: [
      [
        [0.562, 0.015],
        [0.992, 0.808],
      ],
    ],
    warps: [
      [
        [0.2, 0.12],
        [0.818, 0.335],
      ],
      [
        [0.34, 0.62],
        [0.12, 0.88],
      ],
    ],
    hint: "穴は二組あるわ。片方は壁の内側で完結していて、どこにも行き着かないの。出口の先に9番があるのはどちらか、撞く前に見極めて。",
  },
  {
    cue: [0.931, 0.852],
    nine: [0.116, 0.14],
    walls: [
      [
        [0.051, 0.985],
        [0.392, 0.015],
      ],
    ],
    warps: [
      [
        [0.78, 0.67],
        [0.227, 0.272],
      ],
    ],
    hint: "出口から9番、その先が左上ポケット——三つは既に一直線に並んでいるわ。あとは同じ角度で入口に入るだけ。",
  },
  {
    cue: [0.07, 0.233],
    nine: [0.907, 0.828],
    walls: [
      [
        [0.992, 0.201],
        [0.567, 0.985],
      ],
      [
        [0.208, 0.192],
        [0.208, 0.474],
      ],
    ],
    warps: [
      [
        [0.347, 0.346],
        [0.819, 0.665],
      ],
    ],
    hint: "入口へ真っ直ぐは行けないわ。上のクッションで跳ね返してから穴に入れるの——入った向きがそのまま出口の向きになるから、跳ね返り角がそのまま答えよ。",
  },
  {
    cue: [0.9, 0.494],
    nine: [0.093, 0.172],
    walls: [
      [
        [0.008, 0.799],
        [0.433, 0.015],
      ],
    ],
    warps: [
      [
        [0.792, 0.295],
        [0.735, 0.856],
      ],
      [
        [0.597, 0.603],
        [0.181, 0.335],
      ],
    ],
    hint: "最後よ。穴が二組、数珠つなぎになっているの。一つ目の出口の先に二つ目の入口があるわ。二回抜けた先に9番。",
  },
];
const STAGE_COUNT = STAGE_DEFS.length;
function stagePoint([along, across]: StagePt, geo: Geometry): Point {
  const { TX, TY, TR, TB, portrait } = geo;
  return portrait
    ? { x: TX + (TR - TX) * across, y: TB - (TB - TY) * along }
    : { x: TX + (TR - TX) * along, y: TY + (TB - TY) * across };
}
// The previous 21 stages were generated: a shot line swung around the four
// corners, walls jittered along it, warp exits pulled from a fixed pool of
// three spots. That produces layouts, not puzzles - a warp whose exit lands
// somewhere unrelated to the 9 is a hazard to avoid, not a route to solve,
// and most of the 21 differed from a neighbour only in shot length. These 7
// are authored instead, each with one intended line.
function buildStage(n: number, geo: Geometry): Stage {
  const d = STAGE_DEFS[n - 1];
  const walls: Wall[] = d.walls.map(([a, b]) => {
    const p = stagePoint(a, geo),
      q = stagePoint(b, geo);
    return { x1: p.x, y1: p.y, x2: q.x, y2: q.y };
  });
  const warps: Warp[] = [];
  for (const [a, b] of d.warps) {
    const p = stagePoint(a, geo),
      q = stagePoint(b, geo),
      i = warps.length;
    warps.push(
      { x: p.x, y: p.y, r: 15, pair: i + 1 },
      { x: q.x, y: q.y, r: 15, pair: i },
    );
  }
  return { walls, warps };
}
function buildStages(geo: Geometry): Stage[] {
  return STAGE_DEFS.map((_, i) => buildStage(i + 1, geo));
}

// Ray casts for the aim guide. Direction is assumed unit length, so the
// returned t is a distance in table pixels. Both return the FIRST forward
// hit only - the guide walks the ray one hit at a time and re-casts.
function rayCircle(
  px: number,
  py: number,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  r: number,
): number | null {
  const ox = px - cx,
    oy = py - cy,
    b = ox * dx + oy * dy,
    c = ox * ox + oy * oy - r * r,
    disc = b * b - c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc),
    t1 = -b - sq,
    t2 = -b + sq;
  return t1 > 0 ? t1 : t2 > 0 ? t2 : null;
}
function raySegment(
  px: number,
  py: number,
  dx: number,
  dy: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number | null {
  const ex = x2 - x1,
    ey = y2 - y1,
    den = dx * ey - dy * ex;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((x1 - px) * ey - (y1 - py) * ex) / den,
    u = ((x1 - px) * dy - (y1 - py) * dx) / den;
  return t < 0 || u < 0 || u > 1 ? null : t;
}

// Small radial particle burst - shared by pocket captures, rail sparks, the
// power-shot shield bounce, and the win celebration, each just calling this
// with a different count/speed/palette.
function spawnBurst(
  sparks: Spark[],
  x: number,
  y: number,
  opts: {
    count: number;
    speed: number;
    life: number;
    colors: string[];
    size?: number;
  },
) {
  for (let i = 0; i < opts.count; i++) {
    const angle = Math.random() * Math.PI * 2,
      speed = opts.speed * (0.4 + Math.random() * 0.6);
    sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: opts.life,
      maxLife: opts.life,
      color: opts.colors[Math.floor(Math.random() * opts.colors.length)],
      size: opts.size ?? 1.5 + Math.random() * 2,
    });
  }
}

// Built along a "break axis" (the long rail direction: X in landscape, Y in
// portrait) plus a perpendicular offset for each row, rather than fixed x/y
// - same rack shape either way, just able to run in either direction.
// Landscape keeps the original cue-near-left/apex-near-right layout, but
// portrait puts the cue near the BOTTOM instead of mirroring straight
// across: a phone is held with the thumb near the bottom of the screen, and
// pulling the cue ball down toward that thumb to shoot reads as far more
// natural than pulling it up off the top of a tall table. `dir` flips which
// way subsequent rack rows fan out from the apex so the apex ball still
// faces the cue (the diamond opens away from the cue, not back into it) in
// both orientations.
function rack(geo: Geometry): Ball[] {
  const { TX, TY, TR, TB, portrait } = geo;
  const alongLen = portrait ? TB - TY : TR - TX,
    alongStart = portrait ? TY : TX,
    acrossCenter = portrait ? (TX + TR) / 2 : (TY + TB) / 2;
  const cueFrac = portrait ? 0.75 : 0.25,
    apexFrac = portrait ? 0.25 : 0.75,
    dir = portrait ? -1 : 1;
  const mk = (id: number, alongPx: number, across: number): Ball => {
    const a = alongStart + alongPx,
      c = acrossCenter + across;
    return {
      id,
      x: portrait ? c : a,
      y: portrait ? a : c,
      vx: 0,
      vy: 0,
      r: R,
      active: true,
      flash: 0,
    };
  };
  const balls: Ball[] = [mk(0, alongLen * cueFrac, 0)];
  const ids = [[1], [2, 3], [4, 9, 5], [6, 7], [8]];
  ids.forEach((row, i) =>
    row.forEach((id, j) =>
      balls.push(
        mk(
          id,
          alongLen * apexFrac + dir * i * 28,
          (j - (row.length - 1) / 2) * 28,
        ),
      ),
    ),
  );
  return balls;
}
// STAGE MODE is a trick-shot puzzle, not a nine-ball rack - cue ball plus a
// single target ball (reusing id 9 so the existing win glow/fanfare and the
// "NEXT OBJECT" readout still make sense without new UI), navigated through
// whatever walls/warps that stage's layout adds. No lowest-ball-first, no
// break-legality, no fouls in the billiards sense.
function stageRack(n: number, geo: Geometry): Ball[] {
  const d = STAGE_DEFS[n - 1],
    cue = stagePoint(d.cue, geo),
    target = stagePoint(d.nine, geo);
  return [
    { id: 0, x: cue.x, y: cue.y, vx: 0, vy: 0, r: R, active: true, flash: 0 },
    {
      id: 9,
      x: target.x,
      y: target.y,
      vx: 0,
      vy: 0,
      r: R,
      active: true,
      flash: 0,
    },
  ];
}
// Spoken lines. A single state-derived string per character read as one
// flat note repeated forever - and for Aika especially it was wrong, since
// she is playing too and had nothing to say about her own shots. These are
// keyed by what just HAPPENED and picked at random, so the panel reacts to
// the table instead of describing it.
const pick = (a: readonly string[]) => a[Math.floor(Math.random() * a.length)];
const VOICE = {
  aoi: {
    break: [
      "ナイスブレイク。よく散ったね。",
      "いい音。ここから組み立てていこうね。",
      "散り方は悪くないね。",
      "おっ、しっかり割れたね。",
      "うん、いいブレイクだね。",
      "きれいに開いたね。狙いどころが多いよ。",
      "厚く入ったね。今日は調子いいかも。",
      "悪くない散り方。さあ、どこから行こうか。",
    ],
    pot: [
      "入ったね。その調子。",
      "ナイス。次いこうね。",
      "うん、きれいに入ったね。",
      "いい球だったね。",
      "落ち着いてるね、いい感じ。",
      "ナイスショット。手球の位置もいいね。",
      "決まったね。",
      "その厚みで正解だったね。",
      "手球もいい所に残ったね。",
      "うん、狙い通りだね。",
      "丁寧に撞けてるね。",
      "今の一打、きれいだったよ。",
      "見えてるね、ちゃんと。",
      "無駄のない一打だったね。",
      "その角度をよく見つけたね。",
      "いい音で入ったね。",
    ],
    multi: [
      "2つ同時。おいしいね。",
      "わ、まとめて落ちたね。",
      "ラッキーもあるけど、ナイスだよ。",
      "こういうの気持ちいいよね。",
      "一打で2つ。得したね。",
      "散らばりが味方したね。",
    ],
    run: [
      "3連続。乗ってきたね。",
      "止まらないね、その調子。",
      "いい流れだよ。このまま。",
      "見てて気持ちいいね。",
      "連取だね。集中できてる証拠。",
      "完全に手が合ってきたね。",
    ],
    nineLeft: [
      "あと9番だけだね。",
      "ここまで来たね。ラスト一球。",
      "9番だけ残ったよ。落ち着いていこうね。",
      "いよいよだね。深呼吸して。",
      "最後の一球。丁寧にね。",
      "ここで慌てないのが一番だよ。",
    ],
    miss: [
      "惜しかったね。",
      "うーん、ちょっと厚かったかな。",
      "大丈夫、まだいけるよ。",
      "今のは薄かったね。次は少し厚めに。",
      "力み過ぎかもね、もう少し軽くいこう。",
      "角度は良かったよ。",
      "惜しい。指一本ぶんずれたね。",
      "切り替えていこうね。",
      "入り口までは来てたね。",
      "次はもう少しゆっくりでいこう。",
      "手球が走りすぎちゃったかな。",
      "ドンマイ。まだ残ってるよ。",
      "口に嫌われたね。",
      "今のは入ってもおかしくなかったよ。",
      "ちょっと当たりが薄かったね。",
      "まあ、こういう日もあるよ。",
    ],
    foul: [
      "ファウルだね。手球は好きなところに置いていいよ。",
      "あらら。まあ、置き直せるからね。",
      "大丈夫、落ち着いていこうね。",
      "こういう時こそゆっくりね。",
      "気にしないで。置き場所は選び放題だよ。",
      "手球が戻ってきたね。仕切り直そう。",
      "最小番号に先に当てるのを忘れずにね。",
      "クッションまで届かなかったね。次は少し強めに。",
    ],
    scratch: [
      "手球が落ちちゃったね。置き直そう。",
      "スクラッチだね。まあ、位置は選べるよ。",
      "うーん、手球まで一緒に入っちゃったね。",
      "走りすぎたね。次は加減しよう。",
      "手球の行き先も一緒に見てあげてね。",
      "置き直しだね。いい場所を選ぼう。",
    ],
    power: [
      "パワーショット、いったね。",
      "思い切ったね。",
      "一気に決めにいったね。",
      "豪快だったね。",
    ],
    potCall: [
      "ナイスショット!",
      "入った!",
      "よし!",
      "決まった!",
      "ナイス!",
      "おお、いいね!",
      "きれい!",
      "その一打!",
      "うまい!",
      "入ったよ!",
      "やるね!",
      "ばっちり!",
    ],
    nineCall: ["9番! 決まり!", "入った——完璧!", "やった、9番!", "決めたね!"],
    scratchCall: ["あっ", "わ", "あー…", "うわ"],
    // The situations every pool player knows. She is the one who never
    // rubs it in - she names what happened and moves you along.
    fluke: [
      "入ったね。……順番は違ったけど、入ったよ。",
      "ふふ、今のは運も味方したね。",
      "狙いとは違ったけど、入ったのは本当だよ。",
      "結果オーライ、ってことにしようね。",
      "今のは自分でもびっくりしたでしょ。",
    ],
    whiff: [
      "あー、かすりもしなかったね。",
      "空振り。誰にでもあるよ。",
      "ちょっと薄く狙いすぎたかな。",
      "当たらなかったね。次いこう、次。",
    ],
    jaw: [
      "惜しい! 口に嫌われたね。",
      "今の、入ってたよ。ほんとに惜しい。",
      "うわ、蹴られちゃったね。",
      "そこまで来てたのにね。",
    ],
    mash: [
      "そんなに強くしなくても入るよ。",
      "力、抜いてみようね。",
      "強く撞くほど手球は言うこと聞かなくなるからね。",
      "もう少しやさしくて大丈夫だよ。",
    ],
    noRail: [
      "当たったけど、そこで止まっちゃったね。",
      "クッションまで届かなかったね。",
      "もうちょっとだけ強くてもいいかも。",
    ],
    scratchIn: [
      "入ったのに、手球も一緒に落ちちゃったね。",
      "うう、道連れだね。",
      "的球はよかったよ。手球だけ、ね。",
    ],
    preShot: [
      "次の球、見えてる? ゆっくりでいいよ。",
      "いけるいける。",
      "そのまま落ち着いていこうね。",
      "手球の行き先も一緒に考えてみようね。",
      "大丈夫、君なら入るよ。",
      "深呼吸してから撞こうね。",
      "焦らなくていいからね。",
      "角度、よく見てね。",
      "いい構えだね。",
      "わたしはここで見てるからね。",
      "時間は気にしないでいいよ。",
      "厚みを決めたら、あとは真っ直ぐ出すだけだよ。",
      "ここ、決めどころだね。",
      "力はいらないよ。丁寧にね。",
      "手球をよく見てね。",
      "その狙い、悪くないと思うな。",
      "うん、その線でいけるよ。",
      "慌てないでね。台は逃げないから。",
      "肩の力、抜いていこうね。",
      "ここまで来たんだから、あとは信じるだけだよ。",
    ],
    rare: [
      "ずっと見てたら、なんだかこっちが緊張してきちゃった。",
      "……その集中してる横顔、ちょっとかっこいいね。……なんでもない。",
      "あ、今わたしのこと見た? ……気のせいか。",
      "君と撞いてる時間、けっこう好きだよ。……あ、変な意味じゃなくてね。",
      "こういう静かな夜、悪くないよね。",
      "……ねえ。終わったら、もう一戦だけ付き合ってくれる?",
      "隣にいるの、飽きないな。……今のは忘れて。",
      "上手くなったね。……ちょっとだけ、寂しいかも。",
      "わたしがいなくても入れちゃうんじゃない? ……冗談だよ。",
      "君の撞き方、好きだな。丁寧で。",
      "……なんでもない。続けて。",
      "わたしの声、ちゃんと届いてる? ……ならいいんだ。",
    ],
    win: [
      "お見事。全部落ちたね。",
      "やったね。きれいなランだったよ。",
      "完走だね。お疲れさま。",
      "うん、いい試合運びだったね。",
      "ナイスラン。数えててよかったよ。",
      "完璧。文句なしだよ。",
      "最後まで丁寧だったね。お疲れさま。",
      "9番、確かに落ちたよ。おめでとう。",
    ],
  },

  aika: {
    ready: [
      "さっさと打ちなさいよ。",
      "まだ? 待ってるんだけど。",
      "考えすぎ。撞けば分かるでしょ。",
      "早く。時間がもったいないわ。",
      "……そんなに悩む球?",
      "別に急かしてないけど、遅い。",
    ],
    potCallPlayer: [
      "……っ",
      "あ。",
      "うそ。",
      "入るの、それ。",
      "……やるじゃない。",
      "ちょっと。",
      "へえ。",
    ],
    scratchCallPlayer: [
      "あ。",
      "……手球。",
      "ふふっ。",
      "え、それ入れる?",
      "自滅?",
    ],
    scratchCallSelf: [
      "……は?",
      "今のは無し。",
      "……見なかったことにして。",
      "……ちょっと。",
    ],
    // Same situations, read by someone who is playing against you.
    fluke: [
      "……ほんとに狙った?",
      "今の、狙ってないでしょ。",
      "へえ。じゃあもう一回、同じの入れてみて。",
      "運がいいだけよ。",
      "……まぐれって言葉、知ってる?",
    ],
    whiff: [
      "当たってすらいないんだけど。",
      "……何を狙ってたの?",
      "空振り。かわいいところあるじゃない。",
      "球に触ってから出直してきて。",
    ],
    jaw: [
      "入ってたら格好よかったのにね。",
      "ポケットに嫌われたわね。",
      "……惜しい。悔しがっていいわよ。",
      "あと少し。その少しが一番遠いのよ。",
    ],
    mash: [
      "力でどうにかなると思ってるでしょ。",
      "そんなに強く撞いてどうするの。",
      "うるさい球ね。",
      "速ければいいってものじゃないの。",
    ],
    noRail: [
      "当てただけ。それで何がしたかったの?",
      "球、動かす気ある?",
      "撫でただけじゃない。",
    ],
    scratchIn: [
      "入れて落ちる。それ、差し引きゼロどころかマイナスよ。",
      "道連れね。",
      "せっかく入れたのに。ふふ。",
    ],
    potCallSelf: [
      "ほら。",
      "当然。",
      "決まり。",
      "これよ。",
      "見た?",
      "ふふ。",
    ],
    playerPot: [
      "……ふーん。まぐれでしょ。",
      "入ったのは認めるわ。それだけ。",
      "へえ。やるじゃない。",
      "たまたまよ、たまたま。",
      "……次も入れられる?",
      "悪くないわね。悔しいけど。",
      "いい球。……今のはね。",
      "ふん、その程度で調子に乗らないで。",
      "……ちょっとだけ見直したわ。",
      "入れるだけなら誰でもできるでしょ。",
      "はいはい、上手ね。",
      "その調子で最後までいける?",
      "……たまには褒めてあげてもいいけど。",
    ],
    playerMiss: [
      "ほら外した。私の番ね。",
      "だから言ったでしょ。",
      "……見てられないわ。",
      "雑。もっと丁寧に撞きなさいよ。",
      "惜しくもないわね。",
      "はい交代。どいて。",
      "力任せに撞くからよ。",
      "その角度で入ると思ったの?",
      "慌てすぎ。",
      "薄い。全然薄いわよ。",
      "ま、そんなものよね。",
      "手球の行き先も考えなさいよ。",
      "私だったら入れてるわ。",
    ],
    playerFoul: [
      "ファウル。もらったわ、好きに置かせてもらう。",
      "……初歩的すぎない?",
      "ありがと。楽になったわ。",
      "手球まで飛ばすなんてね。",
      "はいはい、私の番。",
    ],
    cpuPot: [
      "ほら。こういうことよ。",
      "当然でしょ。",
      "入れて当たり前。",
      "……見てた? 今の。",
      "この程度は基本よ。",
      "私に回ってきた時点で終わってるの。",
      "綺麗に入ったわね。私が撞いたんだから。",
      "続けて撞くから、座ってて。",
      "ふふ。まだ続くけど。",
      "慣れてるのよ、この配置。",
      "狙った所に置いてるの、分かる?",
      "こうやって撞くのよ。覚えた?",
    ],
    cpuMiss: [
      "……今のは無し。",
      "ちょっと、手が滑っただけ。",
      "見なかったことにして。",
      "……たまたま外れただけだから。",
      "ラッキーね。喜んでいいわよ、今だけ。",
      "うるさい、次は入れるから。",
      "……こんなはずないんだけど。",
      "台が悪いのよ、きっと。",
      "今のは調整。本番はここから。",
      "……何か言った?",
      "ちょっと集中が切れただけ。",
      "はい、どうぞ。譲ってあげる。",
    ],
    cpuFoul: [
      "……っ。今のは無し!",
      "違う、狙い通りじゃないだけ。",
      "忘れて。今すぐ。",
      "ふん、貸しにしといてあげる。",
      "……たまには、ね。",
    ],
    win: [
      "私の勝ち。まあ、こんなものね。",
      "終わり。次は少しは粘りなさいよ。",
      "ほら言った通りでしょ。",
      "いい練習になった? なってないか。",
      "弱い。もう一回やる?",
    ],
    lose: [
      "……今のはたまたまでしょ。",
      "認めない。もう一回。",
      "調子が悪かっただけだから。",
      "……ちょっとは強くなったのね。悔しい。",
      "次は無いから。覚えておいて。",
    ],
    offShot: [
      "……今のは無し。次は本気出すから。",
      "あれ。ちょっと待って。",
      "手元が狂っただけよ。",
    ],
    sharpShot: [
      "ほら、こういうのが普通なの。",
      "見てなさい。",
      "この一打で終わらせるわ。",
    ],
    normalShot: [
      "私の番。見てなさいよ。",
      "どいて。",
      "こんなの入れて当然でしょ。",
    ],
  },
  luna: {
    potCall: ["通ったわ。", "入った——", "その線で正解よ。", "読み通りね。"],
    scratchCall: ["手球が落ちたわ。", "あら。", "……そっちが先ね。"],
    jaw: [
      "口で弾かれたわ。入射が浅いのよ。",
      "あと数ミリ。惜しいけれど、惜しいは入らないわ。",
      "ポケットは正直ね。",
    ],
    mash: [
      "強く撞くほど手球は暴れるわ。",
      "速度で解決する問題ではないわ。",
      "力は要らないの。線が要るのよ。",
    ],
    clear: [
      "解けたわね。次はもう一手ぶん複雑になるわ。",
      "正解。読み通りに転がったわね。",
      "いい線を選んだわ。",
      "クリア。今の角度、覚えておいて。",
      "解法は一つ。ちゃんと見つけたわね。",
      "綺麗に通ったわ。次へ行きましょう。",
    ],
    fail: [
      "外れたわ。線を引き直しましょう——",
      "惜しい。角度が少しだけ足りなかったわ——",
      "もう一度、順に辿ってみて——",
      "力加減の問題ではないわ。線を見直して——",
      "焦らなくていいわ。配置は変わらないから——",
      "今のずれを覚えておいて。次に活きるわ——",
    ],
  },
} as const;
const newShot = (
  target: number,
  isBreak: boolean,
  power: boolean,
  speed: number,
): Shot => ({
  target,
  first: null,
  pocketed: [],
  railAfter: false,
  railObjects: new Set(),
  scratch: false,
  power,
  isBreak,
  speed,
  rattled: false,
});

export function NeonBreakGame() {
  // Portrait vs. landscape is decided once at mount (and again on resize,
  // e.g. an actual device rotation) from the same 700px breakpoint the CSS
  // already uses for its own mobile treatment, rather than tracking real
  // device orientation - keeps this one consistent "mobile" definition
  // instead of a second one that could disagree with the CSS. SSR/first
  // paint always defaults to landscape (no window yet), so phones see a
  // brief landscape flash before this corrects it - a one-time cosmetic
  // blip on load, not something worth a hydration workaround for.
  const [portrait, setPortrait] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [shotPower, setShotPower] = useState(0);
  const [keyboardAim, setKeyboardAim] = useState(false);
  const keyboardRef = useRef(false),
    keyboardAngleRef = useRef(0),
    keyboardPowerRef = useRef(18);
  const pressRef = useRef<Point | null>(null);
  const previousGeometry = useRef<Geometry | null>(null);
  const [progress, setProgress] = useState<Progress>({
    soloBest: null,
    stages: {},
  });
  const progressRef = useRef<Progress>({ soloBest: null, stages: {} });
  const [helpOpen, setHelpOpen] = useState(false);
  // The shoot prompt is an invitation, not a readout: once the player has
  // grabbed the cue it has done its job and only covers the table.
  const [promptSeen, setPromptSeen] = useState(false);

  useEffect(() => {
    try {
      const saved = parseProgress(
        localStorage.getItem("neon-break-progress-v1"),
      );
      progressRef.current = saved;
      setProgress(saved);
    } catch {}
  }, []);
  const saveBest = (stage: number | null, shots: number) => {
    const old = progressRef.current;
    const next =
      stage === null
        ? { ...old, soloBest: Math.min(old.soloBest ?? Infinity, shots) }
        : {
            ...old,
            stages: {
              ...old.stages,
              [stage]: Math.min(old.stages[stage] ?? Infinity, shots),
            },
          };
    progressRef.current = next;
    setProgress(next);
    try {
      localStorage.setItem("neon-break-progress-v1", JSON.stringify(next));
    } catch {}
  };
  useEffect(() => {
    const check = () => setPortrait(window.innerWidth <= 700);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const geo = useMemo(() => buildGeometry(portrait), [portrait]);
  const pockets = useMemo(() => buildPockets(geo), [geo]);
  const STAGES = useMemo(() => buildStages(geo), [geo]);
  const { W, H, TX, TY, TR, TB } = geo;
  const canvasRef = useRef<HTMLCanvasElement>(null),
    ballsRef = useRef<Ball[]>([]),
    dragRef = useRef<Point | null>(null),
    phaseRef = useRef<Phase>("aim"),
    modeRef = useRef<GameMode>("solo"),
    turnRef = useRef(0),
    breakRef = useRef(true),
    shotRef = useRef<Shot | null>(null),
    chargesRef = useRef<[number, number]>([0, 0]),
    foulsRef = useRef<[number, number]>([0, 0]),
    shotsRef = useRef(0),
    runRef = useRef(0),
    aimRef = useRef<number | null>(null),
    msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    powerArmedRef = useRef(false),
    mutedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("aim"),
    [mode, setMode] = useState<GameMode>("solo"),
    [turn, setTurn] = useState(0),
    [charges, setCharges] = useState<[number, number]>([0, 0]),
    [fouls, setFouls] = useState<[number, number]>([0, 0]),
    [shotCount, setShotCount] = useState(0),
    [powerArmed, setPowerArmed] = useState(false),
    [muted, setMuted] = useState(false),
    [cpuForm, setCpuForm] = useState<"off" | "normal" | "sharp">("normal"),
    [crewMsg, setCrewMsg] = useState<string | null>(null),
    [record, setRecord] = useState<[number, number]>([0, 0]),
    [status, setStatus] = useState("SOLO — ブレイクショット"),
    [winner, setWinner] = useState<number | null>(null),
    [revision, setRevision] = useState(0);
  // STAGE MODE state - walls/warps are populated by reset() from STAGES[stageIndex]
  // for mode 'stage' and cleared to [] for solo/cpu, so the physics/render
  // code below can treat them uniformly regardless of mode.
  const stageIndexRef = useRef(0);
  const [stageIndex, setStageIndexState] = useState(0);
  const wallsRef = useRef<Wall[]>([]);
  const warpsRef = useRef<Warp[]>([]);
  // Mode switch, stage switch, and NEW RACK all discard whatever's in
  // progress with a single tap - fine when there's nothing to lose yet, but
  // a real "did you mean that" risk once shotCount>0, especially on the
  // stage-select grid (21 small buttons packed together) where a mistap is
  // easy. Gated on shotCount rather than confirming unconditionally so
  // browsing stages before playing stays a single tap.
  const [confirmAction, setConfirmAction] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const confirmIfProgress = (message: string, action: () => void) => {
    if (shotsRef.current > 0 && phaseRef.current !== "gameover")
      setConfirmAction({ message, onConfirm: action });
    else action();
  };
  useEffect(() => {
    pausedRef.current = paused || !!confirmAction || helpOpen;
  }, [paused, confirmAction, helpOpen]);

  // Lazily built on first render (client-only) so there's a single stable
  // engine instance for the component's lifetime; actual AudioContext
  // creation inside it is still deferred to the first real sound call.
  const audioEngineRef = useRef<ReturnType<typeof createBreakAudio> | null>(
    null,
  );
  if (!audioEngineRef.current) audioEngineRef.current = createBreakAudio();
  useEffect(() => () => audioEngineRef.current?.dispose(), []);
  // BGM is off. The three loops still live in breakAudio.ts (setMusic takes
  // 'solo' | 'cpu' | 'stage' | null and starts the matching one); putting
  // `setMusic(mode)` back in this effect is the whole switch.
  useEffect(() => {
    audioEngineRef.current?.setMusic(null);
  }, [mode]);
  const sparksRef = useRef<Spark[]>([]);
  // Full-screen color pulse (power shot fire = cyan/pink, foul = red),
  // 0 = none, counts down to 0 each frame.
  const flashRef = useRef<{
    color: string;
    life: number;
    maxLife: number;
  } | null>(null);

  const sync = () => {
    setPhase(phaseRef.current);
    setMode(modeRef.current);
    setTurn(turnRef.current);
    setCharges([...chargesRef.current] as [number, number]);
    setFouls([...foulsRef.current] as [number, number]);
    setShotCount(shotsRef.current);
    setPowerArmed(powerArmedRef.current);
    setRevision((v) => v + 1);
  };
  const triggerFlash = (color: string, life = 0.35) => {
    flashRef.current = { color, life, maxLife: life };
  };
  const lowest = () =>
    Math.min(
      ...ballsRef.current.filter((b) => b.id > 0 && b.active).map((b) => b.id),
    );
  const safeSpot = (x: number, y: number) => {
    const cue = ballsRef.current[0];
    x = Math.max(TX + R, Math.min(TR - R, x));
    y = Math.max(TY + R, Math.min(TB - R, y));
    const blocked = ballsRef.current.some(
      (b) => b.id > 0 && b.active && Math.hypot(b.x - x, b.y - y) < R * 2.15,
    );
    if (!blocked) {
      cue.x = x;
      cue.y = y;
      cue.vx = cue.vy = 0;
      cue.active = true;
      return true;
    }
    return false;
  };
  const reset = useCallback(
    (nextMode?: GameMode) => {
      setPromptSeen(false);
      setPaused(false);
      pausedRef.current = false;
      pressRef.current = null;
      aimRef.current = null;
      keyboardRef.current = false;
      setKeyboardAim(false);
      setShotPower(0);
      runRef.current = 0;
      sparksRef.current = [];
      flashRef.current = null;
      if (nextMode) modeRef.current = nextMode;
      if (msgTimer.current) clearTimeout(msgTimer.current);
      setCrewMsg(null);
      dragRef.current = null;
      phaseRef.current = "aim";
      turnRef.current = 0;
      breakRef.current = false;
      shotRef.current = null;
      chargesRef.current = [0, 0];
      foulsRef.current = [0, 0];
      shotsRef.current = 0;
      powerArmedRef.current = false;
      setWinner(null);
      if (modeRef.current === "stage") {
        const stage = STAGES[stageIndexRef.current];
        ballsRef.current = stageRack(stageIndexRef.current + 1, geo);
        wallsRef.current = stage.walls;
        warpsRef.current = stage.warps;
        setStatus(`STAGE ${stageIndexRef.current + 1} — 一打で9番を沈める`);
      } else {
        ballsRef.current = rack(geo);
        breakRef.current = true;
        wallsRef.current = [];
        warpsRef.current = [];
        setStatus(
          modeRef.current === "solo"
            ? "SOLO — ブレイクショット"
            : "YOU — ブレイクショット",
        );
      }
      sync();
    },
    [geo, STAGES],
  );
  const selectStage = (i: number) => {
    audioEngineRef.current!.uiClick();
    stageIndexRef.current = i;
    setStageIndexState(i);
    reset("stage");
  };
  // Give up on the shot in flight instead of waiting for it to actually miss
  // - once it's obviously not going in, there's no reason to sit through the
  // rest of the roll before getting another try. Counts as a used attempt,
  // same as an actual miss would, so this can't be used to dodge the counter.
  const retryStage = () => {
    if (modeRef.current !== "stage" || phaseRef.current === "gameover") return;
    audioEngineRef.current!.uiClick();
    // Attempts are counted only when a shot is fired.
    ballsRef.current = stageRack(stageIndexRef.current + 1, geo);
    dragRef.current = null;
    aimRef.current = null;
    keyboardRef.current = false;
    setKeyboardAim(false);
    setShotPower(0);
    shotRef.current = null;
    phaseRef.current = "aim";
    setStatus(
      `STAGE ${stageIndexRef.current + 1} — リトライ (${shotsRef.current}打目)`,
    );
    sync();
  };
  // Same "along the break axis, from the apex point" placement rack() uses,
  // swept back toward the cue side until it clears the other balls - apexFrac
  // and dir mirror rack()'s so this still lands at the actual apex/foot spot
  // now that portrait puts that near the top instead of the bottom.
  const respot9 = () => {
    const nine = ballsRef.current.find((b) => b.id === 9)!;
    nine.active = true;
    nine.vx = nine.vy = 0;
    const alongLen = portrait ? TB - TY : TR - TX,
      alongStart = portrait ? TY : TX,
      acrossCenter = portrait ? (TX + TR) / 2 : (TY + TB) / 2;
    const apexFrac = portrait ? 0.25 : 0.75,
      dir = portrait ? -1 : 1;
    const place = (alongPx: number): Point => {
      const a = alongStart + alongPx;
      return portrait ? { x: acrossCenter, y: a } : { x: a, y: acrossCenter };
    };
    for (let dx = 0; dx < 180; dx += R * 2.1) {
      const { x, y } = place(alongLen * apexFrac - dir * dx);
      if (
        !ballsRef.current.some(
          (b) =>
            b !== nine && b.active && Math.hypot(b.x - x, b.y - y) < R * 2.1,
        )
      ) {
        nine.x = x;
        nine.y = y;
        return;
      }
    }
    const { x, y } = place(alongLen * apexFrac);
    nine.x = x;
    nine.y = y;
  };

  useEffect(() => {
    const canvas = canvasRef.current!,
      ctx = canvas.getContext("2d")!;
    let raf = 0,
      last = performance.now(),
      cpuTimer: ReturnType<typeof setTimeout> | null = null;
    // ballsRef starts empty (see its useRef above) because rack() needs geo,
    // which isn't resolved until this effect's first run - this reset() call
    // is what actually populates the very first table, for the current mode.
    // It also re-fires here whenever geo changes later (a resize crossing the
    // 700px breakpoint), which intentionally restarts the current mode's
    // layout in the new orientation rather than trying to carry mid-shot
    // state across a coordinate-system swap.
    const previous = previousGeometry.current;
    if (!ballsRef.current.length) reset(modeRef.current);
    else if (previous && previous.portrait !== geo.portrait) {
      // Rotate live coordinates and velocities instead of restarting a game.
      for (const b of ballsRef.current) {
        const { x, y, vx, vy } = b;
        if (geo.portrait) {
          b.x = y;
          b.y = previous.W - x;
          b.vx = vy;
          b.vy = -vx;
        } else {
          b.x = previous.H - y;
          b.y = x;
          b.vx = -vy;
          b.vy = vx;
        }
      }
      if (modeRef.current === "stage") {
        const stage = STAGES[stageIndexRef.current];
        wallsRef.current = stage.walls;
        warpsRef.current = stage.warps;
      }
      dragRef.current = null;
      aimRef.current = null;
      pressRef.current = null;
      keyboardRef.current = false;
      setKeyboardAim(false);
      setShotPower(0);
      sparksRef.current = [];
      sync();
    }
    previousGeometry.current = geo;
    // The rail sits exactly on the TX/TY/TR/TB rectangle the physics bounces
    // off, with one exception: the span across a side pocket's mouth isn't
    // drawn. A corner pocket's void already covers where its two rails end,
    // so those read as stopping at the mouth on their own; a side pocket sits
    // mid-rail, so without the gap the rail draws a solid lit bar straight
    // across the opening - a boundary painted over the one place that is
    // specifically not a boundary. An earlier pass went much further than
    // this and cut diagonal notches at the corners while dipping the rail
    // ~30px into the playfield at the sides, which put drawn rail where the
    // simulation had none; the rectangle itself is untouched here.
    const drawTableOutline = () => {
      ctx.shadowBlur = 26;
      ctx.shadowColor = "#1bdfff";
      ctx.strokeStyle = "#37e7ff";
      ctx.lineWidth = 4;
      const seg = (x1: number, y1: number, x2: number, y2: number) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      };
      const mouth = (fixed: number, horiz: boolean) =>
        pockets.find((p) => p.kind === "side" && (horiz ? p.y : p.x) === fixed);
      for (const y of [TY, TB]) {
        const g = mouth(y, true);
        if (g) {
          seg(TX, y, g.x - g.r, y);
          seg(g.x + g.r, y, TR, y);
        } else seg(TX, y, TR, y);
      }
      for (const x of [TX, TR]) {
        const g = mouth(x, false);
        if (g) {
          seg(x, TY, x, g.y - g.r);
          seg(x, g.y + g.r, x, TB);
        } else seg(x, TY, x, TB);
      }
      ctx.shadowBlur = 0;
    };
    // All six scoring pockets are the same thing: concentric tunnel rings
    // fading to black with motes falling inward, and NO rim stroke at all.
    // A rim in the rail's own colour and weight reads as a second rail drawn
    // around a hole, which is not what a pocket is - the mouth is an opening
    // in the boundary, not another boundary. Only the stage-mode warps take a
    // colour here (pink), because a warp sits out on open cloth with no rail
    // to be an opening in, so it needs its own edge to read as anything.
    // openDir, when given, is the direction a ball travels to sink here (a
    // scoring pocket's own p.accept). Side pockets sit mid-rail and used to
    // render as a full circle straddling the rail line, so half the hole
    // bulged into the playfield with nothing there to fall into - clipping
    // the whole void to the rail-facing half removes that dead bulge. Corners
    // keep the full circle: the rail ends there, so nothing is bulging past
    // a boundary that continues.
    const drawVoid = (
      cx: number,
      cy: number,
      r: number,
      t: number,
      color: string | null,
      openDir?: Point,
    ) => {
      if (openDir) {
        // A true half-plane clip through the center, not just a wide arc - an
        // arc's curvature would creep back inward past the straight rail line
        // the further out the crosshair arms reach.
        const rail = Math.atan2(openDir.y, openDir.x);
        const nx = Math.cos(rail),
          ny = Math.sin(rail),
          px = -ny,
          py = nx,
          big = r * 6,
          // A hair of the hole is allowed back past the rail line so the cut
          // has something to fade out across; it is erased to nothing by the
          // gradient below, so nothing solid ever sits on the cloth.
          bx = cx - nx * POCKET_BLEED,
          by = cy - ny * POCKET_BLEED;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(bx - px * big, by - py * big);
        ctx.lineTo(bx + px * big, by + py * big);
        ctx.lineTo(bx + px * big + nx * big, by + py * big + ny * big);
        ctx.lineTo(bx - px * big + nx * big, by - py * big + ny * big);
        ctx.closePath();
        ctx.clip();
      }
      // Layered rings shrinking toward black, rather than one flat disc, so
      // there's a sense of looking down a tunnel instead of at a painted dot.
      // The glow on each ring edge is set here rather than inherited: this
      // loop used to run with no shadow at all for the first pocket in the
      // array and with the previous pocket's leftover mote glow for every one
      // after it, so the top-left pocket - drawn first - came out flat and
      // visibly darker than the other five.
      ctx.shadowColor = "#37e7ff";
      ctx.shadowBlur = 6;
      for (let i = 4; i >= 1; i--) {
        const rad = r * (i / 4);
        ctx.fillStyle =
          i === 4
            ? "#0a1a20"
            : i === 3
              ? "#051015"
              : i === 2
                ? "#020a0e"
                : "#000";
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      // Motes falling inward along a spiral and shrinking/fading as they
      // approach the center - actual inward motion is what reads as "pulling
      // things in", which a static ring (however it's styled) can't convey on
      // its own. Kept inside the rim so the hole never spills onto the cloth.
      const seed = cx * 7 + cy * 3,
        N = 14,
        cycle = 3600;
      for (let i = 0; i < N; i++) {
        const phase = (t / cycle + i / N + seed * 0.001) % 1,
          rad = r * 0.92 * (1 - phase);
        const angle = phase * Math.PI * 3 + seed;
        const mx = cx + Math.cos(angle) * rad,
          my = cy + Math.sin(angle) * rad;
        const alpha = Math.min(1, phase * 6) * (1 - phase * phase);
        if (alpha <= 0.02) continue;
        const mc = i % 3 === 0 ? "#ff3bce" : "#37e7ff";
        ctx.globalAlpha = alpha;
        ctx.fillStyle = mc;
        ctx.shadowColor = mc;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(mx, my, 1.3 * (1 - phase * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      if (openDir) {
        // The clip alone leaves a razor edge on the rail line and the rings
        // read as sawn through. Instead of stopping there, a little of the
        // hole is let back onto the cloth and erased across that band, so the
        // cut becomes a fade-out. Nothing solid crosses the rail - the band
        // is fully transparent by its inner edge.
        const rail = Math.atan2(openDir.y, openDir.x),
          nx = Math.cos(rail),
          ny = Math.sin(rail);
        const g = ctx.createLinearGradient(
          cx - nx * POCKET_BLEED,
          cy - ny * POCKET_BLEED,
          cx + nx * POCKET_FADE,
          cy + ny * POCKET_FADE,
        );
        g.addColorStop(0, "rgba(0,0,0,1)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalCompositeOperation = "destination-out";
        ctx.shadowBlur = 0;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.04, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.restore();
      }
      ctx.shadowBlur = 0;
    };
    const drawPocketVoid = (p: Pocket, t: number) =>
      drawVoid(
        p.x,
        p.y,
        p.r,
        t,
        null,
        p.kind === "side" ? p.accept : undefined,
      );

    const drawWarp = (w: Warp, t: number) =>
      drawVoid(w.x, w.y, w.r, t, "#ff3bce");
    // Which hole comes out of which is the whole puzzle, so the pair is drawn
    // as an explicit tether rather than left to be inferred from "there are
    // two pink circles". Crawling dashes run entrance -> exit so the link
    // also says which way through it is.
    const drawWarpLink = (t: number) => {
      const ws = warpsRef.current;
      for (let i = 0; i < ws.length; i += 2) {
        const a = ws[i],
          b = ws[a.pair];
        if (!b) continue;
        ctx.save();
        ctx.strokeStyle = "rgba(255,59,206,.28)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([7, 11]);
        ctx.lineDashOffset = -(t / 26) % 18;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.restore();
      }
    };
    // The stage-mode aim guide is traced, not drawn as one straight line: it
    // reflects off rails and force walls, jumps through a wormhole keeping
    // its direction, and stops where the cue ball would first touch another
    // ball. A wormhole whose far side you can't see through is a guess rather
    // than a puzzle - this is what makes the route readable before the shot.
    // Each hit is resolved against the same numbers tick() uses (ball centre
    // limits at the rails, centre-inside-radius for the warp), so the line
    // isn't a separate approximation of the physics.
    const traceAim = (
      sx: number,
      sy: number,
      dx: number,
      dy: number,
      budget: number,
    ): (Point & { jump?: boolean })[] => {
      const pts: (Point & { jump?: boolean })[] = [{ x: sx, y: sy }];
      let x = sx,
        y = sy,
        nx = dx,
        ny = dy,
        left = budget;
      for (let hop = 0; hop < 10 && left > 1; hop++) {
        let best = left,
          kind = "",
          wall: Wall | null = null,
          warp: Warp | null = null,
          axis = "";
        for (const w of wallsRef.current) {
          const t = raySegment(x, y, nx, ny, w.x1, w.y1, w.x2, w.y2);
          if (t !== null && t > 0.6 && t < best) {
            best = t;
            kind = "wall";
            wall = w;
          }
        }
        for (const w of warpsRef.current) {
          const t = rayCircle(x, y, nx, ny, w.x, w.y, w.r);
          if (t !== null && t > 0.6 && t < best) {
            best = t;
            kind = "warp";
            warp = w;
          }
        }
        for (const b of ballsRef.current) {
          if (!b.active || b.id === 0) continue;
          const t = rayCircle(x, y, nx, ny, b.x, b.y, b.r + R);
          if (t !== null && t > 0.6 && t < best) {
            best = t;
            kind = "ball";
          }
        }
        const rails: [number, string][] = [];
        if (nx > 0) rails.push([(TR - R - x) / nx, "x"]);
        else if (nx < 0) rails.push([(TX + R - x) / nx, "x"]);
        if (ny > 0) rails.push([(TB - R - y) / ny, "y"]);
        else if (ny < 0) rails.push([(TY + R - y) / ny, "y"]);
        for (const [t, ax] of rails)
          if (t > 0.6 && t < best) {
            best = t;
            kind = "rail";
            axis = ax;
          }
        x += nx * best;
        y += ny * best;
        left -= best;
        pts.push({ x, y });
        if (kind === "ball" || kind === "") break;
        if (kind === "rail") {
          if (axis === "x") nx = -nx;
          else ny = -ny;
          continue;
        }
        if (kind === "wall" && wall) {
          const wx = wall.x2 - wall.x1,
            wy = wall.y2 - wall.y1,
            wl = Math.hypot(wx, wy) || 1;
          const ax = -wy / wl,
            ay = wx / wl,
            dot = nx * ax + ny * ay;
          nx -= 2 * dot * ax;
          ny -= 2 * dot * ay;
          continue;
        }
        if (kind === "warp" && warp) {
          const dest = warpsRef.current[warp.pair];
          x = dest.x + nx * (dest.r + R + 2);
          y = dest.y + ny * (dest.r + R + 2);
          pts.push({ x, y, jump: true });
        }
      }
      return pts;
    };
    // Force wall: a glowing cushion segment sitting ON the cloth rather than
    // around it. Drawn with the same pink accent as the warps (both are
    // "stage mode hazard" elements, cyan stays reserved for the rail/pockets)
    // and a faint animated dash crawl so it reads as an active field, not a
    // painted line.
    const drawWall = (wall: Wall, t: number) => {
      ctx.save();
      ctx.strokeStyle = "rgba(255,59,188,.18)";
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);
      ctx.stroke();
      ctx.strokeStyle = "#ff3bce";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#ff3bce";
      ctx.shadowBlur = 12;
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = -(t / 40) % 18;
      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);
      ctx.stroke();
      ctx.restore();
    };
    // Rim stop uses the ball's own color instead of near-black so the disc
    // stays saturated end to end - lit from within rather than lit from one
    // corner - without needing the separate soft halo pass an earlier version
    // had here (a big low-alpha blurred circle behind every ball read as a
    // smudge, not a glow; the shadowBlur on the ball itself already carries
    // the light-source read on its own). Number is set in Baloo 2, the same
    // chunky display face the main site loads for every MarutiBit game's
    // numerals (see layout.tsx) - matches the brand instead of the default
    // monospace, and large enough to still hold up at phone size. No backing
    // circle: real solid balls print the number straight onto the color in
    // black, no white/dark disc behind it - black reads fine on these hues.
    const drawBall = (b: Ball) => {
      if (!b.active) return;
      const c = COLORS[b.id],
        speed = Math.hypot(b.vx, b.vy);
      if (speed > 3) {
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(
          b.x - b.vx * 0.02,
          b.y - b.vy * 0.02,
          b.r * 0.85,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.shadowColor = c;
      ctx.shadowBlur = 16 + b.flash * 20;
      const g = ctx.createRadialGradient(b.x - 5, b.y - 6, 1, b.x, b.y, b.r);
      g.addColorStop(0, "#fff");
      g.addColorStop(0.35, c);
      g.addColorStop(1, c);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // White fill over black-only text: this file's balls run from pale
      // yellow-green (#eaff66) to deep purple/blue, and a dark outline stays
      // legible across that whole range where a light outline would wash out
      // on the paler balls. Outline color is the game's own near-black
      // (matches the felt/table tone) rather than flat #000, so it reads as
      // part of this palette instead of a generic UI stroke.
      if (b.id > 0) {
        ctx.font = '800 16px "Baloo 2","Yu Gothic UI",sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#07101a";
        ctx.strokeText(String(b.id), b.x, b.y + 1);
        ctx.fillStyle = "#fff";
        ctx.fillText(String(b.id), b.x, b.y + 1);
      }
      if (
        b.id === 0 &&
        shotRef.current?.power &&
        phaseRef.current === "rolling"
      ) {
        ctx.strokeStyle = "#ff3bce";
        ctx.lineWidth = 3;
        ctx.shadowColor = "#ff3bce";
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    };
    // No CSS background-color or backdrop-filter on the canvas element (or its
    // ancestors) can make the FELT show the page behind it: every frame this
    // function paints an opaque fillRect over the whole canvas, which is
    // pixels the canvas itself owns and composites in front of anything CSS
    // puts behind it, full stop. clearRect first, then a translucent (not
    // opaque) gradient, is what's actually needed - clearing to real
    // transparency every frame (rather than just lowering the fill's alpha on
    // top of whatever the previous frame left behind) is what keeps a moving
    // ball's old position from ghosting through instead of being erased.
    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createLinearGradient(0, 0, W, H);
      // The felt wash only covers the table, so any part of the character
      // behind it reads a full step darker than the part beside it - a
      // visible vertical seam down her, exactly at the table's edge.
      const wash = portrait ? 0.42 : 0.2;
      bg.addColorStop(0, `rgba(2,11,19,${wash})`);
      bg.addColorStop(0.55, `rgba(4,18,29,${wash - 0.05})`);
      bg.addColorStop(1, `rgba(10,4,20,${wash})`);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(48,183,218,.11)";
      ctx.lineWidth = 1;
      for (let x = 70; x < W; x += 42) {
        ctx.beginPath();
        ctx.moveTo(x, TY);
        ctx.lineTo(x, TB);
        ctx.stroke();
      }
      for (let y = 70; y < H; y += 42) {
        ctx.beginPath();
        ctx.moveTo(TX, y);
        ctx.lineTo(TR, y);
        ctx.stroke();
      }
      drawTableOutline();
      ctx.strokeStyle = "rgba(255,255,255,.07)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 8; i++) {
        const x = TX + ((TR - TX) * i) / 8;
        ctx.beginPath();
        ctx.moveTo(x, TY);
        ctx.lineTo(x, TY + 9);
        ctx.moveTo(x, TB);
        ctx.lineTo(x, TB - 9);
        ctx.stroke();
      }
      pockets.forEach((p) => {
        drawPocketVoid(p, t);
      });
      wallsRef.current.forEach((w) => drawWall(w, t));
      drawWarpLink(t);
      warpsRef.current.forEach((w) => drawWarp(w, t));
      for (const b of ballsRef.current) {
        b.flash *= 0.92;
        drawBall(b);
      }
      const cue = ballsRef.current[0],
        drag = keyboardRef.current
          ? {
              x:
                cue.x -
                (Math.cos(keyboardAngleRef.current) *
                  keyboardPowerRef.current) /
                  0.18,
              y:
                cue.y -
                (Math.sin(keyboardAngleRef.current) *
                  keyboardPowerRef.current) /
                  0.18,
            }
          : dragRef.current;
      if (phaseRef.current === "aim" && cue.active && drag) {
        const dx = cue.x - drag.x,
          dy = cue.y - drag.y,
          m = Math.hypot(dx, dy),
          power = Math.min(m * 0.18, MAX_SHOT),
          pull = Math.min(power * 1.8, 28);
        if (m > 2) {
          const ang = keyboardRef.current
              ? keyboardAngleRef.current
              : (aimRef.current ?? Math.atan2(dy, dx)),
            nx = Math.cos(ang),
            ny = Math.sin(ang);
          ctx.strokeStyle = powerArmedRef.current ? "#ff42d2" : "#eaffff";
          ctx.lineWidth = 2;
          ctx.setLineDash([9, 7]);
          ctx.beginPath();
          if (modeRef.current === "stage") {
            const path = traceAim(cue.x, cue.y, nx, ny, 560);
            ctx.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) {
              const q = path[i];
              if (q.jump) ctx.moveTo(q.x, q.y);
              else ctx.lineTo(q.x, q.y);
            }
          } else {
            // Deliberately just a line. Showing the contact point and the
            // object ball's departure turns aiming into reading a diagram -
            // the stage puzzles need their route drawn, a 9-ball rack does
            // not.
            ctx.moveTo(cue.x, cue.y);
            ctx.lineTo(cue.x + nx * 320, cue.y + ny * 320);
          }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.strokeStyle = powerArmedRef.current ? "#ff3bce" : "#2ee3ff";
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(cue.x - nx * (R + 7 + pull), cue.y - ny * (R + 7 + pull));
          ctx.lineTo(
            cue.x - nx * (R + 107 + pull),
            cue.y - ny * (R + 107 + pull),
          );
          ctx.stroke();
          ctx.fillStyle = "#fff";
          ctx.font = "700 10px monospace";
          ctx.fillText(
            Math.round((power / MAX_SHOT) * 100) + "%",
            cue.x - nx * (R + 122 + pull),
            cue.y - ny * (R + 122 + pull),
          );
        }
      }
      if (phaseRef.current === "placing") {
        ctx.fillStyle = "rgba(255,59,206,.07)";
        ctx.fillRect(TX, TY, TR - TX, TB - TY);
        ctx.fillStyle = "#ff78dc";
        ctx.font = "700 12px monospace";
        ctx.textAlign = "center";
        ctx.fillText("BALL IN HAND — 空いている位置をクリック", W / 2, 31);
      }
      for (const s of sparksRef.current) {
        const a = Math.max(0, s.life / s.maxLife);
        ctx.globalAlpha = a;
        ctx.fillStyle = s.color;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 8 * a;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * a, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
      const flash = flashRef.current;
      if (flash && flash.life > 0) {
        ctx.globalAlpha = (flash.life / flash.maxLife) * 0.35;
        ctx.fillStyle = flash.color;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
    };

    const cpuShoot = () => {
      if (
        modeRef.current !== "cpu" ||
        turnRef.current !== 1 ||
        phaseRef.current !== "aim"
      )
        return;
      if (pausedRef.current || document.hidden) {
        scheduleCpu();
        return;
      }
      const cue = ballsRef.current[0],
        targetId = lowest(),
        target = ballsRef.current.find((b) => b.id === targetId && b.active);
      if (!target) return;
      // Aika is not a difficulty setting, she is a player having a session:
      // each shot rolls its own form, so she sprays one and then threads the
      // next. The three presets are reused as moods rather than as a menu.
      const roll = Math.random(),
        form: Difficulty =
          roll < 0.24 ? "casual" : roll < 0.82 ? "standard" : "expert";
      const plan = planCpu(cue, target, ballsRef.current, pockets, geo, form);
      const angle = breakRef.current
        ? Math.atan2(target.y - cue.y, target.x - cue.x)
        : plan.angle;
      const usePower = chargesRef.current[1] >= 100 && !plan.clean,
        power = breakRef.current ? 52 : plan.power;
      const mood =
        form === "expert" ? "sharp" : form === "casual" ? "off" : "normal";
      setCpuForm(mood);
      cue.vx = Math.cos(angle) * power * (usePower ? 3 : 1);
      cue.vy = Math.sin(angle) * power * (usePower ? 3 : 1);
      shotRef.current = newShot(
        targetId,
        breakRef.current,
        usePower,
        power * (usePower ? 3 : 1),
      );
      if (usePower) chargesRef.current[1] = 0;
      shotsRef.current++;
      phaseRef.current = "rolling";
      setCrewMsg(
        pick(
          mood === "off"
            ? VOICE.aika.offShot
            : mood === "sharp"
              ? VOICE.aika.sharpShot
              : VOICE.aika.normalShot,
        ),
      );
      setStatus(
        usePower
          ? "POWER SHOT — AIKAの一打、ポケットを弾く"
          : "AIKA SHOT — AIKAの一打",
      );
      audioEngineRef.current!.cueStrike(power * (usePower ? 3 : 1));
      if (usePower) triggerFlash("#ff3bce", 0.25);
      sync();
    };
    // Candidate ball-in-hand spots for the CPU, as (distance along the break
    // axis from its start rail, perpendicular offset from center) pairs -
    // same handful of practical safe spots as before, just no longer tied to
    // a specific x/y so they land somewhere sane in either orientation.
    const CPU_SAFE_SPOTS: [number, number][] = [
      [170, 0],
      [210, -80],
      [210, 80],
      [310, 0],
      [130, -110],
    ];
    const scheduleCpu = () => {
      if (cpuTimer) clearTimeout(cpuTimer);
      cpuTimer = setTimeout(() => {
        if (
          modeRef.current !== "cpu" ||
          turnRef.current !== 1 ||
          phaseRef.current === "gameover"
        )
          return;
        if (pausedRef.current || document.hidden) {
          scheduleCpu();
          return;
        }
        if (phaseRef.current === "placing") {
          const alongStart = portrait ? TY : TX,
            acrossCenter = portrait ? (TX + TR) / 2 : (TY + TB) / 2;
          const spots = CPU_SAFE_SPOTS.map(
            ([alongPx, off]): [number, number] => {
              const a = alongStart + alongPx,
                c = acrossCenter + off;
              return portrait ? [c, a] : [a, c];
            },
          );
          for (const [x, y] of spots) if (safeSpot(x, y)) break;
          phaseRef.current = "aim";
          setStatus("AIKA AIMING — 狙いを決めている");
          sync();
          cpuTimer = setTimeout(cpuShoot, 650);
        } else {
          setStatus("AIKA AIMING — 狙いを決めている");
          sync();
          cpuShoot();
        }
      }, 700);
    };
    // STAGE MODE scoring, entirely separate from the nine-ball rule engine
    // below - no lowest-ball-first, no break legality, no fouls, and no
    // "keep shooting from wherever it landed" either. It's a one-shot puzzle
    // per attempt, same as a bowling/golf stage mode: sink the target ball
    // (id 9) on THIS shot and the stage clears, anything else (miss, scratch,
    // whatever) and the whole layout resets to its starting positions for
    // another single-shot try. shotsRef keeps counting across attempts so the
    // player can see how many tries a stage took.
    const endStageShot = (s: Shot) => {
      setPromptSeen(false);
      if (s.pocketed.includes(9)) {
        saveBest(stageIndexRef.current + 1, shotsRef.current);
        say(VOICE.luna.clear);
        phaseRef.current = "gameover";
        setStatus(
          shotsRef.current === 1
            ? `STAGE ${stageIndexRef.current + 1} CLEAR — 1打で成功!`
            : `STAGE ${stageIndexRef.current + 1} CLEAR — ${shotsRef.current}打目`,
        );
        audioEngineRef.current!.win();
        const nine = ballsRef.current.find((b) => b.id === 9);
        if (nine)
          spawnBurst(sparksRef.current, nine.x, nine.y, {
            count: 40,
            speed: 180,
            life: 1.1,
            colors: COLORS,
            size: 3,
          });
      } else {
        say(
          s.rattled
            ? VOICE.luna.jaw
            : !s.power && s.speed >= MAX_SHOT * 0.93
              ? VOICE.luna.mash
              : VOICE.luna.fail,
        );
        audioEngineRef.current!.foul();
        triggerFlash("#ff2e4a", 0.25);
        ballsRef.current = stageRack(stageIndexRef.current + 1, geo);
        phaseRef.current = "aim";
        setStatus(
          `STAGE ${stageIndexRef.current + 1} — 失敗、もう一度 (${shotsRef.current}打目)`,
        );
      }
      powerArmedRef.current = false;
      shotRef.current = null;
      sync();
    };
    // A reaction and a pre-shot line are two different jobs: the first is
    // about the shot that just happened, the second is what she says while
    // you line the next one up. Showing only the reaction meant you read the
    // last shot's comment for the whole time you were aiming, so the panel
    // hands itself back a few seconds later. The rare lines are hers alone -
    // roughly one in eleven, often enough to be found, rare enough to land.
    const say = (pool: readonly string[]) => {
      if (msgTimer.current) clearTimeout(msgTimer.current);
      setCrewMsg(pick(pool));
      msgTimer.current = setTimeout(() => {
        if (phaseRef.current === "gameover" || phaseRef.current === "rolling")
          return;
        setCrewMsg(
          modeRef.current === "solo"
            ? pick(Math.random() < 0.09 ? VOICE.aoi.rare : VOICE.aoi.preShot)
            : null,
        );
      }, 3400);
    };
    // Session tally, so REMATCH has something to add up to.
    const recordWin = (w: number) => {
      if (modeRef.current === "cpu")
        setRecord((r) => [r[0] + (w === 0 ? 1 : 0), r[1] + (w === 1 ? 1 : 0)]);
    };
    const endShot = () => {
      setPromptSeen(false);
      const s = shotRef.current;
      if (!s) return;
      if (modeRef.current === "stage") return endStageShot(s);
      const verdict = shotVerdict(s),
        foul = verdict.foul;
      const nineDown = s.pocketed.includes(9);
      if (nineDown && !foul) {
        if (modeRef.current === "solo") saveBest(null, shotsRef.current);
        const w = turnRef.current;
        say(
          modeRef.current === "solo"
            ? VOICE.aoi.win
            : w === 0
              ? VOICE.aika.lose
              : VOICE.aika.win,
        );
        phaseRef.current = "gameover";
        recordWin(turnRef.current);
        setWinner(turnRef.current);
        setStatus(
          modeRef.current === "solo"
            ? `SOLO CLEAR — ${shotsRef.current} SHOTS`
            : turnRef.current === 0
              ? "YOU WIN — 9 BALL DOWN"
              : "CPU WIN — 9 BALL DOWN",
        );
        audioEngineRef.current!.win();
        const nine = ballsRef.current.find((b) => b.id === 9);
        if (nine)
          spawnBurst(sparksRef.current, nine.x, nine.y, {
            count: 40,
            speed: 180,
            life: 1.1,
            colors: COLORS,
            size: 3,
          });
        sync();
        return;
      }
      if (nineDown) respot9();
      const objectPots = s.pocketed.filter((id) => id > 0 && id !== 9).length;
      if (foul) {
        audioEngineRef.current!.foul();
        triggerFlash("#ff2e4a", 0.3);
        const offender = turnRef.current;
        runRef.current = 0;
        const reason = verdict.reason;
        // A foul is not one event. Whiffing, potting off the wrong ball,
        // dropping the cue ball along with the object ball and nudging a
        // ball nowhere are four different things that happen to everyone
        // who plays, and they all used to land on the same line. Only the
        // player's own shots get these - AIKA fouling is her business.
        const potted = s.pocketed.some((id) => id > 0);
        const own = modeRef.current === "solo" || offender === 0;
        const situation = !own
          ? null
          : s.first === null
            ? [VOICE.aoi.whiff, VOICE.aika.whiff]
            : s.scratch && potted
              ? [VOICE.aoi.scratchIn, VOICE.aika.scratchIn]
              : s.first !== s.target && potted
                ? [VOICE.aoi.fluke, VOICE.aika.fluke]
                : reason === "クッションまたはポケットなし"
                  ? [VOICE.aoi.noRail, VOICE.aika.noRail]
                  : null;
        say(
          situation
            ? situation[modeRef.current === "solo" ? 0 : 1]
            : modeRef.current === "solo"
              ? s.scratch
                ? VOICE.aoi.scratch
                : VOICE.aoi.foul
              : offender === 0
                ? VOICE.aika.playerFoul
                : VOICE.aika.cpuFoul,
        );
        foulsRef.current[offender]++;
        if (modeRef.current === "solo") {
          const cue = ballsRef.current[0];
          cue.active = true;
          cue.vx = cue.vy = 0;
          phaseRef.current = "placing";
          setStatus(`FOUL: ${reason} — 手球を置き直す`);
        } else if (foulsRef.current[offender] >= 3) {
          turnRef.current = 1 - offender;
          say(turnRef.current === 0 ? VOICE.aika.lose : VOICE.aika.win);
          phaseRef.current = "gameover";
          recordWin(turnRef.current);
          setWinner(turnRef.current);
          setStatus(
            turnRef.current === 0
              ? "YOU WIN — AIKAが3ファウル"
              : "AIKA WIN — 3ファウル",
          );
          audioEngineRef.current!.win();
          powerArmedRef.current = false;
          shotRef.current = null;
          sync();
          return;
        } else {
          turnRef.current = 1 - offender;
          const cue = ballsRef.current[0];
          cue.active = true;
          cue.vx = cue.vy = 0;
          phaseRef.current = "placing";
          setStatus(
            `FOUL ${foulsRef.current[offender]}/3: ${reason} — ${turnRef.current === 0 ? "手球を好きな位置に置ける" : "AIKAが手球を置く"}`,
          );
        }
      } else {
        const sh = turnRef.current;
        if (objectPots > 0) runRef.current++;
        else runRef.current = 0;
        const onlyNine = !ballsRef.current.some(
          (b) => b.active && b.id > 0 && b.id !== 9,
        );
        const soloLine = s.isBreak
          ? VOICE.aoi.break
          : objectPots === 0
            ? VOICE.aoi.miss
            : onlyNine
              ? VOICE.aoi.nineLeft
              : objectPots > 1
                ? VOICE.aoi.multi
                : runRef.current >= 3
                  ? VOICE.aoi.run
                  : s.power
                    ? VOICE.aoi.power
                    : VOICE.aoi.pot;
        // Two more that are worth their own line even on a legal shot: a
        // ball that reached the mouth and came back out, and a shot hit at
        // very nearly full power for no reason (a break is supposed to be).
        const own = modeRef.current === "solo" || sh === 0;
        const situation =
          !own || objectPots > 0
            ? null
            : s.rattled
              ? [VOICE.aoi.jaw, VOICE.aika.jaw]
              : !s.isBreak && !s.power && s.speed >= MAX_SHOT * 0.93
                ? [VOICE.aoi.mash, VOICE.aika.mash]
                : null;
        say(
          situation
            ? situation[modeRef.current === "solo" ? 0 : 1]
            : modeRef.current === "solo"
              ? soloLine
              : objectPots > 0
                ? sh === 0
                  ? VOICE.aika.playerPot
                  : VOICE.aika.cpuPot
                : sh === 0
                  ? VOICE.aika.playerMiss
                  : VOICE.aika.cpuMiss,
        );
        foulsRef.current[turnRef.current] = 0;
        chargesRef.current[turnRef.current] = Math.min(
          100,
          chargesRef.current[turnRef.current] +
            20 +
            objectPots * 28 +
            Math.min(25, s.railObjects.size * 5),
        );
        if (objectPots > 0) {
          phaseRef.current = "aim";
          setStatus(
            modeRef.current === "solo"
              ? "LEGAL POCKET — 続けて狙える"
              : turnRef.current === 0
                ? "LEGAL POCKET — 続けて狙える"
                : "LEGAL POCKET — AIKAが続けて狙う",
          );
        } else if (modeRef.current === "solo") {
          phaseRef.current = "aim";
          setStatus(`SOLO — TARGET ${lowest()}`);
        } else {
          turnRef.current = 1 - turnRef.current;
          phaseRef.current = "aim";
          setStatus(
            turnRef.current === 0
              ? `YOUR TURN — TARGET ${lowest()}`
              : "AIKA TURN — AIKAの番",
          );
        }
      }
      breakRef.current = false;
      powerArmedRef.current = false;
      shotRef.current = null;
      sync();
      if (modeRef.current === "cpu" && turnRef.current === 1) scheduleCpu();
    };
    // Capture threshold is the precomputed p.cap (see CORNER_CAP/SIDE_CAP
    // above), not a flat fudge number: side is the literal mouth-radius-minus-
    // ball-radius clearance, corner gets CORNER_JAW_ASSIST's extra give to
    // stand in for the real jaw's deflection that this circle-only model has
    // no other way to represent. The previous flat `-5` was arbitrary and
    // didn't scale with the pocket-size fix above - it landed on the corner's
    // literal-clearance threshold (14) by coincidence, which is exactly why
    // corner shots still felt too tight even after the mouth itself was
    // resized to the correct real-world ratio.
    // MIN_V used to zero vx/vy independently, which doesn't preserve
    // direction: repeated rail bounces on one axis (each one scaling that
    // axis by WALL_REST) drain it much faster than the other axis, which only
    // decays via the gentler per-frame FRICTION. Once the faster-draining axis
    // dipped under MIN_V first, it snapped to exactly 0 while the other axis
    // was still very much alive, so a ball rolling on a diagonal after a few
    // bounces would suddenly veer to dead-straight for its last stretch.
    // Checking the combined speed instead means both axes stop together.
    const tick = (now: number) => {
      const frame = Math.min(0.034, (now - last) / 1000);
      last = now;
      if (pausedRef.current || document.hidden) {
        raf = requestAnimationFrame(tick);
        return;
      }
      let moving = false;
      if (phaseRef.current === "rolling") {
        const sub = shotRef.current?.power ? 12 : 4,
          dt = (frame * 60) / sub;
        for (let step = 0; step < sub; step++) {
          const active = ballsRef.current.filter((b) => b.active);
          for (const b of active) {
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.vx *= Math.pow(FRICTION, dt);
            b.vy *= Math.pow(FRICTION, dt);
            if (Math.hypot(b.vx, b.vy) < MIN_V) {
              b.vx = 0;
              b.vy = 0;
            }
            if (b.vx || b.vy) moving = true;
            let shield = false;
            if (b.id === 0 && shotRef.current?.power) {
              for (const p of pockets) {
                const dx = b.x - p.x,
                  dy = b.y - p.y,
                  d = Math.hypot(dx, dy);
                if (d < p.r + 7) {
                  const nx = dx / (d || 1),
                    ny = dy / (d || 1);
                  b.x = p.x + nx * (p.r + 8);
                  b.y = p.y + ny * (p.r + 8);
                  const dot = b.vx * nx + b.vy * ny;
                  b.vx = (b.vx - 2 * dot * nx) * 0.82;
                  b.vy = (b.vy - 2 * dot * ny) * 0.82;
                  b.flash = 1;
                  shield = true;
                  audioEngineRef.current!.shield();
                  spawnBurst(sparksRef.current, b.x, b.y, {
                    count: 14,
                    speed: 120,
                    life: 0.4,
                    colors: ["#ff3bce", "#37e7ff", "#fff"],
                  });
                }
              }
            }
            if (!shield) {
              for (const p of pockets) {
                const dx = b.x - p.x,
                  dy = b.y - p.y,
                  d = Math.hypot(dx, dy);
                if (d < p.cap) {
                  const speed = Math.hypot(b.vx, b.vy);
                  let accepted = true;
                  if (speed > 3) {
                    const velAngle = Math.atan2(b.vy, b.vx),
                      acceptAngle = Math.atan2(p.accept.y, p.accept.x);
                    let diff = Math.abs(velAngle - acceptAngle);
                    if (diff > Math.PI) diff = 2 * Math.PI - diff;
                    accepted = diff <= p.halfAngle;
                  }
                  if (accepted) {
                    b.active = false;
                    b.vx = b.vy = 0;
                    if (b.id === 0) shotRef.current!.scratch = true;
                    else shotRef.current!.pocketed.push(b.id);
                    // A ball dropping is not the same as a good shot. If the
                    // cue has already touched something other than the target
                    // ball, this pot is part of a foul and the end-of-shot
                    // line is about to say so - congratulating it here had
                    // AIKA (and AOI) praising shots they were a second away
                    // from calling. Stage mode has no such rule, so it always
                    // speaks. Scratches belong to AOI, so only solo says it.
                    const shot = shotRef.current!;
                    // Once the cue ball is down the shot is dead, so anything
                    // that drops after it is not worth a reaction either -
                    // they were still being cheered one by one.
                    const onTarget =
                      modeRef.current === "stage" ||
                      (shot.first === shot.target && !shot.scratch);
                    const potLine =
                      b.id === 0
                        ? modeRef.current === "stage"
                          ? VOICE.luna.scratchCall
                          : modeRef.current === "cpu"
                            ? turnRef.current === 0
                              ? VOICE.aika.scratchCallPlayer
                              : VOICE.aika.scratchCallSelf
                            : VOICE.aoi.scratchCall
                        : !onTarget
                          ? null
                          : modeRef.current === "stage"
                            ? VOICE.luna.potCall
                            : modeRef.current === "cpu"
                              ? turnRef.current === 0
                                ? VOICE.aika.potCallPlayer
                                : VOICE.aika.potCallSelf
                              : b.id === 9
                                ? VOICE.aoi.nineCall
                                : VOICE.aoi.potCall;
                    if (potLine) say(potLine);
                    audioEngineRef.current!.pocket(b.id);
                    spawnBurst(sparksRef.current, p.x, p.y, {
                      count: 18,
                      speed: 90,
                      life: 0.6,
                      colors: [COLORS[b.id], "#1ddcff"],
                    });
                  } else {
                    // Reached the mouth and got spat back out. Worth a line
                    // at the end of the shot - it is the one miss that was
                    // not a miss.
                    if (shotRef.current && b.id !== 0)
                      shotRef.current.rattled = true;
                    const nx = dx / (d || 1),
                      ny = dy / (d || 1);
                    b.x = p.x + nx * (p.r + 6);
                    b.y = p.y + ny * (p.r + 6);
                    const dot = b.vx * nx + b.vy * ny;
                    b.vx = (b.vx - 2 * dot * nx) * 0.7;
                    b.vy = (b.vy - 2 * dot * ny) * 0.7;
                    audioEngineRef.current!.rail(speed);
                    spawnBurst(sparksRef.current, b.x, b.y, {
                      count: 6,
                      speed: 60,
                      life: 0.3,
                      colors: [COLORS[b.id], "#37e7ff"],
                    });
                  }
                  break;
                }
              }
            }
            if (!b.active) continue;
            let railed = false;
            if (b.x - b.r < TX) {
              b.x = TX + b.r;
              b.vx = Math.abs(b.vx) * WALL_REST;
              railed = true;
            }
            if (b.x + b.r > TR) {
              b.x = TR - b.r;
              b.vx = -Math.abs(b.vx) * WALL_REST;
              railed = true;
            }
            if (b.y - b.r < TY) {
              b.y = TY + b.r;
              b.vy = Math.abs(b.vy) * WALL_REST;
              railed = true;
            }
            if (b.y + b.r > TB) {
              b.y = TB - b.r;
              b.vy = -Math.abs(b.vy) * WALL_REST;
              railed = true;
            }
            if (railed) {
              const impact = Math.hypot(b.vx, b.vy);
              audioEngineRef.current!.rail(impact);
              if (impact > 3)
                spawnBurst(sparksRef.current, b.x, b.y, {
                  count: 4,
                  speed: 40,
                  life: 0.25,
                  colors: [COLORS[b.id]],
                  size: 1.3,
                });
              if (shotRef.current?.first !== null) {
                shotRef.current!.railAfter = true;
                if (b.id > 0) shotRef.current!.railObjects.add(b.id);
              }
            }
            for (const wall of wallsRef.current) {
              const wx = wall.x2 - wall.x1,
                wy = wall.y2 - wall.y1,
                wl2 = wx * wx + wy * wy;
              const wt = Math.max(
                0,
                Math.min(
                  1,
                  ((b.x - wall.x1) * wx + (b.y - wall.y1) * wy) / wl2,
                ),
              );
              const cx = wall.x1 + wt * wx,
                cy = wall.y1 + wt * wy;
              const dx2 = b.x - cx,
                dy2 = b.y - cy,
                d2 = Math.hypot(dx2, dy2);
              if (d2 < b.r && d2 > 0.01) {
                const nx2 = dx2 / d2,
                  ny2 = dy2 / d2;
                b.x = cx + nx2 * b.r;
                b.y = cy + ny2 * b.r;
                const dot2 = b.vx * nx2 + b.vy * ny2;
                if (dot2 < 0) {
                  b.vx -= 2 * dot2 * nx2 * WALL_REST;
                  b.vy -= 2 * dot2 * ny2 * WALL_REST;
                  const impact2 = Math.hypot(b.vx, b.vy);
                  audioEngineRef.current!.rail(impact2);
                  spawnBurst(sparksRef.current, cx, cy, {
                    count: 5,
                    speed: 50,
                    life: 0.28,
                    colors: ["#ff3bce", COLORS[b.id]],
                    size: 1.4,
                  });
                }
              }
            }
            for (const warp of warpsRef.current) {
              if (Math.hypot(b.x - warp.x, b.y - warp.y) < warp.r) {
                const dest = warpsRef.current[warp.pair];
                const speed = Math.hypot(b.vx, b.vy) || 1,
                  nx3 = b.vx / speed,
                  ny3 = b.vy / speed;
                b.x = dest.x + nx3 * (dest.r + b.r + 2);
                b.y = dest.y + ny3 * (dest.r + b.r + 2);
                audioEngineRef.current!.shield();
                spawnBurst(sparksRef.current, warp.x, warp.y, {
                  count: 16,
                  speed: 100,
                  life: 0.5,
                  colors: ["#ff3bce", "#37e7ff", "#fff"],
                });
                spawnBurst(sparksRef.current, dest.x, dest.y, {
                  count: 16,
                  speed: 100,
                  life: 0.5,
                  colors: ["#ff3bce", "#37e7ff", "#fff"],
                });
                break;
              }
            }
          }
          for (let i = 0; i < active.length; i++)
            for (let j = i + 1; j < active.length; j++) {
              const a = active[i],
                b = active[j];
              if (!a.active || !b.active) continue;
              const dx = b.x - a.x,
                dy = b.y - a.y,
                d = Math.hypot(dx, dy),
                md = a.r + b.r;
              if (d < md && d > 0.01) {
                const nx = dx / d,
                  ny = dy / d,
                  over = (md - d) / 2;
                a.x -= nx * over;
                a.y -= ny * over;
                b.x += nx * over;
                b.y += ny * over;
                const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
                if (rel < 0) {
                  const imp = rel * BALL_REST;
                  a.vx += imp * nx;
                  a.vy += imp * ny;
                  b.vx -= imp * nx;
                  b.vy -= imp * ny;
                  a.flash = b.flash = 1;
                  if (shotRef.current?.first === null) {
                    if (a.id === 0 && b.id > 0) shotRef.current.first = b.id;
                    if (b.id === 0 && a.id > 0) shotRef.current.first = a.id;
                  }
                  const impact = Math.abs(rel);
                  audioEngineRef.current!.collision(impact);
                  if (impact > 2)
                    spawnBurst(
                      sparksRef.current,
                      (a.x + b.x) / 2,
                      (a.y + b.y) / 2,
                      {
                        count: Math.min(10, 3 + impact * 0.2),
                        speed: 60,
                        life: 0.3,
                        colors: [COLORS[a.id], COLORS[b.id]],
                        size: 1.5,
                      },
                    );
                }
              }
            }
        }
        moving = ballsRef.current.some(
          (b) => b.active && (b.vx !== 0 || b.vy !== 0),
        );
        if (!moving) endShot();
      }
      const sparks = sparksRef.current;
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx * frame;
        s.y += s.vy * frame;
        s.vx *= 0.9;
        s.vy *= 0.9;
        s.life -= frame;
        if (s.life <= 0) sparks.splice(i, 1);
      }
      if (flashRef.current) {
        flashRef.current.life -= frame;
        if (flashRef.current.life <= 0) flashRef.current = null;
      }
      draw(now);
      raf = requestAnimationFrame(tick);
    };
    if (
      modeRef.current === "cpu" &&
      turnRef.current === 1 &&
      phaseRef.current !== "rolling" &&
      phaseRef.current !== "gameover"
    )
      scheduleCpu();
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (cpuTimer) clearTimeout(cpuTimer);
      if (msgTimer.current) clearTimeout(msgTimer.current);
    };
  }, [geo, pockets, STAGES]);

  const pos = (e: React.PointerEvent): Point => {
    const q = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - q.left) * W) / q.width,
      y: ((e.clientY - q.top) * H) / q.height,
    };
  };
  // Aim used to be read straight off the pointer: the shot went exactly
  // where you dragged from. At a normal pull-back of ~130px that put one
  // screen pixel of mouse movement at about half a degree, and the stages
  // that are worth aiming at have potting windows around a degree wide - so
  // a single pixel could step across most of the window and there was no way
  // to sit inside it. The pointer now steers the line instead of setting it:
  // each move applies a fraction of the angle it asks for, which multiplies
  // the usable resolution without changing how the drag feels. Power still
  // comes from the raw drag length, so a soft shot can be aimed as finely as
  // a hard one - which was the other half of the problem.
  const AIM_GAIN = 0.34;
  const steerAim = (pt: Point) => {
    const cue = ballsRef.current[0];
    const raw = Math.atan2(cue.y - pt.y, cue.x - pt.x),
      cur = aimRef.current;
    if (cur === null) aimRef.current = raw;
    else {
      let d = raw - cur;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      aimRef.current = cur + d * AIM_GAIN;
    }
    dragRef.current = pt;
    setShotPower(
      Math.round(
        (Math.min(Math.hypot(cue.x - pt.x, cue.y - pt.y) * 0.18, MAX_SHOT) /
          MAX_SHOT) *
          100,
      ),
    );
  };
  const cancelAim = () => {
    dragRef.current = null;
    aimRef.current = null;
    pressRef.current = null;
    keyboardRef.current = false;
    setKeyboardAim(false);
    setShotPower(0);
  };
  const fireShot = (ang: number, power: number) => {
    if (
      pausedRef.current ||
      phaseRef.current !== "aim" ||
      (modeRef.current === "cpu" && turnRef.current === 1)
    )
      return;
    cancelAim();
    if (power < 0.5) return;
    const cue = ballsRef.current[0],
      boost = powerArmedRef.current ? 3 : 1;
    cue.vx = Math.cos(ang) * power * boost;
    cue.vy = Math.sin(ang) * power * boost;
    shotRef.current = newShot(
      lowest(),
      breakRef.current,
      powerArmedRef.current,
      power * boost,
    );
    if (powerArmedRef.current) chargesRef.current[turnRef.current] = 0;
    shotsRef.current++;
    phaseRef.current = "rolling";
    setStatus(
      powerArmedRef.current
        ? "POWER SHOT — 初速3倍、ポケットを弾く"
        : "BALLS IN MOTION — 停止待ち",
    );
    audioEngineRef.current!.cueStrike(power * boost);
    if (powerArmedRef.current) triggerFlash("#ff3bce", 0.25);
    sync();
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || pausedRef.current) return;
    audioEngineRef.current!.unlock();
    if (modeRef.current === "cpu" && turnRef.current === 1) return;
    const p = pos(e);
    if (phaseRef.current === "placing") {
      if (safeSpot(p.x, p.y)) {
        phaseRef.current = "aim";
        setStatus("BALL PLACED — 最小番号から狙う");
        sync();
      } else setStatus("BALL IN HAND — 空いている場所に置く");
      return;
    }
    if (phaseRef.current !== "aim") return;
    const cue = ballsRef.current[0];
    // Any touch on the felt counts as "seen", not just a successful grab -
    // a miss still means the player is reaching for the cue.
    setPromptSeen(true);
    if (Math.hypot(p.x - cue.x, p.y - cue.y) < 100) {
      cancelAim();
      pressRef.current = p;
      dragRef.current = p;
      e.currentTarget.focus({ preventScroll: true });
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };
  const up = (e: React.PointerEvent) => {
    if (!dragRef.current || !pressRef.current) return;
    const p = pos(e),
      cue = ballsRef.current[0];
    if (Math.hypot(p.x - pressRef.current.x, p.y - pressRef.current.y) < 4) {
      cancelAim();
      return;
    }
    const dx = cue.x - p.x,
      dy = cue.y - p.y,
      power = Math.min(Math.hypot(dx, dy) * 0.18, MAX_SHOT);
    fireShot(aimRef.current ?? Math.atan2(dy, dx), power);
  };
  const handleKey = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelAim();
      return;
    }
    if (
      pausedRef.current ||
      phaseRef.current !== "aim" ||
      (modeRef.current === "cpu" && turnRef.current === 1)
    )
      return;
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        " ",
        "Enter",
      ].includes(e.key)
    )
      return;
    e.preventDefault();
    const cue = ballsRef.current[0];
    if (!keyboardRef.current) {
      const next = ballsRef.current.find((b) => b.id === lowest());
      keyboardAngleRef.current = next
        ? Math.atan2(next.y - cue.y, next.x - cue.x)
        : 0;
      keyboardRef.current = true;
      setKeyboardAim(true);
    }
    if (e.key === "ArrowLeft")
      keyboardAngleRef.current -= ((e.shiftKey ? 0.1 : 0.5) * Math.PI) / 180;
    if (e.key === "ArrowRight")
      keyboardAngleRef.current += ((e.shiftKey ? 0.1 : 0.5) * Math.PI) / 180;
    if (e.key === "ArrowUp")
      keyboardPowerRef.current = Math.min(
        MAX_SHOT,
        keyboardPowerRef.current + 1,
      );
    if (e.key === "ArrowDown")
      keyboardPowerRef.current = Math.max(1, keyboardPowerRef.current - 1);
    if (e.key === " " || e.key === "Enter") {
      fireShot(keyboardAngleRef.current, keyboardPowerRef.current);
      return;
    }
    setShotPower(Math.round((keyboardPowerRef.current / MAX_SHOT) * 100));
  };
  const armPower = () => {
    if (
      phaseRef.current !== "aim" ||
      chargesRef.current[turnRef.current] < 100 ||
      (modeRef.current === "cpu" && turnRef.current === 1)
    )
      return;
    powerArmedRef.current = !powerArmedRef.current;
    setPowerArmed(powerArmedRef.current);
    if (powerArmedRef.current) audioEngineRef.current!.armPower();
    else audioEngineRef.current!.uiClick();
    setStatus(
      powerArmedRef.current
        ? "POWER SHOT ARMED — 次の一打が3倍"
        : "POWER SHOT — 解除",
    );
  };
  const target = ballsRef.current
    .filter((b) => b.id > 0 && b.active)
    .reduce((m, b) => Math.min(m, b.id), 9);
  void revision;
  // Each mode has a character on the backdrop; this is that character's
  // side of the panel. Luna carries the stage's authored hint - a warp
  // puzzle only reads as a puzzle if the rule behind it is stated once.
  // Each mode has a character on the backdrop; this is that character's
  // side of the panel. Luna carries the stage's authored hint - a warp
  // puzzle only reads as a puzzle if the rule behind it is stated once.
  const crew =
    mode === "cpu"
      ? {
          role: "CPU NAME",
          name: "AIKA",
          line:
            winner === 1
              ? "私の勝ち。まあ、こんなものね。"
              : winner === 0
                ? "……今のはたまたまでしょ。もう一回やる?"
                : phase === "placing"
                  ? "ファウル。好きな所に置けば? 早くしてよ。"
                  : turn === 1
                    ? cpuForm === "off"
                      ? "……今のは無し。次は本気出すから。"
                      : cpuForm === "sharp"
                        ? "ほら、こういうのが普通なの。"
                        : "私の番。見てなさいよ。"
                    : `${target}番よ。狙いを決めたら、かかってきなさい。`,
        }
      : mode === "stage"
        ? {
            role: "SUPPORT NAME",
            name: "LUNA",
            line:
              phase === "gameover"
                ? "解けたわね。次はもう一手ぶん複雑になるわ。"
                : (shotCount > 0 ? "外れたわ。線を引き直しましょう——" : "") +
                  STAGE_DEFS[stageIndex].hint,
          }
        : {
            role: "OPERATOR NAME",
            name: "AOI",
            line:
              phase === "gameover"
                ? "お疲れさま。よく走ったね。"
                : phase === "placing"
                  ? "ファウルだね。手球は好きなところに置いていいからね。"
                  : shotCount === 0
                    ? "まずはブレイクからいこうね。"
                    : target === 9
                      ? "あと9番だけだね。落ち着いていこうね。"
                      : `最小番号は${target}番だね。そこから狙っていこうね。`,
          };
  return (
    <div className="nbRoot">
      <div data-mode={mode} className="breakApp">
        <div className={`operatorBackdrop mode-${mode}`} aria-hidden="true" />
        <div className="sceneShade" aria-hidden="true" />
        <header className="breakTop mx-auto flex max-w-[1380px] items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="brandmark" aria-label="NEON BREAK">
              <span className="tubeN">N</span>
              <span className="tubeB">B</span>
            </div>
            <div>
              <h1 className="title">NEON BREAK</h1>
              <p className="kicker">NINE BALL PROTOCOL // SOLO & CPU</p>
            </div>
          </div>
          <div className="modeSwitch" aria-label="ゲームモード">
            <button
              className={mode === "solo" ? "selected" : ""}
              onClick={() =>
                confirmIfProgress(
                  "現在の進行状況を破棄してSOLOに切り替えますか?",
                  () => {
                    audioEngineRef.current!.uiClick();
                    reset("solo");
                  },
                )
              }
            >
              SOLO
            </button>
            <button
              className={mode === "cpu" ? "selected" : ""}
              onClick={() =>
                confirmIfProgress(
                  "現在の進行状況を破棄してVS CPUに切り替えますか?",
                  () => {
                    audioEngineRef.current!.uiClick();
                    reset("cpu");
                  },
                )
              }
            >
              VS CPU
            </button>
            <button
              className={mode === "stage" ? "selected" : ""}
              onClick={() =>
                confirmIfProgress(
                  "現在の進行状況を破棄してSTAGEに切り替えますか?",
                  () => selectStage(stageIndexRef.current),
                )
              }
            >
              STAGE
            </button>
          </div>
          <div className="turnBanner">
            {mode === "stage"
              ? `STAGE ${stageIndex + 1}/${STAGE_COUNT}`
              : mode === "solo"
                ? "SOLO RUN"
                : turn === 0
                  ? "YOUR TURN"
                  : "CPU TURN"}
            <b>
              {phase === "placing"
                ? "BALL IN HAND"
                : phase === "gameover"
                  ? "RESULT"
                  : breakRef.current
                    ? "BREAK"
                    : "ON TABLE"}
            </b>
          </div>
          <div className="flex gap-2">
            <button
              className="iconbtn"
              onClick={() => {
                const next = !muted;
                mutedRef.current = next;
                audioEngineRef.current!.setMuted(next);
                if (!next) audioEngineRef.current!.uiClick();
                setMuted(next);
              }}
              aria-label="サウンド切替"
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            {mode === "stage" && phase !== "gameover" && (
              <button className="resetbtn" onClick={retryStage}>
                <RotateCcw size={15} /> RETRY
              </button>
            )}
            <button
              className="resetbtn"
              onClick={() =>
                confirmIfProgress(
                  "現在の進行状況を破棄して新しいラックにしますか?",
                  () => {
                    audioEngineRef.current!.uiClick();
                    reset();
                  },
                )
              }
            >
              <RotateCcw size={15} /> NEW RACK
            </button>
          </div>
        </header>
        <section className="breakLayout mt-4 grid gap-4">
          <aside className="matchPanel">
            {mode === "stage" && (
              <div className="stageSelect">
                {Array.from({ length: STAGE_COUNT }, (_, i) => i).map((i) => (
                  <button
                    key={i}
                    aria-label={`ステージ ${i + 1}${progress.stages[i + 1] ? " クリア済み" : ""}`}
                    className={`${i === stageIndex ? "selected" : ""} ${progress.stages[i + 1] ? "completed" : ""}`}
                    onClick={() =>
                      confirmIfProgress(
                        `現在の進行状況を破棄してSTAGE ${i + 1}に切り替えますか?`,
                        () => selectStage(i),
                      )
                    }
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
            {/* Power shot moved up ahead of the score/target readouts, and its
        explanation card (powerNote) moved up with it - on mobile the table
        (grid-row:1) sits above this whole panel (grid-row:2), so anything
        low in this list needs a real scroll to reach, and splitting a
        control from what it does read as broken rather than reordered.
        NEXT OBJECT/rackLine (what to aim at right now) comes right after,
        then the run/score card and NEXT STAGE sit just above the rules -
        useful context, but nothing you need mid-shot. */}
            {/* Stage mode never charges this - endStageShot() doesn't touch
        chargesRef the way the 9-ball rule engine's endShot() does, so the
        gauge would just sit at 0% forever and the button stay permanently
        disabled. Showing a control that can never activate is clutter, not
        a feature, so it's solo/cpu only - same pattern as rackLine below. */}
            {mode !== "stage" && (
              <>
                <div className="meterLabel">
                  <span>POWER SHOT</span>
                  <b>{charges[turn]}%</b>
                </div>
                <div className="powerMeter">
                  <i style={{ width: `${charges[turn]}%` }} />
                </div>
                <button
                  className={powerArmed ? "powerBtn armed" : "powerBtn"}
                  disabled={
                    charges[turn] < 100 ||
                    phase !== "aim" ||
                    (mode === "cpu" && turn === 1)
                  }
                  onClick={armPower}
                >
                  <Shield size={17} />
                  {powerArmed ? "ARMED // ×3" : "ACTIVATE POWER SHOT"}
                </button>
                <div className="powerNote">
                  <Zap size={16} />
                  <p>
                    <b>NEON OVERCHARGE</b>
                    <br />
                    初速3倍。発動中の手球はポケットを反射する。使用後、ゲージはゼロに戻る。
                  </p>
                </div>
              </>
            )}
            {/* Who is on comms for this mode - the same three characters the
        backdrop art swaps between, given a voice in the panel instead of
        only being wallpaper. Sits under the power gauge rather than above
        it so the gauge keeps the top slot on mobile; stage mode hides the
        gauge entirely, so Luna's hint lands at the top there anyway. */}
            {/* Name only. What she is saying now lives on the bar over the
              table at every width - it used to be here on desktop and there
              on phones, which meant the one line that changes shot to shot
              was somewhere different depending on the screen. */}
            {/* The same two controls as the toolbar's. Above 700px this copy is
              the visible one and the toolbar's is hidden: the bar over the
              table is state (whose shot, what she is saying) and every
              control lives in this column, next to ACTIVATE POWER SHOT.
              Phones keep them in the bar, where this column is below the
              fold. */}
            <div className="panelButtons">
              <button
                onClick={() => {
                  cancelAim();
                  setHelpOpen(true);
                }}
                aria-label="操作説明"
              >
                ? 操作
              </button>
              <button
                onClick={() => {
                  cancelAim();
                  setPaused((p) => !p);
                }}
                disabled={phase === "gameover"}
                aria-label={paused ? "ゲーム再開" : "一時停止"}
              >
                {paused ? "▶ 再開" : "Ⅱ 停止"}
              </button>
            </div>
            <div className={`crewCard crew-${mode}`}>
              <span>{crew.role}</span>
              <strong>{crew.name}</strong>
            </div>
            <div className="targetReadout">
              <span>NEXT OBJECT</span>
              <strong>{phase === "gameover" ? "—" : target}</strong>
            </div>
            {mode !== "stage" && (
              <div className="rackLine">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((id) => (
                  <i
                    key={id}
                    className={
                      ballsRef.current.find((b) => b.id === id)?.active
                        ? ""
                        : "down"
                    }
                    style={{ background: COLORS[id] }}
                  >
                    {id}
                  </i>
                ))}
              </div>
            )}
            {mode === "cpu" ? (
              <div className="playerRow">
                <div className={turn === 0 ? "player active" : "player"}>
                  <span>YOU</span>
                  <b>
                    {winner === 0 ? "WIN" : turn === 0 ? "TURN" : "STANDBY"} · F
                    {fouls[0]}
                  </b>
                </div>
                <div
                  className={turn === 1 ? "player active cpu" : "player cpu"}
                >
                  <span>CPU</span>
                  <b>
                    {winner === 1 ? "WIN" : turn === 1 ? "THINKING" : "STANDBY"}{" "}
                    · F{fouls[1]}
                  </b>
                </div>
              </div>
            ) : (
              <div className="soloCard">
                <span>
                  {mode === "stage" ? `STAGE ${stageIndex + 1}` : "SOLO RUN"}
                </span>
                <strong>{shotCount}</strong>
                <b>{mode === "stage" ? "ATTEMPTS" : "SHOTS"}</b>
              </div>
            )}
            <div className="bestReadout">
              {mode === "stage" ? (
                <>
                  CLEAR{" "}
                  <b>
                    {Object.keys(progress.stages).length}/{STAGE_COUNT}
                  </b>{" "}
                  · BEST <b>{progress.stages[stageIndex + 1] ?? "—"}</b> 打
                </>
              ) : mode === "solo" ? (
                <>
                  PERSONAL BEST <b>{progress.soloBest ?? "—"}</b> SHOTS
                </>
              ) : (
                <>
                  SESSION{" "}
                  <b>
                    {record[0]} — {record[1]}
                  </b>
                </>
              )}
            </div>
            <div className="rules">
              <b>
                {mode === "stage"
                  ? "STAGE RULES"
                  : mode === "solo"
                    ? "SOLO RULES"
                    : "VS CPU RULES"}
              </b>
              <p>
                {mode === "stage"
                  ? "一打勝負。ピンク色の壁を避け、ワームホールを使って9番をポケットに沈めればクリア、外したら初期配置からやり直し。"
                  : mode === "solo"
                    ? "ファウル後は手球を置き直し、ショット数を抑えて合法的に9番を落とす。"
                    : "最小番号へ先に当て、合法的に9番を落とした側の勝利。3連続ファウルは敗北。"}
              </p>
            </div>
          </aside>
          <div className="tableShell">
            <div className="playToolbar">
              <span>
                {mode === "stage"
                  ? "STAGE " + (stageIndex + 1) + " / ONE SHOT"
                  : "TARGET " +
                    target +
                    " / " +
                    (mode === "cpu" && turn === 1 ? "AIKA" : "YOU")}
              </span>
              {/* Her line rides in this bar rather than in one of its own: the
                table is sized by what is left after the chrome, so a second
                row above it costs table. Phones keep the separate HUD, which
                also carries the power button they cannot reach otherwise. */}
              <p className="toolbarLine">
                <b>{crew.name}</b>
                <span>{crewMsg ?? crew.line}</span>
              </p>
              <div className="toolbarButtons">
                <button
                  onClick={() => {
                    cancelAim();
                    setHelpOpen(true);
                  }}
                  aria-label="操作説明"
                >
                  ? 操作
                </button>
                <button
                  onClick={() => {
                    cancelAim();
                    setPaused((p) => !p);
                  }}
                  disabled={phase === "gameover"}
                  aria-label={paused ? "ゲーム再開" : "一時停止"}
                >
                  {paused ? "▶ 再開" : "Ⅱ 停止"}
                </button>
              </div>
            </div>
            {/* Turn banner is desktop-only (hidden under 700px, see .turnBanner in
        globals.css) and the statusbar's own text runs 7px on phones - easy
        to miss exactly the two things that matter most: is it my shot right
        now, and is the CPU still doing something. This sits on the table
        itself, big enough and animated enough to notice at a glance on any
        screen size, independent of that banner. */}
            {/* "YOUR SHOT" only makes sense once there's someone else's shot to
        contrast it with - in solo/stage it's just "SHOOT". Same for the CPU
        side: it's not pausing to deliberate, it's actively aiming/rolling
        for the whole turn, so PLAYING reads truer than THINKING. */}
            {/* The callouts are pinned to the middle of the felt, so they have to
              live in a box that is exactly the canvas - not the shell, which
              also carries the toolbar, the phone HUD and the shot strip. */}
            <div className="tableStage">
              {mode === "cpu" && turn === 1 && phase !== "gameover" && (
                <div className="turnCallout cpu">
                  <Loader2 size={13} className="spin" /> CPU PLAYING…
                </div>
              )}
              {phase === "aim" &&
                !(mode === "cpu" && turn === 1) &&
                !promptSeen && (
                  <div className="turnCallout ready">
                    <Crosshair size={13} />{" "}
                    {mode === "cpu" ? "YOUR SHOT" : "SHOOT"}
                  </div>
                )}
              {/* Clearing a stage used to be a status-bar string plus a button
        buried under the score card - the one moment the mode has to
        celebrate, delivered as quietly as a label change. This lands on
        the table itself, where the player is already looking. */}
              {/* A finished match used to end as a status-bar string, which is a
        strange way to close the one thing the mode is for. Same popup the
        stages use, with the session tally and whatever the character said
        last, so the rematch button has a scoreboard behind it. */}
              {mode !== "stage" && phase === "gameover" && (
                <div className="clearPop">
                  {/* The operator normally sits behind the felt, blurred and
                    dimmed so the balls stay readable. On the result screen
                    there is nothing left to read, so she steps in front of
                    the table instead - sharp and undimmed, with the box
                    over her. */}
                  <div className="resultArt" aria-hidden />
                  <div className="clearBox">
                    <span className="clearKicker">
                      {mode === "solo"
                        ? "SOLO RUN COMPLETE"
                        : winner === 0
                          ? "YOU WIN"
                          : "AIKA WINS"}
                    </span>
                    <strong>
                      {shotCount}
                      <i>SHOTS</i>
                    </strong>
                    {mode === "cpu" && (
                      <p className="resultRecord">
                        SESSION <b>{record[0]}</b> — <b>{record[1]}</b>
                      </p>
                    )}
                    <p className="resultQuote">{crewMsg ?? crew.line}</p>
                    {/* The emphasised button belongs to the thing you most
                      likely came here to do, which after a match is another
                      match. It used to be the mode switch, borrowed from the
                      stages where "NEXT STAGE" really is the main action -
                      so a finished CPU match shouted SOLO at you. */}
                    <div className="clearActions">
                      <button
                        className="clearNext"
                        onClick={() => {
                          audioEngineRef.current!.uiClick();
                          reset();
                        }}
                      >
                        REMATCH
                      </button>
                      <button
                        className="clearReplay"
                        onClick={() => {
                          audioEngineRef.current!.uiClick();
                          reset(mode === "solo" ? "cpu" : "solo");
                        }}
                      >
                        {mode === "solo" ? "VS CPU →" : "SOLO →"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {mode === "stage" && phase === "gameover" && (
                <div className="clearPop">
                  {/* The operator normally sits behind the felt, blurred and
                    dimmed so the balls stay readable. On the result screen
                    there is nothing left to read, so she steps in front of
                    the table instead - sharp and undimmed, with the box
                    over her. */}
                  <div className="resultArt" aria-hidden />
                  <div className="clearBox">
                    <span className="clearKicker">
                      STAGE {stageIndex + 1} CLEAR
                    </span>
                    <strong>
                      {shotCount}
                      <i>打</i>
                    </strong>
                    <p>
                      {shotCount === 1
                        ? "一打成功。文句なし。"
                        : `${shotCount}回目の挑戦でクリア。`}
                    </p>
                    <p className="resultRecord">
                      BEST {progress.stages[stageIndex + 1] ?? shotCount}{" "}
                      ATTEMPTS
                    </p>
                    <div className="clearActions">
                      <button
                        className="clearReplay"
                        onClick={() => selectStage(stageIndex)}
                      >
                        REPLAY
                      </button>
                      {stageIndex < STAGE_COUNT - 1 && (
                        <button
                          className="clearNext"
                          onClick={() => selectStage(stageIndex + 1)}
                        >
                          NEXT STAGE →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {paused && (
                <div className="pauseCover">
                  <span>PAUSED</span>
                  <button onClick={() => setPaused(false)}>ゲームを再開</button>
                </div>
              )}
              <canvas
                ref={canvasRef}
                width={W}
                height={H}
                className="game"
                tabIndex={0}
                aria-label="ビリヤード台。手球を引いて離す。矢印キーで照準と強さ、スペースでショット、Escapeで中止"
                onKeyDown={handleKey}
                onContextMenu={(e) => {
                  e.preventDefault();
                  cancelAim();
                }}
                onPointerDown={down}
                onPointerMove={(e) => {
                  if (dragRef.current) steerAim(pos(e));
                }}
                onPointerUp={up}
                onPointerCancel={cancelAim}
              />
            </div>
            {/* Phones stack the panel under the table, which puts the two
              things you want mid-shot - what she just said, and whether the
              power shot is charged - below the fold. They ride on the table
              instead, over her own art. Hidden above 700px, where the panel
              is visible anyway. */}
            <div className="tableHud">
              <p>
                <b>{crew.name}</b>
                {crewMsg ?? crew.line}
              </p>
              {mode !== "stage" && (
                <button
                  className={powerArmed ? "hudPower armed" : "hudPower"}
                  disabled={
                    charges[turn] < 100 ||
                    phase !== "aim" ||
                    (mode === "cpu" && turn === 1)
                  }
                  onClick={armPower}
                >
                  <Shield size={12} />
                  {powerArmed ? "ARMED ×3" : "POWER"}
                </button>
              )}
              {mode !== "stage" && (
                <i
                  className="hudCharge"
                  style={{ width: `${charges[turn]}%` }}
                />
              )}
            </div>
            <div className="shotStrip">
              {/* Was a separate status bar above the table. It cost a whole row
                for one line of text, so it shares this one: what just
                happened on the left, how to shoot on the right. */}
              <span role="status">{status}</span>
              <span className="shotHint">
                {phase === "placing"
                  ? "空いている場所をクリックして手球を置く"
                  : phase === "rolling"
                    ? "結果を待っています"
                    : keyboardAim
                      ? "← → 照準 · ↑ ↓ 強さ · SPACE ショット"
                      : "手球を引いて離す · 右クリック / ESC 中止"}
              </span>
              <b>{shotPower}%</b>
              <i style={{ width: shotPower + "%" }} />
            </div>
          </div>
        </section>
        <footer className="mx-auto mt-3 flex max-w-[1380px] justify-between text-[9px] tracking-[.2em] text-slate-500">
          <span>
            {mode === "stage"
              ? "LOCAL STAGE CHALLENGE"
              : mode === "solo"
                ? "LOCAL SOLO RUN"
                : "LOCAL VS CPU MATCH"}
          </span>
          <span>DRAG CUE BALL · AIM · RELEASE</span>
        </footer>
        {helpOpen && (
          <div className="confirmOverlay" onClick={() => setHelpOpen(false)}>
            <div
              className="helpBox"
              role="dialog"
              aria-modal="true"
              aria-label="操作とルール"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>HOW TO PLAY</h2>
              <p>
                白い手球を引いて、離すとショット。長く引くほど強くなります。点線の先の円は衝突位置、短い線は的球の進む向き。赤い線は最小番号以外に当たる警告です。
              </p>
              <p>
                台にフォーカスして ← → で角度、↑ ↓ で強さ、SPACE
                でショット。Shift＋左右で微調整。右クリックか Escape
                で構えを解除できます。
              </p>
              <p>
                9ボールは最小番号へ先に当て、的球を入れるか、接触後にどれかの球をクッションへ。合法的に9番を入れると勝利。ファウルは手球の自由配置、CPU戦は3連続ファウルで敗北。ブレイクは1番に当て、的球を入れるか的球4個をクッションへ。
              </p>
              <p>
                パワーショットはゲージ満タンで使用可能。次の一打の初速が3倍になり、その一打だけ手球はポケットを反射します。プッシュアウトなしのカジュアル9ボールです。
              </p>
              <p>
                STAGEは一打で9番を入れるチャレンジ。記録はこのブラウザに保存されます。
              </p>
              <button autoFocus onClick={() => setHelpOpen(false)}>
                プレイに戻る
              </button>
            </div>
          </div>
        )}
        {confirmAction && (
          <div
            className="confirmOverlay"
            onClick={() => setConfirmAction(null)}
          >
            <div className="confirmBox" onClick={(e) => e.stopPropagation()}>
              <p>{confirmAction.message}</p>
              <div className="confirmActions">
                <button
                  className="confirmCancel"
                  onClick={() => setConfirmAction(null)}
                >
                  キャンセル
                </button>
                <button
                  className="confirmOk"
                  onClick={() => {
                    const action = confirmAction.onConfirm;
                    setConfirmAction(null);
                    action();
                  }}
                >
                  切り替える
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Same row AVENUE and PAKU use - the OS share sheet plus the X
          composer - sitting under the game rather than inside a result
          screen, so it is reachable whether or not a rack is finished. */}
      <div className="bitPakuShareRow">
        <ShareButton
          title="MarutiBit「NEON BREAK」"
          text="ネオンの台のナインボール。台につくのは、三人のオペレーター"
          url="https://marutilab.com/bit/neonbreak"
        />
        <XShareButton
          variant="compact"
          text={`MarutiBit「NEON BREAK」
ネオンの台のナインボール。台につくのは、三人のオペレーター`}
          url="https://marutilab.com/bit/neonbreak"
        />
      </div>
    </div>
  );
}
