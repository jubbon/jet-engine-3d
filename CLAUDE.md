# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The written language of this repository is English: documentation, code
comments, UI strings, test output and commit messages. Keep it that way. Replies
to the user in the session are in Russian.

## About the project

An interactive 3D model of a turbofan engine on Three.js + Vite. The prototype
is the **CFM56-7B in a Boeing 737NG nacelle**. There are no external assets at
all: the geometry is built in code, reflections come from `RoomEnvironment`, the
sound is synthesised on Web Audio. No frameworks — plain ES-module JS.

## Commands

```bash
npm install
npm run dev      # Vite on port 5188, listening on 0.0.0.0
npm run build    # build into dist/
npm run preview
npm test         # all eight test files in sequence
```

A single test runs directly, with no runner and no flags:

```bash
node test/geometry.test.mjs
```

The two-stage `Dockerfile` builds with Node and serves `dist/` from nginx on the
same port 5188. It runs no tests — that is CI's job (`.github/workflows/ci.yml`),
against the same commit. `docker/nginx.conf` sets `gzip_comp_level 6`
deliberately: the default of 1 sends the bundle 19 % heavier than the size
quoted in the documentation.

## Coordinate system and stations

This is the central convention of the project; do not touch the geometry before
taking it in.

* The engine axis is **X**, the flow goes towards **+X**. Surfaces of revolution
  are built by `lathe()` from a `[radius, X]` profile and rotated by
  `rotation.z = -π/2`.
* **1 model unit = 0.50 m.** Because of that factor a radius in model units is
  numerically equal to a **diameter in metres**: `fanTip = 1.549` is a fan of
  Ø 1.549 m, `nacelleR = 2.44` is a nacelle of Ø 2.44 m. Reference diameters go
  into the code without conversion, and that is the only reason the scale is
  what it is.
* The longitudinal stations live in the **`ST`** object (`src/engine.js`) and are
  measured from the intake leading edge at `x = −5.20`. A station in metres from
  the lip = `(x + 5.2) / 2`.
* `ST` is the single source of truth about the longitudinal layout. It is
  referenced by `airflow.js` (duct boundaries, velocity and temperature
  profiles), `heathaze.js` (occluders, start of the plume) and `main.js` (camera
  targets). Move a station and check all four files: the numbers there sit in
  tables and drift apart silently.

## Dimensions come from the reference data, not from memory

`docs/engines/*.json` holds machine-readable reference data on real hardware.
Every number there is an object with a citation and a `confidence`
(`documented` / `derived` / `derived_low`); the conventions are described in
[`docs/engines/README.md`](docs/engines/README.md).

`test/geometry.test.mjs` reads the yardstick **straight from the JSON** rather
than from its own copy of the numbers. The direction of comparison is
deliberate: editing the reference breaks the test rather than silently diverging
from the model. When changing a dimension, change the reference first and the
code after.

One check stands apart because it cannot be made from dimensions: the **ratio of
intake length to fan diameter** (adopted as 0.498). How the nacelle length
divides between the intake and the nozzle is not fixed by the reference — the
sum adds up for any split, and two versions chosen by eye gave a fan sunk deep
into a tunnel while every dimension checked out. The analysis is in
[`docs/02-geometry.md`](docs/02-geometry.md#dimensions-from-sources).

## Architecture

Dependencies run one way, and `main.js` is the only orchestrator:

```
index.html → main.js → engine.js → blade.js
                     → airflow.js  heathaze.js  sound.js  engineState.js
                     → atmosphere.js → contrail.js → contrailView.js
                     → i18n.js → locales/*.js
```

**`engineState.js`, `atmosphere.js`, `contrail.js`, `sound.js` and `i18n.js` deliberately know nothing about Three.js or
the DOM.** This is not abstraction for its own sake: a headless browser renders
this scene on a software rasteriser at about 1 fps, so a forty-second engine
start simply cannot be checked through a browser. The regime state machine is
run under Node, the sound graph in an `OfflineAudioContext`
(`createEngineSound({ makeContext })`), and the eight dictionaries are compared
against each other key by key.

Worth knowing before making changes:

* **The single source of truth about the engine is the `eng` object** from
  `createEngineState()`. The slider sets only the throttle position; the actual
  speeds, combustion and T4 are computed by the state machine, and it is those
  that drive rotation, glow, flows, sound and instruments. That is why
  everything dies together on shutdown — do not mix the slider position in
  directly.
* **Modules** are created by the helper `module(name, title, info, explode)` in
  `buildEngine()` and serve three purposes at once: the unit of exploding, the
  unit of mouse picking and the carrier of the card text. Rotors are attached
  through `rotor(parent, kind)` and land in the `n1Rotors` / `n2Rotors` arrays;
  every frame all groups of a spool are assigned a **common angle**, so the
  rotors stay in sync even when their parent modules have moved apart in the
  exploded view.
* **Picking goes through invisible proxy cylinders** (`engine.pickables`, 11 of
  them) rather than the real geometry: the scene holds ~758 thousand triangles
  and raycasting them on every mouse move is unacceptable. Add a module and add
  a proxy for it to the `PROXY` array, otherwise it simply will not be
  selectable.
* **Every user-visible string goes through `t(key)`**, and the dictionaries in
  `src/locales/` are the authority — `index.html` keeps its English only so the
  file stays readable, and a test fails if the two disagree. Module cards and
  3D labels are keyed off the module name (`module.fan.title`), so adding a
  module means adding its keys to all eight files; the parity test will say so.
  Sentences assembled at run time are stored whole, never glued from fragments:
  the word order that works in English has no counterpart in Japanese.
* **The cutaway** is two `THREE.Plane`s with `clipIntersection = true`, assigned
  only to the shell materials (`getShellMaterials()`). Rotors and blades stay
  whole, giving the classic cutaway. A material added without the
  `{ shell: true }` flag will not be cut.
* **Post-processing order:** `RenderPass` → exhaust gas → `UnrealBloomPass` →
  `OutputPass`. The exhaust comes **before** the bloom deliberately: otherwise
  the halos around red-hot parts would stay put while the parts themselves
  shimmer.
* Every blade row is a single `InstancedMesh` (`bladeRow()`); the blade profile
  is built procedurally in `blade.js` with twist from root to tip.
* `dt` in the frame loop is capped at 0.05 s, so that when the frame rate drops
  the model slows down rather than jumping over states. The ×1/×4 time scale
  switch multiplies the step **only** for the engine state machine.

## Tests

There is no framework. Each test is a plain Node script with its own `check()`
helper, printing one `OK`/`FAIL` line per check and exiting with code 1 on
failure. Write new ones in the same style.

| File | What it checks |
|---|---|
| `engine-state.test.mjs` | The regime state machine: full shutdown, realistic start duration, delayed light-off, throttle response. Prints a trace — also handy for tuning the time constants |
| `heat-haze.test.mjs` | The pure function `hazePower()` driven through the real state machine; the shader itself does not run under Node |
| `spiral-blur.test.mjs` | The spinner spiral smear and that its copies do not spread further apart than the angular thickness |
| `atmosphere.test.mjs` | The standard atmosphere and water vapour against published tables: T, P, ρ at the round levels, the join at the tropopause, a real day, saturation over water and over ice, the dew point |
| `contrail.test.mjs` | The Schmidt — Appleman criterion, checked through tangency of the mixing line to the saturation curve rather than against its own fit |
| `geometry.test.mjs` | Dimensions against the reference, stage counts, intake depth, station ordering |
| `clearance.test.mjs` | Blade rows do not intersect, blade tips stay under their wall, accessories stay under the nacelle skin |
| `i18n.test.mjs` | The eight dictionaries agree: same keys, same `{placeholders}`, nothing empty. Locale matching, number formatting, and that the English left in `index.html` still says what the dictionary says |

`geometry` and `clearance` build the **real scene** through `buildEngine()`
right under Node — Three.js allows that without a renderer. The envelopes are
computed from vertices rather than from the `lathe` profile: the flattened
bottom of the nacelle does not appear in the profile.

The clearances are not checked for show. The core is short, the stage pitch is
71…125 mm, and any addition to a blade chord drops neighbouring rows onto each
other — which is invisible in the picture, the model rendering as if nothing
were wrong.

The sound is checked separately by rendering the graph into an
`OfflineAudioContext`; the method and the scripts are in `test/audio/`.

## Documentation

`docs/` is not generated but maintained prose (10 documents plus the reference
data). When behaviour changes, update the corresponding document in the same
commit: `02-geometry` (layout and dimensions), `03-physics` (equations and the
limits of their validity), `04-airflow`, `05-modes`, `06-sound`, `07-ui`. The
prioritised task queue is `09-backlog.md`.

## Commit style

English, a substantive subject line without prefixes such as `feat:`, then a
full body explaining **why** it is done this way rather than what changed line
by line: which alternatives were rejected, where the numbers came from, what the
tests do not catch. Look at `git log` — the intent is to assemble a CHANGELOG
from these messages. Code comments are written in the same manner: they explain
the reason, not the mechanics.

## The numbers in the documentation are verifiable — verify them

Composition and dimensions are scattered through the prose as dozens of specific
numbers, and they regularly fall behind the code: a layout change touches
README, `01`, `02`, `03` and `08` at once. Before rewriting a number from
memory, compute it on the model — `buildEngine()` runs under Node, so triangles,
rows, blades and envelopes are obtained by walking the scene in a couple of
lines.

The yardstick as of today (recount it, do not copy it): 758 thousand triangles,
123 draw calls, 37 blade rows holding 2341 blades, 11 picking proxies, 210
checks across eight test files. The build is 731 kB of JS, 198 kB gzipped.

The bundle grew by 64 kB when the interface was localised into eight languages:
the dictionaries are about 8 kB apiece and all of them ship, since lazy loading
would buy back 19 kB gzipped at the cost of a flash of untranslated text.

It has accumulated before: `01` and `08` promised ~850 thousand triangles and
~50 draw calls for a long time, and the draw calls were off by a factor of three
— the count was already wrong before three stages left the layout.
