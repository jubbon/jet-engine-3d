import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  Flow visualisation: the bypass (cold) duct and the core (hot) duct.
 *  Particles travel along the ducts, changing colour according to the
 *  gas temperature at the station they are passing.
 * ------------------------------------------------------------------ */

// piecewise-linear interpolation over a table of [[x, value], ...]
function pw(table, x) {
  if (x <= table[0][0]) return table[0][1];
  const n = table.length;
  if (x >= table[n - 1][0]) return table[n - 1][1];
  for (let i = 1; i < n; i++) {
    if (x <= table[i][0]) {
      const [x0, v0] = table[i - 1];
      const [x1, v1] = table[i];
      const t = (x - x0) / (x1 - x0);
      return v0 + (v1 - v0) * t;
    }
  }
  return table[n - 1][1];
}

const X_START = -7.6;
const X_END = 8.6;

// smooth fade-in/fade-out of particles and streamlines at the domain edges
function edgeFade(x) {
  const inF = THREE.MathUtils.smoothstep(x, X_START, X_START + 1.6);
  const outF = 1 - THREE.MathUtils.smoothstep(x, X_END - 3.2, X_END);
  return inF * outF;
}

/* Duct boundaries follow the stations from src/engine.js: intake lip -5.20,
   fan plane -3.22, splitter -2.86, fan nozzle exit 1.16, core nozzle exit
   2.90, plug tip 4.80. */

/* Where the bypass air turns round when the reverser is out: the blocker doors
   stand across the duct at the aft edge of the cascade band, and the way out is
   the band itself, immediately forward of them. The station is ST.cascadeAft in
   engine.js, copied rather than imported for the same reason as the tables
   above - this module depends on nothing, and importing engine.js for one
   number would drag the materials, the livery canvas and buildEngine into its
   graph. */
export const X_DOORS = 0.11;
// The cascades turn the flow to about 45° forward of radial. Any steeper and
// the air would appear to leave along the nacelle rather than away from it.
const TURN_COS = Math.SQRT1_2;
// How far out a deflected particle is followed before it is recycled. The skin
// is 0.7 units out from the duct at that station, so this is comfortably clear
// of the nacelle.
const TURN_REACH = 1.5;

/* Where a surge throws the core gas back from. The window runs from the booster
   face to the turbine exit - the compressor and the burner, the part of the gas
   path that is actually behind the blockage - so gas already past the turbine
   carries on out of the nozzle, which is what it does.

   These are stations from engine.js, copied for the same reason as X_DOORS
   above: this module depends on nothing, and importing engine.js for three
   numbers would drag the materials, the livery canvas and buildEngine into its
   graph. */
const X_SURGE_FROM = -3.22; // fan/booster face
const X_SURGE_TO = 0.12; // turbine exit

/* What fraction of the core particles in that window a single bang throws
   forward. A visual density choice rather than a physical one - surge.js owns
   how hard the flow reverses, this owns how many dots say so. Everything looks
   like a solid plug of gas at 1.0 and like a leak at 0.2. */
const EXPEL_FRACTION = 0.6;

/* Rotating stall: two cells, each covering this much of the circumference. They
   travel at STALL_CELL of rotor speed - slower than the rotor, which is the
   whole visual point, since a stall cell propagates rather than being carried
   round with the blades - and the flow inside one barely moves. */
const STALL_SECTORS = 2;
const STALL_ARC = Math.PI * 0.28; // ~50 degrees each
const STALL_SLOW = 0.15; // what is left of the axial speed inside a cell

// Bypass duct: inner and outer boundaries of the channel
const BYPASS_IN = [
  [X_START, 0.6], [-5.2, 0.66], [-3.22, 0.98], [-2.86, 1.0], [-1.86, 1.1],
  [-0.76, 1.14], [1.16, 1.26], [1.4, 1.26], [1.9, 1.18], [2.5, 0.96], [2.9, 0.86], [4.8, 0.86], [X_END, 0.84],
];
const BYPASS_OUT = [
  [X_START, 1.4], [-5.2, 1.52], [-3.22, 1.56], [-2.86, 1.62], [-1.86, 1.68],
  [0.3, 1.66], [1.16, 1.6], [2.3, 1.55], [2.9, 1.52], [4.8, 1.62], [X_END, 1.85],
];
const CORE_IN = [
  [X_START, 0.06], [-5.2, 0.12], [-3.96, 0.3], [-3.22, 0.52], [-2.74, 0.58],
  [-2.38, 0.62], [-2.18, 0.52], [-1.04, 0.46], [-0.84, 0.47], [-0.28, 0.51],
  [0.12, 0.47], [1.11, 0.6], [1.48, 0.57], [2.9, 0.5], [4.8, 0.06],
  [6.5, 0.02], [X_END, 0.02],
];
const CORE_OUT = [
  [X_START, 0.46], [-5.2, 0.55], [-3.96, 0.72], [-3.22, 0.94], [-2.74, 0.91],
  [-2.38, 0.87], [-2.18, 0.76], [-1.04, 0.55], [-0.84, 0.75], [-0.28, 0.67],
  [0.12, 0.86], [1.11, 1.07], [1.48, 1.08], [2.9, 0.86], [4.8, 0.8],
  [6.5, 0.95], [X_END, 1.25],
];

// axial velocity (model units per second at 100 % power)
const BYPASS_V = [
  [X_START, 2.4], [-5.2, 2.3], [-3.22, 2.5], [-2.66, 2.7], [0.7, 2.9],
  [1.16, 4.4], [2.6, 4.2], [X_END, 3.4],
];
const CORE_V = [
  [X_START, 2.4], [-5.2, 2.2], [-3.22, 2.0], [-2.18, 1.5], [-1.04, 0.95],
  [-0.84, 0.8], [-0.28, 1.3], [0.12, 2.3], [1.11, 3.3], [2.9, 5.4],
  [5.5, 4.6], [X_END, 3.4],
];

// flow swirl (rad/s)
const CORE_SWIRL = [
  [X_START, 0], [-3.26, 0], [-3.18, 2.6], [-2.26, 2.2], [-1.06, 1.6], [-0.81, 0.6],
  [-0.21, 1.0], [-0.06, 3.4], [1.14, 2.6], [1.44, 0.3], [X_END, 0.1],
];
const BYPASS_SWIRL = [
  [X_START, 0], [-3.26, 0], [-3.18, 2.4], [-2.81, 1.9], [-2.66, 0.35], [X_END, 0.2],
];

// relative temperature 0..1
const CORE_T = [
  [X_START, 0.02], [-3.22, 0.04], [-2.74, 0.09], [-2.38, 0.14], [-2.18, 0.16],
  [-1.04, 0.44], [-0.84, 0.46], [-0.66, 0.96], [-0.43, 1.0], [-0.18, 0.92],
  [0.12, 0.78], [1.11, 0.6], [2.9, 0.54], [5.5, 0.4], [X_END, 0.26],
];
const BYPASS_T = [
  [X_START, 0.0], [-3.22, 0.01], [-2.76, 0.08], [1.16, 0.09], [3.2, 0.05], [X_END, 0.02],
];

// temperature colour ramp
const RAMP = [
  [0.0, 0x2f6bff], [0.12, 0x39b7ff], [0.28, 0x63efe2], [0.42, 0xffe066],
  [0.6, 0xff9b3d], [0.78, 0xff4f1a], [1.0, 0xfff4d2],
];
const rampColors = RAMP.map(([p, hex]) => [p, new THREE.Color(hex)]);

const _c0 = new THREE.Color();
export function tempColor(t, out = _c0) {
  t = THREE.MathUtils.clamp(t, 0, 1);
  for (let i = 1; i < rampColors.length; i++) {
    if (t <= rampColors[i][0]) {
      const [p0, c0] = rampColors[i - 1];
      const [p1, c1] = rampColors[i];
      return out.copy(c0).lerp(c1, (t - p0) / (p1 - p0));
    }
  }
  return out.copy(rampColors[rampColors.length - 1][1]);
}

/* --------------------------- streamlines --------------------------- */

function streamTube(inTable, outTable, tTable, lane, phase, swirlTable, radius) {
  const pts = [];
  const cols = [];
  const N = 160;
  let ang = phase;
  let prevX = X_START;
  for (let i = 0; i <= N; i++) {
    const x = THREE.MathUtils.lerp(X_START, X_END, i / N);
    const r = THREE.MathUtils.lerp(pw(inTable, x), pw(outTable, x), lane);
    const v = Math.max(0.4, pw(inTable === CORE_IN ? CORE_V : BYPASS_V, x));
    ang += (pw(swirlTable, x) / v) * (x - prevX) * 0.55;
    prevX = x;
    pts.push(new THREE.Vector3(x, r * Math.cos(ang), r * Math.sin(ang)));
    cols.push(pw(tTable, x));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, N, radius, 6, false);
  const colors = new Float32Array(geo.attributes.position.count * 3);
  const c = new THREE.Color();
  const seg = N;
  for (let i = 0; i < geo.attributes.position.count; i++) {
    const ring = Math.min(seg, Math.floor(i / 7)); // (radialSegments+1) vertices per ring
    tempColor(cols[ring], c);
    const f = edgeFade(THREE.MathUtils.lerp(X_START, X_END, ring / seg));
    colors[i * 3] = c.r * f;
    colors[i * 3 + 1] = c.g * f;
    colors[i * 3 + 2] = c.b * f;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/* ----------------------------- system ------------------------------ */

export function createAirflow() {
  const group = new THREE.Group();
  group.visible = false;

  const N_BYPASS = 5200;
  const N_CORE = 3600;
  const N = N_BYPASS + N_CORE;

  const positions = new Float32Array(N * 3);
  const colors = new Float32Array(N * 3);
  const sizes = new Float32Array(N);

  const px = new Float32Array(N);
  const lane = new Float32Array(N);
  const phase = new Float32Array(N);
  const jitter = new Float32Array(N);
  const isCore = new Uint8Array(N);
  // has this particle been turned round by the blocker doors, and how far out
  // through the cascades it has got since
  const turned = new Uint8Array(N);
  const outward = new Float32Array(N);
  // and has this one been thrown back out of the intake by a surge
  const expelled = new Uint8Array(N);

  function respawn(i, initial) {
    px[i] = initial ? THREE.MathUtils.lerp(X_START, X_END, Math.random()) : X_START + Math.random() * 0.8;
    lane[i] = Math.random();
    phase[i] = Math.random() * Math.PI * 2;
    jitter[i] = (Math.random() - 0.5) * 0.05;
    turned[i] = 0;
    outward[i] = 0;
    expelled[i] = 0;
  }
  for (let i = 0; i < N; i++) {
    isCore[i] = i >= N_BYPASS ? 1 : 0;
    respawn(i, true);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('acolor', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('asize', new THREE.BufferAttribute(sizes, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 14);

  const pointMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uOpacity: { value: 1.0 }, uScale: { value: 1.0 } },
    vertexShader: `
      attribute vec3 acolor;
      attribute float asize;
      varying vec3 vColor;
      uniform float uScale;
      void main(){
        vColor = acolor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = asize * uScale * 260.0 / max(0.001, -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      uniform float uOpacity;
      void main(){
        vec2 d = gl_PointCoord - vec2(0.5);
        float r = dot(d, d);
        if (r > 0.25) discard;
        float a = smoothstep(0.25, 0.02, r);
        gl_FragColor = vec4(vColor, a * uOpacity);
      }
    `,
  });
  const points = new THREE.Points(geo, pointMat);
  points.frustumCulled = false;
  points.renderOrder = 5;
  group.add(points);

  /* ---- streamlines ---- */
  const lineMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const linesGroup = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const g = streamTube(BYPASS_IN, BYPASS_OUT, BYPASS_T, 0.15 + 0.7 * (i / 6), (i / 7) * Math.PI * 2, BYPASS_SWIRL, 0.012);
    linesGroup.add(new THREE.Mesh(g, lineMat));
  }
  for (let i = 0; i < 5; i++) {
    const g = streamTube(CORE_IN, CORE_OUT, CORE_T, 0.2 + 0.6 * (i / 4), (i / 5) * Math.PI * 2 + 0.4, CORE_SWIRL, 0.011);
    linesGroup.add(new THREE.Mesh(g, lineMat));
  }
  linesGroup.renderOrder = 4;
  group.add(linesGroup);

  /* ---- exhaust plume ---- */
  const plumeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uPower: { value: 0.7 } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
    fragmentShader: `
      uniform float uTime, uPower;
      varying vec3 vP;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1)))*43758.5453); }
      float noise(vec2 p){
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
      }
      void main(){
        float t = clamp((vP.x - 2.9) / 5.0, 0.0, 1.0);
        float ang = atan(vP.z, vP.y);
        float n = noise(vec2(ang*2.5, t*7.0 - uTime*4.5));
        float a = (1.0 - t) * (1.0 - t) * (0.12 + n * 0.5) * uPower;
        vec3 col = mix(vec3(1.0, 0.55, 0.18), vec3(0.55, 0.18, 0.45), t);
        gl_FragColor = vec4(col, a * 0.3);
      }
    `,
  });
  /* The argument order is the trap here. CylinderGeometry takes (radiusTop,
     radiusBottom) with the top at +Y, and rotateZ(-PI/2) carries +Y to +X —
     downstream. So radiusTop is the tail of the jet and radiusBottom is the
     mouth of the nozzle, which is the opposite way round from how the pair
     reads. Written the other way it produced a cone Ø 1.5 m wide at a nozzle
     of Ø 0.82 m, standing outside the cowl against the sky with a hard bright
     rim — and narrowing downstream, where a jet entrains air and spreads.
     0.8 is the cowl lip at ST.coreExit (0.82, measured), so the cone leaves
     the metal flush; test/clearance.test.mjs holds it to both. */
  const plumeGeo = new THREE.CylinderGeometry(1.5, 0.8, 5.0, 40, 12, true);
  plumeGeo.rotateZ(-Math.PI / 2);
  plumeGeo.translate(5.4, 0, 0); // measured from the core nozzle exit (2.90)
  const plume = new THREE.Mesh(plumeGeo, plumeMat);
  plume.renderOrder = 6;
  group.add(plume);

  const col = new THREE.Color();
  let time = 0;

  /**
   * @param {number} dt
   * @param {number} level - fan speed 0..1 (airflow)
   * @param {number} burn  - combustion intensity 0..1 (heating of the core duct)
   * @param {number} blocked - how much of the bypass duct the reverser's
   *        blocker doors have closed, 0..1. Only the bypass stream is affected:
   *        a cascade reverser does nothing to the core, which is why the plume,
   *        the heat haze and the contrail all carry on unchanged.
   * @param {object} [surge] - compressor stability, or null when there is
   *        nothing to say. One object rather than three more positional
   *        arguments: this call already takes four, and seven would be seven
   *        chances to transpose two of them at the call site.
   *        `{ state, bang, reverse, cell }` - `bang` true on the frame a bang
   *        was latched, which is when a cohort is thrown forward.
   *        The bypass duct is untouched throughout: a surge is a core event,
   *        and the fan is still being driven by a turbine that is still fed.
   */
  function update(dt, level, burn = 1, blocked = 0, surge = null) {
    if (!group.visible) return;
    time += dt;
    plumeMat.uniforms.uTime.value = time;
    plumeMat.uniforms.uPower.value = 0.15 + burn * 1.1;

    // without combustion the core duct is just cold air being pumped through
    const heat = Math.max(level * 0.22, burn);
    const speedK = 0.06 + 1.05 * level;
    const banging = Boolean(surge && surge.bang && surge.reverse > 0);
    const stalling = Boolean(surge && surge.state === 'stall');
    for (let i = 0; i < N; i++) {
      const core = isCore[i] === 1;
      const inT = core ? CORE_IN : BYPASS_IN;
      const outT = core ? CORE_OUT : BYPASS_OUT;
      const vT = core ? CORE_V : BYPASS_V;
      const sT = core ? CORE_SWIRL : BYPASS_SWIRL;
      const tT = core ? CORE_T : BYPASS_T;

      let v = pw(vT, px[i]) * speedK;

      /* Rotating stall: a couple of cells travelling round the annulus at half
         rotor speed, with the flow inside them almost stopped. The cell angle
         comes from surge.js, so the number that governs what is seen is the one
         the test checks. */
      if (core && stalling) {
        const rel = phase[i] - surge.cell;
        for (let k = 0; k < STALL_SECTORS; k++) {
          const d = Math.abs(
            ((rel - (k * Math.PI * 2) / STALL_SECTORS + Math.PI) % (Math.PI * 2)) - Math.PI
          );
          if (d < STALL_ARC / 2) {
            v *= STALL_SLOW;
            break;
          }
        }
      }

      if (expelled[i]) {
        /* Back out of the intake. The compressor has stopped holding the
           pressure behind it, so the gas in the compressor and the burner goes
           the only way left - forward, past the fan and out of the lip, hot.
           It keeps the colour the temperature table gives it, so nothing new is
           needed to make it leave orange. */
        px[i] -= v * dt;
        // the mirror of the px > X_END line below: without it a particle
        // travelling forward runs straight through the respawn window and on
        // towards minus infinity
        if (px[i] < X_START) respawn(i, false);
      } else if (turned[i]) {
        /* Out through the cascades: forward and outward at the turning angle.
           The particle keeps the speed of the duct it came from - what a
           cascade does is change the direction of the momentum, not destroy
           it, which is the whole reason the manoeuvre is worth anything. */
        px[i] -= v * dt * TURN_COS;
        outward[i] += v * dt * TURN_COS;
        if (outward[i] > TURN_REACH) respawn(i, false);
      } else {
        const prev = px[i];
        px[i] += v * dt;
        /* Whether this particle is one of the ones the doors caught is decided
           ONCE, as it reaches them, and not re-rolled every frame: rolling per
           frame would turn a half-closed duct into a fog of particles changing
           their minds. Half-closed doors send half the air back, which is the
           honest linear reading of a transient that lasts two seconds. */
        if (!core && blocked > 0 && prev < X_DOORS && px[i] >= X_DOORS && Math.random() < blocked) {
          turned[i] = 1;
        }
        /* A bang throws a cohort of the core back. Decided ONCE, on the frame
           the bang is latched, and for whatever is inside the compressor and
           the burner at that instant - the same discipline as the reverser's
           deflection above, and for the same reason: re-rolling per frame turns
           a flow reversal into a fog of particles changing their minds. */
        if (
          core &&
          banging &&
          px[i] > X_SURGE_FROM &&
          px[i] < X_SURGE_TO &&
          Math.random() < EXPEL_FRACTION * surge.reverse
        ) {
          expelled[i] = 1;
        }
        if (px[i] > X_END) respawn(i, false);
      }

      const x = px[i];
      phase[i] += pw(sT, x) * speedK * dt;
      const r = THREE.MathUtils.lerp(pw(inT, x), pw(outT, x), lane[i]) + jitter[i] + outward[i];
      const a = phase[i];
      positions[i * 3] = x;
      positions[i * 3 + 1] = r * Math.cos(a);
      positions[i * 3 + 2] = r * Math.sin(a);

      const t = core ? pw(tT, x) * heat : pw(tT, x);
      tempColor(t, col);
      // clear of the nacelle, the deflected air is dispersing and out of the
      // story: it fades rather than stopping at an invisible wall
      const fade = edgeFade(x) * (turned[i] ? 1 - THREE.MathUtils.smoothstep(outward[i], 0.7, TURN_REACH) : 1);
      colors[i * 3] = col.r * fade;
      colors[i * 3 + 1] = col.g * fade;
      colors[i * 3 + 2] = col.b * fade;
      sizes[i] = (core ? 0.042 : 0.032) * (1 + t * 1.1);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.acolor.needsUpdate = true;
    geo.attributes.asize.needsUpdate = true;
  }

  return {
    group,
    update,
    setVisible(v) {
      group.visible = v;
    },
    setLines(v) {
      linesGroup.visible = v;
    },
    setPlume(v) {
      plume.visible = v;
    },
    materials: [pointMat, lineMat, plumeMat],
  };
}
