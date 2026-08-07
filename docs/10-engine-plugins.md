# 10. Engine description format

> **Status: proposal.** Nothing described here has been implemented yet. This
> document is a design for the format and the loader for task
> [BL-23 "Choose an engine from a list"](09-backlog.md); it also defines how the
> engine stops being wired into the code.

The goal is simple: **adding an engine should mean dropping in a JSON file**.
No source edits, no rebuild, no knowledge of the internals of the model.
Everything that distinguishes one engine from another is described by data; the
code knows how to build geometry, flows, sound and regimes from that data.

## What stands in the way today

The engine is smeared across five modules as constants and literals:

| Where | What is wired in |
|---|---|
| `src/engine.js` | The `ST` stations in model units, radii, stage and blade counts — as numbers right in the calls |
| `src/blade.js` | Blade generator parameters for every row |
| `src/airflow.js` | Duct boundaries, velocity, swirl and temperature profiles — literal tables |
| `src/engineState.js` | Exactly two rotors, idle, start thresholds, time constants |
| `src/sound.js` | The `CFM` block (24 blades, 5175 and 14460 rpm, Ø 1.55 m) and the measured `BUZZSAW` envelope |
| `src/main.js` | The `STATIONS` table with the temperature and pressure coefficients |

None of these places is a "setting" — all of it is the description of one
particular engine, scattered across whichever modules happened to need it.

## Where the files live

The `public/engines/` directory. Vite copies `public/` into the build **as is**,
without passing it through the bundler — which means the files are read at run
time rather than at build time, and that is exactly what is needed: a file can
be dropped into a deployed `dist/engines/` on a running server, and the new
engine appears after a page reload.

```
public/engines/
  index.json          manifest: what exists at all
  cfm56-7b.json
  leap-1b.json
  pw1100g.json
```

The manifest is needed because a browser cannot read the contents of a
directory:

```json
{
  "schema": 1,
  "engines": [
    { "id": "cfm56-7b", "file": "cfm56-7b.json", "title": "CFM56-7B",
      "aircraft": "Boeing 737NG", "default": true },
    { "id": "leap-1b",  "file": "leap-1b.json",  "title": "LEAP-1B",
      "aircraft": "Boeing 737 MAX" }
  ]
}
```

The loader reads the manifest at start-up, fills the drop-down list and fetches
the engine file itself only when one is selected — the descriptions are small,
but there is no point loading five files for the sake of one.

Separately there is **loading your own file from disk**: an "open description"
button or dragging a file into the window. This works even where there is no
access to the server, and turns the format into a playground: change the fan
diameter in a text editor, drag the file in, see the result.

## Units and origin

Inside the model everything lives in model units (1 unit = 0.50 m) and in
coordinates whose zero sits somewhere near the combustor. Demanding that of the
author of a file is out of the question, so:

* **all dimensions in the file are in metres**, temperatures in °C, speeds in
  rpm, thrust in kN, flows in kg/s;
* **the axial zero is the fan plane**, positive aft. That is the one point
  visible on any drawing and any photograph.

Conversion into model units and the shift of origin are done by the loader. If
the scale of the model changes tomorrow, the files stay as they are.

## Inheritance

A full engine description is about a hundred and fifty lines, and there is no
reason to demand all of them from someone who wants to add a related variant.
The format therefore has `extends` and deep merging:

```json
{
  "schema": 1,
  "id": "cfm56-7b27",
  "extends": "cfm56-7b",
  "meta": { "title": "CFM56-7B27", "aircraft": ["Boeing 737-900ER"] },
  "performance": { "thrustTakeoffKn": 121 }
}
```

The base is usually the nearest relative. Cycles in `extends` must be caught and
rejected by the loader.

## Structure of a description

```json
{
  "schema": 1,
  "id": "cfm56-7b",

  "meta": {
    "title": "CFM56-7B",
    "manufacturer": "CFM International",
    "aircraft": ["Boeing 737NG"],
    "confidence": "reference",
    "sources": ["…link to the reference data…"]
  },

  "fan": {
    "diameterM": 1.55,
    "blades": 24,
    "tipSweepDeg": 28
  },

  "spools": [
    { "id": "lp", "maxRpm": 5175,
      "drives": ["fan", "booster"], "drivenBy": ["lpt"] },
    { "id": "hp", "maxRpm": 14460,
      "drives": ["hpc"], "drivenBy": ["hpt"] }
  ],

  "modules": {
    "booster": { "stages": 3, "xM": [0.30, 0.68], "rHubM": 0.29, "rTipM": 0.47 },
    "hpc":     { "stages": 9, "xM": [0.83, 1.70], "rHubM": 0.23, "rTipM": 0.36 },
    "combustor": { "type": "annular", "injectors": 20, "xM": [1.84, 2.25] },
    "hpt":     { "stages": 1, "xM": [2.29, 2.55] },
    "lpt":     { "stages": 4, "xM": [2.69, 3.37] }
  },

  "nacelle": {
    "lengthM": 4.17,
    "maxDiameterM": 2.44,
    "inletLipXM": -0.63,
    "bottomFlattening": 0.18,
    "accessoryClockPos": 8
  },

  "install": {
    "groundClearanceM": 0.46,
    "aircraftProfile": "b737ng"
  },

  "performance": {
    "thrustTakeoffKn": 121,
    "bypassRatio": 5.3,
    "overallPressureRatio": 32.8,
    "t4MaxC": 950
  },

  "control": {
    "idleN1": 0.18, "idleN2": 0.56,
    "starterCutoffN2": 0.30, "lightOffN2": 0.22, "lightDelaySec": 2.5,
    "tau": {
      "crank": [12.0, 12.5], "accel": [10.0, 7.4],
      "up": [2.6, 2.0], "down": [1.9, 1.4], "coast": [9.3, 5.9]
    }
  },

  "sound": {
    "source": "measured",
    "buzzsawOrders": [0.123, 0.209, "…48 values…"],
    "buzzsawOnsetMach": 0.70
  },

  "features": ["flattened-nacelle", "side-gearbox"]
}
```

The sections are independent: `sound` can be omitted entirely, giving a sound
computed from the geometry by the general method, and `install` is needed only
to show the engine in its place under the wing.

The pairs in `tau` are the time constants of the LP and HP rotors by phase; they
are already split exactly that way in `src/engineState.js`. The flags in
`features` are not invented either: the flat nacelle bottom and the accessories
moved to the side already exist in the code (`BELLY_FLOOR` and `AGB_TILT` in
`src/engine.js`), and once parameterised they will simply take their value from
the file instead of from a constant.

The numbers in the example are illustrative — some are taken from the current
code (speeds, blade count, fan diameter, time constants), the rest are set to
the right order of magnitude and are subject to checking against sources when a
real file is filled in. That is exactly what `sources` and `confidence` are for
in `meta`, with the values `measured` (taken from recordings or drawings),
`reference` (from reference data with a citation) and `estimated` (an estimate
by analogy) — the last of these must be visible in the interface too, so that a
guess is not passed off as fact.

## What the loader computes and what comes from the file

The rule: **the file holds only what appears in reference sources**; everything
derivable from that is derived by the code. Otherwise the files start
contradicting themselves.

| Quantity | Where from |
|---|---|
| Blade passing frequency | `fan.blades` × LP speed |
| Blade tip tangential speed | π × `fan.diameterM` × speed |
| Buzz-saw onset threshold | from the tangential speed, not from the file |
| Duct boundaries for the particles | from the module and nacelle radii |
| Fraction of particles in the bypass duct | from `performance.bypassRatio` |
| Temperature and pressure stations | from `overallPressureRatio` and `t4MaxC` |
| Model units and coordinate shift | by conversion from metres |

## What never goes into a file

**Executable code.** No expressions, no formulas as strings, no references to
scripts. There are two reasons: a description may come from someone else's hands
— a file dragged into the window must be able to do nothing but supply numbers;
and predictability — data can be validated by a schema, arbitrary code cannot.

Hence a corollary: if an engine requires **new geometry** that the builder does
not yet know how to make — chevrons on the nozzle, a gearbox, a third spool —
that cannot be solved by a file. Such things are enabled by flags in `features`,
each backed by a builder written in code. The file chooses from an existing set
rather than bringing its own. The list of supported flags is part of the schema,
and an unknown flag must produce a clear warning rather than being silently
ignored.

The boundary runs where it does everywhere else in the model: `src/blade.js` is
a procedure for building a blade, not a table of points, and it is parameterised
by numbers rather than replaced.

## Validating the files

The schema lives next to the descriptions (`public/engines/schema.json`) and is
used twice: by the loader in the browser and by a test in Node that runs every
file in the directory through it. Then `npm test` catches a typo in a
description before it turns into an engine without a turbine.

Requirements on loader behaviour:

* as few mandatory fields as possible; everything else has sensible defaults, so
  that a draft description already shows something;
* on error — a clear message naming the field, and **stay on the current
  engine**; the scene must not fall apart because of someone else's file;
* physically meaningless values (zero blades, a negative diameter, stations in
  the wrong order) are rejected on the same footing as format errors;
* a `schema` with an unknown major version — refusal with an explanation, not an
  attempt to read it as best one can.

## Switching on the fly

Changing the engine means rebuilding the scene, and there are things not to
forget here: dispose of the geometries and materials of the previous engine
(otherwise memory leaks by the third switch), save and restore the state —
operating mode, rotor speeds, camera position, enabled layers — and recompute
the sound: the `PeriodicWave` is rebuilt for the new envelope and blade count.

A good test of the format: **switching there and back must return exactly the
same picture**. If it does not, some of the state lives in the built scene
rather than in the description.

## Order of implementation

1. **A snapshot of the current engine.** A `model-current.json` file from which
   exactly what the model shows today is built, plus a snapshot test comparing
   the key dimensions and counts against the current hardcoded values. A step
   with no visible result, but it is the one that proves the format is
   sufficient.
2. **The loader, the manifest and the list** in the interface; the default
   engine is the same one. Outwardly, again, nothing changes.
3. **The first real engine.** This is easier than expected: the model no longer
   mixes prototypes. The dimensions, the fan blade count and the layout (3
   booster stages, 9 HPC, 1 HPT, 4 LPT) all come from the CFM56-7B and are all
   checked by tests against the
   [reference data](engines/cfm56-7b-nacelle.json). So the first file in the
   format is a transcription of an existing description rather than an
   investigation into what has actually been built.
4. **Engines of a different architecture** — geared and three-spool. They break
   the assumption of two rotors, and it is on them that the design of `spools`
   gets tested.

Steps 1 and 2 do not change the picture — and that is not a shortcoming but a
condition: until the snapshot matches, it is too early to add engines.
