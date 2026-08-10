# Compressor surge (BL-03)

Design spec, 2026-08-10.

## The problem

The model runs an engine that cannot be mishandled. The throttle goes anywhere,
as fast as the mouse moves, and N1, N2 and T4 follow it without complaint. That
is a fair picture of a turbofan doing what it is told, and it quietly teaches
something false: that a compressor is a pump, and a pump pushes harder the
faster you spin it.

A compressor is not a pump. Every blade is a wing with a critical angle of
attack, and the whole machine has a stability boundary that the operating point
can be driven across. `docs/03-physics.md` §10 already says this is missing,
in as many words: *"No limits or protections. Compressor surge, flame-out,
temperature exceedance … are not modelled. The engine cannot be broken by any
throttle position."*

`docs/09-backlog.md` has it as **BL-03, P2, size L**, with a page and a half of
requirements written before this spec existed. This design follows that entry
rather than reinventing it; where it departs from it, it says so.

## What actually happens in a compressor surge

Raise the pressure behind a compressor above what the current airflow can
sustain and the flow separates from the suction side of the blades. Two things
can follow:

* **Rotating stall** — one or more cells of stalled flow travel round the
  annulus at roughly half rotor speed. The machine still passes air, badly; the
  engine shakes, thrust falls, temperature climbs. It is stable, and it does not
  clear itself.
* **Surge** proper — an axial oscillation of the entire gas path. The
  compressor loses the ability to hold the pressure behind it, the compressed
  gas breaks back through it and is expelled forward out of the intake with a
  bang and a flash of flame. Pressure downstream collapses, forward flow
  re-establishes, the compressor builds pressure again, and the cycle repeats
  several times a second until the fuel is pulled back.

The classic trigger on a healthy engine is a rapid throttle advance at low
speed. Fuel flow can change in a fraction of a second; a rotor with real inertia
cannot. For the interval in between, the combustor is being fed for a speed the
compressor has not reached, the back-pressure runs ahead of the airflow, and the
operating point climbs off the working line towards the surge line. This is
precisely what a FADEC's **acceleration schedule** exists to prevent, by
rationing fuel against measured N2 — and it is exactly the protection this model
does not have.

That absence is now the feature. The model surges because it has no acceleration
schedule, and saying so is a better explanation of what a FADEC is for than any
amount of prose about one.

## Scope

In:

* a **surge margin** computed every frame from the mismatch between commanded
  fuel and the flow the HP rotor is actually passing, against a tabulated surge
  line;
* surge arising **as a consequence of a regime**, never from a button — a slam
  from idle to full power surges, a measured advance does not;
* the surge **cycle**: bangs at a few hertz, flow reversal through the core,
  T4 spikes, an N2 droop, thrust collapse;
* **both outcomes**: pull the lever back and the engine recovers; hold it up and
  the surge locks into a steady stall with hung speed and rising temperature,
  from which only a shutdown remains;
* the flow picture — core particles expelled forward out of the intake during
  each bang, and stall cells running round the annulus at half rotor speed;
* the sound — an impulsive bang, which the synthesis currently has no way to
  make, over an intermittent roar;
* a **compressor map** in the panel: working line, surge line, and the operating
  point moving on it, so the phenomenon can be watched rather than only heard;
* the instrument panel telling the reader what is happening and what to do.

Out, and deliberately:

* **The rest of BL-02.** Red zones on the instruments, T4 and speed limiting, a
  FADEC governor. BL-03's own text says it should follow BL-02; it is being done
  first because surge is the phenomenon that motivates limits, not the other way
  round. What this spec takes from BL-02 is only the one threshold it needs —
  the stability boundary — and nothing that belongs to the instruments.
* **Bleed-induced surge** (BL-04). No bleed air flows in the model yet, so there
  is no handle to mishandle.
* **Variable stator vanes and handling bleed valves.** The real HPC has both,
  and they are the reason the surge line sits where it does. They are folded
  into the tabulated surge line rather than modelled as moving hardware; the
  geometry has no VSV rings to turn.
* **Flame-out, hot start, hung start.** BL-01 territory. A surge in this model
  never blows the flame out — the burner keeps burning, which is the common case
  and the one where the cycle repeats.
* **Structural consequences.** Blade damage, bird ingestion, a surge that ends
  the engine's life. The model has no mechanics (§10 of the physics document).
* **Ram effects and inlet distortion.** Crosswind and high angle of attack are
  real surge causes and need an aircraft and an airspeed, neither of which
  exists here.

## The stability model

### What the compressor sees

The model already computes an HPC pressure ratio from HP speed: `main.js` uses
`comp = n2^2.5` and `P = p·(1 + 27·comp)` in the station table. That is the
**working line** — the locus the operating point sits on in steady running — and
this design takes it as given rather than inventing a second one.

The operating point leaves that line when the temperature at turbine entry runs
ahead of what the speed calls for. The reason is a genuine piece of gas
dynamics rather than a fudge: the HP turbine nozzle is choked in every regime
that matters, so it passes a fixed corrected mass flow,

```
W · sqrt(T4) / P4 = const
```

At a fixed corrected speed the compressor delivers a fixed `W`, so the pressure
in front of the turbine — and therefore the pressure ratio the compressor is
working against — must rise as the square root of the temperature:

```
PR_op / PR_work = sqrt( T4 / T4ref(n2) )
```

where `T4ref(n2)` is the temperature that HP speed would settle at in steady
running. Both temperatures are **absolute**; in Celsius the relation is simply
false.

### Which temperature drives it

Here the design departs from the obvious reading, and the reason is worth
stating because it looks like a shortcut and is not.

The margin is computed from the **commanded fuel flow**, `eng.wf`, not from the
displayed `eng.t4`. In the model `wf` drives `burn` with a time constant of
0.7 s, and `burn` drives `t4` with another of 0.6 s. Chained, those two lags
smear the fuel spike out over seconds and the operating point never climbs far
enough to reach the boundary — the engine could not be made to surge at any
throttle movement whatever.

That chain is not wrong; it is measuring the wrong thing. Fuel reaches the
flame within a combustor residence time — milliseconds — and the back-pressure
follows it. What lags is the **flame** the model draws (`burn`) and the
**indicated** temperature (`t4`); real EGT thermocouples have time constants of
seconds for exactly the reason modelled here, mass in the probe. So the
compressor's stability is decided by the fuel being injected, while the
instrument catches up afterwards, which is also how it looks from the flight
deck: the bang comes first, the EGT needle second.

### The fuel command

`engineState.js` gains one new state variable:

```
wf   commanded fuel flow, in the same units as burn (0..~1.1)
```

In steady running `wf` equals today's `burn` target exactly, so nothing about
the model's settled behaviour changes:

```
wf_steady = 0.1 + 0.9 · keff
```

On a transient it leads, by the HP speed error — which is what a fuel schedule
is a function of:

```
wf = 0.1 + 0.9·keff + LEAD · (n2cmd − n2) / (1 − IDLE_N2)
```

`LEAD = 0.32`. The term is zero in the steady state and decays with the HP
rotor's own time constant (2.0 s accelerating), so the overshoot lasts the few
seconds a slam's EGT overshoot actually lasts. On a deceleration it goes
negative — the fuel is cut back below the steady value — which moves the point
away from surge, correctly: a chop risks a lean blow-out, a different failure
that this spec does not model.

**Where 0.32 comes from.** It is not chosen, it is cornered. Three requirements
bracket it, and they were checked by sweeping the constant against the real
integration rather than argued:

| Requirement | Bound on LEAD |
|---|---|
| A slam from idle to full power must surge, and for long enough to see | > 0.24 |
| An advance from idle to 50 % must not surge, even taken instantly | < 0.36 |
| A slam from cruise power to full must not surge | (satisfied throughout) |

0.32 sits in the middle of that window with room on both sides: at 0.32 the
50 % advance keeps a margin of +0.031, and the slam crosses the boundary by
−0.071.

**The input is a drag, not a step.** The throttle is a slider, and `oninput`
fires continuously as it is dragged, so the user never applies a step. What
decides the outcome is how *long* the drag takes, which is the honest control
and turns out to be nicely graded at this constant:

| Drag from idle to full | Outcome |
|---|---|
| under 0.5 s (a flick) | surges |
| about 0.7 s | on the boundary |
| 1 s or slower | no surge |
| 2 s (deliberate) | margin never falls below +0.071 |

So the reader provokes a surge by *flicking* the lever and avoids one by
*advancing* it — which is exactly the distinction the phenomenon is about, and
it needs no instruction to discover.

`burn` then follows `wf` instead of following `0.1 + 0.9·keff` directly. Since
the two are equal in the steady state, every settled number in the existing
documentation and tests is unchanged; what changes is that a slam now produces a
T4 overshoot, which a real slam does.

### The surge line

`T4ref(n2)` inverts the steady mapping:

```
keff_steady(n2) = (n2 − IDLE_N2) / (1 − IDLE_N2)      clamped to 0..1
T4ref(n2)       = T4_K( 0.1 + 0.9 · keff_steady(n2) )
```

and the boundary is the working line raised by a tabulated margin `SM0(n2)`:

| n2 | 0.30 | 0.50 | 0.60 | 0.70 | 0.80 | 0.90 | 1.00 |
|---|---|---|---|---|---|---|---|
| SM0 | 0.30 | 0.20 | 0.16 | 0.17 | 0.20 | 0.25 | 0.28 |

The shape is the point: the margin is **narrowest just above idle** and widens
towards take-off power. That is why surge is a low-speed, transient phenomenon
rather than something that happens at full power, why handling bleed valves and
variable stators exist at all, and why an acceleration schedule is at its most
restrictive exactly where the engine feels most sluggish.

The margin itself:

```
SM = (1 + SM0(n2)) / sqrt( T4(wf) / T4ref(n2) ) − 1
```

Positive is stable, zero is the boundary. In the steady state `T4(wf) = T4ref`
and `SM = SM0(n2)` exactly, so the read-out at rest is the tabulated margin —
which makes the number checkable against the table rather than against itself.

**The honest caveat**, which BL-03 asks for by name and which must appear in the
documentation and beside the chart: none of this is computed from gas dynamics.
The working line is the model's own pressure-ratio formula, the surge line is a
table of plausible numbers, and the only real physics in it is the choked-nozzle
relation between temperature and pressure. It is exactly as much of a
calculation as the velocity and temperature profiles in `airflow.js` — that is,
a tabulated shape with the right behaviour, not a solution.

### What a slam does, numerically

From a settled idle (`n1 = 0.180`, `n2 = 0.560`, `T4 = 495 °C`), lever to the
stop:

From a settled idle, lever to the stop, **with the surge mechanism inactive** —
that is, the bare question of whether the point crosses at all:

| Slam from idle to | lowest SM reached | crosses? |
|---|---|---|
| 50 % | +0.046 | no |
| 70 % | +0.005 | no, barely |
| 75 % | −0.005 | yes |
| 100 % | −0.049 | yes |

and slammed to full power from a *settled* starting power instead of from idle:

| Slammed to 100 % from | lowest SM | crosses? |
|---|---|---|
| idle | −0.049 | yes |
| 10 % | −0.022 | yes |
| 20 % | +0.016 | no |
| 50 % | +0.117 | no |
| 80 % | +0.226 | no |

Surge is therefore reachable only from low power and only on a fast movement,
which is exactly what it is in life, and both facts are properties of the model
rather than cases written into it.

(These figures were produced by sweeping the real integration; they are to be
**recomputed by the test**, never copied into the documentation from here.)

## The surge event

A new pure module, `src/surge.js`, holds the compressor map and the sub-state
machine, on the pattern of `reverser.js`: no Three.js, no DOM, runnable under
Node. `engineState.js` imports it; nothing imports `engineState.js` back.

### States

```
clear  → surging : SM <= 0
surging → clear  : SM >= SM_RECOVER, held for RECOVER_HOLD
surging → stall  : surging continuously for LOCK_TIME
stall  → clear   : fuel cut only (mode leaves 'run')
```

`SM_RECOVER = 0.04` gives the hysteresis that stops the state flickering on the
boundary. `LOCK_TIME = 4 s`.

This is a **sub-state of `run`**, not a fifth engine mode. The engine is still
running, the reverser interlock still reads `run`, the throttle is still live —
and it must be live, because pulling it back is the recovery action. Adding a
fifth mode would have broken all three.

### The cycle

`surging` runs a relaxation oscillator at `SURGE_HZ = 4` (real full surge runs
3–10 Hz). Per cycle it emits:

* **`bangs`** — a monotone integer, incremented once per cycle wrap, with the
  oscillator wrapping in a `while` so that several wraps inside one step each
  count. Consumers latch on a change, the discipline `main.js` already uses for
  `rev.mode`. A boolean would be safe only by coincidence: `dt` is capped at
  0.05 s and the ×4 time scale multiplies it, giving a largest step of 0.20 s
  against a 0.25 s cycle — 20 % of headroom, resting on three constants in two
  files with nothing tying them together, and gone entirely if `SURGE_HZ` is
  ever moved within the 3–10 Hz the spec itself quotes. A counter is correct at
  any step size, and it makes the bang count a direct read rather than a tally
  the test has to accumulate.
* **`reverse`** — 0..1, a pulse shaped over the first quarter of the cycle: how
  much of the core flow is going the wrong way at this instant.

From those the state machine applies, in `engineState.js`:

* a **rotor droop** — extra decay proportional to `reverse`, `DROOP_N2 = 0.95`
  and `DROOP_N1 = 0.40` per second at the peak of a pulse, so the spools lose
  speed on each bang and the speed trace steps down between them. The HP rotor
  loses more than twice as much as the LP one: it is the HP compressor that has
  stalled, and the fan is still being driven by an LP turbine that is still
  being fed;
* a **T4 spike** — a boost proportional to `reverse`, because the fuel is
  unchanged while the air passing the burner has momentarily gone; it is added
  to the **burn target** rather than to `t4`, so the existing lag still shapes
  it and the indicated temperature climbs the way an EGT needle does;
* a **thrust collapse** — `grossThrust` multiplied by `1 − 0.85·reverse`.

The droop is what makes the surge **self-sustaining while the lever stays up**:
N2 falls, `T4ref(n2)` falls with it, the margin stays negative, and the next
cycle follows. Pull the lever back and `wf` collapses, the ratio drops below
one, and the margin goes positive within a cycle or two. Both outcomes fall out
of one mechanism rather than being scripted, which was the thing worth checking
before writing any of it — and it was checked, by simulation, before this spec
was finished.

### The locked stall

In `stall` the oscillator stops and nothing is expelled forward: the flow is no
longer oscillating, it is simply bad. Two things replace it.

* **The spools hang.** The rotor targets are capped — `HUNG_N2 = 0.45`,
  `HUNG_N1 = 0.30` — however far the lever is advanced. A stalled compressor
  cannot pass the air to go faster, and that is what "hung" means.
* **A steady choke**, `STALL_CHOKE = 0.35`, stands in for the lost throughput
  and feeds the same T4 boost and thrust collapse the pulse did.

The important detail, and the one that is easy to get wrong: the **fuel command
is not capped**. `wf` follows the *commanded* HP speed from the lever, not the
capped target — the lever is still up, so fuel is still going in. That is why
the temperature sits high in a stall instead of settling back with the speed,
and it is the whole reason a stall is a hazard rather than an inconvenience.

Because `wf` stays high while `n2` hangs low, the margin stays firmly negative
(around −0.17) and the state cannot exit on its own. It clears only on a fuel
cut — leaving `run` — which is the correct real answer as well.

A stall cell angle advances at `STALL_CELL = 0.48` of rotor speed for the flow
view.

### Verified before writing

Five scenarios were simulated against the real integration to confirm that one
mechanism gives all the required behaviour:

| Scenario | Result |
|---|---|
| Slam to 100 % and hold | 17 bangs over 4 s, then `stall`; N2 hangs at 0.46, T4 peaks near 1745 °C and stays there |
| Slam, lever back to idle after 1 s | 8 bangs, returns to `clear`, N2 recovers to idle |
| …then a measured re-advance | accelerates normally, no second surge |
| Deliberate advance over 2 s | never surges, margin never below +0.071 |
| Idle, untouched | margin sits at exactly `SM0(0.56)` |

### Time scale

The ×4 time scale multiplies `eng.update(dt·k)` and therefore multiplies the
surge frequency too. That is left alone deliberately: the alternative is a
second clock inside one scene, and the model already refuses that for the
reverser. The documentation says to watch a surge at ×1.

## What each subsystem does

### Flow — `src/airflow.js`

Core particles only; the bypass duct carries on untouched, which is true and is
also the same claim the reverser work already made in the other direction.

On a **bang**, a cohort of core particles between the booster face and the
turbine is marked `expelled` — decided **once**, at the instant of the bang,
with a probability equal to `reverse`. This is the same discipline the reverser
deflection uses and for the same reason: re-rolling per frame turns a flow
reversal into a fog of particles changing their minds. Marked particles travel
**forward**, out through the intake, and fade once clear of the lip.

They keep the colour the temperature tables give them, so they leave hot — the
gas coming out of the intake is combustor air, and the existing ramp already
makes that orange without a new mechanism. BL-03 asked for exactly this.

In **stall**, two cells occupy `STALL_SECTORS = 2` angular sectors of 50° that
advance at 0.48 of rotor speed. A core particle inside a cell moves at 15 % of
its normal speed. The cell angle comes from `surge.js`, so the number that
governs what is seen is the one the test checks.

### Sound — `src/sound.js`

The synthesis has no impulsive component at all; a bang has to be built.

`bang(strength, when = ctx.currentTime)` — a one-shot: a short slice of the
existing brown-noise buffer through a resonant bandpass near 90 Hz (the duct's
own note, and already the frequency the rumble bus is tuned to), with a 5 ms
attack and a 350 ms decay, plus a brighter 300 Hz component for the crack.
Nodes are created per bang and disposed by their own `onended`, the standard
Web Audio idiom for one-shots, which keeps the persistent graph unchanged.

**The `when` parameter is what makes it testable, and it is not optional.**
`OfflineAudioContext.startRendering()` runs the whole render with no JavaScript
between quanta, so nothing can call `bang()` *during* an offline render. Every
call has to happen before `startRendering()`, where `ctx.currentTime` is 0 — so
a bang implicitly scheduled at "now" would stack every impulse at t = 0 and the
one genuinely new component in this sound work would be the one part with no
verification path. With an explicit time the harness schedules
`s.bang(1, 0.5); s.bang(1, 0.75)` before rendering and gets impulses at known
instants, measurable with the existing `phases.py` and `compare.py`. The browser
passes nothing and behaves exactly as described. It also matches how the rest of
`sound.js` already works: every parameter change goes through
`setTargetAtTime(v, ctx.currentTime, tc)`, absolute context time already.

**No decay-window guard.** The tempting safety net — refuse a new bang while the
previous one is still decaying — is inverted here and would be a silent bug: the
decay is 350 ms and the cycle is 250 ms, so a new bang *always* arrives inside
the previous decay. The guard would be permanently satisfied and would drop
every second bang, halving the audible rate against a simulated 4 Hz while the
test, which counts bangs out of the state machine rather than out of the audio
graph, stayed green. The accumulation it defends against is not real: a source
node with a finite buffer ends on its own, steady-state concurrency is 350/250 ≈
1.4 chains, and `LOCK_TIME` bounds the whole episode at about seventeen bangs.
The rate limit belongs in `main.js` instead — one one-shot per frame however
many wraps occurred, because two bangs 5 ms apart is worse than one.

`onended` is used for disposal only. It fires *after* an offline render
completes rather than during it, so nothing that has to be correct may depend
on it.

During `surging` the steady components are modulated by `reverse`: the jet noise
and the fan tones drop away as the flow does, the rumble rises. In `stall` a
rough, unsteady band replaces them.

`update()` gains one more argument rather than a second entry point, matching
how `rev` was added; `bang()` is separate because it is an event, not a state.

### Instruments — `src/main.js`, `index.html`, locales

* A **status bar** for stability, next to the reverser's: `STABLE` /
  `SURGE` / `STALLED`, with a hint line saying what is happening and what to do.
  Class names in `main.js`, text in the dictionaries, exactly as `MODE_CLASS`
  and `REV_CLASS` already are.
* An **SM read-out** in the gauges block.
* A **compressor map** — a 2D canvas, 220×150, under the stability bar:
  corrected flow across, pressure ratio up, the working line, the surge line
  above it, and a dot for the current point that climbs into the boundary during
  a slam and drops back. Drawn from the same functions in `surge.js` that decide
  whether the engine surges, so the chart cannot disagree with the behaviour.
  It redraws only when the point has actually moved, on the same hash discipline
  as `updateGauges`.
* A **bloom flash** on each bang: `bloom.strength` pulses. The flash out of the
  intake is real and this is the cheapest honest way to show it; no new shader.

The map is a canvas rather than SVG or DOM because `livery.js` already
establishes canvas drawing in this codebase, and because a chart redrawn a few
times a second should not be touching the DOM tree.

### What does not change

The heat haze, the plume, the contrail and the bypass stream are all left alone.
A surge is a core event; the fan keeps turning, driven by an LP turbine that is
still being fed, and the bypass duct never stops flowing. Reaching into
`heathaze.js` would be reaching for an effect the physics does not ask for.

## Testing

A new `test/surge.test.mjs`, the tenth test file, in the house style: plain
Node, its own `check()`, one line per check, exit 1 on failure. It drives the
**real** `createEngineState()` rather than a mock, as `reverser.test.mjs` does.

The propositions worth checking:

*The map and the margin*
* in the steady state the margin equals the tabulated `SM0(n2)` exactly — the
  check compares the two halves of one fact rather than a consequence;
* the margin is positive at every steady throttle position from idle to
  take-off, swept in 1 % steps: a settled engine must never sit on the boundary;
* the surge line is above the working line everywhere;
* the working line is monotone in `n2`.

*The trigger*
* a slam from idle to full power surges, and does so within the first second;
* an advance from idle to 50 % does not, at any point of the transient;
* a slam from cruise power to full does not — the margin is wide up there;
* a deceleration never surges.

*The event*
* the bangs are counted and land at the design frequency;
* N2 droops measurably during the surge and T4 spikes above the pre-slam value;
* thrust collapses below a fraction of its pre-surge figure.

*The outcomes*
* lever back to idle within a second of the first bang: the engine returns to
  `clear`, N2 recovers to idle, and it can be accelerated again afterwards;
* lever held up: the state reaches `stall` within `LOCK_TIME`, speed hangs, T4
  is higher than in surge, and no throttle movement clears it;
* a fuel cut clears it, and the engine can then be restarted normally — checked
  through the real state machine, not by inspecting a flag.

*Guards on what must not change*
* the steady-state `wf` equals the old `burn` target at every throttle position,
  to floating point — this is the guarantee that no existing documented number
  moved;
* a start from cold never surges, at any throttle position, throughout the whole
  40 s sequence.

The trace it prints (the house style: every state-machine test prints one) is
the slam — margin, N2, T4 and the bangs, at 0.1 s resolution — which is also
the tuning tool for `LEAD` and the `SM0` table.

`engine-state.test.mjs` gets one addition: that the *settled* numbers it already
checks are unchanged is what it does anyway, so if `wf` were wired wrongly that
file would fail. That is the intended safety net and it needs no new check.

## Documentation

Per `CLAUDE.md`, in the same commits as the changes:

| Document | What goes in |
|---|---|
| `03-physics.md` | A new section: the working line, the choked-nozzle relation, the surge line table, the caveat that none of it is computed. §10 loses "compressor surge" from the list of what is missing, and §11 gains the propositions verified |
| `05-modes.md` | Surge as a regime: how it is provoked, the sub-state machine diagram, the two outcomes, what is seen and heard |
| `04-airflow.md` | The expelled cohort and the stall cells, alongside the reverse section that already describes the same cohort discipline |
| `06-sound.md` | The bang: why the graph had no impulsive component and how one is made |
| `07-ui.md` | The stability bar, the SM read-out, the compressor map and how to read it |
| `01-architecture.md` | `surge.js` in the module graph and in the frame data flow |
| `08-development.md` | Test counts, the tenth test file, the limitations list |
| `09-backlog.md` | BL-03 marked done, with what was left out (BL-02's instruments, BL-04's bleed) |
| `README.md`, `CLAUDE.md` | Nine test files become ten; the module list and the recounted numbers |

Every number quoted is to be **recounted** from the model, per the standing rule
in `CLAUDE.md`, not copied out of this spec.

## Risks

* **The tuning is circular.** `LEAD` and the `SM0` table together decide whether
  a slam surges, and both are free. Mitigation: `SM0` is pinned by its shape
  (narrowest above idle) and by the requirement that no steady throttle position
  sits on the boundary; `LEAD` is pinned by the requirement that 50 % does not
  surge and 100 % does. Two constants, three constraints — the test states all
  three, so a later change to either has to keep them.
* **The surge could be unreachable or unavoidable.** The test sweeps every
  steady throttle position and both slams, so either failure mode is caught by
  `npm test` rather than by a reader.
* **`burn` re-pointed at `wf`** touches the one variable every visual effect
  reads. Guarded by the steady-state equality check and by the existing
  `engine-state.test.mjs`.
* **`burn` can now exceed 1**, which it never could before, because the surge
  boost is added to its target. Every consumer was checked: `heathaze.hazePower`
  clamps at 1.15, `contrailView` clamps at 1, `airflow` feeds it through
  `tempColor` which clamps, and the flame and plume shaders simply get brighter
  — which is what a surge should look like. Only `sound.js` uses it unbounded,
  in `0.66·burn^1.4`, and that runs into a compressor. A documented ceiling
  `BURN_MAX = 1.2` (T4 = 2090 °C) is applied at the target so the excursion is
  bounded and visible as an over-temperature rather than unbounded. In practice
  the simulated worst case reaches burn ≈ 0.96.
* **Per-bang audio nodes** could accumulate if `onended` never fires. Bounded
  not by a decay window — see above, that guard is inverted and would halve the
  audible rate — but by the physics of the thing: a finite buffer source ends on
  its own, concurrency sits near 1.4, and `LOCK_TIME` caps an episode at about
  seventeen bangs. If a belt is wanted anyway it is a cap on concurrent
  one-shots at a small integer, which never fires in practice and does not
  couple the audio to `SURGE_HZ` the way a decay window does.
