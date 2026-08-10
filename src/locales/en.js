/* The source dictionary. Every other locale is a translation of this file and
 * must carry exactly these keys and exactly these {placeholders} - both are
 * checked by test/i18n.test.mjs.
 *
 * Unit symbols are left alone on purpose: °C, bar, kN, km, rpm, %, Pa, Pa/K
 * and kg/m³ are international designations that aviation documentation keeps
 * in Latin in every one of these eight languages. Translating them would make
 * the panel harder to read, not easier. The same goes for the instrument
 * markings N1, N2, T4, G and ISA. */

export default {
  /* ------------------------------ shell ------------------------------- */
  'app.title': 'Turbofan engine — interactive 3D model',
  'app.loading': 'Assembling the engine…',
  'panel.h1': 'Turbofan engine',
  'panel.sub': 'High-bypass turbofan · interactive model',

  /* --------------------------- big buttons ---------------------------- */
  'panel.flow.title': 'Air flows',
  'panel.flow.hint': 'cold bypass duct and hot jet',
  'panel.cut.title': 'Look inside',
  'panel.cut.hint': 'cut-away casing, view of the rotor',
  'panel.sound.title': 'Engine sound',
  'panel.sound.hint': 'synthesised from N1 and N2',
  'panel.volume': 'Volume',

  /* ------------------------- power and state -------------------------- */
  'power.start': 'Start engine',
  'power.shutdown': 'Shut down engine',
  'power.hint.starting': 'starter cranking, light-off…',
  'power.hint.stopping': 'fuel cut, rotors coasting down…',
  'power.hint.running': 'fuel shut-off, rotor rundown',
  'power.hint.off': 'starter, light-off, acceleration to idle',
  'mode.off': 'SHUT DOWN',
  'mode.start': 'STARTING',
  'mode.run': 'RUNNING',
  'mode.stop': 'SHUTDOWN · RUNDOWN',
  'panel.state': 'State',
  'panel.timescale': 'Time scale',
  'panel.throttle': 'Engine power (throttle)',
  'panel.rev.title': 'Thrust reverser',
  'panel.reverser': 'Reverser',
  'rev.stowed': 'STOWED',
  'rev.deploying': 'DEPLOYING',
  'rev.deployed': 'DEPLOYED',
  'rev.stowing': 'STOWING',
  'rev.hint.deploy': 'the sleeve slides aft, the doors close the bypass duct',
  'rev.hint.stow': 'the doors open, the sleeve slides home',
  'rev.hint.moving': 'the sleeve is moving, the engine is held at idle',
  'rev.hint.off': 'the engine must be running',

  /* ------------------------------ gauges ------------------------------ */
  'gauge.n1.sub': 'fan',
  'gauge.n2.sub': 'HP rotor',
  'gauge.t4.sub': 'ahead of HPT',
  'gauge.thrust.label': 'Thrust',
  'gauge.thrust.sub': 'computed',

  /* ------------------------ ambient conditions ------------------------ */
  'amb.title': 'Ambient conditions',
  'amb.altitude': 'Altitude',
  'amb.isa': 'Deviation from standard',
  'amb.rh': 'Relative humidity',
  'amb.t.sub': 'outside air',
  'amb.td.sub': 'dew point',
  'amb.e.sub': 'vapour, Pa',
  'amb.rhi.sub': 'over ice',

  /* ----------------------------- contrail ----------------------------- */
  'trail.title': 'Contrail',
  'trail.eta': 'Propulsive efficiency',
  'trail.tform.sub': 'forms below',
  'trail.tmix.sub': 'at the nozzle',
  'verdict.none': 'NO TRAIL',
  'verdict.short-lived': 'SHORT-LIVED',
  'verdict.persistent': 'PERSISTENT',

  /* The explanation is three whole sentences rather than glued fragments:
   * word order differs across the eight languages, and a clause that reads
   * correctly in English may have no grammatical position in Japanese. The
   * one remaining seam, {where}, falls on a sentence boundary, which is safe
   * everywhere. */
  'hint.trail.persistent':
    'The air is {margin} °C below the threshold, so a trail forms; it is supersaturated over ice, so the trail spreads instead of evaporating. {where}.',
  'hint.trail.shortLived':
    'The air is {margin} °C below the threshold, so a trail forms; over ice it is not saturated, so the crystals evaporate within seconds. {where}.',
  'hint.trail.none': 'The air is {margin} °C above the threshold — no trail. {where}.',

  'where.higher.stop': '{km} km higher it would stop',
  'where.lower.stop': '{km} km lower it would stop',
  'where.higher.start': '{km} km higher it would start',
  'where.lower.start': '{km} km lower it would start',
  // {max} is H_MAX from contrail.js, not prose: left as a literal it would
  // become eight copies of a code constant and go stale the moment the search
  // ceiling moved.
  'where.nowhere': 'Nowhere between the ground and {max} km would this air behave differently',

  /* ------------------------ cutaway and explode ----------------------- */
  'cut.angle': 'Cut-away angle',
  'cut.rotation': 'Cut-away rotation',
  'explode.label': 'Explode modules',

  /* ----------------------------- toggles ------------------------------ */
  'toggle.xray': 'Transparent casings',
  'toggle.nacelle': 'Nacelle',
  'toggle.labels': 'Module labels',
  'toggle.lines': 'Streamlines',
  'toggle.haze': 'Exhaust gas',
  'toggle.trail': 'Contrail',
  'toggle.spin': 'Rotor rotation',
  'toggle.orbit': 'Camera orbit',

  /* The key letters are not translated - they stay bound to the English
   * mnemonics, and only the explanations around them are localised. The
   * handler matches on the character produced (see the keydown listener in
   * main.js), so every language with its own mnemonics would need its own list
   * of characters added there; zh-Hans and ja have no letter to be mnemonic
   * with at all, since input goes through an IME. One layout for everyone also
   * keeps muscle memory and screenshots portable between languages. */
  'footer.mouse': 'LMB — orbit · wheel — zoom · RMB — pan',
  'footer.keys1': 'Space — flows · C — cutaway · X — x-ray · S — sound',
  'footer.keys2': 'E — start/shutdown · R — reverser · H — exhaust · T — contrail',
  'footer.keys3': '1…9, 0 — views',

  /* ------------------------------ legend ------------------------------ */
  // The leading space and the dash belong to the string: whether a dash is
  // the right separator at all is a typographic decision that differs by
  // language.
  'legend.title': 'Flows',
  'legend.bypass.name': 'Bypass duct',
  'legend.bypass.text': ' — cold air, ~15…50 °C at sea level. Up to 80 % of the thrust.',
  'legend.compression.name': 'Compression',
  'legend.compression.text': ' — air is heated to 600 °C in the compressor.',
  'legend.combustion.name': 'Combustion',
  'legend.combustion.text': ' — 1800…2000 °C in the flame tube.',
  'legend.jet.name': 'Hot jet',
  'legend.jet.text': ' — expansion through the turbine and nozzle, 550 °C.',

  /* ----------------------------- stations ----------------------------- */
  'stations.head.station': 'station',
  'stations.head.t': 'T, °C',
  'stations.head.p': 'P, bar',
  'station.intake': 'Intake',
  'station.bypass': 'Bypass duct',
  'station.booster': 'After booster',
  'station.hpc': 'After HPC',
  'station.combustor': 'Combustor',
  'station.hpt': 'After HPT',
  'station.nozzle': 'Nozzle exit',

  /* ---------------------------- camera views -------------------------- */
  'view.overview': 'Overview',
  'view.cutaway': 'Cutaway',
  'view.front': 'Front',
  'view.fan': 'Fan',
  'view.hpc': 'HP compressor',
  'view.combustor': 'Combustor',
  'view.turbine': 'Turbine',
  'view.nozzle': 'Nozzle and jet',
  'view.behind': 'From behind, in the gas stream',
  'view.contrail': 'Contrail',

  /* ---------------------------- 3D labels ----------------------------- */
  'label.nacelle': 'Nacelle',
  'label.reverser': 'Reverser',
  'label.fan': 'Fan',
  'label.booster': 'Booster',
  'label.hpc': 'HPC',
  'label.combustor': 'Combustor',
  'label.hpt': 'HPT',
  'label.lpt': 'LPT',
  'label.nozzle': 'Nozzle',
  'label.shafts': 'LP / HP shafts',
  'label.accessory': 'Accessory gearbox',

  /* --------------------------- module cards --------------------------- */
  'module.nacelle.title': 'Nacelle and air intake',
  'module.nacelle.info':
    'Intake barrel with anti-icing, fan cowls and the bypass duct. Largest dimension 2.44 m, length to the fan nozzle exit 3.18 m. The bottom and the lip are flattened (the "hamster pouch"): the 737 wing sits low above the ground.',
  'module.reverser.title': 'Thrust reverser',
  'module.reverser.info':
    'Cascade reverser of the bypass duct. The sleeve slides 0.45 m aft, uncovering the turning vanes, and twelve blocker doors swing across the duct - dragged round by links to the fixed wall, not driven, so they close only towards the end of the travel. The core stream is untouched: only the fan air is turned, and it gives about a fifth of take-off thrust in reverse.',
  'module.fan.title': 'Fan (N1)',
  'module.fan.info':
    '24 wide-chord blades, largest chord 0.279 m. Diameter 1.549 m, 5175 rpm at take-off power. Produces up to 80 % of the thrust by driving air into the bypass duct. Bypass ratio 5.1.',
  'module.booster.title': 'Booster, LP compressor (N1)',
  'module.booster.info':
    'Low-pressure compressor: 3 stages on the fan shaft. It raises the core air to about 2.5 bar ahead of the HP compressor.',
  'module.hpc.title': 'High-pressure compressor (N2)',
  'module.hpc.info':
    '9 stages. It compresses the air by a factor of about 11; together with the fan and the booster that gives an overall pressure ratio of about 28 and heating to 550-600 °C. Some of the air is bled off for turbine cooling and air conditioning.',
  'module.combustor.title': 'Combustor',
  'module.combustor.info':
    'Annular chamber with 20 fuel nozzles. Fuel burns at 1800-2000 °C; air from the HP compressor film-cools the flame tube. Only about 25 % of the air takes part in combustion, the rest is cooling and dilution.',
  'module.hpt.title': 'High-pressure turbine (N2)',
  'module.hpt.info':
    '1 stage. Single-crystal blades with internal air cooling and a ceramic coating work in gas at 1500 °C - above the melting point of the alloy. One stage is enough because it takes a large pressure drop at a high blade speed: it drives the HP compressor at about 14 500 rpm.',
  'module.lpt.title': 'Low-pressure turbine (N1)',
  'module.lpt.info':
    '4 large-diameter stages. It extracts the remaining energy from the gas and drives the fan and the booster through a long shaft (5175 rpm at take-off power).',
  'module.exhaust.title': 'Turbine rear frame and core nozzle',
  'module.exhaust.info':
    'The struts of the rear frame carry the LP shaft bearing and straighten the swirl out of the gas. The plug shapes the nozzle; the jet leaves at 400-500 m/s and 550-600 °C.',
  'module.cowl.title': 'Inner wall of the bypass duct',
  'module.cowl.info':
    'The wall separating the cold bypass duct from the hot core. Inside it sit the accessories, the pipework and the thermal insulation.',
  'module.shafts.title': 'Rotor shafts',
  'module.shafts.info':
    'Two coaxial shafts: the LP shaft (fan + booster + LP turbine) runs inside the hollow HP shaft (HP compressor + HP turbine). The rotors turn independently at different speeds.',
  'module.accessory.title': 'Accessory gearbox and accessories',
  'module.accessory.info':
    'A bevel drive off the HP shaft powers the fuel and oil pumps, the generators and the starter. The bleed air pipework and the FADEC units live here too. On the 737 the gearbox is moved from underneath the engine to the side - which is what allowed the bottom of the nacelle to be flattened.',

  /* ------------------------ compressor stability ---------------------- */
  'panel.stability': 'Stability',
  'panel.sm': 'Surge margin',
  'surge.clear': 'STABLE',
  'surge.surging': 'SURGE',
  'surge.stall': 'STALLED',
  'surge.hint.clear': 'The compressor is working inside its margin. Flick the throttle from idle to the stop and it will not be: fuel arrives in a fraction of a second, the rotor takes seconds, and for the interval between them the burner is fed for a speed the compressor has not reached.',
  'surge.hint.surging': 'The flow has broken down and the gas is being expelled forward through the intake, several times a second. Pull the throttle back now and it will recover; hold it up and it will lock.',
  'surge.hint.stall': 'A locked stall: the spools hang, the gas path is cooking and the thrust is gone. No throttle movement will clear it — only a shutdown.',
  'surge.hint.off': 'the engine must be running',

  /* --------------------------- compressor map -------------------------- */
  'map.title': 'Compressor map',
  'map.line.surge': 'surge line',
  'map.line.working': 'working line',
  'map.line.point': 'operating point',
  'map.axis.pr': '↑ pressure ratio',
  'map.axis.flow': 'corrected flow →',
  'map.caveat': 'The surge line is a table of plausible values, not a computation — the model solves no gas dynamics.',
};
