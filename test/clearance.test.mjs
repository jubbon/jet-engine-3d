import * as THREE from 'three';
import { buildEngine, ST } from '../src/engine.js';

/* ------------------------------------------------------------------ *
 *  Layout clearances. The prototype dimensions squeezed the axial length
 *  of the core, and blades with the earlier poster-sized chords would
 *  then run into each other: a row occupies chord * cos(stagger) along
 *  the axis, while the stage pitch in the HPC is only 0.13 units.
 *
 *  This test catches exactly that: rows overlapping both axially and
 *  radially, and blade tips poking out through the wall of their duct.
 * ------------------------------------------------------------------ */

let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
};

const engine = buildEngine();

// Blade row: axial and radial extent of a single blade.
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

console.log('\n=== BLADE ROWS DO NOT INTERSECT ===');

const MODULES = [
  ['Booster', engine.parts.mBoost],
  ['HP compressor', engine.parts.mHpc],
  ['HP turbine', engine.parts.mHpt],
  ['LP turbine', engine.parts.mLpt],
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
      // only count a noticeable overlap: grazing contact is just noise
      if (axial > 0.005 && radial > 0.02) clashes.push(`${axial.toFixed(3)} units`);
    }
  }
  check(`${name}: ${rows.length} rows`, clashes.length === 0, clashes.length ? `${clashes.length} overlaps: ${clashes.slice(0, 3).join(', ')}` : 'clearances are clean');
}

console.log('\n=== BLADE TIPS STAY UNDER THEIR WALL ===');


// the nacelle inner gas path (see nacInner in engine.js) at the fan plane
const nacInnerAtFan = 1.58;
check(
  'Fan: clearance to the casing',
  nacInnerAtFan > ST.fanTip,
  `${((nacInnerAtFan - ST.fanTip) * 500).toFixed(0)} mm radially`
);
check(
  'Fan: gas path stays inside the fan case',
  nacInnerAtFan < ST.caseR,
  `gas path ${nacInnerAtFan}, case ${ST.caseR} units`
);

// The outlet guide vanes sit in the bypass duct: root on the core cowl, tip
// under the nacelle wall.
const ogv = bladeRows(engine.parts.mFan).find((r) => r.r0 > 0.9);
check('OGV: tip stays under the nacelle wall', ogv && ogv.r1 <= 1.7, `tip ${ogv?.r1.toFixed(2)} units`);
check('OGV: root sits on the core cowl', ogv && ogv.r0 >= 0.95, `root ${ogv?.r0.toFixed(2)} units`);

console.log('\n=== ACCESSORIES STAY UNDER THE COWL ===');

// The gearbox and the accessories are swung to the side and must stay between
// the fan case and the nacelle skin.
// The module is rotated 62° about the engine axis, so a world-axis bounding box
// grossly overstates the reach: the radius is computed from the vertices.
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
check('Accessories do not pierce the skin', acc.r < ST.nacelleR, `reach ${acc.r.toFixed(2)} of ${ST.nacelleR} units`);
check(
  'Accessories set the overall engine width',
  Math.abs(acc.r - ST.accR) < 0.03,
  `${acc.r.toFixed(3)} against ${ST.accR} units`
);
check('Accessories fit within the nacelle length', acc.x0 > ST.lip && acc.x1 < ST.coreExit, `${acc.x0.toFixed(2)}…${acc.x1.toFixed(2)}`);

console.log(failures ? `\n${failures} failures` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
