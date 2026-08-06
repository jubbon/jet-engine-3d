import { createEngineState } from '../src/engineState.js';
import { hazePower } from '../src/heathaze.js';

/* ------------------------------------------------------------------ *
 *  The jet heat haze must live together with the engine: on a cold
 *  engine the pass does not run at all, at take-off power the
 *  distortion is at its maximum, and after shutdown it must fall to
 *  zero.
 * ------------------------------------------------------------------ */

const DT = 1 / 60;
let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
};

console.log('\n=== JET HEAT HAZE ===');

/* ---------------------------- boundary values ------------------------- */
check('a cold engine does not distort the frame', hazePower(0, 0) === 0);
check('distortion never exceeds 1.15', hazePower(1, 1) <= 1.15, hazePower(1, 1).toFixed(3));
check(
  'idle is markedly weaker than take-off',
  hazePower(0.1, 0.18) < hazePower(1, 1) * 0.3,
  `${hazePower(0.1, 0.18).toFixed(3)} against ${hazePower(1, 1).toFixed(3)}`
);
check(
  'combustion matters more than rotor speed',
  hazePower(0.5, 0) > hazePower(0, 0.5),
  `${hazePower(0.5, 0).toFixed(3)} against ${hazePower(0, 0.5).toFixed(3)}`
);

/* ---------------- start: the distortion grows from zero --------------- */
{
  const eng = createEngineState(0);
  eng.setMode('off');
  eng.n1 = 0;
  eng.n2 = 0;
  eng.burn = 0;
  eng.fuel = 0;
  eng.update(DT, 0);
  check('a shut-down engine produces no distortion', hazePower(eng.burn, eng.n1) === 0);

  eng.setMode('start');
  let t = 0;
  let peak = 0;
  let firstAt = null;
  while (t < 90 && eng.mode !== 'run') {
    eng.update(DT, 0.85);
    t += DT;
    const p = hazePower(eng.burn, eng.n1);
    if (firstAt === null && p > 0.05) firstAt = t;
    peak = Math.max(peak, p);
  }
  console.log(`  start: distortion appeared at ${firstAt?.toFixed(1)} s, idle reached at ${t.toFixed(1)} s`);
  check('during start the distortion appears after light-off', firstAt !== null && firstAt > 1, `${firstAt?.toFixed(1)} s`);
  check('at idle the distortion is weak', hazePower(eng.burn, eng.n1) < 0.35, hazePower(eng.burn, eng.n1).toFixed(3));
}

/* ----------------- take-off power and full shutdown ------------------- */
{
  const eng = createEngineState(1.0);
  for (let i = 0; i < 60 * 30; i++) eng.update(DT, 1.0);
  const takeoff = hazePower(eng.burn, eng.n1);
  console.log(`  take-off power: N1=${(eng.n1 * 100).toFixed(0)} %, burn=${eng.burn.toFixed(2)}, distortion=${takeoff.toFixed(3)}`);
  check('at take-off power the distortion is near maximum', takeoff > 0.9, takeoff.toFixed(3));

  eng.setMode('stop');
  let t = 0;
  let zeroAt = null;
  while (t < 400) {
    eng.update(DT, 1.0);
    t += DT;
    if (zeroAt === null && hazePower(eng.burn, eng.n1) === 0) zeroAt = t;
    if (zeroAt !== null) break;
  }
  console.log(`  after shutdown the distortion reached zero at ${zeroAt?.toFixed(1)} s`);
  check('after shutdown the distortion falls to zero', zeroAt !== null, `${zeroAt?.toFixed(1)} s`);
  check('distortion outlives the flame (hot gas is still flowing)', zeroAt !== null && zeroAt > 6, `${zeroAt?.toFixed(1)} s`);
}

console.log(failures ? `\n${failures} checks failed\n` : '\nall checks passed\n');
process.exit(failures ? 1 : 0);
