import * as THREE from 'three';
import { buildEngine, ST, MATS } from '../src/engine.js';
import { STROKE, DOORS, DUCT_H, blockedFraction } from '../src/reverser.js';
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

console.log('\n=== THE BLOCKER DOORS CLOSE THE DUCT WITHOUT GOING THROUGH IT ===');

/* The doors are the one part of this model that sweeps through a space
 * occupied by something else. reverser.js solves their angle from a linkage
 * and knows nothing about where the geometry was actually placed; this checks
 * the placement, off the real vertices, over the WHOLE sweep rather than at
 * the ends. The minimum clearance is not at either end - it is wherever the
 * door happens to point at the core cowl, and a door that grazes it mid-stroke
 * looks perfect in both the stowed and the deployed screenshot. */

/* Outer radius of the core cowl at a station, interpolated along its profile.
 *
 * Sampling "the vertices within a tolerance of x" is the obvious way and is
 * wrong here: the cowl is a lathe of a dozen control points, so between them
 * there are no vertices at all, and the answer comes back as zero - which
 * makes every clearance look enormous. Reconstructing the profile from the
 * vertices and interpolating is exact for a lathe. */
const cowlProfile = (() => {
  const byX = new Map();
  engine.parts.mCowl.updateWorldMatrix(true, true);
  engine.parts.mCowl.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || o.material?.visible === false) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const k = Math.round(v.x * 1e4) / 1e4;
      byX.set(k, Math.max(byX.get(k) ?? 0, Math.hypot(v.y, v.z)));
    }
  });
  return [...byX.entries()].sort((a, b) => a[0] - b[0]);
})();

const cowlR = (x) => {
  if (x <= cowlProfile[0][0]) return cowlProfile[0][1];
  for (let i = 1; i < cowlProfile.length; i++) {
    const [x0, r0] = cowlProfile[i - 1];
    const [x1, r1] = cowlProfile[i];
    if (x <= x1) return x1 === x0 ? r1 : r0 + ((r1 - r0) * (x - x0)) / (x1 - x0);
  }
  return cowlProfile[cowlProfile.length - 1][1];
};

/* Every vertex of every door, at a given travel.
 *
 * The doors are one InstancedMesh - all twelve are always at the same angle -
 * so the world position of a vertex is the instance matrix on top of the mesh
 * matrix. Reading only the mesh matrix would put every door at twelve o'clock
 * and find a clearance that no door has.
 *
 * Found by name rather than by probing its geometry: the doors were a
 * CylinderGeometry segment until they had to be tapered, and a test that
 * identifies its subject by construction detail stops testing anything the day
 * the construction changes, without failing. */
const doorMesh = (() => {
  let found = null;
  engine.parts.mRev.traverse((o) => {
    if (o.isInstancedMesh && o.name === 'blockerDoors') found = o;
  });
  return found;
})();

const _im = new THREE.Matrix4();
function doorPoints(travel) {
  engine.setReverser(travel);
  engine.parts.mRev.updateWorldMatrix(true, true);
  const pts = [];
  const pos = doorMesh.geometry.attributes.position;
  for (let k = 0; k < doorMesh.count; k++) {
    doorMesh.getMatrixAt(k, _im);
    _im.premultiply(doorMesh.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(_im);
      pts.push([v.x, Math.hypot(v.y, v.z)]);
    }
  }
  return pts;
}

check(
  'The doors are there to be measured',
  doorMesh !== null && doorMesh.count === 12,
  `${doorMesh?.count} doors, ${doorPoints(STROKE).length} vertices`
);

let minGap = Infinity;
let minAt = 0;
for (let i = 0; i <= 40; i++) {
  const travel = (STROKE * i) / 40;
  for (const [x, r] of doorPoints(travel)) {
    const gap = r - cowlR(x);
    if (gap < minGap) {
      minGap = gap;
      minAt = travel;
    }
  }
}
check(
  'No door touches the core cowl anywhere in the sweep',
  minGap > 0.01,
  `closest ${(minGap * 500).toFixed(0)} mm at travel ${minAt.toFixed(2)} of ${STROKE}`
);

/* And having got there without hitting anything, they have to do their job.
 *
 * The number reverser.js hands the thrust, the flow and the sound is a fraction
 * of the duct AREA, so that is what is measured here: how far in the doors
 * reach, times how much of the circumference they cover. Measuring the radial
 * reach alone - which this check did at first - agrees with a radial-only
 * blockedFraction for the wrong reason, and neither notices that a ring of
 * twelve plates has gaps in it. */
{
  engine.setReverser(STROKE);
  engine.parts.mRev.updateWorldMatrix(true, true);
  const pts = doorPoints(STROKE);
  const tip = pts.reduce((lo, p) => (p[1] < lo[1] ? p : lo), pts[0]);
  const wall = ST.ductWall; // read, not retyped: the guard must not carry its own copy
  const radial = (wall - tip[1]) / (wall - cowlR(tip[0]));

  // angular coverage: the widest angular extent of one door, times twelve
  const pos = doorMesh.geometry.attributes.position;
  let spread = 0;
  doorMesh.getMatrixAt(0, _im);
  _im.premultiply(doorMesh.matrixWorld);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(_im);
    spread = Math.max(spread, Math.abs(Math.atan2(v.z, v.y)));
  }
  const angular = (DOORS * 2 * spread) / (2 * Math.PI);
  const closed = radial * angular;

  /* reverser.js divides by a duct height of its own to turn a door angle into a
     blocked fraction, and that height is half of a fact whose other half - the
     wall radius and the cowl profile - lives in the geometry. Compare them
     directly, the same way the cascade band is compared against the stroke.
     Checking only the consequence would let two errors cancel. */
  const measuredDuctH = wall - cowlR(tip[0]);
  check(
    "The duct height reverser.js divides by is the duct's",
    Math.abs(measuredDuctH - DUCT_H) < 0.02,
    `measured ${measuredDuctH.toFixed(3)} at x = ${tip[0].toFixed(2)}, reverser.js ${DUCT_H}`
  );

  check(
    'The doors close the bypass duct',
    closed > 0.85,
    `${(100 * closed).toFixed(0)} % of it — ${(100 * radial).toFixed(0)} % radially, ${(100 * angular).toFixed(0)} % round`
  );
  // what reverser.js believes about the same thing, from the linkage and its
  // own coverage constant
  check(
    'and the linkage agrees with the metal',
    Math.abs(closed - blockedFraction(STROKE)) < 0.04,
    `mesh ${closed.toFixed(3)}, linkage ${blockedFraction(STROKE).toFixed(3)}`
  );
}

/* And the doors must clear EACH OTHER. Twelve doors on a 30° pitch swing from
 * a radius of 1.69 to one of 1.19, and the circumference available to them
 * shrinks with it: a plate wide enough to close the gaps at the hinge overlaps
 * its neighbours at the tip. That is why the door is tapered, and this is the
 * check that keeps it so - measured as each vertex's angle away from its own
 * door's centre line, which must stay inside half a pitch. */
{
  const half = Math.PI / DOORS; // half of the 30° sector each door owns
  let worst = 0;
  let worstAt = 0;
  for (let k = 0; k <= 20; k++) {
    const travel = (STROKE * k) / 20;
    engine.setReverser(travel);
    engine.parts.mRev.updateWorldMatrix(true, true);
    const pos = doorMesh.geometry.attributes.position;
    for (let d = 0; d < doorMesh.count; d++) {
      const centre = (d / doorMesh.count) * Math.PI * 2;
      doorMesh.getMatrixAt(d, _im);
      _im.premultiply(doorMesh.matrixWorld);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(_im);
        // the clock convention here is y = r cos a, z = r sin a
        let off = Math.atan2(v.z, v.y) - centre;
        off = Math.atan2(Math.sin(off), Math.cos(off));
        if (Math.abs(off) > worst) {
          worst = Math.abs(off);
          worstAt = travel;
        }
      }
    }
  }
  check(
    'No door reaches into its neighbour',
    worst < half,
    `widest ${((worst * 180) / Math.PI).toFixed(1)}° of a ${((half * 180) / Math.PI).toFixed(1)}° half-pitch, at travel ${worstAt.toFixed(2)}`
  );
  engine.setReverser(STROKE);
}

/* The cascade band has to be SEALED when the sleeve is home and OPEN when it is
 * not — that is the entire mechanism, and until this check existed it was more
 * than half wrong without a single test noticing. The fixed duct wall reached
 * 0.50 units too far aft, so with the reverser deployed the forward 56 % of the
 * band was still walled off and 144 of the 288 vanes had no duct to draw from.
 * Nothing downstream complained: the flow model turns its particles round at a
 * station of its own, so the picture looked right whatever the metal did.
 *
 * Measured as coverage of the duct wall radius over the band: wall pieces and
 * stowed doors both count as closing it. */
{
  const wallSpans = (travel, withDoors) => {
    engine.setReverser(travel);
    engine.root.updateWorldMatrix(true, true);
    const spans = [];
    engine.root.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.material !== MATS.nacelle) return;
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      spans.push([b.min.x, b.max.x]);
    });
    // Stowed, the doors ARE the wall over their own length and count as closing
    // the band. Deployed they stand across the duct at its aft edge and lean a
    // little way into it, which is the mechanism working rather than the band
    // being obstructed - so the deployed question is asked of the walls alone.
    if (withDoors) {
      const pts = doorPoints(travel);
      spans.push([Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0]))]);
    }
    return spans;
  };
  const coveredFraction = (spans) => {
    const N = 200;
    let covered = 0;
    for (let i = 0; i < N; i++) {
      const x = ST.sleeve + ((ST.cascadeAft - ST.sleeve) * (i + 0.5)) / N;
      if (spans.some(([a, b]) => x >= a - 1e-6 && x <= b + 1e-6)) covered++;
    }
    return covered / N;
  };

  const stowed = coveredFraction(wallSpans(0, true));
  const deployed = coveredFraction(wallSpans(STROKE, false));
  check('Stowed, the cascade band is closed off from the duct', stowed > 0.999,
    `${(100 * stowed).toFixed(0)} % of the band covered`);
  check('Deployed, no wall is left across the band', deployed < 0.001,
    `${(100 * deployed).toFixed(0)} % of the band still walled off`);
  engine.setReverser(STROKE);
}

// The sleeve translates over the core cowl, which narrows aft: it must clear it.
{
  engine.setReverser(STROKE);
  let sleeveMin = Infinity;
  let sleeveAft = -Infinity;
  engine.parts.mRev.updateWorldMatrix(true, true);
  engine.parts.mRev.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry?.attributes?.position) return;
    if (o.material !== MATS.nacelle && o.material !== MATS.nacelleSkin) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      sleeveAft = Math.max(sleeveAft, v.x);
      sleeveMin = Math.min(sleeveMin, Math.hypot(v.y, v.z) - cowlR(v.x));
    }
  });
  check(
    'The deployed sleeve clears the core cowl',
    sleeveMin > 0.1,
    `closest ${(sleeveMin * 500).toFixed(0)} mm`
  );
  check(
    'and stops short of the core nozzle',
    sleeveAft < ST.coreExit,
    `trailing edge at ${sleeveAft.toFixed(2)}, exit at ${ST.coreExit}`
  );
  engine.setReverser(0);
}

console.log(failures ? `\n${failures} failures` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
