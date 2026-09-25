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
// only catches a plane that sinks, one at 15 has to be climbed over, and one at 42-58 can
// only be passed under (the wheel below its height less 30). air is [from m, to m, px/s], sinking air
// negative.
// Tuned with bots (careful pilot dodging, sloppy one pulling up only when low):
// stage 1 clears from 6 presses a second, stage 2 from 7 when dodging without a strike
// (flying straight takes 2-3 and needs 7.5-8; a strike leaves the stick dead for 0.3s).
// Once strikes got harder stage 2 had become harder than stage 3, so its high birds went
// from 42 to 48 - under them no longer means skimming the water - and the last low one
// went. The air zones are not used
// by any stage at present (the downdraft stage was replaced by the balloons).
// Stage 3: a careful pilot aiming the hub at each balloon pops exactly 7 at 7-8 presses
// a second; flying straight pops 3-4. Stage 4 (short run on the pyramid) weaves: three
// obelisks 25-26 tall ask for height and three falcons at 50 ask for a dip under them
// (the wheel below 20), each far enough from the next obelisk to climb back. The first
// playtest found the old low falcons never met a plane kept high over the obelisks.
// Careful pilot clears from 8 a second; one that stays high eats all three falcons and
// needs 8.5-9.
// Stage 5: careful clears from 8 popping all ten (7.5 cannot climb to the obelisks in
// time), flying straight pops 3. Stage 6: careful clears from 7.5 without a strike; one
// that stays high takes two falcons and then needs 8.5 to carry over the Sphinx.
// Stage 7: careful from 7.5 without a strike, staying high takes all three drones and
// needs 8.5. Stage 8: careful from 8; staying high meets the first girder. Stage 9:
// careful from 8.5.
export const STAGES = [
  null,
  { name: 'LAKESIDE HILL', startX: 0, birds: [], air: [] },
  { name: 'BIRD CROSSING', startX: 50, air: [],
    birds: [[60, 5], [130, 48], [200, 15], [270, 48], [335, 15]] },
  // Stage 3: ten balloons over the lake, popped with the propeller. A balloon is [metres,
  // height of its middle above the lake]; the hub is 13px above the wheel, so a balloon
  // at 16 wants the wheel skimming the water and one at 40 wants the plane up high.
  // Seven have to be popped by the goal or the flight does not count.
  { name: 'BALLOON LAKE', startX: 0, air: [], birds: [], need: 7,
    balloons: [[40, 30], [80, 17], [115, 38], [150, 20], [185, 40], [220, 16], [255, 36], [290, 19], [330, 40], [370, 24]] },
  // Stages 4-6 are Egypt: the run is along the top of a pyramid, the plane drops off its
  // steep face over a strip of sand (sandTo metres past the edge: coming down on it is a
  // crash, not a splash) and then crosses the Nile. Obelisks stand on islets, [metres,
  // height above the water], clear of the distance markers; hitting one is a crash. The
  // birds are falcons.
  { name: 'NILE CROSSING', theme: 'egypt', startX: 80, air: [], sandTo: 25,
    birds: [[180, 50], [310, 50], [385, 50]],
    obelisks: [[118, 25], [250, 26], [355, 25]] },
  // Stage 5: balloons among the obelisks - one on the climb to each obelisk, one over its
  // tip, one down low after it. Eight of ten, and the stone still ends the flight.
  { name: 'NILE BALLOONS', theme: 'egypt', startX: 80, air: [], sandTo: 25, birds: [], need: 8,
    obelisks: [[125, 25], [235, 26], [340, 25]],
    balloons: [[50, 22], [90, 32], [125, 40], [165, 20], [200, 32], [235, 41], [270, 20], [305, 32], [340, 40], [380, 20]] },
  // Stage 6: the Sphinx before the goal. sphinx.at is where its paws start and each block
  // is [metres from there, length, height]: paws, the head (the highest thing in Egypt),
  // the long back, the haunch. A falcon over its back keeps the plane low along it after
// the climb over the head.
  { name: 'GREAT SPHINX', theme: 'egypt', startX: 80, air: [], sandTo: 25,
    obelisks: [[110, 25], [240, 27]],
    birds: [[178, 52], [272, 15], [350, 58]],
    sphinx: { at: 310, blocks: [[0, 8, 10], [8, 10, 27], [18, 30, 19], [48, 8, 13]] } },
  // Stages 7-9 are the city at blue hour, rooftop to rooftop: the run is along a tower's
  // roof, and the lake's level is the street far below - coming down there is a crash.
  // Buildings rise from below and have to be flown over; girders hang from cranes out of
  // sight above and can only be passed under (the wheel below their underside less 30);
  // the birds are drones.
  // Stage 7: buildings with drones high between them, like stage 4.
  { name: 'SKYLINE', theme: 'city', startX: 60, air: [],
    buildings: [[100, 14, 24], [210, 20, 26], [320, 16, 25]],
    birds: [[160, 52], [270, 52], [375, 52]] },
  // Stage 8: buildings and girders, over one and under the next. A girder is not a bird:
  // meeting one ends the flight.
  { name: 'CRANE YARD', theme: 'city', startX: 60, air: [], birds: [],
    buildings: [[95, 12, 24], [215, 14, 26], [330, 14, 25]],
    girders: [[150, 12, 48], [270, 12, 48], [380, 10, 48]] },
  // Stage 9: all of it, closer together, with drones low after the girders for a plane
  // that dives too deep.
  { name: 'SKYSCRAPERS', theme: 'city', startX: 60, air: [],
    buildings: [[90, 12, 24], [190, 18, 27], [300, 14, 26]],
    girders: [[140, 12, 47], [245, 12, 47], [350, 12, 47]],
    birds: [[165, 15], [272, 5], [385, 52]] },
];

export function create(stage = 1) {
  return {
    phase: 'ready', stage, t: 0, x: STAGES[stage].startX, y: 0, vx: 0, vy: 0, theta: 0, omega: 0,
    leg: 0, boardT: 0, stopT: 0, alpha: 0, stall: false, lift: 0, bonk: 0,
    onGround: true, climbed: false, success: false, result: null, events: [],
    birds: STAGES[stage].birds.map(([m, h], i) => { const x = CFG.edgeX + m / CFG.pxToM, y = CFG.lakeY + h; return { x0: x, y0: y, p: i * 1.7, x, y, hitT: -1 }; }),
    balloons: (STAGES[stage].balloons || []).map(([m, h], i) => { const x = CFG.edgeX + m / CFG.pxToM, y = CFG.lakeY + h; return { x0: x, y0: y, p: i * 2.3, x, y, popT: -1 }; }),
    got: 0,
    obelisks: (STAGES[stage].obelisks || []).map(([m, h]) => ({ x: CFG.edgeX + m / CFG.pxToM, w: 0, top: CFG.lakeY + h })),
    // Solid stone and steel, each a box from bot to top: the sphinx as a row of blocks
    // [metres, length, height] along its back; the city's buildings [metres, length,
    // height] rising from the street; and the girders hanging from cranes [metres, length,
    // height of their underside], which reach up out of the picture.
    stone: [
      ...(STAGES[stage].sphinx?.blocks || []).map(([m, len, h]) => ({ kind: 'sphinx', x: CFG.edgeX + (STAGES[stage].sphinx.at + m) / CFG.pxToM, w: len / CFG.pxToM, bot: -Infinity, top: CFG.lakeY + h })),
      ...(STAGES[stage].buildings || []).map(([m, len, h]) => ({ kind: 'building', x: CFG.edgeX + m / CFG.pxToM, w: len / CFG.pxToM, bot: -Infinity, top: CFG.lakeY + h })),
      ...(STAGES[stage].girders || []).map(([m, len, h]) => ({ kind: 'girder', x: CFG.edgeX + m / CFG.pxToM, w: len / CFG.pxToM, bot: CFG.lakeY + h, top: Infinity })),
    ],
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
  // balloons only bob on their strings
  for (const b of s.balloons) b.y = b.y0 + Math.sin(s.t * 1.6 + b.p) * 1.5;
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

  // the propeller pops a balloon it meets: the hub, 17px ahead of the wheel and 13 up
  for (const b of s.balloons) {
    if (b.popT >= 0 || Math.abs(b.x - (s.x + 17)) > 6 || Math.abs(b.y - (s.y + 13)) > 5) continue;
    b.popT = s.t; s.got += 1; s.events.push('balloon');
  }
  // an obelisk is solid from the water to its tip
  for (const o of s.obelisks) {
    if (o.x > s.x - 12 && o.x < s.x + 16 && s.y + 2 < o.top) return fail(s, 'obelisk');
  }
  // the gondola meets what stands up from the water; the wing, reaching back, meets
  // what hangs down
  for (const o of s.stone) {
    const back = o.bot > -Infinity ? 31 : 12;
    if (o.x < s.x + 16 && o.x + o.w > s.x - back && s.y + 2 < o.top && s.y + 25 > o.bot) return fail(s, o.kind);
  }

  if (!s.climbed && s.x > CFG.edgeX + 10 && s.vy > 0) { s.climbed = true; s.events.push('climb'); }
  const need = STAGES[s.stage].need || 0;
  if (!s.success && need && s.got < need && s.x - CFG.edgeX >= CFG.successDist) return fail(s, 'short');
  if (!s.success && s.x - CFG.edgeX >= CFG.successDist && s.y > CFG.lakeY + 2) {
    s.success = true; s.phase = 'clear';
    s.result = { ok: true, reason: 'goal', dist: CFG.successDist * CFG.pxToM };
    s.events.push('goal');
    return;
  }
  if (!overGround && s.y <= CFG.lakeY) {
    s.y = CFG.lakeY;
    const sand = (STAGES[s.stage].sandTo || 0) / CFG.pxToM;
    fail(s, s.x - CFG.edgeX < sand ? 'sand' : 'splash');
  }
}
