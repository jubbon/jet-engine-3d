# Project documentation

An interactive 3D model of a high-bypass turbofan engine built on Three.js:
detailed module geometry, turning rotors, airflow visualisation, a cut-away
casing, procedural sound and the full cycle of start → running → shutdown.

## Contents

| Document | About |
|---|---|
| [01. Architecture](01-architecture.md) | Modules, data flow, scene graph, performance |
| [02. Engine geometry](02-geometry.md) | Gas path, stations, modules, blade generator |
| [03. Physics of the model](03-physics.md) | The equations built into the model and the limits of their validity |
| [04. Airflow](04-airflow.md) | Ducts, particles, streamlines, temperature scale |
| [05. Operating regimes](05-modes.md) | State machine, start, shutdown, rundown, tests |
| [06. Sound](06-sound.md) | Web Audio synthesis, coupling to rotor speed |
| [07. User interface](07-ui.md) | Panel, cutaway, x-ray, exploded view, keyboard shortcuts |
| [08. Development](08-development.md) | Running, building, tests, limitations, possible extensions |
| [09. Backlog](09-backlog.md) | Task queue: priority, size, what each one touches |
| [10. Engine description format](10-engine-plugins.md) | Proposal: engines as JSON files without a rebuild |
| [Engine reference data](engines/README.md) | Data on real hardware in JSON: [CFM56-7B nacelle](engines/cfm56-7b-nacelle.json) |

## The model in brief

The prototype is the CFM56-7B (Boeing 737NG): fan Ø 1.549 m, 24 blades, bypass
ratio 5.1, 121 kN of thrust at take-off power (CFM56-7B27). The nacelle is
Ø 2.44 m and 4.05 m long to the core nozzle exit; the dimensions are checked
against the [reference data](engines/cfm56-7b-nacelle.json) on `npm test`.
The prototype layout is 3 booster stages, 9 high-pressure compressor stages,
1 high-pressure turbine stage and 4 low-pressure turbine stages.

The model is **illustrative, not computational**: it reproduces the qualitative
behaviour of an engine and the correct relationships between parameters, but it
does not solve the equations of gas dynamics. What is built in and what is
deliberately simplified is set out in [Physics of the
model](03-physics.md).
