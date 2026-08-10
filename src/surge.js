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
 *  At a fixed corrected speed the compressor delivers a fixed W, so the
 *  pressure the compressor works against - and hence its pressure ratio
 *  - must rise as the square root of the turbine entry temperature:
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

   The SHAPE is the point, not the individual numbers. The margin is narrowest
   just above idle and widens towards take-off power. That is why surge is a
   low-speed transient phenomenon rather than something that happens at full
   power; it is why a real HP compressor carries variable stator vanes and
   handling bleed valves, which are open at exactly these speeds and are the
   reason the real surge line sits where it does; and it is why a FADEC's
   acceleration schedule is at its most restrictive precisely where the engine
   feels most sluggish.

   Neither the vanes nor the bleed valves are modelled as hardware - the
   geometry has no VSV rings to turn - so their effect is folded into this
   table. That is the honest place for it: they change where the boundary is,
   and the boundary is what this table is. */
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
