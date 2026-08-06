import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { buildEngine, getShellMaterials, MATS } from './engine.js';
import { createAirflow } from './airflow.js';
import { createHeatHaze } from './heathaze.js';
import { createEngineSound } from './sound.js';
import { createEngineState } from './engineState.js';

/* =============================== scene =============================== */

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.82;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e13);
scene.fog = new THREE.Fog(0x0b0e13, 26, 60);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
camera.position.set(-11.6, 4.8, 13.8);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 1.5;
controls.maxDistance = 40;
controls.target.set(-0.3, 0, 0);

const labelRenderer = new CSS2DRenderer({ element: document.getElementById('labels') });
labelRenderer.setSize(innerWidth, innerHeight);

/* --------------------------- environment ---------------------------- */
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;

scene.add(new THREE.HemisphereLight(0x9fc8ff, 0x141a22, 0.25));
const key = new THREE.DirectionalLight(0xffffff, 1.15);
key.position.set(-6, 9, 8);
scene.add(key);
const rim = new THREE.DirectionalLight(0x86bfff, 0.8);
rim.position.set(7, 2, -9);
scene.add(rim);
const fill = new THREE.DirectionalLight(0xffd9b0, 0.3);
fill.position.set(2, -6, 3);
scene.add(fill);

// the "floor" - a faint grid that gives a sense of scale
const grid = new THREE.GridHelper(60, 60, 0x2a3442, 0x161c25);
grid.position.y = -3.6;
grid.material.transparent = true;
grid.material.opacity = 0.45;
scene.add(grid);

/* ============================== engine =============================== */

const engine = buildEngine();
scene.add(engine.root);

const airflow = createAirflow();
scene.add(airflow.group);

/* ------------------------------ labels ------------------------------- */
const labelObjects = [];
engine.labels.forEach((l) => {
  const div = document.createElement('div');
  div.className = 'lbl';
  div.textContent = l.text;
  const obj = new CSS2DObject(div);
  obj.position.copy(l.pos);
  l.module.add(obj);
  labelObjects.push(obj);
});

/* ---------------------------- cutaway sector ------------------------- */
const clipA = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
const clipB = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const clipPlanes = [clipA, clipB];

function updateClip(halfDeg, centerDeg) {
  const c = THREE.MathUtils.degToRad(centerDeg);
  const h = THREE.MathUtils.degToRad(halfDeg);
  const a = c - h;
  const b = c + h;
  // keep the half-spaces before and after the sector (their union)
  clipA.normal.set(0, Math.cos(a - Math.PI / 2), Math.sin(a - Math.PI / 2));
  clipB.normal.set(0, Math.cos(b + Math.PI / 2), Math.sin(b + Math.PI / 2));
  clipA.constant = 0;
  clipB.constant = 0;
}

function setCutaway(on) {
  getShellMaterials().forEach((m) => {
    m.clippingPlanes = on ? clipPlanes : null;
    m.clipIntersection = true;
    m.needsUpdate = true;
  });
}

/* ------------------------------- x-ray ------------------------------- */
function setXray(on) {
  getShellMaterials().forEach((m) => {
    m.transparent = on;
    m.opacity = on ? 0.16 : 1;
    m.depthWrite = !on;
    m.needsUpdate = true;
  });
}

/* ============================ post-processing ======================== */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// jet heat haze goes before bloom, so the halos swim together with the frame
const haze = createHeatHaze(camera, innerWidth, innerHeight);
composer.addPass(haze.pass);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.2, 0.4, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* =============================== UI state ============================ */
const state = {
  throttle: 0.85, // throttle lever position
  sound: false,
  flow: false,
  cutaway: false,
  xray: false,
  spin: true,
  orbit: false,
  haze: true,
  explode: 0,
  cutHalf: 100,
  cutRot: 90,
  timeScale: 1, // speed-up of the engine processes, ×1 or ×4
};

let n1Angle = 0;
let n2Angle = 0;

/* ---------------------------- engine state --------------------------- */
const eng = createEngineState(state.throttle);

const MODE_TEXT = {
  off: ['SHUT DOWN', 'off'],
  start: ['STARTING', 'busy'],
  run: ['RUNNING', ''],
  stop: ['SHUTDOWN · RUNDOWN', 'stop'],
};

// The state machine makes the transitions "rundown -> off" and "start -> run"
// on its own, so the panel is refreshed whenever the mode actually changes,
// not only when a button is pressed.
let shownMode = null;

function refreshModeUI() {
  const mode = eng.mode;
  shownMode = mode;
  const [text, cls] = MODE_TEXT[mode];
  const bar = $('mode-bar');
  bar.className = `statusbar ${cls}`;
  $('val-mode').textContent = text;

  const btn = $('btn-power');
  const running = mode === 'run' || mode === 'start';
  btn.classList.toggle('danger', running);
  btn.classList.toggle('start', !running);
  btn.classList.toggle('busy', mode === 'start' || mode === 'stop');
  $('power-label').textContent = running ? 'Shut down engine' : 'Start engine';
  $('power-hint').textContent =
    mode === 'start'
      ? 'starter cranking, light-off…'
      : mode === 'stop'
        ? 'fuel cut, rotors coasting down…'
        : running
          ? 'fuel shut-off, rotor rundown'
          : 'starter, light-off, acceleration to idle';
  $('thr-wrap').classList.toggle('disabled', mode !== 'run');
}

function setMode(mode) {
  eng.setMode(mode);
  refreshModeUI();
}

/* ----------------------------- elements ------------------------------ */
const $ = (id) => document.getElementById(id);
const btnFlow = $('btn-flow');
const btnCut = $('btn-cut');
const legend = $('legend');
const info = $('info');
const tip = $('tip');

const VIEWS = [
  { name: 'Overview', pos: [-11.6, 4.8, 13.8], target: [-0.3, 0, 0] },
  { name: 'Cutaway', pos: [-8.2, 5.8, 10.4], target: [-0.5, 0, 0], cut: true },
  { name: 'Front', pos: [-13.5, 1.0, 3.0], target: [-4.4, 0, 0] },
  { name: 'Fan', pos: [-8.2, 2.2, 4.6], target: [-3.22, 0, 0] },
  { name: 'HP compressor', pos: [-4.6, 2.1, 4.0], target: [-1.61, 0, 0], cut: true },
  { name: 'Combustor', pos: [-1.6, 1.9, 3.8], target: [-0.56, 0, 0], cut: true },
  { name: 'Turbine', pos: [1.5, 2.1, 4.4], target: [0.44, 0, 0], cut: true },
  { name: 'Nozzle and jet', pos: [7.6, 2.8, 7.0], target: [3.0, 0, 0] },
  // the camera sits right at the edge of the jet cone: the jet comes towards
  // the viewer, but the engine is not entirely drowned in it as it would be
  // directly on the axis
  { name: 'From behind, in the gas stream', pos: [11.5, 2.2, 3.6], target: [0.5, 0, 0] },
];

const camTargetPos = camera.position.clone();
const camTargetLook = controls.target.clone();
let camTween = 0;

function goView(v) {
  camTargetPos.set(...v.pos);
  camTargetLook.set(...v.target);
  camTween = 1;
  if (v.cut && !state.cutaway) toggleCut(true);
}

const viewsEl = $('views');
VIEWS.forEach((v, i) => {
  const b = document.createElement('button');
  b.textContent = `${i + 1}. ${v.name}`;
  b.onclick = () => goView(v);
  viewsEl.appendChild(b);
});

/* ------------------------------- toggles ------------------------------ */
function toggleFlow(on) {
  state.flow = on;
  btnFlow.classList.toggle('on', on);
  airflow.setVisible(on);
  haze.setFlowMode(on);
  legend.classList.toggle('hidden', !on);
  // make the casings transparent so the flows can be seen inside
  if (on && !state.cutaway && !state.xray) {
    $('chk-xray').checked = true;
    state.xray = true;
    setXray(true);
  }
}

function toggleCut(on) {
  state.cutaway = on;
  btnCut.classList.toggle('on', on);
  setCutaway(on);
  $('cut-opts').style.opacity = on ? 1 : 0.35;
}

/* -------------------------------- sound ------------------------------- */
const sound = createEngineSound();
const btnSound = $('btn-sound');

async function toggleSound(on) {
  state.sound = on;
  btnSound.classList.toggle('on', on);
  $('vol-row').classList.toggle('collapsed', !on);
  if (on) await sound.enable();
  else sound.disable();
}
btnSound.onclick = () => toggleSound(!state.sound);
$('vol').oninput = (e) => {
  $('val-vol').textContent = `${e.target.value} %`;
  sound.setVolume(e.target.value / 100);
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden) sound.suspend();
  else sound.resume();
});

btnFlow.onclick = () => toggleFlow(!state.flow);
btnCut.onclick = () => toggleCut(!state.cutaway);

// start / shutdown: during rundown it can be restarted, during start aborted
$('btn-power').onclick = () => {
  setMode(eng.mode === 'run' || eng.mode === 'start' ? 'stop' : 'start');
};

// time scale: a start takes about 40 s and a rundown 35 s, as on a real engine;
// the speed-up saves waiting through them in full
function setTimeScale(k) {
  state.timeScale = k;
  $('ts-1').classList.toggle('on', k === 1);
  $('ts-4').classList.toggle('on', k === 4);
}
$('ts-1').onclick = () => setTimeScale(1);
$('ts-4').onclick = () => setTimeScale(4);

$('thr').oninput = (e) => {
  state.throttle = e.target.value / 100;
  $('val-thr').textContent = `${e.target.value} %`;
};
$('cut').oninput = (e) => {
  state.cutHalf = +e.target.value;
  $('val-cut').textContent = `${Math.round(state.cutHalf * 2)}°`;
  updateClip(state.cutHalf, state.cutRot);
  if (!state.cutaway) toggleCut(true);
};
$('cutrot').oninput = (e) => {
  state.cutRot = +e.target.value;
  $('val-cutrot').textContent = `${state.cutRot}°`;
  updateClip(state.cutHalf, state.cutRot);
};
$('exp').oninput = (e) => {
  state.explode = e.target.value / 100;
  $('val-exp').textContent = `${e.target.value} %`;
};
$('chk-xray').onchange = (e) => {
  state.xray = e.target.checked;
  setXray(state.xray);
};
$('chk-nac').onchange = (e) => {
  engine.parts.mNac.visible = e.target.checked;
};
$('chk-labels').onchange = (e) => {
  labelObjects.forEach((o) => (o.visible = e.target.checked));
};
$('chk-lines').onchange = (e) => airflow.setLines(e.target.checked);
$('chk-haze').onchange = (e) => {
  state.haze = e.target.checked;
  haze.setEnabled(state.haze);
};
$('chk-spin').onchange = (e) => (state.spin = e.target.checked);
$('chk-orbit').onchange = (e) => (state.orbit = e.target.checked);
$('info-close').onclick = () => info.classList.add('hidden');

addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    toggleFlow(!state.flow);
    // Cyrillic letters are the same physical keys on a Russian layout
  } else if (e.key === 'c' || e.key === 'C' || e.key === 'с' || e.key === 'С') {
    toggleCut(!state.cutaway);
  } else if (e.key === 'e' || e.key === 'E' || e.key === 'у' || e.key === 'У') {
    setMode(eng.mode === 'run' || eng.mode === 'start' ? 'stop' : 'start');
  } else if (e.key === 's' || e.key === 'S' || e.key === 'ы' || e.key === 'Ы') {
    toggleSound(!state.sound);
  } else if (e.key === 'x' || e.key === 'X' || e.key === 'ч' || e.key === 'Ч') {
    $('chk-xray').checked = !state.xray;
    state.xray = !state.xray;
    setXray(state.xray);
  } else if (e.key === 'h' || e.key === 'H' || e.key === 'р' || e.key === 'Р') {
    $('chk-haze').checked = !state.haze;
    state.haze = !state.haze;
    haze.setEnabled(state.haze);
  } else if (e.key >= '1' && e.key <= '9') {
    goView(VIEWS[+e.key - 1]);
  }
});

/* ------------------------------- gauges ------------------------------ *
 *  fan  - fan compression, driven by N1
 *  comp - HP compressor compression, driven by N2
 *  t4   - actual gas temperature ahead of the turbine
 * -------------------------------------------------------------------- */
const STATIONS = [
  ['Intake', () => 15, () => 1.0],
  ['Bypass duct', ({ fan }) => 15 + 34 * fan, ({ fan }) => 1 + 0.68 * fan],
  ['After booster', ({ fan }) => 15 + 105 * fan, ({ fan }) => 1 + 1.7 * fan],
  // The overall pressure ratio of the prototype is about 28 (fan 1.7, booster
  // 1.5, HPC 11), not 40-50 as on next-generation engines.
  ['After HPC', ({ comp }) => 15 + 585 * comp, ({ comp }) => 1 + 27 * comp],
  ['Combustor', ({ t4 }) => t4, ({ comp }) => 1 + 26 * comp],
  ['After HPT', ({ t4 }) => t4 * 0.494, ({ comp }) => 1 + 6 * comp],
  ['Nozzle exit', ({ t4 }) => t4 * 0.293, ({ fan }) => 1 + 0.65 * fan],
];

const stationsEl = $('stations');
stationsEl.innerHTML =
  '<tr><td style="color:#5f6b7c">station</td><td style="color:#5f6b7c">T, °C</td><td style="color:#5f6b7c">P, bar</td></tr>' +
  STATIONS.map(([n]) => `<tr><td>${n}</td><td class="t"></td><td class="p"></td></tr>`).join('');

let gaugeShown = -1;
function updateGauges(keff) {
  // hash of the state, so the DOM is not touched every frame without need
  const h = eng.n1 * 7 + eng.n2 * 13 + eng.t4 * 0.001;
  if (Math.abs(h - gaugeShown) < 0.002) return;
  gaugeShown = h;

  // take-off thrust of the prototype: CFM56-7B27, 27 300 lbf = 121.4 kN
  const thrust = eng.fuel ? 121.4 * Math.pow(keff, 1.45) : 0;
  $('val-n1').textContent = `${(eng.n1 * 100).toFixed(0)} %`;
  $('val-n2').textContent = `${(eng.n2 * 100).toFixed(0)} %`;
  $('val-t4').textContent = `${eng.t4.toFixed(0)} °C`;
  $('val-thrust').textContent = `${thrust.toFixed(0)} kN`;

  const v = { fan: eng.n1 * eng.n1, comp: Math.pow(eng.n2, 2.5), t4: eng.t4 };
  const rows = stationsEl.querySelectorAll('tr');
  STATIONS.forEach(([, tf, pf], i) => {
    const row = rows[i + 1];
    row.querySelector('.t').textContent = tf(v).toFixed(0);
    row.querySelector('.p').textContent = pf(v).toFixed(1);
  });
}

/* -------------------------- module picking --------------------------- */
const ray = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hovered = null;

function moduleOf(obj) {
  let o = obj;
  while (o && !engine.modules.includes(o)) o = o.parent;
  return o;
}

canvas.addEventListener('pointermove', (e) => {
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  // with transparent or cut-away casings, let the user pick what is beneath
  const seeThrough = state.xray || state.cutaway || !engine.parts.mNac.visible;
  const targets = seeThrough ? engine.pickables.filter((p) => !p.userData.shell) : engine.pickables;
  const hits = ray.intersectObjects(targets, false);
  const m = hits.length ? moduleOf(hits[0].object) : null;
  hovered = m;
  if (m && m.userData.title) {
    tip.textContent = m.userData.title;
    tip.style.left = `${e.clientX + 14}px`;
    tip.style.top = `${e.clientY + 14}px`;
    tip.style.opacity = 1;
    canvas.style.cursor = 'pointer';
  } else {
    tip.style.opacity = 0;
    canvas.style.cursor = 'grab';
  }
});

canvas.addEventListener('click', () => {
  if (!hovered || !hovered.userData.title) return;
  info.querySelector('h2').textContent = hovered.userData.title;
  info.querySelector('p').textContent = hovered.userData.info;
  info.classList.remove('hidden');
});

/* ============================= animation ============================= */
// Timer rather than Clock: the latter is deprecated in three 0.185, and it
// recomputed the delta on every getDelta() call, so asking twice within one
// frame gave two different answers. Timer takes its reading once in update().
const timer = new THREE.Timer();
// Page Visibility API: coming back to a hidden tab yields delta 0 instead of the
// whole time away. The clamp below would have caught that too, but this way the
// engine does not silently lose a step every time the tab is switched.
timer.connect(document);
const tmp = new THREE.Vector3();

function animate() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = timer.getElapsed();

  // the time scale affects the engine processes only: start and rundown run at
  // their natural pace (tens of seconds), and waiting them out is not always
  // appropriate
  const keff = eng.update(dt * state.timeScale, state.throttle);
  if (eng.mode !== shownMode) refreshModeUI();
  updateGauges(keff);

  // rotors: N1 (fan/booster/LPT) and N2 (HPC/HPT) turn independently
  if (state.spin) {
    n1Angle += dt * 13.7 * eng.n1;
    n2Angle -= dt * 23.0 * eng.n2;
  }
  engine.n1Rotors.forEach((g) => (g.rotation.x = n1Angle));
  engine.n2Rotors.forEach((g) => (g.rotation.x = n2Angle));
  // the spinner spiral smears with speed; with rotation off there is no smear
  engine.setSpiralBlur(state.spin ? keff : 0);

  // exploded view
  engine.modules.forEach((m) => {
    tmp.copy(m.userData.explode).multiplyScalar(state.explode);
    m.position.copy(m.userData.base).add(tmp);
  });

  // combustion and the glow of the hot section: they die with the flame, but
  // the metal cools more slowly - that is what eng.t4 accounts for
  const burn = eng.burn;
  const glow = THREE.MathUtils.clamp((eng.t4 - 250) / 1500, 0, 1); // incandescence of the metal
  engine.flameMat.uniforms.uTime.value = t;
  engine.flameMat.uniforms.uPower.value = burn * 0.7;
  MATS.turbineHot.emissive.setRGB(0.55 * glow * glow, 0.13 * glow * glow, 0.02 * glow * glow);
  MATS.diskHot.emissive.setRGB(0.3 * glow * glow, 0.06 * glow * glow, 0.01 * glow * glow);
  MATS.combLiner.emissive.setRGB(0.42 * glow, 0.1 * glow, 0.02 * glow);
  bloom.strength = 0.12 + glow * 0.2;

  airflow.update(dt, eng.n1, burn);
  haze.update(dt, burn, eng.n1);

  // sound: panning and loudness follow the camera position
  if (state.sound) {
    tmp.set(-0.3, 0, 0);
    const dist = camera.position.distanceTo(tmp);
    tmp.project(camera);
    sound.update(eng.n1, eng.n2, burn, tmp.x, THREE.MathUtils.clamp(1 - (dist - 3) / 16, 0, 1));
  }

  // camera
  if (camTween > 0) {
    camera.position.lerp(camTargetPos, 0.07);
    controls.target.lerp(camTargetLook, 0.07);
    if (camera.position.distanceTo(camTargetPos) < 0.05) camTween = 0;
  }
  controls.autoRotate = state.orbit;
  controls.autoRotateSpeed = 0.55;
  controls.update();

  composer.render();
  labelRenderer.render(scene, camera);
  requestAnimationFrame(animate);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  haze.setSize(innerWidth, innerHeight);
  labelRenderer.setSize(innerWidth, innerHeight);
});

/* ---------------------------- initialisation ------------------------- */
updateClip(state.cutHalf, state.cutRot);
setCutaway(false);
$('cut-opts').style.opacity = 0.35;
setMode('run');
animate();

setTimeout(() => document.getElementById('loading').classList.add('done'), 250);
