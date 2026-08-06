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
// plane. It runs 45 m - to the edge of the scene - and fades there instead.
const X_END = 112.9;
const SEGMENTS = 140;

const HALF_WIDTH_START = 0.6; // units, i.e. 0.6 m across at birth
const HALF_WIDTH_END = 9.0; // spread by the end of the visible stretch

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
      varying vec2 vUv;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        // turn the strip to face the camera around the engine axis, so it
        // never collapses into a line
        vec3 axis = normalize((modelMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
        vec3 toCam = normalize(cameraPosition - wp.xyz);
        vec3 side = normalize(cross(axis, toCam));
        float w = mix(${HALF_WIDTH_START.toFixed(2)}, ${HALF_WIDTH_END.toFixed(2)} * uSpread, aU);
        wp.xyz += side * aSide * w;
        vUv = vec2(aU, aSide * 0.5 + 0.5);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime, uDensity, uEnd;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
      }
      float fbm(vec2 p){
        return 0.55 * noise(p) + 0.28 * noise(p * 2.1) + 0.17 * noise(p * 4.3);
      }
      void main(){
        float u = vUv.x;
        float v = vUv.y * 2.0 - 1.0;
        // the puffs drift slowly backwards: the trail is left behind, it does
        // not stream like the jet
        float n = fbm(vec2(u * 13.0 - uTime * 0.06, v * 1.7 + u * 2.6));
        float body = smoothstep(1.0, 0.15, abs(v));
        float head = smoothstep(0.0, 0.05, u);          // born just behind the nozzle
        float tail = 1.0 - smoothstep(uEnd - 0.28, uEnd, u);
        float thin = mix(1.0, 0.45, u);                  // spreading costs density
        float a = body * head * tail * thin * uDensity * (0.30 + 0.85 * n);
        gl_FragColor = vec4(vec3(0.93, 0.95, 1.0), clamp(a, 0.0, 1.0));
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
      target.density = forms ? (verdict.persistent ? 0.85 : 0.55) * Math.min(1, burn * 1.6) : 0;
      // a short-lived trail breaks off not far behind, a persistent one runs
      // out to the edge of the scene and spreads as it goes
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
