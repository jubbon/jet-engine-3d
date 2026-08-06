/* ------------------------------------------------------------------ *
 *  Engine state: start, running, shutdown, rotor rundown.
 *  This module knows nothing about Three.js or the DOM - it is pure
 *  regime physics, so it can be run under Node and checked numerically.
 *
 *  off   - shut down, rotors at rest
 *  start - starter cranking, light-off, acceleration to idle
 *  run   - running, speeds commanded by the throttle
 *  stop  - fuel cut, rotors coasting down
 * ------------------------------------------------------------------ */

export const IDLE_N1 = 0.18; // idle, fraction of maximum speed
export const IDLE_N2 = 0.56;
export const START_N2 = 0.3; // speed the starter cranks the HP rotor to
export const LIGHT_N2 = 0.22; // speed at which fuel is introduced and ignition begins
export const LIGHT_DELAY = 2.5; // from fuel introduction to visible flame, s

/**
 * Time constants, seconds. They differ per phase because rotor acceleration is
 * governed by excess torque, and excess torque differs from phase to phase:
 *
 *  - starter cranking: the air starter supplies a small excess torque that
 *    falls off with speed - the slowest phase of all;
 *  - acceleration to idle: the turbine has only just started working, excess
 *    torque is small, and the engine winds itself up unhurriedly;
 *  - operating regimes: excess torque is large, hence the brisk response;
 *  - rundown: no torque at all, the rotors are braked by pumping and friction.
 */
const TAU = {
  crank1: 12.0, // starter cranking
  crank2: 12.5,
  accel1: 10.0, // from light-off to idle
  accel2: 7.4,
  up1: 2.6, // acceleration at operating regimes
  up2: 2.0,
  down1: 1.9, // deceleration
  down2: 1.4,
  coast1: 9.3, // rundown after fuel cut
  coast2: 5.9,
};

// bearing friction: constant angular deceleration, brings the rotors to a true stop
const FRICTION_N1 = 0.0022;
const FRICTION_N2 = 0.0035;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createEngineState(initialThrottle = 0.85) {
  const eng = {
    mode: 'run',
    n1: IDLE_N1 + (1 - IDLE_N1) * initialThrottle, // speeds, fraction of maximum
    n2: IDLE_N2 + (1 - IDLE_N2) * initialThrottle,
    fuel: 1, // fuel supply
    burn: initialThrottle, // combustion intensity
    t4: 350 + 1450 * initialThrottle, // gas temperature ahead of the turbine, °C
    keff: initialThrottle, // effective regime derived from LP speed
    lightOff: true, // has light-off occurred: the app boots with the engine running
    ignition: 0, // time from fuel introduction to light-off, s

    setMode(mode) {
      eng.mode = mode;
      if (mode === 'start') {
        eng.fuel = 0; // fuel is introduced only after the starter has cranked
        eng.lightOff = false;
        eng.ignition = 0;
      }
      if (mode === 'stop') eng.fuel = 0; // fuel shut-off lever: fuel cut
    },

    /** @param {number} dt seconds @param {number} throttle 0..1 */
    update(dt, throttle) {
      let t1 = 0;
      let t2 = 0;

      switch (eng.mode) {
        case 'start':
          if (!eng.lightOff) {
            // the starter turns the HP rotor only, the LP rotor is picked up by the flow
            t2 = START_N2;
            t1 = eng.n2 * 0.16;
            if (!eng.fuel) {
              if (eng.n2 > LIGHT_N2) eng.fuel = 1; // fuel introduced, igniters on
            } else {
              // fuel is in the chamber, but the flame does not establish instantly
              eng.ignition += dt;
              if (eng.ignition >= LIGHT_DELAY) {
                eng.lightOff = true;
                eng.burn = 0.45; // light-off flare
              }
            }
          } else {
            t1 = IDLE_N1;
            t2 = IDLE_N2;
            if (eng.n2 > IDLE_N2 - 0.02) eng.mode = 'run';
          }
          break;
        case 'run':
          t1 = IDLE_N1 + (1 - IDLE_N1) * throttle;
          t2 = IDLE_N2 + (1 - IDLE_N2) * throttle;
          break;
        case 'stop':
          if (eng.n1 <= 0 && eng.n2 <= 0) eng.mode = 'off';
          break;
        default: // off
          break;
      }

      const coasting = eng.mode === 'stop' || eng.mode === 'off';
      const cranking = eng.mode === 'start' && !eng.lightOff; // starter still turning
      const spoolingUp = eng.mode === 'start'; // after light-off, before idle
      // the LP rotor is heavier and responds more slowly in every regime
      const tau1 = coasting ? TAU.coast1
        : cranking ? TAU.crank1
        : spoolingUp ? TAU.accel1
        : t1 > eng.n1 ? TAU.up1 : TAU.down1;
      const tau2 = coasting ? TAU.coast2
        : cranking ? TAU.crank2
        : spoolingUp ? TAU.accel2
        : t2 > eng.n2 ? TAU.up2 : TAU.down2;
      eng.n1 += (t1 - eng.n1) * (1 - Math.exp(-dt / tau1));
      eng.n2 += (t2 - eng.n2) * (1 - Math.exp(-dt / tau2));
      if (coasting) {
        // bearing friction: removes the tail of the exponential and reaches zero
        eng.n1 = Math.max(0, eng.n1 - dt * FRICTION_N1);
        eng.n2 = Math.max(0, eng.n2 - dt * FRICTION_N2);
      }

      // combustion: dies quickly, builds up smoothly.
      // During start the airflow is still small and the mixture rich - hence the
      // temperature overshoot, which decays as the engine winds up to idle.
      eng.keff = clamp((eng.n1 - IDLE_N1) / (1 - IDLE_N1), 0, 1);
      // while fuel is on but light-off has not happened, there is no flame and the gas path stays cold
      const burning = eng.fuel && eng.lightOff;
      const burnTarget = !burning ? 0 : eng.mode === 'start' ? 0.3 : 0.1 + 0.9 * eng.keff;
      const tauB = burnTarget > eng.burn ? 0.7 : 0.35;
      eng.burn += (burnTarget - eng.burn) * (1 - Math.exp(-dt / tauB));
      if (!burning && eng.burn < 0.004) eng.burn = 0;

      // gas temperature: rises fast, cools slowly, so the brief burst of
      // combustion at light-off produces a noticeable T4 overshoot
      const t4Target = burning ? 350 + 1450 * eng.burn : 15;
      const tauT = !burning ? 7.0 : t4Target > eng.t4 ? 0.6 : 2.2;
      eng.t4 += (t4Target - eng.t4) * (1 - Math.exp(-dt / tauT));

      return eng.keff;
    },
  };

  return eng;
}
