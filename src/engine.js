import * as THREE from 'three';
import { makeBladeGeometry, bladeRow } from './blade.js';

/* ------------------------------------------------------------------ *
 *  Геометрическая схема ТРДД (турбовентиляторного двигателя большой
 *  степени двухконтурности, типа CFM LEAP / GE90 / Trent).
 *  Ось двигателя - X, поток идёт в направлении +X.
 *  1 условная единица = 0.50 м (вентилятор Ø 3.12 у.е. = 1.56 м, CFM56-7B).
 * ------------------------------------------------------------------ */

export const ST = {
  lip: -5.2, // передняя кромка воздухозаборника
  fan: -3.95, // плоскость вентилятора
  splitter: -3.55, // разделитель контуров
  boosterIn: -3.35,
  boosterOut: -2.6,
  hpcIn: -2.3,
  hpcOut: -0.55,
  combIn: -0.28,
  combOut: 0.55,
  hptIn: 0.62,
  hptOut: 1.15,
  lptIn: 1.42,
  lptOut: 2.78,
  frame: 2.98,
  bypassExit: 1.6,
  coreExit: 4.05,
  plugTip: 4.75,
  fanTip: 1.56,
  caseR: 1.62,
};

/* -------------------- смаз спирали на коке -------------------------- *
 *  Спираль на коке существует, чтобы её было видно: на стоянке и малых
 *  оборотах она предупреждает наземный персонал о работающем двигателе.
 *  Но глаз усредняет картинку примерно за 1/25 с, и уже на средних
 *  оборотах спираль заметает полный круг - остаётся ровное кольцо, а на
 *  взлётном режиме её не видно вовсе.
 *
 *  Считаем это накоплением: рисуем несколько копий спирали, растянутых
 *  по углу на заметённый сектор. Точка кадра, закрытая одной копией из
 *  n, получает прозрачность 1/n - ровно ту долю времени, которую спираль
 *  реально провела в этой точке.
 *
 *  Заметённый угол берём НЕ от экранной скорости вращения: в модели
 *  роторы намеренно замедлены ради читаемости (см. docs/03-physics.md),
 *  и по ней спираль не смазалась бы никогда. Привязка идёт к
 *  приведённому режиму keff, чтобы на малом газе спираль читалась,
 *  а к взлётному исчезала - как на настоящем двигателе.
 * -------------------------------------------------------------------- */

// Максимум копий. Нужен такой, чтобы на взлётном режиме шаг между ними не
// превысил толщину спирали: иначе вместо ровного кольца выйдут полосы.
export const SPIRAL_GHOSTS = 56;
const SPIRAL_WIDTH = 0.13; // угловая толщина спирали у середины кока, рад
const SPIRAL_SWEEP = Math.PI * 2; // сколько она заметает на взлётном режиме

/**
 * @param {number} keff приведённый режим 0..1 (0 - малый газ и ниже)
 * @returns {{ghosts: number, spread: number, opacity: number}}
 */
export function spiralBlur(keff) {
  const k = Math.max(0, Math.min(1, keff));
  const spread = SPIRAL_SWEEP * Math.pow(k, 1.4);
  // пока заметённый угол меньше самой спирали, смазывать нечего
  if (spread <= SPIRAL_WIDTH) return { ghosts: 1, spread: 0, opacity: 1 };
  // Шаг между копиями держим меньше толщины спирали, иначе смаз полосит.
  // Копий на одну больше числа промежутков - их и раскладываем по сектору.
  const ghosts = Math.min(SPIRAL_GHOSTS, Math.ceil((1.5 * spread) / SPIRAL_WIDTH) + 1);
  return { ghosts, spread, opacity: 1 / ghosts };
}

/* ----------------------------- материалы ---------------------------- */

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
  // спираль на коке: прозрачность нужна для смаза на больших оборотах
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

/* --------------------------- утилиты формы -------------------------- */

// Тело вращения. points: [[radius, x], ...]. Ось вращения - X.
function lathe(points, material, segments = 96) {
  const v = points.map((p) => new THREE.Vector2(p[0], p[1]));
  const g = new THREE.LatheGeometry(v, segments);
  const m = new THREE.Mesh(g, material);
  m.rotation.z = -Math.PI / 2;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ------------------- плоский низ мотогондолы ------------------------ *
 *  У 737 гондола не круглая: низ и губа воздухозаборника сплющены -
 *  «hamster pouch». Причина не стилистическая. Крыло 737 низко над
 *  землёй, и чтобы посадить на него CFM56, вентилятор обрезали в
 *  диаметре, а коробку приводов с агрегатами перенесли из-под двигателя
 *  на бок (с 6 часов на 9). Освободившийся низ и сплющили.
 *
 *  Тела вращения здесь строит lathe(), поэтому форму даём деформацией
 *  вершин: низ сечения подрезаем до заданного уровня плавным минимумом,
 *  чтобы вместо острого угла получился скруглённый переход в борта.
 * -------------------------------------------------------------------- */

// на сколько условных единиц срезан низ гондолы
const BELLY = 0.2;

// Снаружи гондола плоская от губы через капоты вентилятора и круглеет к соплу.
const outerBelly = (x) => BELLY * (1 - THREE.MathUtils.smoothstep(x, -1.6, 1.0));

// А внутри воздухозаборник обязан прийти к кругу уже к плоскости вентилятора:
// зазор до концов лопаток здесь меньше десятой доли единицы, и сплющенный
// тракт просто срезал бы их.
const innerBelly = (x) => BELLY * (1 - THREE.MathUtils.smoothstep(x, -4.95, -4.1));

// Угол, на который коробка приводов с агрегатами уведена от низа двигателя
// на бок. Он же задаёт направление разнесения узла и место подписи.
const AGB_TILT = THREE.MathUtils.degToRad(62);
const AGB_AXIS = new THREE.Vector3(1, 0, 0);
const AGB_EXPLODE = new THREE.Vector3(0, -3.4, 0).applyAxisAngle(AGB_AXIS, AGB_TILT);

// плавный минимум: скругляет стык плоского низа с бортами
function smoothMin(a, b, k) {
  const h = THREE.MathUtils.clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b * (1 - h) + a * h - k * h * (1 - h);
}

/* computeVertexNormals() оставляет шов там, где lathe дублирует вершины на
   стыке 0 и 2π: у копий разные соседние треугольники, а значит и разные
   нормали. Усредняем нормали совпадающих вершин - шов пропадает. Рёбра
   профиля при этом остаются острыми: у них координаты различаются. */
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
 * Сплющивает низ тела вращения, построенного lathe().
 * @param {THREE.Mesh} mesh
 * @param {(x: number) => number} depth сколько срезать снизу на станции x
 */
function flattenBelly(mesh, depth) {
  const geo = mesh.geometry;
  geo.rotateZ(-Math.PI / 2); // из осей LatheGeometry в оси двигателя
  mesh.rotation.z = 0;

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y >= 0) continue; // сплющивается только низ
    const d = depth(pos.getX(i));
    if (d <= 1e-4) continue;
    // радиус на кольце постоянный, поэтому уровень среза общий для всего кольца
    const r = Math.hypot(y, pos.getZ(i));
    if (r < 1e-4) continue;
    // Скругление стыка держим тугим: с мягким переходом сплющивание
    // расползается по бортам и вход читается овалом, а не кругом со
    // срезанным низом.
    pos.setY(i, -smoothMin(-y, Math.max(r * 0.4, r - d), r * 0.09));
  }
  pos.needsUpdate = true;
  weldNormals(geo);
  geo.computeBoundingSphere();
  return mesh;
}

// Кольцевой диск/барабан ротора
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

/* ------------------------- сборка двигателя ------------------------- */

export function buildEngine() {
  const root = new THREE.Group();
  const modules = [];
  const n1Rotors = [];
  const n2Rotors = [];

  function module(name, title, info, explode) {
    const g = new THREE.Group();
    g.name = name;
    g.userData = { title, info, explode: explode || new THREE.Vector3(), base: new THREE.Vector3() };
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

  /* ===================== 1. Мотогондола / воздухозаборник ============ */
  const mNac = module(
    'nacelle',
    'Мотогондола и воздухозаборник',
    'Обечайка воздухозаборника с противообледенительной системой, капоты вентилятора и наружный контур. Формирует равномерный поток на входе в вентилятор и сопло наружного контура.',
    new THREE.Vector3(0, 3.4, 0)
  );

  // Профиль капота разбит на две половины: наружная обшивка идёт назад,
  // внутренняя возвращается вперёд. Вместе они дают ту же замкнутую
  // оболочку, что и раньше, но сплющиваются по-разному - снаружи гондола
  // плоская почти по всей длине, внутри только у губы (см. flattenBelly).
  const nacOuter = [
    [1.62, ST.lip],
    [1.86, -4.85],
    [1.97, -4.3],
    [2.0, -3.4],
    [1.99, -1.6],
    [1.94, 0.2],
    [1.82, 1.0],
    [1.6, ST.bypassExit],
    [1.52, ST.bypassExit],
  ];
  const nacInner = [
    [1.52, ST.bypassExit],
    [1.66, 1.0],
    [1.74, 0.2],
    [1.76, -1.6],
    [1.74, -3.2],
    [1.68, ST.fan],
    [1.62, ST.fan],
    [1.62, -4.25],
    [1.55, -4.72],
    [1.53, -5.0],
    [1.62, ST.lip],
  ];
  mNac.add(flattenBelly(lathe(nacOuter, MATS.nacelle, 120), outerBelly));
  mNac.add(flattenBelly(lathe(nacInner, MATS.nacelle, 120), innerBelly));
  // блестящая кромка воздухозаборника: целиком в зоне полного сплющивания,
  // поэтому и снаружи, и изнутри режется одинаково
  mNac.add(
    flattenBelly(
      lathe(
        [
          [1.62, ST.lip], // нос кромки
          [1.8, -5.06],
          [1.9, -4.75],
          [1.945, -4.45], // наружная часть уходит далеко назад, вровень с капотом
          [1.6, -4.45], // задний торец кольца, спрятан внутри обшивки
          [1.53, -4.72], // внутренняя часть идёт обратно к носу, чуть утоплена
          [1.5, -4.95], // в тракт: горло, самое узкое место, чуть позади носа
          [1.62, ST.lip],
        ],
        MATS.nacelleLip,
        120
      ),
      outerBelly
    )
  );

  // пилон крепления к крылу
  const pylonShape = new THREE.Shape();
  pylonShape.moveTo(-2.9, 0);
  pylonShape.lineTo(1.7, 0);
  pylonShape.lineTo(1.9, 0.9);
  pylonShape.lineTo(-1.9, 0.9);
  pylonShape.quadraticCurveTo(-2.7, 0.55, -2.9, 0);
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
  pylon.position.set(0, 1.84, -0.15);
  mNac.add(pylon);

  /* ===================== 2. Вентилятор =============================== */
  const mFan = module(
    'fan',
    'Вентилятор (N1)',
    '24 широкохордные лопатки из композита с титановой кромкой. Диаметр ~1.55 м, 5175 об/мин на взлётном режиме. Создаёт до 80 % тяги, прогоняя воздух в наружный контур. Степень двухконтурности ≈ 9:1.',
    new THREE.Vector3(-2.6, 0, 0)
  );

  // корпус вентилятора (с кевларовым бронекольцом)
  mFan.add(
    lathe(
      [
        [1.62, -4.2],
        [1.7, -4.2],
        [1.72, -3.75],
        [1.7, -3.3],
        [1.64, -3.3],
        [1.62, -3.75],
        [1.62, -4.2],
      ],
      MATS.fanCase,
      96
    )
  );

  const fanRot = rotor(mFan, 1);

  // кок (обтекатель втулки)
  const spinnerPts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const x = THREE.MathUtils.lerp(-4.78, ST.fan, t);
    const r = 0.54 * Math.pow(t, 0.72);
    spinnerPts.push([r, x]);
  }
  spinnerPts.push([0.54, ST.fan + 0.12]);
  fanRot.add(lathe(spinnerPts, MATS.paint, 64));

  // спираль на коке (см. spiralBlur: на оборотах размазывается в кольцо)
  const spiralCurve = new THREE.CatmullRomCurve3(
    Array.from({ length: 60 }, (_, i) => {
      const t = i / 59;
      const x = THREE.MathUtils.lerp(-4.76, ST.fan - 0.04, t);
      const r = 0.545 * Math.pow(t, 0.72) + 0.004;
      const a = t * Math.PI * 2.4;
      return new THREE.Vector3(x, r * Math.cos(a), r * Math.sin(a));
    })
  );
  // тесселяция скромнее исходной: трубка тонкая, а копий её теперь десятки
  const spiral = new THREE.InstancedMesh(
    new THREE.TubeGeometry(spiralCurve, 88, 0.022, 6),
    MATS.spiral,
    SPIRAL_GHOSTS
  );
  spiral.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  spiral.count = 1;
  fanRot.add(spiral);

  // диск и замки лопаток
  fanRot.add(drum(ST.fan - 0.12, ST.fan + 0.3, 0.54, 0.56, MATS.disk));
  const fanBlade = makeBladeGeometry({
    hubRadius: 0.55,
    tipRadius: ST.fanTip,
    rootChord: 0.66,
    tipChord: 0.78,
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

  // спрямляющий аппарат наружного контура (OGV)
  const ogv = makeBladeGeometry({
    hubRadius: 1.06,
    tipRadius: 1.66,
    rootChord: 0.36,
    tipChord: 0.34,
    rootStagger: 34,
    tipStagger: 26,
    rootThickness: 0.12,
    tipThickness: 0.1,
    rootCamber: 0.09,
    tipCamber: 0.07,
    radialSegments: 8,
    chordSegments: 14,
    x: -3.2,
  });
  mFan.add(bladeRow(ogv, MATS.titanium, 44));

  /* ===================== 3. Подпорные ступени (КНД) ================== */
  const mBoost = module(
    'booster',
    'Подпорные ступени, КНД (N1)',
    'Компрессор низкого давления: 3 ступени на валу вентилятора. Поджимает воздух внутреннего контура до ~2.5 бар перед КВД.',
    new THREE.Vector3(-1.7, 0, 0)
  );

  // разделитель контуров + корпус КНД
  mBoost.add(
    lathe(
      [
        [0.96, ST.splitter],
        [1.02, ST.splitter + 0.18],
        [1.04, -2.9],
        [0.98, -2.45],
        [0.9, -2.32],
        [0.86, -2.32],
        [0.93, -2.5],
        [0.97, -2.95],
        [0.95, ST.splitter + 0.2],
        [0.9, ST.splitter + 0.05],
        [0.96, ST.splitter],
      ],
      MATS.casing,
      96
    )
  );

  const boostRot = rotor(mBoost, 1);
  boostRot.add(drum(-3.5, -2.45, 0.56, 0.62, MATS.disk));
  const boostStages = [
    { x: -3.32, hub: 0.58, tip: 0.94, n: 34 },
    { x: -3.02, hub: 0.6, tip: 0.92, n: 40 },
    { x: -2.72, hub: 0.62, tip: 0.9, n: 46 },
  ];
  boostStages.forEach((s, i) => {
    const g = makeBladeGeometry({
      hubRadius: s.hub,
      tipRadius: s.tip,
      rootChord: 0.2,
      tipChord: 0.17,
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
  // направляющие аппараты КНД
  boostStages.forEach((s, i) => {
    const g = makeBladeGeometry({
      hubRadius: s.hub + 0.02,
      tipRadius: s.tip,
      rootChord: 0.17,
      tipChord: 0.15,
      rootStagger: 30,
      tipStagger: 22,
      rootThickness: 0.11,
      tipThickness: 0.09,
      rootCamber: 0.1,
      tipCamber: 0.08,
      radialSegments: 5,
      chordSegments: 10,
      x: s.x + 0.15,
    });
    mBoost.add(bladeRow(g, MATS.steel, s.n + 8, 0.05));
  });

  /* ===================== 4. КВД ====================================== */
  const mHpc = module(
    'hpc',
    'Компрессор высокого давления (N2)',
    '10 ступеней. Сжимает воздух в ~22 раза (суммарно до 40-50 бар), нагревая его до 550-650 °C. Часть воздуха отбирается на охлаждение турбины и кондиционирование.',
    new THREE.Vector3(-0.8, 0, 0)
  );

  const hpcStages = 10;
  const hpcX = (i) => THREE.MathUtils.lerp(ST.hpcIn, ST.hpcOut, i / (hpcStages - 1));
  const hpcTip = (i) => THREE.MathUtils.lerp(0.78, 0.55, i / (hpcStages - 1));
  const hpcHub = (i) => THREE.MathUtils.lerp(0.5, 0.44, i / (hpcStages - 1));

  // корпус КВД
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
  // переходник от КНД
  mHpc.add(
    lathe(
      [
        [0.9, -2.42],
        [0.86, -2.42],
        [0.8, ST.hpcIn - 0.12],
        [0.84, ST.hpcIn - 0.12],
        [0.9, -2.42],
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
      rootChord: THREE.MathUtils.lerp(0.16, 0.09, i / 9),
      tipChord: THREE.MathUtils.lerp(0.14, 0.08, i / 9),
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

    // направляющий аппарат ступени
    const sg = makeBladeGeometry({
      hubRadius: hpcHub(i) + 0.01,
      tipRadius: hpcTip(i) + 0.01,
      rootChord: THREE.MathUtils.lerp(0.14, 0.08, i / 9),
      tipChord: THREE.MathUtils.lerp(0.13, 0.075, i / 9),
      rootStagger: 30,
      tipStagger: 20,
      rootThickness: 0.11,
      tipThickness: 0.08,
      rootCamber: 0.1,
      tipCamber: 0.07,
      radialSegments: 5,
      chordSegments: 10,
      x: hpcX(i) + 0.09,
    });
    mHpc.add(bladeRow(sg, MATS.steel, n + 10, 0.04));
  }

  /* ===================== 5. Камера сгорания ========================== */
  const mComb = module(
    'combustor',
    'Камера сгорания',
    'Кольцевая камера с 20 форсунками. Топливо сгорает при 1800-2000 °C; воздух из КВД охлаждает жаровую трубу плёночным охлаждением. Только ~25 % воздуха участвует в горении, остальное - охлаждение и разбавление.',
    new THREE.Vector3(0, 0, 0)
  );

  // диффузор
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

  // жаровая труба (наружная и внутренняя стенки)
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
  // купол камеры
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

  // форсунки и завихрители
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
      // подвод топлива наружу
      return g;
    },
    mComb
  );

  // пламя (аддитивный шейдер)
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
        // vP - в локальной системе lathe: ось Y = ось двигателя
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

  /* ===================== 6. Турбина высокого давления ================ */
  const mHpt = module(
    'hpt',
    'Турбина высокого давления (N2)',
    '2 ступени. Монокристаллические лопатки с внутренним воздушным охлаждением и керамическим покрытием работают в газе 1500 °C - выше температуры плавления сплава. Вращает КВД со скоростью ~12 000 об/мин.',
    new THREE.Vector3(0.9, 0, 0)
  );
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
  const hptStages = [
    { x: 0.78, hub: 0.46, tip: 0.83, n: 62, ngv: 0.62 },
    { x: 1.08, hub: 0.45, tip: 0.88, n: 74, ngv: 0.93 },
  ];
  hptStages.forEach((s, i) => {
    // сопловой аппарат
    const ngv = makeBladeGeometry({
      hubRadius: s.hub,
      tipRadius: s.tip + 0.02,
      rootChord: 0.24,
      tipChord: 0.22,
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
      rootChord: 0.2,
      tipChord: 0.18,
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
    hptRot.add(drum(s.x - 0.09, s.x + 0.09, s.hub, s.hub, MATS.diskHot));
  });
  hptRot.add(drum(0.7, 1.16, 0.44, 0.44, MATS.diskHot));

  /* ===================== 7. Турбина низкого давления ================= */
  const mLpt = module(
    'lpt',
    'Турбина низкого давления (N1)',
    '5 ступеней большого диаметра. Срабатывает оставшуюся энергию газа и через длинный вал приводит вентилятор и КНД (~3000 об/мин).',
    new THREE.Vector3(1.9, 0, 0)
  );

  const lptCase = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    lptCase.push([THREE.MathUtils.lerp(0.99, 1.16, t), THREE.MathUtils.lerp(ST.lptIn - 0.16, ST.lptOut + 0.14, t)]);
  }
  for (let i = 8; i >= 0; i--) {
    const t = i / 8;
    lptCase.push([THREE.MathUtils.lerp(0.95, 1.12, t), THREE.MathUtils.lerp(ST.lptIn - 0.16, ST.lptOut + 0.14, t)]);
  }
  lptCase.push([0.99, ST.lptIn - 0.16]);
  mLpt.add(lathe(lptCase, MATS.casingHot, 96));
  // переходный канал от ТВД
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
  const lptN = 5;
  for (let i = 0; i < lptN; i++) {
    const t = i / (lptN - 1);
    const x = THREE.MathUtils.lerp(ST.lptIn, ST.lptOut, t);
    const hub = THREE.MathUtils.lerp(0.5, 0.6, t);
    const tip = THREE.MathUtils.lerp(0.93, 1.1, t);

    const ngv = makeBladeGeometry({
      hubRadius: hub,
      tipRadius: tip + 0.02,
      rootChord: 0.2,
      tipChord: 0.18,
      rootStagger: 48,
      tipStagger: 40,
      rootThickness: 0.2,
      tipThickness: 0.15,
      rootCamber: 0.15,
      tipCamber: 0.12,
      radialSegments: 6,
      chordSegments: 12,
      x: x - 0.14,
    });
    mLpt.add(bladeRow(ngv, MATS.nickel, 68 + i * 4, 0.02));

    const g = makeBladeGeometry({
      hubRadius: hub,
      tipRadius: tip,
      rootChord: 0.17,
      tipChord: 0.15,
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
    lptRot.add(drum(x - 0.08, x + 0.08, hub, hub, MATS.diskHot));
  }
  lptRot.add(drum(ST.lptIn - 0.1, ST.lptOut + 0.1, 0.46, 0.5, MATS.diskHot));

  /* ===================== 8. Задняя опора и сопло ===================== */
  const mExh = module(
    'exhaust',
    'Задняя опора и сопло внутреннего контура',
    'Силовые стойки задней опоры несут подшипник вала НД и спрямляют закрутку газа. Центральное тело (кок) формирует сопло; скорость струи на выходе 400-500 м/с при 550-600 °C.',
    new THREE.Vector3(2.9, 0, 0)
  );
  const strut = makeBladeGeometry({
    hubRadius: 0.56,
    tipRadius: 1.12,
    rootChord: 0.42,
    tipChord: 0.4,
    rootStagger: 6,
    tipStagger: 2,
    rootThickness: 0.2,
    tipThickness: 0.16,
    rootCamber: 0.02,
    tipCamber: 0.01,
    radialSegments: 5,
    chordSegments: 12,
    x: ST.frame,
  });
  mExh.add(bladeRow(strut, MATS.nickel, 10));
  mExh.add(
    lathe(
      [
        [1.16, ST.lptOut + 0.12],
        [1.12, ST.lptOut + 0.12],
        [0.86, ST.coreExit],
        [0.9, ST.coreExit],
        [1.16, ST.lptOut + 0.12],
      ],
      MATS.casingHot,
      96
    )
  );
  // центральное тело
  const plugPts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    plugPts.push([0.56 * Math.pow(1 - t, 0.75), THREE.MathUtils.lerp(ST.frame + 0.1, ST.plugTip, t)]);
  }
  const plug = lathe([[0.56, ST.frame - 0.1], ...plugPts], MATS.nickel, 72);
  mExh.add(plug);

  /* ===================== 9. Внутренний капот (core cowl) ============= */
  const mCowl = module(
    'cowl',
    'Внутренний обвод наружного контура',
    'Стенка, разделяющая холодный наружный и горячий внутренний контуры. Внутри - агрегаты, трубопроводы и теплоизоляция.',
    new THREE.Vector3(0, -3.4, 0)
  );
  const cowlPts = [
    [0.95, ST.splitter],
    [1.05, -3.2],
    [1.08, -2.0],
    [1.07, 0.2],
    [1.02, 1.1],
    [0.95, ST.bypassExit],
    [0.92, 2.4],
    [0.86, 3.2],
    [0.78, ST.coreExit],
    [0.74, ST.coreExit],
    [0.82, 3.2],
    [0.88, 2.4],
    [0.9, ST.bypassExit],
    [0.98, 1.1],
    [1.03, 0.2],
    [1.04, -2.0],
    [1.01, -3.2],
    [0.92, ST.splitter],
    [0.95, ST.splitter],
  ];
  mCowl.add(lathe(cowlPts, MATS.coreCowl, 96));

  /* ===================== 10. Валы и агрегаты ========================= */
  const mShaft = module(
    'shafts',
    'Валы роторов',
    'Два соосных вала: вал НД (вентилятор + КНД + ТНД) проходит внутри полого вала ВД (КВД + ТВД). Роторы вращаются независимо с разной скоростью.',
    new THREE.Vector3(0, 0, 0)
  );
  const lpShaftRot = rotor(mShaft, 1);
  const lp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 7.0, 24), MATS.shaft);
  lp.rotation.z = -Math.PI / 2;
  lp.position.x = -0.6;
  lpShaftRot.add(lp);
  // шлицы/фланцы вала НД
  [-3.9, 2.7].forEach((x) => {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 24), MATS.shaft);
    f.rotation.z = -Math.PI / 2;
    f.position.x = x;
    lpShaftRot.add(f);
  });

  const hpShaftRot = rotor(mShaft, 2);
  hpShaftRot.add(tube(-2.45, 1.2, 0.24, 0.3, MATS.shaft, 32));

  // подшипниковые опоры
  [
    [-3.7, 0.34],
    [-2.5, 0.36],
    [1.3, 0.36],
    [2.85, 0.3],
  ].forEach(([x, r]) => {
    const b = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 8, 32), MATS.steel);
    b.rotation.y = Math.PI / 2;
    b.position.x = x;
    mShaft.add(b);
  });

  const mAcc = module(
    'accessory',
    'Коробка приводов и агрегаты',
    'Через угловую передачу от вала ВД приводятся топливный и масляный насосы, генераторы и стартер. Здесь же трубопроводы отбора воздуха и агрегаты FADEC. На 737 коробка вынесена с низа двигателя на бок - это и позволило сплющить низ мотогондолы.',
    AGB_EXPLODE
  );
  // Всё навесное собрано так, будто висит снизу, и целиком повёрнуто на бок:
  // так низ двигателя остаётся свободным под плоскую гондолу.
  const accSide = new THREE.Group();
  accSide.rotation.x = AGB_TILT;
  mAcc.add(accSide);

  const gearbox = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.42, 0.9), MATS.accessory);
  gearbox.position.set(-1.3, -1.12, 0);
  gearbox.rotation.z = 0.06;
  accSide.add(gearbox);
  [[-1.95, 0.26], [-1.35, 0.3], [-0.75, 0.24]].forEach(([x, r], i) => {
    const acc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.5, 16), MATS.accessory);
    acc.rotation.x = Math.PI / 2;
    acc.position.set(x, -1.32 - i * 0.02, 0.5);
    accSide.add(acc);
  });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.95, 12), MATS.steel);
  tower.position.set(-1.55, -0.62, 0);
  tower.rotation.z = 0.28;
  accSide.add(tower);
  // магистрали
  [0.35, -0.35].forEach((z) => {
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.2, -0.95, z * 0.6),
      new THREE.Vector3(-1.0, -1.25, z),
      new THREE.Vector3(0.6, -1.1, z * 0.9),
      new THREE.Vector3(1.6, -0.85, z * 0.5),
    ]);
    accSide.add(new THREE.Mesh(new THREE.TubeGeometry(c, 40, 0.045, 8), MATS.steel));
  });

  /* ===================== метки узлов ================================= */
  const labels = [
    { module: mNac, text: 'Мотогондола', pos: new THREE.Vector3(-4.6, 2.05, 0) },
    { module: mFan, text: 'Вентилятор', pos: new THREE.Vector3(ST.fan, 1.62, 0) },
    { module: mBoost, text: 'КНД', pos: new THREE.Vector3(-3.0, 1.0, 0) },
    { module: mHpc, text: 'КВД', pos: new THREE.Vector3(-1.4, 0.85, 0) },
    { module: mComb, text: 'Камера сгорания', pos: new THREE.Vector3(0.14, 0.95, 0) },
    { module: mHpt, text: 'ТВД', pos: new THREE.Vector3(0.95, 1.0, 0) },
    { module: mLpt, text: 'ТНД', pos: new THREE.Vector3(2.1, 1.2, 0) },
    { module: mExh, text: 'Сопло', pos: new THREE.Vector3(3.6, 0.8, 0) },
    { module: mShaft, text: 'Валы НД / ВД', pos: new THREE.Vector3(-0.2, -0.42, 0) },
    {
      module: mAcc,
      text: 'Коробка приводов',
      // подпись едет на бок вместе с самой коробкой
      pos: new THREE.Vector3(-1.3, -1.45, 0).applyAxisAngle(AGB_AXIS, AGB_TILT),
    },
  ];

  modules.forEach((m) => m.userData.base.copy(m.position));

  /* ------- невидимые прокси-объёмы для быстрого выбора узлов --------- *
   * Raycast по реальной геометрии (сотни тысяч треугольников) на каждое
   * движение мыши слишком дорог, поэтому пикаем упрощённые оболочки.    */
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });
  const pickables = [];
  const PROXY = [
    [mNac, ST.lip, ST.bypassExit, 1.92, true],
    [mFan, -4.85, -3.3, 1.5, false],
    [mBoost, ST.splitter, -2.5, 0.95, false],
    [mHpc, -2.45, -0.5, 0.8, false],
    [mComb, -0.5, 0.6, 0.88, false],
    [mHpt, 0.6, 1.22, 0.95, false],
    [mLpt, 1.28, 2.92, 1.12, false],
    [mExh, 2.92, ST.plugTip, 0.9, false],
    [mCowl, -3.5, ST.coreExit, 1.04, true],
    [mShaft, -4.0, 2.8, 0.33, false],
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
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 1.4), pickMat);
    box.position.set(-1.3, -1.16, 0);
    accSide.add(box); // прокси уезжает на бок вместе с агрегатами
    pickables.push(box);
  }

  /* --------------------- смаз спирали на коке ---------------------- */
  const _spiralM = new THREE.Matrix4();
  let shownGhosts = -1;
  let shownSpread = -1;

  /** @param {number} keff приведённый режим 0..1 */
  function setSpiralBlur(keff) {
    const { ghosts, spread, opacity } = spiralBlur(keff);
    MATS.spiral.opacity = opacity;
    // пока спираль непрозрачна, пусть пишет глубину и не просвечивает сама себя
    MATS.spiral.depthWrite = opacity > 0.95;
    if (ghosts === shownGhosts && Math.abs(spread - shownSpread) < 0.004) return;
    shownGhosts = ghosts;
    shownSpread = spread;
    spiral.count = ghosts;
    for (let i = 0; i < ghosts; i++) {
      // копии тянутся назад по вращению - это шлейф, а не опережение
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
