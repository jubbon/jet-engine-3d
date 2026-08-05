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
export const LIGHT_DELAY = 2.5; // от подачи топлива до появления пламени, с

/**
 * Постоянные времени, с. Разные для разных этапов, потому что разгон ротора
 * определяется избытком момента, а он на этапах разный:
 *
 *  - раскрутка стартером: воздушный стартер даёт небольшой избыточный момент,
 *    да ещё и падающий с оборотами, - самый медленный этап;
 *  - разгон до малого газа: турбина только начала работать, избыток момента
 *    мал, двигатель докручивает себя неспешно;
 *  - рабочие режимы: избыток момента велик, отсюда быстрая приёмистость;
 *  - выбег: момента нет вовсе, роторы тормозятся прокачкой воздуха и трением.
 */
const TAU = {
  crank1: 12.0, // раскрутка стартером
  crank2: 12.5,
  accel1: 10.0, // от розжига до малого газа
  accel2: 7.4,
  up1: 2.6, // приёмистость на рабочих режимах
  up2: 2.0,
  down1: 1.9, // сброс режима
  down2: 1.4,
  coast1: 9.3, // выбег после отсечки топлива
  coast2: 5.9,
};

// трение в опорах: постоянное угловое замедление, доводит роторы до нуля
const FRICTION_N1 = 0.0022;
const FRICTION_N2 = 0.0035;

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
    lightOff: true, // произошёл ли розжиг: приложение стартует с работающим
    ignition: 0, // время от подачи топлива до розжига, с

    setMode(mode) {
      eng.mode = mode;
      if (mode === 'start') {
        eng.fuel = 0; // топливо подаётся только после раскрутки стартером
        eng.lightOff = false;
        eng.ignition = 0;
      }
      if (mode === 'stop') eng.fuel = 0; // стоп-кран: отсечка топлива
    },

    /** @param {number} dt секунды @param {number} throttle 0..1 */
    update(dt, throttle) {
      let t1 = 0;
      let t2 = 0;

      switch (eng.mode) {
        case 'start':
          if (!eng.lightOff) {
            // стартер крутит только ротор ВД, ротор НД подхватывается потоком
            t2 = START_N2;
            t1 = eng.n2 * 0.16;
            if (!eng.fuel) {
              if (eng.n2 > LIGHT_N2) eng.fuel = 1; // подача топлива, свечи включены
            } else {
              // топливо в камере есть, но пламя устанавливается не мгновенно
              eng.ignition += dt;
              if (eng.ignition >= LIGHT_DELAY) {
                eng.lightOff = true;
                eng.burn = 0.45; // вспышка розжига
              }
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
      const cranking = eng.mode === 'start' && !eng.lightOff; // стартер ещё крутит
      const spoolingUp = eng.mode === 'start'; // после розжига, до малого газа
      // ротор НД тяжелее и во всех режимах отзывается медленнее ротора ВД
      const tau1 = coasting ? TAU.coast1
        : cranking ? TAU.crank1
        : spoolingUp ? TAU.accel1
        : t1 > eng.n1 ? TAU.up1 : TAU.down1;
      const tau2 = coasting ? TAU.coast2
        : cranking ? TAU.crank2
        : spoolingUp ? TAU.accel2
        : t2 > eng.n2 ? TAU.up2 : TAU.down2;
      eng.n1 += (t1 - eng.n1) * (1 - Math.exp(-dt / tau1));
      eng.n2 += (t2 - eng.n2) * (1 - Math.exp(-dt / tau2));
      if (coasting) {
        // трение в опорах: снимает «хвост» экспоненты и доводит роторы до нуля
        eng.n1 = Math.max(0, eng.n1 - dt * FRICTION_N1);
        eng.n2 = Math.max(0, eng.n2 - dt * FRICTION_N2);
      }

      // горение: гаснет быстро, разгорается плавно.
      // При запуске расход воздуха ещё мал, смесь богатая - отсюда заброс
      // температуры, который спадает по мере раскрутки до малого газа.
      eng.keff = clamp((eng.n1 - IDLE_N1) / (1 - IDLE_N1), 0, 1);
      // пока топливо подано, но розжиг не произошёл, пламени нет и тракт холодный
      const burning = eng.fuel && eng.lightOff;
      const burnTarget = !burning ? 0 : eng.mode === 'start' ? 0.3 : 0.1 + 0.9 * eng.keff;
      const tauB = burnTarget > eng.burn ? 0.7 : 0.35;
      eng.burn += (burnTarget - eng.burn) * (1 - Math.exp(-dt / tauB));
      if (!burning && eng.burn < 0.004) eng.burn = 0;

      // температура газа: растёт быстро, остывает медленно, поэтому короткий
      // всплеск горения при розжиге даёт заметный заброс T4
      const t4Target = burning ? 350 + 1450 * eng.burn : 15;
      const tauT = !burning ? 7.0 : t4Target > eng.t4 ? 0.6 : 2.2;
      eng.t4 += (t4Target - eng.t4) * (1 - Math.exp(-dt / tauT));

      return eng.keff;
    },
  };

  return eng;
}
