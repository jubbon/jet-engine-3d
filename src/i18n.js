/* Localisation: lookup, interpolation, number formatting and locale matching.
 *
 * Like engineState, atmosphere and contrail, this file knows nothing about
 * Three.js or the DOM. The reason is the same one that put those on the
 * headless side: a headless browser renders this scene on a software
 * rasteriser at about 1 fps, so anything that has to be tested has to run
 * under Node. Key parity across eight dictionaries is exactly the kind of
 * thing that rots in silence, and it is testable only because nothing here
 * needs a browser. */

/**
 * Match the reader's languages against the dictionaries we actually have.
 *
 * Exact tag first, then language-only, walking the reader's list in their own
 * order of preference. Language-only is what sends a Portuguese reader to the
 * Brazilian text and a Traditional Chinese reader to the Simplified one -
 * a script they can mostly follow beats falling back to English.
 */
export function pickLocale(preferred, available) {
  for (const want of preferred || []) {
    const tag = String(want).toLowerCase();
    const lang = tag.split('-')[0];
    const hit =
      available.find((a) => a.toLowerCase() === tag) ||
      available.find((a) => a.toLowerCase().split('-')[0] === lang);
    if (hit) return hit;
  }
  return 'en';
}

export function createI18n({ locales, initial }) {
  let current = locales[initial] ? initial : 'en';

  /* Intl.NumberFormat is expensive to construct, and updateGauges formats
   * nineteen numbers per call straight out of the frame loop - four gauges,
   * the mixed exhaust temperature and seven stations at two columns each. Its
   * hash guard skips the quiet frames but not the transients, which are
   * precisely the frames that matter while the engine is spooling up. So the
   * formatters are built once per digit count and discarded only when the
   * language changes. */
  let formatters = new Map();

  /**
   * Look up a key and fill in {named} placeholders.
   *
   * Falls back to English and then to the key itself. That is defensive only:
   * the parity check in test/i18n.test.mjs makes a missing key a test failure,
   * so this should never fire. It stays silent rather than throwing because a
   * missing string must not take the whole scene down.
   */
  const t = (key, params) => {
    const raw = locales[current]?.[key] ?? locales.en?.[key] ?? key;
    if (!params) return raw;
    return raw.replace(/\{(\w+)\}/g, (whole, name) =>
      Object.prototype.hasOwnProperty.call(params, name) ? params[name] : whole
    );
  };

  /* The caller always chooses the number of decimals; this never infers it.
   * Two call sites vary the count by magnitude and must keep doing so -
   * vapour pressure runs from thousands of pascals to units of them, and the
   * station table needs two decimals below 10 bar so the intake row does not
   * collapse to a flat "0.2" at altitude. */
  const n = (value, digits) => {
    let f = formatters.get(digits);
    if (!f) {
      f = new Intl.NumberFormat(current, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
        /* No thousands separator. Only the decimal separator is what differs
         * between these languages in a way a reader would notice; grouping
         * would turn a T4 of 1604 °C into German "1.604 °C", which reads as a
         * number with a decimal point. The one four-digit read-out on the
         * panel is not worth that risk, and it also keeps the figures
         * identical to what the model printed before it was localised. */
        useGrouping: false,
      });
      formatters.set(digits, f);
    }
    return f.format(value);
  };

  return {
    t,
    n,
    locale: () => current,
    // Declared order, taken from src/locales/index.js: this is the order the
    // switcher shows, and it must not reshuffle when the language changes.
    available: () => Object.keys(locales),
    setLocale(tag) {
      if (!locales[tag]) return;
      current = tag;
      formatters = new Map();
    },
  };
}
