/* ------------------------------------------------------------------ *
 *  Engine sound: synthesised on the Web Audio API, no samples.
 *
 *  The model is tuned to the CFM56-7B (Boeing 737NG) and to a spectral
 *  analysis of real recordings of that engine. What the analysis showed
 *  (details in docs/06-sound.md):
 *
 *   · the tones sit on harmonics of the LP shaft rotation frequency, not
 *     only on the blade passing frequency: in the recordings 50…58 % of
 *     the tones found landed on integer shaft orders, the shaft running
 *     at 79.0…79.4 Hz (92 % N1);
 *   · the envelope over the orders peaks around 0.9…1.3 of the blade
 *     passing frequency and is strongly jagged — neighbouring orders
 *     differ by 10…18 dB;
 *   · the broadband part (jet noise) peaks at 200…300 Hz and rolls off
 *     steeply above that: −15 dB at 1 kHz, −30 dB at 2 kHz.
 *
 *  This is buzz-saw noise (multiple pure tones): when the blade tips go
 *  supersonic, each blade sends a shock wave forward along the intake.
 *  The blades differ slightly from one another, so the pattern repeats
 *  once per shaft revolution rather than once per blade passing period —
 *  hence the comb of shaft orders.
 * ------------------------------------------------------------------ */

const MASTER_TRIM = 3.0;

/** CFM56-7B (Boeing 737NG) */
const CFM = {
  fanBlades: 24,
  n1MaxRpm: 5175, // 100 % N1
  n2MaxRpm: 14460, // 100 % N2
  fanDiameter: 1.55, // m
};

/**
 * Measured buzz-saw envelope: relative amplitudes of shaft orders 1…48, taken
 * from a CFM56 recording at 92 % N1. The jaggedness is left exactly as measured
 * - it is what tells a live engine apart from a synthesiser's even sawtooth.
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
 * Relative Mach number at the fan blade tip.
 * Buzz-saw appears once it crosses unity.
 */
function tipMachRelative(n1) {
  const u = (Math.PI * CFM.fanDiameter * n1 * CFM.n1MaxRpm) / 60; // tangential, m/s
  const axial = 150 * (0.3 + 0.7 * n1); // axial velocity at the intake, m/s
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
 * @param {() => BaseAudioContext} [opts.makeContext] - context override, used to
 *        render the graph offline in tests
 */
export function createEngineSound(opts = {}) {
  const makeContext =
    opts.makeContext || (() => new (window.AudioContext || window.webkitAudioContext)());
  let ctx = null;
  let ready = false;
  let volume = 0.5;
  let enabled = false;

  // graph nodes
  let master, bus, panner;
  let combOsc, combGain, combFilter;
  let bpfOsc, bpfGain, bpf2Osc, bpf2Gain;
  let n2Osc, n2Gain, n2Filter;
  let jetBand, jetLow, jetLow2, jetGain;
  let rumbleFilter, rumbleGain;
  let fanBbBand, fanBbGain;
  let revBand, revGain;
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
    // infrasonic content only eats into the headroom
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

    /* ---- 1. Buzz-saw: the whole comb of orders from one oscillator ---- *
     * PeriodicWave sets the amplitude of every harmonic, so an oscillator
     * running at shaft frequency produces all 48 orders at once with the
     * measured envelope, and as the speed changes the comb slides as a
     * whole, just like on a real engine. The waveform is band-limited, so
     * there is no aliasing.                                             */
    const real = new Float32Array(BUZZSAW.length + 1);
    const imag = new Float32Array(BUZZSAW.length + 1);
    for (let n = 1; n <= BUZZSAW.length; n++) {
      // random but fixed phase: shocks from different blades are not in phase
      const phase = (n * 2.399963) % (Math.PI * 2);
      real[n] = BUZZSAW[n - 1] * Math.cos(phase);
      imag[n] = BUZZSAW[n - 1] * Math.sin(phase);
    }
    combOsc = ctx.createOscillator();
    combOsc.setPeriodicWave(ctx.createPeriodicWave(real, imag, { disableNormalization: false }));
    combFilter = ctx.createBiquadFilter();
    combFilter.type = 'highpass'; // the lowest orders are inaudible in the far field
    combFilter.frequency.value = 200;
    combFilter.Q.value = 0.7;
    combGain = ctx.createGain();
    combGain.gain.value = 0;
    combOsc.connect(combFilter).connect(combGain).connect(bus);
    combOsc.start();

    /* ---- 2. Blade passing tone and its second harmonic ---- *
     * At low speeds the blade tips are subsonic, there is no buzz-saw, and
     * what remains is the pure blade passing tone - the characteristic
     * whine heard while taxiing.                                        */
    bpfOsc = ctx.createOscillator();
    bpfOsc.type = 'sine'; // the blade passing tone is single, without a harmonic stack
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

    /* ---- 3. Whine of the high-pressure rotor ---- */
    n2Osc = ctx.createOscillator();
    n2Osc.type = 'sawtooth';
    n2Filter = ctx.createBiquadFilter();
    n2Filter.type = 'bandpass';
    n2Filter.Q.value = 3.5;
    n2Gain = ctx.createGain();
    n2Gain.gain.value = 0;
    n2Osc.connect(n2Filter).connect(n2Gain).connect(bus);
    n2Osc.start();

    /* ---- 4. Jet noise: peak at 200…300 Hz, steep roll-off above ---- *
     * In the recordings the level falls by about 13 dB per octave above
     * 300 Hz, so one bandpass is not enough - two lowpass filters follow. */
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

    /* ---- 5. Low rumble: combustion and structural vibration ---- *
     * In the recordings the low-frequency peak sits at 80…100 Hz rather
     * than at infrasonic frequencies, hence a bandpass, not just a
     * lowpass.                                                         */
    rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'bandpass';
    rumbleFilter.frequency.value = 88;
    rumbleFilter.Q.value = 1.0;
    rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0;
    brownSrc.connect(rumbleFilter).connect(rumbleGain).connect(bus);

    /* ---- 6. Broadband fan noise ---- */
    fanBbBand = ctx.createBiquadFilter();
    fanBbBand.type = 'bandpass';
    fanBbBand.frequency.value = 1800;
    fanBbBand.Q.value = 0.4;
    fanBbGain = ctx.createGain();
    fanBbGain.gain.value = 0;
    whiteSrc.connect(fanBbBand).connect(fanBbGain).connect(bus);

    /* ---- 6b. The cascades ---- *
     * Air turning through better than a right angle in a grille of vanes is
     * the loudest single thing about a thrust reverser, and it is broadband
     * rather than tonal: it comes from the shear layers off a few hundred
     * small vanes, not from anything going round. The band sits between the
     * jet noise and the fan - lower than the fan because the vanes are large
     * compared with a blade passage, higher than the jet because the scale is
     * still small.                                                          */
    revBand = ctx.createBiquadFilter();
    revBand.type = 'bandpass';
    revBand.frequency.value = 320;
    revBand.Q.value = 0.55;
    revGain = ctx.createGain();
    revGain.gain.value = 0;
    brownSrc.connect(revBand).connect(revGain).connect(bus);

    /* ---- 7. Liveliness: speed wander and jet turbulence ---- */
    wander = ctx.createOscillator(); // slow wander of the shaft frequency
    wander.frequency.value = 0.13;
    wanderGain = ctx.createGain();
    wanderGain.gain.value = 0;
    wander.connect(wanderGain);
    wanderGain.connect(combOsc.frequency);
    wander.start();

    turb = ctx.createOscillator(); // breathing of the jet
    turb.frequency.value = 0.31;
    turbGain = ctx.createGain();
    turbGain.gain.value = 0.05;
    turb.connect(turbGain).connect(jetGain.gain);
    // the cascade roar breathes with the same oscillator: it is the same
    // turbulence, and two independent wobbles would beat against each other
    turbGain.connect(revGain.gain);
    turb.start();

    ready = true;
  }

  const set = (param, value, tc = 0.09) => param.setTargetAtTime(value, ctx.currentTime, tc);

  /**
   * @param {number} n1      LP rotor speed, fraction of maximum 0..1
   * @param {number} n2      HP rotor speed, fraction of maximum 0..1
   * @param {number} burn    combustion intensity 0..1 (0 - fuel cut)
   * @param {number} pan     -1..1, position of the engine on screen
   * @param {number} nearness 0..1, how close the camera is
   * @param {number} rev     0..1, how much of the bypass duct the thrust
   *        reverser's blocker doors have closed. Defaults to 0 so the offline
   *        rendering snippet in test/audio/README.md keeps working unchanged.
   */
  function update(n1, n2, burn, pan = 0, nearness = 0.5, rev = 0) {
    if (!ready || !enabled) return;

    const shaft = (n1 * CFM.n1MaxRpm) / 60; // LP shaft frequency, Hz
    const bpf = shaft * CFM.fanBlades; // blade passing frequency
    const n2shaft = (n2 * CFM.n2MaxRpm) / 60;

    // buzz-saw switches on as the blade tip crosses the speed of sound
    const mach = tipMachRelative(n1);
    const buzz = smoothstep(mach, 0.98, 1.18);

    set(combOsc.frequency, Math.max(8, shaft));
    set(bpfOsc.frequency, Math.max(20, bpf));
    set(bpf2Osc.frequency, Math.max(40, bpf * 2));
    set(n2Osc.frequency, Math.max(40, n2shaft));
    set(n2Filter.frequency, Math.max(200, n2shaft * 4), 0.2);

    // tonal components - driven by rotor speed
    set(combGain.gain, 0.105 * buzz * Math.pow(n1, 0.6));
    set(bpfGain.gain, 0.042 * Math.min(1, n1 * 6) * (1 - 0.55 * buzz));
    set(bpf2Gain.gain, 0.010 * Math.min(1, n1 * 6) * (1 - 0.55 * buzz));
    set(n2Gain.gain, 0.032 * Math.pow(n2, 1.3) * Math.min(1, n2 * 6));

    /* Noise components - driven by combustion and airflow.
     *
     * Reverse changes three of them and leaves the rest alone. The fan-driven
     * part of the jet noise goes away with the fan jet: with the duct blocked
     * there is no high-velocity stream leaving the fan nozzle. The part driven
     * by combustion stays, because the core is still doing exactly what it was.
     * The broadband fan noise gets louder and darker - it is no longer leaving
     * down a lined duct but sideways through a grille. And the cascades
     * themselves roar.
     *
     * The buzz-saw comb is deliberately untouched. It radiates forward out of
     * the intake, and the intake has not changed. */
    set(jetGain.gain, 0.16 * Math.pow(n1, 1.2) * (1 - 0.85 * rev) + 0.66 * Math.pow(burn, 1.4));
    set(rumbleGain.gain, 0.30 * (0.30 * n1 + 0.70 * burn));
    set(fanBbGain.gain, 0.011 * (0.35 + 0.65 * n1) * (1 + 1.4 * rev));
    set(revGain.gain, 0.95 * rev * Math.pow(n1, 0.8));

    // the jet spectrum shifts up as the exhaust velocity rises
    set(jetBand.frequency, 180 + 130 * burn, 0.25);
    set(jetLow.frequency, 290 + 210 * burn, 0.25);
    set(jetLow2.frequency, 350 + 260 * burn, 0.25);
    set(fanBbBand.frequency, (1200 + 1600 * n1) * (1 - 0.35 * rev), 0.25);
    set(combFilter.frequency, 150 + 120 * n1, 0.25);

    // liveliness: the wander grows more noticeable at higher speeds
    set(wanderGain.gain, 0.0025 * shaft);
    set(turbGain.gain, 0.04 + 0.05 * burn);

    // silence once everything has stopped
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
    /** engine parameters - used by the tests */
    spec: CFM,
  };
}
