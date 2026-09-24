// HYPER PROP physics. A pure state machine with no DOM, so node can run it too
// (the prototype tuned these numbers with a bot pressing at fixed rates).
// Units are world pixels (y up, cliff top = 0) and seconds.
// Tuned with a bot flying five pitch styles (hands off, ▲ held, ▲ whenever it sinks,
// ▲ pulsed, and a careful pilot holding the angle of attack) at 6-8 pedal presses a
// second. First playtest said the takeoff was too easy: everything got airborne and
// even "hold ▲ whenever it sinks" cleared at 7 presses. Now the drop off the cliff is
// shorter (less free speed), a stall costs real height, the water no longer carries
// you along, and the pedals give less: a careful pilot needs 7 a second, a sloppy one
// can still get there on 8, hands off is in the lake by ~60m and ▲ held by ~20m.
export const CFG = {
  g: 50,
  edgeX: 170,
  lakeY: -32,
  run: { step: 6, vcap: 40, friction: 10 },
  boardTime: 0.55,
  boardKeep: 0.92,
  prop: { add: 0.16, decay: 0.6, thrust: 17, vmax: 80 },
  // past the stall the lift falls to stallFloor of its peak, drag gains stallDrag and the nose drops at stallDrop rad/s
  aero: { c: 0.075, cla: 5, stall: 0.3, cd0: 0.04, k: 0.08, ge: 18, geGain: 0.1, stallFloor: 0.2, stallDrag: 0.25, stallDrop: 1.6 },
  pitchRate: 1.6, relax: 1.6, trim: 0.05,
  groundRoll: 8, rotateMax: 0.25,
  successDist: 800,
  pxToM: 0.5,
};

// The stages share one hill and one lake. What changes is the run-up, the birds over
// the water and the air. A bird is [metres past the cliff, height above the lake]. The
// plane is 26px tall from its wheel (s.y) to the wingtips and flies between the water
// and about 35px up, so there are three kinds of bird: one skimming the water (5-6)
// only catches a plane that sinks, one at 15 has to be climbed over, and one at 42 can
// only be passed under, skimming the lake. air is [from m, to m, px/s], sinking air
// negative.
// Tuned with bots (careful pilot dodging, sloppy one pulling up only when low):
// stage 1 clears from 6 presses a second, stage 2 from 8 when dodging (one strike can
// be survived, and a strike leaves the stick dead for 0.3s), stage 3 from 7.5 for both.
export const STAGES = [
  null,
  { name: 'LAKESIDE HILL', startX: 0, birds: [], air: [] },
  { name: 'BIRD CROSSING', startX: 50, air: [],
    birds: [[60, 5], [130, 42], [200, 15], [270, 42], [335, 15], [380, 5]] },
  { name: 'DOWNDRAFT LAKE', startX: 0,
    air: [[80, 115, -3.5], [115, 140, 4], [200, 240, -3.5], [240, 262, 4], [320, 360, -3.5]],
    birds: [[100, 6], [225, 6], [345, 6]] },
];

export function create(stage = 1) {
  return {
    phase: 'ready', stage, t: 0, x: STAGES[stage].startX, y: 0, vx: 0, vy: 0, theta: 0, omega: 0,
    leg: 0, boardT: 0, stopT: 0, alpha: 0, stall: false, lift: 0, bonk: 0,
    onGround: true, climbed: false, success: false, result: null, events: [],
    birds: STAGES[stage].birds.map(([m, h], i) => { const x = CFG.edgeX + m / CFG.pxToM, y = CFG.lakeY + h; return { x0: x, y0: y, p: i * 1.7, x, y, hitT: -1 }; }),
  };
}

export function start(s, stage = s.stage || 1) {
  Object.assign(s, create(stage), { phase: 'run' });
  moveBirds(s);
}

// Birds hover over their spot, drifting a little, so a stage plays the same every time.
function moveBirds(s) {
  for (const b of s.birds) {
    if (b.hitT >= 0) continue;
    b.x = b.x0 + Math.sin(s.t * 0.7 + b.p) * 6;
    b.y = b.y0 + Math.sin(s.t * 2.2 + b.p) * 2;
  }
}
// the gondola and the wing, in world pixels from the wheel, level flight
function hitsPlane(s, b) {
  const dx = b.x - s.x, dy = b.y - s.y, r = 2;
  const body = dx > -14 - r && dx < 19 + r && dy > 0 - r && dy < 26 + r;
  const wing = dx > -31 - r && dx < 19 + r && dy > 20 - r && dy < 27 + r;
  return body || wing;
}

// Rising (+) and sinking (-) air over stretches of the lake, px/s, eased in at the edges
export function airAt(s, x) {
  const m = (x - CFG.edgeX) * CFG.pxToM;
  for (const [a, b, w] of STAGES[s.stage].air) {
    if (m < a || m > b) continue;
    return w * Math.min(1, (m - a) / 8, (b - m) / 8);
  }
  return 0;
}

// Every press counts, from either pedal: drumming one pedal is as good as
// alternating, and the difficulty is the number of presses a second. The legs
// still take turns on screen - leg flips with each press, whichever side it was.
export function foot(s) {
  if (s.phase !== 'run' && s.phase !== 'roll' && s.phase !== 'fly') return;
  s.leg = s.leg === 1 ? -1 : 1;
  if (s.phase === 'run') { s.vx += CFG.run.step * (1 - s.vx / CFG.run.vcap); s.events.push('step'); }
  else { s.omega += CFG.prop.add * (1 - s.omega); s.events.push('pedal'); }
}

export function board(s) {
  if (s.phase === 'run' && s.vx > 5) { s.phase = 'board'; s.boardT = 0; s.events.push('board'); }
}

function fail(s, reason) {
  s.phase = 'over';
  s.result = { ok: s.success, reason, dist: Math.max(0, s.x - CFG.edgeX) * CFG.pxToM };
  s.events.push(s.success ? 'land' : 'fail');
}

// flight is worked out against the air, which may be rising or sinking
export function aero(s) {
  const a = CFG.aero;
  const ux = s.vx, uy = s.vy - s.lift;
  const V = Math.max(0.1, Math.hypot(ux, uy));
  const gamma = Math.atan2(uy, ux);
  const alpha = s.theta - gamma;
  let cl, stall = false;
  if (Math.abs(alpha) < a.stall) cl = a.cla * alpha;
  else {
    stall = true;
    cl = Math.sign(alpha) * a.cla * a.stall * Math.max(a.stallFloor, 1 - (Math.abs(alpha) - a.stall) * 4);
  }
  const floor = s.x > CFG.edgeX ? CFG.lakeY : 0;
  const h = s.y - floor;
  const ge = h < a.ge ? 1 + a.geGain * (1 - Math.max(0, h) / a.ge) : 1;
  const q = a.c * V * V;
  const L = q * cl * ge;
  const D = q * (a.cd0 + a.k * cl * cl / ge + (stall ? a.stallDrag : 0));
  const T = CFG.prop.thrust * s.omega * Math.max(0, 1 - V / CFG.prop.vmax);
  return { V, ux, uy, gamma, alpha, stall, L, D, T, ge };
}

export function step(s, dt, inp) {
  s.t += dt;
  moveBirds(s);
  s.bonk = Math.max(0, s.bonk - dt);
  if (s.phase === 'run') {
    s.vx = Math.max(0, s.vx - CFG.run.friction * dt);
    s.x += s.vx * dt;
    if (s.x > CFG.edgeX) fail(s, 'edge');
    return;
  }
  if (s.phase === 'board') {
    s.boardT += dt;
    s.x += s.vx * dt;
    if (s.x > CFG.edgeX) return fail(s, 'miss');
    if (s.boardT >= CFG.boardTime) {
      s.phase = 'roll';
      s.vx *= CFG.boardKeep;
      s.omega = 0.2;
      s.events.push('seated');
    }
    return;
  }
  if (s.phase !== 'roll' && s.phase !== 'fly' && s.phase !== 'clear') return;
  const clear = s.phase === 'clear';
  // a strike leaves the pilot shaken for a moment: the stick does nothing while bonk runs
  if (clear || s.bonk > 0) inp = {};

  s.omega = clear ? 0.7 : Math.max(0, s.omega - CFG.prop.decay * dt);
  s.lift = airAt(s, s.x);
  const f = aero(s);
  s.alpha = f.alpha;
  s.stall = f.stall;

  // pitch
  if (s.onGround) {
    if (inp.up) s.theta = Math.min(CFG.rotateMax, s.theta + CFG.pitchRate * dt);
    else s.theta += (0 - s.theta) * Math.min(1, CFG.relax * 2 * dt);
  } else {
    if (inp.up) s.theta += CFG.pitchRate * dt;
    else if (inp.down) s.theta -= CFG.pitchRate * dt;
    else s.theta += (f.gamma + CFG.trim - s.theta) * Math.min(1, CFG.relax * dt);
    if (f.stall) s.theta -= CFG.aero.stallDrop * dt;
    s.theta = Math.max(-0.8, Math.min(0.8, s.theta));
  }

  let ax = f.T * Math.cos(s.theta) - f.D * f.ux / f.V - f.L * f.uy / f.V;
  let ay = f.T * Math.sin(s.theta) - f.D * f.uy / f.V + f.L * f.ux / f.V - CFG.g;

  const overGround = s.x <= CFG.edgeX;
  if (s.onGround && overGround) {
    if (s.vx > 0) ax -= CFG.groundRoll;
    if (ay <= 0) { ay = 0; s.vy = 0; }
  }
  s.vx = Math.max(0, s.vx + ax * dt);
  s.vy += ay * dt;
  s.x += s.vx * dt;
  s.y += s.vy * dt;

  if (overGround && s.y <= 0) {
    if (!s.onGround && s.vy < -25) { s.events.push('bump'); }
    s.y = 0; s.vy = Math.max(0, s.vy); s.onGround = true;
  } else if (s.y > 0.5 || !overGround) {
    if (s.onGround) s.events.push('liftoff');
    s.onGround = false;
  }
  if (clear) { s.y = Math.max(s.y, CFG.lakeY + 4); return; }
  // a bird strike takes most of the propeller's spin and a good part of the speed,
  // throws the plane down and knocks the nose under
  for (const b of s.birds) {
    if (b.hitT >= 0 || !hitsPlane(s, b)) continue;
    b.hitT = s.t; b.hx = b.x; b.hy = b.y;
    s.omega *= 0.25; s.vx *= 0.65; s.vy = Math.min(s.vy, 0) - 18; s.theta -= 0.3; s.bonk = 0.3;
    s.events.push('bird');
  }
  s.phase = s.onGround ? 'roll' : 'fly';

  if (s.onGround && s.vx < 1) {
    s.stopT += dt;
    if (s.stopT > 1) return fail(s, 'stop');
  } else s.stopT = 0;

  if (!s.climbed && s.x > CFG.edgeX + 10 && s.vy > 0) { s.climbed = true; s.events.push('climb'); }
  if (!s.success && s.x - CFG.edgeX >= CFG.successDist && s.y > CFG.lakeY + 2) {
    s.success = true; s.phase = 'clear';
    s.result = { ok: true, reason: 'goal', dist: CFG.successDist * CFG.pxToM };
    s.events.push('goal');
    return;
  }
  if (!overGround && s.y <= CFG.lakeY) { s.y = CFG.lakeY; fail(s, 'splash'); }
}
