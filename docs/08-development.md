# 08. Development

## Running

```bash
npm install
npm run dev      # http://localhost:5188, listens on 0.0.0.0
npm run build    # build into dist/
npm run preview  # preview the built version
npm test         # state machine, exhaust gas, spiral smear,
                 # dimensions against the reference, layout clearances
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
dist/index.html                 6.6 kB  (2.0 kB gzip)
dist/assets/index-*.css         7.7 kB  (2.3 kB gzip)
dist/assets/index-*.js        657 kB  (174 kB gzip)
```

The Vite warning about a chunk larger than 500 kB refers to the Three.js library
itself. It can be addressed with `manualChunks` if needed.

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
— hence the extracted modules `engineState.js` and `sound.js`, which are checked
directly.

## Tests

Five files, 75 checks. There is no framework: each test is a plain Node script
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

The sound is checked separately, by rendering the graph into an
`OfflineAudioContext` (method and results in the [sound document](06-sound.md)).

The shader pass was checked by eye in the browser, from four views: from behind
(key `9`) and from the nozzle — there the jet must be visible and shimmering;
from the front — there the image must stay sharp, otherwise the occlusion by the
bodies is broken; and with the air flows switched on — there the particles and
streamlines must not drown in white gas.

## Limitations of the model

The model is illustrative. The full list of what is deliberately simplified or
not modelled at all is in
["Physics of the model", section 9](03-physics.md#9-what-the-model-does-not-have).
In short: no gas-dynamic computation, no cycle calculation, no
altitude/airspeed characteristics, no engine limits or protections; the absolute
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
src/sound.js            sound synthesis on Web Audio
src/style.css           panel styling
test/                   state machine, exhaust gas, spiral smear,
                        dimensions and layout clearances
docs/                   this documentation
docs/engines/           machine-readable reference data on prototypes (JSON)
```
