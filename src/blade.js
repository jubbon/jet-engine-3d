import * as THREE from 'three';

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Blade section (NACA-like) in fractions of chord.
 * Returns a closed contour: [c, n], where c is chord fraction 0..1 and n is the
 * offset along the normal.
 */
function airfoilSection(n, thickness, camber, camberPos) {
  const upper = [];
  const lower = [];
  const p = Math.max(0.05, Math.min(0.95, camberPos));

  for (let i = 0; i <= n; i++) {
    // cosine clustering of points towards the leading and trailing edges
    const x = 0.5 * (1 - Math.cos((Math.PI * i) / n));
    const yt =
      5 *
      thickness *
      (0.2969 * Math.sqrt(x) -
        0.126 * x -
        0.3516 * x * x +
        0.2843 * x * x * x -
        0.1036 * x * x * x * x);

    let yc, dyc;
    if (x < p) {
      yc = (camber / (p * p)) * (2 * p * x - x * x);
      dyc = ((2 * camber) / (p * p)) * (p - x);
    } else {
      const q = 1 - p;
      yc = (camber / (q * q)) * (1 - 2 * p + 2 * p * x - x * x);
      dyc = ((2 * camber) / (q * q)) * (p - x);
    }
    const th = Math.atan(dyc);
    upper.push([x - yt * Math.sin(th), yc + yt * Math.cos(th)]);
    lower.push([x + yt * Math.sin(th), yc - yt * Math.cos(th)]);
  }

  // closed contour: upper LE->TE, lower TE->LE (no duplicates at the edges)
  const pts = upper.slice(0, upper.length - 1);
  for (let i = lower.length - 1; i > 0; i--) pts.push(lower[i]);
  return pts;
}

/**
 * Geometry of a single blade: the section is lofted along the radius with twist
 * (stagger) and with varying chord, thickness and camber.
 * The engine axis is X; the blade is built in the plane phi = 0 (radially up, +Y).
 */
export function makeBladeGeometry(opt = {}) {
  const o = {
    hubRadius: 0.5,
    tipRadius: 1.5,
    rootChord: 0.5,
    tipChord: 0.5,
    rootStagger: 20,
    tipStagger: 60,
    rootThickness: 0.14,
    tipThickness: 0.06,
    rootCamber: 0.06,
    tipCamber: 0.02,
    camberPos: 0.45,
    sweep: 0, // axial offset of the blade tip (- forward)
    lean: 0, // circumferential lean of the blade tip
    radialSegments: 12,
    chordSegments: 16,
    x: 0,
    ...opt,
  };

  const nR = o.radialSegments;
  const positions = [];
  const indices = [];
  const rings = [];

  for (let i = 0; i <= nR; i++) {
    const s = i / nR;
    const r = lerp(o.hubRadius, o.tipRadius, s);
    const chord = lerp(o.rootChord, o.tipChord, s);
    const stag = THREE.MathUtils.degToRad(lerp(o.rootStagger, o.tipStagger, s));
    const thick = lerp(o.rootThickness, o.tipThickness, s);
    const camb = lerp(o.rootCamber, o.tipCamber, s);
    const prof = airfoilSection(o.chordSegments, thick, camb, o.camberPos);

    const axOff = o.x + o.sweep * s * s;
    const tgOff = o.lean * s * s;

    const ring = [];
    const cs = Math.cos(stag);
    const sn = Math.sin(stag);
    for (let j = 0; j < prof.length; j++) {
      const dx = (prof[j][0] - 0.5) * chord;
      const dn = prof[j][1] * chord;
      const ax = axOff + dx * cs - dn * sn;
      const tg = tgOff + dx * sn + dn * cs;
      const ang = tg / r; // wrapping the section around the circumference
      ring.push(positions.length / 3);
      positions.push(ax, r * Math.cos(ang), r * Math.sin(ang));
    }
    rings.push(ring);
  }

  const P = rings[0].length;
  for (let i = 0; i < nR; i++) {
    for (let j = 0; j < P; j++) {
      const j2 = (j + 1) % P;
      const a = rings[i][j];
      const b = rings[i][j2];
      const c = rings[i + 1][j2];
      const d = rings[i + 1][j];
      indices.push(a, b, c, a, c, d);
    }
  }

  // end caps (root and tip)
  const capRing = (ring, flip) => {
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const idx of ring) {
      cx += positions[idx * 3];
      cy += positions[idx * 3 + 1];
      cz += positions[idx * 3 + 2];
    }
    const n = ring.length;
    const center = positions.length / 3;
    positions.push(cx / n, cy / n, cz / n);
    for (let j = 0; j < n; j++) {
      const a = ring[j];
      const b = ring[(j + 1) % n];
      if (flip) indices.push(center, b, a);
      else indices.push(center, a, b);
    }
  };
  capRing(rings[0], true);
  capRing(rings[nR], false);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/**
 * Blade row: an InstancedMesh with `count` blades around the circumference.
 */
export function bladeRow(geometry, material, count, phase = 0) {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    m.makeRotationX(phase + (i / count) * Math.PI * 2);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
