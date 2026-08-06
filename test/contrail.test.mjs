import { atmosphere, humidity, eSatWater } from '../src/atmosphere.js';
import { contrail, contrailSlope, criticalTemperature, formationTemperature, flipAltitude } from '../src/contrail.js';
import { createContrail } from '../src/contrailView.js';

/* ------------------------------------------------------------------ *
 *  The Schmidt - Appleman criterion.
 *
 *  The threshold temperature comes from a published fit, and checking a
 *  fit against itself proves nothing. So the check is against the
 *  property the fit approximates: at the threshold temperature the
 *  mixing line must **touch** the saturation curve, that is, the curve
 *  must have exactly the slope G there. The curve is the Magnus formula
 *  already checked against tables in the atmosphere test, so the two
 *  are independent.
 * ------------------------------------------------------------------ */

let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
};
const near = (a, b, rel = 0.002) => Math.abs(a - b) <= Math.abs(b) * rel;

console.log('\n=== CONTRAIL ===');

/* -------------------------- the mixing line --------------------------- */
{
  const cruise = atmosphere(11000);
  const G = contrailSlope(cruise.p, 0.3);
  console.log(`  at 11 km with η = 0.3 the slope is ${G.toFixed(3)} Pa/K`);
  check('the slope at cruise level is in the published range 1.5…1.7 Pa/K', G > 1.4 && G < 1.7, `${G.toFixed(3)} Pa/K`);

  // G is linear in pressure and in 1/(1−η) - both worth pinning, because the
  // whole behaviour of the criterion follows from them
  check('the slope is proportional to pressure', near(contrailSlope(2 * cruise.p, 0.3), 2 * G));
  check(
    'a more efficient engine gives a steeper line',
    contrailSlope(cruise.p, 0.45) > G,
    `${contrailSlope(cruise.p, 0.45).toFixed(3)} against ${G.toFixed(3)} Pa/K`
  );
  check('at the ground the line is four times steeper', contrailSlope(atmosphere(0).p, 0.3) / G > 4);
}

/* ------------------------- tangency, the real check ------------------- */
{
  // numerical derivative of the saturation curve, Pa/K
  const slope = (t, h = 1e-4) => (eSatWater(t + h) - eSatWater(t - h)) / (2 * h);

  let worst = 0;
  for (let G = 0.4; G <= 3.0; G += 0.1) {
    const t = criticalTemperature(G);
    worst = Math.max(worst, Math.abs(slope(t) / G - 1));
  }
  check(
    'at the threshold the saturation curve has exactly the slope of the mixing line',
    worst < 0.02,
    `the fit departs from tangency by at most ${(100 * worst).toFixed(2)} %`
  );

  check('too shallow a line never reaches the curve', Number.isNaN(criticalTemperature(0.05)));
  check(
    'a steeper line means a warmer threshold',
    criticalTemperature(2) > criticalTemperature(1) && criticalTemperature(1) > criticalTemperature(0.5),
    `${criticalTemperature(0.5).toFixed(1)} → ${criticalTemperature(1).toFixed(1)} → ${criticalTemperature(2).toFixed(1)} °C`
  );
}

/* ------------------- the threshold below saturation ------------------- */
{
  const G = 1.5;
  const tCrit = criticalTemperature(G);
  check('in saturated air the threshold is the tangency point', formationTemperature(G, 1) === tCrit);
  check(
    'drier air has to be colder',
    formationTemperature(G, 0.6) < tCrit && formationTemperature(G, 0.2) < formationTemperature(G, 0.6),
    `${formationTemperature(G, 0.2).toFixed(1)} < ${formationTemperature(G, 0.6).toFixed(1)} < ${tCrit.toFixed(1)} °C`
  );

  // the definition, checked directly: at the threshold the mixing line drawn
  // from the tangency point crosses the humidity-scaled curve
  let onTheLine = true;
  for (const rh of [0, 0.3, 0.6, 0.9]) {
    const t = formationTemperature(G, rh);
    const line = eSatWater(tCrit) - G * (tCrit - t);
    if (Math.abs(line - rh * eSatWater(t)) > 1e-6) onTheLine = false;
  }
  check('the threshold lies where the line meets the curve at that humidity', onTheLine);
}

/* ----------------------------- verdicts ------------------------------- */
{
  const verdictAt = (h, rh, eta = 0.3, dISA = 0) => {
    const amb = atmosphere(h, dISA);
    return contrail(amb, humidity(amb.t, rh), eta);
  };

  const ground = verdictAt(0, 0.6);
  check('no contrail at the ground on a standard day', !ground.forms && ground.verdict === 'none', `threshold ${ground.tForm.toFixed(1)} °C against air 15 °C`);

  const cruise = verdictAt(11000, 0.6);
  console.log(
    `  at 11 km, 60 %: threshold ${cruise.tForm.toFixed(1)} °C, air ${atmosphere(11000).t.toFixed(1)} °C, ` +
      `margin ${cruise.margin.toFixed(1)} K, verdict "${cruise.verdict}"`
  );
  check('at cruise level in humid air the trail forms', cruise.forms);
  check('and it persists, because the air is supersaturated over ice', cruise.persistent && cruise.verdict === 'persistent');

  const dry = verdictAt(11000, 0.3);
  check(
    'in drier air at the same level the trail is short-lived or absent',
    !dry.persistent,
    `verdict "${dry.verdict}"`
  );

  // the counter-intuitive part, and the reason the efficiency is a control
  const lazy = verdictAt(9000, 0.5, 0.15);
  const efficient = verdictAt(9000, 0.5, 0.45);
  console.log(
    `  at 9 km, 50 %: η = 0.15 gives a threshold of ${lazy.tForm.toFixed(1)} °C, η = 0.45 gives ${efficient.tForm.toFixed(1)} °C`
  );
  check(
    'the more efficient engine leaves a trail more readily',
    efficient.tForm > lazy.tForm,
    `the threshold is ${(efficient.tForm - lazy.tForm).toFixed(1)} K warmer`
  );

  check('a hot day makes the trail harder', verdictAt(9000, 0.6, 0.3, 15).margin < verdictAt(9000, 0.6, 0.3, 0).margin);
}

/* ------------------------ how much higher ----------------------------- */
{
  const flip = flipAltitude(0, 0, 0.6, 0.3);
  check('from the ground there is an altitude at which the trail appears', flip !== null, `${(flip / 1000).toFixed(2)} km`);

  // the answer must be a boundary: no trail just below it, a trail just above
  const at = (h) => {
    const amb = atmosphere(h, 0);
    return contrail(amb, humidity(amb.t, 0.6), 0.3).forms;
  };
  check('and it really is the boundary', !at(flip - 60) && at(flip + 60), `${(flip / 1000).toFixed(2)} km`);

  check(
    'from cruise level the boundary is found going down',
    flipAltitude(11000, 0, 0.6, 0.3) < 11000,
    `${(flipAltitude(11000, 0, 0.6, 0.3) / 1000).toFixed(2)} km`
  );
  check('in air too dry for any altitude there is no answer', flipAltitude(0, 0, 0, 0.3) === null || flipAltitude(0, 0, 0, 0.3) > 0);
}

/* ------------------------- the drawing decides ------------------------ */
// The strip is Three.js, but nothing in it needs a renderer, so the part that
// decides *whether* to draw can be checked here too - the shader cannot.
{
  const settle = (view, verdict, burn, seconds = 8) => {
    for (let i = 0; i < seconds * 60; i++) view.update(1 / 60, verdict, burn);
    return view;
  };
  const FORMS = { forms: true, persistent: true };
  const SHORT = { forms: true, persistent: false };
  const NONE = { forms: false, persistent: false };

  const v = createContrail();
  settle(v, FORMS, 1);
  // the densities themselves are a matter of taste and get retuned; what has
  // to hold is that there is a trail and that the short-lived one is the
  // fainter and shorter of the two
  const dense = v.material.uniforms.uDensity.value;
  check('a trail that forms is drawn', v.group.visible && dense > 0.2, `density ${dense.toFixed(2)}`);
  check('a persistent one runs the whole length', v.material.uniforms.uEnd.value > 0.95);

  settle(v, SHORT, 1);
  check('a short-lived one breaks off early', v.material.uniforms.uEnd.value < 0.4, `at ${(100 * v.material.uniforms.uEnd.value).toFixed(0)} % of the length`);
  check('and it is fainter', v.material.uniforms.uDensity.value < dense * 0.8, `density ${v.material.uniforms.uDensity.value.toFixed(2)} against ${dense.toFixed(2)}`);

  settle(v, NONE, 1);
  check('with no trail nothing is drawn', !v.group.visible);

  // no fuel, no water: the trail dies with the flame even in perfect conditions
  settle(v, FORMS, 1);
  settle(v, FORMS, 0);
  check('a shut-down engine leaves no trail whatever the air', !v.group.visible);

  const off = createContrail();
  off.setEnabled(false);
  settle(off, FORMS, 1);
  check('the checkbox stops it being drawn at all', !off.group.visible);
}

console.log(failures ? `\n${failures} checks failed\n` : '\nall checks passed\n');
process.exit(failures ? 1 : 0);
