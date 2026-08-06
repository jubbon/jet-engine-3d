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
the combustion intensity, so when the fuel is cut the plume dies.

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

**It scatters.** The jet is visible in its own right — a whitish billowing cone,
dense at the nozzle and dissolving downstream.

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

When **"Air flows"** is switched on, the exhaust is damped down
(`setFlowMode`). This is a deliberate compromise: in a diagram what matters is
seeing the particles, the streamlines and the temperature colouring of the jet,
and a dense white gas simply paints over them. In diagram mode only a faint
shimmer remains.

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
rear view look from. The fragment shader is the same kind of value noise as the
plume, three octaves of it, drifting slowly backwards: the trail is *left
behind*, it does not stream like the jet.

Three things carry the meaning rather than the looks:

* **The gap.** The trail begins 20 units — ten metres — behind the nozzle, where
  the jet has had time to mix and cool. That gap is the most recognisable thing
  about a contrail after its colour, and it is the reason the strip does not
  start at the nozzle.
* **The length.** A persistent trail runs the full 90 units (45 m) to the edge
  of the scene and fades there; a short-lived one breaks off at about a third of
  that. A real trail is kilometres long, hundreds of times past the far plane —
  the model shows the near end of it and lets the fog take the rest.
* **The spreading.** The half-width grows from 0.6 to 9 units along the strip,
  and the density falls as it goes: a persistent trail opens out, a short-lived
  one barely does.

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
