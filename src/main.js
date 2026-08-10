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
import { createReverser, thrustFactor } from './reverser.js';
import { atmosphere, humidity } from './atmosphere.js';
import { contrail, flipAltitude, H_MAX } from './contrail.js';
import { createContrail } from './contrailView.js';
import { createI18n, pickLocale } from './i18n.js';
import LOCALES from './locales/index.js';

/* ============================ localisation =========================== *
 *  Set up before anything is built, so the loading line is already in the
 *  reader's language for all but the tick the module graph takes to load.
 * --------------------------------------------------------------------- */

const LANG_KEY = 'turbofan.lang';

// localStorage throws in private mode and inside a sandboxed iframe. Losing
// the remembered language is a nuisance; taking the whole model down with it
// would not be.
const storedLang = () => {
  try {
    return localStorage.getItem(LANG_KEY);
  } catch {
    return null;
  }
};
const storeLang = (tag) => {
  try {
    localStorage.setItem(LANG_KEY, tag);
  } catch {
    /* nothing to do: the choice simply will not survive the visit */
  }
};

const i18n = createI18n({
  locales: LOCALES,
  initial: storedLang() || pickLocale(navigator.languages, Object.keys(LOCALES)),
});
const { t, n } = i18n;

function applyStatic() {
  // querySelectorAll reaches into <head> as well, and textContent on <title>
  // is document.title, so the tab caption needs no special case.
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  // CJK line breaking depends on this, and so does a screen reader choosing
  // a voice
  document.documentElement.lang = i18n.locale();
}

applyStatic();

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
// far enough to take in the contrail, which runs 38 m aft of the nozzle
controls.maxDistance = 120;
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

// the trail lives outside the flow visualisation: it runs off to the edge of
// the scene, far past the 4 m of duct the particles know about
const trail = createContrail();
scene.add(trail.group);

/* ------------------------------ labels ------------------------------- */
const labelObjects = [];
// the div and its key are kept side by side so the text can be refilled when
// the language changes without rebuilding the CSS2D objects
const labelDivs = [];
engine.labels.forEach((l) => {
  const div = document.createElement('div');
  div.className = 'lbl';
  div.textContent = t(l.key);
  labelDivs.push({ div, key: l.key });
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
  altitude: 0, // m
  deltaISA: 0, // deviation of the day from standard, K
  rh: 0.6, // relative humidity over water, 0..1
  eta: 0.3, // propulsive efficiency, an input: the model cannot compute it
  trail: true,
  labels: true,
};

// ambient conditions and the contrail verdict; recomputed only when the
// sliders move - none of it depends on the engine except through the
// efficiency, which is a slider of its own
let amb = atmosphere(state.altitude, state.deltaISA);
let hum = humidity(amb.t, state.rh);
let verdict = contrail(amb, hum, state.eta);

let n1Angle = 0;
let n2Angle = 0;
// the last bang count consumed by the frame loop; the surge state machine
// counts them, and everything downstream latches on a change
let shownBangs = 0;
// brightness left over from the last bang, decaying; folded into bloom.strength
let flash = 0;

/* ---------------------------- engine state --------------------------- */
const eng = createEngineState(state.throttle);
const rev = createReverser();

// Only the class names live here. The text moved to the dictionary, and the
// two are kept apart on purpose: a typo in one of eight locale files must not
// be able to break the styling of the status bar.
const MODE_CLASS = { off: 'off', start: 'busy', run: '', stop: 'stop' };

// The state machine makes the transitions "rundown -> off" and "start -> run"
// on its own, so the panel is refreshed whenever the mode actually changes,
// not only when a button is pressed.
let shownMode = null;

function refreshModeUI() {
  const mode = eng.mode;
  shownMode = mode;
  const bar = $('mode-bar');
  bar.className = `statusbar ${MODE_CLASS[mode]}`;
  $('val-mode').textContent = t(`mode.${mode}`);

  const btn = $('btn-power');
  const running = mode === 'run' || mode === 'start';
  btn.classList.toggle('danger', running);
  btn.classList.toggle('start', !running);
  btn.classList.toggle('busy', mode === 'start' || mode === 'stop');
  $('power-label').textContent = t(running ? 'power.shutdown' : 'power.start');
  $('power-hint').textContent = t(
    mode === 'start'
      ? 'power.hint.starting'
      : mode === 'stop'
        ? 'power.hint.stopping'
        : running
          ? 'power.hint.running'
          : 'power.hint.off'
  );
  $('thr-wrap').classList.toggle('disabled', mode !== 'run');
  // the reverser can only be selected on a running engine, so its button
  // changes with the mode as well
  refreshReverserUI();
  // and the stability bar has nothing to say about a stopped engine
  refreshSurgeUI();
}

function setMode(mode) {
  eng.setMode(mode);
  // Anything but running stows the reverser. The stow takes 3 s against a 35 s
  // rundown, so it always gets home; an engine that has stopped is never left
  // with the sleeve out.
  if (mode !== 'run') rev.request(false, mode);
  refreshModeUI();
}

/* --------------------------- thrust reverser ------------------------- *
 *  Class names only, for the same reason as MODE_CLASS: a typo in one of
 *  eight locale files must not be able to break the styling.
 * --------------------------------------------------------------------- */
const REV_CLASS = { stowed: 'off', deploying: 'busy', deployed: '', stowing: 'busy' };

// as with the engine mode, the transitions "deploying -> deployed" and
// "stowing -> stowed" happen inside the state machine when the sleeve actually
// arrives, so the panel is refreshed on a change rather than on a click
let shownRev = null;

function refreshReverserUI() {
  shownRev = rev.mode;
  $('rev-bar').className = `statusbar ${REV_CLASS[rev.mode]}`;
  $('val-rev').textContent = t(`rev.${rev.mode}`);

  const btn = $('btn-rev');
  const armed = eng.mode === 'run';
  btn.disabled = !armed;
  btn.classList.toggle('on', rev.mode === 'deployed' || rev.mode === 'deploying');
  btn.classList.toggle('busy', rev.mode === 'deploying' || rev.mode === 'stowing');
  $('rev-hint').textContent = t(
    !armed
      ? 'rev.hint.off'
      : rev.mode === 'stowed'
        ? 'rev.hint.deploy'
        : rev.mode === 'deployed'
          ? 'rev.hint.stow'
          : 'rev.hint.moving'
  );
}

function toggleReverser() {
  rev.request(rev.mode === 'stowed' || rev.mode === 'stowing', eng.mode);
  refreshReverserUI();
}

/* -------------------------- compressor surge ------------------------- *
 *  Class names only, as above. Amber for a surge and red for a locked
 *  stall: one is a transient the reader can fly out of, the other is not.
 * --------------------------------------------------------------------- */
const SURGE_CLASS = { clear: 'off', surging: 'busy', stall: 'stop' };

// as with the engine mode and the reverser, every transition here is made by
// the state machine rather than by a click - the lock into a stall especially,
// which happens four seconds after the reader stops doing anything at all
let shownSurge = null;

function refreshSurgeUI() {
  shownSurge = eng.surge;
  $('surge-bar').className = `statusbar ${SURGE_CLASS[eng.surge]}`;
  $('val-surge').textContent = t(`surge.${eng.surge}`);
  // a stopped engine has no stability to report, exactly as it has no reverser
  $('surge-hint').textContent = t(eng.mode === 'run' ? `surge.hint.${eng.surge}` : 'surge.hint.off');
}

/* ----------------------------- elements ------------------------------ */
const $ = (id) => document.getElementById(id);
const btnFlow = $('btn-flow');
const btnCut = $('btn-cut');
const legend = $('legend');
const info = $('info');
const tip = $('tip');

const VIEWS = [
  { key: 'view.overview', pos: [-11.6, 4.8, 13.8], target: [-0.3, 0, 0] },
  { key: 'view.cutaway', pos: [-8.2, 5.8, 10.4], target: [-0.5, 0, 0], cut: true },
  { key: 'view.front', pos: [-13.5, 1.0, 3.0], target: [-4.4, 0, 0] },
  { key: 'view.fan', pos: [-8.2, 2.2, 4.6], target: [-3.22, 0, 0] },
  { key: 'view.hpc', pos: [-4.6, 2.1, 4.0], target: [-1.61, 0, 0], cut: true },
  { key: 'view.combustor', pos: [-1.6, 1.9, 3.8], target: [-0.56, 0, 0], cut: true },
  { key: 'view.turbine', pos: [1.5, 2.1, 4.4], target: [0.44, 0, 0], cut: true },
  { key: 'view.nozzle', pos: [7.6, 2.8, 7.0], target: [3.0, 0, 0] },
  // the camera sits right at the edge of the jet cone: the jet comes towards
  // the viewer, but the engine is not entirely drowned in it as it would be
  // directly on the axis
  { key: 'view.behind', pos: [11.5, 2.2, 3.6], target: [0.5, 0, 0] },
  // far enough back for the trail to have somewhere to run: the engine is
  // small in the frame, which is the point
  { key: 'view.contrail', pos: [-44, 22, 84], target: [14, 0, 0] },
];

// the tenth view is reached by the zero key, the other nine by their own digit
const VIEW_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

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
function buildViewButtons() {
  viewsEl.textContent = '';
  VIEWS.forEach((v, i) => {
    const b = document.createElement('button');
    b.textContent = `${VIEW_KEYS[i]}. ${t(v.key)}`;
    b.onclick = () => goView(v);
    viewsEl.appendChild(b);
  });
}
buildViewButtons();

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

$('btn-rev').onclick = () => toggleReverser();

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
  // The reverser is the aft section of the same cowl, and it is a module of its
  // own: hide one without the other and the sleeve, the cascade box and twelve
  // doors are left hanging in the air around a bare engine.
  engine.parts.mNac.visible = e.target.checked;
  engine.parts.mRev.visible = e.target.checked;
};
$('chk-labels').onchange = (e) => {
  state.labels = e.target.checked;
};
$('chk-lines').onchange = (e) => airflow.setLines(e.target.checked);
$('chk-haze').onchange = (e) => {
  state.haze = e.target.checked;
  haze.setEnabled(state.haze);
};
$('chk-trail').onchange = (e) => {
  state.trail = e.target.checked;
  trail.setEnabled(state.trail);
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
  } else if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
    toggleReverser();
  } else if (e.key === 'x' || e.key === 'X' || e.key === 'ч' || e.key === 'Ч') {
    $('chk-xray').checked = !state.xray;
    state.xray = !state.xray;
    setXray(state.xray);
  } else if (e.key === 'h' || e.key === 'H' || e.key === 'р' || e.key === 'Р') {
    $('chk-haze').checked = !state.haze;
    state.haze = !state.haze;
    haze.setEnabled(state.haze);
  } else if (e.key === 't' || e.key === 'T' || e.key === 'е' || e.key === 'Е') {
    $('chk-trail').checked = !state.trail;
    state.trail = !state.trail;
    trail.setEnabled(state.trail);
  } else if (e.key >= '1' && e.key <= '9') {
    goView(VIEWS[+e.key - 1]);
  } else if (e.key === '0') {
    goView(VIEWS[9]); // the contrail view is the tenth, hence the zero
  }
});

/* ------------------------------- gauges ------------------------------ *
 *  fan  - fan compression, driven by N1
 *  comp - HP compressor compression, driven by N2
 *  t4   - actual gas temperature ahead of the turbine
 * -------------------------------------------------------------------- */
/*
 * The gas path is counted off from the ambient air, not from a fixed
 * standard day: pressures are the pressure ratios multiplied by the ambient
 * pressure, and the temperature rises are multiplied by theta = T/288.15.
 *
 * The scaling matters. The work of a compressor stage - and hence the heating
 * - is proportional to the inlet temperature, so the same rotor speed in the
 * cold air of eleven kilometres gives a quarter less heating: 585 K of rise at
 * sea level become 440. Adding the sea-level rise to a cold intake would give
 * an honest-looking but wrong 528 °C behind the compressor instead of 383.
 *
 * The temperatures behind the turbines stay fractions of T4: T4 is set by
 * combustion, and the model does not recompute the engine for altitude.
 */
const STATIONS = [
  ['station.intake', ({ t }) => t, ({ p }) => p],
  ['station.bypass', ({ t, theta, fan }) => t + theta * 34 * fan, ({ p, fan }) => p * (1 + 0.68 * fan)],
  ['station.booster', ({ t, theta, fan }) => t + theta * 105 * fan, ({ p, fan }) => p * (1 + 1.7 * fan)],
  // The overall pressure ratio of the prototype is about 28 (fan 1.7, booster
  // 1.5, HPC 11), not 40-50 as on next-generation engines.
  ['station.hpc', ({ t, theta, comp }) => t + theta * 585 * comp, ({ p, comp }) => p * (1 + 27 * comp)],
  ['station.combustor', ({ t4 }) => t4, ({ p, comp }) => p * (1 + 26 * comp)],
  ['station.hpt', ({ t4 }) => t4 * 0.494, ({ p, comp }) => p * (1 + 6 * comp)],
  ['station.nozzle', ({ t4 }) => t4 * 0.293, ({ p, fan }) => p * (1 + 0.65 * fan)],
];

// The contrail is fed by the two streams mixed, not by the hot one alone: the
// bypass duct is cold and carries five times the flow of the prototype.
const BPR = 5.1;
const ST_BYPASS = 1;
const ST_NOZZLE = 6;
const mixedExhaustT = (v) => (BPR * STATIONS[ST_BYPASS][1](v) + STATIONS[ST_NOZZLE][1](v)) / (BPR + 1);

const stationsEl = $('stations');

// declared before buildStationTable, which resets it: a `let` read from inside
// a function called earlier in the file would land in its temporal dead zone
let gaugeShown = -1;

function buildStationTable() {
  const head = (k) => `<td style="color:#5f6b7c">${t(k)}</td>`;
  stationsEl.innerHTML =
    `<tr>${head('stations.head.station')}${head('stations.head.t')}${head('stations.head.p')}</tr>` +
    STATIONS.map(([k]) => `<tr><td>${t(k)}</td><td class="t"></td><td class="p"></td></tr>`).join('');
  // the rows were just replaced, so the hash guard in updateGauges must not
  // decide the numbers are already on screen and leave the new cells empty
  gaugeShown = -1;
}
buildStationTable();

function updateGauges() {
  // hash of the state, so the DOM is not touched every frame without need.
  // The ambient conditions are not in the hash: they change only when a slider
  // is moved, and that invalidates the hash directly.
  // The sleeve is in the hash because the thrust follows it: at a steady N1
  // through a deployment nothing else here changes, and the read-out would
  // freeze at the forward figure while the number it shows goes negative.
  /* The margin is in the hash because in a locked stall it is the only thing
     moving: N2 hangs and T4 creeps slowly enough to sit inside the tolerance
     below, and the read-out would freeze while the engine cooked. Same trap the
     sleeve travel was added for. */
  const h = eng.n1 * 7 + eng.n2 * 13 + eng.t4 * 0.001 + rev.travel * 3 + eng.sm * 11;
  if (Math.abs(h - gaugeShown) < 0.002) return;
  gaugeShown = h;

  // Reverse turns this negative: the fan stream, four fifths of the thrust, is
  // sent forward through the cascades while the core carries on aft.
  const thrust = eng.grossThrust * thrustFactor(rev.blocked);
  $('val-n1').textContent = `${n(eng.n1 * 100, 0)} %`;
  $('val-n2').textContent = `${n(eng.n2 * 100, 0)} %`;
  $('val-t4').textContent = `${n(eng.t4, 0)} °C`;
  $('val-thrust').textContent = `${n(thrust, 0)} kN`;
  $('val-sm').textContent = eng.mode === 'run' ? n(eng.sm, 3) : '—';

  const v = {
    fan: eng.n1 * eng.n1,
    comp: Math.pow(eng.n2, 2.5),
    t4: eng.t4,
    t: amb.t,
    p: amb.p / 1e5, // bar
    theta: amb.theta,
  };
  $('val-tmix').textContent = `${n(mixedExhaustT(v), 0)} °C`;

  const rows = stationsEl.querySelectorAll('tr');
  STATIONS.forEach(([, tf, pf], i) => {
    const row = rows[i + 1];
    const p = pf(v);
    row.querySelector('.t').textContent = n(tf(v), 0);
    // at altitude the whole column shrinks by a factor of four, and a single
    // decimal would turn the intake into a flat "0.2"
    row.querySelector('.p').textContent = n(p, p < 10 ? 2 : 1);
  });
}

/* ------------------------ ambient conditions ------------------------- *
 *  The engine stays parked, but the air around it can be lifted to the
 *  cruise levels. Nothing inside the engine is recomputed - the speeds,
 *  T4 and thrust are the same as on the ground; what changes is the air
 *  the gas path is counted off from.
 *
 *  The wiring lives here, next to the station table, because that table
 *  is its only consumer so far.
 * --------------------------------------------------------------------- */
const ALT_PRESETS = [
  ['alt-0', 0], // parked
  ['alt-3', 3000], // climb
  ['alt-11', 11000], // cruise, right at the tropopause
];

// vapour pressure runs from thousands of pascals at the ground to units of
// them at altitude, so the number of decimals follows the value
const pascals = (e) => n(e, e >= 100 ? 0 : e >= 10 ? 1 : 2);

function setAmbient(altitude, deltaISA, rh) {
  state.altitude = altitude;
  state.deltaISA = deltaISA;
  state.rh = rh;
  amb = atmosphere(altitude, deltaISA);
  hum = humidity(amb.t, rh);

  // the sliders are also driven by the preset buttons, hence the write back
  $('alt').value = altitude / 100;
  $('isa').value = deltaISA;
  $('rh').value = Math.round(rh * 100);
  $('val-alt').textContent = `${n(altitude / 1000, 1)} km`;
  $('val-isa').textContent = `${deltaISA > 0 ? '+' : ''}${n(deltaISA, 0)} °C`;
  $('val-rh').textContent = `${n(Math.round(rh * 100), 0)} %`;
  $('val-amb-t').textContent = `${n(amb.t, 1)} °C`;
  $('val-amb-p').textContent = n(amb.p / 1e5, 3);
  $('val-amb-rho').textContent = n(amb.rho, 3);
  // perfectly dry air has no temperature at which it would condense
  $('val-amb-td').textContent = hum.dewPoint === null ? '—' : `${n(hum.dewPoint, 1)} °C`;
  $('val-amb-e').textContent = pascals(hum.e);
  // above freezing there is no ice to saturate over, hence the dash
  $('val-amb-rhi').textContent = hum.rhIce === null ? '—' : `${n(100 * hum.rhIce, 0)} %`;
  // above 100 % over ice a contrail would persist rather than evaporate - the
  // one number in the block that is here for a task not yet done (BL-21)
  $('val-amb-rhi').style.color = hum.rhIce > 1 ? 'var(--acc)' : '#7a8494';
  ALT_PRESETS.forEach(([id, h]) => $(id).classList.toggle('on', h === altitude));

  refreshContrail();
  gaugeShown = -1; // the station table has to be redrawn, the engine has not moved
}

ALT_PRESETS.forEach(([id, h]) => {
  $(id).onclick = () => setAmbient(h, state.deltaISA, state.rh);
});
$('alt').oninput = (e) => setAmbient(+e.target.value * 100, state.deltaISA, state.rh);
$('isa').oninput = (e) => setAmbient(state.altitude, +e.target.value, state.rh);
$('rh').oninput = (e) => setAmbient(state.altitude, state.deltaISA, e.target.value / 100);

/* ---------------------------- contrail ------------------------------- *
 *  The verdict is about the air, not about the engine: the same three
 *  conditions plus one number from the engine, the efficiency. It is
 *  recomputed with the sliders rather than every frame - only the drawing
 *  follows the combustion.
 * --------------------------------------------------------------------- */
// class names only, for the same reason as MODE_CLASS above
const VERDICT_CLASS = { none: 'off', 'short-lived': 'busy', persistent: '' };

function refreshContrail() {
  verdict = contrail(amb, hum, state.eta);

  $('trail-bar').className = `statusbar ${VERDICT_CLASS[verdict.verdict]}`;
  $('val-trail').textContent = t(`verdict.${verdict.verdict}`);
  $('val-eta').textContent = n(state.eta, 2);
  $('val-g').textContent = n(verdict.G, 2);
  $('val-tform').textContent = `${n(verdict.tForm, 1)} °C`;

  // how much would have to change for the verdict to flip: the altitude is
  // searched for on the real criterion, since pressure moves the threshold
  // too, and it is a more telling answer than a temperature margin alone
  const flip = flipAltitude(state.altitude, state.deltaISA, state.rh, state.eta);
  const dKm = flip === null ? null : (flip - state.altitude) / 1000;

  /* Whole sentences rather than glued fragments. Concatenation reads well in
   * English and falls apart in Japanese, where the clauses have no matching
   * grammatical positions; the one seam left, {where}, sits on a sentence
   * boundary, which is safe in all eight languages. The ceiling in
   * where.nowhere comes from H_MAX rather than being written into the prose,
   * so eight translations cannot go stale if the search range ever moves. */
  const where =
    dKm === null
      ? t('where.nowhere', { max: n(H_MAX / 1000, 0) })
      : t(`where.${dKm > 0 ? 'higher' : 'lower'}.${verdict.forms ? 'stop' : 'start'}`, {
          km: n(Math.abs(dKm), 1),
        });

  $('trail-hint').textContent = verdict.forms
    ? t(verdict.persistent ? 'hint.trail.persistent' : 'hint.trail.shortLived', {
        margin: n(verdict.margin, 1),
        where,
      })
    : t('hint.trail.none', { margin: n(-verdict.margin, 1), where });
}

$('eta').oninput = (e) => {
  state.eta = e.target.value / 100;
  refreshContrail();
};

setAmbient(state.altitude, state.deltaISA, state.rh);

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
  if (m) {
    tip.textContent = t(`module.${m.name}.title`);
    tip.style.left = `${e.clientX + 14}px`;
    tip.style.top = `${e.clientY + 14}px`;
    tip.style.opacity = 1;
    canvas.style.cursor = 'pointer';
  } else {
    tip.style.opacity = 0;
    canvas.style.cursor = 'grab';
  }
});

// which module the card is showing, so it can be re-rendered in a new
// language without the reader having to close and reopen it. Not `hovered`:
// the pointer has usually moved on by then.
let cardModule = null;

function fillCard(m) {
  info.querySelector('h2').textContent = t(`module.${m.name}.title`);
  info.querySelector('p').textContent = t(`module.${m.name}.info`);
}

canvas.addEventListener('click', () => {
  if (!hovered) return;
  cardModule = hovered;
  fillCard(cardModule);
  info.classList.remove('hidden');
});

/* --------------------------- language switch -------------------------- *
 *  Everything the panel builds once at start-up has to be rebuilt here.
 *  Defined after every function it calls.
 * --------------------------------------------------------------------- */
function applyLanguage(tag) {
  i18n.setLocale(tag);
  storeLang(tag);

  applyStatic();
  buildViewButtons();
  buildStationTable();
  labelDivs.forEach(({ div, key }) => {
    div.textContent = t(key);
  });
  refreshModeUI(); // and with it the reverser panel
  refreshContrail();
  // re-formats the ambient read-outs, which is where the decimal separator
  // changes for five of the eight languages
  setAmbient(state.altitude, state.deltaISA, state.rh);
  if (cardModule) fillCard(cardModule);
}

const langSel = $('lang');
langSel.value = i18n.locale();
langSel.onchange = (e) => applyLanguage(e.target.value);

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
  /* The reverser goes first: the cap it puts on the throttle belongs to this
     frame's sleeve position, not to the last one. The time scale applies to it
     too - a start run at x4 with a sleeve moving at x1 would be two clocks in
     one scene. */
  rev.update(dt * state.timeScale);
  if (rev.mode !== shownRev) refreshReverserUI();
  engine.setReverser(rev.travel);

  const keff = eng.update(dt * state.timeScale, Math.min(state.throttle, rev.throttleLimit()));
  if (eng.mode !== shownMode) refreshModeUI();
  if (eng.surge !== shownSurge) refreshSurgeUI();
  updateGauges();

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
  /* The flash of a surge, folded into the one assignment that owns the bloom
     rather than written beside it. This line runs unconditionally every frame,
     so a pulse written before it would be overwritten and one written after it
     would never decay. */
  flash = Math.max(0, flash - dt * 4);
  bloom.strength = 0.12 + glow * 0.2 + flash * 0.55;

  /* The bang is an event, and it is latched here - once per frame, however many
     cycles the state machine got through. Everything that reacts to a bang
     reads the SAME latch, so the flow and the sound cannot come to disagree
     about how many there were; at the ×4 time scale a frame can carry more than
     one, and two of them 5 ms apart is worse than one. */
  const bang = eng.bangs !== shownBangs;
  shownBangs = eng.bangs;
  const surgeView = { state: eng.surge, bang, reverse: eng.reverse, cell: eng.cell };
  if (bang) flash = 1;

  // only the bypass stream knows about the reverser; the core plume, the heat
  // haze and the contrail are the same in reverse as they are in forward thrust
  airflow.update(dt, eng.n1, burn, rev.blocked, surgeView);
  haze.update(dt, burn, eng.n1, rev.travel, rev.blocked);
  // the verdict is about the air, but the water is the engine's: fuel cut, and
  // the trail dies with the flame
  trail.update(dt, verdict, burn);

  // sound: panning and loudness follow the camera position
  if (state.sound) {
    tmp.set(-0.3, 0, 0);
    const dist = camera.position.distanceTo(tmp);
    tmp.project(camera);
    sound.update(
      eng.n1,
      eng.n2,
      burn,
      tmp.x,
      THREE.MathUtils.clamp(1 - (dist - 3) / 16, 0, 1),
      rev.blocked,
      surgeView
    );
    // one one-shot per frame however many cycles the state machine got through:
    // two bangs five milliseconds apart is worse than one
    if (bang) sound.bang(0.6 + 0.4 * eng.reverse);
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

  // The fog gives the close-up views their depth, but the contrail runs off to
  // 38 m and pulling the camera back that far would drown the engine in it.
  // The far edge follows the camera distance and leaves the near view alone.
  const camDist = camera.position.distanceTo(controls.target);
  scene.fog.far = Math.max(60, camDist * 2.2);
  // From the contrail view the engine is small in the frame and the labels
  // collapse into a heap of boxes over it. Below 45 units - everything the
  // camera could reach before the trail arrived - nothing changes.
  labelObjects.forEach((o) => (o.visible = state.labels && camDist < 45));

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
