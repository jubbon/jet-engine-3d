# 03. Physics of the model

The model is **illustrative, not computational**. It does not solve the
equations of gas dynamics: there is no mesh calculation, no continuity equation
and no Navier — Stokes. Something else is built in — the correct *structure* of
the dependencies: what depends on what, in which direction and how steeply. The
parameters are calibrated against typical values for a CFM56-7B at take-off
power.

Below is what is actually implemented in the code, with formulas and
justification, plus a separate section on the limits of validity.

## 1. Rotor kinematics

### Two spools

The engine is a two-spool design. The low-pressure rotor (N1) is the fan, the
booster stages and the low-pressure turbine on a common shaft; the high-pressure
rotor (N2) is the compressor and the high-pressure turbine on a hollow shaft
around the first. The spools are not mechanically coupled: their speeds are
linked only by the gas passing through both. Hence an important consequence that
the model reproduces: **N1 and N2 behave differently** — at idle N2 is 56 %
while N1 is only 18 %. The high-pressure rotor has to hold high speed, otherwise
the compressor will not produce the pressure at which the combustor works at
all.

### Blade twist

The stagger angle of a blade grows from root to tip (on the fan, from 16° to
61°). The reason is strictly physical. The axial flow velocity `c_a` is roughly
constant along the span, while the blade tangential speed grows linearly with
radius:

```
U = ω·r
```

So the relative flow angle

```
β = arctan(U / c_a)
```

grows with radius. For the blade to work without stalling at every radius, its
section has to be turned by that angle — hence the twist. In the blade generator
this is `rootStagger` → `tipStagger`, and the chosen values follow that
relationship.

For the same reason the chord and thickness at the tip are smaller than at the
root: the root carries the whole centrifugal load and has to be more massive.

### Rotation speed on screen

The real speeds of a CFM56-7B are 5175 rpm (N1) and 14 460 rpm (N2), that is 542
and 1514 rad/s. Rendering them is impossible: at 60 frames per second the fan
would turn 9.0 rad per frame, while the angular pitch between 24 blades is
0.26 rad. The result would be a stroboscopic effect — the wheel would appear to
run backwards.

The rotation is therefore slowed, but in proportion to the speeds:

```
ω₁ = 13.7 · n1    rad/s
ω₂ = 23.0 · n2    rad/s   (in the opposite direction)
```

where `n1`, `n2` are fractions of maximum speed. The rotation is slowed about
40-fold, and the ratio between the two spools is compressed (1.7 instead of the
real 2.8) — otherwise the HP rotor would run into the strobe again. The
instruments show honest percentages of speed, and the **sound uses the real
speeds**, not the slowed ones.

## 2. Dynamics of spool-up and rundown

The rotor equation of motion:

```
J · dω/dt = M_turbine − M_compressor − M_friction
```

Near equilibrium the difference between the turbine and compressor torques is
linear in the speed deviation, which gives a first-order lag with a time
constant `τ = J / (dM/dω)`. The code uses the **exact solution** of that
equation over one step:

```js
n += (n_target − n) · (1 − exp(−dt/τ))
```

The exponential form, rather than `n += (target − n)·k·dt`, was chosen
deliberately: the result does not depend on frame rate, so at 30 and at 144 fps
the engine spools up in the same time.

The time constants (`src/engineState.js`):

| Regime | LP rotor | HP rotor |
|---|---:|---:|
| Starter cranking | 12.0 s | 12.5 s |
| Acceleration from light-off to idle | 10.0 s | 7.4 s |
| Acceleration at operating regimes | 2.6 s | 2.0 s |
| Deceleration | 1.9 s | 1.4 s |
| Rundown (fuel cut) | 9.3 s | 5.9 s |

The constants differ by phase not for decoration: `τ = J / (dM/dω)`, and the
excess torque `dM` differs from phase to phase. An air starter supplies a small
torque that also falls off with speed — hence the longest cranking. Immediately
after light-off the turbine has only just started working, the excess torque is
small, and the engine winds itself up unhurriedly. At operating regimes the
excess is large — hence the brisk throttle response. During rundown there is no
driving torque at all.

The LP rotor has more inertia: a large-diameter fan, a long shaft and four
turbine stages give a noticeably larger polar moment of inertia than the compact
HP rotor with its single turbine stage. So in every regime where both rotors are
driven by turbines its time constants are larger, and on shutdown it is the last
to stop.

Starter cranking is the one exception: there the HP rotor responds more slowly
not because of inertia but because of the weak external drive, while the LP
rotor is simply picked up by the flow and follows it.

### Bearing friction

A pure exponential never reaches zero. A real rotor stops because the friction
torque in the bearings barely depends on speed (dry and boundary friction), that
is, it produces a **constant angular deceleration**. In the model this is an
additional term:

```js
n1 = max(0, n1 − 0.0022·dt)
n2 = max(0, n2 − 0.0035·dt)
```

It also removes the infinite tail of the exponential and makes the shutdown
genuinely complete: the speeds become strictly zero rather than "almost zero".

The result: the HP rotor stops in about 23 s and the LP rotor in about 35 s,
which fits within the real 30–60 s. A start from button press to idle takes
about 40 s. To save waiting through these processes in full, the panel has a
time scale switch ×1 / ×4 — it speeds up the engine state machine only, leaving
the flow particles and the camera alone.

## 3. Combustion

The combustion intensity `burn` (dimensionless, proportional to fuel flow)
follows the regime with asymmetric time constants:

| Transition | τ | Why |
|---|---:|---|
| Build-up | 0.7 s | Limited by the fuel scheduling rate and rotor spool-up |
| Decay | 0.35 s | The flame dies almost immediately after the cut |

The combustion target:

```
burn_target = 0            if the fuel is cut
            = 0.30         during start
            = 0.1 + 0.9·k  while running
```

where `k = (n1 − 0.18)/0.82` is the effective regime derived from LP speed. The
term 0.1 means that fuel is still supplied at idle — otherwise the engine would
go out.

**A rich mixture during start.** The separate value of 0.30 during start is not
a fudge. At light-off the rotor has barely spooled up, the airflow is small, and
enough fuel is supplied for stable combustion. The mixture comes out rich and
the gas temperature is thrown sharply upward — the familiar start temperature
peak, which then decays as the airflow grows. The model reproduces this: an
overshoot to 785 °C followed by settling at the 495 °C of idle.

## 4. Gas temperature ahead of the turbine

```
T4_target = 350 + 1450·burn    °C   (with fuel on)
          = 15                 °C   (after the cut)
```

The time constants are asymmetric here too, and that matters:

| Transition | τ |
|---|---:|
| Heating | 0.6 s |
| Cooling with combustion running | 2.2 s |
| Cooling after the fuel cut | 7.0 s |

The gas heats up faster than it cools — otherwise the brief flare of light-off
would not produce a noticeable temperature overshoot. And after the fuel is cut
the gas path cools slowly: hot parts give their heat back to the gas. That is
exactly why, on shutdown, the turbine keeps glowing after the flame has died.

### Incandescence of the metal

The glow of the hot section is tied to the **actual** T4, not to the throttle
position:

```js
glow = clamp((T4 − 250) / 1500, 0, 1)
emissive ∝ glow²
```

The 250 °C threshold and the quadratic dependence roughly reflect the real
picture: visible glow in steel begins at around 500–600 °C, and brightness in
the visible range grows with temperature substantially faster than linearly
(Planck's law).

## 5. Gas path thermodynamics

The table of temperatures and pressures by station is computed from rotor
speeds, not from the throttle, and is counted off from the ambient air.

### Ambient conditions

The engine itself stays on the ground, but the air around it can be lifted to
the cruise levels: the panel has an altitude slider (0…12 km) and a deviation of
the day from standard (−30…+30 °C). `src/atmosphere.js` computes the standard
atmosphere in two branches — a troposphere with a lapse rate of 6.5 °C per
kilometre and, above 11 km, an isothermal layer at −56.5 °C:

```
h ≤ 11 km:   T = 288.15 − 0.0065·h        P = P₀·(T/T₀)^5.2559
h > 11 km:   T = 216.65                   P = P₁₁·exp(−g·Δh/(R·T))
```

The power law rather than an exponential in the troposphere comes from
integrating `dP/P = −g·dh/(R·T)` with a temperature that itself falls linearly;
the exponent is `g/(L·R) = 5.2559`. The two branches meet at the tropopause not
merely closely but by exactly the weight of the air between them — the test
checks the step against `ρ·g·Δh`.

The deviation from standard moves the **temperature and the density but not the
pressure**: altitude here is the pressure altitude, the one an altimeter shows,
and it is pressure that defines it. Hence the point of the slider — on a day
15 °C hotter than standard the pressure is unchanged while the air is 4.9 %
thinner, and that is the whole story of thrust lost in the heat.

Density comes from the equation of state, `ρ = P/(R·T)`, with the actual
temperature. Alongside the absolute values the module returns the relative ones,
`θ = T/T₀`, `δ = P/P₀`, `σ = ρ/ρ₀`, in which the similarity relations of a full
altitude recomputation are written; for now only `θ` is used.

### Water vapour

The standard atmosphere is dry, so humidity is kept apart from it — a property
of the day rather than of the altitude. A third slider sets the relative
humidity, and from it come the vapour pressure and the dew point through the
Magnus formula in the Alduchov — Eskridge coefficients:

```
e_sat = 610.94 · exp(17.625·t / (243.04 + t))   Pa, over water
e_sat = 611.21 · exp(22.587·t / (273.86 + t))   Pa, over ice
```

The formula is a fit to tabulated data, good to 0.4 % over water between −40 and
+50 °C and to 0.1 % over ice; the test compares it with the table at five points
on one curve and three on the other. The dew point is the same formula solved
for temperature, so it round-trips exactly: saturated air has its dew point at
the air temperature.

Relative humidity is counted **over water at any temperature**, as meteorology
counts it — a hygrometer reads over water whether or not it is freezing outside.
Below zero the second curve starts to matter, because the two diverge: at −40 °C
ice saturates at 0.677 of the water value. Air that a hygrometer would call far
from saturated is then already supersaturated over ice — at eleven kilometres
60 % over water is 102 % over ice — and that is the state in which a contrail
spreads into cirrus instead of evaporating. It is what
decides the fate of the trail in [the contrail section](#9-the-contrail).

Above freezing the ice ratio is not reported at all. The formula continues to
give numbers there — and runs *above* the water curve, so saturated air at
+15 °C would come out at 86 % "over ice" — but there is no ice to saturate over,
and an extrapolation past the substance it describes is not a measurement.

What humidity deliberately does **not** affect is density: moist air is lighter
than dry air at the same pressure, by about 1 % at +30 °C and saturation and by
nothing worth the name in the cold. The panel shows the dry-air density, and
`σ = δ/θ` stays exact.

### How compression depends on speed

From the Euler turbomachinery equation, the work of a stage is

```
Δh₀ = U · Δc_u
```

Since both quantities are proportional to the tangential speed, and that to the
rotational speed, the work input — and hence the temperature rise in the
compressor — grows **quadratically**:

```
ΔT ∝ n²
```

In the model:

```js
fan  = n1^2.0     // compression in the fan and the booster
comp = n2^2.5     // compression in the HP compressor
```

The exponent of 2.5 for a multistage high-pressure compressor is above the
square: as the speed rises, not only does the stage work grow, but the stages
also match each other better, so the overall pressure ratio grows more steeply.

### Stations

`T` and `P` here are the ambient temperature and pressure from the section
above, `θ = T/288.15`.

| Station | Temperature, °C | Pressure, bar |
|---|---|---|
| Intake | T | P |
| Bypass duct | T + θ·34·fan | P·(1 + 0.68·fan) |
| After booster | T + θ·105·fan | P·(1 + 1.7·fan) |
| After HPC | T + θ·585·comp | P·(1 + 27·comp) |
| Combustor | T4 (actual) | P·(1 + 26·comp) |
| After HPT | 0.494·T4 | P·(1 + 6·comp) |
| Nozzle exit | 0.293·T4 | P·(1 + 0.65·fan) |

The pressures are pressure ratios multiplied by the ambient pressure, and the
temperature rises are multiplied by `θ`. The scaling is not cosmetic: the work
of a compressor stage, and with it the heating, is proportional to the inlet
temperature, so the same rotor speed in the cold air of eleven kilometres gives
a quarter less heating — 585 K of rise at sea level become 440. Simply adding
the sea-level rise to a cold intake would give an honest-looking 528 °C behind
the compressor where the model's own compression gives 383.

The temperatures behind the turbines are taken as fractions of the actual T4,
because the temperature drop across a turbine is set by its pressure ratio,
which for fixed geometry is nearly constant:

```
T_out / T_in = (P_out / P_in)^((γ−1)/γ) ≈ const
```

A caveat: the coefficients 0.494 and 0.293 were fitted in **degrees Celsius**
against typical take-off values. Strictly, the relation holds for absolute
temperatures, so at low regimes the fractions give an underestimate. For an
illustrative picture of the gas path cooling down this is enough; for
calculations it is not.

At take-off power (throttle 100 %) on the ground the model gives: 600 °C and
28.4 bar after the HP compressor, T4 = 1800 °C, 889 °C after the HP turbine and
527 °C at the nozzle exit — typical values for an engine of this class with an
overall pressure ratio of about 28. Lift the same engine to 11 km and the
compressor delivers 383 °C and 6.3 bar: the pressure ratio is the same, the air
it works on is not.

What does **not** change with altitude is everything to the left of the station
table — the speeds, T4 and the thrust. Those need corrected parameters and are
the subject of the remaining part of BL-06; see
[the backlog](09-backlog.md#bl-06-the-engine-at-altitude-ambient-conditions-and-characteristics).

## 6. Thrust

```
F = 121.4 · k^1.45    kN
```

Thrust grows faster than rotor speed because **both** factors in the thrust
expression grow at once:

```
F = ṁ · (V_jet − V_flight)
```

both the mass flow and the exhaust velocity increase with fan speed. The
exponent 1.45 is empirical, chosen so that 100 % power gives 121.4 kN (27 300
pounds — a CFM56-7B27). When the fuel is cut the thrust goes to zero
immediately, without waiting for the rotors to stop.

That is `eng.grossThrust`, computed in `engineState.js`: what the engine
produces, before anything downstream redirects it.

### Reverse thrust

A cascade reverser turns the **fan** stream and leaves the core alone. At a
bypass ratio of 5.1 the fan makes about 80 % of the thrust; whatever fraction
`b` of it the blocker doors have closed is sent out through the cascades, and it
leaves at an angle rather than straight ahead, so only part of its momentum
counts against the engine:

```
factor(b) = CORE + FAN·(1 − b) − FAN·TURN·b
          = 0.20 + 0.80·(1 − b) − 0.80·0.62·b
```

At `b` = 0 this is exactly 1 — a stowed reverser must not change the thrust by a
rounding error, which is why `blockerAngle()` returns the datum exactly at zero
travel instead of the 10⁻¹⁷ the closed form gives. The doors reach `b` = 0.96,
not 1, because they do not seal against the core cowl; the factor there is
−0.244.

`TURN` = 0.62 is the one number in the model tuned to an outcome rather than
derived. The angle a cascade actually turns the flow through is not something
the geometry drawn here could be asked, so it is set against the result: at the
reverse power limit the throttle commands 0.75 of the range, N1 = 0.18 + 0.82 ·
0.75 = 79.5 %, `keff` = 0.75, gross thrust 121.4 · 0.75^1.45 = 80.0 kN, and the
model shows **−19.5 kN**. Published figures for the type put maximum reverse
thrust at roughly a fifth of take-off thrust.

### The blocker door linkage

The doors are not driven. Each is hinged to the translating sleeve and tied by a
drag link to an anchor on the fixed inner wall, so as the sleeve carries the
hinge aft the link pulls the door round. With the hinge at `H = (x₀ + s, R)`,
the link point at distance `a` along the door and the door at angle `θ`:

```
| H + a·(cos θ, −sin θ) − A | = L
```

which expands to `p·cos θ + q·sin θ = c`, with `p = 2ua`, `q = −2va`,
`c = L² − u² − v² − a²` and `(u, v)` the offset from anchor to hinge. That is
`L·cos(θ − φ)= c` with `φ = atan2(q, p)`: a closed form, no solver, and of the
two roots the one continuous with `θ(0) = 0` is taken. `L` is not a free
constant — it follows from requiring the door to be flush when the sleeve is
home.

Driven past the point where the link can reach, the function clamps at the
limiting angle rather than returning `NaN`. The geometry must never be able to
produce a hole in the model.

The curve this gives is the reason for solving it: see the table in
[geometry](02-geometry.md#the-doors-are-dragged-not-driven). The doors do a
fifth of their blocking in the first third of the stroke.

## 7. Gas path aerodynamics in the flow visualisation

Implementation details are in the [airflow document](04-airflow.md); only the
physical side is covered here.

**Ducts.** Each particle keeps its own lane between the inner and outer duct
boundaries and never crosses from the bypass duct into the core. This is a
streamline representation: the division of the flows is set by the geometry of
the splitter.

**Axial velocity profile.** Given as a table, it reproduces the real picture:

* the flow is decelerated in the compressor — as it is compressed the density
  grows while the flow area shrinks more slowly;
* the velocity minimum falls in the combustor: in a real engine the diffuser
  deliberately brings the speed down to about 30 m/s, otherwise the flame would
  be blown out;
* the maximum is at the nozzle exit, where the pressure drop accelerates the
  gas.

The ratio of velocities from the combustor to the nozzle exit is about 6.8 in
the model, whereas in a real engine it is closer to 15 — the range is compressed
so that the particles neither stand still in the compressor nor vanish within a
single frame in the nozzle. The order of magnitude and the placement of the
maxima are preserved, the absolute velocities are not: they are slowed about
150-fold so that the flow can be followed by eye.

**Flow swirl.** The angular velocity of a particle jumps across the rotor rows
and is removed by the stator vanes, the outlet guide vanes of the bypass duct
and the struts of the rear frame. That is precisely what stationary blade rows
are for: to take out the swirl left by the rotor and turn it into pressure.

**Heating of the core duct** in the absence of combustion:

```js
heat = max(0.22·n1, burn)
```

Even without combustion the air in the compressor heats up — from compression.
So during rundown the core duct does not turn blue instantly but cools
gradually.

## 8. Acoustics

Details are in the [sound document](06-sound.md).

**Tonal component.** The fundamental fan tone is the blade passing frequency:

```
f = (rpm × blade count) / 60 = (n1 · 5175 · 24) / 60
```

From 373 Hz at idle to 2070 Hz at take-off. This is a real physical mechanism:
each blade, passing a fixed point, creates a pressure pulse.

**Buzz-saw.** When the blade tip crosses the speed of sound the picture changes
qualitatively: each blade sends a shock wave forward along the duct, and since
the blades differ slightly from one another, the pattern repeats not once per
blade passing period but once per shaft revolution. A comb of tones appears in
the spectrum at harmonics of the **shaft rotation** frequency. The onset is
determined by the relative Mach number at the blade tip, which the model
computes from the tangential and axial velocities: the comb switches on at
around 80 % N1 and reaches full strength by 92 %.

Both components are confirmed by spectral analysis of a real CFM56 recording —
method and results in the [sound document](06-sound.md).

**Noise component.** The rumble, the jet roar and the hiss are filtered noise
tied to combustion and airflow. Here the physics is heavily simplified: real
turbulent jet noise obeys Lighthill's law, by which the acoustic power grows as
the eighth power of the exhaust velocity. In the model the level is proportional
to `burn^1.3` in amplitude, i.e. roughly `burn^2.6` in power — a substantially
gentler dependence, chosen so that the sound at idle remains audible.

**The separation of sources** is physically meaningful: noise is tied to
combustion and flow, tone to rotor speed. That is why, when the fuel is cut, the
roar disappears at once while the fan whine keeps falling in pitch until the
rotors stop.

## 9. The contrail

The trail behind an aircraft is not always there, and what it depends on
follows from quantities the model already computes. `src/contrail.js` computes
it; the drawing is in [Airflow](04-airflow.md#contrail).

### Why a trail appears at all

The exhaust carries water — burning a kilogram of kerosene gives about 1.24 kg
of it — and heat. Mixing with the ambient air, the jet cools along a straight
line in "temperature — vapour pressure" coordinates, and the whole question is
whether that line touches the saturation curve before the jet has cooled to the
ambient temperature. The slope of the line is the Schmidt — Appleman parameter:

```
G = EI_H₂O · c_p · P / (ε · Q · (1 − η))
```

with `EI_H₂O = 1.24`, `c_p = 1004 J/(kg·K)`, `ε = 0.622`, `Q = 43 MJ/kg`, `P`
the ambient pressure and `η` the propulsive efficiency. At eleven kilometres
and `η = 0.3` this gives 1.50 Pa/K, in the middle of the published range for
airliners.

The `1 − η` in the denominator carries the counter-intuitive part: the more of
the fuel's energy leaves as thrust, the less of it stays in the jet as heat, the
steeper the line — and **the more readily an efficient engine leaves a trail**.
That is why the efficiency is a slider rather than a constant: moving it from
0.15 to 0.45 shifts the threshold by more than 4 K.

### The threshold temperature

The temperature at which the line just touches the saturation curve is taken
from Schumann's (1996) approximation:

```
T_LC = −46.46 + 9.43·ln(G − 0.053) + 0.720·ln²(G − 0.053)    °C
```

That is a fit, and the test does not check it against itself: at `T_LC` the
saturation curve must have exactly the slope `G`, and the curve is the Magnus
formula already checked against tables. The fit holds tangency to within 0.5 %
over the whole range of slopes the panel can produce.

Below saturation the line has further to travel, so the air must be colder
still. The threshold `T_LM` is where the line drawn from the tangency point
meets the curve scaled by the relative humidity; there is no closed form and it
is bisected.

### Whether it lasts

Two independent questions, decided separately. **Whether a trail forms** depends
on the engine, through the slope. **Whether it lasts** does not depend on the
engine at all: if the ambient air is supersaturated with respect to ice, the
crystals go on growing on the ambient vapour and the trail spreads into cirrus;
if it is not, they evaporate within seconds and the band breaks off not far
behind. That is the difference between a sky criss-crossed with bands and a
clear one, and it comes straight from `rhIce` in
[the vapour section](#water-vapour).

At eleven kilometres on a standard day at 60 % humidity the model gives a
threshold of −49.5 °C against an ambient −56.5 °C — a trail forms with 7 K to
spare — and the air is at 102 % over ice, so it persists. At 30 % humidity the
same air still forms a trail, but a short-lived one. From the ground, the
altitude at which the trail would appear is 9.6 km; the panel searches for that
altitude on the criterion itself rather than converting a temperature margin
through the lapse rate, because pressure moves the threshold as well.

### What is assumed

* **The efficiency is an input.** Computing it would need the fuel flow and the
  flight speed, and the model has neither — see the section below.
* **The velocity of the mixture is not shown**, though the mixture temperature
  is (flow-weighted through the bypass ratio, 46 °C at cruise power at
  altitude). The absolute velocities in the model are deliberately reduced by
  about 150 times, so a figure in metres per second would be an invention. The
  criterion does not need it.
* **One trail along the axis**, not the two ropes wound up by the wingtip
  vortices: that would need an aircraft in the frame, and there is none.

## 10. What the model does not have

Stated explicitly, so that the model is not mistaken for a calculation tool.

* **No gas-dynamic computation.** No Navier — Stokes, no continuity equation
  `ρ·A·c = const`, no energy equation. Velocities, temperatures and pressures
  are taken from tables and algebraic formulas rather than computed.
* **No cycle calculation.** Pressure ratio, component efficiencies, fuel flow
  and specific fuel consumption are neither computed nor mutually consistent.
  The numbers on the instruments are plausible, but they are not the result of
  closing a cycle.
* **No altitude or airspeed characteristics.** The ambient air is there —
  altitude and the deviation from standard set the temperature, pressure and
  density, and the station table is counted off from them. The engine itself is
  not recomputed: at eleven kilometres the same throttle position gives the same
  speeds, the same T4 and the same thrust as on the ground, whereas a real
  engine would run at higher corrected speeds and about a third of the
  sea-level thrust. Ram compression and flight speed are absent altogether.
* **No limits or protections.** Compressor surge, flame-out, temperature
  exceedance, T4 and speed limiting and the action of the FADEC governor are not
  modelled. The engine cannot be broken by any throttle position.
* **No heat transfer.** Cooling is set by time constants rather than computed
  from the heat capacity and heat transfer of the parts.
* **No mechanics.** Blade stresses, tip clearances, thermal expansion,
  vibrations and critical speeds are absent.
* **The bypass ratio** of the prototype is 5.1 (per the reference), while the
  duct areas at the splitter plane give a ratio of 2.76 : 1 — 1.28 m² for the
  bypass duct against 0.46 m² for the core. To make the areas agree with the
  flow, the splitter would have to be lowered from 0.95 to 0.83 units, and the
  booster stages, the booster casing and the core cowl squeezed behind it. This
  was deliberately not done: the core gas path is narrow as it is, and after
  such a squeeze the stages stop reading. The nacelle and engine dimensions
  meanwhile are taken from sources exactly — see
  [Dimensions from sources](02-geometry.md#dimensions-from-sources).
* **The sound ignores** the Doppler effect, absorption in air and reflections;
  the attenuation with distance is linear rather than inverse-square.
* **Absolute velocities and speeds** are deliberately reduced (rotation by about
  25 times, flow by about 150 times) — otherwise the picture turns into a
  strobe. All *relative* proportions between regimes are preserved.

## 11. What has been verified numerically

The regime state machine is covered by tests (`npm test`, 20 checks). Among the
propositions checked are physically meaningful ones:

* the HP rotor stops before the LP rotor (22.6 s against 35.2 s);
* both rotors reach strictly zero speed;
* the flame dies within the first seconds after the cut (1.9 s);
* the temperature returns to ambient;
* the throttle position cannot revive a shut-down engine;
* there is a temperature overshoot at light-off (785 °C against the 495 °C of
  idle);
* light-off happens after the starter cranking, not instantly (19.1 s);
* the flame appears later than the fuel (16.6 s against 19.1 s), and until
  light-off the gas path stays cold;
* the start to idle takes a realistic time (39.7 s);
* the acceleration from idle to take-off fits within a sensible time (11.5 s).

The standard atmosphere is checked against a published table rather than against
itself (27 checks): temperature, pressure and density at 0, 1, 5, 11 and 12 km
to within 0.2 %, the smoothness of the join at the tropopause, and the behaviour
of a real day — the pressure stays put while the density falls by 4.9 % for
every 15 °C above standard.

The contrail criterion is verified through the property its fit approximates
(27 checks): at the threshold temperature the saturation curve must have exactly
the slope of the mixing line, and it does to within 0.5 % over the whole range of
slopes the panel can produce. Along with it the behaviour - a steeper line means
a warmer threshold, drier air has to be colder, a more efficient engine leaves a
trail more readily - and the drawing's own decisions, down to a shut-down engine
leaving nothing whatever the air outside.

The sound is verified by rendering the graph into an `OfflineAudioContext`: the
level grows monotonically with regime, there is no clipping, and the fan tone
sits at the computed blade passing frequency.
