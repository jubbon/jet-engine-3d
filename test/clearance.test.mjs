import * as THREE from 'three';
import { buildEngine, ST } from '../src/engine.js';
import { createAirflow } from '../src/airflow.js';

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

console.log('\n=== THE EXHAUST PLUME LEAVES THE NOZZLE IT BELONGS TO ===');

/* The plume in the flows diagram is a cone of its own, built from constants
 * rather than from the gas path, so nothing tied it to the metal it comes out
 * of. It has to start no wider than the core nozzle lip: a rim standing
 * outside the cowl is drawn against the sky, and the cone reads as a sleeve
 * pulled over the engine instead of gas leaving a pipe.
 *
 * The lip is measured off the model rather than copied from cowlPts, and the
 * invisible picking proxies are skipped — mExh carries one of radius 1.24 that
 * would answer this question wrongly and plausibly. */
function skinRadiusAt(x, tol = 0.02) {
  let r = 0;
  for (const m of Object.values(engine.parts)) {
    m.updateWorldMatrix(true, true);
    m.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || !o.geometry?.attributes?.position) return;
      if (o.material?.visible === false) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        if (Math.abs(v.x - x) <= tol) r = Math.max(r, Math.hypot(v.y, v.z));
      }
    });
  }
  return r;
}

const lipR = skinRadiusAt(ST.coreExit);
check('Core nozzle lip is where cowlPts puts it', Math.abs(lipR - 0.82) < 0.01, `${lipR.toFixed(3)} units`);

const plumeMeshes = [];
createAirflow().group.traverse((o) => {
  if (o.isMesh && o.geometry?.type === 'CylinderGeometry') plumeMeshes.push(o);
});
// If the plume stops being a lathe of one cylinder this test is measuring
// something else, and saying so is more useful than a pass.
check('The plume is one cone', plumeMeshes.length === 1, `${plumeMeshes.length} found`);

const pp = plumeMeshes[0].geometry.attributes.position;
let xIn = Infinity;
let xOut = -Infinity;
for (let i = 0; i < pp.count; i++) {
  xIn = Math.min(xIn, pp.getX(i));
  xOut = Math.max(xOut, pp.getX(i));
}
const plumeRadiusAt = (x) => {
  let r = 0;
  for (let i = 0; i < pp.count; i++) {
    if (Math.abs(pp.getX(i) - x) < 1e-4) r = Math.max(r, Math.hypot(pp.getY(i), pp.getZ(i)));
  }
  return r;
};
const rIn = plumeRadiusAt(xIn);
const rOut = plumeRadiusAt(xOut);

check('The plume starts at the core nozzle exit', Math.abs(xIn - ST.coreExit) < 0.01, `x=${xIn.toFixed(2)}`);
check(
  'The plume does not stick out past the nozzle lip',
  rIn <= lipR + 0.01,
  `plume Ø ${rIn.toFixed(2)} m against a nozzle of Ø ${lipR.toFixed(2)} m`
);
// A jet entrains the air around it and spreads. The heat-haze cone in
// heathaze.js widens from 1.45 to 4.0 over its length; a diagram cone that
// narrowed instead would contradict the shimmer drawn on top of it.
check(
  'The plume spreads downstream rather than closing up',
  rOut > rIn,
  `${rIn.toFixed(2)} at x=${xIn.toFixed(1)} to ${rOut.toFixed(2)} at x=${xOut.toFixed(1)}`
);

console.log(failures ? `\n${failures} failures` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
