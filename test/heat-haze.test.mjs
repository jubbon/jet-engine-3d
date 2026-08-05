import { createEngineState } from '../src/engineState.js';
import { hazePower } from '../src/heathaze.js';

/* ------------------------------------------------------------------ *
 *  Тепловое искажение струи должно жить вместе с двигателем:
 *  на холодном двигателе прохода нет вообще, на взлётном режиме
 *  искажение максимально, после останова оно обязано уйти в ноль.
 * ------------------------------------------------------------------ */

const DT = 1 / 60;
let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
};

console.log('\n=== ТЕПЛОВОЕ ИСКАЖЕНИЕ СТРУИ ===');

/* ------------------------- граничные значения ------------------------- */
check('холодный двигатель не искажает кадр', hazePower(0, 0) === 0);
check('искажение не выходит за 1.15', hazePower(1, 1) <= 1.15, hazePower(1, 1).toFixed(3));
check(
  'малый газ заметно слабее взлётного',
  hazePower(0.1, 0.18) < hazePower(1, 1) * 0.3,
  `${hazePower(0.1, 0.18).toFixed(3)} против ${hazePower(1, 1).toFixed(3)}`
);
check(
  'горение важнее оборотов',
  hazePower(0.5, 0) > hazePower(0, 0.5),
  `${hazePower(0.5, 0).toFixed(3)} против ${hazePower(0, 0.5).toFixed(3)}`
);

/* ------------------- запуск: искажение растёт с нуля ------------------- */
{
  const eng = createEngineState(0);
  eng.setMode('off');
  eng.n1 = 0;
  eng.n2 = 0;
  eng.burn = 0;
  eng.fuel = 0;
  eng.update(DT, 0);
  check('на выключенном двигателе искажения нет', hazePower(eng.burn, eng.n1) === 0);

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
  console.log(`  запуск: искажение появилось на ${firstAt?.toFixed(1)} с, малый газ достигнут на ${t.toFixed(1)} с`);
  check('при запуске искажение появляется после розжига', firstAt !== null && firstAt > 1, `${firstAt?.toFixed(1)} с`);
  check('на малом газе искажение слабое', hazePower(eng.burn, eng.n1) < 0.35, hazePower(eng.burn, eng.n1).toFixed(3));
}

/* ------------------- взлётный режим и полный останов ------------------- */
{
  const eng = createEngineState(1.0);
  for (let i = 0; i < 60 * 30; i++) eng.update(DT, 1.0);
  const takeoff = hazePower(eng.burn, eng.n1);
  console.log(`  взлётный режим: N1=${(eng.n1 * 100).toFixed(0)} %, горение=${eng.burn.toFixed(2)}, искажение=${takeoff.toFixed(3)}`);
  check('на взлётном режиме искажение почти максимально', takeoff > 0.9, takeoff.toFixed(3));

  eng.setMode('stop');
  let t = 0;
  let zeroAt = null;
  while (t < 400) {
    eng.update(DT, 1.0);
    t += DT;
    if (zeroAt === null && hazePower(eng.burn, eng.n1) === 0) zeroAt = t;
    if (zeroAt !== null) break;
  }
  console.log(`  после останова искажение обнулилось на ${zeroAt?.toFixed(1)} с`);
  check('после останова искажение уходит в ноль', zeroAt !== null, `${zeroAt?.toFixed(1)} с`);
  check('искажение переживает пламя (горячая струя ещё идёт)', zeroAt !== null && zeroAt > 6, `${zeroAt?.toFixed(1)} с`);
}

console.log(failures ? `\n${failures} проверок провалено\n` : '\nвсе проверки пройдены\n');
process.exit(failures ? 1 : 0);
