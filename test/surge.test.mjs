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
} from '../src/surge.js';
import { IDLE_N2 } from '../src/engineState.js';

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

console.log(failures === 0 ? '\nAll checks passed.' : `\nFAILED checks: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
