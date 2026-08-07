import * as THREE from 'three';
import { makeBladeGeometry, bladeRow } from './blade.js';
import { createNacelleLivery } from './livery.js';

/* ------------------------------------------------------------------ *
 *  Geometric layout of a high-bypass turbofan. The prototype is the
 *  CFM56-7B in a Boeing 737NG nacelle; every dimension comes from
 *  docs/engines/cfm56-7b-nacelle.json.
 *  The engine axis is X, the flow goes towards +X.
 *
 *  1 model unit = 0.50 m. Because of that factor a RADIUS in model units
 *  is numerically equal to a DIAMETER in metres: fanTip = 1.549 units is
 *  a fan of Ø 1.549 m, nacelleR = 2.44 units is a nacelle of Ø 2.44 m.
 *
 *  Longitudinal stations are measured from the intake lip: it sits at
 *  x = -5.2 units, so a station in metres from the lip equals
 *  (x + 5.2) / 2. The reference values are: fan nozzle exit 3.18 m, core
 *  nozzle exit 4.05 m, plug tip 5.00 m, bare engine length 2.508 m.
 *
 *  Where the engine sits lengthwise inside the nacelle is NOT fixed by
 *  the dimensions: the sum "intake + engine + nozzle" adds up for any
 *  split. It is therefore tied to a separate figure - the ratio of
 *  intake length (from the lip to the leading edge of the blade tip) to
 *  fan diameter. On a classic nacelle it is about 0.5, here 0.498; the
 *  intake takes 0.83 m and the exhaust nozzle aft of the rear flange
 *  0.71 m. An error here is not caught by the dimensions, only by eye or
 *  by test: make the nozzle too short and the fan sinks deep into the
 *  intake duct while every reference dimension still checks out.
 *  geometry.test.mjs guards it.
 * ------------------------------------------------------------------ */

export const ST = {
  lip: -5.2, // intake highlight (leading edge), 0 m
  throat: -4.94, // intake throat, 0.13 m
  a1: -3.54, // flange A1: intake to fan case joint, 1.04 m
  fan: -3.22, // fan plane, 1.20 m
  splitter: -2.86, // flow splitter, 1.38 m
  boosterIn: -2.74, // 3 booster stages
  boosterOut: -2.38,
  hpcIn: -2.18, // 9 HP compressor stages
  hpcOut: -1.04,
  combIn: -0.84,
  combOut: -0.28,
  hptIn: -0.18, // 1 HP turbine stage
  hptOut: 0.12,
  lptIn: 0.36, // 4 LP turbine stages
  lptOut: 1.11,
  frame: 1.48, // turbine rear frame, also the engine rear flange, 3.55 m
  bypassExit: 1.16, // fan nozzle exit, 3.18 m
  coreExit: 2.9, // core nozzle exit, 4.05 m
  plugTip: 4.8, // plug tip, 5.00 m
  fanTip: 1.549, // fan Ø 1.549 m (61 in)
  caseR: 1.829, // outside of the fan case: engine height 1.829 m
  accR: 2.118, // accessories on the side: engine width 2.118 m
  nacelleR: 2.44, // largest nacelle dimension Ø 2.44 m (APPROX 8 FT)
};

/* -------------------- spinner spiral smear -------------------------- *
 *  The spiral on the spinner exists to be seen: at rest and at low speeds
 *  it warns ground crew that the engine is running. But the eye averages
 *  the image over roughly 1/25 s, and already at medium speeds the spiral
 *  sweeps a full circle - what is left is an even ring, and at take-off
 *  power it cannot be seen at all.
 *
 *  We treat this as accumulation: several copies of the spiral are drawn,
 *  spread in angle over the swept sector. A point in the frame covered by
 *  one copy out of n gets opacity 1/n - exactly the fraction of time the
 *  spiral actually spent there.
 *
 *  The swept angle is NOT taken from the on-screen rotation rate: in this
 *  model the rotors are deliberately slowed for legibility (see
 *  docs/03-physics.md), and by that measure the spiral would never smear.
 *  It is tied instead to the effective regime keff, so that at idle the
 *  spiral reads clearly and by take-off power it disappears - as on a
 *  real engine.
 * -------------------------------------------------------------------- */

// Maximum number of copies. It has to be large enough that at take-off power
// the step between them does not exceed the thickness of the spiral: otherwise
// stripes appear instead of an even ring.
export const SPIRAL_GHOSTS = 56;
const SPIRAL_WIDTH = 0.13; // angular thickness of the spiral at mid-spinner, rad
const SPIRAL_SWEEP = Math.PI * 2; // how much it sweeps at take-off power

/**
 * @param {number} keff effective regime 0..1 (0 - idle and below)
 * @returns {{ghosts: number, spread: number, opacity: number}}
 */
export function spiralBlur(keff) {
  const k = Math.max(0, Math.min(1, keff));
  const spread = SPIRAL_SWEEP * Math.pow(k, 1.4);
  // while the swept angle is smaller than the spiral itself, there is nothing to smear
  if (spread <= SPIRAL_WIDTH) return { ghosts: 1, spread: 0, opacity: 1 };
  // Keep the step between copies below the thickness of the spiral, otherwise
  // the smear turns striped. There is one more copy than there are gaps - those
  // are what gets laid out across the sector.
  const ghosts = Math.min(SPIRAL_GHOSTS, Math.ceil((1.5 * spread) / SPIRAL_WIDTH) + 1);
  return { ghosts, spread, opacity: 1 / ghosts };
}

/* ----------------------------- materials ---------------------------- */

const shellMaterials = [];
const allMaterials = [];

function mat(params, { shell = false } = {}) {
  const m = new THREE.MeshStandardMaterial(params);
  allMaterials.push(m);
  if (shell) shellMaterials.push(m);
  return m;
}

export const MATS = {
  nacelle: mat(
    { color: 0xe8eaed, metalness: 0.25, roughness: 0.35, side: THREE.DoubleSide },
    { shell: true }
  ),
  // The outer skin differs from the rest of the nacelle only in carrying the
  // markings; the map is attached below, once the profile it is laid out
  // against exists.
  nacelleSkin: mat(
    { color: 0xe8eaed, metalness: 0.25, roughness: 0.35, side: THREE.DoubleSide },
    { shell: true }
  ),
  nacelleLip: mat({ color: 0xb9c0c7, metalness: 1.0, roughness: 0.12 }, { shell: true }),
  coreCowl: mat(
    { color: 0xd4d8dc, metalness: 0.4, roughness: 0.35, side: THREE.DoubleSide },
    { shell: true }
  ),
  fanCase: mat(
    { color: 0x8d949c, metalness: 0.85, roughness: 0.4, side: THREE.DoubleSide },
    { shell: true }
  ),
  casing: mat(
    { color: 0x7f868e, metalness: 0.9, roughness: 0.38, side: THREE.DoubleSide },
    { shell: true }
  ),
  casingHot: mat(
    { color: 0x8a7358, metalness: 0.85, roughness: 0.45, side: THREE.DoubleSide },
    { shell: true }
  ),
  combLiner: mat(
    { color: 0x6a5a48, metalness: 0.75, roughness: 0.55, side: THREE.DoubleSide },
    { shell: true }
  ),
  composite: mat({ color: 0x33383f, metalness: 0.45, roughness: 0.45, side: THREE.DoubleSide }),
  titanium: mat({ color: 0xa9b1b8, metalness: 0.95, roughness: 0.28, side: THREE.DoubleSide }),
  steel: mat({ color: 0x8f979e, metalness: 0.9, roughness: 0.35, side: THREE.DoubleSide }),
  nickel: mat({ color: 0xbfa887, metalness: 0.9, roughness: 0.4, side: THREE.DoubleSide }),
  turbineHot: mat({
    color: 0xa8825c,
    metalness: 0.85,
    roughness: 0.45,
    emissive: 0x000000,
    side: THREE.DoubleSide,
  }),
  disk: mat({ color: 0x9aa1a8, metalness: 0.95, roughness: 0.3, side: THREE.DoubleSide }),
  diskHot: mat({ color: 0x9c8465, metalness: 0.9, roughness: 0.42, side: THREE.DoubleSide }),
  shaft: mat({ color: 0x6f767d, metalness: 0.95, roughness: 0.25 }),
  accessory: mat({ color: 0x454b52, metalness: 0.7, roughness: 0.5 }),
  paint: mat({ color: 0xf2f4f6, metalness: 0.1, roughness: 0.5 }),
  // spinner spiral: transparency is needed for the smear at high speeds
  spiral: mat({
    color: 0x22262b,
    metalness: 0.5,
    roughness: 0.6,
    transparent: true,
    depthWrite: false,
  }),
  pylon: mat({ color: 0xdfe3e7, metalness: 0.3, roughness: 0.4, side: THREE.DoubleSide }, { shell: true }),
};

export function getShellMaterials() {
  return shellMaterials;
}
export function getAllMaterials() {
  return allMaterials;
}

/* --------------------------- shape helpers -------------------------- */

// Surface of revolution. points: [[radius, x], ...]. The axis of revolution is X.
function lathe(points, material, segments = 96) {
  const v = points.map((p) => new THREE.Vector2(p[0], p[1]));
  const g = new THREE.LatheGeometry(v, segments);
  const m = new THREE.Mesh(g, material);
  m.rotation.z = -Math.PI / 2;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* Resamples a profile along a spline through its control points, at even
   spacing. Two things come out of it, and both matter for the nacelle skin.
   The silhouette stops being a chain of straight segments - lathe() joins the
   control points with lines, and on a body this size the creases between them
   catch the light and read as facets. And LatheGeometry hands out the texture
   coordinate v by point index, so evenly spaced points make v proportional to
   distance along the generatrix; the markings in livery.js are placed by
   station and rely on that. */
function smoothProfile(points, samples) {
  const curve = new THREE.SplineCurve(points.map((p) => new THREE.Vector2(p[0], p[1])));
  return curve.getSpacedPoints(samples).map((p) => [p.x, p.y]);
}

/* ------------------- flat bottom of the nacelle --------------------- *
 *  The 737 nacelle is not round: the bottom and the intake lip are
 *  flattened - the "hamster pouch". The reason is not stylistic. The 737
 *  wing sits low above the ground, and to fit a CFM56 under it the fan
 *  was cut down in diameter and the accessory gearbox was moved from
 *  underneath the engine to the side (from 6 o'clock to 9). The bottom
 *  thus freed up is what got flattened.
 *
 *  Surfaces of revolution here are built by lathe(), so the shape is
 *  produced by deforming vertices: the bottom of each section is trimmed
 *  to a given level with a smooth minimum, so that instead of a sharp
 *  corner there is a rounded transition into the sides.
 * -------------------------------------------------------------------- */

/* The depth of the cut comes from the reference via the width of the flat: at
   an outer radius of 2.44 units a chord 1.2 m wide (2.4 units, the "hamster
   pouch" seen head-on) is cut off at a depth of 0.16 m. That gives a nacelle
   height of 2.44 - 0.16 = 2.28 m - within the tolerance of the measured
   2.40 ± 0.2 m, and the shortfall to 2.40 is made up by the pylon fairing on
   top, which is exactly what obscured the top of the nacelle when measuring
   the head-on view. */
const BELLY = 0.32; // 0.16 m

// Outside, the nacelle is flat from the lip through the fan cowls and becomes round towards the nozzle.
const outerBelly = (x) => BELLY * (1 - THREE.MathUtils.smoothstep(x, -0.8, 1.16));

// Inside, however, the intake must be round by the time it reaches the fan
// plane: the clearance to the blade tips there is under a tenth of a unit, and
// a flattened duct would simply shave them off.
const innerBelly = (x) => BELLY * (1 - THREE.MathUtils.smoothstep(x, -4.94, -3.6));

// The angle by which the accessory gearbox is swung from the bottom of the
// engine round to the side. It also sets the explode direction of the module
// and the position of its label.
const AGB_TILT = THREE.MathUtils.degToRad(62);
const AGB_AXIS = new THREE.Vector3(1, 0, 0);
const AGB_EXPLODE = new THREE.Vector3(0, -4.4, 0).applyAxisAngle(AGB_AXIS, AGB_TILT);

// smooth minimum: rounds the joint between the flat bottom and the sides
function smoothMin(a, b, k) {
  const h = THREE.MathUtils.clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b * (1 - h) + a * h - k * h * (1 - h);
}

/* computeVertexNormals() leaves a seam where lathe duplicates vertices at the
   0 / 2π joint: the copies have different neighbouring triangles and therefore
   different normals. Averaging the normals of coincident vertices removes the
   seam. Edges of the profile stay sharp: their coordinates differ. */
function weldNormals(geo) {
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const same = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)}|${pos.getY(i).toFixed(4)}|${pos.getZ(i).toFixed(4)}`;
    const bucket = same.get(key);
    if (bucket) bucket.push(i);
    else same.set(key, [i]);
  }
  same.forEach((ids) => {
    if (ids.length < 2) return;
    let nx = 0;
    let ny = 0;
    let nz = 0;
    ids.forEach((i) => {
      nx += nor.getX(i);
      ny += nor.getY(i);
      nz += nor.getZ(i);
    });
    const len = Math.hypot(nx, ny, nz) || 1;
    ids.forEach((i) => nor.setXYZ(i, nx / len, ny / len, nz / len));
  });
  nor.needsUpdate = true;
}

/**
 * Flattens the bottom of a surface of revolution built by lathe().
 * @param {THREE.Mesh} mesh
 * @param {(x: number) => number} depth how much to cut from below at station x
 */
function flattenBelly(mesh, depth) {
  const geo = mesh.geometry;
  geo.rotateZ(-Math.PI / 2); // from LatheGeometry axes into engine axes
  mesh.rotation.z = 0;

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y >= 0) continue; // only the bottom is flattened
    const d = depth(pos.getX(i));
    if (d <= 1e-4) continue;
    // the radius is constant around the ring, so the cut level is shared by the whole ring
    const r = Math.hypot(y, pos.getZ(i));
    if (r < 1e-4) continue;
    // Keep the fillet tight: with a soft transition the flattening spreads out
    // along the sides and the intake reads as an oval rather than a circle with
    // its bottom cut off.
    pos.setY(i, -smoothMin(-y, Math.max(r * 0.4, r - d), r * 0.09));
  }
  pos.needsUpdate = true;
  weldNormals(geo);
  geo.computeBoundingSphere();
  return mesh;
}

/* ----------------------- the nacelle profiles ----------------------- *
 *  The cowl is one closed shell described by two profiles: the outer skin
 *  runs from the lip aft, the inner gas path comes back forward. They are
 *  flattened differently - outside the nacelle is flat along almost its
 *  whole length, inside only near the lip (see flattenBelly).
 *
 *  They live out here rather than inside buildEngine() because the markings
 *  are laid out against the outer profile: the texture has to be built from
 *  the same numbers the geometry is.
 * -------------------------------------------------------------------- */

/* Control points of the outer skin: lip Ø 1.70 m, maximum Ø 2.44 m at the
   intake-to-fan-cowl joint, then a gentle taper towards the fan nozzle. The
   annular face at the trailing edge is not part of this curve - a spline
   through it would round off the very edge that should stay sharp - so it is
   left to the inner profile to close. */
const NAC_OUTER_CTL = [
  [1.7, ST.lip],
  [1.86, -5.1],
  [2.02, -4.8],
  [2.2, -4.4],
  [2.36, -3.9],
  [ST.nacelleR, ST.a1],
  [ST.nacelleR, -1.6],
  [2.36, -0.8],
  [2.2, 0.0],
  [1.98, 0.6],
  [1.78, 1.0],
  [1.7, ST.bypassExit],
];

/* 64 samples put a point about every 55 mm of skin. Fewer and the spline
   still shows as facets on the barrel, where the surface is nearly flat and
   the eye is most sensitive to them; more buys nothing visible and only
   stretches the texture rows thinner. */
const NAC_OUTER = smoothProfile(NAC_OUTER_CTL, 64);

/* Inner gas path: throat Ø 1.52 m, diffuser out to Ø 1.58 m over the blade
   tips (15 mm clearance) and the bypass duct up to the nozzle exit. The first
   point is the annular trailing face that closes the shell against the skin. */
const NAC_INNER = [
  [1.7, ST.bypassExit],
  [1.62, ST.bypassExit],
  [1.64, 1.0],
  [1.68, 0.3],
  [1.7, -0.6],
  [1.68, -1.6],
  [1.64, -2.82],
  [1.58, ST.fan],
  [1.58, ST.a1],
  [1.55, -4.1],
  [1.53, -4.62],
  [1.52, ST.throat],
  [1.7, ST.lip],
];

MATS.nacelleSkin.map = createNacelleLivery(NAC_OUTER, ST);

// Annular rotor disc / drum
function drum(x0, x1, r0, r1, material, seg = 64) {
  return lathe(
    [
      [r0 * 0.55, x0],
      [r0, x0],
      [r1, x1],
      [r1 * 0.55, x1],
    ],
    material,
    seg
  );
}

function tube(x0, x1, rIn, rOut, material, seg = 64) {
  return lathe(
    [
      [rIn, x0],
      [rOut, x0],
      [rOut, x1],
      [rIn, x1],
      [rIn, x0],
    ],
    material,
    seg
  );
}

function ringOf(count, fn, parent) {
  for (let i = 0; i < count; i++) {
    const o = fn(i, (i / count) * Math.PI * 2);
    if (o) parent.add(o);
  }
  return parent;
}

/* --------------------------- engine assembly ------------------------ */

export function buildEngine() {
  const root = new THREE.Group();
  const modules = [];
  const n1Rotors = [];
  const n2Rotors = [];

  // The card text is not carried here any more: it lives in the dictionary
  // under module.<name>.title and module.<name>.info, keyed off this name.
  // That keeps this file about geometry, and it lets a card that is already
  // open be re-rendered when the language changes.
  function module(name, explode) {
    const g = new THREE.Group();
    g.name = name;
    g.userData = { explode: explode || new THREE.Vector3(), base: new THREE.Vector3() };
    root.add(g);
    modules.push(g);
    return g;
  }
  function rotor(parent, kind) {
    const g = new THREE.Group();
    parent.add(g);
    (kind === 1 ? n1Rotors : n2Rotors).push(g);
    return g;
  }

  /* ===================== 1. Nacelle / intake ========================= */
  const mNac = module('nacelle', new THREE.Vector3(0, 4.4, 0));

  // NAC_OUTER / NAC_INNER are module-level: the markings on the skin are laid
  // out against the outer profile, so it has to exist before buildEngine runs.
  mNac.add(flattenBelly(lathe(NAC_OUTER, MATS.nacelleSkin, 120), outerBelly));
  mNac.add(flattenBelly(lathe(NAC_INNER, MATS.nacelle, 120), innerBelly));
  // the polished intake lip: it lies entirely within the fully flattened zone,
  // so it is cut the same way inside and out
  mNac.add(
    flattenBelly(
      lathe(
        [
          [1.7, ST.lip], // nose of the lip
          [1.86, -5.1],
          [1.98, -4.92],
          [2.02, -4.8], // the outer part runs aft, flush with the skin
          [1.58, -4.8], // rear face of the ring, hidden inside the skin
          [1.51, -4.86], // the inner part runs back to the nose, slightly recessed
          [1.5, ST.throat], // into the duct: the throat, the narrowest point, just aft of the nose
          [1.7, ST.lip],
        ],
        MATS.nacelleLip,
        120
      ),
      outerBelly
    )
  );

  /* Pylon attaching the engine to the wing. The engine is installed with 5° of
     nose-up tilt relative to the aircraft, so the pylon wedge is asymmetric:
     underneath it lies on the nacelle (the engine axis), on top it follows the
     wing chord. Forward the two lines converge - the pylon is thinner at the
     front. The tilt is given to the pylon rather than to the whole model:
     otherwise the flow visualisation and the screen-space heat haze, which live
     in world axes, would have to be rotated along with it. */
  const TILT = Math.tan(THREE.MathUtils.degToRad(5));
  const pylonTop = (x) => 0.72 + (x + 1.9) * TILT;
  const pylonShape = new THREE.Shape();
  pylonShape.moveTo(-2.9, 0);
  pylonShape.lineTo(1.7, 0);
  pylonShape.lineTo(1.9, pylonTop(1.9));
  pylonShape.lineTo(-1.9, pylonTop(-1.9));
  pylonShape.quadraticCurveTo(-2.7, 0.44, -2.9, 0);
  const pylon = new THREE.Mesh(
    new THREE.ExtrudeGeometry(pylonShape, {
      depth: 0.3,
      bevelEnabled: true,
      bevelSize: 0.06,
      bevelThickness: 0.06,
      bevelSegments: 2,
      curveSegments: 12,
    }),
    MATS.pylon
  );
  pylon.name = 'pylon';
  pylon.position.set(0, 2.28, -0.15);
  mNac.add(pylon);

  /* ===================== 2. Fan ====================================== */
  const mFan = module('fan', new THREE.Vector3(-2.6, 0, 0));

  // Fan case with the containment ring. The outer radius is the overall height
  // of the bare engine, 1.829 m; the intake bolts onto this case at flange A1
  // in front, and the accessory gearbox hangs off its side.
  mFan.add(
    lathe(
      [
        [1.6, ST.a1],
        [ST.caseR, ST.a1],
        [ST.caseR, -3.11],
        [1.74, -2.92],
        [1.66, -2.92],
        [1.6, -3.11],
        [1.6, ST.a1],
      ],
      MATS.fanCase,
      96
    )
  );

  const fanRot = rotor(mFan, 1);

  // Spinner (hub fairing). Length 0.50 m, largest radius is the fan hub: the
  // hub-to-tip diameter ratio is 0.32. The nose of the spinner ends up a metre
  // aft of the intake lip - on the 737 it really does sit deep inside the
  // recessed duct.
  const SPINNER_R = 0.5;
  const spinnerPts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const x = THREE.MathUtils.lerp(ST.fan - 1.0, ST.fan, t);
    const r = SPINNER_R * Math.pow(t, 0.72);
    spinnerPts.push([r, x]);
  }
  spinnerPts.push([SPINNER_R, ST.fan + 0.12]);
  fanRot.add(lathe(spinnerPts, MATS.paint, 64));

  // spiral on the spinner (see spiralBlur: at speed it smears into a ring)
  const spiralCurve = new THREE.CatmullRomCurve3(
    Array.from({ length: 60 }, (_, i) => {
      const t = i / 59;
      const x = THREE.MathUtils.lerp(ST.fan - 0.98, ST.fan - 0.04, t);
      const r = (SPINNER_R + 0.005) * Math.pow(t, 0.72) + 0.004;
      const a = t * Math.PI * 2.4;
      return new THREE.Vector3(x, r * Math.cos(a), r * Math.sin(a));
    })
  );
  // coarser tessellation than before: the tube is thin and there are now dozens of copies
  const spiral = new THREE.InstancedMesh(
    new THREE.TubeGeometry(spiralCurve, 88, 0.022, 6),
    MATS.spiral,
    SPIRAL_GHOSTS
  );
  spiral.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  spiral.count = 1;
  fanRot.add(spiral);

  // disc and blade roots
  fanRot.add(drum(ST.fan - 0.12, ST.fan + 0.3, SPINNER_R, SPINNER_R + 0.02, MATS.disk));
  // The largest chord is 0.279 m (11 in) at the tip - hence "wide-chord".
  const fanBlade = makeBladeGeometry({
    hubRadius: SPINNER_R + 0.01,
    tipRadius: ST.fanTip,
    rootChord: 0.47,
    tipChord: 0.558,
    rootStagger: 16,
    tipStagger: 61,
    rootThickness: 0.17,
    tipThickness: 0.045,
    rootCamber: 0.05,
    tipCamber: 0.012,
    sweep: -0.3,
    lean: 0.12,
    radialSegments: 20,
    chordSegments: 22,
    x: ST.fan,
  });
  fanRot.add(bladeRow(fanBlade, MATS.composite, 24));

  // outlet guide vanes of the bypass duct (OGV)
  const ogv = makeBladeGeometry({
    hubRadius: 1.03,
    tipRadius: 1.64,
    rootChord: 0.3,
    tipChord: 0.28,
    rootStagger: 34,
    tipStagger: 26,
    rootThickness: 0.12,
    tipThickness: 0.1,
    rootCamber: 0.09,
    tipCamber: 0.07,
    radialSegments: 8,
    chordSegments: 14,
    x: -2.78,
  });
  mFan.add(bladeRow(ogv, MATS.titanium, 44));

  /* ===================== 3. Booster (LP compressor) ================== */
  const mBoost = module('booster', new THREE.Vector3(-1.7, 0, 0));

  // flow splitter and booster casing
  mBoost.add(
    lathe(
      [
        [0.96, ST.splitter],
        [1.02, ST.splitter + 0.1],
        [1.04, -2.64],
        [0.98, -2.3],
        [0.9, -2.16],
        [0.86, -2.16],
        [0.93, -2.34],
        [0.97, -2.68],
        [0.95, ST.splitter + 0.12],
        [0.9, ST.splitter + 0.03],
        [0.96, ST.splitter],
      ],
      MATS.casing,
      96
    )
  );

  const boostRot = rotor(mBoost, 1);
  boostRot.add(drum(-2.86, -2.28, 0.56, 0.62, MATS.disk));
  const boostStages = [
    { x: ST.boosterIn, hub: 0.58, tip: 0.94, n: 34 },
    { x: -2.56, hub: 0.6, tip: 0.92, n: 40 },
    { x: ST.boosterOut, hub: 0.62, tip: 0.9, n: 46 },
  ];
  /* Compressor and turbine blade chords are set to life-size values: booster
     stage ~50 mm, HPC stage from 39 down to 24 mm, HPT blade ~55 mm, LPT
     ~70 mm. This is not cosmetic - a row occupies chord × cos(stagger) along
     the axis, the stage pitch here is 0.14…0.25 units (70…125 mm), and blades
     with the earlier, poster-sized chords would simply run into each other. */
  boostStages.forEach((s, i) => {
    const g = makeBladeGeometry({
      hubRadius: s.hub,
      tipRadius: s.tip,
      rootChord: 0.1,
      tipChord: 0.092,
      rootStagger: 26 + i * 3,
      tipStagger: 52 + i * 3,
      rootThickness: 0.13,
      tipThickness: 0.07,
      rootCamber: 0.07,
      tipCamber: 0.03,
      radialSegments: 6,
      chordSegments: 12,
      x: s.x,
    });
    boostRot.add(bladeRow(g, MATS.titanium, s.n, i * 0.1));
  });
  // booster stator vanes
  boostStages.forEach((s, i) => {
    const g = makeBladeGeometry({
      hubRadius: s.hub + 0.02,
      tipRadius: s.tip,
      rootChord: 0.085,
      tipChord: 0.08,
      rootStagger: 30,
      tipStagger: 22,
      rootThickness: 0.11,
      tipThickness: 0.09,
      rootCamber: 0.1,
      tipCamber: 0.08,
      radialSegments: 5,
      chordSegments: 10,
      x: s.x + 0.09,
    });
    mBoost.add(bladeRow(g, MATS.steel, s.n + 8, 0.05));
  });

  /* ===================== 4. HP compressor ============================ */
  const mHpc = module('hpc', new THREE.Vector3(-0.8, 0, 0));

  const hpcStages = 9;
  const hpcX = (i) => THREE.MathUtils.lerp(ST.hpcIn, ST.hpcOut, i / (hpcStages - 1));
  const hpcTip = (i) => THREE.MathUtils.lerp(0.78, 0.55, i / (hpcStages - 1));
  const hpcHub = (i) => THREE.MathUtils.lerp(0.5, 0.44, i / (hpcStages - 1));

  // HPC casing
  const hpcCasePts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    hpcCasePts.push([THREE.MathUtils.lerp(0.84, 0.6, t) , THREE.MathUtils.lerp(ST.hpcIn - 0.12, ST.hpcOut + 0.05, t)]);
  }
  for (let i = 10; i >= 0; i--) {
    const t = i / 10;
    hpcCasePts.push([THREE.MathUtils.lerp(0.8, 0.57, t), THREE.MathUtils.lerp(ST.hpcIn - 0.12, ST.hpcOut + 0.05, t)]);
  }
  hpcCasePts.push([0.84, ST.hpcIn - 0.12]);
  mHpc.add(lathe(hpcCasePts, MATS.casing, 96));
  // transition duct from the booster
  mHpc.add(
    lathe(
      [
        [0.9, ST.boosterOut + 0.04],
        [0.86, ST.boosterOut + 0.04],
        [0.8, ST.hpcIn - 0.04],
        [0.84, ST.hpcIn - 0.04],
        [0.9, ST.boosterOut + 0.04],
      ],
      MATS.casing,
      96
    )
  );

  const hpcRot = rotor(mHpc, 2);
  const hpcDrumPts = [];
  for (let i = 0; i < hpcStages; i++) hpcDrumPts.push([hpcHub(i), hpcX(i) - 0.06]);
  for (let i = hpcStages - 1; i >= 0; i--) hpcDrumPts.push([hpcHub(i) * 0.6, hpcX(i)]);
  hpcRot.add(lathe(hpcDrumPts, MATS.disk, 64));

  for (let i = 0; i < hpcStages; i++) {
    const n = 40 + i * 6;
    const g = makeBladeGeometry({
      hubRadius: hpcHub(i),
      tipRadius: hpcTip(i),
      rootChord: THREE.MathUtils.lerp(0.078, 0.048, i / (hpcStages - 1)),
      tipChord: THREE.MathUtils.lerp(0.07, 0.044, i / (hpcStages - 1)),
      rootStagger: 24 + i * 2,
      tipStagger: 48 + i * 1.5,
      rootThickness: 0.12,
      tipThickness: 0.07,
      rootCamber: 0.06,
      tipCamber: 0.025,
      radialSegments: 5,
      chordSegments: 10,
      x: hpcX(i),
    });
    hpcRot.add(bladeRow(g, MATS.titanium, n, i * 0.07));

    // stator vanes of the stage
    const sg = makeBladeGeometry({
      hubRadius: hpcHub(i) + 0.01,
      tipRadius: hpcTip(i) + 0.01,
      rootChord: THREE.MathUtils.lerp(0.068, 0.042, i / (hpcStages - 1)),
      tipChord: THREE.MathUtils.lerp(0.062, 0.04, i / (hpcStages - 1)),
      rootStagger: 30,
      tipStagger: 20,
      rootThickness: 0.11,
      tipThickness: 0.08,
      rootCamber: 0.1,
      tipCamber: 0.07,
      radialSegments: 5,
      chordSegments: 10,
      // stator vanes exactly halfway between stages
      x: hpcX(i) + (ST.hpcOut - ST.hpcIn) / (hpcStages - 1) / 2,
    });
    mHpc.add(bladeRow(sg, MATS.steel, n + 10, 0.04));
  }

  /* ===================== 5. Combustor ================================ */
  const mComb = module('combustor', new THREE.Vector3(0, 0, 0));

  // diffuser
  mComb.add(
    lathe(
      [
        [0.6, ST.hpcOut],
        [0.57, ST.hpcOut],
        [0.42, ST.combIn],
        [0.86, ST.combIn],
        [0.9, ST.combIn + 0.1],
        [0.9, ST.combOut + 0.05],
        [0.86, ST.combOut + 0.05],
        [0.86, ST.combIn + 0.05],
        [0.6, ST.hpcOut],
      ],
      MATS.casingHot,
      96
    )
  );

  // flame tube (outer and inner walls)
  const linerOuter = [];
  const linerInner = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x = THREE.MathUtils.lerp(ST.combIn, ST.combOut, t);
    linerOuter.push([0.78 - 0.1 * t * t, x]);
    linerInner.push([0.44 + 0.06 * t * t, x]);
  }
  mComb.add(lathe(linerOuter, MATS.combLiner, 80));
  mComb.add(lathe(linerInner, MATS.combLiner, 80));
  // combustor dome
  mComb.add(
    lathe(
      [
        [0.44, ST.combIn],
        [0.5, ST.combIn - 0.06],
        [0.72, ST.combIn - 0.06],
        [0.78, ST.combIn],
      ],
      MATS.combLiner,
      80
    )
  );

  // fuel nozzles and swirlers
  ringOf(
    20,
    (i, a) => {
      const g = new THREE.Group();
      const swirl = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.1, 12), MATS.nickel);
      swirl.rotation.z = -Math.PI / 2;
      swirl.position.set(ST.combIn - 0.02, 0, 0);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.26, 8), MATS.steel);
      stem.position.set(ST.combIn - 0.16, 0, 0);
      stem.rotation.z = -Math.PI / 2;
      g.add(swirl, stem);
      g.position.set(0, 0.61 * Math.cos(a), 0.61 * Math.sin(a));
      g.rotation.x = a;
      // fuel line running outboard
      return g;
    },
    mComb
  );

  // flame (additive shader)
  const flamePts = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const x = THREE.MathUtils.lerp(ST.combIn + 0.02, ST.combOut + 0.04, t);
    flamePts.push([0.755 - 0.1 * t * t, x]);
  }
  for (let i = 14; i >= 0; i--) {
    const t = i / 14;
    const x = THREE.MathUtils.lerp(ST.combIn + 0.02, ST.combOut + 0.04, t);
    flamePts.push([0.46 + 0.06 * t * t, x]);
  }
  const flameMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uPower: { value: 0.8 },
      uX0: { value: ST.combIn },
      uX1: { value: ST.combOut },
    },
    vertexShader: `
      varying vec3 vP;
      void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: `
      uniform float uTime, uPower, uX0, uX1;
      varying vec3 vP;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
      float noise(vec3 p){
        vec3 i = floor(p), f = fract(p);
        f = f*f*(3.0-2.0*f);
        float n = mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),
                          mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                      mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                          mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
        return n;
      }
      void main(){
        // vP is in lathe local space: the Y axis is the engine axis
        float t = clamp((vP.y - uX0)/(uX1-uX0), 0.0, 1.0);
        float ang = atan(vP.z, vP.x);
        float n = noise(vec3(ang*3.0, t*6.0 - uTime*3.0, uTime*0.8));
        n = n*0.6 + noise(vec3(ang*7.0, t*14.0 - uTime*6.0, uTime*1.3))*0.4;
        float core = smoothstep(0.0,0.18,t) * (1.0 - smoothstep(0.55,1.0,t));
        float a = core * (0.35 + n*0.9) * uPower;
        vec3 col = mix(vec3(1.0,0.35,0.05), vec3(1.0,0.95,0.75), clamp(n*1.3 - t*0.4,0.0,1.0));
        col = mix(col, vec3(0.55,0.75,1.0), smoothstep(0.0,0.12,t)*0.25*(1.0-t));
        gl_FragColor = vec4(col, a);
      }
    `,
  });
  const flame = lathe(flamePts, flameMat, 72);
  flame.renderOrder = 3;
  mComb.add(flame);

  /* ===================== 6. HP turbine =============================== */
  const mHpt = module('hpt', new THREE.Vector3(0.9, 0, 0));
  mHpt.add(
    lathe(
      [
        [0.94, ST.hptIn - 0.06],
        [0.9, ST.hptIn - 0.06],
        [0.95, ST.hptOut + 0.1],
        [0.99, ST.hptOut + 0.1],
        [0.94, ST.hptIn - 0.06],
      ],
      MATS.casingHot,
      96
    )
  );

  const hptRot = rotor(mHpt, 2);
  // A single stage: nozzle guide vanes and the rotor.
  const hptStages = [{ x: 0.02, hub: 0.46, tip: 0.86, n: 62, ngv: -0.12 }];
  hptStages.forEach((s, i) => {
    // nozzle guide vanes
    const ngv = makeBladeGeometry({
      hubRadius: s.hub,
      tipRadius: s.tip + 0.02,
      rootChord: 0.14,
      tipChord: 0.13,
      rootStagger: 52,
      tipStagger: 44,
      rootThickness: 0.26,
      tipThickness: 0.2,
      rootCamber: 0.16,
      tipCamber: 0.13,
      radialSegments: 6,
      chordSegments: 14,
      x: s.ngv,
    });
    mHpt.add(bladeRow(ngv, MATS.nickel, 44 + i * 6, 0.03));

    const g = makeBladeGeometry({
      hubRadius: s.hub,
      tipRadius: s.tip,
      rootChord: 0.12,
      tipChord: 0.11,
      rootStagger: 32,
      tipStagger: 52,
      rootThickness: 0.24,
      tipThickness: 0.14,
      rootCamber: 0.14,
      tipCamber: 0.09,
      radialSegments: 6,
      chordSegments: 14,
      x: s.x,
    });
    hptRot.add(bladeRow(g, MATS.turbineHot, s.n, i * 0.05));
    hptRot.add(drum(s.x - 0.07, s.x + 0.07, s.hub, s.hub, MATS.diskHot));
  });
  hptRot.add(drum(ST.hptIn + 0.04, ST.hptOut - 0.02, 0.44, 0.44, MATS.diskHot));

  /* ===================== 7. LP turbine =============================== */
  const mLpt = module('lpt', new THREE.Vector3(1.9, 0, 0));

  const lptCase = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    lptCase.push([THREE.MathUtils.lerp(0.99, 1.12, t), THREE.MathUtils.lerp(ST.lptIn - 0.16, ST.lptOut + 0.14, t)]);
  }
  for (let i = 8; i >= 0; i--) {
    const t = i / 8;
    lptCase.push([THREE.MathUtils.lerp(0.95, 1.08, t), THREE.MathUtils.lerp(ST.lptIn - 0.16, ST.lptOut + 0.14, t)]);
  }
  lptCase.push([0.99, ST.lptIn - 0.16]);
  mLpt.add(lathe(lptCase, MATS.casingHot, 96));
  // transition duct from the HP turbine
  mLpt.add(
    lathe(
      [
        [0.99, ST.hptOut + 0.08],
        [0.95, ST.hptOut + 0.08],
        [0.95, ST.lptIn - 0.14],
        [0.99, ST.lptIn - 0.14],
        [0.99, ST.hptOut + 0.08],
      ],
      MATS.casingHot,
      96
    )
  );

  const lptRot = rotor(mLpt, 1);
  const lptN = 4;
  for (let i = 0; i < lptN; i++) {
    const t = i / (lptN - 1);
    const x = THREE.MathUtils.lerp(ST.lptIn, ST.lptOut, t);
    const hub = THREE.MathUtils.lerp(0.5, 0.6, t);
    const tip = THREE.MathUtils.lerp(0.93, 1.1, t);

    const ngv = makeBladeGeometry({
      hubRadius: hub,
      tipRadius: tip + 0.02,
      rootChord: 0.13,
      tipChord: 0.12,
      rootStagger: 48,
      tipStagger: 40,
      rootThickness: 0.2,
      tipThickness: 0.15,
      rootCamber: 0.15,
      tipCamber: 0.12,
      radialSegments: 6,
      chordSegments: 12,
      x: x - 0.105,
    });
    mLpt.add(bladeRow(ngv, MATS.nickel, 68 + i * 4, 0.02));

    const g = makeBladeGeometry({
      hubRadius: hub,
      tipRadius: tip,
      rootChord: 0.14,
      tipChord: 0.13,
      rootStagger: 30,
      tipStagger: 56,
      rootThickness: 0.18,
      tipThickness: 0.1,
      rootCamber: 0.13,
      tipCamber: 0.08,
      radialSegments: 6,
      chordSegments: 12,
      x,
    });
    lptRot.add(bladeRow(g, MATS.turbineHot, 82 + i * 6, i * 0.04));
    lptRot.add(drum(x - 0.07, x + 0.07, hub, hub, MATS.diskHot));
  }
  lptRot.add(drum(ST.lptIn - 0.1, ST.lptOut + 0.1, 0.46, 0.5, MATS.diskHot));

  /* ===================== 8. Rear frame and nozzle ==================== */
  const mExh = module('exhaust', new THREE.Vector3(2.9, 0, 0));
  const strut = makeBladeGeometry({
    hubRadius: 0.56,
    tipRadius: 1.12,
    rootChord: 0.26,
    tipChord: 0.24,
    rootStagger: 6,
    tipStagger: 2,
    rootThickness: 0.2,
    tipThickness: 0.16,
    rootCamber: 0.02,
    tipCamber: 0.01,
    radialSegments: 5,
    chordSegments: 12,
    x: ST.frame + 0.04,
  });
  mExh.add(bladeRow(strut, MATS.nickel, 10));
  mExh.add(
    lathe(
      [
        [1.12, ST.lptOut + 0.12],
        [1.08, ST.lptOut + 0.12],
        [0.74, ST.coreExit],
        [0.78, ST.coreExit],
        [1.12, ST.lptOut + 0.12],
      ],
      MATS.casingHot,
      96
    )
  );
  // exhaust plug
  const plugPts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    plugPts.push([0.56 * Math.pow(1 - t, 0.75), THREE.MathUtils.lerp(ST.frame + 0.1, ST.plugTip, t)]);
  }
  const plug = lathe([[0.56, ST.frame - 0.1], ...plugPts], MATS.nickel, 72);
  mExh.add(plug);

  /* ===================== 9. Core cowl ================================ */
  const mCowl = module('cowl', new THREE.Vector3(0, -3.4, 0));
  // The outer surface of the cowl is the inner wall of the bypass duct. Its
  // radius, together with the nacelle barrel, sets the fan nozzle area: at 1.62
  // and 1.14 units at the exit that is 1.04 m² - which is what the bypass duct
  // needs at a bypass ratio of 5.1 and a flow of about 355 kg/s at take-off.
  const cowlPts = [
    [0.95, ST.splitter],
    [1.05, -2.61],
    [1.1, -1.86],
    [1.14, -0.76],
    [1.16, -0.02],
    [1.18, 0.48],
    [1.22, 0.88],
    [1.22, 1.28],
    [1.14, 1.9],
    [0.92, 2.5],
    [0.82, ST.coreExit],
    [0.78, ST.coreExit],
    [0.88, 2.5],
    [1.1, 1.9],
    [1.18, 1.28],
    [1.18, 0.88],
    [1.14, 0.48],
    [1.12, -0.02],
    [1.1, -0.76],
    [1.06, -1.86],
    [1.01, -2.61],
    [0.92, ST.splitter],
    [0.95, ST.splitter],
  ];
  mCowl.add(lathe(cowlPts, MATS.coreCowl, 96));

  /* ===================== 10. Shafts and accessories ================== */
  const mShaft = module('shafts', new THREE.Vector3(0, 0, 0));
  const lpShaftRot = rotor(mShaft, 1);
  const lp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4.8, 24), MATS.shaft);
  lp.rotation.z = -Math.PI / 2;
  lp.position.x = -1.01;
  lpShaftRot.add(lp);
  // splines and flanges of the LP shaft
  [-3.16, 1.24].forEach((x) => {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 24), MATS.shaft);
    f.rotation.z = -Math.PI / 2;
    f.position.x = x;
    lpShaftRot.add(f);
  });

  const hpShaftRot = rotor(mShaft, 2);
  hpShaftRot.add(tube(-2.31, 0.1, 0.24, 0.3, MATS.shaft, 32));

  // bearing supports
  [
    [-3.11, 0.34],
    [-2.36, 0.36],
    [0.22, 0.36],
    [1.38, 0.3],
  ].forEach(([x, r]) => {
    const b = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 8, 32), MATS.steel);
    b.rotation.y = Math.PI / 2;
    b.position.x = x;
    mShaft.add(b);
  });

  const mAcc = module('accessory', AGB_EXPLODE);
  // Everything bolted on is laid out as if it hung underneath, then the whole
  // assembly is rotated to the side: that keeps the bottom of the engine clear
  // for the flat nacelle.
  const accSide = new THREE.Group();
  accSide.rotation.x = AGB_TILT;
  mAcc.add(accSide);

  // The gearbox sits on the fan case (radius 1.829) and reaches out to 2.118 -
  // which is exactly the overall width of the bare engine, 2.118 m against a
  // height of 1.829 m: the gearbox is what makes the difference. Beyond it
  // there are 0.16 m left to the nacelle skin - which is why the 737 nacelle is
  // so full despite a comparatively small fan.
  const gearbox = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 0.7), MATS.accessory);
  gearbox.position.set(-2.46, -1.92, 0);
  gearbox.rotation.z = 0.03;
  accSide.add(gearbox);
  // The accessories are offset sideways from the gearbox, so their far corner
  // lies further from the axis than their face: it is that corner which is set
  // to the 2.118 limit.
  [[-2.96, 0.2], [-2.46, 0.22], [-1.96, 0.19]].forEach(([x, r], i) => {
    const acc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.44, 16), MATS.accessory);
    acc.rotation.x = Math.PI / 2;
    // the i * 0.02 step nudges the accessories inward so that the first of them
    // holds the limit instead of the whole group drifting apart
    acc.position.set(x, -(Math.sqrt(ST.accR ** 2 - 0.74 ** 2) - r) + i * 0.02, 0.52);
    accSide.add(acc);
  });
  // radial drive shaft from the HP shaft down to the gearbox
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.15, 12), MATS.steel);
  tower.position.set(-2.96, -1.3, 0);
  tower.rotation.z = 0.2;
  accSide.add(tower);
  // pipework along the core
  [0.35, -0.35].forEach((z) => {
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.66, -1.15, z * 0.6),
      new THREE.Vector3(-1.96, -1.32, z),
      new THREE.Vector3(-0.86, -1.28, z * 0.9),
      new THREE.Vector3(-0.06, -1.15, z * 0.5),
    ]);
    accSide.add(new THREE.Mesh(new THREE.TubeGeometry(c, 40, 0.045, 8), MATS.steel));
  });

  /* ===================== module labels =============================== */
  // Keys rather than text, for the same reason as the module cards: main.js
  // resolves them, and can re-resolve them when the language changes.
  const labels = [
    { module: mNac, key: 'label.nacelle', pos: new THREE.Vector3(-4.0, 2.5, 0) },
    { module: mFan, key: 'label.fan', pos: new THREE.Vector3(ST.fan, 1.7, 0) },
    { module: mBoost, key: 'label.booster', pos: new THREE.Vector3(-2.56, 1.02, 0) },
    { module: mHpc, key: 'label.hpc', pos: new THREE.Vector3(-1.61, 0.9, 0) },
    { module: mComb, key: 'label.combustor', pos: new THREE.Vector3(-0.56, 0.98, 0) },
    { module: mHpt, key: 'label.hpt', pos: new THREE.Vector3(-0.03, 1.02, 0) },
    { module: mLpt, key: 'label.lpt', pos: new THREE.Vector3(0.74, 1.18, 0) },
    { module: mExh, key: 'label.nozzle', pos: new THREE.Vector3(3.2, 0.85, 0) },
    { module: mShaft, key: 'label.shafts', pos: new THREE.Vector3(-0.96, -0.42, 0) },
    {
      module: mAcc,
      key: 'label.accessory',
      // the label swings to the side together with the gearbox itself
      pos: new THREE.Vector3(-2.46, -2.3, 0).applyAxisAngle(AGB_AXIS, AGB_TILT),
    },
  ];

  modules.forEach((m) => m.userData.base.copy(m.position));

  /* ------- invisible proxy volumes for fast module picking ----------- *
   * Raycasting the real geometry (hundreds of thousands of triangles) on
   * every mouse move is far too expensive, so we pick simplified shells. */
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });
  const pickables = [];
  const PROXY = [
    [mNac, ST.lip, ST.bypassExit, 2.3, true],
    [mFan, ST.fan - 1.05, -2.72, 1.55, false],
    [mBoost, ST.splitter, -2.26, 0.95, false],
    [mHpc, -2.26, -0.94, 0.8, false],
    [mComb, -0.94, -0.22, 0.88, false],
    [mHpt, -0.22, 0.24, 0.95, false],
    [mLpt, 0.24, 1.24, 1.12, false],
    [mExh, 1.24, ST.plugTip, 0.9, false],
    [mCowl, -2.81, ST.coreExit, 1.15, true],
    [mShaft, -3.26, 1.34, 0.33, false],
  ];
  PROXY.forEach(([mod, x0, x1, r, shell]) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, x1 - x0, 20, 1, true), pickMat);
    mesh.rotation.z = -Math.PI / 2;
    mesh.position.x = (x0 + x1) / 2;
    mesh.userData.shell = shell;
    mod.add(mesh);
    pickables.push(mesh);
  });
  {
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 1.4), pickMat);
    box.position.set(-2.56, -1.5, 0);
    accSide.add(box); // the proxy swings to the side with the accessories
    pickables.push(box);
  }

  /* --------------------- spinner spiral smear ---------------------- */
  const _spiralM = new THREE.Matrix4();
  let shownGhosts = -1;
  let shownSpread = -1;

  /** @param {number} keff effective regime 0..1 */
  function setSpiralBlur(keff) {
    const { ghosts, spread, opacity } = spiralBlur(keff);
    MATS.spiral.opacity = opacity;
    // while the spiral is opaque, let it write depth so it does not show through itself
    MATS.spiral.depthWrite = opacity > 0.95;
    if (ghosts === shownGhosts && Math.abs(spread - shownSpread) < 0.004) return;
    shownGhosts = ghosts;
    shownSpread = spread;
    spiral.count = ghosts;
    for (let i = 0; i < ghosts; i++) {
      // the copies trail backwards along the rotation - it is a wake, not a lead
      _spiralM.makeRotationX(ghosts > 1 ? -spread * (i / (ghosts - 1)) : 0);
      spiral.setMatrixAt(i, _spiralM);
    }
    spiral.instanceMatrix.needsUpdate = true;
  }

  return {
    root,
    modules,
    pickables,
    n1Rotors,
    n2Rotors,
    labels,
    flameMat,
    setSpiralBlur,
    parts: { mNac, mFan, mBoost, mHpc, mComb, mHpt, mLpt, mExh, mCowl, mShaft, mAcc },
  };
}
