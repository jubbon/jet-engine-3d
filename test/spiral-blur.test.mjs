import { spiralBlur, SPIRAL_GHOSTS } from '../src/engine.js';
import { createEngineState } from '../src/engineState.js';

/* ------------------------------------------------------------------ *
 *  The spinner spiral must read clearly at idle and smear away
 *  completely by take-off power. We check the smear curve itself and
 *  that the copies never spread further apart than the thickness of the
 *  spiral - otherwise separate stripes appear instead of an even ring.
 * ------------------------------------------------------------------ */

const SPIRAL_WIDTH = 0.13; // must match the constant in engine.js
const DT = 1 / 60;
let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
};

console.log('\n=== SPINNER SPIRAL SMEAR ===');

/* ---------------------------- extreme points -------------------------- */
{
  const stopped = spiralBlur(0);
  check(
    'at rest the spiral is sharp and opaque',
    stopped.ghosts === 1 && stopped.opacity === 1 && stopped.spread === 0
  );

  const takeoff = spiralBlur(1);
  check(
    'at take-off power the spiral sweeps a full circle',
    takeoff.spread >= Math.PI * 2 - 1e-9,
    `${takeoff.spread.toFixed(2)} rad`
  );
  check(
    'at take-off power it is practically invisible',
    takeoff.opacity < 0.03,
    `opacity ${takeoff.opacity.toFixed(3)}`
  );
  check('no more copies than the declared maximum', takeoff.ghosts === SPIRAL_GHOSTS);
}

/* ------------------ monotonicity and absence of stripes --------------- */
{
  let monotone = true;
  let gapless = true;
  let worstStep = 0;
  let prevOpacity = Infinity;
  let prevSpread = -1;

  for (let i = 0; i <= 200; i++) {
    const { ghosts, spread, opacity } = spiralBlur(i / 200);
    if (opacity > prevOpacity + 1e-9 || spread < prevSpread - 1e-9) monotone = false;
    prevOpacity = opacity;
    prevSpread = spread;
    if (ghosts > 1) {
      const step = spread / (ghosts - 1);
      worstStep = Math.max(worstStep, step);
      if (step > SPIRAL_WIDTH * 1.05) gapless = false;
    }
  }

  check('with rising power the spiral only smears, never jumps back', monotone);
  check(
    'copies never spread further apart than the spiral thickness',
    gapless,
    `worst step ${worstStep.toFixed(3)} against a thickness of ${SPIRAL_WIDTH}`
  );
}

/* ------------------- behaviour at real engine regimes ----------------- */
{
  const eng = createEngineState(0);
  eng.setMode('off');
  eng.n1 = 0;
  eng.n2 = 0;
  eng.burn = 0;
  eng.fuel = 0;
  const stopped = spiralBlur(eng.update(DT, 0));
  check('on a shut-down engine the spiral is sharp', stopped.opacity === 1);

  // idle
  const idle = createEngineState(0);
  for (let i = 0; i < 60 * 40; i++) idle.update(DT, 0);
  const atIdle = spiralBlur(idle.keff);
  console.log(`  idle: N1=${(idle.n1 * 100).toFixed(0)} %, keff=${idle.keff.toFixed(2)}, opacity ${atIdle.opacity.toFixed(2)}`);
  check('at idle the spiral still reads', atIdle.opacity > 0.9, atIdle.opacity.toFixed(2));

  // take-off power
  const max = createEngineState(1);
  for (let i = 0; i < 60 * 40; i++) max.update(DT, 1);
  const atMax = spiralBlur(max.keff);
  console.log(`  take-off: N1=${(max.n1 * 100).toFixed(0)} %, keff=${max.keff.toFixed(2)}, opacity ${atMax.opacity.toFixed(3)}`);
  check('at take-off power the spiral disappears', atMax.opacity < 0.03, atMax.opacity.toFixed(3));

  // and comes back during rundown
  max.setMode('stop');
  let t = 0;
  let backAt = null;
  while (t < 200) {
    max.update(DT, 1);
    t += DT;
    if (backAt === null && spiralBlur(max.keff).opacity === 1) backAt = t;
    if (backAt !== null) break;
  }
  console.log(`  during rundown the spiral is sharp again after ${backAt?.toFixed(1)} s`);
  check('the spiral returns during rundown', backAt !== null, `${backAt?.toFixed(1)} s`);
}

console.log(failures ? `\n${failures} checks failed\n` : '\nall checks passed\n');
process.exit(failures ? 1 : 0);
