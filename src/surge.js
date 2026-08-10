/* ------------------------------------------------------------------ *
 *  Compressor stability: the map, the surge line, and how far the
 *  operating point is from it.
 *
 *  Like engineState.js and reverser.js this module knows nothing about
 *  Three.js or the DOM. A surge lasts a fraction of a second and the
 *  interesting part of it is a number crossing zero, so it has to be
 *  runnable under Node.
 *
 *  The point of the whole file is one idea: a compressor is not a pump.
 *  A pump pushes harder the faster it turns; a compressor is a stack of
 *  wings, every one of which has a critical angle of attack, and the
 *  machine as a whole has a stability boundary that the operating point
 *  can be driven across. Drive it across and the flow separates, the
 *  pressure behind the compressor breaks back through it, and the gas is
 *  expelled forward out of the intake with a bang.
 *
 *  WHAT IS PHYSICS HERE AND WHAT IS A TABLE
 *
 *  Only one relation below is derived. The HP turbine nozzle is choked
 *  in every regime that matters, so it passes a fixed corrected mass
 *  flow:
 *
 *      W * sqrt(T4) / P4 = const
 *
 *  At a fixed corrected speed the compressor delivers a fixed CORRECTED
 *  flow, and with no ram compression in this model the inlet temperature
 *  is fixed too - so the pressure the compressor works against, and
 *  hence its pressure ratio, must rise as the square root of the turbine
 *  entry temperature:
 *
 *      PR_op / PR_work = sqrt( T4 / T4ref(n2) )
 *
 *  That is the entire mechanism by which "fuel is running ahead of the
 *  airflow" becomes a number. Everything else is tabulated: the working
 *  line is the model's own pressure-ratio formula, and the surge line is
 *  a table of plausible margins. The model does not solve the equations
 *  of gas dynamics, so the stability boundary here is NOT computed - it
 *  is given, exactly as the velocity and temperature profiles in
 *  airflow.js are given. The compressor map drawn from these functions
 *  must not be read as a calculation, and docs/03-physics.md says so.
 *
 *  The temperatures are ABSOLUTE. In Celsius the relation above is not
 *  merely imprecise but false - at idle it is wrong by 55 %.
 * ------------------------------------------------------------------ */

/* Idle HP speed. The same 0.56 as IDLE_N2 in engineState.js, deliberately
   copied rather than imported: engineState.js imports THIS file, and a module
   cannot import back from the one that imports it without a cycle. The repo
   already carries two such copies on purpose - X_DOORS in airflow.js and DUCT_H
   in reverser.js - and handles them the same way, by having a test compare the
   two halves directly rather than trusting either. surge.test.mjs does that. */
const IDLE_N2 = 0.56;

/* The gas temperature relation, in one place. T4 = 350 + 1450 * burn degrees
   Celsius is engineState's combustion model; it lives here because the surge
   criterion is a statement ABOUT that temperature, and a second copy of it
   would be a criterion that silently stopped matching the engine it judges.
   engineState.js imports these rather than writing the numbers again. */
export const T4_MIN = 350; // °C at the lowest combustion the model draws
export const T4_SPAN = 1450; // °C per unit of burn
const KELVIN = 273.15;

/** Gas temperature ahead of the turbine for a given fuel flow, °C. */
export const t4Of = (burn) => T4_MIN + T4_SPAN * burn;

/** The same in kelvin, which is the only form the choked-nozzle relation holds in. */
export const t4K = (burn) => KELVIN + t4Of(burn);

/* Surge margin along the working line, as a fraction of the working pressure
   ratio, against HP speed.

   This is the boundary of a compressor whose variable stator vanes and handling
   bleed valves are ON SCHEDULE. Neither is modelled as hardware - the geometry
   has no VSV rings to turn - so their effect is folded in here, which is the
   honest place for it: they move the boundary, and the boundary is what this
   table is.

   The residual narrowing just above idle is what those devices do not quite
   remove - stage mismatching in the region where the front and the rear of a
   multistage compressor want different flow. It is NOT the reason surge is a
   low-speed phenomenon in this model, and it would be circular to say so: the
   vanes and the bleeds exist precisely to restore low-speed margin, so a table
   that already accounts for them cannot also be the argument that low speed is
   where the danger is.

   What actually makes surge a low-speed transient here is the other half of the
   mechanism: for a given overfuelling the excursion off the working line is
   largest when the rotor has the least speed to answer with. That falls out of
   LEAD and the rotor time constants in engineState.js and would still hold if
   this table were flat. The table decides where the threshold sits, not why
   there is one.

   One consequence is load-bearing and easy to lose: during a start the fuel
   command sits at 0.3 while the reference temperature is still the idle one, so
   the margin down here is only about two hundredths. Lower the 0.50 or 0.60
   entries much and every start begins to surge. test/surge.test.mjs states it
   as its own check so the connection is not left to be rediscovered. */
export const SM0 = [
  [0.30, 0.30],
  [0.50, 0.20],
  [0.60, 0.16],
  [0.70, 0.17],
  [0.80, 0.20],
  [0.90, 0.25],
  [1.00, 0.28],
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// piecewise-linear interpolation over [[x, value], ...], as in airflow.js
function pw(table, x) {
  if (x <= table[0][0]) return table[0][1];
  const n = table.length;
  if (x >= table[n - 1][0]) return table[n - 1][1];
  for (let i = 1; i < n; i++) {
    if (x <= table[i][0]) {
      const [x0, v0] = table[i - 1];
      const [x1, v1] = table[i];
      return v0 + (v1 - v0) * ((x - x0) / (x1 - x0));
    }
  }
  return table[n - 1][1];
}

/** Tabulated surge margin along the working line at this HP speed, 0..1. */
export const marginAt = (n2) => pw(SM0, n2);

/**
 * Pressure ratio at the compressor exit in steady running, referred to ambient.
 *
 * This is the model's OWN formula - `p * (1 + 27 * comp)` with `comp = n2^2.5`,
 * the expression main.js uses for the "After HPC" row of the station table. It
 * is not a second opinion about the same quantity: if that formula ever moves,
 * both places move together, and there is a comment at the other end saying so.
 *
 * Note what it is: the OVERALL pressure ratio - fan, booster and HPC together,
 * about 28 at take-off - and not the HP compressor's own ratio of about 11. A
 * real compressor map plots the latter. Using the former costs nothing here,
 * because the margin is a RATIO of two points on this curve and any common
 * factor cancels; and it buys the chart an axis the station table already
 * shows, so the reader can find the same number in two places.
 */
export const workingLine = (n2) => 1 + 27 * Math.pow(clamp(n2, 0, 1), 2.5);

/** The stability boundary: the working line raised by the tabulated margin. */
export const surgeLine = (n2) => workingLine(n2) * (1 + marginAt(n2));

/**
 * The abscissa of the compressor map.
 *
 * A real map plots corrected mass flow, and THIS MODEL HAS NO MASS FLOW - there
 * is no W anywhere in engineState.js or main.js, and inventing one would be
 * inventing a calculation. So this is an explicit stand-in, proportional to HP
 * speed, which is what a compressor map's abscissa largely tracks anyway below
 * choke. The chart labels the axis as the stand-in it is. It is defined here
 * rather than in the drawing code so that the chart is built out of the same
 * functions that decide the engine's behaviour, and cannot come to disagree
 * with them.
 */
export const correctedFlow = (n2) => clamp(n2, 0, 1);

/**
 * The fuel flow this HP speed would settle at in steady running.
 *
 * It inverts engineState's own steady mapping: at a settled throttle the LP and
 * HP speeds correspond, so `keff` and `(n2 - IDLE_N2) / (1 - IDLE_N2)` are the
 * same number, and the burn target is `0.1 + 0.9 * keff`. Below idle there is
 * no steady running to speak of and the clamp holds it at the idle value.
 */
export const steadyBurn = (n2) => 0.1 + 0.9 * clamp((n2 - IDLE_N2) / (1 - IDLE_N2), 0, 1);

/** Turbine entry temperature this HP speed would settle at, kelvin. */
export const refT4 = (n2) => t4K(steadyBurn(n2));

/**
 * How far the operating point is from the surge line, as a fraction.
 *
 * Positive is stable, zero is the boundary, negative is a surge. In steady
 * running `wf` equals `steadyBurn(n2)`, the square root is exactly 1, and this
 * returns the tabulated `marginAt(n2)` unchanged - which is what makes the
 * number checkable against the table rather than against itself.
 *
 * Which definition of surge margin: this is the ratio of pressure ratios,
 * PR_surge / PR_op - 1, the constant-corrected-FLOW definition. The tabulated
 * margin it is measured against is looked up at the operating point's speed,
 * which is a constant-corrected-SPEED quantity. Conflating the two is normal in
 * a model at this level and it costs nothing here, because the model has no
 * mass flow to distinguish them with - but the two are not the same definition,
 * and a reader who knows that should see it acknowledged rather than glossed.
 *
 * `wf` is the COMMANDED fuel flow, not the indicated temperature. Fuel reaches
 * the flame within a combustor residence time and the back-pressure follows it
 * at once; what lags is the flame the model draws (`burn`) and the temperature
 * the instrument shows (`t4`), the latter for the same reason a real EGT
 * thermocouple lags - mass in the probe. Computed from `eng.t4` instead, the
 * two lags chained together smear the fuel spike over seconds and the operating
 * point never reaches the boundary at all: the engine could not be made to
 * surge by any throttle movement whatever. The bang comes first and the needle
 * second, which is also how it looks from the flight deck.
 *
 * @param {number} n2 HP rotor speed, fraction of maximum
 * @param {number} wf commanded fuel flow, in the units of `burn`
 */
export function surgeMargin(n2, wf) {
  /* The floor is not decoration. On a deceleration the fuel command carries a
     negative lead term by design, and a negative absolute temperature would
     make this NaN - a hole in the model rather than an error anyone would see.
     No realistic chop gets there, and nothing in the arithmetic prevents it. */
  const ratio = Math.sqrt(t4K(Math.max(0, wf)) / refT4(n2));
  return (1 + marginAt(n2)) / ratio - 1;
}

/* ================================================================== *
 *  What happens once the boundary has been crossed.
 * ================================================================== */

/* Cycles per second. Real full surge runs at 3…10 Hz; 4 is inside that and
   slow enough that the individual bangs read as bangs rather than as a buzz. */
export const SURGE_HZ = 4;

/* How long the engine can surge before it stops being a transient. Hold the
   lever up and the surge turns into a steady stall - hung speed, rising
   temperature - from which only a shutdown remains. Both outcomes are worth
   showing, and 4 s is long enough to see a dozen bangs and decide. */
export const LOCK_TIME = 4.0; // s

/* Recovery hysteresis. Without it the state chatters on the boundary, which
   would look like a fault in the model rather than a fault in the engine. */
export const SM_RECOVER = 0.04; // margin needed before recovery can begin
export const RECOVER_HOLD = 0.3; // s it must be held for

/* Shape of one cycle. The flow does not spend half of each cycle running
   backwards: it breaks down sharply, is expelled, and re-establishes. So the
   pulse is at its peak AT the bang and decays over the first 30 % of the cycle
   - which also keeps `bang` and `reverse` consistent with one another, so the
   particles expelled by a bang are expelled at the moment it is heard. */
const PULSE_W = 0.3;

/* Loss of speed per second at the peak of a pulse. The HP rotor loses more than
   twice what the LP one does: it is the HP compressor that has stalled, while
   the fan is still being driven by an LP turbine that is still being fed.

   This is also what makes a surge SELF-SUSTAINING while the lever stays up. N2
   falls, the reference temperature falls with it, the margin stays negative,
   and the next cycle follows. Pull the lever back and the fuel command
   collapses, the margin goes positive, and it clears. Both outcomes fall out of
   one mechanism rather than being scripted separately. */
export const DROOP_N1 = 0.50;
export const DROOP_N2 = 1.20;

/* Where the spools hang once the stall has locked. A stalled compressor cannot
   pass the air to go faster, however far the lever is advanced. */
export const HUNG_N1 = 0.30;
export const HUNG_N2 = 0.45;

/* And the steady loss of throughput that stands in for a locked stall, feeding
   the same temperature rise and thrust collapse the pulse does. Nothing is
   expelled forward in a stall: the flow is no longer oscillating, it is simply
   bad. */
export const STALL_CHOKE = 0.35;

/* Speed of the stall cells round the annulus, as a fraction of rotor speed.
   Rotating stall really does travel at roughly half rotor speed, and that it is
   SLOWER than the rotor is the whole visual point - the cells are not carried
   round with the blades, they propagate. */
export const STALL_CELL = 0.48;

/* Extra fuel-to-air excess seen by the burner when the air stops arriving, and
   the share of the thrust that goes with the flow. */
export const T4_BOOST = 0.55;
export const THRUST_LOSS = 0.85;

/** How much of the core flow is going the wrong way, 0..1, at this phase. */
function reversePulse(phase) {
  return phase < PULSE_W ? 1 - phase / PULSE_W : 0;
}

/**
 * The surge sub-state machine.
 *
 *   clear -> surging : the margin has gone to zero
 *   surging -> clear : the margin restored, and held
 *   surging -> stall : surging for LOCK_TIME without let-up
 *   stall -> clear   : fuel cut only
 *
 * It is a sub-state of the engine's `run`, not a fifth engine mode. The engine
 * is still running: the reverser interlock still reads `run`, and the throttle
 * is still live - and it MUST be live, because pulling it back is the recovery
 * action. A fifth mode would have broken all three.
 */
export function createSurge() {
  let phase = 0;
  let surgingFor = 0;
  let clearFor = 0;

  const s = {
    state: 'clear',
    reverse: 0, // core flow running backwards, 0..1, pulsed
    choke: 0, // steady loss of throughput in a locked stall, 0..1
    cell: 0, // angle of the stall cells, radians
    bangs: 0, // monotone count; consumers latch on a change

    /**
     * @param {number} dt seconds
     * @param {number} margin the surge margin this instant
     * @param {boolean} running fuel on and the flame lit
     * @param {number} n2 HP rotor speed, for the stall cell rotation
     */
    update(dt, margin, running, n2 = 0) {
      /* A fuel cut clears everything, from any state. This is the ONLY exit
         from a locked stall, and it lives here rather than at the call site so
         that the rule can be tested without an engine attached. */
      if (!running) {
        s.state = 'clear';
        s.reverse = 0;
        s.choke = 0;
        surgingFor = 0;
        clearFor = 0;
        return s.state;
      }

      if (s.state === 'clear') {
        if (margin <= 0) {
          s.state = 'surging';
          surgingFor = 0;
          clearFor = 0;
          phase = 0;
          s.bangs++; // the crossing is itself the first bang
        }
      } else if (s.state === 'surging') {
        surgingFor += dt;
        phase += SURGE_HZ * dt;
        /* A `while`, not a single subtraction, and `bangs` a counter rather
           than a flag. dt is capped at 0.05 s but the x4 time scale multiplies
           it, so a step can span most of a cycle already - and all of one if
           SURGE_HZ is ever moved within the 3…10 Hz that real surge occupies.
           A flag would drop the extra bangs silently, and the sound would fall
           out of step with the flow it is supposed to share an instant with. */
        while (phase >= 1) {
          phase -= 1;
          s.bangs++;
        }
        if (margin >= SM_RECOVER) {
          clearFor += dt;
          if (clearFor >= RECOVER_HOLD) s.state = 'clear';
        } else {
          clearFor = 0;
        }
        if (s.state === 'surging' && surgingFor >= LOCK_TIME) s.state = 'stall';
      }

      s.reverse = s.state === 'surging' ? reversePulse(phase) : 0;
      s.choke = s.state === 'stall' ? STALL_CHOKE : 0;
      if (s.state === 'stall') s.cell += STALL_CELL * n2 * dt * Math.PI * 2;
      return s.state;
    },
  };

  return s;
}
