# 09. Backlog

A list of what is worth doing next. This is not a schedule with dates but a
queue of ideas with an assessment: why the model needs it, what would have to be
touched and how heavy it is.

**Priority** — how much the task raises the value of the model as a teaching
tool: P1 — noticeably widens what can be shown; P2 — useful, but does not change
the picture; P3 — optional.

**Size** — S: a change in one module, hours; M: a new assembly or regime, a day
or two; L: touches several modules and the physics, longer.

## Summary

| # | Task | Area | Priority | Size |
|---|---|---|---|---|
| BL-01 | Start failures: hot start, hung start | Physics and regimes | P1 | M |
| BL-27 | Start visualisation: starter, igniters, sequence | Physics and regimes | P1 | M |
| BL-02 | Limits and protections: T4, maximum speeds, red zones | Physics and regimes | P1 | M |
| BL-03 | Compressor surge visualisation | Physics and regimes | P2 | L |
| BL-04 | Bleed air aft of the HP compressor | Flows | P2 | M |
| BL-17 | Fuel supply visualisation | Flows | P1 | M |
| BL-18 | Journey of an air particle from intake to nozzle | Flows | P1 | L |
| BL-21 | Contrail behind the engine (done) | Flows | P2 | — |
| BL-05 | Thrust reverser | Geometry and flows | P2 | L |
| BL-06 | The engine at altitude: characteristics (ambient conditions done) | Physics | P2 | M |
| BL-23 | Engine selection: CFM56, LEAP, geared, three-spool | Geometry and sound | P1 | L |
| BL-19 | Real dimensions: dimension lines and a figure for scale | Geometry | P1 | S |
| BL-20 | Nacelle: what is left after the flat bottom | Geometry | P2 | M |
| BL-07 | Section by an arbitrary plane | Interface | P2 | M |
| BL-08 | Occlusion-aware labels | Interface | P1 | S |
| BL-09 | Camera presets and a tour of the gas path | Interface | P2 | M |
| BL-10 | Model state in the URL | Interface | P3 | S |
| BL-11 | Responsive layout and touch control | Interface | P2 | M |
| BL-12 | Localisation into eight languages (done) | Interface | P3 | — |
| BL-22 | Teaching layer: explanations from simple to formulas | Teaching | P1 | L |
| BL-13 | Sound absorption in air with distance | Sound | P3 | S |
| BL-14 | Separating fan and jet sound in space | Sound | P3 | M |
| BL-24 | Publishing on Vercel | Infrastructure | P1 | S |
| BL-28 | Publishing the container image: registry, tags, CI | Infrastructure | P3 | S |
| BL-25 | Code obfuscation in the published build | Infrastructure | P3 | M |
| BL-26 | Versioning: releases, formats, compatibility | Infrastructure | P2 | M |
| BL-15 | Bundle splitting and LOD for blade rows | Performance | P2 | M |
| BL-16 | Automated run of the sound test | Tests | P2 | M |

## Physics and regimes

### BL-01. Start failures

At the moment every start succeeds: the starter spins N2 up, light-off produces
a temperature overshoot, and the engine settles at a stable idle. A real start
can end differently, and it is exactly those scenarios that are the most
interesting to show.

What to add: a **hot start** — T4 goes past its limit because of early light-off
or a weak starter; a **hung start** — N2 stops below idle and the temperature
stays high; a **failed light-off** — fuel is on, there is no flame, a dry motor
is required. Each scenario is a branch in the state machine
`src/engineState.js` plus an indication on the panel.

Touches: `src/engineState.js`, the panel in `index.html`, the tests in
`test/engine-state.test.mjs`. To be documented in
[Operating regimes](05-modes.md).

### BL-27. Start visualisation

The start already works in the model — and yet it is almost invisible. The state
machine in `src/engineState.js` honestly runs the whole sequence: the starter
spins the HP rotor up, at 22 % the fuel is turned on and light-off happens with
a flare and a temperature overshoot, at 30 % the starter cuts out, and the rotor
comes up to idle. But all that can be seen on screen is the blades starting to
turn, then a flame appearing, and a line in the corner changing to "starter
cranking, light-off…". There is no starter, no igniters and no air supply in the
model at all: the starter is mentioned in one phrase on the accessory gearbox
card, and there are no igniters in the combustor geometry, which has only the 20
fuel nozzles.

Meanwhile the start of a turbofan is a non-obvious and therefore interesting
thing: it does not fire up by itself, it has to be spun by somebody else's
energy up to a speed at which the compressor begins to deliver enough air, and
only then does supplying fuel make sense. It is worth showing in full.

**Geometry that is missing:**

* **The air starter** on the accessory gearbox and the air supply to it — from
  the APU, from a ground unit or from the other running engine. A supply duct
  with flow going through it explains the main point: the energy comes from
  outside.
* **Igniters** in the flame tube — two of them, with their operation visible:
  short sparks with the characteristic click before light-off, ceasing once the
  flame is established. The window for this already exists in the state machine:
  `LIGHT_DELAY` = 2.5 s pass between fuel introduction and the appearance of the
  flame, and throughout that time there is fuel in the chamber but no flame.
* **Starter cut-out** — a visible event rather than a number simply
  disappearing: the drive disengages and the flow through the supply duct stops.

**The sequence in the interface.** A phase bar with the thresholds marked and
the current position on it: cranking → fuel on at 22 % → light-off →
acceleration → starter cut-out at 30 % → idle at 56 %. The thresholds are
already given by the constants `LIGHT_N2`, `START_N2`, `IDLE_N2` — the bar can
be built directly from them, and then it will not drift out of step with the
behaviour. The same place should show the time from the beginning of the start:
a real start takes tens of seconds, and that in itself is useful knowledge.

**Sound.** At present the synthesis is tied to rotor speed, and a start simply
sounds like a build-up. A real start has a different structure: first the whine
of the starter and of the HP rotor being cranked, without any fan tone, then the
dull thump of light-off and the arrival of combustion noise, and only after that
does the fan come in. These are three different sources, and by them one can
hear which phase the engine is in without looking at the screen.

**The order of the phases is the main thing to explain.** Why fuel is supplied
only after the cranking (otherwise it will not ignite but will flood the
chamber, giving a hot start), why the starter cuts out before idle is reached
(from that speed the engine already winds itself up), why the LP rotor starts
turning without any drive at all — it is picked up by the flow, and that is
already how the code does it.

Related: BL-17 (fuel supply) — filling the manifold at the light-off threshold
is the key visual moment of a start, so the tasks go well one after the other.
BL-01 (start failures) — first show a normal start, then break it; without the
first the second does not read. BL-22 (teaching layer) — "what happens during a
start" is already on its first-tier list of phenomena, and this task gives it a
picture. BL-05 — the starter and the accessories live in the same zone as the
accessory gearbox.

Touches: `src/engine.js` (starter, air supply, igniters), `src/airflow.js` (flow
in the starter duct), `src/sound.js` (starter whine, light-off thump),
`src/main.js` and `index.html` (phase bar, start time). The state machine in
`src/engineState.js` will barely need changing — the thresholds are already
there. To be documented in [Operating regimes](05-modes.md).

### BL-02. Limits and protections

The model knows nothing about limits: the throttle can be moved anywhere, and T4
and the speeds simply follow it. What is needed are limit values for T4, N1 and
N2, red zones on the instruments, a warning when they are exceeded and, as a
separate step, a simple FADEC-style governor that holds the fuel back at the
limit by itself.

The value is that a distinction appears between "the engine is running" and "the
engine is running within limits" — without which the instrument panel is
decorative.

Touches: `src/engineState.js`, the instrument panel,
[Physics of the model](03-physics.md).

### BL-03. Compressor surge visualisation

The most spectacular of the abnormal phenomena and, perhaps, the best way to
explain that a compressor is not a pump that pushes harder the faster it spins,
but a turbomachine with its own stability boundary.

**What happens.** A compressor blade is a wing, and it has a critical angle of
attack. Raise the pressure behind the compressor higher than the current airflow
allows, and the flow separates from the suction sides of the blades. From there
two scenarios follow: **rotating stall** — a zone of stalled flow runs around
the circumference (more slowly than the rotor, at roughly half its speed), the
engine shakes and thrust falls; and **surge** proper — axial oscillation of the
whole gas path, when the compressed gas breaks back through the compressor and
is expelled forward through the intake, with a bang and a flash. Then the
pressure falls, normal flow is restored, the compressor builds pressure again —
and the cycle repeats several times per second until the fuel is pulled back.

**Why it should arise in the model.** Not from a dedicated button but as a
consequence of the regime — otherwise all the instructiveness is lost. The
natural scenario is a rapid acceleration, when fuel is supplied faster than the
rotor can spin up: the pressure behind the HP compressor rises while the airflow
does not yet. `src/engineState.js` already has everything needed for this:
separate `n2` and `keff` with different time constants. It is enough to
introduce a stability margin as a function of the mismatch between fuel supply
and actual speed and compare it against a threshold. In the same way surge
should arise when the limits from BL-02 are exceeded and when bleed air is taken
beyond measure (BL-04).

**How to show it.** This is where the bulk of the work is, across four
subsystems:

* **Flow** (`src/airflow.js`) — in the core duct the axial velocity over the HPC
  section goes negative, particles travel back towards the intake and are
  expelled ahead of it, while the bypass duct carries on as before. For rotating
  stall — one or two sectors around the circumference where the particles almost
  stand still; the sectors rotate more slowly than the rotor, and that is
  visible in the picture.
* **Flame and temperature** — hot gas expelled forward and a T4 overshoot: less
  air passes through the chamber while fuel is supplied at the same rate, so the
  temperature rises sharply. The colour of the core particles moves up the
  existing scale in the process — no separate mechanism is needed.
* **Instruments** (`src/main.js`) — a droop and oscillation of N2, a T4 spike, a
  collapse of thrust, a warning on the panel. This sits well on top of the red
  zones from BL-02.
* **Sound** (`src/sound.js`) — a series of sharp bangs a fraction of a second
  apart over an intermittent roar. There is no impulsive component in the
  synthesis as it stands; it would have to be added: a short pulse driven
  through the resonance of the duct.

**The compressor map.** The most valuable addition is a small chart in the
corner: corrected flow and pressure ratio on the axes, with the working line on
it, the surge line above it and a point for the current state. One can watch the
operating point climb during a rapid acceleration and run into the boundary, and
return into the margin when the throttle is pulled back. That chart explains the
phenomenon better than the animation of the expulsion itself — and together they
close the topic.

**Recovery from surge.** Both outcomes are worth showing: pull the throttle back
and the flow is restored, the engine returning to a stable regime; keep holding
it and the surge turns into a steady stall with hung speed and rising
temperature, after which only shutdown remains. The second outcome joins up with
BL-01, where hung speed is already described for the start.

**An honest caveat.** The model does not solve the equations of gas dynamics, so
the stability boundary here is not computed but given by a table of typical data
— as is already done with the velocity and temperature profiles. This has to be
stated plainly in the documentation, so that the compressor map is not taken for
a calculation.

Order: do it after BL-02, because surge should be a consequence of going beyond
the boundary of a regime, not a button of its own. The computational part — the
stability margin, the threshold, the oscillation — is best kept in
`src/engineState.js`, so that it is checked under Node together with the rest of
the state machine (`test/engine-state.test.mjs`).

Touches: `src/engineState.js`, `src/airflow.js`, `src/sound.js`, `src/main.js`,
`index.html`, the tests. To be documented in
[Operating regimes](05-modes.md) and [Physics of the model](03-physics.md).

### BL-04. Bleed air aft of the HP compressor

The bleed ports behind the compressor already exist geometrically, but no flow
goes through them. It is worth running branches off to cool the HP turbine
nozzle guide vanes and to the air conditioning, with their own colour in the
legend. This explains why the turbine survives temperatures above the melting
point of its own alloy — a question that occurs to everyone who looks at the
station table.

Touches: `src/airflow.js`, the flow legend, [Airflow](04-airflow.md).

### BL-17. Fuel supply visualisation

Fuel exists in the model as a number and as consequences — `eng.fuel` turns the
supply on, `eng.burn` is proportional to the flow, and temperature, thrust,
flame and sound all depend on it. But the path of the fuel is not visible at
all: the fuel pump is mentioned only on the accessory gearbox card, the pipework
under the nacelle is not separated into fuel, oil and air lines, and while the
20 combustor fuel nozzles have a body and a swirler there is no supply to them —
in `src/engine.js` there is a comment "fuel line running outboard" in that place
with no geometry behind it.

Because of this the start looks unmotivated: the starter turns the rotor, then a
flame suddenly appears. A visible fuel supply ties light-off, throttle position
and combustion intensity into one comprehensible chain — which is why the task
is P1 despite not changing the physics.

What to do:

* **Geometry of the path** — a pipe from the pylon to the pump on the accessory
  gearbox, the metering unit, a climb up the HPC casing to the annular fuel
  manifold around the combustor and 20 branches from it to the fuel nozzle
  stems. A separate material and colour, so that the fuel line differs from the
  oil line and from the bleed air pipework.
* **Flow animation** — movement along the pipes with intensity and speed taken
  from `eng.burn`: at cut-off the flow stands still, at light-off it appears
  abruptly, during acceleration it speeds up. Easiest with a scrolling texture
  or a UV offset along the pipe, without particles: the cross-section is small
  and individual particles do not read in it.
* **Spray at the nozzles** — a short cone of atomised fuel from each nozzle into
  the dome of the flame tube, dying together with the flame.
* **A toggle and a legend** — together with a keyboard shortcut, following the
  pattern of the airflow display; plus a fuel flow line on the instrument panel.

Separately it is worth showing what makes light-off comprehensible: fuel appears
in the manifold not straight away but on reaching `LIGHT_N2` (0.22 of nominal
N2) — that is exactly the threshold at which `src/engineState.js` opens the
supply, and the visible filling of the line at that moment explains the start
sequence better than any caption.

Touches: `src/engine.js` (geometry and materials), `src/airflow.js` or a
separate module (flow animation), `src/main.js` (toggle, frame loop),
`index.html` (button, legend, flow line). To be documented in
[Geometry](02-geometry.md) and [Airflow](04-airflow.md).

Related: with BL-04 (bleed air) it shares the mechanics of "show another medium
in its own colour" — if both tasks are done, the legend and the toggles should
be designed for several media from the outset. With BL-01 (start failures) — a
failed light-off looks exactly like "fuel is flowing, there is no flame".

### BL-18. Journey of an air particle from intake to nozzle

At present the flow is shown "from above": thousands of particles travel through
both ducts, while the parameters are given separately in a table of seven
stations under the legend. The connection between picture and numbers is left
for the reader to make. The opposite view is more interesting — from the point
of view of a single particle: pick one at the intake and travel the whole gas
path with it, seeing at every step what happens to it.

Half the mechanics for this already exists. A particle in `src/airflow.js`
stores `x`, `lane`, `phase` and its duct, and the tables `CORE_V`/`BYPASS_V`,
`CORE_SWIRL`, `CORE_T` give velocity, swirl and temperature **at any point** of
the gas path, not only at the stations. Three things are missing.

**A continuous pressure profile.** Pressure is given by only seven values in
`STATIONS` (`src/main.js`) — a card travelling with the particle needs a table
of "axial coordinate → pressure" consistent with those seven points, otherwise
the numbers will jump at the transitions. This is the only part of the task that
calls for a decision about physics rather than about code: where exactly along
the HPC the compression accumulates, how the pressure falls in the combustor and
across the turbine.

**The fork between ducts.** A particle is assigned its duct at birth and never
changes it — the flow does not cross from one duct to the other. But for the
story it is precisely the fork at the splitter that is the climax: nine parts of
the air go outside and produce almost all the thrust, one goes into the core. So
on the approach to the splitter there should be a stop with a choice — "go into
the bypass duct or into the core" — and the option to return to the fork and
take the other branch.

**Guidance and a card.** The camera follows the particle, the casings switch to
x-ray or cutaway automatically (as already happens when the flows are turned
on), and a card travels alongside with the current values: temperature,
pressure, axial velocity, swirl, fraction of the path covered and one sentence
about what happens here and where the particle will go next. Plus pause,
stepping by stations and a scrub bar along the whole gas path — so that one can
go back and re-watch a particular stretch.

A separate note about time. A real particle crosses the engine in tens of
milliseconds — the journey has to run in heavy slow motion, and the slowdown
factor is worth showing right on the card. Otherwise a false impression of the
pace of the processes results, and the model already deliberately understates
absolute velocities for the sake of a legible picture.

What to show at the stops: acceleration and pre-compression in the intake, the
work of the fan and the rise of swirl across the rotor with its removal by the
outlet guide vanes, the fork, the stepwise build-up of pressure and temperature
in the booster and the HPC, the deceleration of the flow in the diffuser ahead
of the chamber (the velocity there is at a minimum — otherwise the flame is
blown out), heat addition at almost constant pressure, expansion through the
turbines where the gas gives up work to drive the compressor, and acceleration
in the nozzle. And a final comparison of the two branches: the bypass particle
is cold and fast, the core one has been through heating to fifteen hundred
degrees — and yet the bypass one produced more thrust.

The size L comes mainly from the camera guidance and the pause mode. A trimmed
version — no camera flight, just the card and a scrub bar driving the selected
particle along the gas path — comes out at M and already delivers most of the
value.

Touches: `src/airflow.js` (the selected particle, the pressure profile),
`src/main.js` (camera, mode, card, reuse of `STATIONS`), `index.html` and
`src/style.css` (the card and the scrub bar). To be documented in
[Airflow](04-airflow.md), with the formulas in
[Physics of the model](03-physics.md#stations).

Related: with BL-09 (camera presets and tour) it shares the mechanism for camera
scenarios — they should be built on one foundation, the only difference being
that the tour goes by module while this mode goes by particle. With BL-04 (bleed
air) — the journey naturally shows where part of the flow leaves to cool the
turbine. With BL-17 (fuel supply) — in the combustor the particle meets the
spray from the fuel nozzles.

### BL-21. Contrail behind the engine — done

Built. `src/contrail.js` computes the Schmidt — Appleman criterion, the panel
shows the verdict, and `src/contrailView.js` draws the trail; the physics is
written up in [Physics of the model](03-physics.md#9-the-contrail) and the
drawing in [Airflow](04-airflow.md#contrail).

**What it does.** The slope of the mixing line `G = EI·c_p·P / (ε·Q·(1 − η))`,
the threshold temperature from it, and two independent verdicts: whether a trail
forms (the engine matters, through the slope) and whether it lasts (the engine
does not matter at all — only whether the ambient air is supersaturated over
ice). At eleven kilometres on a standard day at 60 % humidity the model gives a
threshold of −49.5 °C against −56.5 °C ambient and a persistent trail; from the
ground the trail would start at 9.6 km. The panel says how far the conditions
are from the threshold and what would have to change.

**What was decided along the way.**

* **The efficiency became a slider**, not a computed value. Computing it needs
  the fuel flow and the flight speed, and the model has neither. As an input it
  is honest, and it is the control that shows the counter-intuitive part: a more
  efficient engine leaves a trail *more* readily, because less of the fuel's
  energy stays in the jet as heat.
* **The velocity of the mixture is not shown**, though the task asked for it.
  The absolute velocities in the model are deliberately reduced about 150 times,
  so a figure in metres per second would be an invention. The mixture
  temperature is shown, and the criterion does not need the velocity.
* **The threshold is not taken on trust.** It comes from a published fit, and
  the test checks the property the fit approximates — that the saturation curve
  has exactly the slope of the mixing line there — rather than the fit against
  itself.

**What is left, and why.** One trail along the axis rather than the two ropes
wound up by the wingtip vortices: that needs an aircraft in the frame, and there
is none in the model. The trail is a 38 m spindle rather than a band running to
the horizon — a real one is kilometres long, hundreds of times past the far
plane. The ice crystals are not modelled as such, only the verdict
on their fate.

### BL-05. Thrust reverser

The reverser doors in the bypass duct, their deployment by a button and the
rearrangement of the flow: the bypass duct turns forward and outward, the core
carries on aft. A heavy task — it needs both new geometry with animation
(`src/engine.js`) and a switch of the ducts in `src/airflow.js`.

### BL-06. The engine at altitude: ambient conditions and characteristics

The model works at a single point — on the ground, on a standard day, parked.
Meanwhile an aircraft spends almost all of its flight at ten or eleven
kilometres, where the air is three times thinner and seventy degrees colder, and
the engine behaves differently there. Several tasks do not work without this —
first and foremost the contrail (BL-21), which does not occur near the ground at
all.

**Ambient conditions — done.** `src/atmosphere.js` computes the standard
atmosphere: up to 11 km the temperature falls by 6.5 °C per kilometre from
+15 °C at sea level, above that it holds at −56.5 °C; pressure follows from the
barometric formula and density from the equation of state. The panel has an
altitude slider, a deviation of the day from standard and the buttons 0 / 3 /
11 km; the station table is counted off from the result, with the temperature
rises scaled by `θ = T/288.15`, since the work of a compressor stage is
proportional to the inlet temperature. The details are in
[physics](03-physics.md#ambient-conditions), the module is checked against the
ISA table by `test/atmosphere.test.mjs`.

The deviation from standard moves the temperature and the density but not the
pressure — the altitude here is the pressure altitude — so the slider shows
directly why an engine loses thrust in the heat: 15 °C above standard makes the
air 4.9 % thinner at the same pressure.

**Humidity** followed, with its own consumer so as not to be a dead slider: the
vapour pressure and the dew point on the panel, and the saturation over ice that
BL-21 will read. The **Mach number** is still absent — it belongs with ram
compression below, which is not done. What remains of the task is everything to
do with the engine itself.

**Ram compression.** At speed the air is decelerated in the intake, and the gas
arriving at the fan has raised pressure and temperature:

```
T₁ = T_H · (1 + 0.2·M²)
P₁ = P_H · (1 + 0.2·M²)^3.5
```

This explains something non-obvious: as speed grows the flow through the engine
increases, and yet the thrust still falls, because the exhaust velocity
approaches the flight speed.

**How to recompute without computing the cycle.** There is no point dragging a
full thermodynamic calculation into an illustrative model — it is deliberately
left out of the backlog. The honest and cheap route is similarity theory: switch
to **corrected parameters**, where speed is normalised by the square root of
inlet temperature and flow by temperature and pressure:

```
n_corr = n / √(T₁ / 288.15)
```

The point is that an engine "knows" not absolute but corrected speed: at
altitude the air is colder, so at the same physical speed the corrected speed is
higher and the compressor works closer to its limit. All the speed dependencies
already in the model — the `n1²` and `n2^2.5` compression, the station
temperatures, the velocity profiles — then stay as they are but take corrected
speed as their input, while thrust and flow are multiplied by the pressure and
density ratios. The edits come out local, and the behaviour becomes
qualitatively right: at cruise the speeds are higher, the thrust is about a
third of the sea-level value, and the temperature behind the compressor is
lower.

**What to show.** The Mach number alongside the existing ambient conditions,
regimes on a single button — parked, take-off, climb, cruise — and, if possible,
a second row in the station table for "sea level / altitude" comparison. That
also gives meaning to the station table, which at present is always about one
regime.

The point where it will show most plainly is the thrust gauge: today it reads
121 kN at take-off power whether the engine is parked or at eleven kilometres,
which is the one place where the panel currently lies. That is the first thing
to fix when this task is picked up.

Touches: `src/engineState.js` (corrected speeds), `src/main.js` (thrust, the
`STATIONS` regime), `src/atmosphere.js` (ram compression from the Mach number —
the relative quantities `θ`, `δ`, `σ` it already returns are exactly what the
similarity relations need), `index.html`. To be documented in
[Physics of the model](03-physics.md#10-what-the-model-does-not-have), where the
absence of the recomputation is now stated explicitly.

Related: BL-21 (contrail) needed only the ambient part, and that part is now
complete, humidity included. BL-02 (limits) — at altitude the
corrected-speed limit becomes the governing one. BL-03 (surge) — the stability
margin depends on the corrected parameters.

## Geometry and dimensions

### BL-23. Choosing an engine from a list

At present the model has one engine, and it is wired into the code: the stations
are the `ST` constants, the blade rows are created by name, the blade and stage
counts stand as numbers in the calls, the duct tables in `src/airflow.js` are
literals, and the sound synthesis is tuned to the spectrum of recordings of one
particular CFM56-7B. The task is to make the engine **selectable**: a drop-down
list at the top holding several real engines with the aircraft they are fitted
to, and on switching everything is rebuilt — geometry, flows, sound, mechanics,
installation on the wing.

The value is not in a variety of pictures but in comparison. The engine of the
737 and the engine of the A320 solve the same problem and look different, and
when they can be switched in one click the differences stop being text in a
reference book: one can see that one has a noticeably larger fan, another a
round nacelle, and a third a fan turning three times slower than its rotor
because there is a gearbox between them.

**What has to change on selection:**

* **Geometry** — fan diameter and blade count, the number of booster, HPC, HPT
  and LPT stages, module lengths and diameters, the shape of the nacelle and the
  pylon. This is the main part of the work: the engine description has to become
  data, and `src/engine.js` a builder driven by that data. It currently holds
  over 1200 lines with dimensions and counts written straight into the calls.
  Half the job is already done elsewhere: the CFM56-7B reference data lives in
  [`docs/engines/`](engines/README.md) with citations, and the tests compare the
  model against it — what is missing is building from it as well.
* **Mechanics** — the number of shafts and how they are linked. Most engines
  have two spools, Rolls-Royce has three, and in a geared engine the fan and the
  low-pressure turbine turn at different speeds. This changes both
  `src/engineState.js`, which currently has exactly two rotors, and the picture:
  in a geared engine a planetary gearbox appears between the shaft and the fan,
  and that is worth showing in its own right.
* **Flows** — the bypass ratio sets the ratio of the flows and the appearance of
  the jet; the duct tables should be built from the geometry rather than
  specified separately.
* **Sound** — the blade passing frequency is computed from the blade count and
  the speed, the blade tip tangential speed from the diameter, and the buzz-saw
  onset from that. When the engine changes, all of this changes by itself,
  provided it is computed from parameters.
* **Installation** — ground clearance, the forward offset relative to the wing,
  the shape of the pylon, the position of the accessories. It is useful to show
  the outline of the wing and fuselage of the aircraft the engine is fitted to —
  then it becomes visible why the 737 intake is flattened underneath while the
  A320 one is round: they have different ground clearance.

**Whom to add.** A sensible set is one representative of each fundamentally
different architecture rather than ten similar ones: the CFM56 as the classic
narrow-body engine, the LEAP as its modern replacement, a geared engine
(PW1100G) for the gearbox and the very large fan, a three-spool Rolls-Royce for
the third spool and, if there is strength left, something wide-body — there the
scale is different and there are chevrons on the nozzle. The specific numbers —
diameters, blade and stage counts, bypass ratio, thrust — must be collected into
a table with citations; without that the result is not a choice of engines but
one engine in different sizes.

**An honest caveat about the sound.** The current synthesis is tuned to
measurements of real CFM56-7B recordings: the envelope over 48 shaft orders was
taken from a recording and loaded into a `PeriodicWave`. For other engines there
are no such measurements. The frequencies will recompute themselves, but the
shape of the spectrum would have to be either taken as a common one with a
correction for blade count, or measured for each engine by repeating the method
from [Sound](06-sound.md). The interface should mark what is measured and what
is taken by analogy.

**Order of work.** The task is large but divides: first parameterisation —
extract the description of the current engine into data such that the model
assembles from it and looks exactly as it does now (a step with no visible
result, but the one that determines success); then a second engine of the same
architecture — a check that the description is sufficient; then sound from
parameters; then the gearbox and the third shaft, which break the assumption of
two rotors.

The format of the description and the design of the loader are worked out
separately — [Engine description format](10-engine-plugins.md): engines are
specified by JSON files in `public/engines/`, read at run time, so adding a new
one requires no rebuild. The same document covers inheritance through `extends`,
the boundary between data and code, schema validation and the order of
implementation.

Related: BL-20 (nacelle) becomes a special case — the question "which prototype
are we on" is settled by picking from a list rather than editing constants, so
they are worth doing together. BL-19 (dimensions) — comparing sizes acquires
meaning precisely when switching. BL-22 (teaching layer) — "why does this engine
have a bigger fan" begs to be explained. BL-15 (LOD) — switching must not
rebuild the scene with a jolt.

Touches: `src/engine.js` (a builder driven by a description), `src/blade.js`,
`src/airflow.js`, `src/engineState.js` (shaft count, gearbox), `src/sound.js`
(frequencies from parameters), `src/main.js` and `index.html` (the list, scene
rebuild), and all the documentation in `docs/` — it is currently written about
one engine.

### BL-19. Real dimensions: dimension lines and a figure for scale

The model is built to an honest scale — 1 model unit = 0.50 m, fan Ø 1.549 m —
but none of that is visible on screen: the engine hangs in a void without a
single reference, and there is no way to grasp that the fan is as tall as a
person. The values themselves now exist and are checked against sources (see
[Dimensions from sources](02-geometry.md#dimensions-from-sources)) — all that is
missing is showing them.

What to add: a toggleable dimension layer — fan diameter, nacelle outer diameter
and length, length from the intake lip to the nozzle exit, core diameter — with
extension lines and captions in metres that turn to face the camera. Plus the
silhouette of a person beside the engine at the same scale: one figure explains
the size better than all the captions put together. For a vivid comparison, the
outline of a Boeing 737 fuselage section in the background, so that it is
visible that the fan is comparable in diameter to the aisle of the cabin.

In addition — showing the dimensions of the selected module on its card: click
on the HPC and see not only a description but also its length and diameter in
metres. The values come from the existing `ST` constants and radii, converted by
the scale factor.

One further detail that makes the picture honest: a real engine on the 737 hangs
very low, with less than half a metre of ground clearance. A ground line under
the model carrying that dimension immediately explains why the nacelle has the
shape it does, and leads into BL-20.

Touches: `src/engine.js` (dimension constants), `src/main.js` (dimension layer,
toggle), `index.html` (button, module card). To be documented in
[Geometry](02-geometry.md).

### BL-20. Nacelle: what is left after the flat bottom

**The main part is already done.** The nacelle has stopped being a surface of
revolution: `flattenBelly()` trims the bottom of each section with a smooth
minimum by `BELLY` = 0.32 units, the cowl profile is split into an outer skin
and an inner gas path (flattened differently: outside, flat from the lip to the
fan cowls; inside, only near the lip, otherwise it would shave the blade tips
off), and the normals are welded at the 0 / 2π joint. The accessories have moved
from six o'clock to the side by a 62° rotation of the group, together with the
picking proxy, the label and the explode vector — without which the flat bottom
would contradict the layout. Details are in [Geometry](02-geometry.md).

**The dimensions are taken from sources.** The nacelle outer diameter, its
lengths to the nozzle exits, the depth of the flattening, the fan blade diameter
and chord, and the length, height and width of the bare engine are no longer
chosen by proportion: they are written out in
[`docs/engines/cfm56-7b-nacelle.json`](engines/cfm56-7b-nacelle.json) with
citations to Boeing ACAP, EASA TCDS and the NTSB, and carried into the model.
The comparison is run by `test/geometry.test.mjs` (dimensions against that same
JSON) and `test/clearance.test.mjs` (rows do not intersect, accessories do not
pierce the skin). Details and consequences are in
[Geometry](02-geometry.md#dimensions-from-sources).

Three things remain, and the first of them is not decoration but a visible
defect.

* **The flow path does not know about the flat bottom.** The duct boundaries in
  `src/airflow.js` are given by tables of "axial coordinate → radius", that is,
  they are axisymmetric. The nacelle is cut away underneath while the duct is
  not, so right at the lip the bypass particles poke out through the barrel. The
  cure is either the same flattening profile applied to the boundary radius as a
  function of circumferential angle, or constraining the particles by the shape
  of the barrel. The first is more honest and also prepares the ground for
  asymmetric nacelles generally.
* **Structural breakdown.** The intake barrel, the fan cowls opening upwards on
  latches, the core cowl, the fan nozzle — with visible split lines. Separately,
  the acoustic panels on the inner surface of the intake: their perforated
  surface reads well and explains why the finish there is what it is.
* **A pylon matching the prototype.** At present it is a flat extruded shape
  (`pylonShape` in `src/engine.js`). On the 737 the engine is carried ahead of
  the wing and slung in a characteristic way — the shape is recognisable and
  worth building.

**The prototype is no longer mixed.** The nacelle and engine dimensions, the fan
blade count and the layout — 3 booster stages, 9 HPC, 1 HPT, 4 LPT — are all
from the CFM56-7B. The earlier 10 / 2 / 5 came from the LEAP-1B and, packed into
the published length of 2.508 m, produced an unnaturally tight stage pitch;
after the alignment to the prototype the pitch became natural and the blade
chords returned to real values. Checked in `test/geometry.test.mjs`. For the
nacelle the difference is substantial: on the MAX it is larger and carried
forward differently. If BL-23 is done, the question dissolves into it — the
prototype becomes a choice from a list and the nacelle a part of the engine
description, including the depth of the flattening and the rotation angle of the
accessories. Then it is sensible to run both tasks together.

Related: with BL-05 (thrust reverser) — the doors live in the bypass cowls, so
the structural breakdown should be designed with them in mind from the start.
With BL-19 — dimension lines only become meaningful once the dimensions are
taken from sources.

Touches: `src/airflow.js` (duct boundaries), `src/engine.js` (structural
breakdown, pylon, dimensions). To be documented in [Geometry](02-geometry.md)
and [Airflow](04-airflow.md).

## Interface and visualisation

### BL-07. Section by an arbitrary plane

At present only a sector around the axis is cut out. A section plane with
controllable position and tilt (through `clippingPlanes` in Three.js) would
allow looking at the engine in cross-section — for instance, showing the annular
combustor with its twenty fuel nozzles end-on.

Touches: `src/main.js`, the materials in `src/engine.js`.

### BL-08. Occlusion-aware labels

Labels of internal modules show through the nacelle, which makes it unclear what
is where. What is needed is a visibility check of the label anchor point — by
ray or against the depth buffer — and dimming of occluded labels. A small change
with a noticeable effect, hence P1.

Touches: `src/main.js`, `src/engine.js` (label positions).

### BL-09. Camera presets and a tour of the gas path

A set of named viewpoints — fan, combustor, turbine, nozzle — with smooth
flights between them. From these an automatic tour can then be assembled: the
camera travels along the gas path from the intake to the nozzle, showing the
module card at each station. This turns the model from "drag it with the mouse"
into a ready-made narrative.

### BL-10. Model state in the URL

Viewpoint, operating regime, cutaway state and toggles — into the query string,
so that a particular view can be passed on as a link. Cheap and convenient when
demonstrating.

### BL-11. Responsive layout and touch control

The panel is designed for a wide screen and there are no gestures. What is
needed is a compact layout, collapsible sections and a sensible response to
touch. While at it, check that the scene runs at all on a mobile GPU — at 771
thousand triangles that is not obvious, and here the task joins up with BL-15.

### BL-12. Localisation — **done**

Eight languages: English, Russian, Spanish, Chinese (Simplified), French,
Portuguese (Brazilian), German and Japanese. The switcher is at the top of the
panel, the choice is kept in `localStorage`, and a first visit is matched
against the browser's own languages. See [`07-ui`](07-ui.md#interface-language).

This entry used to say the task was Russian only, and that the wording for a
second language was recoverable from the git history because the repository was
originally written in Russian. That was wrong: a scan of every commit reachable
from every ref finds no Cyrillic in any `.js` or `.html` file, including the
initial commit. All eight dictionaries were written from scratch.

Two things turned out to matter more than the volume of text, which is only
about 5 kB per language:

* The contrail explanation was assembled by concatenating clauses. Word order
  differs across the eight, so the fragments became whole sentences with the one
  remaining seam on a sentence boundary. The ceiling in "nowhere between the
  ground and 12 km" was a copy of `H_MAX` from `contrail.js` and is now a
  parameter, so eight translations cannot go stale if the search range moves.
* `Intl.NumberFormat` localises the decimal separator, which is the point, but
  it also groups thousands — and a T4 of 1604 °C printed as German `1.604 °C`
  reads as a number with a decimal point. Grouping is off.

What is left over and deliberately not done here: the language does not appear
in the URL (that belongs to BL-10), and imperial units are a separate axis from
language and would be their own task.

## Teaching layer

### BL-22. Explanations from simple to formulas

The model shows **what** happens but hardly explains **why**. The module cards
give a paragraph of description each, the documentation in `docs/` covers the
physics in detail — but these are two different worlds: the picture is on
screen, the explanation in a separate file, and the reader has to bridge them.
The task is to put the explanation inside the model and make it **layered**.

**Three levels of disclosure.** The same phenomenon is explained three times,
and the next level opens only on request:

1. **In plain words** — two or three sentences in everyday language, without a
   single term and without formulas. "An aircraft leaves a white band behind it
   because there is water vapour in the exhaust: at altitude it is very cold,
   and the vapour freezes into tiny ice crystals — a cloud that the engine makes
   itself."
2. **The mechanism** — what is connected to what and which quantities affect it,
   with a reference to what is visible on screen right now: why the trail does
   not begin right at the nozzle, why on one day it lingers for hours and on
   another melts within seconds, what the threshold depends on.
3. **The physics** — formulas, laws and limits of validity: the
   Schmidt — Appleman criterion, the mixing line, ice supersaturation, and along
   with them the honest caveat about what exactly is computed in the model and
   what is given by a table.

The point is that one and the same screen serves both the person who just wants
to look at a handsome engine and the one who wants to get down to the equations.
Nobody sees more than they want, but the depth is one or two clicks away. The
chosen level should be remembered: someone who once opened the third should be
shown the third from then on.

**Tied to live numbers.** The main difference from an article is that the
explanation substitutes the current state of the model: "right now it is 28 bar
and 600 °C behind the compressor — nearly thirty times atmospheric pressure, and
all that air was compressed by the blades you can see". When the regime changes,
the numbers in the text change. That way the explanation stops being an
illustration to the picture and becomes its continuation.

**Teaching through the controls.** An explanation may ask for something to be
done and highlight the relevant control: "pull the throttle back and watch the
operating point move away from the stability boundary", "climb to 10 km — a
trail will appear". The user does not read about the phenomenon but causes it.
That is precisely what distinguishes interactive material from text.

**First-tier phenomena:**

* **How a turbofan works at all** — compress, burn, expand; almost all the
  thrust comes from the fan, and the core exists to turn it. The base
  explanation the others hang off.
* **The contrail** (BL-21, built) — from "the vapour freezes" to the formation
  criterion and the difference between a vanishing and a persistent trail. The
  physics is in place and the panel states the verdict; what the teaching layer
  would add is the explanation of why.
* **Surge** (BL-03) — from "the compressor choked and the air went backwards"
  through flow separation on the blades to the stability boundary and the
  compressor map.
* **Why bypass** — why it pays to accelerate a lot of air a little rather than a
  little air a lot.
* **Why the turbine does not melt** — the gas is hotter than the melting point
  of its alloy (joins up with BL-04, bleed air for cooling).
* **What happens during a start** — why a starter is needed, where the order
  "crank → fuel → light-off" comes from (joins up with BL-17 and BL-01).
* **Where the engine sound comes from** — the fan whine and the jet roar as
  sources of different natures.

**How to store the texts.** Not in the markup and not in the rendering code, but
as a separate data module: phenomenon → three levels → which model quantities it
is tied to → which section of `docs/` the third level refers to. Otherwise the
explanations and the documentation will inevitably drift apart. The third level
should refer to a document rather than retell it: the physics is already written
in `03-physics.md`, and duplicating it is harmful.

**A comprehension check** — optional and ungraded: a "what would happen if…"
question with the option of checking the answer on the model itself. A cheap
addition that turns viewing into a lesson.

The size L comes from the volume of text, but the task divides by phenomenon:
the disclosure mechanism plus the first phenomenon is an M, after which each
further one is added independently. It is sensible to start with "how an engine
works", because the other explanations rest on it.

Touches: a new module with the texts and their bindings, `src/main.js`
(explanation panel, value substitution, control highlighting), `index.html`,
`src/style.css`. To be documented in [User interface](07-ui.md).

Related: BL-21 and BL-03 are the first candidates for treatment, and both are
conceived so that there is something to explain — the contrail already computes
and states more than it explains. BL-18 (the journey of a
particle) is a natural carrier of explanations: the card travelling with the
particle is already a first level. BL-09 (tour of the gas path) — a shared
mechanism for highlighting and guiding through a scenario. BL-12 (localisation)
— texts gathered into a single module simplify it greatly.

## Sound

### BL-13. Sound absorption in air with distance

The attenuation with distance is linear and absorption is not modelled — so as
the camera pulls away the sound stays bright in the 2…4 kHz band, whereas in
recordings it is noticeably quieter there. A lowpass filter whose cut-off falls
with distance would be enough. A cheap change that appreciably improves realism
at a distance.

Touches: `src/sound.js`, the "Space" section in [Sound](06-sound.md).

### BL-14. Separating fan and jet in space

At present the whole sound comes from one point — the centre of the engine. In
reality the fan tones are heard from the front and the jet noise from behind,
and that is noticeable as the camera orbits. Two emission points with separate
panning and directivity are needed.

## Performance and infrastructure

### BL-24. Publishing on Vercel

The model currently lives only on the developer's machine: `npm run dev` brings
up a server on `0.0.0.0`, and it can be shown to exactly those on the same
network. Yet this is precisely the sort of project one wants to open with a link
— no installation, no explanations. Publishing costs one evening and gives
meaning to everything else in this backlog: the work becomes visible.

Technically everything is ready for static hosting. There is no backend, no
environment variables and no external assets at all — no models, no textures, no
sound files; all geometry is built in code and the sound is synthesised. `npm
run build` produces a self-contained `dist/` that only needs serving.

What to do:

* **Connect the repository**, specifying the Vite preset, the `npm run build`
  command and the `dist` directory. Branches then get preview builds — handy for
  showing unfinished work by link without touching the main one.
* **Cache headers** through `vercel.json`: hashed assets — long-lived and
  immutable, `index.html` — no cache, otherwise people will keep seeing the old
  version for a week after an update. This matters separately for BL-23: the
  engine descriptions in `public/engines/` must be cached briefly, otherwise a
  new engine will not appear for anyone who has already visited.
* **A link preview card** — title, description and preview image, so that a link
  sent into a messenger looks like an engine model rather than a bare address. A
  static screenshot will do.
* **Check that only our own work is published.** `test/audio` holds recordings
  from Freesound under free licences, downloaded by a script; they do not go
  into the repository (`.gitignore` excludes `*.mp3` and `*.wav`) and do not go
  into the build either. This is worth confirming before publishing, and the
  README should state the origin of the recordings and their licence — they were
  used to tune the sound, and it is honest to say so.

What to check after publishing: the transfer size (the 731 kB bundle compresses
to about 198 kB, which is acceptable, though BL-15 would improve it), behaviour
on a phone — almost certainly surfacing what BL-11 describes — and that the
sound does not try to start before the screen is touched.

A separate caveat about BL-23. The idea of "dropping in an engine file without a
rebuild" works differently on static hosting: there is no live filesystem there,
and a new file appears through a commit and a deploy. In essence it is the same
thing — editing one file without building anything by hand — but "put a file in
a directory on the server" will not work. What remains is opening a description
from disk: that works in the published version and needs no deploy at all.

Touches: `vercel.json`, `index.html` (card metadata), `README.md` (a link to the
live version and the licences of the recordings). To be documented in
[Development](08-development.md).

### BL-28. Publishing the container image

The two-stage `Dockerfile` builds and runs locally: `docker build`, `docker
run`, and the model answers on 5188. What does not exist is any way to obtain
that image without a checkout and a build of one's own. Three decisions stand
between here and there, and none of them has been made — which is why the
container work stopped where it did rather than carrying on by guesswork.

* **A registry.** GHCR is the obvious candidate: the repository is already on
  GitHub, the workflow gets a token without anyone creating an account, and the
  image sits beside the code. Docker Hub costs nothing either, but it is a
  second place to hold credentials for.
* **A tagging policy.** This is not really a container question, it is BL-26's:
  what counts as a release here, and whether there are versions at all. `latest`
  plus the commit SHA is the least that lets somebody pin to something. Whatever
  BL-26 settles on for release naming, the image tags should follow it rather
  than grow a parallel scheme alongside.
* **Building it in CI.** The workflow tests and builds but does not touch the
  image, so a mistake in the `Dockerfile` or in `docker/nginx.conf` surfaces on
  somebody's machine instead of in a job. Building on every push is cheap and
  catches exactly that; *pushing* is the narrower question — on a tag, or on
  `main` only, and that answer depends on the two decisions above.

A compose file is a smaller, separate matter. For one static container it saves
typing `-p 5188:5188` and nothing more; it starts to earn its place only if
something is ever put in front of the model — a reverse proxy terminating TLS,
or the description service BL-23 would want.

Worth noting for BL-24: the caching and compression decisions in
`docker/nginx.conf` are the same ones `vercel.json` will have to make. Hashed
assets immutable for a year, `index.html` sent `no-cache`, and `gzip_comp_level`
raised from the default of 1 — which sends the bundle 19 % heavier than it needs
to be. That configuration is the worked-out version, arrived at by measuring;
it is worth copying rather than re-deriving.

Touches: `.github/workflows/ci.yml`, possibly a `compose.yaml`. To be documented
in [Development](08-development.md#docker).

### BL-25. Code obfuscation in the published build

With publication (BL-24) the sources travel into other people's browsers. The
value of the project is not in the panel markup but in the procedural blade
generator, the gas path layout and the sound synthesis tuned by spectral
analysis of real recordings; after the build all of that sits in one file that
opens under the "sources" tab. The task is to make analysing that code cost
noticeable effort.

**Build hygiene first.** Do not publish source maps (`build.sourcemap` must be
off — with them obfuscation is pointless) and look at what actually survives the
current minification: local variable names are shortened, but the module
structure, the export names and all comments inside template strings are
preserved. Even at that step it is worth measuring how readable the result is —
possibly there is no need to go further.

**Then obfuscation proper** — a build step on top of the bundle
(`javascript-obfuscator` and its Rollup wrappers): renaming, gathering strings
into a table decoded on the fly, flattening control flow into a dispatcher,
inserting dead code. The important thing here is not to overdo it: the last two
techniques cause most of the slowdown, and this project has a frame loop that
recomputes the positions of nine thousand particles every frame. A sensible
configuration is to process the geometry construction and the sound synthesis
aggressively, `src/airflow.js` and the loop in `src/main.js` cautiously, and to
measure the frame rate before and after rather than trusting a feeling.

**What obfuscation does not give — say it plainly.** Code executing in a browser
is always available: it can be read in the debugger, the finished geometry can
be taken off a running scene through WebGL, the sound graph parameters can be
pulled out of Web Audio. Shaders (`ShaderMaterial` in `src/airflow.js` and
`src/engine.js`) go to the GPU as strings and stay readable in any case. The
engine descriptions from BL-23 are data, and they are open by design.
Obfuscation raises the barrier to entry but does not make copying impossible;
expecting more from it is a mistake.

**What solves the problem better, if the goal is attribution.** There is
currently no licence file in the repository, although `package.json` says ISC.
An explicit licence, an attribution line in the interface and a statement of the
origin of the recordings used do more to protect the work than scrambled
variable names, and cost half an hour. That is worth doing in any case —
regardless of whether obfuscation happens.

**The cost.** The built file grows — noticeably so at aggressive settings, which
runs counter to BL-15, where the size is reduced instead. Debugging the
published build becomes nearly impossible, so a build mode without obfuscation
is needed for investigating problems users report. And the tests: they run the
sources directly (`test/engine-state.test.mjs` imports `src/engineState.js`) and
never see the obfuscation — so once it is enabled a separate check is needed
that the built version really works rather than merely builds.

**The priority decision.** P3 deliberately: the task adds nothing for anyone
looking at the engine and conflicts with the spirit of the rest of the backlog —
BL-22 makes the model a teaching tool and the description format open. If the
goal is not to give the work away, it is sensible to first answer what exactly
is being protected: the layout and the physics are described in detail in
`docs/` and are open by design, so what remains to close is the implementation.

Touches: the build configuration (`vite.config.js`), `package.json` (the build
step and a mode without obfuscation), `LICENSE`, `README.md`. To be documented
in [Development](08-development.md).

### BL-26. Versioning: releases, formats, compatibility

The project has no version at present. `package.json` has said `1.0.0` from the
start, there is not a single tag in the repository, and the history is a run of
commits with no marks showing where one finished version ended and the next
began. While the model lived on one machine this bothered nobody. With
publication (BL-24) and engine descriptions as files (BL-23), three things
appear at once that need versioning, and they differ in nature.

**The version of the project itself.** An ordinary semantic number, a tag in the
repository and a `CHANGELOG.md`. There is plenty to fill it with: the commits
here are written at length, with the reasoning explained, so a change log
assembles from them with almost no extra writing. A guide to what counts as
what: major — incompatibility of formats (engine descriptions, saved state);
minor — a new assembly, regime or layer; patch — fixes and text edits.

A subtlety particular to this project: **changing a physical coefficient is not
a patch**. Change the rundown time constant or a coefficient behind the turbine
and the model starts showing different numbers for the same actions, and those
numbers are cited by the documentation and, after BL-22, by the teaching
explanations. Such edits must go into the change log as a separate line,
otherwise the divergence between text and model will be discovered by accident
and late.

**The version in the interface.** A version number and a short build hash in the
corner of the panel or on an "about this model" card. After publication this is
the only way to tell which version someone reporting a problem is talking about
— and at the same time a check that they do not have an old page cached (see the
cache headers in BL-24). The values are stamped at build time, from
`package.json` and git.

**Format versions.** There are three, each with its own policy:

* **The engine description** — the `schema` field is already provided for in the
  [format design](10-engine-plugins.md). The rules need writing down: a major
  version is incompatible and rejected with a clear message, minor fields are
  added with defaults, and the loader must open files of all earlier minor
  versions of its own major version. Otherwise other people's descriptions will
  start breaking with every update of the model.
* **State in the URL** (BL-10) — links get shared, and a year-old link should
  still open. So either a version in the link itself, or a format in which
  unknown parameters are silently ignored and missing ones take their defaults.
  The second is simpler and sufficient here.
* **Settings saved in the browser** — should any appear: their format changes
  most often, and the rule is simple — on a version mismatch, reset to defaults
  rather than trying to read them.

**What is not needed.** Automatic version generation on every commit,
environments and release/development branches are not required by a project this
size — they would bring more fuss than benefit. A tag and a log entry at the
moment a version is ready to be shown are enough.

Touches: `package.json`, `CHANGELOG.md`, the build configuration (passing the
version and hash through), `index.html` and `src/main.js` (showing the version),
the description loader from BL-23. To be documented in
[Development](08-development.md).

### BL-15. Bundle splitting and LOD for blade rows

The build is 731 kB (198 kB gzip), almost all of it Three.js; the cure is
`manualChunks`. A further 64 kB is the eight locale dictionaries, which are all
bundled: lazy-loading them through dynamic `import()` would save about 19 kB
gzipped and belongs in this task rather than in BL-12, since it is the same
splitting question. Separately: rows with small blades are built at maximum
detail regardless of distance — levels of detail would take some of the load off
weaker machines. Both parts are needed if BL-11 is taken on.

Touches: the Vite configuration, `src/blade.js`, `src/engine.js`,
`src/locales/index.js`.

### BL-16. Automated run of the sound test

Comparing the synthesis against a recording is currently semi-manual: the
synthesis file is rendered in the browser from an `OfflineAudioContext`, then
the scripts in `test/audio` are run. This should be brought together into one
command with fixed mismatch thresholds, so that edits to `src/sound.js` do not
silently break the spectral agreement already achieved.

What stands in the way is that a headless browser renders the scene on a
software rasteriser at about one frame per second; the sound graph does not
depend on that, so the task is solvable — what is needed is a run of the audio
alone, without the scene.

Touches: `test/audio`, the scripts in `package.json`,
[Development](08-development.md).

## What is deliberately not in the backlog

A full gas-dynamic computation, a thermodynamic cycle calculation, blade
mechanics and heat transfer. The model is illustrative: it shows the
architecture and the qualitative behaviour of an engine. All of the above would
turn it into a calculation tool — that is a different project. More on the
boundary in
["Physics of the model", section 10](03-physics.md#10-what-the-model-does-not-have).
