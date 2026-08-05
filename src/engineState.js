/* ------------------------------------------------------------------ *
 *  Состояние двигателя: запуск, работа, останов, выбег роторов.
 *  Модуль не знает ни про Three.js, ни про DOM - только физика режимов,
 *  поэтому его можно прогнать в Node и проверить числами.
 *
 *  off   - выключен, роторы неподвижны
 *  start - раскрутка стартером, розжиг, выход на малый газ
 *  run   - работа, обороты задаются РУД
 *  stop  - топливо отсечено, роторы на выбеге
 * ------------------------------------------------------------------ */

export const IDLE_N1 = 0.18; // малый газ, доля от максимальных оборотов
export const IDLE_N2 = 0.56;
export const START_N2 = 0.3; // до каких оборотов ВД раскручивает стартер
export const LIGHT_N2 = 0.22; // обороты подачи топлива и розжига

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createEngineState(initialThrottle = 0.85) {
  const eng = {
    mode: 'run',
    n1: IDLE_N1 + (1 - IDLE_N1) * initialThrottle, // обороты, доли от максимума
    n2: IDLE_N2 + (1 - IDLE_N2) * initialThrottle,
    fuel: 1, // подача топлива
    burn: initialThrottle, // интенсивность горения
    t4: 350 + 1450 * initialThrottle, // температура газа перед турбиной, °C
    keff: initialThrottle, // приведённый режим по оборотам НД
    lightOff: false, // произошёл ли розжиг в текущем запуске

    setMode(mode) {
      eng.mode = mode;
      if (mode === 'start') {
        eng.fuel = 0; // топливо подаётся только после раскрутки стартером
        eng.lightOff = false;
      }
      if (mode === 'stop') eng.fuel = 0; // стоп-кран: отсечка топлива
    },

    /** @param {number} dt секунды @param {number} throttle 0..1 */
    update(dt, throttle) {
      let t1 = 0;
      let t2 = 0;

      switch (eng.mode) {
        case 'start':
          if (!eng.fuel) {
            // стартер крутит только ротор ВД, ротор НД подхватывается потоком
            t2 = START_N2;
            t1 = eng.n2 * 0.16;
            if (eng.n2 > LIGHT_N2) {
              eng.fuel = 1;
              eng.lightOff = true;
              eng.burn = 0.45; // вспышка розжига
            }
          } else {
            t1 = IDLE_N1;
            t2 = IDLE_N2;
            if (eng.n2 > IDLE_N2 - 0.02) eng.mode = 'run';
          }
          break;
        case 'run':
          t1 = IDLE_N1 + (1 - IDLE_N1) * throttle;
          t2 = IDLE_N2 + (1 - IDLE_N2) * throttle;
          break;
        case 'stop':
          if (eng.n1 <= 0 && eng.n2 <= 0) eng.mode = 'off';
          break;
        default: // off
          break;
      }

      const coasting = eng.mode === 'stop' || eng.mode === 'off';
      // выбег: ротор НД тяжелее и тормозится дольше, ротор ВД встаёт раньше
      const tau1 = coasting ? 4.0 : t1 > eng.n1 ? 2.6 : 1.9;
      const tau2 = coasting ? 2.6 : t2 > eng.n2 ? 2.0 : 1.4;
      eng.n1 += (t1 - eng.n1) * (1 - Math.exp(-dt / tau1));
      eng.n2 += (t2 - eng.n2) * (1 - Math.exp(-dt / tau2));
      if (coasting) {
        // трение в опорах: снимает «хвост» экспоненты и доводит роторы до нуля
        eng.n1 = Math.max(0, eng.n1 - dt * 0.006);
        eng.n2 = Math.max(0, eng.n2 - dt * 0.01);
      }

      // горение: гаснет быстро, разгорается плавно.
      // При запуске расход воздуха ещё мал, смесь богатая - отсюда заброс
      // температуры, который спадает по мере раскрутки до малого газа.
      eng.keff = clamp((eng.n1 - IDLE_N1) / (1 - IDLE_N1), 0, 1);
      const burnTarget = !eng.fuel ? 0 : eng.mode === 'start' ? 0.3 : 0.1 + 0.9 * eng.keff;
      const tauB = burnTarget > eng.burn ? 0.7 : 0.35;
      eng.burn += (burnTarget - eng.burn) * (1 - Math.exp(-dt / tauB));
      if (!eng.fuel && eng.burn < 0.004) eng.burn = 0;

      // температура газа: растёт быстро, остывает медленно, поэтому короткий
      // всплеск горения при розжиге даёт заметный заброс T4
      const t4Target = eng.fuel ? 350 + 1450 * eng.burn : 15;
      const tauT = !eng.fuel ? 7.0 : t4Target > eng.t4 ? 0.6 : 2.2;
      eng.t4 += (t4Target - eng.t4) * (1 - Math.exp(-dt / tauT));

      return eng.keff;
    },
  };

  return eng;
}
