import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { buildEngine, ST } from '../src/engine.js';
import { STROKE } from '../src/reverser.js';
import { X_DOORS } from '../src/airflow.js';

/* ------------------------------------------------------------------ *
 *  The dimensions of the model must agree with the reference data for
 *  the prototype - docs/engines/cfm56-7b-nacelle.json. Those values are
 *  read straight from the file rather than copied into the test: if the
 *  reference is edited, it is the test that breaks, not the model that
 *  silently drifts.
 *
 *  Tolerances are the ones the reference itself states: ±0.15 m for
 *  measurements off the ACAP drawing, ±0.2…0.3 m for values with
 *  confidence = derived_low.
 * ------------------------------------------------------------------ */

const spec = JSON.parse(
  readFileSync(new URL('../docs/engines/cfm56-7b-nacelle.json', import.meta.url), 'utf8')
);
const nod = spec.nacelle_overall_dimensions;
const erd = spec.engine_reference_data;

const U = 0.5; // metres per model unit
const m = (ue) => ue * U; // model units -> metres
const station = (x) => (x - ST.lip) * U; // metres from the intake lip

let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
};
const near = (name, got, want, tol, unit = 'm') =>
  check(
    name,
    Math.abs(got - want) <= tol,
    `model ${got.toFixed(3)}, reference ${want.toFixed(3)} ±${tol} ${unit}`
  );

const engine = buildEngine();

/* The nacelle is two modules: the reverser is the aft section of the same
   cowl, and the skin runs continuously from one into the other. Every envelope
   below is taken over both - the dimensions in the reference are of the
   nacelle, and where the model happens to draw the seam is its own business. */
const NACELLE = [engine.parts.mNac, engine.parts.mRev];

// Extent of a group taken from its own geometry: this is the only way the
// flattened bottom of the nacelle is accounted for - the lathe profile knows
// nothing about it.
function bbox(objs, skip = []) {
  const box = new THREE.Box3();
  [objs].flat().forEach((obj) => {
    obj.updateWorldMatrix(true, true);
    obj.traverse((o) => {
      if (!o.isMesh || !o.geometry || o.material?.visible === false) return;
      if (skip.includes(o.name)) return;
      o.geometry.computeBoundingBox();
      box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
    });
  });
  return box;
}

console.log('\n=== NACELLE DIMENSIONS ===');

// Skin only: the pylon fairing is not part of the nacelle dimensions.
const nac = bbox(NACELLE, ['pylon']);
near('Maximum width', m(nac.max.z - nac.min.z), nod.max_width.value, 0.15);

// Height: the nacelle without the pylon fairing. The drawing gave 2.40 m as a
// lower bound, because the top is obscured by the wing and the pylon - hence
// the ±0.2 m tolerance.
const bellyCut = m(2 * ST.nacelleR) - m(nac.max.y - nac.min.y);
near('Height over the skin', m(nac.max.y - nac.min.y), nod.max_height.value, 0.2);
near(
  'Width of the flat bottom',
  m(2 * Math.sqrt(ST.nacelleR ** 2 - (ST.nacelleR - bellyCut / U) ** 2)),
  nod.flat_bottom_width.value,
  0.2
);

/* The flat bottom has to BE flat.
 *
 * Every dimension above is taken at the widest section, and there a flattening
 * that holds a level plane and one that follows the taper of the cowl give
 * exactly the same answer. That is how an underside which climbed 0.33 m over
 * the length of the intake - a bevel across the bottom front corner, not a
 * flattening at all - passed every check on this page for as long as it did.
 *
 * The reference says nothing about the lengthwise shape of the flat, so what is
 * guarded here is the model's own decision rather than a published figure: the
 * underside is a plane, and it runs to the lip. The clearance the feature exists
 * to buy is measured from the ground to the lowest point of the nacelle, so a
 * flat that rises anywhere along its run is not doing its job. */
const belly = new Map(); // station -> lowest point of the skin there
{
  const v = new THREE.Vector3();
  NACELLE.forEach((mod) => {
    mod.updateWorldMatrix(true, true);
    mod.traverse((o) => {
      if (!o.isMesh || !o.geometry || o.material?.visible === false || o.name === 'pylon') return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        const b = Math.round(v.x * 10) / 10;
        if (!belly.has(b) || v.y < belly.get(b)) belly.set(b, v.y);
      }
    });
  });
}
const floor = Math.min(...belly.values());
const LEVEL = 0.02; // 10 mm: below that the flat is flat as far as the eye goes

// Where the flat begins, measured from the lip.
let flatFrom = Infinity;
for (const [x, y] of belly) if (y <= floor + LEVEL) flatFrom = Math.min(flatFrom, x);
check(
  'The flat bottom reaches the lip',
  station(flatFrom) <= 0.2,
  `starts ${station(flatFrom).toFixed(2)} m aft of the lip, allowed 0.20`
);

// And does not climb anywhere along its run, from the lip to the aft cowl.
let worst = 0;
let worstAt = 0;
for (const [x, y] of belly) {
  if (x < flatFrom || station(x) > 2.4) continue;
  if (y - floor > worst) [worst, worstAt] = [y - floor, x];
}
check(
  'The underside does not climb along its run',
  worst <= LEVEL,
  `worst ${(m(worst) * 1000).toFixed(0)} mm at ${station(worstAt).toFixed(2)} m from the lip`
);

near('Lip -> fan nozzle exit', station(ST.bypassExit), nod.length_lip_to_fan_nozzle_exit.value, 0.15);
near('Lip -> core nozzle exit', station(ST.coreExit), nod.length_lip_to_core_nozzle_exit.value, 0.15);
near('Lip -> plug tip', station(ST.plugTip), nod.length_lip_to_plug_tip.value, 0.3);
near('Nacelle fineness ratio', station(ST.coreExit) / nod.max_width.value, nod.fineness_ratio.value, 0.05, '—');

// "protrudes about 0.9-1.0 m beyond the core nozzle exit"
const plugOut = station(ST.plugTip) - station(ST.coreExit);
check('Plug protrusion beyond the exit', plugOut >= 0.9 && plugOut <= 1.0, `${plugOut.toFixed(2)} m, expected 0.9…1.0`);

console.log('\n=== ENGINE DIMENSIONS ===');

near('Fan diameter', m(2 * ST.fanTip), erd.fan_diameter.value, 0.005);
near('Length between flanges (A1 -> rear frame)', m(ST.frame - ST.a1), erd.bare_engine_overall_length.value, 0.02);
near('Height (fan case)', m(2 * ST.caseR), erd.bare_engine_height.value, 0.02);
near('Width (over the accessory gearbox)', m(2 * ST.accR), erd.bare_engine_width.value, 0.02);

// Fan blade count: the blade passing frequency in the sound depends on it.
let fanRows = 0;
engine.parts.mFan.traverse((o) => {
  if (o.isInstancedMesh && o.count === erd.fan_blades.value) fanRows++;
});
check('Fan blade count', fanRows === 1, `rows of ${erd.fan_blades.value} blades: ${fanRows}`);

console.log('\n=== INTAKE DEPTH ===');

/* Ratio of intake length to fan diameter. On a classic nacelle it is about
   0.5; patents on "short intakes" specify 0.20…0.45 and cite 0.5 as the
   baseline they depart from. The length is measured from the foremost point of
   the nacelle to the leading edge of the blade TIP - exactly what the eye sees
   when looking the engine in the face.

   The check is needed because nothing fixes this dimension directly: it comes
   out of subtracting the engine and nozzle lengths from the nacelle length.
   Get the nozzle wrong by 0.3 m and every reference dimension still checks out
   while the fan sinks deep into the duct. That is what happened: first it came
   out at 0.88, then 0.63, and both times it showed only in the picture. */
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
near('Intake length / fan diameter', m(tipLE - ST.lip) / erd.fan_diameter.value, 0.5, 0.06, '—');

console.log('\n=== STAGE COUNT ===');

/* CFM56-7B layout: 3 booster stages, 9 HPC stages, 1 HPT stage, 4 LPT stages.
   Each stage in the model has two rows - the rotor and the vanes (stator in a
   compressor, nozzle guide vanes in a turbine), so there are twice as many
   rows. Rows are what we count: that way the test also catches a stray vane
   row. */
const STAGES = [
  ['Booster (LP compressor)', engine.parts.mBoost, 3],
  ['High-pressure compressor', engine.parts.mHpc, 9],
  ['High-pressure turbine', engine.parts.mHpt, 1],
  ['Low-pressure turbine', engine.parts.mLpt, 4],
];
for (const [name, mod, want] of STAGES) {
  let rows = 0;
  mod.traverse((o) => {
    if (o.isInstancedMesh) rows++;
  });
  check(name, rows === want * 2, `${rows} rows, expected ${want * 2} (${want} stages)`);
}

console.log('\n=== LAYOUT CONSISTENCY ===');

check('Fan is narrower than its case', ST.fanTip < ST.caseR);
check('Fan case is narrower than the accessory envelope', ST.caseR < ST.accR);
check('Accessories fit under the nacelle skin', ST.accR < ST.nacelleR);
check('Fan nozzle is ahead of the core nozzle', ST.bypassExit < ST.coreExit);
check('Rear frame is ahead of the nozzle exit', ST.frame < ST.coreExit);

const order = [
  'lip', 'throat', 'a1', 'fan', 'splitter', 'boosterIn', 'boosterOut',
  'hpcIn', 'hpcOut', 'combIn', 'combOut', 'hptIn', 'hptOut', 'lptIn', 'lptOut', 'frame',
];
const misordered = order.filter((k, i) => i > 0 && ST[k] <= ST[order[i - 1]]);
check('Stations run in flow order', misordered.length === 0, misordered.join(', '));

console.log('\n=== THRUST REVERSER ===');

/* The reverser is the aft section of the nacelle: fan cowl joint, then fixed
   structure, then the cascade band the sleeve covers when it is home, then
   whatever the sleeve has left to reach the fan nozzle. Nothing in the
   reference fixes the split - it lists all of it under not_published - so what
   is guarded here is that the model's own decisions stay consistent with each
   other. */
const nacelleOrder = ['a1', 'reverser', 'sleeve', 'cascadeAft', 'bypassExit'];
const nacMisordered = nacelleOrder.filter((k, i) => i > 0 && ST[k] <= ST[nacelleOrder[i - 1]]);
check('Reverser stations run aft in order', nacMisordered.length === 0, nacMisordered.join(', '));

/* airflow.js turns the bypass particles round at the blocker doors, and copies
   that station rather than importing ST - it depends on nothing, and the two
   duct tables above it are copied for the same reason. Copies need a keeper:
   ST.cascadeAft is itself derived from STROKE, so moving the stroke would slide
   the doors out from under the flow with nothing to say so. */
check(
  'The flow turns round where the doors actually are',
  Math.abs(X_DOORS - ST.cascadeAft) < 1e-9,
  `airflow ${X_DOORS}, ST.cascadeAft ${ST.cascadeAft}`
);

// A third to a half of the nacelle: on the prototype the reverser is the aft
// section of the cowl, not a collar round the nozzle.
const revShare = (ST.bypassExit - ST.reverser) / (ST.bypassExit - ST.lip);
check(
  'Reverser is the aft third of the nacelle',
  revShare > 0.3 && revShare < 0.5,
  `${(100 * revShare).toFixed(0)} % of the length to the fan nozzle`
);

// Deployed, the sleeve must not reach the core nozzle: there is nothing to
// collide with out there, but a sleeve hanging over the exit would be wrong.
check(
  'The deployed sleeve stays ahead of the core nozzle',
  ST.bypassExit + STROKE < ST.coreExit,
  `trailing edge at ${station(ST.bypassExit + STROKE).toFixed(2)} m, exit at ${station(ST.coreExit).toFixed(2)} m`
);

console.log(failures ? `\n${failures} failures` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
