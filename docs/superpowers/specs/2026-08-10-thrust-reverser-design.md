# Thrust reverser (BL-05)

Design spec, 2026-08-10.

## The problem

The model shows an engine that can only push forward. Everything a turbofan
does on landing — the sleeve sliding aft, the cascades appearing out of a
surface that looked solid, the blocker doors dropping across the bypass duct,
the roar changing character — is missing, and it is the one part of the engine
cycle a passenger actually experiences from the outside.

`docs/09-backlog.md` has it as **BL-05, P2, size L**: "The reverser doors in the
bypass duct, their deployment by a button and the rearrangement of the flow: the
bypass duct turns forward and outward, the core carries on aft. A heavy task —
it needs both new geometry with animation (`src/engine.js`) and a switch of the
ducts in `src/airflow.js`."

The nacelle already knows the reverser exists: `src/livery.js` paints the joint
between the fan cowl and the reverser at the midpoint of the barrel, and the
reference file describes the unit. Nothing behind that paint moves.

## What the prototype does

`docs/engines/cfm56-7b-nacelle.json`, `components.thrust_reverser`:

> Cascade-type thrust reverser of the bypass duct with a translating sleeve and
> blocker doors. The reverser halves, like the fan cowls, are hinged on the
> pylon. The reverser is structurally part of the nacelle and forms its aft
> section (the bypass duct).

Four consequences the model has to honour:

1. **Only the bypass duct is reversed.** The core carries on aft, unchanged.
   That is why a high-bypass reverser is worth having at all — the fan moves
   five times the mass of the core — and why the model's hot jet, heat haze and
   contrail must stay exactly as they are when the reverser deploys.
2. **The sleeve is the aft section of the nacelle.** There is no separate part
   bolted on: the skin the model already draws from `ST.a1` aft is, past the
   fan-cowl joint, the reverser. Deploying it means the nacelle gets *longer*.
3. **The cascades are hidden until the sleeve moves.** They sit in a fixed
   structure under the sleeve; the sleeve uncovers them by translating aft.
4. **The blocker doors are not separately powered.** They are dragged across
   the duct by links to the fixed structure as the sleeve translates, so door
   angle is a function of sleeve travel, not of time. One actuator, two
   motions — which is exactly the thing worth showing.

## Scope

In:

* a translating sleeve with cascades and blocker doors, built in code like
  everything else, animated by sleeve travel;
* a reverser state machine with the interlocks that matter (ground/idle
  selection, reverse power limit, auto-stow on shutdown);
* reverse thrust in the thrust read-out — negative, and of a believable size;
* the bypass flow leaving through the cascades, forward and outward, while the
  core stream is untouched;
* the sound of reverse: the fan roar unducted and the jet component gone;
* the reverser as its own module — card, label, picking proxy, explode.

Out, and deliberately:

* **Aircraft-level logic.** No weight-on-wheels, no airspeed, no autobrake
  interaction. The model has no aircraft. The "ground" interlock is expressed
  as what the model can actually know: the engine must be running.
* **Reverser failures** — asymmetric deployment, in-flight deploy, unlock
  warnings. That is BL-01/BL-02 territory (start failures, limits and
  protections) and belongs with them.
* **The fan cowl doors opening**, the structural breakdown of the nacelle into
  panels. That is the remainder of BL-20, and the backlog already says the two
  should be designed together — this spec supplies the half BL-20 asked for
  (the reverser is a separate group with its own stations) without doing BL-20.
* **A core-stream reverser.** The prototype has none.

## Dimensions: what the reference fixes and what it does not

The reference file gives the reverser's type, mounting and role, and no
dimensions at all. Nothing in the open sources states the sleeve stroke, the
cascade band length, the blocker door count or the door chord. Following the
convention in `docs/engines/README.md`, those go into a `not_published` list in
`components.thrust_reverser`, so nobody searches for them twice, and the numbers
the model chooses are declared as the model's own decisions — the same standing
as the intake-length ratio in `docs/02-geometry.md`.

What is fixed, and where from:

| Quantity | Value | Where from |
|---|---|---|
| Reverser forward edge | `x = −1.19`, 2.01 m from the lip | already in the model: the joint `livery.js` paints, at the midpoint of `a1 → bypassExit` |
| Reverser aft edge | `x = 1.16`, 3.18 m | `ST.bypassExit`, the fan nozzle exit |
| Reverser length | 1.17 m | the two above |

What the model decides, with the reasoning that has to survive review:

| Quantity | Value | Why this and not another |
|---|---|---|
| Fixed structure (torque box) | `x = −1.19 … −0.79`, 0.20 m | The reverser's forward frame: what the fan cowl bolts to, what the cascades hang off, and what the sleeve slides on. It has to be there or the sleeve translates away from nothing. |
| Cascade band | `x = −0.79 … 0.11`, 0.45 m | Immediately aft of the torque box, where the duct is still nearly full height. |
| Sleeve stroke | 0.90 units = 0.45 m | Exactly the cascade band length: the sleeve has to uncover the whole band and no more. Shorter leaves the cascades half-covered and the flow with nowhere to go; longer opens a gap of bare structure. Tying the two together removes one free number. |
| Sleeve, stowed | `x = −0.79 … 1.16`, 0.98 m | It starts at the torque box and covers the cascades — that is what "stowed" means. Deployed it sits at `0.11 … 2.06`, still 0.42 m short of the core nozzle exit. |
| Blocker doors | 12, six per half | Halves hinged on the pylon; six doors a half gives a 30° pitch, which reads as a ring of doors rather than as four big flaps, and leaves room for the hinge and link fittings between them. |
| Door chord | 0.50 units = 0.25 m | Hinged on the sleeve's forward frame, a door has to stow inside the cascade band (0.90 long) and reach the core cowl when swung. The duct is 0.50…0.53 units high there, and 0.50 of chord closes 96 % of it at the angle the linkage delivers. Longer, and the door sweeps through the core cowl on its way round. |
| Reverse power limit | N1 ≤ 80 % | Line practice on the type: reverse is used well below full power, and the sleeve is not stressed for it. |

Stowed, the doors form the wall of the duct over the forward half of the cascade
band and the sleeve's own inner wall covers the rest — which is why the cascades
are invisible with the sleeve home, inside as well as out.

Every one of these is guarded by a test rather than by a comment (see Tests).

## Architecture

A new pure module, `src/reverser.js`, joins `engineState.js`, `atmosphere.js`,
`contrail.js`, `sound.js` and `i18n.js` on the headless side. Reason as ever:
the deployment takes two seconds and the interlocks are the interesting part, so
they must be runnable under Node.

```
main.js ──→ engine.js ──→ reverser.js
       ──→ airflow.js          ↑  (imported only by engine.js;
       ──→ sound.js            │   everyone else is handed values)
       ──→ engineState.js      │
       ──→ reverser.js ────────┘
```

Dependencies still run one way and `main.js` is still the only orchestrator.
`engine.js` imports `reverser.js` because the door geometry *is* the linkage —
placing a door means evaluating `blockerAngle`, and a copy of that function in
`engine.js` would be a second authority for the same curve. `airflow.js` and
`sound.js` import nothing new: they receive a number per frame, exactly as they
receive `n1` today.

`reverser.js` knows nothing about Three.js or the DOM.

### The module boundary

```js
// the actuator: how far the sleeve travels and how long it takes
export const STROKE = 0.90;        // model units
export const DEPLOY_TIME = 2.0;    // s
export const STOW_TIME = 3.0;      // s
export const REV_MAX_THROTTLE = 0.75;

// the mechanism, in the LOCAL frame of a door: the anchor relative to the
// hinge at rest, where the link attaches, the door chord. No stations here.
export const LINK = { u0: -0.45, v: 0.49, a: 0.45, chord: 0.50 };
export const DOORS = 12;

export function blockerAngle(travel);    // drag-link kinematics, radians
export function blockedFraction(travel); // how much of the duct is closed, 0..1
export function thrustFactor(travel);    // signed multiplier on gross thrust
export function createReverser();        // the state machine
```

Deliberately **not** here: the stations. `ST` in `engine.js` is the single
source of truth for the longitudinal layout, and duplicating `−0.79` in a second
file is exactly the drift `CLAUDE.md` warns about. The linkage is expressed in
the door's own frame — the anchor 0.45 units forward of the hinge and 0.49
inboard of it — which is all the kinematics needs and is true wherever the door
is put. `engine.js` supplies the absolute positions:

```js
sleeve:     -0.79,                 // authored
cascadeAft: -0.79 + STROKE,        // derived: the sleeve uncovers the band exactly
```

so the stroke and the band cannot disagree, with or without a test.

`createReverser()` returns an object shaped like `createEngineState()`: mutable
fields read every frame, an `update(dt, engineMode)` that advances it, and a
`request(deploy)` that is the button. Fields: `mode`, `travel` (model units,
what the geometry wants) and `blocked` (0…1, what the flow and the sound want),
the second recomputed from the first on every update so no call site has to
know the conversion.

Modes: `stowed → deploying → deployed → stowing → stowed`.

### Why the door angle is computed and not authored

Stowed, a blocker door lies flush in the wall of the duct, its free end pointing
aft. Its hinge is on the sleeve. A drag link runs from a point near the free end
to an anchor on the fixed inner wall of the duct. When the sleeve translates aft
the hinge goes with it, the anchor does not, and the link — which cannot
stretch — pulls the door round across the duct.

That is one equation. With the hinge at `H = (x₀ + travel, R)`, the link point
at distance `a` along the door and the door rotated by `θ`:

```
| H + a·(cos θ, −sin θ) − A | = L
```

which expands to `p·cos θ + q·sin θ = c` and solves in closed form, `p = 2ua`,
`q = −2va`, `c = L² − u² − v² − a²`, with `u`, `v` the offset from the anchor to
the hinge. Of the two roots the one continuous with the previous step is taken.
`L` is not a free constant: it follows from requiring `θ(0) = 0`, the door flush
when the sleeve is home.

The constants that are free — where the anchor sits and how far along the door
the link attaches — were searched numerically against four requirements: `θ`
monotone over the whole stroke, no part of the door closer than 0.02 units to
the core cowl at any point of the sweep, the door closing at least 88 % of the
duct at full travel, and the anchor standing clear of the core cowl but inside
the duct. The result:

```
door chord   0.50      hinge radius R = 1.69
link at      a = 0.45  (90 % of the chord, as on the prototype)
anchor       A = (−0.34, 1.20)   link length L = 0.49  (from θ(0) = 0)
```

giving `θ`: 0° → 85.1° over the stroke, minimum clearance to the core cowl
0.025 units (12 mm), 96 % of the duct closed at full travel.

The payoff is the shape of the curve, and it is the teaching point:

| travel | 0 | ⅓ | ½ | ⅔ | 1 |
|---|---|---|---|---|---|
| door angle | 0° | 12° | 33° | 59° | 85° |
| duct blocked | 0 | 0.20 | 0.53 | 0.84 | 0.96 |

A third of the way through the stroke the doors have done a fifth of their work.
That is a property of the linkage, not a curve chosen to look good, and it is
why reverse thrust arrives late in the deployment rather than in proportion to
it. An authored `smoothstep` would look similar and mean nothing.

If the linkage is ever driven past the point where the equation has a solution
the function clamps at the limiting angle rather than returning `NaN`: the
geometry must never be able to produce a hole in the model.

## Thrust in reverse

The fan stream is 80 % of the thrust at a bypass ratio of 5.1; the core is the
other 20 % and is not touched. Of the fan stream, the fraction the doors have
closed is turned forward through the cascades, and it comes out at an angle —
cascades turn the flow to roughly 45° forward of radial, not to straight ahead,
so only part of its momentum counts against the engine.

```
factor(b) = CORE + FAN·(1 − b) − FAN·TURN·b
          = 0.20 + 0.80·(1 − b) − 0.80·0.62·b
```

with `b` the blocked fraction. At `b = 0` it is exactly 1 — a stowed reverser
must not change the thrust by a rounding error. The doors reach `b = 0.96`, not
1, because they do not seal against the core cowl; there the factor is −0.244.

At the reverse power limit the throttle commands 0.75 of the range, so
N1 = 0.18 + 0.82·0.75 = 79.5 %, `keff` = 0.75 and the gross thrust
121.4·0.75^1.45 = 80.0 kN. The model shows −19.5 kN. Published figures for the
type put maximum reverse thrust at roughly a fifth of take-off thrust, which is
where this lands. `TURN = 0.62` is the one tuned number, and it is tuned against
that: the angle a cascade actually turns the flow through is not measurable from
the geometry the model draws.

Gross thrust moves from `main.js` into `engineState.js` as `eng.grossThrust`
(kN, always positive, zero without fuel). It is the same formula that is there
now, `121.4 · keff^1.45`; the move is what lets the reverse thrust be checked
numerically under Node instead of being a line of display code. `main.js` shows
`eng.grossThrust · thrustFactor(travel)`.

## Interlocks

The model has no aircraft, so it cannot know about weight on wheels. What it can
know is the state of the engine, and the interlocks are written in those terms:

| Rule | Behaviour |
|---|---|
| Reverse can only be selected in `run` | The button is disabled in `off`, `start` and `stop`, and the key is ignored |
| Selection commands idle first | Throttle is capped at idle while the sleeve moves, in either direction — as on the aircraft, where the levers must be at idle before the reverse levers will lift |
| Reverse power is limited | Once deployed, the throttle commands up to `REV_MAX_THROTTLE` = 0.75 of the range, N1 ≈ 80 % |
| Shutdown stows the reverser | `setMode('stop')` requests stow. The rundown takes 35 s and the stow 3 s, so it always completes; an engine that has stopped is never left with the sleeve out |
| Stow can interrupt a deployment | And deploy can interrupt a stow. The sleeve simply reverses from where it is: travel is continuous, only its sign changes |
| Repeating a request does nothing | Deploy while `deploying` or `deployed` is a no-op, and likewise for stow. The button is a selector, not a toggle that can be pumped |
| A stow that outlives the engine finishes | If the rotors stop while the sleeve is still moving, it keeps moving. The model has no hydraulic accumulator to run out, and a sleeve frozen half-open would be a failure mode this spec explicitly does not cover |

`throttleLimit()` returns the cap and `main.js` applies it to what it passes to
`eng.update()`. The slider itself is not moved: it is a lever position, and the
lever does not move on its own — the same reasoning that keeps the throttle
slider out of the engine state today.

The order matters in the frame loop: the reverser is updated **before** the
engine, so the cap the engine sees belongs to this frame's sleeve position and
not to the last one.

## Geometry

### Splitting the nacelle skin

The skin is one `lathe()` over `NAC_OUTER`, and the markings are laid out
against that profile by `livery.js`, relying on `LatheGeometry` handing out `v`
by point index over the whole generatrix. Splitting the mesh in two would
restart `v` at each piece and smear the paint.

So the profile stays whole and the *mesh* is split: each piece is lathed from
its slice of `NAC_OUTER` (with an exact point inserted at the cut), and its
`uv.y` is then remapped from `0…1` into the `v₀…v₁` the full profile would have
given it. One canvas, one material, one texture; two draw calls instead of one.
The same treatment for `NAC_INNER`, whose aft part is the inner wall of the
sleeve.

`livery.js` stops computing `cowlAft` from a fraction and reads `ST.reverser`
instead. The comment there says the fraction exists because the joint "is not a
station the rest of the model cares about" — after this change it is one, and
the single-source-of-truth rule in `CLAUDE.md` applies.

### New stations

```js
reverser:   -1.19,               // fan cowl / reverser joint, 2.01 m from the lip
sleeve:     -0.79,               // translating sleeve leading edge, stowed, 2.21 m
cascadeAft: -0.79 + STROKE,      // aft edge of the cascade band, 2.66 m
```

`ST` gains three entries and `geometry.test.mjs` gains a check that they run in
order between `a1` and `bypassExit`. The third is derived rather than authored,
so the band and the stroke cannot drift apart.

`livery.js` gets a second joint to paint, at `ST.sleeve`: on the real nacelle
the line between the fixed structure and the translating sleeve is as visible as
the one at the fan cowl.

### The parts

* **Translating sleeve** — outer skin from `ST.sleeve` to `bypassExit` and
  inner duct wall from the aft end of the stowed doors to the same place, plus
  the annular trailing edge. One group, translated in +X by `travel`. Flattened
  by `flattenBelly` before translation, so the flat bottom moves with the panel,
  which is what the panel does.
* **Cascade box** — fixed, `ST.sleeve … ST.cascadeAft`. The frame ring at skin
  radius, circumferential dividers, and the turning vanes: 72 around × 4 rows =
  288 instances of a curved plate in one `InstancedMesh`, tilted forward and
  outward. Hidden under the sleeve when stowed, which is most of the time, but
  it costs one draw call to leave it there and popping it in on deployment
  would be a bug waiting to happen.
* **Blocker doors** — 12, one `Group` each, hinged at the sleeve's forward
  frame so they translate with the sleeve and rotate by `blockerAngle(travel)`.
  A door is a curved plate: a segment of an annulus, thickened. Stowed they
  form the wall of the duct over the forward half of the cascade band.
* **Drag links** — 12 thin rods from the door to a bracket standing on the
  inner wall of the duct. They are what makes the mechanism legible: without
  them the doors appear to move by magic.

`buildEngine()` returns `setReverser(travel)` alongside `setSpiralBlur(keff)`:
it translates the sleeve group and sets the twelve door angles. Nothing else
in the frame loop learns about the reverser.

### The reverser as a module

`module('reverser', explode)` with the sleeve, the cascade box, the doors and
the drag links inside it. That buys the card, the 3D label, the explode step and
the hover tooltip for free, and it costs:

* a picking proxy over `reverser → bypassExit` in `PROXY`, and the nacelle's own
  proxy shortened to `lip → reverser` so the two do not fight;
* `label.reverser` and `module.reverser.{title,info}` in all eight locales;
* the count of proxies in the documentation going from 11 to 12.

Explode direction `(2.2, 4.4, 0)`: up with the nacelle, since it is hinged on
the pylon with the cowls, and aft, so it separates from the nacelle instead of
sitting inside it.

The one wrinkle: the module's `base` position is captured by `buildEngine()` and
the explode offset is written to `m.position` every frame. The sleeve therefore
cannot be translated by moving the module — it gets its own child group inside
it, and `setReverser` moves that.

## Flow

`airflow.js` gains one argument, the blocked fraction, and one piece of
per-particle state.

Bypass particles behave as they do now until they reach the cascade band. There,
with the doors closed, they leave: a particle crossing `ST.sleeve` is deflected
with probability `blocked`, and from then on it moves forward and outward — the
cascade turning angle, 45° forward of radial — fading out as it goes, instead of
continuing down the duct. Particles already past the band when the reverser
deploys carry on out of the fan nozzle, which is what actually happens in the
two seconds the doors take to close.

The fraction that gets deflected is `blocked`: at a half-closed door, half the
air still goes aft. That is not a physical model of a partially blocked duct —
it is the honest linear reading of one, and the transient lasts two seconds.

Core particles, the hot plume, the heat haze and the contrail are untouched. The
streamlines are static geometry built once at start-up; they keep showing the
stowed duct, and the legend does not claim otherwise.

## Sound

Reverse does not make the engine louder by turning up a gain. Three things
change, and they are separable:

1. **The fan jet is gone.** The bypass stream no longer leaves as a jet through
   the fan nozzle; the jet-noise component that scales with N1 drops with the
   blocked fraction. The core jet component, which scales with `burn`, stays.
2. **The fan is no longer ducted.** Its noise leaves through the cascades
   sideways instead of down a lined duct: the broadband fan band comes up
   substantially and its centre frequency drops, because what reaches the
   listener is no longer filtered by the length of the bypass duct.
3. **The cascades themselves roar.** Air turning through 135° in a grille of
   vanes is the loudest single thing about reverse. A new noise branch:
   brown noise through a bandpass around 300 Hz, gained by
   `blocked · n1`, with the existing turbulence oscillator modulating it so it
   breathes rather than sitting flat.

The buzz-saw comb is left alone. It radiates forward out of the intake, and the
intake is doing exactly what it was doing before.

`sound.update()` gains a `rev` parameter (the blocked fraction) with a default
of 0, so the audio test scripts that call it with the old signature keep working.

## Interface

* A fourth big button in the power block: **Thrust reverser**, with the
  sub-line saying what pressing it will do. Disabled outside `run`.
* A status bar under it, in the same style as the mode bar: `STOWED`,
  `DEPLOYING`, `DEPLOYED`, `STOWING`, with the same class-name-only mapping used
  by `MODE_CLASS` and `VERDICT_CLASS`.
* Key **R** (and `к`, the same physical key on a Russian layout), added to the
  footer key list. `R` is free; every other letter in use is taken.
* The thrust gauge shows a negative number in reverse. It already formats
  through `n()`, so the minus sign localises itself.
* The throttle row keeps its label. What it commands changes, and the reverser
  status bar right above it says so; a slider that renames itself under the
  reader's hand is worse than one that does not.

New keys, eight locales each:

```
panel.rev.title, panel.rev.hint
panel.reverser
rev.stowed, rev.deploying, rev.deployed, rev.stowing
rev.hint.deploy, rev.hint.stow, rev.hint.blocked, rev.hint.moving
label.reverser
module.reverser.title, module.reverser.info
footer.keys2   (changed: gains "R — reverser")
```

`index.html` carries the English for the new markup, as it does for the rest,
and `i18n.test.mjs` pins the two together.

## Tests

A ninth test file, `test/reverser.test.mjs`, in the house style — plain Node,
its own `check()`, one line per check, exit 1 on failure:

* deployment and stow take the times they claim, at 1/60 s steps;
* `deploying → deployed` and `stowing → stowed` happen inside the state machine,
  when the travel is actually reached;
* a deploy request in `off`, `start` and `stop` is refused, and the state does
  not change;
* a stow request part-way through a deploy reverses the travel from where it is,
  without a jump;
* shutdown while deployed leaves the reverser stowed before the rotors stop —
  driven through the real `createEngineState()`, not a mock;
* `throttleLimit()` is idle while moving and `REV_MAX_THROTTLE` when deployed;
* `blockerAngle` is 0 at travel 0, monotonic, and never `NaN` anywhere in
  `0…stroke` including past the linkage limit;
* the door tip at full deploy reaches the core cowl radius — the number the
  geometry test checks against the real mesh, checked here against the
  kinematics;
* `thrustFactor` is exactly 1 stowed, negative when fully deployed;
* net thrust at the reverse power limit, through `createEngineState()`, lands in
  15…25 kN of reverse;
* the doors close late: less than a fifth of the blocking has happened at a
  third of the stroke.

`geometry.test.mjs` gains: the new stations in the ordering list; the cascade
band exactly as long as the stroke; the deployed sleeve's trailing edge still
short of the core nozzle exit; the reverser section's share of the nacelle
length.

`clearance.test.mjs` gains: the doors at full deploy do not intersect the core
cowl and do close at least 85 % of the duct annulus; the deployed sleeve does
not intersect the core cowl. Both measured off the real vertices after
`setReverser(stroke)`, the way the existing checks measure envelopes.

`i18n.test.mjs` needs no change and will fail until all eight locales have the
new keys, which is the point.

`npm test` and the `SOURCES` list in the `Makefile` need the new file; `SOURCES`
is `find src` plus two names, so `src/reverser.js` is picked up automatically —
the test script in `package.json` is the one to edit.

The sound cannot be checked under Node beyond the graph rendering, as before.
The reverse mix is a handful of gain expressions inside `update()`; what is
testable about it — that the jet component falls and the cascade branch rises
with the blocked fraction — is checked by rendering the graph offline in
`test/audio/`, and the branch's existence is visible in the offline spectrum.

## Documentation to update in the same commit as the code

| Document | What changes |
|---|---|
| `01-architecture.md` | `reverser.js` in the dependency graph and the file table; draw calls, triangles, proxy count |
| `02-geometry.md` | The reverser section: stations, the sleeve, the cascade band, the doors, the split of the skin mesh and why the UVs are remapped |
| `03-physics.md` | Reverse thrust: the factor and where `TURN = 0.62` comes from; the drag-link equation |
| `04-airflow.md` | Where the bypass air goes when the doors are closed, and what deliberately does not change |
| `05-modes.md` | The reverser state machine diagram and the interlock table |
| `06-sound.md` | The three changes in reverse and why the buzz-saw is left alone |
| `07-ui.md` | The button, the status bar, the `R` key, the negative thrust read-out |
| `08-development.md` | The test table gains `reverser.test.mjs`; the recounted yardstick numbers |
| `09-backlog.md` | BL-05 marked done, in the summary table as well as its section; the BL-20 cross-reference updated to say the reverser is now a separate group |
| `README.md` | Feature list and any count it quotes |
| `CLAUDE.md` | "eight test files" becomes nine, in both places; the test table |
| `docs/engines/cfm56-7b-nacelle.json` | `not_published` under `thrust_reverser` |

Every count in the documentation is recomputed off the built scene, not copied
from this spec — `CLAUDE.md` is explicit about that, and the spec's own numbers
are estimates until the geometry exists.

## Risks

* **Triangle budget.** The scene is at 771 k triangles. The cascades and doors
  are the addition; at 288 vane instances and 12 doors it should be under 30 k,
  but the vane plate has to be kept simple. Measured, not assumed, before the
  documentation is written.
* **UV remapping.** If the `v` remap is off, the markings shift on the aft half
  of the nacelle. It is visible immediately and only in a browser: no test can
  see a texture that `livery.js` refuses to build under Node. Verified by eye
  against the current build.
* **The linkage constants.** Chosen by hand, tuned by script, guarded by tests
  at both ends (kinematics and real mesh). The failure mode if they are wrong is
  a door passing through the core cowl, which the clearance test catches.
