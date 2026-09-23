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

export function create() {
  return {
    phase: 'ready', t: 0, x: 0, y: 0, vx: 0, vy: 0, theta: 0, omega: 0,
    lastFoot: 0, boardT: 0, stumble: 0, stopT: 0, alpha: 0, stall: false,
    onGround: true, climbed: false, success: false, result: null, events: [],
  };
}

export function start(s) {
  Object.assign(s, create(), { phase: 'run' });
}

export function foot(s, side) {
  if (s.phase !== 'run' && s.phase !== 'roll' && s.phase !== 'fly') return;
  const good = side !== s.lastFoot;
  s.lastFoot = side;
  if (s.phase === 'run') {
    if (good) s.vx += CFG.run.step * (1 - s.vx / CFG.run.vcap);
    else { s.vx *= 0.8; s.stumble = 0.25; s.events.push('stumble'); }
    if (good) s.events.push('step');
  } else {
    if (good) { s.omega += CFG.prop.add * (1 - s.omega); s.events.push('pedal'); }
    else { s.omega *= 0.9; s.stumble = 0.25; s.events.push('stumble'); }
  }
}

export function board(s) {
  if (s.phase === 'run' && s.vx > 5) { s.phase = 'board'; s.boardT = 0; s.events.push('board'); }
}

function fail(s, reason) {
  s.phase = 'over';
  s.result = { ok: s.success, reason, dist: Math.max(0, s.x - CFG.edgeX) * CFG.pxToM };
  s.events.push(s.success ? 'land' : 'fail');
}

export function aero(s) {
  const a = CFG.aero;
  const V = Math.max(0.1, Math.hypot(s.vx, s.vy));
  const gamma = Math.atan2(s.vy, s.vx);
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
  return { V, gamma, alpha, stall, L, D, T, ge };
}

export function step(s, dt, inp) {
  s.t += dt;
  s.stumble = Math.max(0, s.stumble - dt);
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
  if (clear) inp = {};

  s.omega = clear ? 0.7 : Math.max(0, s.omega - CFG.prop.decay * dt);
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

  let ax = f.T * Math.cos(s.theta) - f.D * s.vx / f.V - f.L * s.vy / f.V;
  let ay = f.T * Math.sin(s.theta) - f.D * s.vy / f.V + f.L * s.vx / f.V - CFG.g;

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
