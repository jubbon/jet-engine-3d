/* ------------------------------------------------------------------ *
 *  Contrail: does the exhaust leave a trail, and does the trail last.
 *
 *  Pure physics, no Three.js and no DOM - the criterion is checked under
 *  Node against the property it is built on rather than against a
 *  picture (see test/contrail.test.mjs).
 *
 *  The question is not whether the exhaust carries water - it always
 *  does, about 1.24 kg of it per kilogram of kerosene - but whether the
 *  jet, mixing with the ambient air, passes through saturation on its
 *  way down to the ambient temperature. It carries heat as well as
 *  vapour, and heat is what keeps the mixture unsaturated.
 * ------------------------------------------------------------------ */

import { atmosphere, humidity, eSatWater } from './atmosphere.js';

export const EI_H2O = 1.24; // kg of water per kg of fuel burnt
const CP = 1004; // specific heat of air at constant pressure, J/(kg·K)
const EPS = 0.622; // ratio of the molar masses of water and air
const Q_FUEL = 43e6; // heat of combustion of kerosene, J/kg

/**
 * Slope of the mixing line in "temperature - vapour pressure" coordinates,
 * Pa/K. This is the Schmidt - Appleman parameter: as the jet mixes with the
 * ambient air, its state moves along a straight line of this slope, and the
 * whole question is whether that line touches the saturation curve.
 *
 * The `1 − η` in the denominator is where the counter-intuitive part lives:
 * the more of the fuel's energy leaves as thrust, the less of it stays in the
 * jet as heat, the steeper the line - and **the more readily an efficient
 * engine leaves a trail**.
 *
 * @param {number} p ambient pressure, Pa
 * @param {number} eta propulsive efficiency, 0…1
 */
export const contrailSlope = (p, eta) => (EI_H2O * CP * p) / (EPS * Q_FUEL * (1 - eta));

/**
 * The threshold temperature at saturation, °C: colder than this and a trail
 * forms in air already saturated with respect to water.
 *
 * Schumann's (1996) approximation of the tangency condition - the temperature
 * at which a line of slope G just touches the saturation curve. It is a fit,
 * and the test does not take it on trust: it checks that the saturation curve
 * really does have slope G there.
 *
 * @param {number} G slope of the mixing line, Pa/K
 * @returns {number} °C, or NaN for a slope too shallow to ever reach the curve
 */
export function criticalTemperature(G) {
  if (!(G > 0.053)) return NaN;
  const l = Math.log(G - 0.053);
  return -46.46 + 9.43 * l + 0.72 * l * l;
}

/**
 * The threshold temperature at the actual humidity, °C.
 *
 * Below saturation the mixing line has to travel further before it meets the
 * curve, so the air must be colder still. The state to be reached is the
 * intersection of the line drawn from the tangency point with the curve scaled
 * by the relative humidity; there is no closed form, so it is bisected.
 *
 * @param {number} G slope of the mixing line, Pa/K
 * @param {number} rh relative humidity over water, 0…1
 */
export function formationTemperature(G, rh) {
  const tCrit = criticalTemperature(G);
  if (Number.isNaN(tCrit) || rh >= 1) return tCrit;

  // vapour pressure along the mixing line, extended back from the tangency
  // point towards colder air
  const line = (t) => eSatWater(tCrit) - G * (tCrit - t);
  const f = (t) => line(t) - rh * eSatWater(t);

  // f is non-negative at the tangency point and negative far below it, where
  // the line has run down to zero while the curve has not
  let lo = tCrit - 120;
  let hi = tCrit;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/**
 * The verdict on the trail for the given conditions.
 *
 * Two independent questions, and they are decided separately. **Whether it
 * forms** is the Schmidt - Appleman criterion above: it depends on the engine,
 * through the slope. **Whether it lasts** does not depend on the engine at
 * all - if the ambient air is supersaturated with respect to ice, the crystals
 * go on growing on the ambient vapour and the trail spreads into cirrus; if it
 * is not, they evaporate within seconds. That difference is why the sky is
 * criss-crossed with bands one day and clear the next.
 *
 * @param {ReturnType<typeof atmosphere>} amb
 * @param {ReturnType<typeof humidity>} hum
 * @param {number} eta propulsive efficiency, 0…1
 */
export function contrail(amb, hum, eta) {
  const G = contrailSlope(amb.p, eta);
  const tCrit = criticalTemperature(G);
  const tForm = formationTemperature(G, hum.rh);
  const forms = amb.t < tForm;
  // above freezing rhIce is not reported at all, and a trail there is out of
  // the question anyway
  const persistent = forms && hum.rhIce !== null && hum.rhIce >= 1;

  return {
    G,
    tCrit,
    tForm,
    forms,
    persistent,
    /** how much colder than the threshold the air is, K; negative means no trail */
    margin: tForm - amb.t,
    verdict: !forms ? 'none' : persistent ? 'persistent' : 'short-lived',
  };
}

/** Altitudes the panel may search through, m. */
export const H_MAX = 12000;
const STEP = 50;

/**
 * The nearest altitude at which the verdict would flip, m, or null if it does
 * not flip anywhere between the ground and 12 km.
 *
 * Both sides of the criterion move with altitude - the air gets colder, which
 * helps, and the pressure falls, which flattens the mixing line and hinders -
 * and above the tropopause only the second one keeps moving, so the trail can
 * be lost again by climbing. The boundary is therefore not single and cannot
 * be bisected; the altitudes are simply walked outwards from the current one
 * until the verdict changes. The humidity and the deviation from standard are
 * held as they are: the question is "how much higher", not "how much of
 * everything else".
 *
 * @param {number} h current altitude, m
 * @param {number} deltaISA deviation of the day from standard, K
 * @param {number} rh relative humidity over water, 0…1
 * @param {number} eta propulsive efficiency, 0…1
 */
export function flipAltitude(h, deltaISA, rh, eta) {
  const formsAt = (alt) => {
    const amb = atmosphere(alt, deltaISA);
    return contrail(amb, humidity(amb.t, rh), eta).forms;
  };

  const now = formsAt(h);
  for (let d = STEP; d <= H_MAX; d += STEP) {
    const up = h + d;
    const down = h - d;
    if (up <= H_MAX && formsAt(up) !== now) return up;
    if (down >= 0 && formsAt(down) !== now) return down;
  }
  return null;
}
