# 04. Airflow

Switched on by the "Air flows" button or the space bar. If the casings are
opaque at that moment and the cutaway is off, x-ray mode engages automatically —
otherwise the flow inside the engine would not be visible.

## Duct model

Both ducts are defined not by trajectories but by **duct boundaries**: tables of
"axial coordinate → radius" for the inner and the outer wall.

```js
BYPASS_IN  = [[-7.6, 0.60], [-3.22, 0.98], [-2.86, 1.00], [1.16, 1.18], ...]
BYPASS_OUT = [[-7.6, 1.40], [-3.22, 1.56], [-2.86, 1.62], [1.16, 1.60], ...]
CORE_IN    = [[-7.6, 0.06], [-3.22, 0.52], [-1.04, 0.46], [2.90, 0.50], ...]
CORE_OUT   = [[-7.6, 0.46], [-3.22, 0.94], [-1.04, 0.55], [2.90, 0.86], ...]
```

The table knots sit on the stations from [Geometry](02-geometry.md): fan plane
−3.22, splitter −2.86, fan nozzle exit 1.16, core nozzle exit 2.90. Editing the
stations in `ST` requires editing these tables too — the duct is not derived
from the geometry, it is specified alongside it.

Each particle stores:

* `channel` — bypass or core duct (assigned at birth and never changed, the flow
  does not cross from one duct to the other);
* `lane` ∈ [0, 1] — its lane between the inner and the outer boundary;
* `phase` — circumferential position;
* `x` — axial coordinate.

The radius comes from interpolating between the boundaries:

```
r(x) = r_in(x) + lane · (r_out(x) − r_in(x))
```

This representation automatically keeps a particle inside the duct along the
whole gas path: where the passage narrows the lanes converge, where it widens
they spread apart. It is a visual analogue of streamlines.

## Profiles along the gas path

Besides the boundaries, three more quantities are given as tables — all
interpolated piecewise-linearly by `pw()`:

| Table | What it defines |
|---|---|
| `CORE_V`, `BYPASS_V` | Axial velocity: deceleration in the compressor, a minimum in the combustor, a maximum at the nozzle exit |
| `CORE_SWIRL`, `BYPASS_SWIRL` | Swirl: a jump across the rotor rows, removal by the stator vanes and struts |
| `CORE_T`, `BYPASS_T` | Relative temperature 0…1, from which the colour is taken |

The physical justification of the profiles is in the
[physics document](03-physics.md#7-gas-path-aerodynamics-in-the-flow-visualisation).

Integration per frame:

```js
x     += v(x) · speedK · dt
phase += swirl(x) · speedK · dt
```

where `speedK = 0.06 + 1.05 · n1` — with the fan stopped the flow freezes.

## Reverse: where the bypass air goes instead

With the thrust reverser deployed the bypass duct is closed by the blocker
doors, and the only way out is the cascade band in front of them. A particle
reaching the doors (`X_DOORS`, the station `ST.cascadeAft` in `engine.js`) is
turned round **once** — marked at the crossing, with probability equal to how
much of the duct the doors have closed — and from then on travels forward and
outward at 45°, the angle the cascades turn the flow through, fading as it
leaves the nacelle behind.

Deciding it once at the crossing rather than re-rolling every frame is the whole
difference between air being turned and a fog of particles changing their minds.
Half-closed doors send half the air back, which is the honest linear reading of
a transient that lasts two seconds; particles already past the doors when the
reverser deploys carry on out of the fan nozzle, which is what actually happens
in those two seconds.

**The core stream is untouched**, and measurably so. Counted over the whole
particle set after ten seconds of running:

| | Out of the cascades | Out of the fan nozzle | Core, past the nozzle |
|---|---:|---:|---:|
| Stowed | 0 | ~1770 | ~310 |
| Deployed | ~1110 | 0 | ~320 |

(The particles are seeded randomly, so the counts move by a few per cent
between runs. The two that matter are exact: zero out of the cascades stowed,
zero out of the fan nozzle deployed.)

That is what a cascade reverser is: it turns the fan stream, which is five
sixths of the mass flow, and does nothing to the core. The exhaust plume, the
heat haze and the contrail are therefore unchanged in reverse — if that ever
stops being true, three other things in this model are wrong as well.

The streamlines are static geometry built once at start-up and keep showing the
stowed duct; they are the shape of the channel, not of the flow of the moment.

## Temperature and colour

The colour ramp `RAMP` runs from cold to incandescent:

| Relative T | Colour | Meaning |
|---:|---|---|
| 0.00 | `#2f6bff` | Ambient air |
| 0.12 | `#39b7ff` | After the fan |
| 0.28 | `#63efe2` | Compression in the booster |
| 0.42 | `#ffe066` | After the HP compressor, about 600 °C |
| 0.60 | `#ff9b3d` | Dilution downstream of the combustor |
| 0.78 | `#ff4f1a` | Expansion through the turbine |
| 1.00 | `#fff4d2` | Flame core |

The core duct temperature is multiplied by

```js
heat = max(0.22 · n1, burn)
```

so without combustion the duct gradually turns blue, but not instantly:
compression heats the air during rundown as well.

## Rendering

**Particles** — 5200 in the bypass duct and 3600 in the core, a single `Points`
object with its own shader: round soft sprites, additive blending, size
depending on temperature, positions recomputed in JS every frame.

**Streamlines** — 12 tubes (`TubeGeometry`) built from the same tables: 7 in the
bypass duct, 5 in the core. The colour is set per vertex from the same
temperature ramp, so the line itself shows where the flow heats up.

**Exhaust plume** — a cone with a noise-based shader; its brightness is tied to
the combustion intensity, so when the fuel is cut the plume dies. It starts at
the core nozzle exit at the radius of the cowl lip there (0.8 against a measured
0.82) and widens to 1.5 over five units, so the gas leaves the metal flush and
spreads the way a jet entrains the air around it.

Which way round that pair goes is the one trap in the code. `CylinderGeometry`
takes `(radiusTop, radiusBottom)` with the top at +Y, and the `rotateZ(-π/2)`
that lays the cone along the engine axis carries +Y to +X — downstream. So the
first argument is the *tail* and the second is the *mouth*, the opposite of how
the pair reads. Written the natural way it gave a cone Ø 1.5 m wide at a nozzle
of Ø 0.82 m: the rim stood clear of the cowl against the sky, and because the
shader's opacity peaks at the nozzle and falls as (1 − t)², that overhanging rim
was also the brightest edge in the frame. The cone narrowed downstream as well,
contradicting the heat-haze cone drawn on top of it, which widens from 1.45 to
4.0. Two checks in `test/clearance.test.mjs` now measure both against the model.

At the edges of the computational domain (−7.6 and 8.6) the particles and lines
fade out smoothly through `edgeFade()` — otherwise they would pop in and out,
and the streamlines would look like rays running off the edge of the screen.

## Exhaust gas

Everything above is a schematic visualisation, switched on by a button. The
exhaust aft of the nozzle, by contrast, is always working, and it does two
things at once.

**It refracts.** Hot gas has a different density, and therefore a different
refractive index, than the surrounding air. Turbulent eddies keep mixing hot and
cold, the light ray wanders — and everything seen **through** the jet shimmers
and smears. Looking into the nozzle, the optical depth accumulates along the
whole ray and the entire screen swims.

The amplitude is restrained: 5.5 pixels of displacement and 2.4 of smear, down
from 13 and 5.5. At the earlier strength the shimmer was the loudest thing in
the frame, and the hot section — the glowing plug and the last turbine stage,
seen from behind through the jet — dissolved in it. The effect exists to say
that the gas is there, not to obscure what is behind it.

**It scatters** — but only just. The jet has a body of its own, a billowing cone
warm-tinted at the nozzle and greying downstream, and it is deliberately kept
almost transparent (`LOOK.gas = 0.015`, with the opacity ceiling `uGasMax` at
0.02). Hot exhaust really is nearly invisible: what gives a jet away is the way
it bends the view, not its own whiteness. A dense white cone also competed with
the contrail, which is the one thing aft of the nozzle that genuinely is a
cloud, and the two read as different phenomena only when the near one is faint.

Implemented as a screen-space pass (`src/heathaze.js`) after `RenderPass`. For
each pixel a ray is built from the camera, and the optical depth is accumulated
along it:

```glsl
for (i < 16) {
  dd = density(p) * step;       // .x - for refraction, .y - for the visible gas
  w = dd.x * trans;             // near eddies distort more than distant ones
  pc += p * w;                  // weighted "refraction centroid"
  trans    *= exp(-dd.x * EXT);
  transGas *= exp(-dd.y * GAS_EXT);
}
cover = 1 - trans;              // 0 - the ray misses the jet, 1 - looking into the nozzle
gas   = 1 - transGas;           // opacity of the visible jet
```

By `cover` the pixel is displaced, smeared with five taps and slightly split by
colour (different wavelengths refract differently). By `gas` the jet colour is
composited on top — warm at the nozzle, cold at the tail.

Five decisions without which the effect looks wrong:

**Turbulence is evaluated once — at the point `pc`, not at every step.** If the
noise is sampled at every step and averaged, values of opposite sign along the
ray cancel out and instead of shimmer there is a barely visible ripple. The
weight `trans` meanwhile shifts `pc` towards the camera: near eddies really do
distort the image more.

**Steps are taken without a random offset.** The usual trick against banding on
a sparse grid — jittering the start point — lands here right in `pc`, so
neighbouring pixels get different displacements and the smooth distortion falls
apart into a mush of isolated dots.

**The engine bodies occlude the jet.** Otherwise the whole nacelle would shimmer
when seen from the front: the jet is behind it. The occlusion is computed
analytically — three cylinders along the axis (nacelle, core cowl, plug) — and
the ray is clipped at the nearest hit. No depth buffer is needed for this.

**The visible gas has its own density profile, steeper than the refraction
one** — hence the two values in `density()`. The diluted tail of the jet still
bends the ray noticeably, but it is no longer a visible cloud. Compute the gas
from the same profile and its depth accumulates along the whole ray, flooding
the frame with white in the rear view. There is also an opacity ceiling: even in
the thickest part the engine must show through.

**Billows use hash noise, not sines.** Sine fields are good for large-scale
turbulence and are cheap, but at small scales they give away their lattice: the
jet gets covered in a regular corduroy pattern, as if woven from threads.

The intensity comes from `hazePower(burn, n1)`: combustion contributes most, fan
speed a little. At idle this is a faint shimmer and a thin jet; at take-off
power, strong shimmer and a dense white exhaust; during rundown the exhaust
lives on for about 15 s after the flame has died — the jet is cooler by then but
still flowing. On a shut-down engine the pass is switched off entirely. Checked
in `test/heat-haze.test.mjs`. The visible gas depends on regime more gently
(`power^0.6`), otherwise at idle there would be no jet to see at all.

The eddies are convected downstream at a speed of `2 + 7·n1`, so at take-off
power the exhaust is not only denser but also faster. Toggled by the "Exhaust
gas" checkbox or the `H` key.

When **"Air flows"** is switched on, the exhaust is damped down further
(`setFlowMode`, multipliers of `LOOK`). This is a deliberate compromise: in a
diagram what matters is seeing the particles, the streamlines and the
temperature colouring of the jet, and the gas paints over them. The damping of
the gas was eased from 0.2 to 0.6 when the gas itself became faint — the two
together would have left nothing at all.

## Contrail

`src/contrailView.js`, and it is a separate object rather than a continuation of
the particles, because the scale is different: the duct computation ends at 8.6
units, about four metres behind the nozzle, and the trail has to run off towards
the horizon. Whether it is drawn at all is decided by the criterion in
[physics](03-physics.md#9-the-contrail); the drawing receives two numbers from
it — how dense the trail is and how far along it survives.

**One strip along the axis**, turned to face the camera in the vertex shader by
extruding each point along `cross(axis, toCamera)`. A flat ribbon would collapse
into a line seen from directly behind — which is exactly where view `0` and the
rear view look from.

**Shaped as a spindle**, thin at both ends and thickest past the middle:
`0.14 + 0.86·sin(πt)^0.75` of a maximum half-width of 3.6 units. The first
version simply widened towards the edge of the scene, and it read as a flat
ribbon however it was shaded — a band with one end is a band, a body with two
ends is a body.

The volume comes from three things, none of them geometry:

* the alpha follows `√(1 − v²)` across the width — the depth of gas a ray meets
  crossing a cylinder, thick in the middle and vanishing at the edges. A
  plateau with soft edges is what made it look painted on;
* **tonal range.** The normal of that imaginary tube is reconstructed per pixel
  from the same `v` (the strip has two vertices across, so it cannot come from
  the mesh) and lit by the scene's key light, mixing between a sunlit white and
  a cold shadow. An evenly white shape stays flat however well it is outlined,
  and the terminator is wide because cloud scatters light through itself rather
  than catching it on a surface;
* **relief.** The noise field perturbs that normal rather than the brightness,
  so every billow gets its own lit and shaded side and the light does the
  drawing. This is what finally took the trail off the plane: a smooth tube with
  a gradient across it is still an airbrushed lozenge. The strength is
  moderate — at three times it the far half went blotchy, reading as dirt
  rather than cloud — and it fades towards the edges, where the tube turns away
  and there is little left to billow.

Two things carry the meaning rather than the looks:

* **The gap.** The trail begins 20 units — ten metres — behind the nozzle, where
  the jet has had time to mix and cool. That gap is the most recognisable thing
  about a contrail after its colour, and it is the reason the strip does not
  start at the nozzle.
* **The length.** A persistent trail is the full spindle, 76 units (38 m); a
  short-lived one is a shorter and thinner cigar, a third of the length —
  shortened rather than clipped, so it keeps both its ends. A real trail is
  kilometres long, hundreds of times past the far plane; the model shows the
  near end of it and leaves the eye to continue it.

The material ignores the scene fog and fades on its own — with the camera pulled
back far enough to take the trail in, the fog would otherwise swallow it whole.
For the same reason the fog's far edge follows the camera distance, so that
pulling back does not drown the engine either.

The trail is switched off by the checkbox or the `T` key, and it dies with the
flame: no fuel, no water, no trail. The easing of the density has a time
constant of 0.9 s, so crossing the threshold with a slider does not pop.

## Station table

Below the legend, temperature and pressure at seven stations are displayed. The
values are recomputed from the **actual rotor speeds**, not from the throttle
position, so during rundown one can watch the gas path cool. The formulas are in
the [physics document](03-physics.md#stations).
