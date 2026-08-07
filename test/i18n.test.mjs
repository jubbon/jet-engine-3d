import { readFileSync } from 'node:fs';
import { createI18n, pickLocale } from '../src/i18n.js';
import LOCALES from '../src/locales/index.js';

/* ------------------------------------------------------------------ *
 *  Localisation.
 *
 *  Eight dictionaries drift apart silently: a key added to the English
 *  and forgotten in the other seven costs nothing at build time and
 *  shows up as an English word in the middle of a Japanese panel. So
 *  the checks here are mostly about agreement rather than content -
 *  the same keys everywhere, the same {placeholders} everywhere, and
 *  the English left in index.html saying the same thing as the English
 *  in the dictionary.
 *
 *  Reported in the aggregate on purpose: there are some eighty tagged
 *  elements and a hundred and thirty keys, and a line per key would
 *  bury the other seven test files.
 * ------------------------------------------------------------------ */

let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
};

console.log('\n=== I18N ===');

const TAGS = Object.keys(LOCALES);
const EN = LOCALES.en;
const EN_KEYS = Object.keys(EN);

console.log(`  ${TAGS.length} locales, ${EN_KEYS.length} keys: ${TAGS.join(', ')}`);

/* --------------------------- locale matching -------------------------- */
{
  check('exact tag matches', pickLocale(['ru'], TAGS) === 'ru');
  check('ru-RU falls to ru', pickLocale(['ru-RU'], TAGS) === 'ru');
  // Portugal gets the Brazilian text and Taiwan the Simplified: a script the
  // reader can mostly follow beats dropping them to English
  check('pt-PT falls to pt-BR', pickLocale(['pt-PT'], TAGS) === 'pt-BR');
  check('zh-TW falls to zh-Hans', pickLocale(['zh-TW'], TAGS) === 'zh-Hans');
  check('de-AT falls to de', pickLocale(['de-AT'], TAGS) === 'de');
  check('an unknown language gives English', pickLocale(['sv-SE'], TAGS) === 'en');
  check('an empty list gives English', pickLocale([], TAGS) === 'en');
  check('a missing tag is skipped for the next', pickLocale(['sv-SE', 'de'], TAGS) === 'de');
  check('the reader order is respected', pickLocale(['ja', 'de'], TAGS) === 'ja');
}

/* -------------------------- number formatting ------------------------- */
{
  const i18n = createI18n({ locales: LOCALES, initial: 'en' });
  check('English writes the decimal point', i18n.n(28.4, 1) === '28.4', i18n.n(28.4, 1));
  check('the caller decides the decimals (0)', i18n.n(28.44, 0) === '28', i18n.n(28.44, 0));
  check('the caller decides the decimals (2)', i18n.n(28.4, 2) === '28.40', i18n.n(28.4, 2));

  // T4 reaches 1604 °C. Grouped, that is German "1.604 °C", which reads as a
  // number with a decimal point - so grouping is off everywhere and the
  // figures stay what they were before the panel was localised.
  check('English does not group thousands', i18n.n(1604, 0) === '1604', i18n.n(1604, 0));

  i18n.setLocale('de');
  check('German writes the decimal comma', i18n.n(28.4, 1) === '28,4', i18n.n(28.4, 1));
  check('German does not group thousands', i18n.n(1604, 0) === '1604', i18n.n(1604, 0));
  i18n.setLocale('ru');
  check('Russian writes the decimal comma', i18n.n(28.4, 1) === '28,4', i18n.n(28.4, 1));
  i18n.setLocale('ja');
  check('Japanese writes the decimal point', i18n.n(28.4, 1) === '28.4', i18n.n(28.4, 1));

  check('an unknown tag is refused', (i18n.setLocale('xx'), i18n.locale() === 'ja'));
  check('available() keeps the declared order', i18n.available().join() === TAGS.join());
}

/* ------------------------ tags off the prototype ---------------------- *
 *  These are not a translation problem. A tag inherited from Object.prototype
 *  passes a truthiness test with no dictionary behind it, and two of them make
 *  Intl.NumberFormat throw - out of n(), out of updateGauges, out of the top of
 *  the frame loop, which schedules the next frame only at its bottom. The scene
 *  freezes and stays frozen: the tag is read from localStorage, so a reload
 *  restores the wreck rather than the model.
 * ---------------------------------------------------------------------- */
{
  const INHERITED = ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty'];

  const i18n = createI18n({ locales: LOCALES, initial: 'ja' });
  for (const tag of INHERITED) {
    i18n.setLocale(tag);
    check(`setLocale refuses ${tag}`, i18n.locale() === 'ja', i18n.locale());
  }

  for (const tag of INHERITED) {
    // the localStorage path: whatever is stored is handed straight to createI18n
    const stored = createI18n({ locales: LOCALES, initial: tag });
    check(`a stored ${tag} falls back to English`, stored.locale() === 'en', stored.locale());
    // the check that matters - this is the call that used to take the scene down
    let formatted;
    try {
      formatted = stored.n(1604, 0);
    } catch (e) {
      formatted = `${e.constructor.name}: ${e.message}`;
    }
    check(`a stored ${tag} still formats numbers`, formatted === '1604', formatted);
    check(`a stored ${tag} still translates`, stored.t('panel.h1') === EN['panel.h1']);
  }

  const proto = createI18n({ locales: { en: { k: 'English' } }, initial: 'en' });
  check('an inherited key is not a translation', proto.t('constructor') === 'constructor');
  check('an inherited key does not shadow the fallback', typeof proto.t('toString') === 'string');
}

/* ---------------------------- interpolation --------------------------- */
{
  const probe = createI18n({ locales: { en: { 'x.y': 'a {one} b {two}' } }, initial: 'en' });
  check('placeholders are filled', probe.t('x.y', { one: 1, two: 2 }) === 'a 1 b 2');
  check('an unknown key returns the key', probe.t('no.such') === 'no.such');
  check('a placeholder with no parameter is left alone', probe.t('x.y', { one: 1 }) === 'a 1 b {two}');

  const fb = createI18n({ locales: { en: { k: 'English' }, ru: {} }, initial: 'ru' });
  check('a missing translation falls back to English', fb.t('k') === 'English');
}

/* ------------------------- agreement of the eight --------------------- */
{
  const placeholders = (s) => (String(s).match(/\{(\w+)\}/g) || []).sort().join(',');

  for (const tag of TAGS) {
    const dict = LOCALES[tag];
    const missing = EN_KEYS.filter((k) => !(k in dict));
    const extra = Object.keys(dict).filter((k) => !(k in EN));
    const holes = EN_KEYS.filter((k) => k in dict && placeholders(dict[k]) !== placeholders(EN[k]));
    const empty = Object.keys(dict).filter((k) => !String(dict[k]).trim());
    const untranslated =
      tag === 'en' ? [] : EN_KEYS.filter((k) => k in dict && dict[k] === EN[k]);

    check(`${tag}: no missing keys`, missing.length === 0, missing.join(', '));
    check(`${tag}: no keys we do not know`, extra.length === 0, extra.join(', '));
    // a dropped {margin} leaves a hole in a sentence and nothing else catches it
    check(`${tag}: placeholders intact`, holes.length === 0, holes.join(', '));
    check(`${tag}: no empty values`, empty.length === 0, empty.join(', '));
    if (tag !== 'en') {
      // Not a failure: unit symbols, instrument markings and a few loanwords
      // are the same word in the target language. Printed so an untouched
      // paragraph of English prose cannot hide among them.
      console.log(`      ${tag}: ${untranslated.length} values identical to English`);
    }
  }
}

/* ---------------------- markup agrees with the dictionary ------------- */
{
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const tagged = [...html.matchAll(/<(\w+)[^>]*\sdata-i18n="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g)];

  check('index.html carries data-i18n', tagged.length > 20, `${tagged.length} tagged elements`);

  const unknown = tagged.filter(([, , k]) => !(k in EN)).map(([, , k]) => k);
  check('every tagged key exists in the dictionary', unknown.length === 0, unknown.join(', '));

  /* The markup keeps its English rather than being emptied out, so the file
   * stays readable and the panel is not blank for the tick before the module
   * graph evaluates. That leaves English written twice, and this is what stops
   * the two copies drifting apart - the dictionary is the authority. */
  const mismatched = tagged
    .filter(([, , k, body]) => k in EN && norm(body) !== norm(EN[k]))
    .map(([, , k, body]) => `${k}: markup ${JSON.stringify(norm(body))} vs dictionary ${JSON.stringify(norm(EN[k]))}`);
  check('the English in the markup matches the dictionary', mismatched.length === 0, mismatched.join('; '));

  /* applyStatic assigns textContent, so a data-i18n sitting on a parent with
   * children would silently delete them. That is why the legend rows are split
   * into a bold name and a separate span; forbidding the shape is cheaper than
   * detecting the damage afterwards. */
  const nested = tagged.filter(([, , , body]) => /</.test(body)).map(([, , k]) => k);
  check('no tagged element contains child tags', nested.length === 0, nested.join(', '));

  const dup = tagged.map(([, , k]) => k).filter((k, i, a) => a.indexOf(k) !== i);
  check('no key is tagged twice', dup.length === 0, dup.join(', '));
}

console.log(failures ? `\n${failures} checks failed\n` : '\nall checks passed\n');
process.exit(failures ? 1 : 0);
