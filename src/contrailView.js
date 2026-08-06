import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  Drawing of the contrail.
 *
 *  A separate object rather than a continuation of the exhaust plume,
 *  because the scale is different: the flow computation ends 4 m behind
 *  the nozzle, and the trail has to run off towards the horizon.
 *
 *  The whole thing is one strip along the axis, turned to face the
 *  camera in the vertex shader - so it reads from any angle, including
 *  from directly behind, where a flat ribbon would degenerate into a
 *  line. The verdict from `contrail.js` reaches it as two numbers:
 *  how dense it is and how far along the strip it survives.
 * ------------------------------------------------------------------ */

// The nozzle exit is at 2.90; a real trail starts where the jet has had time
// to mix and cool, some ten metres behind - 20 units at 1 unit = 0.50 m. The
// gap is the most recognisable thing about a contrail after its colour.
const X_START = 22.9;
// A real trail is kilometres long, which is hundreds of times past the far
// plane. It runs 38 m - the far tip still inside the frame of view 0 - and the
// eye is left to continue it.
const X_END = 98.9;
const SEGMENTS = 140;

// The trail is a spindle: thin at both ends, thickest a little past the middle.
// A band that simply widened to the edge of the scene read as a flat ribbon
// however it was shaded - a body with two ends reads as a body.
const HALF_WIDTH_MAX = 3.6; // units at the fattest, i.e. 3.6 m across
const HALF_WIDTH_TIP = 0.14; // fraction of that left at the ends

export function createContrail() {
  const positions = new Float32Array(SEGMENTS * 2 * 3);
  const sides = new Float32Array(SEGMENTS * 2);
  const us = new Float32Array(SEGMENTS * 2);
  const index = [];

  for (let i = 0; i < SEGMENTS; i++) {
    const u = i / (SEGMENTS - 1);
    const x = THREE.MathUtils.lerp(X_START, X_END, u);
    for (const s of [0, 1]) {
      const k = i * 2 + s;
      positions[k * 3] = x;
      sides[k] = s ? 1 : -1;
      us[k] = u;
    }
    if (i < SEGMENTS - 1) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSide', new THREE.BufferAttribute(sides, 1));
  geo.setAttribute('aU', new THREE.BufferAttribute(us, 1));
  geo.setIndex(index);

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uDensity: { value: 0 },
      uEnd: { value: 1 }, // fraction of the strip the trail survives to
      uSpread: { value: 1 }, // how far it opens out on the way
    },
    vertexShader: `
      attribute float aSide;
      attribute float aU;
      uniform float uSpread;
      uniform float uEnd; // the spindle is shaped here, so the length is needed here too
      varying vec2 vUv;
      varying vec3 vSideDir;
      varying vec3 vToCam;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);

        // turn the strip to face the camera around the engine axis, so it
        // never collapses into a line
        vec3 axis = normalize((modelMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
        vec3 toCam = normalize(cameraPosition - wp.xyz);
        vec3 side = normalize(cross(axis, toCam));

        // The spindle. uEnd sets how far along the strip the trail lives, so a
        // short-lived one is a shorter cigar rather than a clipped band, and
        // both ends taper. The 0.75 power fattens the middle and keeps the
        // ends from drawing out into needles.
        float t = clamp(aU / uEnd, 0.0, 1.0);
        float shape = ${HALF_WIDTH_TIP.toFixed(2)} + (1.0 - ${HALF_WIDTH_TIP.toFixed(2)}) * pow(sin(3.14159 * t), 0.75);
        wp.xyz += side * aSide * ${HALF_WIDTH_MAX.toFixed(2)} * uSpread * shape;

        vUv = vec2(t, aSide * 0.5 + 0.5);
        vSideDir = side;
        vToCam = toCam;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime, uDensity, uEnd;
      varying vec2 vUv;
      varying vec3 vSideDir;
      varying vec3 vToCam;

      // the key light of the scene, so the trail is lit from where everything
      // else is lit from
      const vec3 LIGHT = normalize(vec3(-6.0, 9.0, 8.0));

      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
      }
      float fbm(vec2 p){
        return 0.55 * noise(p) + 0.28 * noise(p * 2.1) + 0.17 * noise(p * 4.3);
      }
      void main(){
        float t = vUv.x;                 // 0 at the near tip, 1 at the far one
        float v = vUv.y * 2.0 - 1.0;

        // The strip stands in for a tube of cloud, so the alpha follows the
        // depth of gas a ray meets crossing a cylinder - sqrt(1 − v²), thick
        // in the middle and vanishing at the edges. A flat plateau with soft
        // edges is what made it read as a painted band.
        float round = sqrt(max(0.0, 1.0 - v * v));

        // the normal of that imaginary tube, reconstructed per pixel: the
        // strip has only two vertices across, so it cannot come from the mesh
        vec3 n = normalize(vSideDir * v + vToCam * round);
        float lambert = 0.55 + 0.45 * max(0.0, dot(n, LIGHT));
        // ice scatters forward: the far side of the tube glows a little
        float rim = pow(1.0 - round, 2.0) * 0.25;

        // Mottling only, not lumps: a cigar is a body, and heavy noise ate its
        // outline. Slow, coarse and shallow - enough to say it is cloud.
        float mottle = 0.86 + 0.28 * (fbm(vec2(t * 5.0 - uTime * 0.03, v * 0.9)) - 0.5);

        // the tips are ends of the body, not cuts
        float ends = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.93, 1.0, t));
        float a = round * ends * uDensity * mottle;
        gl_FragColor = vec4(vec3(0.93, 0.95, 1.0) * (lambert + rim), clamp(a, 0.0, 1.0));
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; // the billboarding happens on the GPU, the box lies
  mesh.renderOrder = 7;

  const group = new THREE.Group();
  group.add(mesh);
  group.visible = false;

  let time = 0;
  let enabled = true;
  const target = { density: 0, end: 1, spread: 1 };

  return {
    group,

    /**
     * @param {number} dt seconds
     * @param {{forms:boolean, persistent:boolean}|null} verdict
     * @param {number} burn combustion intensity 0..1 - no fuel, no water, no trail
     */
    update(dt, verdict, burn) {
      const forms = enabled && verdict !== null && verdict.forms && burn > 0.02;
      target.density = forms ? (verdict.persistent ? 0.5 : 0.32) * Math.min(1, burn * 1.6) : 0;
      // a short-lived trail is a shorter and thinner cigar, ending not far
      // behind the engine; a persistent one runs to the edge of the scene
      target.end = verdict && verdict.persistent ? 1.0 : 0.34;
      target.spread = verdict && verdict.persistent ? 1.0 : 0.45;

      // ease the uniforms so that crossing the threshold does not pop
      const k = 1 - Math.exp(-dt / 0.9);
      const u = mat.uniforms;
      u.uDensity.value += (target.density - u.uDensity.value) * k;
      u.uEnd.value += (target.end - u.uEnd.value) * k;
      u.uSpread.value += (target.spread - u.uSpread.value) * k;

      group.visible = u.uDensity.value > 0.004;
      if (!group.visible) return;
      time += dt;
      u.uTime.value = time;
    },

    setEnabled(v) {
      enabled = v;
    },

    material: mat,
  };
}
