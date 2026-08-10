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

import {
  t4Of,
  createSurge,
  surgeMargin,
  DROOP_N1,
  DROOP_N2,
  HUNG_N1,
  HUNG_N2,
  T4_BOOST,
  THRUST_LOSS,
} from './surge.js';

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

/**
 * How far the fuel command runs ahead of the speed on a transient.
 *
 * A real engine's fuel valve moves in a fraction of a second while a rotor with
 * real inertia does not, so for the interval in between the burner is being fed
 * for a speed the compressor has not reached. That mismatch is what an
 * acceleration schedule exists to ration - and this model has no acceleration
 * schedule, which is exactly why it can be made to surge and a 737 cannot.
 *
 * The term is zero in the steady state, so nothing about the settled engine
 * changes; it decays with the HP rotor's own time constant, so a slam's
 * temperature overshoot lasts the few seconds one actually lasts; and it goes
 * negative on a chop, which moves the operating point AWAY from surge. (A chop
 * risks a lean blow-out instead - a different failure, not modelled.)
 *
 * 0.32 is not chosen, it is cornered. Solving SM = 0 for this constant:
 * below 0.203 an instantaneous idle-to-full slam cannot reach the boundary at
 * all; below 0.274 a half-second flick of the lever cannot, and a slider is
 * dragged rather than stepped, so that is the bound that binds; above 0.406 an
 * instant advance to only 50 % would surge, which it must not. 0.32 sits inside
 * 0.274…0.406 with clearance either side. test/surge.test.mjs states all three.
 */
const LEAD = 0.32;

/* Ceiling on the fuel command. Before the surge work `burn` could not exceed 1;
   it can now, because a surge adds to it - the air stops arriving while the
   fuel keeps going in. Every consumer was checked (heathaze clamps at 1.15,
   contrailView at 1, airflow through the colour ramp; the flame and plume
   shaders simply get brighter, which is what a surge should look like), but
   sound.js reads it unbounded in four places, so the excursion is bounded here.
   1.2 is T4 = 2090 °C: an over-temperature, visibly past the 1800 of take-off
   power, which is the honest thing for a surge to show. */
const BURN_MAX = 1.2;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createEngineState(initialThrottle = 0.85) {
  const surge = createSurge();

  const eng = {
    mode: 'run',
    n1: IDLE_N1 + (1 - IDLE_N1) * initialThrottle, // speeds, fraction of maximum
    n2: IDLE_N2 + (1 - IDLE_N2) * initialThrottle,
    fuel: 1, // fuel supply
    wf: initialThrottle, // commanded fuel flow - the valve, ahead of the flame
    burn: initialThrottle, // combustion intensity
    t4: 350 + 1450 * initialThrottle, // gas temperature ahead of the turbine, °C
    keff: initialThrottle, // effective regime derived from LP speed
    grossThrust: 0, // kN, before anything is done to the streams; see below
    lightOff: true, // has light-off occurred: the app boots with the engine running
    ignition: 0, // time from fuel introduction to light-off, s

    /* Compressor stability. A sub-state of `run` rather than a fifth mode: the
       engine is still running, the reverser interlock still reads `run`, and
       the throttle is still live - and it has to be, because pulling it back is
       the recovery action. */
    surge: 'clear', // 'clear' | 'surging' | 'stall'
    sm: 0, // surge margin; positive stable, zero the boundary
    bangs: 0, // monotone count of bangs; consumers latch on a change
    reverse: 0, // core flow running backwards this instant, 0..1
    cell: 0, // angle of the rotating stall cells, radians

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
          /* A locked stall caps what the spools can reach, however far the
             lever is advanced: a stalled compressor cannot pass the air to go
             faster. The FUEL command is deliberately not capped with them - see
             below - and that asymmetry is the whole reason a stall cooks. */
          if (eng.surge === 'stall') {
            t1 = Math.min(t1, HUNG_N1);
            t2 = Math.min(t2, HUNG_N2);
          }
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

      /* The fuel command: what the valve is doing, as against `burn`, which is
         what the flame is doing, and `t4`, which is what the instrument says.
         The three are deliberately different: fuel reaches the flame within a
         combustor residence time, while the flame and a thermocouple both lag.

         The mode structure is the same one the burn target has always had, and
         only `run` carries the lead term. Written without that gate the model
         surges on the DEFAULT path: during cranking n2 sits near START_N2 while
         the lever stays wherever it was left, and the application boots with
         the throttle at 85 % - which puts the command far above what a rotor at
         30 % could ever swallow. And the `!burning` branch has to win, or a fuel
         cut would leave fuel commanded, and a fuel cut is the only thing that
         clears a locked stall. */
      const n2cmd = IDLE_N2 + (1 - IDLE_N2) * throttle;
      eng.wf = !burning
        ? 0
        : eng.mode === 'start'
          ? 0.3
          : clamp(0.1 + 0.9 * eng.keff + (LEAD * (n2cmd - eng.n2)) / (1 - IDLE_N2), 0, BURN_MAX);

      /* Stability. The margin is taken on the speed the rotors have JUST been
         integrated to and before any droop is applied, so a droop cannot feed
         itself within one step.

         `wf` above uses the speed the LEVER commands, not the capped target, so
         in a locked stall the command stays high while the spools hang. Note
         that only the lead term sees the uncapped lever - the `0.9 * keff`
         first term is built from the actual LP speed and so is capped with it.
         That is the intended reading, and it is what puts the stalled engine at
         about 1745 °C rather than at either extreme. */
      eng.sm = surgeMargin(eng.n2, eng.wf);
      eng.surge = surge.update(dt, eng.sm, Boolean(burning), eng.n2);
      eng.bangs = surge.bangs;
      eng.reverse = surge.reverse;
      eng.cell = surge.cell;

      /* Each bang costs the rotors speed. The HP rotor loses more than twice
         what the LP one does: it is the HP compressor that has stalled, while
         the fan is still being driven by an LP turbine still being fed. */
      const lost = surge.reverse;
      if (lost > 0) {
        eng.n1 = Math.max(0, eng.n1 - DROOP_N1 * lost * dt);
        eng.n2 = Math.max(0, eng.n2 - DROOP_N2 * lost * dt);
      }

      /* Less air through the burner, the same fuel: the mixture goes rich and
         the temperature spikes. Added to the TARGET rather than to t4, so the
         existing lag still shapes it and the needle climbs the way a real one
         does instead of stepping. */
      const spike = burning ? T4_BOOST * (surge.reverse + surge.choke) : 0;
      const burnTarget = clamp(eng.wf + spike, 0, BURN_MAX);

      const tauB = burnTarget > eng.burn ? 0.7 : 0.35;
      eng.burn += (burnTarget - eng.burn) * (1 - Math.exp(-dt / tauB));
      if (!burning && eng.burn < 0.004) eng.burn = 0;

      // gas temperature: rises fast, cools slowly, so the brief burst of
      // combustion at light-off produces a noticeable T4 overshoot
      const t4Target = burning ? t4Of(eng.burn) : 15;
      const tauT = !burning ? 7.0 : t4Target > eng.t4 ? 0.6 : 2.2;
      eng.t4 += (t4Target - eng.t4) * (1 - Math.exp(-dt / tauT));

      /* Gross thrust: what the engine produces, before anything downstream
         redirects it. 121.4 kN is the take-off rating of the prototype
         (CFM56-7B27, 27 300 lbf) and the exponent 1.45 is empirical - both the
         mass flow and the jet velocity grow with fan speed, so thrust grows
         faster than either. With the fuel cut it goes to zero at once, without
         waiting for the rotors.

         It lives here rather than in the display code because the thrust
         reverser turns it negative, and a number that can change sign is worth
         being able to check under Node. */
      eng.grossThrust = eng.fuel ? 121.4 * Math.pow(eng.keff, 1.45) : 0;
      /* Thrust goes with the flow. When the gas is coming back out of the
         intake there is nothing leaving the nozzle to push with, so the
         read-out collapses on each bang and stays down in a locked stall. */
      eng.grossThrust *= 1 - THRUST_LOSS * clamp(surge.reverse + surge.choke, 0, 1);

      return eng.keff;
    },
  };

  return eng;
}
