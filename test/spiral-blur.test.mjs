import { spiralBlur, SPIRAL_GHOSTS } from '../src/engine.js';
import { createEngineState } from '../src/engineState.js';

/* ------------------------------------------------------------------ *
 *  Спираль на коке должна читаться на малом газе и полностью
 *  размазываться к взлётному режиму. Проверяем saму кривую смаза и
 *  то, что копии не расходятся дальше толщины спирали, - иначе вместо
 *  ровного кольца получатся отдельные полосы.
 * ------------------------------------------------------------------ */

const SPIRAL_WIDTH = 0.13; // должно совпадать с константой в engine.js
const DT = 1 / 60;
let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
};

console.log('\n=== СМАЗ СПИРАЛИ НА КОКЕ ===');

/* --------------------------- крайние точки --------------------------- */
{
  const stopped = spiralBlur(0);
  check(
    'на стоянке спираль резкая и непрозрачная',
    stopped.ghosts === 1 && stopped.opacity === 1 && stopped.spread === 0
  );

  const takeoff = spiralBlur(1);
  check(
    'на взлётном режиме спираль заметает полный круг',
    takeoff.spread >= Math.PI * 2 - 1e-9,
    `${takeoff.spread.toFixed(2)} рад`
  );
  check(
    'на взлётном режиме её практически не видно',
    takeoff.opacity < 0.03,
    `прозрачность ${takeoff.opacity.toFixed(3)}`
  );
  check('копий не больше заявленного максимума', takeoff.ghosts === SPIRAL_GHOSTS);
}

/* ------------------- монотонность и отсутствие полос ------------------ */
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

  check('с ростом режима спираль только размазывается, без скачков назад', monotone);
  check(
    'копии нигде не расходятся дальше толщины спирали',
    gapless,
    `худший шаг ${worstStep.toFixed(3)} при толщине ${SPIRAL_WIDTH}`
  );
}

/* ----------------- поведение на настоящих режимах -------------------- */
{
  const eng = createEngineState(0);
  eng.setMode('off');
  eng.n1 = 0;
  eng.n2 = 0;
  eng.burn = 0;
  eng.fuel = 0;
  const stopped = spiralBlur(eng.update(DT, 0));
  check('на выключенном двигателе спираль резкая', stopped.opacity === 1);

  // малый газ
  const idle = createEngineState(0);
  for (let i = 0; i < 60 * 40; i++) idle.update(DT, 0);
  const atIdle = spiralBlur(idle.keff);
  console.log(`  малый газ: N1=${(idle.n1 * 100).toFixed(0)} %, keff=${idle.keff.toFixed(2)}, прозрачность ${atIdle.opacity.toFixed(2)}`);
  check('на малом газе спираль ещё читается', atIdle.opacity > 0.9, atIdle.opacity.toFixed(2));

  // взлётный режим
  const max = createEngineState(1);
  for (let i = 0; i < 60 * 40; i++) max.update(DT, 1);
  const atMax = spiralBlur(max.keff);
  console.log(`  взлётный: N1=${(max.n1 * 100).toFixed(0)} %, keff=${max.keff.toFixed(2)}, прозрачность ${atMax.opacity.toFixed(3)}`);
  check('на взлётном режиме спираль пропадает', atMax.opacity < 0.03, atMax.opacity.toFixed(3));

  // и снова появляется на выбеге
  max.setMode('stop');
  let t = 0;
  let backAt = null;
  while (t < 200) {
    max.update(DT, 1);
    t += DT;
    if (backAt === null && spiralBlur(max.keff).opacity === 1) backAt = t;
    if (backAt !== null) break;
  }
  console.log(`  на выбеге спираль снова резкая через ${backAt?.toFixed(1)} с`);
  check('на выбеге спираль возвращается', backAt !== null, `${backAt?.toFixed(1)} с`);
}

console.log(failures ? `\n${failures} проверок провалено\n` : '\nвсе проверки пройдены\n');
process.exit(failures ? 1 : 0);
