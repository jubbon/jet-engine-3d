import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/* ------------------------------------------------------------------ *
 *  Тепловое искажение реактивной струи (heat haze / schlieren).
 *
 *  Горячий газ за соплом имеет другую плотность, а значит и другой
 *  показатель преломления, чем окружающий воздух. Турбулентные вихри
 *  струи непрерывно перемешивают горячее и холодное - луч света,
 *  проходящий сквозь струю, гуляет, и всё, что видно СКВОЗЬ струю,
 *  дрожит и размывается. Когда смотришь двигателю в сопло, толща
 *  газа набирается вдоль всего луча, и «плывёт» весь экран.
 *
 *  Эффект экранный: для каждого пикселя строится луч из камеры,
 *  он трассируется сквозь конус струи, и по набранной «оптической
 *  толщине» пиксель смещается и подмыливается.
 *
 *  Ось двигателя - X, поток идёт в +X (см. src/engine.js).
 * ------------------------------------------------------------------ */

// Габариты факела: от среза сопла наружного контура до размытия струи.
// 1 условная единица = 0.50 м.
const PLUME = {
  x0: 2.2, // начало (срез наружного контура; ядро горячей струи - дальше)
  x1: 18.0, // хвост, где струя размешивается с атмосферой
  r0: 1.45, // радиус струи у сопла
  r1: 4.0, // радиус размытой струи в хвосте
};

// Корпус двигателя, которым струя закрыта: смотришь спереди - между
// глазом и струёй стоит мотогондола, и дрожать ничего не должно.
// Три цилиндра: мотогондола, внутренний капот, центральное тело.
const OCCLUDERS = [
  [1.78, -5.35, 2.65],
  [1.05, 2.65, 4.25],
  [0.62, 4.25, 4.85],
];

// Сила эффекта. amp - смещение в пикселах, blur - радиус подмыливания в них же,
// gas - плотность видимой струи.
const LOOK = { amp: 13.0, blur: 5.5, gas: 0.95 };

// Режим «Потоки воздуха» - схема: там важно видеть частицы, линии тока и
// температурную раскраску струи, а плотный белый выхлоп их просто закрашивает.
// Поэтому в схеме от эффекта остаётся лёгкое марево.
const FLOW_LOOK = { amp: 0.55, blur: 0.5, gas: 0.2 };

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec3 uCam;          // положение камеры в мире
  uniform mat4 uInvVP;        // обратная матрица проекции*вида
  uniform vec2 uInvRes;       // 1 / размер кадра, пикселы -> UV
  uniform float uTime;
  uniform float uPower;       // 0..1.15, интенсивность (горение + обороты)
  uniform float uFlow;        // скорость сноса вихрей вниз по потоку, ед./с
  uniform float uAmp;         // максимальное смещение, пикселы
  uniform float uBlur;        // радиус подмыливания, пикселы
  uniform float uGas;         // плотность видимого газа 0..1
  uniform float uGasMax;      // потолок непрозрачности струи
  uniform vec3 uGasNear;      // цвет струи у сопла (линейный, до тонкомпрессии)
  uniform vec3 uGasFar;       // цвет размытого хвоста
  uniform vec4 uPlume;        // x0, x1, r0, r1
  uniform vec3 uOcc[${OCCLUDERS.length}]; // радиус, x от, x до
  varying vec2 vUv;

  const int STEPS = 16;
  const float EXT = 0.62;     // ослабление для искажения
  const float GAS_EXT = 1.0;  // ослабление для видимого газа

  /* Пересечение луча с цилиндром по оси X.
     Возвращает (t вход, t выход); если t выход < t вход - промах. */
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
      return vec2(1.0, -1.0); // луч параллелен оси и идёт мимо
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

  /* Ближайшая точка, где луч упирается в корпус двигателя.
     Если камера уже внутри цилиндра (t входа < 0) - не заслоняем. */
  float occlusion(vec3 ro, vec3 rd) {
    float best = 1e9;
    for (int i = 0; i < ${OCCLUDERS.length}; i++) {
      vec2 h = cylinder(ro, rd, uOcc[i].x, uOcc[i].y, uOcc[i].z);
      if (h.y > h.x && h.x > 0.0) best = min(best, h.x);
    }
    return best;
  }

  /* Плотность горячего газа в точке: конус, расширяющийся вниз по потоку,
     с мягким краем, затуханием к хвосту и более плотным ядром у сопла.

     Возвращает две величины. x - для искажения: хвост затухает медленно,
     потому что даже сильно разбавленный горячий газ ещё гуляет лучом.
     y - для видимого газа: затухает гораздо круче, иначе разреженный хвост
     набирается вдоль луча и при взгляде сзади заливает белым весь кадр,
     хотя видимой струёй там уже давно не пахнет. */
  vec2 density(vec3 p) {
    float t = (p.x - uPlume.x) / (uPlume.y - uPlume.x);
    if (t < 0.0 || t > 1.0) return vec2(0.0);
    float R = mix(uPlume.z, uPlume.w, pow(t, 0.7));
    float rr = length(p.yz);
    float radial = 1.0 - smoothstep(R * 0.35, R, rr);
    float core = 1.0 - smoothstep(0.0, 0.5, t); // ядро горячей струи у сопла
    float base = radial * (0.45 + 0.8 * core) * smoothstep(0.0, 0.05, t);
    float tail = 1.0 - t;
    return vec2(base * pow(tail, 1.25), base * pow(tail, 2.6));
  }

  /* Клубы газа. Синусные поля ниже на мелком масштабе выдают свою решётку -
     струя покрывается регулярным «рубчиком», поэтому здесь настоящий
     хеш-шум. Считается один раз на пиксель, две октавы. */
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

  /* Турбулентность струи: два независимых поля на «синусах от синусов».
     Дёшево, не имеет видимой сетки и сносится вниз по потоку вместе с газом. */
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

    // луч из камеры через пиксель
    vec4 far = uInvVP * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
    vec3 rd = normalize(far.xyz / far.w - uCam);
    vec3 ro = uCam;

    // грубая отсечка: габаритный цилиндр факела
    vec2 span = cylinder(ro, rd, uPlume.w, uPlume.x, uPlume.y);
    float tIn = max(span.x, 0.0);
    float tOut = min(span.y, occlusion(ro, rd));
    if (tOut <= tIn + 1e-3) { gl_FragColor = src; return; }

    // Шаги берём без случайного сдвига: «центр преломления» ниже считается
    // по этим же точкам, и любой пиксельный джиттер превратил бы гладкое
    // искажение в кашу из отдельных точек.
    float step = (tOut - tIn) / float(STEPS);
    float t = tIn + step * 0.5;

    // Набираем оптическую толщину вдоль луча и заодно «центр преломления» -
    // взвешенную середину горячего газа. Ближние вихри искажают картинку
    // сильнее дальних, поэтому вес падает вместе с прозрачностью.
    float trans = 1.0; // сколько света ещё не «перемешано» струёй
    float transGas = 1.0; // сколько света ещё не рассеяно ею же
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

    // Турбулентность считаем один раз - в центре преломления. Если брать её
    // на каждом шаге и усреднять, разнознаковый шум вдоль луча взаимно
    // гасится и искажение вырождается в еле заметную рябь.
    pc /= max(wSum, 1e-4);
    vec2 n = turbulence(pc) * 0.70 + turbulence(pc * 2.6 + vec3(9.3, 4.1, 7.7)) * 0.36;

    vec2 off = n * cover * uAmp * uInvRes;
    float br = cover * uBlur;

    // подмыливание: центр + четыре луча, радиус растёт с толщиной струи
    vec3 acc = texture2D(tDiffuse, vUv + off).rgb * 0.32;
    acc += texture2D(tDiffuse, vUv + off + vec2( 0.95,  0.31) * br * uInvRes).rgb * 0.17;
    acc += texture2D(tDiffuse, vUv + off + vec2(-0.59,  0.81) * br * uInvRes).rgb * 0.17;
    acc += texture2D(tDiffuse, vUv + off + vec2(-0.81, -0.59) * br * uInvRes).rgb * 0.17;
    acc += texture2D(tDiffuse, vUv + off + vec2( 0.45, -0.89) * br * uInvRes).rgb * 0.17;

    // слабая дисперсия: разные длины волн преломляются немного по-разному
    float ca = cover * 0.35;
    acc.r = mix(acc.r, texture2D(tDiffuse, vUv + off * 1.14).r, ca);
    acc.b = mix(acc.b, texture2D(tDiffuse, vUv + off * 0.86).b, ca);

    /* --------------------------- видимый газ ---------------------------- *
     *  Та же набранная толщина, но уже как непрозрачность: струя не только
     *  преломляет свет, но и рассеивает его - выхлоп видно белёсым облаком.
     *  Композитим спереди назад, поэтому за струёй всё честно блёкнет.
     * -------------------------------------------------------------------- */
    // на малом газе струя должна быть видна, а не только на взлётном режиме,
    // поэтому зависимость от режима более пологая, чем у искажения
    float gp = pow(clamp(uPower / 1.15, 0.0, 1.0), 0.6);
    float gas = (1.0 - transGas) * uGas * gp;
    // Клубы. Крупный масштаб берём из той же турбулентности, что и искажение,
    // - газ и дрожание дышат в такт; мелкий даёт хеш-шум, снесённый вниз
    // по потоку, иначе струя выглядит не турбулентной, а ватной.
    float lumps = fbm(vec3(pc.x - uTime * uFlow, pc.yz) * 1.15);
    gas *= clamp(0.52 + 0.26 * (n.x * 0.6 + n.y * 0.4) + 1.05 * lumps, 0.2, 1.7);

    // у сопла газ ещё горячий и отдаёт в тёплое, дальше остывает и сереет
    float aft = smoothstep(uPlume.x + 1.0, uPlume.x + 9.0, pc.x);
    vec3 gasCol = mix(uGasNear, uGasFar, aft);

    // Потолок непрозрачности: даже в самой гуще струи двигатель должен
    // просвечивать, иначе вид сзади превращается в белый лист.
    acc = mix(acc, gasCol, clamp(gas, 0.0, uGasMax));

    gl_FragColor = vec4(acc, src.a);
  }
`;

/**
 * Интенсивность искажения по состоянию двигателя.
 * Основной вклад даёт горение (плотность/температура струи),
 * небольшой - расход воздуха: на выбеге струя ещё есть, но холодная.
 * @param {number} burn интенсивность горения 0..1
 * @param {number} n1 обороты вентилятора 0..1
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
      uGasMax: { value: 0.72 },
      // Значения линейные, до тональной компрессии: ACES с экспозицией 0.82
      // прижимает единицу примерно к 0.8, поэтому «белый» здесь больше 1.
      uGasNear: { value: new THREE.Color(1.55, 1.45, 1.3) },
      uGasFar: { value: new THREE.Color(1.24, 1.3, 1.4) },
      uPlume: { value: new THREE.Vector4(PLUME.x0, PLUME.x1, PLUME.r0, PLUME.r1) },
      uOcc: { value: OCCLUDERS.map((o) => new THREE.Vector3(...o)) },
    },
    vertexShader,
    fragmentShader,
  });
  // ShaderPass делает глубокую копию переданных uniform'ов, поэтому дальше
  // работаем только с теми, что реально попали в материал
  const uniforms = pass.uniforms;

  let time = 0;
  let enabled = true;

  /**
   * @param {number} dt секунды
   * @param {number} burn интенсивность горения 0..1
   * @param {number} n1 обороты вентилятора 0..1
   */
  function update(dt, burn, n1) {
    time += dt;
    const power = hazePower(burn, n1);
    // пока двигатель холодный, проход можно вообще не считать
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
    /** Схематический режим «Потоки воздуха»: приглушить выхлоп, чтобы он не
     *  закрашивал частицы и линии тока. */
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
