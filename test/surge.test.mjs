import {
  SM0,
  marginAt,
  workingLine,
  surgeLine,
  correctedFlow,
  steadyBurn,
  refT4,
  surgeMargin,
  t4Of,
  T4_MIN,
  T4_SPAN,
  createSurge,
  SURGE_HZ,
  LOCK_TIME,
  SM_RECOVER,
  RECOVER_HOLD,
  STALL_CHOKE,
} from '../src/surge.js';
import { IDLE_N2, createEngineState } from '../src/engineState.js';

/* ------------------------------------------------------------------ *
 *  Compressor stability.
 *
 *  Two things are being checked here and they are worth keeping apart.
 *  The first is that the map is self-consistent - the surge line above
 *  the working line, the margin at rest equal to the table. The second,
 *  which arrives with the later tasks, is that the engine actually
 *  crosses the boundary where it should and nowhere else.
 *
 *  The first sort is easy to fake. "The margin is positive at every
 *  settled throttle position" looks like a test and is a tautology: in
 *  steady running the fuel command IS the steady fuel command, the
 *  square root is 1, and the margin is the table by construction. It
 *  could only fail if the table held a negative number - so the table is
 *  what gets checked, directly. This repository has learned that lesson
 *  once already, from a cascade-band check that compared the model
 *  against its own constants and could never fail.
 * ------------------------------------------------------------------ */

let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
};

console.log('\n=== COMPRESSOR MAP ===');

/* ------------------- the copy of the idle HP speed -------------------- *
 *  surge.js cannot import engineState.js - engineState imports it - so it
 *  carries its own copy of the idle HP speed. The two halves are compared
 *  here directly rather than either being trusted, which is how the repo
 *  handles X_DOORS in airflow.js and DUCT_H in reverser.js.
 * --------------------------------------------------------------------- */
{
  // steadyBurn is 0.1 at idle exactly when its idle constant matches this one
  check(
    "surge.js's idle HP speed agrees with engineState's",
    Math.abs(steadyBurn(IDLE_N2) - 0.1) < 1e-12,
    `steadyBurn(${IDLE_N2}) = ${steadyBurn(IDLE_N2)}`
  );
  check(
    'and the combustion temperature relation is the one engineState uses',
    t4Of(0) === T4_MIN && t4Of(1) === T4_MIN + T4_SPAN,
    `${t4Of(0)}…${t4Of(1)} °C`
  );
}

/* ---------------------------- the table ------------------------------- */
{
  check('every tabulated margin is positive', SM0.every(([, m]) => m > 0),
    SM0.map(([, m]) => m).join(', '));
  check('the table is ordered by speed', SM0.every(([n], i) => i === 0 || n > SM0[i - 1][0]));

  // interpolation must not dip below the lower endpoint of the interval it is
  // in - a piecewise-linear read cannot, but the check costs nothing and it is
  // the property the surge line depends on
  let dips = 0;
  for (let i = 1; i < SM0.length; i++) {
    const [x0, v0] = SM0[i - 1];
    const [x1, v1] = SM0[i];
    const lo = Math.min(v0, v1);
    for (let k = 0; k <= 20; k++) {
      const x = x0 + ((x1 - x0) * k) / 20;
      if (marginAt(x) < lo - 1e-12) dips++;
    }
  }
  check('the interpolation never dips below its endpoints', dips === 0, `${dips} dips`);

  // the shape is the teaching point: narrowest just above idle, widest at
  // take-off power. If this ever inverts, surge stops being a low-speed
  // phenomenon and the documentation stops being true.
  let narrowest = 1;
  let narrowestAt = 0;
  for (let n2 = 0.3; n2 <= 1.0001; n2 += 0.005) {
    if (marginAt(n2) < narrowest) {
      narrowest = marginAt(n2);
      narrowestAt = n2;
    }
  }
  check('the margin is narrowest just above idle', narrowestAt > IDLE_N2 && narrowestAt < 0.75,
    `narrowest ${narrowest.toFixed(3)} at n2 = ${narrowestAt.toFixed(2)}`);
  check('and wider at take-off power than at its narrowest', marginAt(1.0) > narrowest * 1.5,
    `${marginAt(1.0).toFixed(3)} against ${narrowest.toFixed(3)}`);
}

/* --------------------------- the two lines ---------------------------- */
{
  let above = true;
  let monotone = true;
  let flowMonotone = true;
  for (let n2 = 0; n2 <= 1.0001; n2 += 0.01) {
    if (surgeLine(n2) <= workingLine(n2)) above = false;
    if (n2 > 0 && workingLine(n2) <= workingLine(n2 - 0.01)) monotone = false;
    if (n2 > 0 && correctedFlow(n2) <= correctedFlow(n2 - 0.01)) flowMonotone = false;
  }
  check('the surge line is above the working line everywhere', above);
  check('the working line rises with speed', monotone,
    `${workingLine(0).toFixed(2)} at rest, ${workingLine(1).toFixed(1)} at take-off`);
  check('the map abscissa rises with speed', flowMonotone);

  // the working line is the model's own HPC pressure ratio, and the station
  // table in main.js reads the same expression. Pinned here so the two cannot
  // drift apart without a test saying so.
  check('the working line is the station table\'s HPC pressure ratio',
    Math.abs(workingLine(0.9) - (1 + 27 * Math.pow(0.9, 2.5))) < 1e-12,
    `${workingLine(0.9).toFixed(3)} at n2 = 0.9`);
}

/* --------------------------- the margin -------------------------------- */
{
  // The one identity worth having: fed the fuel it would settle at, the margin
  // returns the table exactly. Both halves of one fact, compared directly.
  let worst = 0;
  for (let n2 = 0.3; n2 <= 1.0001; n2 += 0.005) {
    worst = Math.max(worst, Math.abs(surgeMargin(n2, steadyBurn(n2)) - marginAt(n2)));
  }
  check('at the steady fuel command the margin IS the tabulated margin', worst < 1e-12,
    `largest disagreement ${worst.toExponential(1)}`);

  // more fuel than the speed calls for moves the point towards the boundary,
  // less moves it away - the direction the whole mechanism rests on
  check('more fuel than the speed calls for narrows the margin',
    surgeMargin(0.7, steadyBurn(0.7) + 0.2) < surgeMargin(0.7, steadyBurn(0.7)));
  check('less fuel widens it',
    surgeMargin(0.7, steadyBurn(0.7) - 0.05) > surgeMargin(0.7, steadyBurn(0.7)));

  // a fuel command driven far negative must not produce NaN: on a chop the
  // lead term is negative by design and a negative absolute temperature would
  // put a hole in the model rather than raise
  check('a wildly negative fuel command still gives a number',
    Number.isFinite(surgeMargin(0.7, -5)), `${surgeMargin(0.7, -5).toFixed(3)}`);

  console.log(`\n  margin along the working line:`);
  for (const n2 of [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]) {
    console.log(
      `    n2=${n2.toFixed(2)}  PR work=${workingLine(n2).toFixed(1)}  ` +
        `PR surge=${surgeLine(n2).toFixed(1)}  margin=${marginAt(n2).toFixed(3)}  ` +
        `T4ref=${(refT4(n2) - 273.15).toFixed(0)} °C`
    );
  }
}

/* ================================================================== *
 *  The sub-state machine, driven by SYNTHETIC margins.
 *
 *  Deliberately not by an engine. Checked this way, a failure here is
 *  unambiguously in the oscillator; when the trigger scenarios arrive
 *  they can only fail because of the trigger.
 * ================================================================== */

console.log('\n=== SURGE CYCLE ===');

const DT = 1 / 60;
// step a fresh machine with a constant margin for `secs`, return it
function run(margin, secs, running = true, s = createSurge(), n2 = 0.7) {
  const m = typeof margin === 'function' ? margin : () => margin;
  for (let t = 0; t < secs; t += DT) s.update(DT, m(t), running, n2);
  return s;
}

{
  const s = run(-0.1, 10);
  // one bang on entry plus SURGE_HZ per second while surging; it locks at
  // LOCK_TIME, so only the first LOCK_TIME seconds produce any
  const expected = 1 + Math.floor(SURGE_HZ * LOCK_TIME);
  check('a negative margin bangs at the design frequency', Math.abs(s.bangs - expected) <= 1,
    `${s.bangs} bangs against ${expected} expected`);
  check('and it locks into a stall', s.state === 'stall');
  check('nothing is expelled forward once it has locked', s.reverse === 0);
  check('but the throughput stays choked', s.choke === STALL_CHOKE);
}

{
  // it must not lock EARLY: at LOCK_TIME minus a margin it is still surging
  const s = run(-0.1, LOCK_TIME - 0.3);
  check('it does not lock before its time', s.state === 'surging', `after ${(LOCK_TIME - 0.3).toFixed(1)} s`);
}

{
  const s = createSurge();
  run(-0.1, 1.0, true, s);
  check('a surge is under way', s.state === 'surging');
  run(+0.1, RECOVER_HOLD / 2, true, s);
  check('a restored margin does not clear it instantly', s.state === 'surging',
    `after ${(RECOVER_HOLD / 2).toFixed(2)} s of margin`);
  run(+0.1, RECOVER_HOLD, true, s);
  check('but it clears once the margin has been held', s.state === 'clear');
  check('and nothing is left running backwards', s.reverse === 0 && s.choke === 0);
}

{
  // a margin dithering across zero must not chatter the state: below
  // SM_RECOVER it stays surging however often the sign flips
  const s = run((t) => (Math.floor(t * 40) % 2 ? 0.02 : -0.02), 2.0);
  check('a margin dithering on the boundary does not chatter', s.state === 'surging',
    `SM_RECOVER = ${SM_RECOVER}`);
}

{
  const s = createSurge();
  run(-0.1, LOCK_TIME + 0.5, true, s);
  check('locked into a stall', s.state === 'stall');
  run(+0.5, 10, true, s);
  check('no margin whatever clears a locked stall', s.state === 'stall',
    'the throttle cannot undo it');
  run(+0.5, 0.5, false, s); // fuel cut
  check('only a fuel cut clears it', s.state === 'clear');
}

{
  const s = run(-0.1, 2.0, false);
  check('with the fuel off it never surges at all', s.state === 'clear' && s.bangs === 0);
}

{
  // The reason bangs is a counter and the oscillator wraps in a while: stepped
  // with a dt spanning several cycles it must count all of them, not one.
  const s = createSurge();
  s.update(DT, -0.1, true, 0.7); // entry bang
  const entry = s.bangs;
  s.update(0.6, -0.1, true, 0.7); // 0.6 s at 4 Hz = 2.4 cycles
  check('a step spanning several cycles counts all of them', s.bangs - entry >= 2,
    `${s.bangs - entry} bangs across a 0.60 s step at ${SURGE_HZ} Hz`);
}

{
  // the pulse peaks at the bang, so what is heard and what is expelled agree
  const s = createSurge();
  s.update(DT, -0.1, true, 0.7);
  check('the flow reversal peaks at the bang, not after it', s.reverse > 0.8,
    `reverse = ${s.reverse.toFixed(2)} on the banging update`);
}

{
  // the stall cells must travel slower than the rotor - they propagate, they
  // are not carried round with the blades
  const s = createSurge();
  run(-0.1, LOCK_TIME + 0.5, true, s, 0.7);
  const before = s.cell;
  s.update(1.0, -0.1, true, 0.7);
  const cellRevs = (s.cell - before) / (Math.PI * 2);
  check('the stall cells run slower than the rotor', cellRevs < 0.7 && cellRevs > 0,
    `${cellRevs.toFixed(2)} turns against the rotor's 0.70 in the same second`);
}

/* ================================================================== *
 *  The fuel command.
 *
 *  `burn` now follows `wf` instead of following keff directly, and
 *  `burn` is the one variable every visual effect in the model reads.
 *  The guard below is why that change was worth a commit of its own: in
 *  the steady state the two expressions must agree to floating point, so
 *  no documented number can have moved.
 * ================================================================== */

console.log('\n=== FUEL COMMAND ===');

const settle = (throttle, seconds = 90) => {
  const eng = createEngineState(throttle);
  for (let i = 0; i < 60 * seconds; i++) eng.update(DT, throttle);
  return eng;
};

{
  let worst = 0;
  let worstAt = 0;
  for (let i = 0; i <= 100; i += 2) {
    const thr = i / 100;
    const eng = settle(thr);
    const old = 0.1 + 0.9 * eng.keff; // what the burn target used to be
    if (Math.abs(eng.wf - old) > worst) {
      worst = Math.abs(eng.wf - old);
      worstAt = thr;
    }
  }
  check('settled, the fuel command IS the old burn target', worst < 1e-9,
    `largest disagreement ${worst.toExponential(1)} at ${(worstAt * 100).toFixed(0)} % throttle`);
}

{
  // A slam now runs hot before it runs fast, which a real slam does and the
  // model previously had exactly backwards - it ran COLD through an
  // acceleration, because burn followed the LP rotor's lag.
  const eng = settle(0);
  const t4Idle = eng.t4;
  let peak = 0;
  for (let i = 0; i < 60 * 4; i++) {
    eng.update(DT, 1.0);
    peak = Math.max(peak, eng.wf - (0.1 + 0.9 * eng.keff));
  }
  check('a slam commands more fuel than the speed calls for', peak > 0.2,
    `${peak.toFixed(3)} above the steady command at its worst`);
  check('and the gas path is hotter than it was at idle', eng.t4 > t4Idle,
    `${eng.t4.toFixed(0)} °C against ${t4Idle.toFixed(0)} °C`);
}

{
  // and a chop commands less, which moves the point away from the boundary
  const eng = settle(1.0);
  let low = Infinity;
  for (let i = 0; i < 60 * 2; i++) {
    eng.update(DT, 0);
    low = Math.min(low, eng.wf - (0.1 + 0.9 * eng.keff));
  }
  check('a chop commands less fuel than the speed calls for', low < -0.05,
    `${low.toFixed(3)} below the steady command at its worst`);
  check('and the command never goes negative', low + 0.1 + 0.9 >= 0 && settle(0).wf >= 0);
}

/* --------------- starting, and where the lever was left ---------------- *
 *  The mode gate on `wf` is what keeps the lead term out of a start.
 *  Without it the term applies during cranking - where n2 sits near
 *  START_N2 while the lever is wherever it was left - and the
 *  application boots at 85 % throttle, so every start would surge on the
 *  default path.
 *
 *  With the gate, the start itself is clean. What is NOT clean, and
 *  should not be, is the moment the start ends: an engine arriving at
 *  idle with the lever still advanced is being asked to slam, and it
 *  surges. That is not a defect to be papered over - it is the model
 *  reproducing why the checklist puts the thrust levers at idle before a
 *  start, and it is the same event as a reverser cap releasing onto a
 *  lever left up.
 * ----------------------------------------------------------------------- */
function coldStart(lever) {
  const eng = createEngineState(0.85);
  eng.setMode('stop');
  for (let i = 0; i < 60 * 120; i++) eng.update(DT, lever);
  eng.setMode('start');
  let leaded = 0;
  let worstSM = Infinity;
  let worstDuringSpool = Infinity;
  for (let i = 0; i < 60 * 80; i++) {
    eng.update(DT, lever);
    /* Classified AFTER the update, not before. The state machine promotes
       `start` to `run` part-way through the very update in which the HP rotor
       reaches idle, and the fuel command in that same update is already the run
       one - so the transition belongs to `run`, which is exactly where the
       lever starts to apply. Read the other way round it looks as though the
       spool itself surged. */
    const spooling = eng.mode === 'start';
    if (spooling && eng.wf > 0.3 + 1e-9) leaded++;
    const sm = surgeMargin(eng.n2, eng.wf);
    worstSM = Math.min(worstSM, sm);
    if (spooling) worstDuringSpool = Math.min(worstDuringSpool, sm);
  }
  return { leaded, worstSM, worstDuringSpool, eng };
}

{
  const idle = coldStart(0);
  check('the fuel command carries no lead term during a start', idle.leaded === 0,
    `${idle.leaded} updates commanded more than the start value of 0.3`);
  check('a start with the lever at idle never surges', idle.worstSM > 0,
    `lowest margin ${idle.worstSM.toFixed(3)}`);

  /* THE FOURTH CONSTRAINT ON THE SM0 TABLE, and the reason it is spelled out
     here rather than left implicit. During the spool the fuel command is held
     at the start value of 0.3 while the reference temperature is still the idle
     one, so the margin is thin by construction - about two hundredths. Shave
     the low end of SM0 and every start begins to surge, with nothing in the
     edit to suggest why. */
  check('and the margin during the spool is thin but positive', idle.worstDuringSpool > 0,
    `lowest margin ${idle.worstDuringSpool.toFixed(3)} while spooling — SM0 cannot be lowered much`);

  const advanced = coldStart(0.85);
  check('but reaching idle with the lever left advanced does surge', advanced.worstSM < 0,
    `lowest margin ${advanced.worstSM.toFixed(3)} at 85 % — arriving at idle against an advanced lever is a slam`);
  check('and that happens at the end of the start, not during it',
    advanced.worstDuringSpool > 0,
    `${advanced.worstDuringSpool.toFixed(3)} while spooling against ${advanced.worstSM.toFixed(3)} overall`);
}

{
  // a fuel cut zeroes the command at once, whatever the lever is doing
  const eng = settle(1.0);
  eng.setMode('stop');
  eng.update(DT, 1.0);
  check('a fuel cut zeroes the command immediately', eng.wf === 0, `wf = ${eng.wf}`);
}

console.log(failures === 0 ? '\nAll checks passed.' : `\nFAILED checks: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
