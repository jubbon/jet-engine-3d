# Compressor surge (BL-03) — Implementation Plan

Plan for the design spec
[`2026-08-10-compressor-surge-design.md`](../specs/2026-08-10-compressor-surge-design.md).
Read that first: this file says how and in what order, not what or why.

## Global constraints

* **English** in code, comments, tests, documentation and commit messages.
* **Comments explain the reason, not the mechanics.** Match the density and tone
  of the file being edited. `engineState.js` carries a block comment per
  non-obvious decision; the surge model is nothing but non-obvious decisions.
* **`engineState.js` and `surge.js` know nothing about Three.js or the DOM.**
  That is what makes them checkable under Node, and it is the whole reason the
  computational part of this feature lives there.
* **Every user-visible string goes through `t()`** and lands in all eight
  locales in the same commit; `index.html` carries the English copy.
* **Atomic commits.** One aspect per commit, nothing unrelated bundled in, and a
  body that says why. Documentation for a change ships in the commit that makes
  the change.
* **`npm test` passes at every commit.** Not at the end — at every one.
* Numbers quoted in documentation are **recounted** from the model, never copied
  from the spec or from this plan.

## File structure

```
src/surge.js             NEW  pure: compressor map, margin, surge sub-state machine
src/engineState.js            + wf fuel command, surge wiring, droop, hung stall
src/airflow.js                core flow reversal, expelled cohort, stall cells
src/sound.js                  bang() one-shot, surge modulation
src/main.js                   wiring, stability bar, SM gauge, compressor map, bloom flash
index.html                    stability bar, SM gauge, map canvas
src/style.css                 the map canvas
src/locales/*.js         ×8   new keys
test/surge.test.mjs      NEW  the tenth test file
package.json                  the new test in the sequence
docs/*.md                     01, 03, 04, 05, 06, 07, 08, 09
README.md, CLAUDE.md          nine test files -> ten, recounted numbers
```

## Decisions taken in this plan, not in the spec

**`eng.bangs` is a monotone counter, not a boolean.** At `SURGE_HZ = 4` a cycle
is 0.25 s and the largest simulated step is 0.20 s (`dt` capped at 0.05 s, ×4
time scale). That is only 20 % of headroom, it rests on three constants in two
files with nothing tying them together, and it disappears entirely if
`SURGE_HZ` moves anywhere in the 3–10 Hz range the spec itself quotes as real.
So the oscillator wraps in a `while`, incrementing `bangs` on each wrap, and
consumers latch on a change — the discipline `main.js` already uses for
`rev.mode`. Correct at any step size, and the bang count becomes a direct read
rather than a tally the test accumulates.

**The audible rate limit lives in `main.js`, not in `sound.js`.** One one-shot
per frame however many wraps occurred: two bangs 5 ms apart is worse than one.
The counter stays honest for the flow and the tests; the consumer decides its
own rate. The particle cohort marking is keyed off the **same** counter, or at
×4 the sound and the particles could disagree about how many bangs happened —
which is the exact failure the discrete event exists to prevent.

**`bang()` takes an explicit time.** `bang(strength, when = ctx.currentTime)`.
Without it the component cannot be verified at all: `startRendering()` runs an
offline render with no JavaScript between quanta, so every `bang()` call must
happen *before* it, where `currentTime` is 0, and they would all stack at t = 0.
See the spec for the full reasoning — this is the difference between the one new
audio component being tested and not being tested.

**The margin is exported as a function, not only as state.** `main.js` needs
`workingLine`, `surgeLine` and `correctedFlow` to draw the chart. Drawing it
from the same functions that decide whether the engine surges is what stops the
chart and the behaviour from disagreeing — the failure mode a hand-drawn chart
would have.

## Task order

The order is chosen so that every commit is green and each one is a complete
thought. The pure module comes first and is fully tested before anything is
wired to it; the fuel command is separated from the surge itself because it
changes existing behaviour and deserves to be bisectable on its own.

---

### Task 1: The compressor map as a pure module

**Files:** `src/surge.js` (new), `test/surge.test.mjs` (new), `package.json`,
`docs/03-physics.md`, `CLAUDE.md`, `README.md`

Create `src/surge.js` with the map only — no state machine yet:

```js
export const SM0 = [[0.30,0.30],[0.50,0.20],[0.60,0.16],
                    [0.70,0.17],[0.80,0.20],[0.90,0.25],[1.00,0.28]];
export function workingLine(n2)      // pressure ratio on the steady locus
export function surgeLine(n2)        // workingLine * (1 + SM0(n2))
export function correctedFlow(n2)    // the chart's x axis
export function refT4(n2)            // steady turbine entry temperature, K
export function surgeMargin(n2, wf)  // (1+SM0)/sqrt(T4(wf)/refT4) - 1
```

`workingLine` reuses the model's own HPC pressure ratio, `1 + 27·n2^2.5` — the
same expression `main.js` already uses in the station table. Do not invent a
second one; if that formula ever changes, both must move together, and a comment
in each place must say so.

`correctedFlow(n2)` must be **defined**, not implied: the model has no mass flow
anywhere, so it is a stand-in proportional to `n2`, and both the function's
comment and the chart's axis label have to say so. A chart promising to be drawn
from the functions that decide the behaviour cannot have an undefined axis.

`surgeMargin` floors `wf` at zero before taking the square root. On a chop the
lead term is negative by design, and a negative `T4(wf)` would return `NaN` — a
hole in the model rather than an error. No realistic chop reaches it; nothing in
the arithmetic prevents it either.

Write the block comment that explains the choked-nozzle derivation and states
the caveat: the working line is the model's own formula, the surge line is a
table, and only the temperature–pressure relation between them is physics.

`test/surge.test.mjs` — the map half:

* the surge line is above the working line at every `n2` from 0 to 1 in 1 %
  steps;
* the working line is monotone increasing in `n2`;
* `surgeMargin` at the steady fuel command equals `SM0(n2)` exactly (to 1e-12)
  at every `n2` — the two halves of one fact compared directly;
* every `SM0` entry is positive and the interpolation never dips below the lower
  of its endpoints. Do **not** write "the margin is positive at every settled
  throttle position, swept in 1 %": in the steady state that is `SM = SM0(n2)`
  by construction and can only fail if the table holds a negative number. Check
  the table; do not dress it up as a sweep;
* `surgeMargin` returns a finite number for a `wf` driven far negative;
* `correctedFlow` is monotone.

Add `node test/surge.test.mjs` to the `test` script in `package.json`, at the
end of the sequence next to `reverser`. Update the test-file table in
`CLAUDE.md` (nine files become ten) and the check count in `README.md` — both
**recounted** from an actual run.

`docs/03-physics.md`: new section for the compressor map, with the derivation
and the caveat. Do not yet touch §10 — surge is not modelled until Task 4.

**Green because:** nothing is wired; the new test only exercises new pure code.

---

### Task 2: The surge sub-state machine

**Files:** `src/surge.js`, `test/surge.test.mjs`

Add `createSurge()` to `src/surge.js`, and the constants it needs:

```
SURGE_HZ = 4        cycles per second
LOCK_TIME = 4.0     s of continuous surging before it locks
SM_RECOVER = 0.04   hysteresis: margin needed to start recovering
RECOVER_HOLD = 0.3  s that margin must be held before declaring it clear
STALL_CELL = 0.48   stall cell speed, fraction of rotor speed
DROOP_N1 = 0.40     per second at peak reverse
DROOP_N2 = 0.95
HUNG_N1 = 0.30      where the spools hang in a locked stall
HUNG_N2 = 0.45
STALL_CHOKE = 0.35  steady loss of throughput in a locked stall
```

`update(dt, margin, running)` advances `clear → surging → stall` per the spec
and exposes `{ state, reverse, choke, bang, phase, cell }`. `running` false
(fuel cut) returns it to `clear` from any state — that is the only exit from
`stall`, and it belongs here rather than in the caller so the rule is testable.

The reverse pulse is `sin(π·phase/0.3)` over the first 30 % of the cycle and
zero after. Comment why it is a pulse and not a sine: the flow does not spend
half of each cycle going backwards; it breaks down, is expelled, and re-
establishes.

Tests, driven by **synthetic** margins so the sub-state machine is checked
independently of the engine that will feed it:

* a margin held at −0.1 produces bangs at the design frequency (count over 10 s
  against `SURGE_HZ` within one cycle);
* it locks into `stall` at `LOCK_TIME` and not before;
* a margin restored to +0.1 clears it — but only after `RECOVER_HOLD`, not
  instantly;
* a margin oscillating across zero does not chatter the state (hysteresis);
* once in `stall`, no margin whatever clears it while `running` is true;
* `running` false clears it from both `surging` and `stall`;
* `reverse` is zero in `clear` and in `stall`, and non-zero only within a pulse;
* `bangs` counts correctly when stepped with a `dt` spanning several cycles —
  the reason it is a counter with a `while` wrap rather than a boolean. Step it
  at 0.6 s against a 0.25 s cycle and it must advance by two or three, never by
  one.

**Green because:** still nothing wired.

---

### Task 3: The fuel command

**Files:** `src/engineState.js`, `test/surge.test.mjs`, `docs/03-physics.md`,
`docs/05-modes.md`

Add `eng.wf` and re-point `burn` at it. **`wf` must carry the same mode
structure `burnTarget` already has** — this is the single most important line in
the task:

```js
const n2cmd = IDLE_N2 + (1 - IDLE_N2) * throttle;
eng.wf = !burning ? 0
  : eng.mode === 'start' ? 0.3
  : clamp(0.1 + 0.9 * eng.keff + LEAD * (n2cmd - eng.n2) / (1 - IDLE_N2), 0, BURN_MAX);
```

with `LEAD = 0.32` and `BURN_MAX = 1.2`, and `burnTarget = eng.wf` throughout.

Write the lead term **only** in the `run` branch. Without that gate the model
surges on the default path: during cranking `n2` sits near `START_N2 = 0.30`
while the lever stays where it was left, and `main.js` boots at `throttle =
0.85`, giving `wf = 0.561` against `T4ref(0.30) = 495 °C` — `SM = −0.049`, so
every start would surge. The `!burning → 0` branch matters equally at the other
end: if it did not win, a fuel cut would leave fuel commanded, and the fuel cut
is the one thing that clears a locked stall in Task 4.

The block comment must carry the two things a reader will otherwise get wrong:
why the margin is computed from the fuel command rather than from the indicated
`t4` (the flame and the thermocouple both lag; the back-pressure does not), and
where 0.32 comes from (bracketed by three requirements, not chosen).

Tests added to `test/surge.test.mjs`:

* **the guard**: at every settled throttle position from 0 to 100 %, `eng.wf`
  equals the old expression `0.1 + 0.9·keff` to floating point. This is the
  guarantee that no documented steady number moved, and it is the reason this
  task is a commit of its own.
* a slam produces a T4 overshoot above the settled value for that throttle;
* a chop produces a temporary undershoot;
* **`wf` carries no lead term at any point of a start**, with the throttle left
  at the 0.85 `main.js` boots with — the regression test for the gate above;
* a fuel cut drives `wf` to zero immediately, whatever the lever is doing.

`docs/03-physics.md` §3/§4 and `docs/05-modes.md` (throttle response): the
overshoot on a slam is new visible behaviour and has to be described.

**Green because:** `engine-state.test.mjs` checks settled values and start
behaviour, both unchanged by construction — and the new guard test proves it
rather than assuming it. If this commit breaks anything, it breaks here, in
isolation, which is exactly the point.

---

### Task 4: Surge in the state machine

**Files:** `src/engineState.js`, `test/surge.test.mjs`, `docs/05-modes.md`,
`docs/03-physics.md`

Wire `createSurge()` into `createEngineState()`. Per update, in this order:

1. compute `n1cmd`/`n2cmd` from the throttle and `eng.wf` from them;
2. `eng.sm = surgeMargin(eng.n2, eng.wf)`;
3. `surge.update(dt, eng.sm, eng.mode === 'run' && eng.fuel)`;
4. cap the rotor targets at `HUNG_N1`/`HUNG_N2` when the state is `stall`
   — **the fuel command is not capped**, and a comment must say why: the lever
   is still up, so fuel is still going in, and that is why the temperature sits
   high while the spools hang;
5. integrate the rotors, then subtract `DROOP_n·reverse·dt`;
6. add `0.45·(reverse + choke)` to the burn target;
7. multiply `eng.grossThrust` by `1 − 0.85·(reverse + choke)`.

Expose on `eng`: `sm`, `surge` (the state string), `bang`, `reverse`, `cell`.

Tests — the scenarios, all through the real state machine:

* a slam from idle to full power surges, within the first second;
* an advance from idle to 50 % never does, checked at every step of the
  transient;
* a slam to full from 50 % power never does;
* a deceleration never does;
* a 2 s drag from idle to full never does, and a 0.3 s drag does — the drag, not
  the step, is what the reader actually applies;
* held up, the state reaches `stall` within `LOCK_TIME`; the spools hang near
  `HUNG_N1`/`HUNG_N2`; T4 is higher than before the slam; no throttle movement
  clears it;
* lever back within a second: returns to `clear`, N2 recovers to idle, and the
  engine accelerates normally afterwards without a second surge;
* a fuel cut clears a locked stall, and the engine restarts normally;
* a start from cold never surges at any throttle position throughout the whole
  ~40 s sequence;
* N2 droops and T4 spikes measurably during the surge; thrust collapses.

Print the slam trace — margin, N2, T4, state and bangs at 0.1 s resolution. Every
state-machine test in this repo prints one, and this is the tuning tool for
`LEAD` and the `SM0` table.

`docs/05-modes.md`: the surge section, with the sub-state diagram, how it is
provoked, and the two outcomes. `docs/03-physics.md` §10: remove compressor
surge from the list of what the model does not have — and add, in its place,
what is still missing (limits, protections, the FADEC governor: BL-02). §11:
the propositions now verified.

---

### Task 5: The flow

**Files:** `src/airflow.js`, `src/main.js`, `docs/04-airflow.md`

`airflow.update()` gains `surge` — an object, not four positional arguments,
because four would be four chances to transpose two of them at the call site.

On a bang, mark a cohort of **core** particles between the booster face and the
turbine as `expelled`, decided once with probability `reverse`, exactly as the
reverser marks its deflected cohort at `X_DOORS`. Expelled particles travel
forward, leave through the intake and fade past the lip; they keep the colour
the temperature table gives them, so they leave hot without a new mechanism.

In `stall`, two 50° sectors advancing at `STALL_CELL` of rotor speed slow the
core particles inside them to 15 %.

The bypass duct is untouched, and `docs/04-airflow.md` should say so next to the
reverse section that already makes the mirror-image claim.

Test additions: with the engine driven into surge, core particles appear forward
of the intake lip and none of them leaves the core duct radially; with it clear,
none ever appears forward of the lip. Follow the reverser test's discipline —
assert on **where the particles are**, which does not oscillate, not on counts
in a window, which do.

---

### Task 6: The sound

**Files:** `src/sound.js`, `docs/06-sound.md`

`bang(strength, when = ctx.currentTime)` — a one-shot built per call: a short
slice of the existing brown-noise buffer through a bandpass near 90 Hz with a
5 ms attack and 350 ms decay, plus a brighter 300 Hz component for the crack.
Nodes are disposed by their own `onended` — disposal only; `onended` fires after
an offline render rather than during it, so nothing that must be correct may
depend on it.

**Do not add a decay-window guard.** "Refuse a new bang while one is still
decaying" is inverted here: the decay is 350 ms and the cycle 250 ms, so the
condition is permanently true and it would drop every second bang — halving the
audible rate while the test, which counts bangs out of the state machine rather
than out of the audio graph, stayed green. Nothing needs bounding: a finite
buffer source ends on its own and `LOCK_TIME` caps an episode at ~17 bangs.

`update()` gains one more argument for the surge state, matching how `rev` was
added. During `surging` the jet and fan components fall away with `reverse` and
the rumble rises; in `stall` a rough unsteady band replaces them.

**Verification, which the `when` parameter exists for.** Extend the offline
snippet in `test/audio/README.md`: schedule `s.bang(1, 0.5)`, `s.bang(1, 0.75)`,
`s.bang(1, 1.0)` before `startRendering()` and confirm impulses land at those
instants with the specified attack, decay and spectral content. Record the
method in `docs/06-sound.md` alongside why the graph had no impulsive component
and how one is made without disturbing the persistent graph.

---

### Task 7: The panel

**Files:** `src/main.js`, `index.html`, `src/style.css`, `src/locales/*.js` ×8,
`docs/07-ui.md`

* stability status bar under the reverser's: `STABLE` / `SURGE` / `STALLED`,
  with `SURGE_CLASS = { clear: 'off', surging: 'busy', stall: 'stop' }` — class
  names in `main.js`, text in the dictionaries, as `MODE_CLASS` already is;
* a hint line saying what is happening and what to do about it;
* `SM` added to the gauges block;
* a bloom pulse on each bang;
* the surge state passed to `airflow`, `sound` and the gauges. The bang is
  consumed by latching the counter — `if (eng.bangs !== shownBangs) { … ;
  shownBangs = eng.bangs; }` — one one-shot and one flash per frame however many
  wraps occurred, with the particle cohort keyed off the same latch so the sound
  and the flow cannot disagree.

New locale keys (all eight files, plus the English copy in `index.html`):
`panel.stability`, `stability.clear`, `stability.surging`, `stability.stall`,
`stability.hint.clear`, `stability.hint.surging`, `stability.hint.stall`,
`gauge.sm.label`, `gauge.sm.sub`, `map.title`, `map.working`, `map.surge`,
`map.caveat`. `i18n.test.mjs` will name any that are missed.

The gauge hash in `updateGauges` must include the margin and the surge state, or
the read-out will freeze during a surge at a steady N1 — the same trap the
reverser's `travel` was added to the hash for.

---

### Task 8: The compressor map

**Files:** `src/main.js`, `index.html`, `src/style.css`, `docs/07-ui.md`

A 220×150 2D canvas under the stability bar: corrected flow across, pressure
ratio up, the working line, the surge line above it, and a dot for the current
point. Redraw only when the point has moved, on the same hash discipline as
`updateGauges`. Rebuild the axis captions on a language change; leave the
drawing alone on resize — it is a fixed-size canvas, not a viewport.

Caveat text under the chart, from the dictionary: the surge line is tabulated,
not computed.

`docs/07-ui.md`: the stability bar, the SM read-out, and how to read the map.

---

### Task 9: Recount everything

**Files:** `README.md`, `CLAUDE.md`, `docs/01-architecture.md`,
`docs/08-development.md`, `docs/09-backlog.md`

* `01-architecture.md`: `surge.js` in the module graph and in the frame data
  flow diagram; note that it is pure, like `reverser.js` and `engineState.js`;
* `08-development.md`: test counts, the tenth test file, the limitations list;
* `09-backlog.md`: BL-03 done, with what was deliberately left out — BL-02's
  instruments and BL-04's bleed — and BL-02 reworded, since surge no longer
  waits on it;
* `README.md` and `CLAUDE.md`: nine test files become ten; **recount** the check
  total, the bundle size and the gzip size from a real run and a real build.

Nothing in this task is a guess. Run the tests, run the build, count from the
output.

## Verification before calling it done

* `npm test` — all ten files, every check green;
* `npm run build` — succeeds, and the size quoted in the documentation is the
  size the build printed;
* a manual pass in the browser: flick the throttle from idle and watch it bang,
  hold it and watch it lock, pull it back and watch it recover;
* grep the diff for `TODO`, `test.skip`, `.only` and unimplemented branches —
  none may ship;
* every number written into documentation traced to the run that produced it.
