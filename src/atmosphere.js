/* ------------------------------------------------------------------ *
 *  Ambient conditions: the standard atmosphere with a deviation from it.
 *
 *  Like engineState.js, this module knows nothing about Three.js or the
 *  DOM - it is pure physics, so it can be run under Node and checked
 *  against the published ISA tables rather than against a picture.
 *
 *  The engine model itself works at one point, on the ground; this gives
 *  it the other end of the scale - the eleven kilometres where an
 *  airliner spends almost all of its flight, the air three times thinner
 *  and seventy degrees colder.
 * ------------------------------------------------------------------ */

/** Sea level, standard day. */
export const T0 = 288.15; // K
export const P0 = 101325; // Pa

export const R = 287.05287; // specific gas constant of dry air, J/(kg·K)

// 1.2250 kg/m³, the tabulated value. It is derived from the equation of state
// rather than written down, so that the relative quantities below satisfy
// σ = δ/θ exactly and not to the fourth digit.
export const RHO0 = P0 / (R * T0);

const G = 9.80665; // standard gravity, m/s²
const LAPSE = 0.0065; // temperature lapse rate in the troposphere, K/m

/** The tropopause: above it the standard atmosphere is isothermal. */
export const H_TROPOPAUSE = 11000; // m
const T_TROPOPAUSE = 216.65; // K, −56.5 °C

// Exponent of the barometric formula for a linear temperature profile:
// integrating dP/P = −g·dh/(R·T) with T = T₀ − L·h gives a power law rather
// than an exponential. g/(L·R) = 5.2559.
const BARO_EXP = G / (LAPSE * R);
const P_TROPOPAUSE = P0 * Math.pow(T_TROPOPAUSE / T0, BARO_EXP);

/**
 * Ambient conditions at an altitude.
 *
 * The deviation from standard changes the temperature and hence the density,
 * but **not** the pressure: altitude here is the pressure altitude, the one an
 * altimeter shows, and pressure is what defines it. That is exactly why an
 * engine loses thrust on a hot day - the pressure is the same, the air is
 * simply thinner.
 *
 * @param {number} h altitude, m
 * @param {number} deltaISA deviation of the real day from standard, K
 * @returns {{h:number, tISA:number, t:number, tK:number, p:number, rho:number,
 *            theta:number, delta:number, sigma:number}}
 *   temperatures in °C (`tK` in kelvin), pressure in Pa, density in kg/m³;
 *   `theta`, `delta`, `sigma` are the same quantities relative to sea level -
 *   the form in which they enter the similarity relations.
 */
export function atmosphere(h, deltaISA = 0) {
  let tISA;
  let p;
  if (h <= H_TROPOPAUSE) {
    tISA = T0 - LAPSE * h;
    p = P0 * Math.pow(tISA / T0, BARO_EXP);
  } else {
    // isothermal layer: with T constant the integral gives a plain exponential
    tISA = T_TROPOPAUSE;
    p = P_TROPOPAUSE * Math.exp((-G * (h - H_TROPOPAUSE)) / (R * T_TROPOPAUSE));
  }

  const tK = tISA + deltaISA;
  const rho = p / (R * tK);

  return {
    h,
    tISA: tISA - 273.15,
    t: tK - 273.15,
    tK,
    p,
    rho,
    theta: tK / T0,
    delta: p / P0,
    sigma: rho / RHO0,
  };
}
