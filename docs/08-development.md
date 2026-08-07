# 08. Development

## Running

```bash
npm install
npm run dev      # http://localhost:5188, listens on 0.0.0.0
npm run build    # build into dist/
npm run preview  # preview the built version
npm test         # state machine, exhaust gas, spiral smear, atmosphere,
                 # contrail, dimensions against the reference, clearances
```

Dependencies: `three` (runtime) and `vite` (build). There are no external assets
at all — no models, no textures, no sound files: all geometry is built in code,
reflections come from the procedural `RoomEnvironment`, the sound is
synthesised.

The server binds to `0.0.0.0`, so it is reachable from the local network without
authentication. Handy for showing colleagues, but on an untrusted network the
port is better closed.

## Build size

```
dist/index.html                12.3 kB  (3.5 kB gzip)
dist/assets/index-*.css         8.1 kB  (2.4 kB gzip)
dist/assets/index-*.js        731 kB  (198 kB gzip)
```

The Vite warning about a chunk larger than 500 kB refers to the Three.js library
itself. It can be addressed with `manualChunks` if needed.

Of the JS, 64 kB is the eight locale dictionaries — about 8 kB each, all of them
bundled. Lazy loading them through dynamic `import()` would save some 19 kB
gzipped on first load, at the cost of an async boundary at start-up and a flash
of untranslated text; at 8 kB apiece that is a bad trade. It becomes worth
revisiting if the teaching layer (BL-22) multiplies the text volume, and the
change would be at the single point where a locale is loaded — no `t()` call
site moves.

## Performance

About 758 thousand triangles and 123 draw calls (the breakdown by module is in
[Architecture](01-architecture.md#performance)). On a discrete or integrated GPU
this runs with room to spare; the bottleneck is not the geometry but the
transparent shells in x-ray mode together with the particles and the bloom.

These numbers are verifiable rather than recalled from memory: `buildEngine()`
runs under Node, so triangles, rows and blades are counted by walking the scene.
Recount them whenever the layout changes, otherwise they drift silently — which
is exactly what happened with the earlier "850 thousand and 50 draw calls".

If the scene needs lightening:

* reduce `radialSegments` and `chordSegments` in the `makeBladeGeometry()` calls
  (small blades are built with 5–6 radial sections, which is already the
  minimum);
* reduce the particle counts `N_BYPASS` and `N_CORE` in `src/airflow.js`;
* switch off the `UnrealBloomPass`.

A note on headless browsers: one renders this scene on a software rasteriser
(SwiftShader) at about one frame per second. That says nothing about real
hardware, but it does make checking long processes through a browser impossible
— hence the extracted modules `engineState.js`, `atmosphere.js`, `contrail.js`,
`sound.js` and `i18n.js`, which are checked directly.

## Tests

Eight files, 210 checks. There is no framework: each test is a plain Node script
with its own `check()` helper, printing one `OK`/`FAIL` line per check and
exiting with code 1 on failure. A single file is run directly —
`node test/geometry.test.mjs`.

`test/engine-state.test.mjs` — 20 checks of the regime state machine: full
shutdown, the impossibility of reviving the engine with the throttle, a restart
with light-off and temperature overshoot, a realistic start duration, stable
idle, throttle response. The test prints a trace of the processes, which also
makes it a convenient tool for tuning the time constants.

`test/heat-haze.test.mjs` — 10 checks of the exhaust gas: on a cold engine there
is no distortion at all, during a start it appears only after light-off, at
take-off power it reaches its maximum, and after shutdown it dies at around the
15th second. What is checked is the pure function `hazePower()` driven through
the real state machine — the shader itself does not run under Node.

`test/spiral-blur.test.mjs` — 10 checks of the spinner spiral smear: at rest it
is sharp, by take-off power its opacity falls below 3 %, during rundown it
returns. Separately it checks that the copies of the spiral never spread further
apart than its angular thickness — otherwise a fan of stripes would appear
instead of an even ring.

`test/atmosphere.test.mjs` — 48 checks of the ambient conditions against
published tables: temperature, pressure and density at 0, 1, 5, 11 and 12 km,
the join of the two branches at the tropopause, and a real day — a deviation
from standard must move the density while leaving the pressure alone. The
saturation vapour pressure is checked the same way, over water and over ice,
along with the inversion of the curve that gives the dew point and the refusal
to report saturation over ice above freezing. This is one of the few places in
the model with a published answer, so the comparison is against the table rather
than against the model itself.

`test/contrail.test.mjs` — 27 checks of the Schmidt — Appleman criterion. The
threshold temperature comes from a published fit, and checking a fit against
itself proves nothing, so the check is against the property it approximates: at
the threshold the saturation curve must have exactly the slope of the mixing
line. It holds to 0.5 % over the whole range of slopes the panel can produce.
The rest are the behaviour of the criterion — a steeper line means a warmer
threshold, drier air has to be colder, a more efficient engine leaves a trail
more readily — and the altitude at which the verdict flips, checked to be a real
boundary. The last seven check the drawing's own decisions - a persistent trail
runs the whole length, a short-lived one breaks off at a third of it, and a
shut-down engine leaves nothing whatever the air outside. The strip needs no
renderer to answer those, only the shader does.

`test/geometry.test.mjs` — 24 checks of the dimensions against the
[prototype reference data](engines/cfm56-7b-nacelle.json). The test reads the
values straight from the JSON, and the tolerances are the ones the reference
itself states (±0.15 m for measurements off the ACAP drawing, ±0.2…0.3 m for
`derived_low` values). The point is the direction of comparison: editing the
reference breaks the test rather than silently diverging from the model. The
nacelle envelope is computed from vertices rather than from the `lathe` profile
— otherwise the flattened bottom would not be included.

`test/clearance.test.mjs` — 11 checks of the layout clearances: blade rows do
not intersect one another (overlapping both axially and radially), the tips of
the fan and outlet guide vanes stay under their own wall, and the accessory
gearbox holds the overall engine width without piercing the nacelle skin. This
is insurance against the main risk of a tight layout: the core is short, the
stage pitch is small, and any addition to a blade chord drops the rows onto each
other.

`test/i18n.test.mjs` — 60 checks of the localisation, and most of them are about
agreement rather than content. All eight dictionaries must carry exactly the key
set of the English one, with the same `{placeholders}` in every value and
nothing left empty: a key added to `en.js` and forgotten in the other seven
costs nothing at build time and shows up as an English word in the middle of a
Japanese panel, and a translator who drops `{margin}` leaves a hole in a
sentence that nothing else would catch. The rest cover locale matching
(`pt-PT` → `pt-BR`, `zh-TW` → `zh-Hans`, an unknown language → English), number
formatting (the decimal comma in five of the eight, and no thousands separator
anywhere — grouped, a T4 of 1604 °C reads as German "1.604 °C"), and the
agreement between `index.html` and the dictionary: every `data-i18n` names a key
that exists, no tagged element has child tags, and the English left in the
markup still says what `en.js` says.

The sound is checked separately, by rendering the graph into an
`OfflineAudioContext` (method and results in the [sound document](06-sound.md)).

The shader pass was checked by eye in the browser, from four views: from behind
(key `9`) and from the nozzle — there the jet must be visible and shimmering;
from the front — there the image must stay sharp, otherwise the occlusion by the
bodies is broken; and with the air flows switched on — there the particles and
streamlines must not drown in the gas.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request into `main` and
`dev`. Two jobs: the test suite on Node 20, 22 and 24, and a build on 22.

Running the whole suite on every push is affordable precisely because none of it
needs a renderer: it is a handful of plain Node scripts and finishes in under a
second. The three versions are the floor Vite still supports, the one the
project is developed on, and the next one; `fail-fast` is off, so a break in one
of them does not hide the state of the others. Installation is `npm ci` rather
than `npm install`: the lockfile is committed, and a run that quietly resolves a
newer Three.js is no longer testing the commit it claims to test.

The build job prints the bundle size into the run summary. That is there for a
specific failure this repository keeps repeating — the size is quoted in four
places and every one of them is copied from memory, so the figures drift.
Measuring it uses Node's `zlib` rather than the `gzip` binary, because Vite
measures with `zlib` and the two disagree by about two kilobytes: 198.29 kB
against 195.88 kB for the same file. Two numbers that both look right are worse
than none. The built `dist/` is kept as an artefact for a week.

What CI does not check is anything needing a GPU: the shader passes, the bloom,
and how the scene actually looks. Those stay a manual pass — see the four views
at the end of the previous section.

## Limitations of the model

The model is illustrative. The full list of what is deliberately simplified or
not modelled at all is in
["Physics of the model", section 10](03-physics.md#10-what-the-model-does-not-have).
In short: no gas-dynamic computation, no cycle calculation, no recomputation of
the engine for altitude (the ambient air is there, the characteristics are not),
no engine limits or protections; the absolute
speeds and flow velocities are deliberately reduced for the sake of a legible
picture.

## Possible extensions

* **Thrust reverser** — the reverser doors in the bypass duct and the
  corresponding rearrangement of the flows.
* **Bleed air** from behind the compressor for turbine cooling and air
  conditioning: the bleed ports exist geometrically, but no flow goes through
  them.
* **Limits and failures** — surge, flame-out, T4 exceedance, a failed start (hot
  start, hung start).
* **Altitude and airspeed characteristics** — the dependence of thrust and flow
  on altitude and Mach number.
* **Real-time section by an arbitrary plane** — at present only a sector around
  the axis is cut out.
* **Occlusion-aware labels** — labels of internal modules currently show through
  the nacelle.

## File layout

```
index.html              markup of the panel, the legend and the module card
src/main.js             scene, lighting, post-processing, cutaway, UI, frame loop
src/engine.js           geometry of all modules, materials, labels, picking proxies
src/blade.js            procedural generator of blades and rows
src/airflow.js          flow ducts, particles, streamlines, plume
src/heathaze.js         exhaust gas aft of the nozzle (screen-space pass)
src/engineState.js      regime state machine: start, running, shutdown, rundown
src/atmosphere.js       standard atmosphere and water vapour
src/contrail.js         contrail formation criterion
src/contrailView.js     the trail behind the engine
src/sound.js            sound synthesis on Web Audio
src/i18n.js             lookup, interpolation, number formatting, locale matching
src/locales/            eight dictionaries; en.js is the source, the rest follow it
src/style.css           panel styling
test/                   state machine, exhaust gas, spiral smear, atmosphere,
                        contrail, dimensions, layout clearances and localisation
docs/                   this documentation
docs/engines/           machine-readable reference data on prototypes (JSON)
```
