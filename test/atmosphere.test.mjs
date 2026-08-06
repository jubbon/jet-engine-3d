import { atmosphere, H_TROPOPAUSE, P0, RHO0 } from '../src/atmosphere.js';

/* ------------------------------------------------------------------ *
 *  The standard atmosphere is one of the few things in this model with
 *  a published answer, so the check is against the ISA table rather
 *  than against itself: altitude, temperature, pressure and density at
 *  the round levels, and the join at the tropopause where the formula
 *  changes shape.
 *
 *  The table is ISO 2533 / US Standard Atmosphere 1976. The tolerance
 *  is 0.2 %: the published density is computed with a slightly
 *  different gas constant, and the discrepancy shows up in the fourth
 *  digit.
 * ------------------------------------------------------------------ */

let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
};
const near = (a, b, rel = 0.002) => Math.abs(a - b) <= Math.abs(b) * rel;

console.log('\n=== STANDARD ATMOSPHERE ===');

/* ---------------------------- the ISA table --------------------------- */
// altitude, m | temperature, °C | pressure, Pa | density, kg/m³
const TABLE = [
  [0, 15.0, 101325, 1.2250],
  [1000, 8.5, 89874, 1.1117],
  [5000, -17.5, 54020, 0.73643],
  [H_TROPOPAUSE, -56.5, 22632, 0.36392],
  [12000, -56.5, 19330, 0.31083],
];

for (const [h, t, p, rho] of TABLE) {
  const a = atmosphere(h);
  const km = (h / 1000).toFixed(0);
  check(`${km} km: temperature ${t} °C`, Math.abs(a.t - t) < 0.06, `${a.t.toFixed(2)} °C`);
  check(`${km} km: pressure ${(p / 1000).toFixed(1)} kPa`, near(a.p, p), `${(a.p / 1000).toFixed(2)} kPa`);
  check(`${km} km: density ${rho} kg/m³`, near(a.rho, rho), `${a.rho.toFixed(4)} kg/m³`);
}

/* --------------------------- the tropopause --------------------------- */
// Above 11 km the power law gives way to an exponential; the two branches
// must meet, otherwise the panel would jump as the slider crosses the level.
{
  const below = atmosphere(H_TROPOPAUSE - 1);
  const above = atmosphere(H_TROPOPAUSE + 1);
  // A metre either side of the level the pressures must not simply be close
  // but differ by exactly the weight of the air between them, ρ·g·Δh — that
  // is what makes the join smooth rather than merely small.
  const hydrostatic = 2 * atmosphere(H_TROPOPAUSE).rho * 9.80665;
  check(
    'the two branches join at the tropopause',
    near(below.p - above.p, hydrostatic, 0.01),
    `the step is ${(below.p - above.p).toFixed(2)} Pa against ρ·g·Δh = ${hydrostatic.toFixed(2)} Pa`
  );
  check(
    'above the tropopause the temperature stops falling',
    atmosphere(12000).t === atmosphere(20000).t,
    `${atmosphere(20000).t.toFixed(1)} °C`
  );
}

/* ------------------------- monotonic with height ---------------------- */
{
  let mono = true;
  let prev = atmosphere(0);
  for (let h = 250; h <= 12000; h += 250) {
    const a = atmosphere(h);
    if (a.p >= prev.p || a.rho >= prev.rho) mono = false;
    prev = a;
  }
  check('pressure and density fall over the whole range', mono);

  const cruise = atmosphere(11000);
  console.log(
    `  at 11 km: ${cruise.t.toFixed(1)} °C, ${(cruise.p / 1e5).toFixed(3)} bar, ` +
      `${cruise.rho.toFixed(3)} kg/m³ — the air is ${(1 / cruise.sigma).toFixed(2)} times thinner than at sea level`
  );
  check('at cruise altitude the air is about three times thinner', 1 / cruise.sigma > 3 && 1 / cruise.sigma < 3.6);
}

/* ---------------------------- a real day ------------------------------ */
// A deviation from standard moves the temperature and the density but leaves
// the pressure alone: the altitude here is the pressure altitude. That is the
// whole point of the slider - it shows why thrust is lost in the heat.
{
  const std = atmosphere(0);
  const hot = atmosphere(0, 15);
  const cold = atmosphere(0, -20);
  check('a hot day does not change the pressure', hot.p === std.p, `${(hot.p / 1e5).toFixed(3)} bar`);
  check('+15 °C from standard gives 30 °C', Math.abs(hot.t - 30) < 1e-9, `${hot.t.toFixed(1)} °C`);
  check(
    'in the heat the air is thinner by about 5 %',
    near(hot.rho / std.rho, 0.951, 0.005),
    `${(100 * (1 - hot.rho / std.rho)).toFixed(1)} %`
  );
  check('in the cold the air is denser', cold.rho > std.rho, `${cold.rho.toFixed(3)} kg/m³`);

  const hotCruise = atmosphere(11000, 10);
  check(
    'the deviation works at altitude as well',
    Math.abs(hotCruise.t - -46.5) < 1e-9 && hotCruise.p === atmosphere(11000).p,
    `${hotCruise.t.toFixed(1)} °C`
  );
}

/* ------------------------- the relative form -------------------------- */
// σ = δ/θ is the equation of state written in relative quantities; the
// similarity relations of a full altitude recomputation are built on them.
{
  let ok = true;
  for (let h = 0; h <= 12000; h += 500) {
    for (const d of [-20, 0, 15]) {
      const a = atmosphere(h, d);
      if (Math.abs(a.sigma - a.delta / a.theta) > 1e-12) ok = false;
    }
  }
  check('the relative quantities are consistent: σ = δ/θ', ok);

  const sea = atmosphere(0);
  check(
    'at sea level on a standard day all three are unity',
    Math.abs(sea.theta - 1) < 1e-12 && sea.delta === 1 && near(sea.sigma, 1, 1e-4),
    `θ=${sea.theta.toFixed(4)} δ=${sea.delta.toFixed(4)} σ=${sea.sigma.toFixed(4)}`
  );
  check('sea level agrees with the exported constants', sea.p === P0 && near(sea.rho, RHO0));
}

console.log(failures ? `\n${failures} checks failed\n` : '\nall checks passed\n');
process.exit(failures ? 1 : 0);
