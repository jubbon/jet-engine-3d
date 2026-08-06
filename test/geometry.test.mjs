import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { buildEngine, ST } from '../src/engine.js';

/* ------------------------------------------------------------------ *
 *  Габариты модели должны совпадать со справочником по прототипу -
 *  docs/engines/cfm56-7b-nacelle.json. Значения оттуда берутся прямо
 *  из файла, а не переписываются в тест: если справочник поправят,
 *  разойдётся именно тест, а не молча модель.
 *
 *  Допуски - те же, что заявлены в справочнике: ±0.15 м на обмер
 *  чертежа ACAP, ±0.2…0.3 м на значения с confidence = derived_low.
 * ------------------------------------------------------------------ */

const spec = JSON.parse(
  readFileSync(new URL('../docs/engines/cfm56-7b-nacelle.json', import.meta.url), 'utf8')
);
const nod = spec.nacelle_overall_dimensions;
const erd = spec.engine_reference_data;

const U = 0.5; // метров в одной условной единице
const m = (ue) => ue * U; // условные единицы -> метры
const station = (x) => (x - ST.lip) * U; // метров от кромки воздухозаборника

let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
};
const near = (name, got, want, tol, unit = 'м') =>
  check(
    name,
    Math.abs(got - want) <= tol,
    `модель ${got.toFixed(3)}, справочник ${want.toFixed(3)} ±${tol} ${unit}`
  );

const engine = buildEngine();

// Габарит группы по её собственной геометрии: сплющенный низ гондолы
// учитывается только так - профиль lathe о нём ничего не знает.
function bbox(obj, skip = []) {
  const box = new THREE.Box3();
  obj.updateWorldMatrix(true, true);
  obj.traverse((o) => {
    if (!o.isMesh || !o.geometry || o.material?.visible === false) return;
    if (skip.includes(o.name)) return;
    o.geometry.computeBoundingBox();
    box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
  });
  return box;
}

console.log('\n=== ГАБАРИТЫ МОТОГОНДОЛЫ ===');

// Только обшивка: обтекатель пилона к габаритам гондолы не относится.
const nac = bbox(engine.parts.mNac, ['pylon']);
near('Наибольшая ширина', m(nac.max.z - nac.min.z), nod.max_width.value, 0.15);

// Высота: гондола без обтекателя пилона. Обмер по чертежу дал 2.40 м «снизу»,
// потому что верх перекрыт крылом и пилоном, - оттого и допуск ±0.2 м.
const bellyCut = m(2 * ST.nacelleR) - m(nac.max.y - nac.min.y);
near('Высота по обшивке', m(nac.max.y - nac.min.y), nod.max_height.value, 0.2);
near(
  'Ширина плоского низа',
  m(2 * Math.sqrt(ST.nacelleR ** 2 - (ST.nacelleR - bellyCut / U) ** 2)),
  nod.flat_bottom_width.value,
  0.2
);

near('Кромка → срез сопла нар. контура', station(ST.bypassExit), nod.length_lip_to_fan_nozzle_exit.value, 0.15);
near('Кромка → срез сопла вн. контура', station(ST.coreExit), nod.length_lip_to_core_nozzle_exit.value, 0.15);
near('Кромка → конец центрального тела', station(ST.plugTip), nod.length_lip_to_plug_tip.value, 0.3);
near('Удлинение гондолы', station(ST.coreExit) / nod.max_width.value, nod.fineness_ratio.value, 0.05, '—');

// «выступает за срез сопла внутреннего контура примерно на 0.9-1.0 м»
const plugOut = station(ST.plugTip) - station(ST.coreExit);
check('Вылет кока сопла за срез', plugOut >= 0.9 && plugOut <= 1.0, `${plugOut.toFixed(2)} м, надо 0.9…1.0`);

console.log('\n=== ГАБАРИТЫ ДВИГАТЕЛЯ ===');

near('Диаметр вентилятора', m(2 * ST.fanTip), erd.fan_diameter.value, 0.005);
near('Длина по фланцам (A1 → задняя опора)', m(ST.frame - ST.a1), erd.bare_engine_overall_length.value, 0.02);
near('Высота (корпус вентилятора)', m(2 * ST.caseR), erd.bare_engine_height.value, 0.02);
near('Ширина (по коробке приводов)', m(2 * ST.accR), erd.bare_engine_width.value, 0.02);

// Число лопаток вентилятора: от него зависит частота следования лопаток в звуке.
let fanRows = 0;
engine.parts.mFan.traverse((o) => {
  if (o.isInstancedMesh && o.count === erd.fan_blades.value) fanRows++;
});
check('Лопаток вентилятора', fanRows === 1, `венцов по ${erd.fan_blades.value} лопаток: ${fanRows}`);

console.log('\n=== ГЛУБИНА ВОЗДУХОЗАБОРНИКА ===');

/* Отношение длины входа к диаметру вентилятора. У классической гондолы оно
   около 0.5; патенты на «короткий воздухозаборник» задают 0.20…0.45 и там же
   называют 0.5 как исходную величину, от которой уходят. Длина меряется от
   самой передней точки гондолы до передней кромки КОНЦА лопатки - ровно то,
   что видит глаз, если смотреть двигателю в лицо.

   Проверка нужна потому, что этот размер ничем не задан напрямую: он
   получается вычитанием из длины гондолы длины двигателя и сопла. Ошибись в
   сопле на 0.3 м - и все габариты справочника по-прежнему сойдутся, а
   вентилятор провалится вглубь канала. Так и случилось: сначала вышло 0.88,
   потом 0.63, и оба раза заметно было только на картинке. */
let fanRow = null;
engine.parts.mFan.traverse((o) => {
  if (o.isInstancedMesh && o.count === erd.fan_blades.value) fanRow = o;
});
const bp = fanRow.geometry.attributes.position;
let tipR = 0;
for (let i = 0; i < bp.count; i++) tipR = Math.max(tipR, Math.hypot(bp.getY(i), bp.getZ(i)));
let tipLE = Infinity;
for (let i = 0; i < bp.count; i++) {
  if (Math.hypot(bp.getY(i), bp.getZ(i)) > tipR - 0.05) tipLE = Math.min(tipLE, bp.getX(i));
}
near('Длина входа / диаметр вентилятора', m(tipLE - ST.lip) / erd.fan_diameter.value, 0.5, 0.06, '—');

console.log('\n=== ЧИСЛО СТУПЕНЕЙ ===');

/* Компоновка CFM56-7B: 3 подпорные ступени, 9 ступеней КВД, 1 ступень ТВД,
   4 ступени ТНД. У каждой ступени в модели два венца - рабочее колесо и
   аппарат (направляющий в компрессоре, сопловой в турбине), поэтому венцов
   вдвое больше. Считаем именно венцы: так тест ловит и лишний аппарат. */
const STAGES = [
  ['Подпорные ступени (КНД)', engine.parts.mBoost, 3],
  ['Компрессор высокого давления', engine.parts.mHpc, 9],
  ['Турбина высокого давления', engine.parts.mHpt, 1],
  ['Турбина низкого давления', engine.parts.mLpt, 4],
];
for (const [name, mod, want] of STAGES) {
  let rows = 0;
  mod.traverse((o) => {
    if (o.isInstancedMesh) rows++;
  });
  check(name, rows === want * 2, `${rows} венцов, ожидается ${want * 2} (${want} ступеней)`);
}

console.log('\n=== НЕПРОТИВОРЕЧИВОСТЬ КОМПОНОВКИ ===');

check('Вентилятор уже своего корпуса', ST.fanTip < ST.caseR);
check('Корпус вентилятора уже габарита по агрегатам', ST.caseR < ST.accR);
check('Агрегаты помещаются под обшивку гондолы', ST.accR < ST.nacelleR);
check('Сопло нар. контура впереди сопла вн. контура', ST.bypassExit < ST.coreExit);
check('Задняя опора впереди среза сопла', ST.frame < ST.coreExit);

const order = [
  'lip', 'throat', 'a1', 'fan', 'splitter', 'boosterIn', 'boosterOut',
  'hpcIn', 'hpcOut', 'combIn', 'combOut', 'hptIn', 'hptOut', 'lptIn', 'lptOut', 'frame',
];
const misordered = order.filter((k, i) => i > 0 && ST[k] <= ST[order[i - 1]]);
check('Станции тракта идут по потоку', misordered.length === 0, misordered.join(', '));

console.log(failures ? `\n${failures} провалов` : '\nВсе проверки пройдены');
process.exit(failures ? 1 : 0);
