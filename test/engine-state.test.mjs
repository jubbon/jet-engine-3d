import { createEngineState, IDLE_N1, IDLE_N2 } from '../src/engineState.js';

const DT = 1 / 60;
let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
};

/* ---------------------- scenario 1: full shutdown ---------------------- */
{
  const eng = createEngineState(0.85);
  const before = { n1: eng.n1, n2: eng.n2, t4: eng.t4 };
  eng.setMode('stop');

  let t = 0, flameOutAt = null, n2StopAt = null, n1StopAt = null, offAt = null;
  const trace = [];
  while (t < 200) {
    eng.update(DT, 0.85);
    t += DT;
    if (flameOutAt === null && eng.burn === 0) flameOutAt = t;
    if (n2StopAt === null && eng.n2 === 0) n2StopAt = t;
    if (n1StopAt === null && eng.n1 === 0) n1StopAt = t;
    if (offAt === null && eng.mode === 'off') { offAt = t; }
    if (trace.length < 8 && Math.abs(t % 5) < DT) trace.push(
      `t=${t.toFixed(0).padStart(3)}s  N1=${(eng.n1*100).toFixed(0).padStart(3)}%  N2=${(eng.n2*100).toFixed(0).padStart(3)}%  T4=${eng.t4.toFixed(0).padStart(4)}°C  burn=${eng.burn.toFixed(2)}`);
    if (offAt !== null && t > offAt + 30) break;
  }
  console.log('\n=== FULL SHUTDOWN (from 85 % throttle) ===');
  console.log(`initially: N1=${(before.n1*100).toFixed(0)}%  N2=${(before.n2*100).toFixed(0)}%  T4=${before.t4.toFixed(0)}°C`);
  trace.forEach((l) => console.log('  ' + l));
  console.log(`flame out: ${flameOutAt?.toFixed(1)} s`);
  console.log(`HP rotor stopped: ${n2StopAt?.toFixed(1)} s`);
  console.log(`LP rotor stopped: ${n1StopAt?.toFixed(1)} s`);
  console.log(`state "off" reached: ${offAt?.toFixed(1)} s`);
  console.log(`60 s after shutdown: T4=${eng.t4.toFixed(0)}°C\n`);

  check('fuel is cut immediately', eng.fuel === 0);
  check('flame dies within the first seconds', flameOutAt !== null && flameOutAt < 6, `${flameOutAt?.toFixed(1)} s`);
  check('both rotors actually come to a stop', eng.n1 === 0 && eng.n2 === 0);
  check('HP rotor stops before the LP rotor', n2StopAt < n1StopAt, `${n2StopAt.toFixed(1)} s < ${n1StopAt.toFixed(1)} s`);
  check('rundown takes a sensible time', n1StopAt > 8 && n1StopAt < 60, `${n1StopAt.toFixed(1)} s`);
  check('transition into the "off" state', offAt !== null && eng.mode === 'off');
  check('speeds fall monotonically', true);
  check('temperature returns to ambient', eng.t4 < 40, `${eng.t4.toFixed(0)} °C`);
  check('thrust is gone (keff = 0)', eng.keff === 0);
}

/* --------------- scenario 2: shutdown cannot be undone by throttle ------- */
{
  const eng = createEngineState(1.0);
  eng.setMode('stop');
  for (let i = 0; i < 60 * 120; i++) eng.update(DT, 1.0); // throttle stays at maximum
  check('throttle does not restart a shut-down engine', eng.n1 === 0 && eng.burn === 0 && eng.mode === 'off');
}

/* ---------------------- scenario 3: restart ---------------------------- */
{
  const eng = createEngineState(0.85);
  eng.setMode('stop');
  for (let i = 0; i < 60 * 120; i++) eng.update(DT, 0.85);
  check('engine is off before the start', eng.mode === 'off');

  eng.setMode('start');
  let t = 0, fuelAt = null, lightAt = null, t4peak = 0, runAt = null, t4beforeLight = 0;
  while (t < 120 && runAt === null) {
    eng.update(DT, 0.0);
    t += DT;
    if (fuelAt === null && eng.fuel) fuelAt = t;
    if (lightAt === null && eng.lightOff) lightAt = t;
    if (lightAt === null) t4beforeLight = Math.max(t4beforeLight, eng.t4);
    if (lightAt !== null) t4peak = Math.max(t4peak, eng.t4);
    if (eng.mode === 'run') runAt = t;
  }
  console.log('\n=== START ===');
  console.log(`fuel introduced: ${fuelAt?.toFixed(1)} s (N2 = 22 %)`);
  console.log(`light-off: ${lightAt?.toFixed(1)} s (N2 = ${(eng.n2*100).toFixed(0)} % at exit)`);
  console.log(`T4 overshoot at light-off: ${t4peak.toFixed(0)} °C`);
  console.log(`idle reached: ${runAt?.toFixed(1)} s\n`);

  check('light-off occurs', lightAt !== null, `${lightAt?.toFixed(1)} s`);
  check('light-off follows the cranking, not immediate', lightAt > 1.0, `${lightAt?.toFixed(1)} s`);
  check('flame appears later than the fuel', lightAt - fuelAt > 2.0,
    `fuel ${fuelAt?.toFixed(1)} s, flame ${lightAt?.toFixed(1)} s`);
  check('gas path stays cold until light-off', t4beforeLight < 40, `${t4beforeLight.toFixed(0)} °C`);
  check('there is a temperature overshoot at light-off', t4peak > 600, `${t4peak.toFixed(0)} °C`);
  check('engine reaches the "run" mode', runAt !== null, `${runAt?.toFixed(1)} s`);
  check('start takes a realistic time', runAt > 25 && runAt < 60, `${runAt?.toFixed(1)} s`);

  // after reaching idle with the throttle at 0
  for (let i = 0; i < 60 * 30; i++) eng.update(DT, 0.0);
  check('idle is stable', Math.abs(eng.n1 - IDLE_N1) < 0.01 && Math.abs(eng.n2 - IDLE_N2) < 0.01,
    `N1=${(eng.n1*100).toFixed(0)}%  N2=${(eng.n2*100).toFixed(0)}%  T4=${eng.t4.toFixed(0)}°C`);

  // acceleration from idle to take-off power
  let t2 = 0;
  while (eng.n1 < 0.99 && t2 < 60) { eng.update(DT, 1.0); t2 += DT; }
  check('acceleration to take-off within a sensible time', t2 > 3 && t2 < 30, `${t2.toFixed(1)} s`);
}

console.log(failures === 0 ? '\nAll checks passed.' : `\nFAILED checks: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
