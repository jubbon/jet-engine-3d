import * as THREE from 'three';
import { buildEngine, ST } from '../src/engine.js';

/* ------------------------------------------------------------------ *
 *  Компоновочные зазоры. Габариты прототипа втрое поджали осевую
 *  длину газогенератора, и лопатки прежних «плакатных» хорд после
 *  этого входили бы друг в друга: венец занимает по оси
 *  chord * cos(угол установки), а шаг ступени в КВД - всего 0.13 у.е.
 *
 *  Тест ловит именно это: венцы, перекрытые и по оси, и по радиусу,
 *  и концы лопаток, вылезшие за обечайку своего канала.
 * ------------------------------------------------------------------ */

let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
};

const engine = buildEngine();

// Венец лопаток: осевой и радиальный габарит одной лопатки.
function bladeRows(module) {
  const rows = [];
  module.traverse((o) => {
    if (!o.isInstancedMesh || !o.geometry) return;
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox;
    rows.push({
      x0: b.min.x,
      x1: b.max.x,
      r0: Math.min(Math.hypot(b.min.y, b.min.z), Math.abs(b.min.y)),
      r1: Math.max(Math.hypot(b.max.y, b.max.z), Math.abs(b.max.y)),
    });
  });
  return rows.sort((a, b) => a.x0 - b.x0);
}

console.log('\n=== ВЕНЦЫ НЕ ВХОДЯТ ДРУГ В ДРУГА ===');

const MODULES = [
  ['КНД', engine.parts.mBoost],
  ['КВД', engine.parts.mHpc],
  ['ТВД', engine.parts.mHpt],
  ['ТНД', engine.parts.mLpt],
];

for (const [name, mod] of MODULES) {
  const rows = bladeRows(mod);
  const clashes = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      const axial = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const radial = Math.min(a.r1, b.r1) - Math.max(a.r0, b.r0);
      // перекрытие считаем только заметное: доли от касания дают шум
      if (axial > 0.005 && radial > 0.02) clashes.push(`${axial.toFixed(3)} у.е.`);
    }
  }
  check(`${name}: ${rows.length} венцов`, clashes.length === 0, clashes.length ? `перекрытий ${clashes.length}: ${clashes.slice(0, 3).join(', ')}` : 'зазоры чистые');
}

console.log('\n=== КОНЦЫ ЛОПАТОК ПОД ОБЕЧАЙКОЙ ===');


// внутренний тракт гондолы (см. nacInner в engine.js) у плоскости вентилятора
const nacInnerAtFan = 1.58;
check(
  'Вентилятор: зазор до обечайки',
  nacInnerAtFan > ST.fanTip,
  `${((nacInnerAtFan - ST.fanTip) * 500).toFixed(0)} мм по радиусу`
);
check(
  'Вентилятор: обечайка под корпусом вентилятора',
  nacInnerAtFan < ST.caseR,
  `тракт ${nacInnerAtFan}, корпус ${ST.caseR} у.е.`
);

// Спрямляющий аппарат стоит в наружном контуре: комель на капоте
// газогенератора, конец - под обечайкой гондолы.
const ogv = bladeRows(engine.parts.mFan).find((r) => r.r0 > 0.9);
check('Спрямляющий аппарат: конец под обечайкой', ogv && ogv.r1 <= 1.7, `конец ${ogv?.r1.toFixed(2)} у.е.`);
check('Спрямляющий аппарат: комель на капоте', ogv && ogv.r0 >= 0.95, `комель ${ogv?.r0.toFixed(2)} у.е.`);

console.log('\n=== АГРЕГАТЫ ПОД КАПОТОМ ===');

// Коробка приводов и агрегаты уведены на бок и должны остаться между
// корпусом вентилятора и обшивкой гондолы.
// Узел повёрнут вокруг оси двигателя на 62°, поэтому охватывающий
// параллелепипед в мировых осях сильно завышает вылет: считаем радиус
// по самим вершинам.
const acc = { r: 0, x0: Infinity, x1: -Infinity };
const v = new THREE.Vector3();
engine.parts.mAcc.updateWorldMatrix(true, true);
engine.parts.mAcc.traverse((o) => {
  if (!o.isMesh || !o.geometry || o.material?.visible === false) return;
  const pos = o.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
    acc.r = Math.max(acc.r, Math.hypot(v.y, v.z));
    acc.x0 = Math.min(acc.x0, v.x);
    acc.x1 = Math.max(acc.x1, v.x);
  }
});
check('Агрегаты не пробивают обшивку', acc.r < ST.nacelleR, `вылет ${acc.r.toFixed(2)} из ${ST.nacelleR} у.е.`);
check(
  'Габарит по агрегатам держит ширину двигателя',
  Math.abs(acc.r - ST.accR) < 0.03,
  `${acc.r.toFixed(3)} против ${ST.accR} у.е.`
);
check('Агрегаты в пределах длины гондолы', acc.x0 > ST.lip && acc.x1 < ST.coreExit, `${acc.x0.toFixed(2)}…${acc.x1.toFixed(2)}`);

console.log(failures ? `\n${failures} провалов` : '\nВсе проверки пройдены');
process.exit(failures ? 1 : 0);
