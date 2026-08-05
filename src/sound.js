/* ------------------------------------------------------------------ *
 *  Звук двигателя: синтез на Web Audio API без сэмплов.
 *
 *  Модель настроена по CFM56-7B (Boeing 737NG) и по спектральному анализу
 *  реальных записей этого двигателя. Что дал анализ (подробности в
 *  docs/06-sound.md):
 *
 *   · тоны стоят на гармониках частоты вращения вала НД, а не только на
 *     частоте следования лопаток: в записи 50…58 % найденных тонов легли
 *     на целые порядки вала с частотой 79.0…79.4 Гц (92 % N1);
 *   · огибающая по порядкам имеет максимум около 0.9…1.3 частоты следования
 *     лопаток и сильно изрезана — соседние порядки различаются на 10…18 дБ;
 *   · широкополосная часть (шум струи) имеет максимум на 200…300 Гц и круто
 *     спадает вверх: −15 дБ на 1 кГц, −30 дБ на 2 кГц.
 *
 *  Это и есть buzz-saw (multiple pure tones): при сверхзвуковом обтекании
 *  концов лопаток от каждой лопатки вперёд по каналу уходит скачок уплотнения.
 *  Лопатки чуть отличаются друг от друга, поэтому картина повторяется не за
 *  период следования лопаток, а за оборот вала — отсюда гребёнка по порядкам.
 * ------------------------------------------------------------------ */

const MASTER_TRIM = 3.0;

/** CFM56-7B (Boeing 737NG) */
const CFM = {
  fanBlades: 24,
  n1MaxRpm: 5175, // 100 % N1
  n2MaxRpm: 14460, // 100 % N2
  fanDiameter: 1.55, // м
};

/**
 * Измеренная огибающая buzz-saw: относительные амплитуды порядков вала 1…48,
 * снятые с записи CFM56 на 92 % N1. Изрезанность оставлена как есть - именно
 * она отличает живой двигатель от ровной пилы синтезатора.
 */
const BUZZSAW = [
  0.123, 0.209, 0.176, 0.26, 0.263, 0.468, 0.351, 0.347,
  0.174, 0.292, 0.457, 0.266, 0.442, 0.153, 0.232, 0.209,
  0.226, 0.457, 0.155, 0.447, 1.0, 0.295, 0.115, 0.891,
  0.101, 0.126, 0.151, 0.75, 0.123, 0.351, 1.0, 0.457,
  0.442, 0.245, 0.313, 0.359, 0.313, 0.299, 0.17, 0.188,
  0.412, 0.313, 0.14, 0.398, 0.582, 0.219, 0.112, 0.385,
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smoothstep = (x, a, b) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Относительное число Маха на конце лопатки вентилятора.
 * Buzz-saw появляется, когда оно переходит через единицу.
 */
function tipMachRelative(n1) {
  const u = (Math.PI * CFM.fanDiameter * n1 * CFM.n1MaxRpm) / 60; // окружная, м/с
  const axial = 150 * (0.3 + 0.7 * n1); // осевая скорость на входе, м/с
  return Math.hypot(u, axial) / 340;
}

function noiseBuffer(ctx, seconds, brown) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.2;
    } else {
      d[i] = white * 0.6;
    }
  }
  const fade = Math.min(4096, Math.floor(len / 8));
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    d[len - fade + i] = d[len - fade + i] * (1 - t) + d[i] * t;
  }
  return buf;
}

/**
 * @param {object} [opts]
 * @param {() => BaseAudioContext} [opts.makeContext] - подмена контекста
 *        для офлайн-проверки графа в тестах
 */
export function createEngineSound(opts = {}) {
  const makeContext =
    opts.makeContext || (() => new (window.AudioContext || window.webkitAudioContext)());
  let ctx = null;
  let ready = false;
  let volume = 0.5;
  let enabled = false;

  // узлы графа
  let master, bus, panner;
  let combOsc, combGain, combFilter;
  let bpfOsc, bpfGain, bpf2Osc, bpf2Gain;
  let n2Osc, n2Gain, n2Filter;
  let jetBand, jetLow, jetLow2, jetGain;
  let rumbleFilter, rumbleGain;
  let fanBbBand, fanBbGain;
  let wander, wanderGain, turb, turbGain;

  function build() {
    ctx = makeContext();

    master = ctx.createGain();
    master.gain.value = 0;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 5;
    comp.attack.value = 0.012;
    comp.release.value = 0.3;

    panner = ctx.createStereoPanner();
    bus = ctx.createGain();
    bus.gain.value = 1;
    // инфранизкие частоты только съедают запас по уровню
    const busHp = ctx.createBiquadFilter();
    busHp.type = 'highpass';
    busHp.frequency.value = 58;
    busHp.Q.value = 0.7;
    const busHp2 = ctx.createBiquadFilter();
    busHp2.type = 'highpass';
    busHp2.frequency.value = 52;
    busHp2.Q.value = 0.6;
    bus.connect(busHp);
    busHp.connect(busHp2);
    busHp2.connect(panner);
    panner.connect(comp);
    comp.connect(master);
    master.connect(ctx.destination);

    const brown = noiseBuffer(ctx, 4, true);
    const white = noiseBuffer(ctx, 4, false);
    const src = (buf) => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.start();
      return s;
    };
    const brownSrc = src(brown);
    const whiteSrc = src(white);

    /* ---- 1. Buzz-saw: вся гребёнка порядков из одного осциллятора ---- *
     * PeriodicWave задаёт амплитуду каждой гармоники, поэтому осциллятор
     * на частоте вала сразу даёт все 48 порядков с измеренной огибающей,
     * и при изменении оборотов гребёнка едет целиком, как у настоящего
     * двигателя. Форма волны band-limited, поэтому алиасинга нет.       */
    const real = new Float32Array(BUZZSAW.length + 1);
    const imag = new Float32Array(BUZZSAW.length + 1);
    for (let n = 1; n <= BUZZSAW.length; n++) {
      // случайная, но постоянная фаза: скачки от разных лопаток не синфазны
      const phase = (n * 2.399963) % (Math.PI * 2);
      real[n] = BUZZSAW[n - 1] * Math.cos(phase);
      imag[n] = BUZZSAW[n - 1] * Math.sin(phase);
    }
    combOsc = ctx.createOscillator();
    combOsc.setPeriodicWave(ctx.createPeriodicWave(real, imag, { disableNormalization: false }));
    combFilter = ctx.createBiquadFilter();
    combFilter.type = 'highpass'; // самые низкие порядки в дальнем поле не слышны
    combFilter.frequency.value = 200;
    combFilter.Q.value = 0.7;
    combGain = ctx.createGain();
    combGain.gain.value = 0;
    combOsc.connect(combFilter).connect(combGain).connect(bus);
    combOsc.start();

    /* ---- 2. Тон следования лопаток и вторая гармоника ---- *
     * На малых оборотах концы лопаток дозвуковые, buzz-saw нет, и остаётся
     * чистый тон следования лопаток - характерный вой на рулении.        */
    bpfOsc = ctx.createOscillator();
    bpfOsc.type = 'sine'; // тон следования лопаток - одиночный, без стека гармоник
    bpfGain = ctx.createGain();
    bpfGain.gain.value = 0;
    bpfOsc.connect(bpfGain).connect(bus);
    bpfOsc.start();

    bpf2Osc = ctx.createOscillator();
    bpf2Osc.type = 'sine';
    bpf2Gain = ctx.createGain();
    bpf2Gain.gain.value = 0;
    bpf2Osc.connect(bpf2Gain).connect(bus);
    bpf2Osc.start();

    /* ---- 3. Свист ротора высокого давления ---- */
    n2Osc = ctx.createOscillator();
    n2Osc.type = 'sawtooth';
    n2Filter = ctx.createBiquadFilter();
    n2Filter.type = 'bandpass';
    n2Filter.Q.value = 3.5;
    n2Gain = ctx.createGain();
    n2Gain.gain.value = 0;
    n2Osc.connect(n2Filter).connect(n2Gain).connect(bus);
    n2Osc.start();

    /* ---- 4. Шум струи: максимум 200…300 Гц, крутой спад вверх ---- *
     * В записи уровень падает примерно на 13 дБ на октаву выше 300 Гц,
     * поэтому одного полосового фильтра мало - за ним каскад из двух ФНЧ. */
    jetBand = ctx.createBiquadFilter();
    jetBand.type = 'bandpass';
    jetBand.frequency.value = 230;
    jetBand.Q.value = 0.7;
    jetLow = ctx.createBiquadFilter();
    jetLow.type = 'lowpass';
    jetLow.frequency.value = 420;
    jetLow.Q.value = 0.7;
    jetLow2 = ctx.createBiquadFilter();
    jetLow2.type = 'lowpass';
    jetLow2.frequency.value = 520;
    jetLow2.Q.value = 0.5;
    jetGain = ctx.createGain();
    jetGain.gain.value = 0;
    brownSrc.connect(jetBand).connect(jetLow).connect(jetLow2).connect(jetGain).connect(bus);

    /* ---- 5. Низкий рокот: горение и вибрация конструкции ---- *
     * В записи максимум низкочастотной части приходится на 80…100 Гц,
     * а не на инфранизкие частоты, поэтому полоса, а не просто ФНЧ.     */
    rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'bandpass';
    rumbleFilter.frequency.value = 88;
    rumbleFilter.Q.value = 1.0;
    rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0;
    brownSrc.connect(rumbleFilter).connect(rumbleGain).connect(bus);

    /* ---- 6. Широкополосный шум вентилятора ---- */
    fanBbBand = ctx.createBiquadFilter();
    fanBbBand.type = 'bandpass';
    fanBbBand.frequency.value = 1800;
    fanBbBand.Q.value = 0.4;
    fanBbGain = ctx.createGain();
    fanBbGain.gain.value = 0;
    whiteSrc.connect(fanBbBand).connect(fanBbGain).connect(bus);

    /* ---- 7. Живость: увод оборотов и турбулентность струи ---- */
    wander = ctx.createOscillator(); // медленный увод частоты вала
    wander.frequency.value = 0.13;
    wanderGain = ctx.createGain();
    wanderGain.gain.value = 0;
    wander.connect(wanderGain);
    wanderGain.connect(combOsc.frequency);
    wander.start();

    turb = ctx.createOscillator(); // «дыхание» струи
    turb.frequency.value = 0.31;
    turbGain = ctx.createGain();
    turbGain.gain.value = 0.05;
    turb.connect(turbGain).connect(jetGain.gain);
    turb.start();

    ready = true;
  }

  const set = (param, value, tc = 0.09) => param.setTargetAtTime(value, ctx.currentTime, tc);

  /**
   * @param {number} n1      обороты ротора НД, доля от максимума 0..1
   * @param {number} n2      обороты ротора ВД, доля от максимума 0..1
   * @param {number} burn    интенсивность горения 0..1 (0 - топливо отсечено)
   * @param {number} pan     -1..1, положение двигателя на экране
   * @param {number} nearness 0..1, близость камеры
   */
  function update(n1, n2, burn, pan = 0, nearness = 0.5) {
    if (!ready || !enabled) return;

    const shaft = (n1 * CFM.n1MaxRpm) / 60; // частота вала НД, Гц
    const bpf = shaft * CFM.fanBlades; // частота следования лопаток
    const n2shaft = (n2 * CFM.n2MaxRpm) / 60;

    // buzz-saw включается при переходе конца лопатки через скорость звука
    const mach = tipMachRelative(n1);
    const buzz = smoothstep(mach, 0.98, 1.18);

    set(combOsc.frequency, Math.max(8, shaft));
    set(bpfOsc.frequency, Math.max(20, bpf));
    set(bpf2Osc.frequency, Math.max(40, bpf * 2));
    set(n2Osc.frequency, Math.max(40, n2shaft));
    set(n2Filter.frequency, Math.max(200, n2shaft * 4), 0.2);

    // тональные составляющие - от оборотов
    set(combGain.gain, 0.105 * buzz * Math.pow(n1, 0.6));
    set(bpfGain.gain, 0.042 * Math.min(1, n1 * 6) * (1 - 0.55 * buzz));
    set(bpf2Gain.gain, 0.010 * Math.min(1, n1 * 6) * (1 - 0.55 * buzz));
    set(n2Gain.gain, 0.032 * Math.pow(n2, 1.3) * Math.min(1, n2 * 6));

    // шумовые составляющие - от горения и расхода воздуха
    set(jetGain.gain, 0.16 * Math.pow(n1, 1.2) + 0.66 * Math.pow(burn, 1.4));
    set(rumbleGain.gain, 0.30 * (0.30 * n1 + 0.70 * burn));
    set(fanBbGain.gain, 0.011 * (0.35 + 0.65 * n1));

    // спектр струи смещается вверх с ростом скорости истечения
    set(jetBand.frequency, 180 + 130 * burn, 0.25);
    set(jetLow.frequency, 290 + 210 * burn, 0.25);
    set(jetLow2.frequency, 350 + 260 * burn, 0.25);
    set(fanBbBand.frequency, 1200 + 1600 * n1, 0.25);
    set(combFilter.frequency, 150 + 120 * n1, 0.25);

    // живость: увод тем заметнее, чем выше обороты
    set(wanderGain.gain, 0.0025 * shaft);
    set(turbGain.gain, 0.04 + 0.05 * burn);

    // при полной остановке - тишина
    const alive = Math.min(1, Math.max(n1, n2, burn) * 8);
    set(bus.gain, (0.55 + 0.75 * nearness) * alive, 0.25);
    set(panner.pan, clamp(pan, -0.85, 0.85), 0.15);
    set(master.gain, volume * MASTER_TRIM, 0.2);
  }

  return {
    get enabled() {
      return enabled;
    },
    async enable() {
      if (!ready) build();
      const offline = typeof ctx.startRendering === 'function';
      if (!offline && ctx.state === 'suspended') await ctx.resume();
      enabled = true;
      master.gain.setTargetAtTime(volume * MASTER_TRIM, ctx.currentTime, 0.5);
    },
    disable() {
      if (!ready) return;
      enabled = false;
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    },
    setVolume(v) {
      volume = v;
      if (ready && enabled) master.gain.setTargetAtTime(v * MASTER_TRIM, ctx.currentTime, 0.1);
    },
    suspend() {
      if (ready && ctx.state === 'running') ctx.suspend();
    },
    resume() {
      if (ready && enabled && ctx.state === 'suspended') ctx.resume();
    },
    update,
    /** параметры двигателя - используются в проверках */
    spec: CFM,
  };
}
