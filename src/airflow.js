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

  function respawn(i, initial) {
    px[i] = initial ? THREE.MathUtils.lerp(X_START, X_END, Math.random()) : X_START + Math.random() * 0.8;
    lane[i] = Math.random();
    phase[i] = Math.random() * Math.PI * 2;
    jitter[i] = (Math.random() - 0.5) * 0.05;
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
  const plumeGeo = new THREE.CylinderGeometry(0.8, 1.5, 5.0, 40, 12, true);
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
   */
  function update(dt, level, burn = 1) {
    if (!group.visible) return;
    time += dt;
    plumeMat.uniforms.uTime.value = time;
    plumeMat.uniforms.uPower.value = 0.15 + burn * 1.1;

    // without combustion the core duct is just cold air being pumped through
    const heat = Math.max(level * 0.22, burn);
    const speedK = 0.06 + 1.05 * level;
    for (let i = 0; i < N; i++) {
      const core = isCore[i] === 1;
      const inT = core ? CORE_IN : BYPASS_IN;
      const outT = core ? CORE_OUT : BYPASS_OUT;
      const vT = core ? CORE_V : BYPASS_V;
      const sT = core ? CORE_SWIRL : BYPASS_SWIRL;
      const tT = core ? CORE_T : BYPASS_T;

      const v = pw(vT, px[i]) * speedK;
      px[i] += v * dt;
      if (px[i] > X_END) respawn(i, false);

      const x = px[i];
      phase[i] += pw(sT, x) * speedK * dt;
      const r = THREE.MathUtils.lerp(pw(inT, x), pw(outT, x), lane[i]) + jitter[i];
      const a = phase[i];
      positions[i * 3] = x;
      positions[i * 3 + 1] = r * Math.cos(a);
      positions[i * 3 + 2] = r * Math.sin(a);

      const t = core ? pw(tT, x) * heat : pw(tT, x);
      tempColor(t, col);
      const fade = edgeFade(x);
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
