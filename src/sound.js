/* ------------------------------------------------------------------ *
 *  Процедурный звук двигателя (Web Audio API, без сэмплов).
 *
 *  Складывается из четырёх составляющих реального ТРДД:
 *    · низкий рокот   - горение и вибрация конструкции (шумовой НЧ);
 *    · рёв струи      - смешение горячей струи с наружным потоком;
 *    · шипение        - высокочастотный шум выхлопа и наружного контура;
 *    · тональный вой  - частота следования лопаток вентилятора
 *                       (об/мин N1 / 60 x 22 лопатки) и свист ротора ВД.
 *
 *  Все частоты и уровни пересчитываются от текущего режима, поэтому
 *  раскрутка и сброс газа слышны так же, как видны на роторе.
 * ------------------------------------------------------------------ */

const MASTER_TRIM = 3.2; // общий подъём уровня после фильтров
const FAN_BLADES = 22;
const N1_MAX_RPM = 3300; // об/мин ротора НД на 100 %
const N2_MAX_RPM = 15000; // об/мин ротора ВД на 100 %

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
  // сшиваем концы, чтобы петля не щёлкала
  const fade = Math.min(2048, Math.floor(len / 8));
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    d[len - fade + i] = d[len - fade + i] * (1 - t) + d[i] * t;
  }
  return buf;
}

/**
 * @param {object} [opts]
 * @param {() => BaseAudioContext} [opts.makeContext] - подмена контекста
 *        (используется для офлайн-проверки графа в тестах)
 */
export function createEngineSound(opts = {}) {
  const makeContext = opts.makeContext || (() => new (window.AudioContext || window.webkitAudioContext)());
  let ctx = null;
  let ready = false;
  let master, bus, panner;
  let rumbleGain, roarGain, hissGain, fanGain, fan2Gain, n2Gain;
  let roarFilter, hissFilter, fanFilter, n2Filter;
  let fanOsc, fan2Osc, n2Osc, lfo, lfoGain;
  let volume = 0.5;
  let enabled = false;

  function build() {
    ctx = makeContext();

    master = ctx.createGain();
    master.gain.value = 0;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;

    panner = ctx.createStereoPanner();
    bus = ctx.createGain();
    bus.gain.value = 1;

    bus.connect(panner);
    panner.connect(comp);
    comp.connect(master);
    master.connect(ctx.destination);

    const brown = noiseBuffer(ctx, 3, true);
    const white = noiseBuffer(ctx, 3, false);

    const src = (buf) => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.start();
      return s;
    };
    const brownSrc = src(brown);
    const whiteSrc = src(white);

    // низкий рокот
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 130;
    rumbleFilter.Q.value = 0.9;
    rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0;
    brownSrc.connect(rumbleFilter).connect(rumbleGain).connect(bus);

    // рёв струи
    roarFilter = ctx.createBiquadFilter();
    roarFilter.type = 'bandpass';
    roarFilter.frequency.value = 420;
    roarFilter.Q.value = 0.6;
    roarGain = ctx.createGain();
    roarGain.gain.value = 0;
    brownSrc.connect(roarFilter).connect(roarGain).connect(bus);

    // шипение выхлопа
    hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'highpass';
    hissFilter.frequency.value = 2600;
    hissGain = ctx.createGain();
    hissGain.gain.value = 0;
    whiteSrc.connect(hissFilter).connect(hissGain).connect(bus);

    // тон вентилятора: частота следования лопаток
    fanOsc = ctx.createOscillator();
    fanOsc.type = 'sawtooth';
    fanFilter = ctx.createBiquadFilter();
    fanFilter.type = 'lowpass';
    fanFilter.frequency.value = 3200;
    fanFilter.Q.value = 1.4;
    fanGain = ctx.createGain();
    fanGain.gain.value = 0;
    fanOsc.connect(fanFilter).connect(fanGain).connect(bus);
    fanOsc.start();

    // вторая гармоника
    fan2Osc = ctx.createOscillator();
    fan2Osc.type = 'sine';
    fan2Gain = ctx.createGain();
    fan2Gain.gain.value = 0;
    fan2Osc.connect(fan2Gain).connect(bus);
    fan2Osc.start();

    // свист ротора высокого давления
    n2Osc = ctx.createOscillator();
    n2Osc.type = 'sawtooth';
    n2Filter = ctx.createBiquadFilter();
    n2Filter.type = 'bandpass';
    n2Filter.frequency.value = 900;
    n2Filter.Q.value = 2.2;
    n2Gain = ctx.createGain();
    n2Gain.gain.value = 0;
    n2Osc.connect(n2Filter).connect(n2Gain).connect(bus);
    n2Osc.start();

    // медленная модуляция рёва - «дыхание» струи
    lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.27;
    lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.05;
    lfo.connect(lfoGain).connect(roarGain.gain);
    lfo.start();

    ready = true;
  }

  const set = (param, value, tc = 0.09) => {
    param.setTargetAtTime(value, ctx.currentTime, tc);
  };

  /**
   * @param {number} n1      обороты ротора НД, доля от максимума 0..1
   * @param {number} n2      обороты ротора ВД, доля от максимума 0..1
   * @param {number} burn    интенсивность горения 0..1 (0 - топливо отсечено)
   * @param {number} pan     -1..1, положение двигателя на экране
   * @param {number} nearness 0..1, близость камеры
   *
   * Шумовые составляющие привязаны к горению и расходу воздуха, тональные -
   * к оборотам. Поэтому при отсечке топлива рёв пропадает сразу, а вой
   * вентилятора продолжает падать по частоте, пока роторы не остановятся.
   */
  function update(n1, n2, burn, pan = 0, nearness = 0.5) {
    if (!ready || !enabled) return;

    const bpf = (n1 * N1_MAX_RPM * FAN_BLADES) / 60; // Гц
    const n2shaft = (n2 * N2_MAX_RPM) / 60;

    set(fanOsc.frequency, Math.max(20, bpf));
    set(fan2Osc.frequency, Math.max(40, bpf * 2));
    set(n2Osc.frequency, Math.max(40, n2shaft * 3));
    set(n2Filter.frequency, Math.max(120, n2shaft * 3));

    // шум горения и струи
    set(rumbleGain.gain, 0.34 * (0.12 * n1 + 0.88 * burn));
    set(roarGain.gain, 0.03 * n1 + 0.42 * Math.pow(burn, 1.3));
    // шум прокачиваемого воздуха
    set(hissGain.gain, 0.008 * n1 + 0.075 * Math.pow(n1, 1.6));
    // тоны роторов
    set(fanGain.gain, (0.012 + 0.058 * Math.pow(n1, 0.8)) * Math.min(1, n1 * 6));
    set(fan2Gain.gain, (0.004 + 0.02 * Math.pow(n1, 1.4)) * Math.min(1, n1 * 6));
    set(n2Gain.gain, (0.006 + 0.03 * Math.pow(n2, 1.2)) * Math.min(1, n2 * 6));

    set(roarFilter.frequency, 260 + 620 * burn, 0.2);
    set(fanFilter.frequency, 1800 + 3600 * n1, 0.2);
    set(hissFilter.frequency, 3400 - 1100 * n1, 0.2);

    // при полной остановке звук уходит в тишину
    const alive = Math.min(1, Math.max(n1, n2, burn) * 8);
    // «вблизи» слышнее тон вентилятора и шипение, издали - рокот
    set(bus.gain, (0.55 + 0.75 * nearness) * alive, 0.25);
    set(panner.pan, Math.max(-0.85, Math.min(0.85, pan)), 0.15);
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
  };
}
