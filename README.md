# Turbofan engine — interactive 3D model (Three.js)

A detailed model of a high-bypass turbofan: turning rotors, all the main core
assemblies, airflow visualisation and a "look inside" mode.

The prototype is the **CFM56-7B in a Boeing 737NG nacelle**. The dimensions are
not chosen by eye: each one comes from the
[prototype reference data](docs/engines/cfm56-7b-nacelle.json) with a citation,
and any divergence is caught by a test — see
[Dimensions from sources](docs/02-geometry.md#dimensions-from-sources).

## Running

```bash
npm install
npm run dev      # http://localhost:5188, listens on 0.0.0.0
npm run build    # build into dist/
npm test         # state machine, exhaust gas, spiral smear, atmosphere,
                 # contrail, dimensions against the reference, clearances
```

A single test runs directly: `node test/geometry.test.mjs`.

## Documentation

The full description is in the [`docs/`](docs/README.md) directory:

| Document | About |
|---|---|
| [01. Architecture](docs/01-architecture.md) | Modules, data flow, scene graph, performance |
| [02. Engine geometry](docs/02-geometry.md) | Gas path, stations, modules, blade generator |
| [03. Physics of the model](docs/03-physics.md) | The equations built into the model and the limits of their validity |
| [04. Airflow](docs/04-airflow.md) | Ducts, particles, streamlines, temperature scale |
| [05. Operating regimes](docs/05-modes.md) | State machine, start, shutdown, rundown, tests |
| [06. Sound](docs/06-sound.md) | Web Audio synthesis, coupling to rotor speed |
| [07. User interface](docs/07-ui.md) | Panel, cutaway, x-ray, exploded view, keyboard shortcuts |
| [08. Development](docs/08-development.md) | Build, tests, limitations, possible extensions |
| [09. Backlog](docs/09-backlog.md) | Task queue: priority, size, what each one touches |
| [10. Engine description format](docs/10-engine-plugins.md) | Proposal: engines as JSON files without a rebuild |

## What is modelled

| Module | Details |
|---|---|
| Nacelle | Intake barrel with a flattened bottom (the "hamster pouch") and a thick polished lip, cowls, pylon |
| Fan (N1) | 24 wide-chord blades Ø 1.549 m with sweep, spinner with a spiral (smearing with speed), disc, case with containment ring |
| Outlet guide vanes | 44 OGVs in the bypass duct |
| Booster / LP compressor (N1) | 3 rotor stages + stator vanes, flow splitter |
| HP compressor (N2) | 9 rotor stages + 9 stator rows, drum, casing |
| Combustor | Annular flame tube (outer and inner walls, dome), 20 fuel nozzles with swirlers, volumetric flame on a shader |
| HP turbine (N2) | 1 stage + nozzle guide vanes, disc |
| LP turbine (N1) | 4 stages + nozzle guide vanes |
| Rear frame and nozzle | 10 struts, plug, core nozzle |
| Shafts | LP shaft inside the hollow HP shaft, flanges, 4 bearing supports |
| Accessories | Accessory gearbox moved to the side (as on the 737), pumps, radial drive, pipework |

The blades are built procedurally: a NACA-like profile is lofted along the
radius with varying chord, thickness, camber and stagger angle (twist from root
to tip), and wrapped around the circumference — as real blades are
(`src/blade.js`). Each row is a single `InstancedMesh`.

## Controls

| Action | How |
|---|---|
| **Air flows** | panel button or `Space` |
| **Look inside** (casing cutaway) | button or `C`; angle and rotation of the cut by sliders |
| **Transparent casings** (x-ray) | checkbox or `X` |
| **Explode modules** | the "Explode modules" slider |
| **Start / shut down the engine** | button or `E` |
| **Engine sound** | button or `S`, volume by slider |
| **Exhaust gas** (visible jet and heat haze) | checkbox or `H` |
| Engine power (throttle) | slider (changes N1/N2, flame brightness, flow speed, instruments and sound) |
| **Ambient conditions** | altitude, deviation from standard and humidity by sliders, or the buttons 0 / 3 / 11 km |
| **Contrail** | forms itself from the conditions; drawing toggled by checkbox or `T`, efficiency by slider |
| Views | buttons `1…9` and `0` (`9` — the rear view inside the gas stream, `0` — the contrail) |
| Module information | hover for a tooltip, click for a card with the description |
| Camera | LMB — orbit, wheel — zoom, RMB — pan |

## How it works inside

* **Cutaway.** Two `THREE.Plane`s with `clipIntersection = true` cut an angular
  sector out of the shells (the union of two half-spaces is everything but the
  sector). The planes are assigned only to the shell materials
  (`getShellMaterials()`), so the rotors and blades stay whole — giving the
  classic cutaway.
* **Rotors.** Two independent spools: the N1 groups (fan, booster, LP turbine,
  LP shaft) and the N2 groups (HP compressor, HP turbine, HP shaft) turn at
  different speeds and in opposite directions.
* **Exploded view.** Each module has its own `explode` vector; the nacelle moves
  up, the core cowl and the accessories move down, the rest spread along the
  axis.
* **Module picking.** Picking goes not through the real geometry but through
  eleven invisible proxy cylinders (`engine.pickables`) — otherwise a raycast of
  ~758 thousand triangles would run on every mouse move.

## Airflow (`src/airflow.js`)

The two ducts are given by tables of "inner / outer boundary radius — axial
coordinate", plus profiles of axial velocity, swirl and temperature:

* **Bypass duct** — blue: air after the fan travels past the core and is
  accelerated in the fan nozzle. Up to 80 % of the thrust.
* **Core duct** — the colour changes with temperature: light blue → turquoise
  (compression in the booster) → yellow (600 °C after the HP compressor) → white
  and orange (combustion, 1800–2000 °C) → orange-red (expansion through the
  turbine and the nozzle).

Each particle keeps its own lane in the duct, its phase and its current
coordinate; radius, velocity, swirl and colour are taken from the tables by the
X coordinate. In addition, streamlines are drawn (12 tubes with a temperature
gradient) along with the exhaust plume behind the nozzle. Bottom right is a
table of temperatures and pressures by station, recomputed by regime — and by
the air outside: the altitude slider in the panel lifts the engine to the cruise
levels, where the same throttle position gives 383 °C and 6.3 bar behind the
compressor instead of the 600 °C and 28 bar of sea level.

Separately from this schematic visualisation, the **exhaust gas** works: a
screen-space pass traces a ray for every pixel through the cone of hot gas. The
jet is visible in its own right — a whitish billowing cone, dense at the nozzle
— and it refracts everything seen through it: the image shimmers and smears.
Look into the nozzle and the whole screen swims; look from the side and the jet
trails away as a white plume; look from the front and there is nothing, the
nacelle blocking the exhaust. When the air flows are switched on the exhaust is
damped down so as not to paint over the diagram. Details are in the
[airflow document](docs/04-airflow.md#exhaust-gas).

Behind all this, at altitude, the engine leaves a **contrail** — or does not.
The Schmidt — Appleman criterion is computed from the ambient pressure, the
humidity and one number from the engine, its propulsive efficiency; the panel
states the verdict — no trail, short-lived, persistent — and says how much
higher or lower it would change. Two counter-intuitive things come out of it: a
*more* efficient engine leaves a trail more readily, because less of the fuel's
energy stays in the jet as heat; and whether the trail lasts has nothing to do
with the engine at all, only with whether the surrounding air is supersaturated
over ice. The trail itself is drawn from view `0`, starting ten metres behind
the nozzle as a real one does. Details are in
[Physics of the model](docs/03-physics.md#9-the-contrail).

The values on the instruments and in the table start from the prototype —
take-off thrust 121.4 kN (CFM56-7B27), overall pressure ratio about 28 — but
remain illustrative: they are not the result of computing a specific cycle. What
exactly is simplified is listed in
[Physics of the model](docs/03-physics.md#10-what-the-model-does-not-have).

## Start and shutdown (`src/engineState.js`)

A state machine: `off` → `start` → `run` → `stop` → `off`. The module knows
nothing about Three.js or the DOM — only regime physics — so it is checked under
Node (`npm test`).

**Shutdown** is a fuel shut-off: the fuel is cut instantly, and everything after
that happens by itself:

1. the flame dies in about 2 s, thrust goes to zero immediately;
2. the rotors coast down — an exponential plus bearing friction that brings them
   to a true zero. The HP rotor stops in about 23 s, the LP rotor (heavier and
   tied to the fan) in about 35 s;
3. the metal of the hot section glows by the actual T4 rather than by the
   throttle, so the turbine cools noticeably after the flame has already died;
4. the flow particles freeze together with the fan, and the core duct visibly
   loses its colour — without combustion it is just cold air being pumped
   through;
5. in the sound the roar disappears at once together with the combustion, while
   the fan whine keeps falling in pitch until the rotors stop — after which,
   silence;
6. the throttle is locked: a shut-down engine cannot be revived with it.

**Starting** runs at a natural pace, like a real engine: the starter cranks the
HP rotor for about 17 s, fuel is introduced at 22 % speed, and 2.5 s later
light-off occurs — until that moment the fuel is already in the chamber but
there is no flame and the gas path is cold. Then comes a T4 overshoot to about
780 °C (the airflow is small, the mixture rich) and settling at idle, N1 = 18 %,
N2 = 56 % — about 40 s in all.

There is no need to wait out those forty seconds: the **time scale ×1 / ×4**
switch in the panel speeds up the processes inside the engine without touching
the flows or the camera.

The button works both ways at any moment: during rundown the engine can be
started again, during a start it can be aborted.

## Sound (`src/sound.js`)

Synthesised on the Web Audio API without samples, and tuned by spectral analysis
of real CFM56 recordings (scripts in [`test/audio/`](test/audio), the analysis
in the [sound document](docs/06-sound.md)). The components:

* **buzz-saw** — a comb of 48 orders of the LP shaft frequency, produced by a
  single oscillator through a `PeriodicWave` with an envelope measured from the
  recordings. This is what makes the sound recognisable: with supersonic blade
  tips each blade sends a weak shock wave forward along the intake, and since
  the blades differ slightly from one another the pattern repeats once per shaft
  revolution rather than once per blade passing period. The envelope is left
  jagged on purpose: an even comb sounds like a synthesiser;
* **the blade passing tone** `N1 rpm / 60 × 24` and its second harmonic — the
  pure whine heard while taxiing, when the blade tips are still subsonic;
* **HP rotor whine** — a sawtooth at the HP shaft frequency through a bandpass;
* **jet noise** — brown noise in the 180…310 Hz band with two cascaded lowpass
  filters: the analysis showed a peak at 200…315 Hz and a −30 dB roll-off by
  2 kHz, so the jet is noticeably darker than "white noise with a hum";
* **rumble** (an 88 Hz band) and **broadband fan noise** (1.2…2.8 kHz).

All levels and frequencies go through `setTargetAtTime`, so a throttle movement
is heard as a smooth spool-up. Panning and loudness follow the camera: the
engine moves left and the sound moves left, pulling the camera back makes it
quieter. When the tab loses focus the context is suspended.

Throttle response: the rotor does not reach its regime instantly (a time
constant of 2.6 s accelerating, 1.9 s decelerating), so rotation, instruments,
flame and sound change together, and the slider works as a thrust lever rather
than as a direct speed setting.

The module accepts a substitute audio context
(`createEngineSound({ makeContext })`), which allows the graph to be rendered in
an `OfflineAudioContext` and measured.

## Layout

```
index.html        UI and legend markup
src/style.css     panel styling
src/main.js       scene, lighting, post-processing, cutaway, UI, animation
src/engine.js     geometry of all engine modules, materials, labels
src/blade.js      procedural generator of blades and rows
src/airflow.js    particles, streamlines, plume
src/heathaze.js   exhaust gas aft of the nozzle (screen-space pass)
src/sound.js      procedural engine sound
src/engineState.js  state machine: start, running, shutdown, rundown
src/atmosphere.js   standard atmosphere and water vapour: the air of the day
src/contrail.js     contrail: does a trail form, and does it last
src/contrailView.js the trail behind the engine
test/             state machine, exhaust, spiral smear, atmosphere, contrail,
                  dimensions, clearances
docs/             documentation
docs/engines/     machine-readable reference data on prototypes (JSON)
```
