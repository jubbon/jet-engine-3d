import * as THREE from 'three';
import { makeBladeGeometry, bladeRow } from './blade.js';

/* ------------------------------------------------------------------ *
 *  Геометрическая схема ТРДД (турбовентиляторного двигателя большой
 *  степени двухконтурности). Прототип - CFM56-7B в мотогондоле Boeing
 *  737NG; все габариты взяты из docs/engines/cfm56-7b-nacelle.json.
 *  Ось двигателя - X, поток идёт в направлении +X.
 *
 *  1 условная единица = 0.50 м. Из-за этого множителя РАДИУС в условных
 *  единицах численно равен ДИАМЕТРУ в метрах: fanTip = 1.549 у.е. - это
 *  вентилятор Ø 1.549 м, nacelleR = 2.44 у.е. - гондола Ø 2.44 м.
 *
 *  Продольные станции отсчитываются от кромки воздухозаборника: она
 *  стоит в x = -5.2 у.е., так что станция в метрах от кромки равна
 *  (x + 5.2) / 2. Опорные значения справочника - срез сопла наружного
 *  контура 3.18 м, срез сопла внутреннего контура 4.05 м, конец
 *  центрального тела 5.00 м, длина «голого» двигателя 2.508 м.
 *
 *  Продольное положение двигателя внутри гондолы габаритами НЕ задано:
 *  сумма «вход + двигатель + сопло» сойдётся при любом делении. Поэтому
 *  оно привязано к отдельному показателю - отношению длины входа (от
 *  кромки до передней кромки конца лопатки) к диаметру вентилятора. У
 *  классической гондолы оно около 0.5, здесь 0.498; на воздухозаборник
 *  уходит 0.83 м, на выходное сопло за задним фланцем - 0.71 м.
 *  Ошибка тут не ловится габаритами, только глазом или тестом: занизишь
 *  сопло - вентилятор провалится вглубь входного канала, а все размеры
 *  справочника при этом останутся верными. Проверяет geometry.test.mjs.
 * ------------------------------------------------------------------ */

export const ST = {
  lip: -5.2, // передняя кромка (highlight) воздухозаборника, 0 м
  throat: -4.94, // горло воздухозаборника, 0.13 м
  a1: -3.54, // фланец A1: стык воздухозаборника с корпусом вентилятора, 1.04 м
  fan: -3.22, // плоскость вентилятора, 1.20 м
  splitter: -2.86, // разделитель контуров, 1.38 м
  boosterIn: -2.74, // 3 подпорные ступени
  boosterOut: -2.38,
  hpcIn: -2.18, // 9 ступеней КВД
  hpcOut: -1.04,
  combIn: -0.84,
  combOut: -0.28,
  hptIn: -0.18, // 1 ступень ТВД
  hptOut: 0.12,
  lptIn: 0.36, // 4 ступени ТНД
  lptOut: 1.11,
  frame: 1.48, // задняя опора, она же задний фланец двигателя, 3.55 м
  bypassExit: 1.16, // срез сопла наружного контура, 3.18 м
  coreExit: 2.9, // срез сопла внутреннего контура, 4.05 м
  plugTip: 4.8, // конец центрального тела, 5.00 м
  fanTip: 1.549, // вентилятор Ø 1.549 м (61 in)
  caseR: 1.829, // корпус вентилятора снаружи: высота двигателя 1.829 м
  accR: 2.118, // агрегаты на боку: ширина двигателя 2.118 м
  nacelleR: 2.44, // наибольший габарит гондолы Ø 2.44 м (APPROX 8 FT)
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

/* Глубина среза взята из справочника через ширину плоского участка: при
   наружном радиусе 2.44 у.е. хорда шириной 1.2 м (2.4 у.е., «hamster pouch»
   на виде спереди) отсекается на глубине 0.16 м. Высота гондолы получается
   2.44 - 0.16 = 2.28 м - в пределах допуска обмеренных 2.40 ± 0.2 м, а
   недостающее до 2.40 добирает обтекатель пилона сверху, который на виде
   спереди и мешал обмерить верх гондолы. */
const BELLY = 0.32; // 0.16 м

// Снаружи гондола плоская от губы через капоты вентилятора и круглеет к соплу.
const outerBelly = (x) => BELLY * (1 - THREE.MathUtils.smoothstep(x, -0.8, 1.16));

// А внутри воздухозаборник обязан прийти к кругу уже к плоскости вентилятора:
// зазор до концов лопаток здесь меньше десятой доли единицы, и сплющенный
// тракт просто срезал бы их.
const innerBelly = (x) => BELLY * (1 - THREE.MathUtils.smoothstep(x, -4.94, -3.6));

// Угол, на который коробка приводов с агрегатами уведена от низа двигателя
// на бок. Он же задаёт направление разнесения узла и место подписи.
const AGB_TILT = THREE.MathUtils.degToRad(62);
const AGB_AXIS = new THREE.Vector3(1, 0, 0);
const AGB_EXPLODE = new THREE.Vector3(0, -4.4, 0).applyAxisAngle(AGB_AXIS, AGB_TILT);

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
    'Обечайка воздухозаборника с противообледенительной системой, капоты вентилятора и наружный контур. Наибольший габарит 2.44 м, длина до среза сопла наружного контура 3.18 м. Низ и губа уплощены («hamster pouch»): крыло 737 низко над землёй.',
    new THREE.Vector3(0, 4.4, 0)
  );

  // Профиль капота разбит на две половины: наружная обшивка идёт назад,
  // внутренняя возвращается вперёд. Вместе они дают ту же замкнутую
  // оболочку, что и раньше, но сплющиваются по-разному - снаружи гондола
  // плоская почти по всей длине, внутри только у губы (см. flattenBelly).
  // Наружная обшивка: губа Ø 1.70 м, максимум Ø 2.44 м у стыка воздухозаборника
  // с капотами вентилятора, дальше плавный поджим к соплу наружного контура.
  const nacOuter = [
    [1.7, ST.lip],
    [1.86, -5.1],
    [2.02, -4.8],
    [2.2, -4.4],
    [2.36, -3.9],
    [ST.nacelleR, ST.a1],
    [ST.nacelleR, -1.6],
    [2.36, -0.8],
    [2.2, 0.0],
    [1.98, 0.6],
    [1.78, 1.0],
    [1.7, ST.bypassExit],
    [1.62, ST.bypassExit],
  ];
  // Внутренний тракт: горло Ø 1.52 м, диффузор до Ø 1.58 м над концами лопаток
  // (зазор 15 мм) и наружный контур до среза сопла.
  const nacInner = [
    [1.62, ST.bypassExit],
    [1.64, 1.0],
    [1.68, 0.3],
    [1.7, -0.6],
    [1.68, -1.6],
    [1.64, -2.82],
    [1.58, ST.fan],
    [1.58, ST.a1],
    [1.55, -4.1],
    [1.53, -4.62],
    [1.52, ST.throat],
    [1.7, ST.lip],
  ];
  mNac.add(flattenBelly(lathe(nacOuter, MATS.nacelle, 120), outerBelly));
  mNac.add(flattenBelly(lathe(nacInner, MATS.nacelle, 120), innerBelly));
  // блестящая кромка воздухозаборника: целиком в зоне полного сплющивания,
  // поэтому и снаружи, и изнутри режется одинаково
  mNac.add(
    flattenBelly(
      lathe(
        [
          [1.7, ST.lip], // нос кромки
          [1.86, -5.1],
          [1.98, -4.92],
          [2.02, -4.8], // наружная часть уходит назад, вровень с обшивкой
          [1.58, -4.8], // задний торец кольца, спрятан внутри обшивки
          [1.51, -4.86], // внутренняя часть идёт обратно к носу, чуть утоплена
          [1.5, ST.throat], // в тракт: горло, самое узкое место, чуть позади носа
          [1.7, ST.lip],
        ],
        MATS.nacelleLip,
        120
      ),
      outerBelly
    )
  );

  /* Пилон крепления к крылу. Двигатель установлен с наклоном 5° носом вверх
     относительно самолёта, поэтому клин пилона несимметричен: снизу он лежит
     на гондоле (ось двигателя), сверху уходит по хорде крыла. Вперёд эти две
     линии сходятся - спереди пилон тоньше. Наклон отдан пилону, а не всей
     модели: иначе пришлось бы разворачивать вместе с ним визуализацию
     потоков и экранное марево, которые живут в мировых осях. */
  const TILT = Math.tan(THREE.MathUtils.degToRad(5));
  const pylonTop = (x) => 0.72 + (x + 1.9) * TILT;
  const pylonShape = new THREE.Shape();
  pylonShape.moveTo(-2.9, 0);
  pylonShape.lineTo(1.7, 0);
  pylonShape.lineTo(1.9, pylonTop(1.9));
  pylonShape.lineTo(-1.9, pylonTop(-1.9));
  pylonShape.quadraticCurveTo(-2.7, 0.44, -2.9, 0);
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
  pylon.name = 'pylon';
  pylon.position.set(0, 2.28, -0.15);
  mNac.add(pylon);

  /* ===================== 2. Вентилятор =============================== */
  const mFan = module(
    'fan',
    'Вентилятор (N1)',
    '24 широкохордные лопатки, наибольшая хорда 0.279 м. Диаметр 1.549 м, 5175 об/мин на взлётном режиме. Создаёт до 80 % тяги, прогоняя воздух в наружный контур. Степень двухконтурности 5.1.',
    new THREE.Vector3(-2.6, 0, 0)
  );

  // Корпус вентилятора с бронекольцом. Наружный радиус - габаритная высота
  // «голого» двигателя 1.829 м; на этот корпус спереди по фланцу A1 садится
  // воздухозаборник, а сбоку навешена коробка приводов.
  mFan.add(
    lathe(
      [
        [1.6, ST.a1],
        [ST.caseR, ST.a1],
        [ST.caseR, -3.11],
        [1.74, -2.92],
        [1.66, -2.92],
        [1.6, -3.11],
        [1.6, ST.a1],
      ],
      MATS.fanCase,
      96
    )
  );

  const fanRot = rotor(mFan, 1);

  // Кок (обтекатель втулки). Длина 0.50 м, наибольший радиус - втулка
  // вентилятора: относительный диаметр втулки 0.32 от диаметра вентилятора.
  // Нос кока оказывается в метре за кромкой воздухозаборника - на 737 он и
  // правда сидит глубоко в утопленном канале.
  const SPINNER_R = 0.5;
  const spinnerPts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const x = THREE.MathUtils.lerp(ST.fan - 1.0, ST.fan, t);
    const r = SPINNER_R * Math.pow(t, 0.72);
    spinnerPts.push([r, x]);
  }
  spinnerPts.push([SPINNER_R, ST.fan + 0.12]);
  fanRot.add(lathe(spinnerPts, MATS.paint, 64));

  // спираль на коке (см. spiralBlur: на оборотах размазывается в кольцо)
  const spiralCurve = new THREE.CatmullRomCurve3(
    Array.from({ length: 60 }, (_, i) => {
      const t = i / 59;
      const x = THREE.MathUtils.lerp(ST.fan - 0.98, ST.fan - 0.04, t);
      const r = (SPINNER_R + 0.005) * Math.pow(t, 0.72) + 0.004;
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
  fanRot.add(drum(ST.fan - 0.12, ST.fan + 0.3, SPINNER_R, SPINNER_R + 0.02, MATS.disk));
  // Наибольшая хорда - 0.279 м (11 in) у периферии, отсюда и «широкохордная».
  const fanBlade = makeBladeGeometry({
    hubRadius: SPINNER_R + 0.01,
    tipRadius: ST.fanTip,
    rootChord: 0.47,
    tipChord: 0.558,
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
    hubRadius: 1.03,
    tipRadius: 1.64,
    rootChord: 0.3,
    tipChord: 0.28,
    rootStagger: 34,
    tipStagger: 26,
    rootThickness: 0.12,
    tipThickness: 0.1,
    rootCamber: 0.09,
    tipCamber: 0.07,
    radialSegments: 8,
    chordSegments: 14,
    x: -2.78,
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
        [1.02, ST.splitter + 0.1],
        [1.04, -2.64],
        [0.98, -2.3],
        [0.9, -2.16],
        [0.86, -2.16],
        [0.93, -2.34],
        [0.97, -2.68],
        [0.95, ST.splitter + 0.12],
        [0.9, ST.splitter + 0.03],
        [0.96, ST.splitter],
      ],
      MATS.casing,
      96
    )
  );

  const boostRot = rotor(mBoost, 1);
  boostRot.add(drum(-2.86, -2.28, 0.56, 0.62, MATS.disk));
  const boostStages = [
    { x: ST.boosterIn, hub: 0.58, tip: 0.94, n: 34 },
    { x: -2.56, hub: 0.6, tip: 0.92, n: 40 },
    { x: ST.boosterOut, hub: 0.62, tip: 0.9, n: 46 },
  ];
  /* Хорды лопаток компрессоров и турбин заданы натурными: подпорная ступень
     ~50 мм, ступень КВД от 39 до 24 мм, лопатка ТВД ~55 мм, ТНД ~70 мм. Это
     не косметика - венец занимает по оси хорда × cos(угол установки), а шаг
     ступени тут 0.14…0.25 у.е. (70…125 мм), и лопатки прежних, «плакатных»
     хорд просто входили бы друг в друга. */
  boostStages.forEach((s, i) => {
    const g = makeBladeGeometry({
      hubRadius: s.hub,
      tipRadius: s.tip,
      rootChord: 0.1,
      tipChord: 0.092,
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
      rootChord: 0.085,
      tipChord: 0.08,
      rootStagger: 30,
      tipStagger: 22,
      rootThickness: 0.11,
      tipThickness: 0.09,
      rootCamber: 0.1,
      tipCamber: 0.08,
      radialSegments: 5,
      chordSegments: 10,
      x: s.x + 0.09,
    });
    mBoost.add(bladeRow(g, MATS.steel, s.n + 8, 0.05));
  });

  /* ===================== 4. КВД ====================================== */
  const mHpc = module(
    'hpc',
    'Компрессор высокого давления (N2)',
    '9 ступеней. Сжимает воздух примерно в 11 раз; вместе с вентилятором и КНД это даёт суммарную степень сжатия около 28 и нагрев до 550-600 °C. Часть воздуха отбирается на охлаждение турбины и кондиционирование.',
    new THREE.Vector3(-0.8, 0, 0)
  );

  const hpcStages = 9;
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
        [0.9, ST.boosterOut + 0.04],
        [0.86, ST.boosterOut + 0.04],
        [0.8, ST.hpcIn - 0.04],
        [0.84, ST.hpcIn - 0.04],
        [0.9, ST.boosterOut + 0.04],
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
      rootChord: THREE.MathUtils.lerp(0.078, 0.048, i / (hpcStages - 1)),
      tipChord: THREE.MathUtils.lerp(0.07, 0.044, i / (hpcStages - 1)),
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
      rootChord: THREE.MathUtils.lerp(0.068, 0.042, i / (hpcStages - 1)),
      tipChord: THREE.MathUtils.lerp(0.062, 0.04, i / (hpcStages - 1)),
      rootStagger: 30,
      tipStagger: 20,
      rootThickness: 0.11,
      tipThickness: 0.08,
      rootCamber: 0.1,
      tipCamber: 0.07,
      radialSegments: 5,
      chordSegments: 10,
      // направляющий аппарат ровно посередине между ступенями
      x: hpcX(i) + (ST.hpcOut - ST.hpcIn) / (hpcStages - 1) / 2,
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
    '1 ступень. Монокристаллические лопатки с внутренним воздушным охлаждением и керамическим покрытием работают в газе 1500 °C - выше температуры плавления сплава. Одной ступени хватает потому, что она срабатывает большой перепад при высокой окружной скорости: КВД она вращает со скоростью ~14 500 об/мин.',
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
  // Одна ступень: сопловой аппарат и рабочее колесо.
  const hptStages = [{ x: 0.02, hub: 0.46, tip: 0.86, n: 62, ngv: -0.12 }];
  hptStages.forEach((s, i) => {
    // сопловой аппарат
    const ngv = makeBladeGeometry({
      hubRadius: s.hub,
      tipRadius: s.tip + 0.02,
      rootChord: 0.14,
      tipChord: 0.13,
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
      rootChord: 0.12,
      tipChord: 0.11,
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
    hptRot.add(drum(s.x - 0.07, s.x + 0.07, s.hub, s.hub, MATS.diskHot));
  });
  hptRot.add(drum(ST.hptIn + 0.04, ST.hptOut - 0.02, 0.44, 0.44, MATS.diskHot));

  /* ===================== 7. Турбина низкого давления ================= */
  const mLpt = module(
    'lpt',
    'Турбина низкого давления (N1)',
    '4 ступени большого диаметра. Срабатывает оставшуюся энергию газа и через длинный вал приводит вентилятор и КНД (5175 об/мин на взлётном режиме).',
    new THREE.Vector3(1.9, 0, 0)
  );

  const lptCase = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    lptCase.push([THREE.MathUtils.lerp(0.99, 1.12, t), THREE.MathUtils.lerp(ST.lptIn - 0.16, ST.lptOut + 0.14, t)]);
  }
  for (let i = 8; i >= 0; i--) {
    const t = i / 8;
    lptCase.push([THREE.MathUtils.lerp(0.95, 1.08, t), THREE.MathUtils.lerp(ST.lptIn - 0.16, ST.lptOut + 0.14, t)]);
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
  const lptN = 4;
  for (let i = 0; i < lptN; i++) {
    const t = i / (lptN - 1);
    const x = THREE.MathUtils.lerp(ST.lptIn, ST.lptOut, t);
    const hub = THREE.MathUtils.lerp(0.5, 0.6, t);
    const tip = THREE.MathUtils.lerp(0.93, 1.1, t);

    const ngv = makeBladeGeometry({
      hubRadius: hub,
      tipRadius: tip + 0.02,
      rootChord: 0.13,
      tipChord: 0.12,
      rootStagger: 48,
      tipStagger: 40,
      rootThickness: 0.2,
      tipThickness: 0.15,
      rootCamber: 0.15,
      tipCamber: 0.12,
      radialSegments: 6,
      chordSegments: 12,
      x: x - 0.105,
    });
    mLpt.add(bladeRow(ngv, MATS.nickel, 68 + i * 4, 0.02));

    const g = makeBladeGeometry({
      hubRadius: hub,
      tipRadius: tip,
      rootChord: 0.14,
      tipChord: 0.13,
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
    lptRot.add(drum(x - 0.07, x + 0.07, hub, hub, MATS.diskHot));
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
    rootChord: 0.26,
    tipChord: 0.24,
    rootStagger: 6,
    tipStagger: 2,
    rootThickness: 0.2,
    tipThickness: 0.16,
    rootCamber: 0.02,
    tipCamber: 0.01,
    radialSegments: 5,
    chordSegments: 12,
    x: ST.frame + 0.04,
  });
  mExh.add(bladeRow(strut, MATS.nickel, 10));
  mExh.add(
    lathe(
      [
        [1.12, ST.lptOut + 0.12],
        [1.08, ST.lptOut + 0.12],
        [0.74, ST.coreExit],
        [0.78, ST.coreExit],
        [1.12, ST.lptOut + 0.12],
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
  // Наружная поверхность капота - внутренняя стенка наружного контура. Её
  // радиус вместе с обечайкой гондолы задаёт площадь сопла наружного контура:
  // при 1.62 и 1.14 у.е. на срезе это 1.04 м² - столько и нужно наружному
  // контуру при m = 5.1 и расходе порядка 355 кг/с на взлётном режиме.
  const cowlPts = [
    [0.95, ST.splitter],
    [1.05, -2.61],
    [1.1, -1.86],
    [1.14, -0.76],
    [1.16, -0.02],
    [1.18, 0.48],
    [1.22, 0.88],
    [1.22, 1.28],
    [1.14, 1.9],
    [0.92, 2.5],
    [0.82, ST.coreExit],
    [0.78, ST.coreExit],
    [0.88, 2.5],
    [1.1, 1.9],
    [1.18, 1.28],
    [1.18, 0.88],
    [1.14, 0.48],
    [1.12, -0.02],
    [1.1, -0.76],
    [1.06, -1.86],
    [1.01, -2.61],
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
  const lp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4.8, 24), MATS.shaft);
  lp.rotation.z = -Math.PI / 2;
  lp.position.x = -1.01;
  lpShaftRot.add(lp);
  // шлицы/фланцы вала НД
  [-3.16, 1.24].forEach((x) => {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 24), MATS.shaft);
    f.rotation.z = -Math.PI / 2;
    f.position.x = x;
    lpShaftRot.add(f);
  });

  const hpShaftRot = rotor(mShaft, 2);
  hpShaftRot.add(tube(-2.31, 0.1, 0.24, 0.3, MATS.shaft, 32));

  // подшипниковые опоры
  [
    [-3.11, 0.34],
    [-2.36, 0.36],
    [0.22, 0.36],
    [1.38, 0.3],
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

  // Коробка приводов сидит на корпусе вентилятора (радиус 1.829) и наружу
  // доходит до 2.118 - это и есть габаритная ширина «голого» двигателя
  // 2.118 м при высоте 1.829 м: разницу даёт как раз она. Дальше остаётся
  // 0.16 м до обшивки гондолы - потому гондола 737 и такая полная при
  // сравнительно небольшом вентиляторе.
  const gearbox = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 0.7), MATS.accessory);
  gearbox.position.set(-2.46, -1.92, 0);
  gearbox.rotation.z = 0.03;
  accSide.add(gearbox);
  // Агрегаты вынесены вбок от коробки, поэтому дальний угол у них дальше
  // от оси, чем плоскость: на габарит 2.118 выводится именно он.
  [[-2.96, 0.2], [-2.46, 0.22], [-1.96, 0.19]].forEach(([x, r], i) => {
    const acc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.44, 16), MATS.accessory);
    acc.rotation.x = Math.PI / 2;
    // ступенька i * 0.02 уводит агрегаты внутрь, чтобы габарит держал
    // первый из них, а не разъезжался по мелочи
    acc.position.set(x, -(Math.sqrt(ST.accR ** 2 - 0.74 ** 2) - r) + i * 0.02, 0.52);
    accSide.add(acc);
  });
  // вертикальная передача от вала ВД к коробке приводов
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.15, 12), MATS.steel);
  tower.position.set(-2.96, -1.3, 0);
  tower.rotation.z = 0.2;
  accSide.add(tower);
  // магистрали вдоль газогенератора
  [0.35, -0.35].forEach((z) => {
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.66, -1.15, z * 0.6),
      new THREE.Vector3(-1.96, -1.32, z),
      new THREE.Vector3(-0.86, -1.28, z * 0.9),
      new THREE.Vector3(-0.06, -1.15, z * 0.5),
    ]);
    accSide.add(new THREE.Mesh(new THREE.TubeGeometry(c, 40, 0.045, 8), MATS.steel));
  });

  /* ===================== метки узлов ================================= */
  const labels = [
    { module: mNac, text: 'Мотогондола', pos: new THREE.Vector3(-4.0, 2.5, 0) },
    { module: mFan, text: 'Вентилятор', pos: new THREE.Vector3(ST.fan, 1.7, 0) },
    { module: mBoost, text: 'КНД', pos: new THREE.Vector3(-2.56, 1.02, 0) },
    { module: mHpc, text: 'КВД', pos: new THREE.Vector3(-1.61, 0.9, 0) },
    { module: mComb, text: 'Камера сгорания', pos: new THREE.Vector3(-0.56, 0.98, 0) },
    { module: mHpt, text: 'ТВД', pos: new THREE.Vector3(-0.03, 1.02, 0) },
    { module: mLpt, text: 'ТНД', pos: new THREE.Vector3(0.74, 1.18, 0) },
    { module: mExh, text: 'Сопло', pos: new THREE.Vector3(3.2, 0.85, 0) },
    { module: mShaft, text: 'Валы НД / ВД', pos: new THREE.Vector3(-0.96, -0.42, 0) },
    {
      module: mAcc,
      text: 'Коробка приводов',
      // подпись едет на бок вместе с самой коробкой
      pos: new THREE.Vector3(-2.46, -2.3, 0).applyAxisAngle(AGB_AXIS, AGB_TILT),
    },
  ];

  modules.forEach((m) => m.userData.base.copy(m.position));

  /* ------- невидимые прокси-объёмы для быстрого выбора узлов --------- *
   * Raycast по реальной геометрии (сотни тысяч треугольников) на каждое
   * движение мыши слишком дорог, поэтому пикаем упрощённые оболочки.    */
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });
  const pickables = [];
  const PROXY = [
    [mNac, ST.lip, ST.bypassExit, 2.3, true],
    [mFan, ST.fan - 1.05, -2.72, 1.55, false],
    [mBoost, ST.splitter, -2.26, 0.95, false],
    [mHpc, -2.26, -0.94, 0.8, false],
    [mComb, -0.94, -0.22, 0.88, false],
    [mHpt, -0.22, 0.24, 0.95, false],
    [mLpt, 0.24, 1.24, 1.12, false],
    [mExh, 1.24, ST.plugTip, 0.9, false],
    [mCowl, -2.81, ST.coreExit, 1.15, true],
    [mShaft, -3.26, 1.34, 0.33, false],
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
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 1.4), pickMat);
    box.position.set(-2.56, -1.5, 0);
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
