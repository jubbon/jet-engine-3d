import {
  createReverser,
  blockerAngle,
  blockedFraction,
  thrustFactor,
  STROKE,
  DEPLOY_TIME,
  STOW_TIME,
  REV_MAX_THROTTLE,
  LINK,
} from '../src/reverser.js';
import { createEngineState, IDLE_N1 } from '../src/engineState.js';

/* ------------------------------------------------------------------ *
 *  The thrust reverser: the deployment state machine, the drag-link
 *  kinematics of the blocker doors, and the thrust that comes out of
 *  the two together.
 *
 *  None of it needs a browser, which is the point: a deployment takes
 *  two seconds and the interesting part is what the interlocks refuse
 *  to do, neither of which can be judged from a screenshot.
 *
 *  Where a number here also has to hold on the real mesh - the doors
 *  reaching the core cowl without going through it - it is checked
 *  from the kinematics on this page and from the vertices in
 *  clearance.test.mjs. Two independent measurements of the same fact:
 *  if the geometry is ever placed at odds with the linkage that drives
 *  it, one of the two moves and the other does not.
 * ------------------------------------------------------------------ */

const DT = 1 / 60;
let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
};
const deg = (r) => (r * 180) / Math.PI;

/* --------------------- 1. the deployment cycle ---------------------- */
{
  const rev = createReverser();
  check('the sleeve starts home', rev.mode === 'stowed' && rev.travel === 0);

  rev.request(true, 'run');
  check('the button selects deploy', rev.mode === 'deploying');

  let t = 0;
  let modeAtLastFrame = null;
  let deployedAt = null;
  const trace = [];
  while (t < 10 && deployedAt === null) {
    modeAtLastFrame = rev.mode;
    rev.update(DT);
    t += DT;
    if (rev.mode === 'deployed') deployedAt = t;
    if (trace.length < 5 && Math.abs(t % 0.5) < DT) {
      trace.push(
        `t=${t.toFixed(1)}s  travel=${rev.travel.toFixed(3)}  ` +
          `door=${deg(blockerAngle(rev.travel)).toFixed(1)}°  blocked=${rev.blocked.toFixed(2)}`
      );
    }
  }
  console.log('\n=== DEPLOYMENT ===');
  trace.forEach((l) => console.log('  ' + l));
  console.log(`fully deployed: ${deployedAt?.toFixed(2)} s\n`);

  check(
    'deployment takes DEPLOY_TIME',
    Math.abs(deployedAt - DEPLOY_TIME) < 3 * DT,
    `${deployedAt?.toFixed(3)} s against ${DEPLOY_TIME}`
  );
  // the transition belongs to the state machine, not to the button: the frame
  // before the sleeve arrives, it is still on its way
  check('the machine makes the transition itself', modeAtLastFrame === 'deploying');
  check('travel stops at the stroke', rev.travel === STROKE);

  rev.request(false, 'run');
  let t2 = 0;
  let stowedAt = null;
  while (t2 < 10 && stowedAt === null) {
    rev.update(DT);
    t2 += DT;
    if (rev.mode === 'stowed') stowedAt = t2;
  }
  check(
    'stowing takes STOW_TIME',
    Math.abs(stowedAt - STOW_TIME) < 3 * DT,
    `${stowedAt?.toFixed(3)} s against ${STOW_TIME}`
  );
  check('the sleeve comes exactly home', rev.travel === 0);
}

/* ------------------------- 2. the interlocks ------------------------ */
{
  for (const mode of ['off', 'start', 'stop']) {
    const rev = createReverser();
    const taken = rev.request(true, mode);
    for (let i = 0; i < 60; i++) rev.update(DT);
    check(
      `deploy is refused in "${mode}"`,
      taken === false && rev.mode === 'stowed' && rev.travel === 0
    );
  }

  const rev = createReverser();
  rev.request(true, 'run');
  for (let i = 0; i < 30; i++) rev.update(DT); // half a second in
  const half = rev.travel;
  rev.request(false, 'run');
  rev.update(DT);
  check(
    'a stow reverses from where the sleeve is',
    rev.mode === 'stowing' && rev.travel < half && half - rev.travel < 0.02,
    `${half.toFixed(3)} -> ${rev.travel.toFixed(3)}, no jump`
  );
  let t = 0;
  while (t < 10 && rev.mode !== 'stowed') {
    rev.update(DT);
    t += DT;
  }
  check('and completes', rev.mode === 'stowed' && rev.travel === 0);
}

{
  // a request already in progress is not a toggle to be pumped
  const a = createReverser();
  const b = createReverser();
  a.request(true, 'run');
  b.request(true, 'run');
  for (let i = 0; i < 30; i++) {
    a.update(DT);
    b.update(DT);
    b.request(true, 'run'); // pressed every frame
  }
  check('repeating a request changes nothing', Math.abs(a.travel - b.travel) < 1e-12);
}

/* ---------------- 3. the throttle the lever is allowed -------------- */
{
  const rev = createReverser();
  check('stowed, the throttle is free', rev.throttleLimit() === 1);
  rev.request(true, 'run');
  rev.update(DT);
  check('while the sleeve moves, the engine is held at idle', rev.throttleLimit() === 0);
  while (rev.mode !== 'deployed') rev.update(DT);
  check(
    'deployed, reverse power is limited',
    rev.throttleLimit() === REV_MAX_THROTTLE,
    `${REV_MAX_THROTTLE} of the range`
  );
  rev.request(false, 'run');
  rev.update(DT);
  check('and idle again on the way home', rev.throttleLimit() === 0);
}

/* ------------- 4. shutdown does not leave the sleeve out ------------ */
{
  const eng = createEngineState(0.85);
  const rev = createReverser();
  rev.request(true, 'run');
  while (rev.mode !== 'deployed') rev.update(DT);

  // this is what main.js does on the shutdown button
  eng.setMode('stop');
  rev.request(false, eng.mode);

  let t = 0;
  let homeAt = null;
  let rotorsStoppedAt = null;
  while (t < 200) {
    rev.update(DT);
    eng.update(DT, 0);
    t += DT;
    if (homeAt === null && rev.mode === 'stowed') homeAt = t;
    if (rotorsStoppedAt === null && eng.n1 === 0) rotorsStoppedAt = t;
    if (rotorsStoppedAt !== null) break;
  }
  check(
    'shutdown stows the reverser, and long before the rotors stop',
    homeAt !== null && homeAt < rotorsStoppedAt,
    `home at ${homeAt?.toFixed(1)} s, rotors at ${rotorsStoppedAt?.toFixed(1)} s`
  );
}

/* --------------------- 5. the drag-link kinematics ------------------ */
{
  console.log('\n=== BLOCKER DOOR LINKAGE ===');
  for (let i = 0; i <= 6; i++) {
    const s = (STROKE * i) / 6;
    console.log(
      `  travel=${s.toFixed(3)}  door=${deg(blockerAngle(s)).toFixed(1).padStart(5)}°  ` +
        `blocked=${blockedFraction(s).toFixed(3)}`
    );
  }
  console.log('');

  check('the door is flush when the sleeve is home', blockerAngle(0) === 0);

  let monotone = true;
  let finite = true;
  let prev = -1;
  for (let i = 0; i <= 200; i++) {
    const th = blockerAngle((STROKE * i) / 200);
    if (!Number.isFinite(th)) finite = false;
    if (th < prev - 1e-12) monotone = false;
    prev = th;
  }
  check('the door angle only ever increases', monotone);
  check('and is finite everywhere along the stroke', finite);

  // the linkage is solved, not tabulated, so it has to be safe outside its
  // range too: a NaN here would put a hole in the model rather than raise
  let safeBeyond = true;
  for (let i = 0; i <= 100; i++) {
    const th = blockerAngle((1.5 * STROKE * i) / 100);
    if (!Number.isFinite(th)) safeBeyond = false;
  }
  check('and past the end of the stroke it clamps rather than breaking', safeBeyond);

  const reach = LINK.chord * Math.sin(blockerAngle(STROKE));
  check(
    'at full travel the door spans the duct',
    reach > 0.48 && reach < 0.53,
    `${reach.toFixed(3)} units of a duct 0.50…0.53 high`
  );
  check(
    'and closes almost all of it',
    blockedFraction(STROKE) > 0.9 && blockedFraction(STROKE) <= 1,
    `${(100 * blockedFraction(STROKE)).toFixed(1)} %`
  );

  /* The teaching point, and the reason the angle comes from a linkage rather
     than from a curve someone liked the shape of: the doors do almost nothing
     over the first part of the stroke and then swing. */
  check(
    'the doors close late in the stroke',
    blockedFraction(STROKE / 3) < 0.25,
    `${(100 * blockedFraction(STROKE / 3)).toFixed(1)} % blocked a third of the way`
  );
}

/* --------------------------- 6. the thrust -------------------------- */
{
  check('a stowed reverser changes nothing', thrustFactor(0) === 1);
  check(
    'a deployed one reverses the thrust',
    thrustFactor(blockedFraction(STROKE)) < 0,
    `factor ${thrustFactor(blockedFraction(STROKE)).toFixed(3)}`
  );

  let monotone = true;
  let prev = 2;
  for (let i = 0; i <= 100; i++) {
    const f = thrustFactor(blockedFraction((STROKE * i) / 100));
    if (f > prev + 1e-12) monotone = false;
    prev = f;
  }
  check('and it falls all the way, without a peak in the middle', monotone);

  // through the real state machine, at the power the interlock allows
  const eng = createEngineState(0);
  for (let i = 0; i < 60 * 60; i++) eng.update(DT, REV_MAX_THROTTLE);
  const net = eng.grossThrust * thrustFactor(blockedFraction(STROKE));
  console.log('\n=== REVERSE THRUST ===');
  console.log(
    `  N1=${(eng.n1 * 100).toFixed(1)} %  gross=${eng.grossThrust.toFixed(1)} kN  ` +
      `factor=${thrustFactor(blockedFraction(STROKE)).toFixed(3)}  net=${net.toFixed(1)} kN\n`
  );
  check(
    'reverse thrust is about a fifth of take-off thrust',
    net < -15 && net > -25,
    `${net.toFixed(1)} kN at N1 = ${(eng.n1 * 100).toFixed(0)} %`
  );
  check(
    'the reverse power limit holds N1 below 82 %',
    eng.n1 < 0.82 && eng.n1 > IDLE_N1,
    `${(eng.n1 * 100).toFixed(1)} %`
  );
}

/* ------------------- 7. where the bypass air goes ------------------- *
 *  The one claim in this feature that is about the picture rather than
 *  about numbers, and it is still worth checking numerically: with the
 *  doors closed the fan air must leave FORWARD and OUTWARD through the
 *  cascades, and the core stream must be exactly as it was.
 *
 *  This is why the import of airflow.js appears in an otherwise
 *  dependency-free test: the behaviour belongs to the reverser, the
 *  particles are where it shows, and counting them is a great deal more
 *  reliable than looking at a screenshot of eight thousand dots.
 * -------------------------------------------------------------------- */
{
  const { createAirflow } = await import('../src/airflow.js');
  const N_BYPASS = 5200; // the split in airflow.js; core particles follow

  const run = (blocked) => {
    const flow = createAirflow();
    flow.setVisible(true);
    for (let i = 0; i < 600; i++) flow.update(1 / 60, 0.8, 0.6, blocked);
    const p = flow.group.children[0].geometry.attributes.position;
    let escaping = 0; // bypass air forward of the doors and outside the duct
    let throughNozzle = 0; // bypass air still leaving aft
    let core = 0; // core air past the core nozzle
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const r = Math.hypot(p.getY(i), p.getZ(i));
      if (i < N_BYPASS) {
        if (x < 0.11 && r > 1.75) escaping++;
        if (x > 1.16) throughNozzle++;
      } else if (x > 2.9) core++;
    }
    return { escaping, throughNozzle, core };
  };

  const fwd = run(0);
  const rev = run(1);
  console.log('\n=== WHERE THE BYPASS AIR GOES ===');
  console.log(`  stowed:   out of the cascades ${fwd.escaping}, out of the fan nozzle ${fwd.throughNozzle}, core ${fwd.core}`);
  console.log(`  deployed: out of the cascades ${rev.escaping}, out of the fan nozzle ${rev.throughNozzle}, core ${rev.core}\n`);

  check('Stowed, nothing leaves through the cascades', fwd.escaping === 0);
  check('Deployed, the fan air does', rev.escaping > 100, `${rev.escaping} particles`);
  check(
    'and almost none of it still leaves aft',
    rev.throughNozzle < 0.1 * fwd.throughNozzle,
    `${rev.throughNozzle} against ${fwd.throughNozzle} stowed`
  );
  // A cascade reverser does nothing to the core. If this ever changes, the
  // plume, the heat haze and the contrail are all wrong too.
  check(
    'The core stream is untouched',
    Math.abs(rev.core - fwd.core) < 0.15 * fwd.core,
    `${rev.core} against ${fwd.core}`
  );
}

console.log(failures === 0 ? '\nAll checks passed.' : `\nFAILED checks: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
