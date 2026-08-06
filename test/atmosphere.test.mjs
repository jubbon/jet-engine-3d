import { atmosphere, humidity, eSatWater, eSatIce, H_TROPOPAUSE, P0, RHO0 } from '../src/atmosphere.js';

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

/* ---------------------------- water vapour ---------------------------- */
// The Magnus formula is an approximation of tabulated data, and the table is
// again the yardstick. The tolerance is 0.5 %: the Alduchov - Eskridge
// coefficients claim 0.4 % over water, and the published values themselves
// differ in the third digit from source to source.
{
  // temperature, °C | saturation over water, Pa
  const WATER = [
    [-20, 125.40],
    [0, 611.21],
    [10, 1228.1],
    [20, 2338.8],
    [30, 4245.5],
  ];
  for (const [t, e] of WATER) {
    check(`saturation over water at ${t} °C is ${e} Pa`, near(eSatWater(t), e, 0.005), `${eSatWater(t).toFixed(1)} Pa`);
  }

  // temperature, °C | saturation over ice, Pa
  const ICE = [
    [0, 611.21],
    [-20, 103.24],
    [-40, 12.83],
  ];
  for (const [t, e] of ICE) {
    check(`saturation over ice at ${t} °C is ${e} Pa`, near(eSatIce(t), e, 0.005), `${eSatIce(t).toFixed(2)} Pa`);
  }

  check('at zero the two curves meet', near(eSatIce(0), eSatWater(0), 0.001));

  // The gap between the curves is what a contrail lives on, and it must widen
  // monotonically as it gets colder - otherwise the ice supersaturation below
  // would be an artefact of the fit rather than physics.
  let widening = true;
  let prev = 1;
  for (let t = -1; t >= -70; t--) {
    const ratio = eSatIce(t) / eSatWater(t);
    if (ratio >= prev) widening = false;
    prev = ratio;
  }
  check('below zero ice saturates lower, and ever lower with cold', widening, `at −40 °C the ratio is ${(eSatIce(-40) / eSatWater(-40)).toFixed(3)}`);
}

/* -------------------- humidity of the ambient air --------------------- */
{
  const dry = humidity(15, 0);
  check('dry air has no vapour and no dew point', dry.e === 0 && dry.dewPoint === null);
  check('in dry frost there is no vapour over ice either', humidity(-20, 0).rhIce === 0);

  // Above zero the ice curve runs above the water one - it is a formula
  // extrapolated past the substance it describes, and saturated air would come
  // out at 86 % "over ice". The ratio must not be reported there at all.
  check('above freezing there is no saturation over ice', humidity(15, 1).rhIce === null);
  check(
    'and the extrapolated curve is indeed the wrong way round',
    eSatIce(15) > eSatWater(15),
    `${eSatIce(15).toFixed(0)} against ${eSatWater(15).toFixed(0)} Pa`
  );
  check('just below zero it is reported again', humidity(-0.5, 1).rhIce > 1);

  const sat = humidity(15, 1);
  check('at 100 % the dew point is the air temperature', Math.abs(sat.dewPoint - 15) < 0.02, `${sat.dewPoint.toFixed(3)} °C`);

  // the dew point is the Magnus formula inverted, so it must invert it
  let roundTrip = true;
  for (const t of [-40, -10, 0, 15, 35]) {
    if (Math.abs(humidity(t, 1).dewPoint - t) > 0.02) roundTrip = false;
  }
  check('the dew point inverts the saturation curve at any temperature', roundTrip);

  const damp = humidity(15, 0.6);
  check('below saturation the dew point is lower than the air', damp.dewPoint < 15, `${damp.dewPoint.toFixed(1)} °C at 60 %`);
  check(
    'drying the air lowers the dew point',
    humidity(15, 0.3).dewPoint < damp.dewPoint && damp.dewPoint < humidity(15, 0.9).dewPoint
  );

  // The point of carrying humidity at all: at cruise level, air that a
  // hygrometer would call far from saturated is already supersaturated over
  // ice - the condition in which a contrail spreads instead of evaporating.
  const cruise = atmosphere(11000);
  const h = humidity(cruise.t, 0.6);
  console.log(
    `  at 11 km and 60 % over water: vapour ${h.e.toFixed(2)} Pa, ` +
      `dew point ${h.dewPoint.toFixed(1)} °C, over ice ${(100 * h.rhIce).toFixed(0)} %`
  );
  check('60 % over water at cruise level is supersaturation over ice', h.rhIce > 1, `${(100 * h.rhIce).toFixed(0)} %`);
  check('and 50 % is not yet', humidity(cruise.t, 0.5).rhIce < 1, `${(100 * humidity(cruise.t, 0.5).rhIce).toFixed(0)} %`);
}

console.log(failures ? `\n${failures} checks failed\n` : '\nall checks passed\n');
process.exit(failures ? 1 : 0);
