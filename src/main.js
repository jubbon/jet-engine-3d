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
import { createEngineSound } from './sound.js';
import { createEngineState } from './engineState.js';

/* =============================== сцена =============================== */

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
camera.position.set(-10.5, 4.4, 12.5);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 1.5;
controls.maxDistance = 40;
controls.target.set(-0.3, 0, 0);

const labelRenderer = new CSS2DRenderer({ element: document.getElementById('labels') });
labelRenderer.setSize(innerWidth, innerHeight);

/* ---------------------------- окружение ----------------------------- */
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

// «пол» — тонкая сетка для ощущения масштаба
const grid = new THREE.GridHelper(60, 60, 0x2a3442, 0x161c25);
grid.position.y = -3.6;
grid.material.transparent = true;
grid.material.opacity = 0.45;
scene.add(grid);

/* ============================== двигатель ============================= */

const engine = buildEngine();
scene.add(engine.root);

const airflow = createAirflow();
scene.add(airflow.group);

/* ------------------------------ подписи ------------------------------ */
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

/* --------------------------- вырез (разрез) -------------------------- */
const clipA = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
const clipB = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const clipPlanes = [clipA, clipB];

function updateClip(halfDeg, centerDeg) {
  const c = THREE.MathUtils.degToRad(centerDeg);
  const h = THREE.MathUtils.degToRad(halfDeg);
  const a = c - h;
  const b = c + h;
  // сохраняем полупространства «до» и «после» сектора (объединение)
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

/* ----------------------------- «рентген» ----------------------------- */
function setXray(on) {
  getShellMaterials().forEach((m) => {
    m.transparent = on;
    m.opacity = on ? 0.16 : 1;
    m.depthWrite = !on;
    m.needsUpdate = true;
  });
}

/* =============================== постобработка ======================= */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.2, 0.4, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ============================ состояние UI =========================== */
const state = {
  throttle: 0.85, // положение РУД
  sound: false,
  flow: false,
  cutaway: false,
  xray: false,
  spin: true,
  orbit: false,
  explode: 0,
  cutHalf: 100,
  cutRot: 90,
  timeScale: 1, // ускорение процессов двигателя, ×1 или ×4
};

let n1Angle = 0;
let n2Angle = 0;

/* ------------------------- состояние двигателя ------------------------ */
const eng = createEngineState(state.throttle);

const MODE_TEXT = {
  off: ['ВЫКЛЮЧЕН', 'off'],
  start: ['ЗАПУСК', 'busy'],
  run: ['РАБОТА', ''],
  stop: ['ОСТАНОВ · ВЫБЕГ', 'stop'],
};

// Автомат сам переходит «выбег → выключен» и «запуск → работа»,
// поэтому панель обновляется по факту смены режима, а не только по кнопке.
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
  $('power-label').textContent = running ? 'Останов двигателя' : 'Запуск двигателя';
  $('power-hint').textContent =
    mode === 'start'
      ? 'раскрутка стартером, розжиг…'
      : mode === 'stop'
        ? 'топливо отсечено, роторы на выбеге…'
        : running
          ? 'стоп-кран, выбег роторов'
          : 'стартер, розжиг, выход на малый газ';
  $('thr-wrap').classList.toggle('disabled', mode !== 'run');
}

function setMode(mode) {
  eng.setMode(mode);
  refreshModeUI();
}

/* ------------------------------ элементы ----------------------------- */
const $ = (id) => document.getElementById(id);
const btnFlow = $('btn-flow');
const btnCut = $('btn-cut');
const legend = $('legend');
const info = $('info');
const tip = $('tip');

const VIEWS = [
  { name: 'Общий вид', pos: [-10.5, 4.4, 12.5], target: [-0.3, 0, 0] },
  { name: 'В разрезе', pos: [-7.5, 5.4, 9.5], target: [-0.4, 0, 0], cut: true },
  { name: 'Спереди', pos: [-13.5, 1.0, 3.0], target: [-3.6, 0, 0] },
  { name: 'Вентилятор', pos: [-8.6, 2.2, 4.6], target: [-3.9, 0, 0] },
  { name: 'Компрессор ВД', pos: [-4.4, 2.1, 4.3], target: [-1.4, 0, 0], cut: true },
  { name: 'Камера сгорания', pos: [-1.0, 2.0, 4.2], target: [0.15, 0, 0], cut: true },
  { name: 'Турбина', pos: [2.6, 2.2, 4.8], target: [1.7, 0, 0], cut: true },
  { name: 'Сопло и струя', pos: [8.2, 2.8, 7.0], target: [3.4, 0, 0] },
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

/* ----------------------------- переключатели -------------------------- */
function toggleFlow(on) {
  state.flow = on;
  btnFlow.classList.toggle('on', on);
  airflow.setVisible(on);
  legend.classList.toggle('hidden', !on);
  // чтобы потоки было видно внутри — делаем корпуса прозрачными
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

/* -------------------------------- звук -------------------------------- */
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

// запуск / останов: во время выбега можно снова запустить, во время запуска - прервать
$('btn-power').onclick = () => {
  setMode(eng.mode === 'run' || eng.mode === 'start' ? 'stop' : 'start');
};

// скорость времени: запуск занимает около 40 с, выбег - 35 с, как у настоящего
// двигателя; ускорение позволяет не ждать их целиком
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
$('chk-spin').onchange = (e) => (state.spin = e.target.checked);
$('chk-orbit').onchange = (e) => (state.orbit = e.target.checked);
$('info-close').onclick = () => info.classList.add('hidden');

addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    toggleFlow(!state.flow);
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
  } else if (e.key >= '1' && e.key <= '8') {
    goView(VIEWS[+e.key - 1]);
  }
});

/* ------------------------------ приборы ------------------------------ *
 *  fan  - сжатие в вентиляторе, от оборотов N1
 *  comp - сжатие в КВД, от оборотов N2
 *  t4   - фактическая температура газа перед турбиной
 * -------------------------------------------------------------------- */
const STATIONS = [
  ['Вход', () => 15, () => 1.0],
  ['Наружный контур', ({ fan }) => 15 + 34 * fan, ({ fan }) => 1 + 0.68 * fan],
  ['За КНД', ({ fan }) => 15 + 105 * fan, ({ fan }) => 1 + 1.7 * fan],
  ['За КВД', ({ comp }) => 15 + 620 * comp, ({ comp }) => 1 + 42 * comp],
  ['Камера сгорания', ({ t4 }) => t4, ({ comp }) => 1 + 40 * comp],
  ['За ТВД', ({ t4 }) => t4 * 0.494, ({ comp }) => 1 + 9 * comp],
  ['Срез сопла', ({ t4 }) => t4 * 0.293, ({ fan }) => 1 + 0.65 * fan],
];

const stationsEl = $('stations');
stationsEl.innerHTML =
  '<tr><td style="color:#5f6b7c">станция</td><td style="color:#5f6b7c">T, °C</td><td style="color:#5f6b7c">P, бар</td></tr>' +
  STATIONS.map(([n]) => `<tr><td>${n}</td><td class="t"></td><td class="p"></td></tr>`).join('');

let gaugeShown = -1;
function updateGauges(keff) {
  // хэш состояния, чтобы не трогать DOM на каждом кадре без нужды
  const h = eng.n1 * 7 + eng.n2 * 13 + eng.t4 * 0.001;
  if (Math.abs(h - gaugeShown) < 0.002) return;
  gaugeShown = h;

  const thrust = eng.fuel ? 132 * Math.pow(keff, 1.45) : 0;
  $('val-n1').textContent = `${(eng.n1 * 100).toFixed(0)} %`;
  $('val-n2').textContent = `${(eng.n2 * 100).toFixed(0)} %`;
  $('val-t4').textContent = `${eng.t4.toFixed(0)} °C`;
  $('val-thrust').textContent = `${thrust.toFixed(0)} кН`;

  const v = { fan: eng.n1 * eng.n1, comp: Math.pow(eng.n2, 2.5), t4: eng.t4 };
  const rows = stationsEl.querySelectorAll('tr');
  STATIONS.forEach(([, tf, pf], i) => {
    const row = rows[i + 1];
    row.querySelector('.t').textContent = tf(v).toFixed(0);
    row.querySelector('.p').textContent = pf(v).toFixed(1);
  });
}

/* --------------------------- выбор узлов ----------------------------- */
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
  // при прозрачных/вырезанных корпусах даём выбирать то, что под ними
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

/* ============================== анимация ============================== */
const clock = new THREE.Clock();
const tmp = new THREE.Vector3();

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // ускорение времени влияет только на процессы в двигателе: запуск и выбег
  // идут в натуральном темпе (десятки секунд), и ждать их не всегда уместно
  const keff = eng.update(dt * state.timeScale, state.throttle);
  if (eng.mode !== shownMode) refreshModeUI();
  updateGauges(keff);

  // роторы: N1 (вентилятор/КНД/ТНД) и N2 (КВД/ТВД) вращаются независимо
  if (state.spin) {
    n1Angle += dt * 13.7 * eng.n1;
    n2Angle -= dt * 23.0 * eng.n2;
  }
  engine.n1Rotors.forEach((g) => (g.rotation.x = n1Angle));
  engine.n2Rotors.forEach((g) => (g.rotation.x = n2Angle));

  // разнесение узлов
  engine.modules.forEach((m) => {
    tmp.copy(m.userData.explode).multiplyScalar(state.explode);
    m.position.copy(m.userData.base).add(tmp);
  });

  // горение и подсветка горячей части: гаснут вместе с пламенем,
  // но металл остывает медленнее - за это отвечает eng.t4
  const burn = eng.burn;
  const glow = THREE.MathUtils.clamp((eng.t4 - 250) / 1500, 0, 1); // накал металла
  engine.flameMat.uniforms.uTime.value = t;
  engine.flameMat.uniforms.uPower.value = burn * 0.7;
  MATS.turbineHot.emissive.setRGB(0.55 * glow * glow, 0.13 * glow * glow, 0.02 * glow * glow);
  MATS.diskHot.emissive.setRGB(0.3 * glow * glow, 0.06 * glow * glow, 0.01 * glow * glow);
  MATS.combLiner.emissive.setRGB(0.42 * glow, 0.1 * glow, 0.02 * glow);
  bloom.strength = 0.12 + glow * 0.2;

  airflow.update(dt, eng.n1, burn);

  // звук: панорама и громкость следуют за положением камеры
  if (state.sound) {
    tmp.set(-0.3, 0, 0);
    const dist = camera.position.distanceTo(tmp);
    tmp.project(camera);
    sound.update(eng.n1, eng.n2, burn, tmp.x, THREE.MathUtils.clamp(1 - (dist - 3) / 16, 0, 1));
  }

  // камера
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
  labelRenderer.setSize(innerWidth, innerHeight);
});

/* --------------------------- инициализация --------------------------- */
updateClip(state.cutHalf, state.cutRot);
setCutaway(false);
$('cut-opts').style.opacity = 0.35;
setMode('run');
animate();

setTimeout(() => document.getElementById('loading').classList.add('done'), 250);
