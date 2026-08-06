import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/* ------------------------------------------------------------------ *
 *  Heat haze of the exhaust jet (schlieren effect).
 *
 *  Hot gas aft of the nozzle has a different density, and therefore a
 *  different refractive index, than the surrounding air. Turbulent eddies
 *  in the jet keep mixing hot and cold, so a light ray crossing the jet
 *  wanders about, and everything seen THROUGH the jet shimmers and
 *  smears. Look into the nozzle and the optical depth accumulates along
 *  the whole ray, so the entire screen swims.
 *
 *  The effect is screen-space: a ray is built from the camera through
 *  each pixel, traced through the jet cone, and the pixel is displaced
 *  and blurred according to the accumulated optical depth.
 *
 *  The engine axis is X, the flow goes towards +X (see src/engine.js).
 * ------------------------------------------------------------------ */

// Plume extents: from the fan nozzle exit to where the jet has dissolved.
// 1 model unit = 0.50 m.
const PLUME = {
  x0: 1.6, // start (fan nozzle exit is at 1.16; the hot core begins further aft)
  x1: 18.0, // tail, where the jet has mixed into the atmosphere
  r0: 1.45, // jet radius at the nozzle
  r1: 4.0, // radius of the dissolved jet at the tail
};

// Engine bodies that occlude the jet: seen from the front, the nacelle stands
// between the eye and the jet, and nothing there should shimmer.
// Three cylinders: nacelle (Ø 2.44 m), core cowl, exhaust plug.
const OCCLUDERS = [
  [2.44, -5.35, 1.16],
  [1.2, 1.16, 2.9],
  [0.56, 2.9, 4.85],
];

// Effect strength. amp is displacement in pixels, blur is the smear radius in
// pixels as well, gas is the density of the visible jet.
//
// The gas is deliberately kept faint: hot exhaust is in fact nearly invisible -
// what gives a jet away is the way it bends the view, not its own whiteness.
// A dense white cone also competed with the contrail, which is the one thing
// aft of the nozzle that really is a cloud.
const LOOK = { amp: 13.0, blur: 5.5, gas: 0.2 };

// The "Air flows" mode is a diagram: there the particles, streamlines and the
// temperature colouring of the jet matter, and the exhaust simply paints over
// them. So in diagram mode only a faint shimmer is left. These are multipliers
// of LOOK, and since the gas itself became faint the damping here was eased -
// 0.2 of it would have left nothing at all.
const FLOW_LOOK = { amp: 0.55, blur: 0.5, gas: 0.6 };

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec3 uCam;          // camera position in world space
  uniform mat4 uInvVP;        // inverse of projection * view
  uniform vec2 uInvRes;       // 1 / frame size, pixels -> UV
  uniform float uTime;
  uniform float uPower;       // 0..1.15, intensity (combustion + fan speed)
  uniform float uFlow;        // convection speed of the eddies downstream, units/s
  uniform float uAmp;         // maximum displacement, pixels
  uniform float uBlur;        // smear radius, pixels
  uniform float uGas;         // density of the visible gas 0..1
  uniform float uGasMax;      // opacity ceiling of the jet
  uniform vec3 uGasNear;      // jet colour at the nozzle (linear, before tone mapping)
  uniform vec3 uGasFar;       // colour of the dissolved tail
  uniform vec4 uPlume;        // x0, x1, r0, r1
  uniform vec3 uOcc[${OCCLUDERS.length}]; // radius, x from, x to
  varying vec2 vUv;

  const int STEPS = 16;
  const float EXT = 0.62;     // extinction used for the distortion
  const float GAS_EXT = 1.0;  // extinction used for the visible gas

  /* Ray/cylinder intersection, cylinder aligned with the X axis.
     Returns (t enter, t exit); if t exit < t enter the ray misses. */
  vec2 cylinder(vec3 ro, vec3 rd, float R, float xa, float xb) {
    float t0 = -1e9;
    float t1 = 1e9;
    float a = dot(rd.yz, rd.yz);
    float c = dot(ro.yz, ro.yz) - R * R;
    if (a > 1e-9) {
      float b = dot(ro.yz, rd.yz);
      float h = b * b - a * c;
      if (h < 0.0) return vec2(1.0, -1.0);
      h = sqrt(h);
      t0 = (-b - h) / a;
      t1 = (-b + h) / a;
    } else if (c > 0.0) {
      return vec2(1.0, -1.0); // ray is parallel to the axis and passes outside
    }
    if (abs(rd.x) > 1e-9) {
      float ta = (xa - ro.x) / rd.x;
      float tb = (xb - ro.x) / rd.x;
      t0 = max(t0, min(ta, tb));
      t1 = min(t1, max(ta, tb));
    } else if (ro.x < xa || ro.x > xb) {
      return vec2(1.0, -1.0);
    }
    return vec2(t0, t1);
  }

  /* Nearest point where the ray runs into an engine body.
     If the camera is already inside the cylinder (t enter < 0) - no occlusion. */
  float occlusion(vec3 ro, vec3 rd) {
    float best = 1e9;
    for (int i = 0; i < ${OCCLUDERS.length}; i++) {
      vec2 h = cylinder(ro, rd, uOcc[i].x, uOcc[i].y, uOcc[i].z);
      if (h.y > h.x && h.x > 0.0) best = min(best, h.x);
    }
    return best;
  }

  /* Hot gas density at a point: a cone spreading downstream, with a soft edge,
     decay towards the tail and a denser core near the nozzle.

     Returns two values. x is for the distortion: its tail decays slowly,
     because even heavily diluted hot gas still bends the ray.
     y is for the visible gas: it decays much more steeply, otherwise the thin
     tail accumulates along the ray and floods the whole frame with white when
     viewed from behind, long after there is any visible jet left. */
  vec2 density(vec3 p) {
    float t = (p.x - uPlume.x) / (uPlume.y - uPlume.x);
    if (t < 0.0 || t > 1.0) return vec2(0.0);
    float R = mix(uPlume.z, uPlume.w, pow(t, 0.7));
    float rr = length(p.yz);
    float radial = 1.0 - smoothstep(R * 0.35, R, rr);
    float core = 1.0 - smoothstep(0.0, 0.5, t); // hot core of the jet near the nozzle
    float base = radial * (0.45 + 0.8 * core) * smoothstep(0.0, 0.05, t);
    float tail = 1.0 - t;
    return vec2(base * pow(tail, 1.25), base * pow(tail, 2.6));
  }

  /* Billows of gas. At small scales the sine fields below give away their
     lattice - the jet gets covered in a regular corduroy pattern - so this is
     real hash noise. Evaluated once per pixel, two octaves. */
  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x),
          mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x),
          mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }

  float fbm(vec3 p) {
    return vnoise(p) * 0.62 + vnoise(p * 2.1 + 19.7) * 0.30;
  }

  /* Jet turbulence: two independent fields built from sines of sines.
     Cheap, free of a visible grid, and convected downstream with the gas. */
  vec2 turbulence(vec3 p) {
    float x = p.x - uTime * uFlow;
    float a = sin(x * 3.10 + sin(p.y * 2.30 - uTime * 1.3) * 1.7);
    float b = sin(p.z * 2.90 + sin(x * 1.70) * 1.5);
    float c = sin(p.y * 2.85 + sin(p.z * 2.10 + uTime * 0.9) * 1.6);
    float d = sin(x * 2.40 + sin(p.z * 1.55) * 1.3);
    return vec2(a * b, c * d);
  }

  void main() {
    vec4 src = texture2D(tDiffuse, vUv);
    if (uPower < 0.004) { gl_FragColor = src; return; }

    // ray from the camera through the pixel
    vec4 far = uInvVP * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
    vec3 rd = normalize(far.xyz / far.w - uCam);
    vec3 ro = uCam;

    // coarse rejection: bounding cylinder of the plume
    vec2 span = cylinder(ro, rd, uPlume.w, uPlume.x, uPlume.y);
    float tIn = max(span.x, 0.0);
    float tOut = min(span.y, occlusion(ro, rd));
    if (tOut <= tIn + 1e-3) { gl_FragColor = src; return; }

    // Steps are taken without a random offset: the "refraction centroid" below
    // is computed from these same points, and any per-pixel jitter would turn
    // the smooth distortion into a mush of isolated dots.
    float step = (tOut - tIn) / float(STEPS);
    float t = tIn + step * 0.5;

    // Accumulate optical depth along the ray and, at the same time, the
    // "refraction centroid" - the weighted middle of the hot gas. Near eddies
    // distort the image more than distant ones, so the weight falls off with
    // transmittance.
    float trans = 1.0; // how much light the jet has not yet stirred
    float transGas = 1.0; // how much light it has not yet scattered
    float wSum = 0.0;
    vec3 pc = vec3(0.0);
    for (int i = 0; i < STEPS; i++) {
      vec3 p = ro + rd * t;
      vec2 dd = density(p) * step;
      if (dd.x > 1e-4) {
        float w = dd.x * trans;
        pc += p * w;
        wSum += w;
        trans *= exp(-dd.x * EXT);
        transGas *= exp(-dd.y * GAS_EXT);
      }
      t += step;
    }

    float cover = (1.0 - trans) * uPower;
    if (cover < 0.002) { gl_FragColor = src; return; }

    // Turbulence is evaluated once, at the refraction centroid. Sampling it at
    // every step and averaging would let the signed noise cancel along the ray,
    // degrading the distortion into a barely visible ripple.
    pc /= max(wSum, 1e-4);
    vec2 n = turbulence(pc) * 0.70 + turbulence(pc * 2.6 + vec3(9.3, 4.1, 7.7)) * 0.36;

    vec2 off = n * cover * uAmp * uInvRes;
    float br = cover * uBlur;

    // smear: centre plus four taps, radius grows with the optical depth
    vec3 acc = texture2D(tDiffuse, vUv + off).rgb * 0.32;
    acc += texture2D(tDiffuse, vUv + off + vec2( 0.95,  0.31) * br * uInvRes).rgb * 0.17;
    acc += texture2D(tDiffuse, vUv + off + vec2(-0.59,  0.81) * br * uInvRes).rgb * 0.17;
    acc += texture2D(tDiffuse, vUv + off + vec2(-0.81, -0.59) * br * uInvRes).rgb * 0.17;
    acc += texture2D(tDiffuse, vUv + off + vec2( 0.45, -0.89) * br * uInvRes).rgb * 0.17;

    // weak dispersion: different wavelengths refract slightly differently
    float ca = cover * 0.35;
    acc.r = mix(acc.r, texture2D(tDiffuse, vUv + off * 1.14).r, ca);
    acc.b = mix(acc.b, texture2D(tDiffuse, vUv + off * 0.86).b, ca);

    /* --------------------------- visible gas ---------------------------- *
     *  The same accumulated depth, now used as opacity: the jet does not only
     *  refract light but also scatters it - the exhaust is seen as a whitish
     *  cloud. Composited front to back, so everything behind the jet fades
     *  honestly.
     * -------------------------------------------------------------------- */
    // the jet has to be visible at idle, not only at take-off power, so the
    // dependence on regime is flatter here than for the distortion
    float gp = pow(clamp(uPower / 1.15, 0.0, 1.0), 0.6);
    float gas = (1.0 - transGas) * uGas * gp;
    // Billows. The large scale comes from the same turbulence as the
    // distortion, so gas and shimmer breathe together; the small scale comes
    // from hash noise convected downstream, otherwise the jet looks like
    // cotton wool rather than turbulence.
    float lumps = fbm(vec3(pc.x - uTime * uFlow, pc.yz) * 1.15);
    gas *= clamp(0.52 + 0.26 * (n.x * 0.6 + n.y * 0.4) + 1.05 * lumps, 0.2, 1.7);

    // near the nozzle the gas is still hot and reads warm, further aft it cools and greys
    float aft = smoothstep(uPlume.x + 1.0, uPlume.x + 9.0, pc.x);
    vec3 gasCol = mix(uGasNear, uGasFar, aft);

    // Opacity ceiling: even in the thickest part of the jet the engine must
    // show through, otherwise the rear view turns into a blank white sheet.
    acc = mix(acc, gasCol, clamp(gas, 0.0, uGasMax));

    gl_FragColor = vec4(acc, src.a);
  }
`;

/**
 * Distortion intensity as a function of engine state.
 * Combustion contributes most (jet density and temperature); airflow adds a
 * little: during rundown there is still a jet, but a cold one.
 * @param {number} burn combustion intensity 0..1
 * @param {number} n1 fan speed 0..1
 * @returns {number} 0..1.15
 */
export function hazePower(burn, n1) {
  return Math.max(0, Math.min(1.15, burn * 1.03 + n1 * 0.12));
}

/**
 * @param {THREE.PerspectiveCamera} camera
 * @param {number} width
 * @param {number} height
 */
export function createHeatHaze(camera, width, height) {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uCam: { value: new THREE.Vector3() },
      uInvVP: { value: new THREE.Matrix4() },
      uInvRes: { value: new THREE.Vector2(1 / width, 1 / height) },
      uTime: { value: 0 },
      uPower: { value: 0 },
      uFlow: { value: 4.0 },
      uAmp: { value: LOOK.amp },
      uBlur: { value: LOOK.blur },
      uGas: { value: LOOK.gas },
      uGasMax: { value: 0.22 }, // the jet never becomes opaque, only tinted
      // Values are linear, before tone mapping: ACES at exposure 0.82 pulls
      // 1.0 down to roughly 0.8, so "white" here is greater than 1.
      uGasNear: { value: new THREE.Color(1.55, 1.45, 1.3) },
      uGasFar: { value: new THREE.Color(1.24, 1.3, 1.4) },
      uPlume: { value: new THREE.Vector4(PLUME.x0, PLUME.x1, PLUME.r0, PLUME.r1) },
      uOcc: { value: OCCLUDERS.map((o) => new THREE.Vector3(...o)) },
    },
    vertexShader,
    fragmentShader,
  });
  // ShaderPass deep-copies the uniforms it is given, so from here on we work
  // only with the ones that actually ended up in the material
  const uniforms = pass.uniforms;

  let time = 0;
  let enabled = true;

  /**
   * @param {number} dt seconds
   * @param {number} burn combustion intensity 0..1
   * @param {number} n1 fan speed 0..1
   */
  function update(dt, burn, n1) {
    time += dt;
    const power = hazePower(burn, n1);
    // while the engine is cold the pass need not run at all
    pass.enabled = enabled && power > 0.004;
    if (!pass.enabled) return;

    uniforms.uTime.value = time;
    uniforms.uPower.value = power;
    uniforms.uFlow.value = 2.0 + 7.0 * n1;

    camera.updateMatrixWorld();
    uniforms.uCam.value.setFromMatrixPosition(camera.matrixWorld);
    // inv(P * V) = matrixWorld * inv(P)
    uniforms.uInvVP.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
  }

  return {
    pass,
    update,
    setSize(w, h) {
      uniforms.uInvRes.value.set(1 / w, 1 / h);
    },
    setEnabled(v) {
      enabled = v;
      if (!v) pass.enabled = false;
    },
    /** Diagram mode "Air flows": damp the exhaust down so that it does not
     *  paint over the particles and streamlines. */
    setFlowMode(on) {
      const k = on ? FLOW_LOOK : { amp: 1, blur: 1, gas: 1 };
      uniforms.uAmp.value = LOOK.amp * k.amp;
      uniforms.uBlur.value = LOOK.blur * k.blur;
      uniforms.uGas.value = LOOK.gas * k.gas;
    },
    get enabled() {
      return enabled;
    },
  };
}
