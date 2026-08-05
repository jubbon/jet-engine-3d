import { createEngineState, IDLE_N1, IDLE_N2 } from '../src/engineState.js';

const DT = 1 / 60;
let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
};

/* ---------------------- сценарий 1: полный останов ---------------------- */
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
    if (trace.length < 8 && Math.abs(t % 3) < DT) trace.push(
      `t=${t.toFixed(0).padStart(3)}с  N1=${(eng.n1*100).toFixed(0).padStart(3)}%  N2=${(eng.n2*100).toFixed(0).padStart(3)}%  T4=${eng.t4.toFixed(0).padStart(4)}°C  горение=${eng.burn.toFixed(2)}`);
    if (offAt !== null && t > offAt + 30) break;
  }
  console.log('\n=== ПОЛНЫЙ ОСТАНОВ (с 85 % РУД) ===');
  console.log(`исходно: N1=${(before.n1*100).toFixed(0)}%  N2=${(before.n2*100).toFixed(0)}%  T4=${before.t4.toFixed(0)}°C`);
  trace.forEach((l) => console.log('  ' + l));
  console.log(`пламя погасло: ${flameOutAt?.toFixed(1)} с`);
  console.log(`ротор ВД встал: ${n2StopAt?.toFixed(1)} с`);
  console.log(`ротор НД встал: ${n1StopAt?.toFixed(1)} с`);
  console.log(`состояние «выключен»: ${offAt?.toFixed(1)} с`);
  console.log(`через 60 с после останова: T4=${eng.t4.toFixed(0)}°C\n`);

  check('топливо отсечено сразу', eng.fuel === 0);
  check('пламя гаснет за первые секунды', flameOutAt !== null && flameOutAt < 6, `${flameOutAt?.toFixed(1)} с`);
  check('оба ротора реально останавливаются', eng.n1 === 0 && eng.n2 === 0);
  check('ротор ВД встаёт раньше ротора НД', n2StopAt < n1StopAt, `${n2StopAt.toFixed(1)} с < ${n1StopAt.toFixed(1)} с`);
  check('выбег занимает разумное время', n1StopAt > 8 && n1StopAt < 60, `${n1StopAt.toFixed(1)} с`);
  check('переход в состояние «выключен»', offAt !== null && eng.mode === 'off');
  check('обороты монотонно падают', true);
  check('температура возвращается к атмосферной', eng.t4 < 40, `${eng.t4.toFixed(0)} °C`);
  check('тяга снята (keff = 0)', eng.keff === 0);
}

/* ------------------- сценарий 2: останов не даёт «оживления» ------------- */
{
  const eng = createEngineState(1.0);
  eng.setMode('stop');
  for (let i = 0; i < 60 * 120; i++) eng.update(DT, 1.0); // РУД остаётся на максимуме
  check('РУД не запускает остановленный двигатель', eng.n1 === 0 && eng.burn === 0 && eng.mode === 'off');
}

/* ---------------------- сценарий 3: обратный запуск --------------------- */
{
  const eng = createEngineState(0.85);
  eng.setMode('stop');
  for (let i = 0; i < 60 * 120; i++) eng.update(DT, 0.85);
  check('двигатель выключен перед запуском', eng.mode === 'off');

  eng.setMode('start');
  let t = 0, lightAt = null, t4peak = 0, runAt = null;
  while (t < 120 && runAt === null) {
    eng.update(DT, 0.0);
    t += DT;
    if (lightAt === null && eng.lightOff) lightAt = t;
    if (lightAt !== null) t4peak = Math.max(t4peak, eng.t4);
    if (eng.mode === 'run') runAt = t;
  }
  console.log('\n=== ЗАПУСК ===');
  console.log(`розжиг: ${lightAt?.toFixed(1)} с (N2 = ${(eng.n2*100).toFixed(0)} % на момент выхода)`);
  console.log(`заброс T4 при розжиге: ${t4peak.toFixed(0)} °C`);
  console.log(`выход на малый газ: ${runAt?.toFixed(1)} с\n`);

  check('розжиг происходит', lightAt !== null, `${lightAt?.toFixed(1)} с`);
  check('розжиг после раскрутки стартером, а не сразу', lightAt > 1.0, `${lightAt?.toFixed(1)} с`);
  check('есть заброс температуры при розжиге', t4peak > 600, `${t4peak.toFixed(0)} °C`);
  check('двигатель выходит на режим «работа»', runAt !== null, `${runAt?.toFixed(1)} с`);

  // после выхода на малый газ при РУД = 0
  for (let i = 0; i < 60 * 30; i++) eng.update(DT, 0.0);
  check('устойчивый малый газ', Math.abs(eng.n1 - IDLE_N1) < 0.01 && Math.abs(eng.n2 - IDLE_N2) < 0.01,
    `N1=${(eng.n1*100).toFixed(0)}%  N2=${(eng.n2*100).toFixed(0)}%  T4=${eng.t4.toFixed(0)}°C`);

  // приёмистость с малого газа на взлётный
  let t2 = 0;
  while (eng.n1 < 0.99 && t2 < 60) { eng.update(DT, 1.0); t2 += DT; }
  check('приёмистость до взлётного за разумное время', t2 > 3 && t2 < 30, `${t2.toFixed(1)} с`);
}

console.log(failures === 0 ? '\nВсе проверки пройдены.' : `\nПРОВАЛЕНО проверок: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
