/** Pure shot decisions, independent of rendering and React. */
export type Difficulty = 'casual' | 'standard' | 'expert';
export const DIFFICULTIES = {
  casual: { label: 'CASUAL', error: 0.042, minPower: 9, maxPower: 30 },
  standard: { label: 'STANDARD', error: 0.016, minPower: 8, maxPower: 34 },
  expert: { label: 'EXPERT', error: 0.004, minPower: 7, maxPower: 38 },
} as const;
type MovingBall = {
  id: number;
  x: number;
  y: number;
  r: number;
  active: boolean;
};
type Bounds = { TX: number; TY: number; TR: number; TB: number };
type Vector = { x: number; y: number };

export function shotVerdict(s: {
  first: number | null;
  target: number;
  pocketed: number[];
  railAfter: boolean;
  railObjects: Set<number>;
  scratch: boolean;
  isBreak: boolean;
}) {
  const reason = s.scratch
    ? 'スクラッチ'
    : s.first !== s.target
      ? `${s.target}番へ先に当てていない`
      : s.isBreak && s.pocketed.length === 0 && s.railObjects.size < 4
        ? 'ブレイク不成立'
        : !s.pocketed.length && !s.railAfter
          ? 'クッションまたはポケットなし'
          : null;
  return {
    foul: reason !== null,
    reason,
    won: reason === null && s.pocketed.includes(9),
    respot: reason !== null && s.pocketed.includes(9),
  };
}

export function pathClear(
  a: Vector,
  b: Vector,
  balls: MovingBall[],
  ignore: number[],
) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    len = dx * dx + dy * dy;
  if (len < 0.001) return false;
  return !balls.some((ball) => {
    if (!ball.active || ignore.includes(ball.id)) return false;
    const t = Math.max(
      0,
      Math.min(1, ((ball.x - a.x) * dx + (ball.y - a.y) * dy) / len),
    );
    return (
      Math.hypot(ball.x - a.x - t * dx, ball.y - a.y - t * dy) < ball.r * 2.08
    );
  });
}

/** First physical contact, including ball radius, for a readable aiming guide. */
export function firstContact(
  cue: MovingBall,
  angle: number,
  balls: MovingBall[],
  bounds: Bounds,
) {
  const nx = Math.cos(angle),
    ny = Math.sin(angle),
    r = cue.r;
  let distance = 1200;
  if (nx > 1e-8) distance = Math.min(distance, (bounds.TR - r - cue.x) / nx);
  if (nx < -1e-8) distance = Math.min(distance, (bounds.TX + r - cue.x) / nx);
  if (ny > 1e-8) distance = Math.min(distance, (bounds.TB - r - cue.y) / ny);
  if (ny < -1e-8) distance = Math.min(distance, (bounds.TY + r - cue.y) / ny);
  let ball: MovingBall | null = null;
  for (const b of balls) {
    if (!b.active || b.id === 0) continue;
    const dx = b.x - cue.x,
      dy = b.y - cue.y,
      along = dx * nx + dy * ny;
    const disc = (r + b.r) ** 2 - (dx * dx + dy * dy - along * along);
    if (disc < 0) continue;
    const t = along - Math.sqrt(disc);
    if (t >= 0 && t < distance) {
      distance = t;
      ball = b;
    }
  }
  return { x: cue.x + nx * distance, y: cue.y + ny * distance, ball, distance };
}

/** Reject impossible back-cuts; choose a ghost-ball line and distance-based speed. */
export function planCpu(
  cue: MovingBall,
  target: MovingBall,
  balls: MovingBall[],
  pockets: Vector[],
  bounds: Bounds,
  difficulty: Difficulty,
  random = Math.random,
) {
  let aim: Vector = target,
    best = Infinity,
    clean = false,
    travel = 0,
    cut = 1;
  for (const p of pockets) {
    const pd = Math.hypot(p.x - target.x, p.y - target.y);
    if (pd < 0.001) continue;
    const nx = (p.x - target.x) / pd,
      ny = (p.y - target.y) / pd;
    const ghost = {
      x: target.x - nx * target.r * 2.03,
      y: target.y - ny * target.r * 2.03,
    };
    const distance = Math.hypot(ghost.x - cue.x, ghost.y - cue.y);
    const alignment =
      ((ghost.x - cue.x) * nx + (ghost.y - cue.y) * ny) / (distance || 1);
    if (
      alignment < 0.28 ||
      ghost.x < bounds.TX + cue.r ||
      ghost.x > bounds.TR - cue.r ||
      ghost.y < bounds.TY + cue.r ||
      ghost.y > bounds.TB - cue.r
    )
      continue;
    if (
      !pathClear(cue, ghost, balls, [0, target.id]) ||
      !pathClear(target, p, balls, [0, target.id])
    )
      continue;
    const cost = distance + pd * 0.6 + (1 - alignment) * 500;
    if (cost < best) {
      best = cost;
      aim = ghost;
      clean = true;
      travel = pd;
      cut = alignment;
    }
  }
  // If snookered, evaluate a single cushion kick instead of deliberately fouling.
  if (!clean && !pathClear(cue, target, balls, [0, target.id])) {
    const r = cue.r;
    const rails = [
      { axis: 'x', v: bounds.TX + r },
      { axis: 'x', v: bounds.TR - r },
      { axis: 'y', v: bounds.TY + r },
      { axis: 'y', v: bounds.TB - r },
    ] as const;
    for (const rail of rails) {
      const mirror = { x: target.x, y: target.y };
      mirror[rail.axis] = 2 * rail.v - target[rail.axis];
      const t =
        (rail.v - cue[rail.axis]) / (mirror[rail.axis] - cue[rail.axis]);
      const hit = {
        x: cue.x + (mirror.x - cue.x) * t,
        y: cue.y + (mirror.y - cue.y) * t,
      };
      if (
        t <= 0 ||
        t >= 1 ||
        hit.x < bounds.TX + r - 0.01 ||
        hit.x > bounds.TR - r + 0.01 ||
        hit.y < bounds.TY + r - 0.01 ||
        hit.y > bounds.TB - r + 0.01
      )
        continue;
      if (pockets.some((p) => Math.hypot(p.x - hit.x, p.y - hit.y) < 40))
        continue;
      if (
        pathClear(cue, hit, balls, [0]) &&
        pathClear(hit, target, balls, [0, target.id])
      ) {
        aim = hit;
        break;
      }
    }
  }
  const settings = DIFFICULTIES[difficulty],
    distance = Math.hypot(aim.x - cue.x, aim.y - cue.y);
  const power = Math.max(
    settings.minPower,
    Math.min(
      settings.maxPower,
      4 + distance * 0.008 + (travel * 0.008) / Math.max(0.3, cut),
    ),
  );
  return {
    angle:
      Math.atan2(aim.y - cue.y, aim.x - cue.x) +
      (random() - 0.5) * settings.error,
    power: clean ? power : 24,
    clean,
  };
}

export type Progress = {
  soloBest: number | null;
  stages: Record<string, number>;
};
export function parseProgress(raw: string | null): Progress {
  try {
    const value = JSON.parse(raw || '{}');
    const valid = (n: unknown): n is number =>
      Number.isInteger(n) && Number(n) > 0 && Number(n) < 100000;
    const stages: Record<string, number> = {};
    for (const [key, n] of Object.entries(value?.stages || {}))
      if (/^\d+$/.test(key) && valid(n)) stages[key] = n;
    return { soloBest: valid(value?.soloBest) ? value.soloBest : null, stages };
  } catch {
    return { soloBest: null, stages: {} };
  }
}
