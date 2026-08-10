# Thrust reverser (BL-05) — Implementation Plan

Plan for the design spec
[`2026-08-10-thrust-reverser-design.md`](../specs/2026-08-10-thrust-reverser-design.md).
Read that first: this file says how and in what order, not what or why.

## Global constraints

* **English** in code, comments, tests, documentation and commit messages.
* **Comments explain the reason, not the mechanics.** Match the density and tone
  of the file being edited; `engine.js` and `livery.js` carry long block
  comments over the non-obvious decisions, and the reverser is nothing but
  non-obvious decisions.
* **`ST` is the single source of truth** for the longitudinal layout.
  `reverser.js` holds no station.
* **Reference first.** The JSON changes before the code that leans on it.
* **Every user-visible string goes through `t()`** and lands in all eight
  locales in the same commit; `index.html` carries the English copy.
* **Atomic commits.** One aspect per commit, nothing unrelated bundled in, and
  a body that says why. Documentation for a change ships in the commit that
  makes the change, per `CLAUDE.md`.
* **`npm test` passes at every commit.** Not at the end — at every one.
* Numbers quoted in documentation are **recounted off the built scene**, never
  copied from the spec.

## File structure

```
src/reverser.js          NEW  pure: state machine, kinematics, thrust factor
src/engine.js                 stations, split skin, sleeve, cascades, doors, setReverser
src/engineState.js            + eng.grossThrust
src/livery.js                 reads ST.reverser, paints the sleeve joint
src/airflow.js                bypass deflection through the cascades
src/sound.js                  the reverse mix
src/main.js                   wiring, UI, frame loop
src/locales/*.js         ×8   new keys
index.html                    button, status bar, footer key
src/style.css                 (only if the new controls need it)
test/reverser.test.mjs   NEW  the ninth test file
test/geometry.test.mjs        reverser stations and sizes
test/clearance.test.mjs       doors against the core cowl
package.json                  the new test in the sequence
docs/*.md                     ten documents
docs/engines/cfm56-7b-nacelle.json   not_published
CLAUDE.md                     eight test files -> nine
```

---

### Task 1: Record what the sources do not say about the reverser

**File:** `docs/engines/cfm56-7b-nacelle.json`

Add to `components.thrust_reverser`, following the convention already used by
`nacelle_overall_dimensions.not_published`:

```json
"not_published": [
  "translating sleeve stroke",
  "cascade band axial length",
  "blocker door count and chord",
  "cascade turning angle"
]
```

No `value` objects: there is nothing to cite. This is what licenses the code to
choose those four numbers itself.

**Check:** `node test/geometry.test.mjs` still passes (it reads the file).

**Commit:** the reference change alone.

---

### Task 2: The pure reverser module, test first

**Files:** `test/reverser.test.mjs` (new), `src/reverser.js` (new),
`package.json`

Write the test first — the module is pure and the whole point of it is that it
can be. House style: plain Node, local `check()`, one `OK`/`FAIL` line per
check, `process.exit(1)` on failure, a printed trace where the trace is useful
for tuning (as `engine-state.test.mjs` does).

**`src/reverser.js`** contents, in order:

1. A block comment: what a cascade reverser is, why the door angle comes out of
   a linkage rather than a timer, and where the four unpublished numbers come
   from.
2. Constants: `STROKE = 0.90`, `DEPLOY_TIME = 2.0`, `STOW_TIME = 3.0`,
   `REV_MAX_THROTTLE = 0.75`, `DOORS = 12`,
   `LINK = { u0: -0.45, v: 0.49, a: 0.45, chord: 0.50 }`, and the derived link
   length `L = hypot(u0 + a, v)` with the comment that it is derived, not
   chosen, from `θ(0) = 0`.
3. `blockerAngle(travel)` — closed-form solve of
   `p·cosθ + q·sinθ = c`. Guard: if `|c| > hypot(p, q)` return the limiting
   angle `atan2(q, p)` rather than `NaN`. Of the two roots take the one that
   continues from zero — with these constants that is
   `atan2(q, p) + acos(c / hypot(p, q))` normalised into `[0, 2π)`; assert the
   choice with the monotonicity check in the test rather than trusting it.
4. `blockedFraction(travel)` — `chord · sin θ` over the duct height at the door,
   clamped to `[0, 1]`. The duct height is a constant in this file
   (`DUCT_H = 0.49`, measured off the model's own profiles) with a comment
   saying so; it is a property of the duct, not of the reverser, and the
   clearance test is what holds it honest.
5. `thrustFactor(travel)` — `CORE + FAN·(1 − b) − FAN·TURN·b` with
   `CORE = 0.20`, `FAN = 0.80`, `TURN = 0.62`.
6. `createReverser()` — the state machine.

The state machine:

```js
mode: 'stowed' | 'deploying' | 'deployed' | 'stowing'
travel: 0 .. STROKE          // model units
blocked: 0 .. 1              // recomputed at the end of every update

request(deploy, engineMode)  // the button; refuses unless engineMode === 'run'
                             // when deploying. A stow request is always allowed.
update(dt)                   // advances travel at STROKE/DEPLOY_TIME or
                             // -STROKE/STOW_TIME, switches mode at the ends
throttleLimit()              // 0 while moving, REV_MAX_THROTTLE when deployed,
                             // 1 when stowed
```

`request` takes the engine mode rather than the reverser holding a reference to
the engine: the interlock is a fact about the moment the button is pressed, and
passing it in keeps the module free of any other module.

**Checks in the test** (the spec lists them; these are the concrete forms):

| Check | How |
|---|---|
| Deploy takes `DEPLOY_TIME` | step at 1/60 s, first frame with `mode === 'deployed'` within ±2 frames of 2.0 s |
| Stow takes `STOW_TIME` | same, 3.0 s |
| Mode changes inside the machine | `mode` is still `deploying` one frame before travel reaches `STROKE` |
| Refused unless running | `request(true, 'off' \| 'start' \| 'stop')` leaves mode `stowed` and travel 0 |
| Stow interrupts a deploy | request stow at t = 1 s: travel continues from where it is, never jumps, reaches 0 |
| Repeated requests are no-ops | two deploys in a row give the same trace as one |
| Auto-stow on shutdown | drive `createEngineState()` and the reverser together: `setMode('stop')` + `request(false)`, and the sleeve is home before `eng.n1 === 0` |
| Throttle limit | 0 while moving in either direction, `REV_MAX_THROTTLE` deployed, 1 stowed |
| `blockerAngle(0) === 0` | exactly, not within a tolerance |
| Monotone and finite | 200 samples over `0…STROKE`, each ≥ the last, all finite |
| Never `NaN` past the limit | sample to `1.5 · STROKE` |
| Door tip reaches the cowl | `chord · sin θ(STROKE)` within 0.01 of the value the clearance test measures off the mesh |
| Doors close late | `blockedFraction(STROKE/3) < 0.25` |
| `thrustFactor(0) === 1` | exactly |
| Reverse thrust is real | through `createEngineState()`: run at `REV_MAX_THROTTLE` to steady state, `grossThrust · thrustFactor(STROKE)` in −15…−25 kN |

Add `node test/reverser.test.mjs` to the `test` script in `package.json`, after
`engine-state` — it is the same family.

**Verify:** `npm test`.

**Commit:** the module, its test and the script entry.

---

### Task 3: Gross thrust into the engine state

**Files:** `src/engineState.js`, `src/main.js`, `test/engine-state.test.mjs`

`eng.grossThrust` in kN, computed at the end of `update()` from the same
expression `main.js` uses today: `fuel ? 121.4 · keff^1.45 : 0`. `main.js` stops
computing it and reads the field.

One check added to `engine-state.test.mjs`: thrust is zero the instant the fuel
is cut, and 121.4 at full power. That check is the reason for the move —
`reverser.test.mjs` needs a thrust it can read under Node.

**Verify:** `npm test`; the displayed thrust is unchanged in the browser.

**Commit:** on its own. It is a refactor with no behaviour change and it should
be reviewable as one.

---

### Task 4: The stations and the split of the nacelle skin

**Files:** `src/engine.js`, `src/livery.js`, `test/geometry.test.mjs`

This task deliberately adds no moving parts. It splits the skin, keeps the
picture identical, and proves it.

1. `import { STROKE } from './reverser.js'` and add to `ST`:
   `reverser: -1.19`, `sleeve: -0.79`, `cascadeAft: -0.79 + STROKE`.
2. A helper next to `smoothProfile()`:

   ```js
   // Splits a profile at a station and lathes the pieces separately, remapping
   // each piece's v back into the range the whole profile would have given it.
   // LatheGeometry hands out v by point index, so a piece lathed on its own
   // restarts v at 0 - and the markings in livery.js are placed by station
   // against the whole generatrix.
   function latheSplit(profile, xCut, material, segments)  // -> [fwd, aft]
   ```

   Insert an exact point at `xCut` by interpolation so the two pieces share an
   edge, then remap `uv.y` on each: `v = v0 + v * (v1 - v0)` with `v0`, `v1` the
   indices of the piece's first and last point over `profile.length - 1`.
3. Lathe the outer skin as two pieces cut at `ST.sleeve`, the inner wall as two
   pieces cut at the aft end of the stowed doors (`ST.sleeve + LINK.chord`).
   Both pieces of each keep `MATS.nacelleSkin` / `MATS.nacelle`. Both go through
   `flattenBelly` with the same droop functions as now.
4. `livery.js`: `cowlAft` becomes `ST.reverser`, and a second `joint()` +
   `rivetRing()` at `ST.sleeve`. Delete the comment explaining the fraction and
   replace it with one saying the station is now shared.
5. `geometry.test.mjs`: the three new stations in the ordering list; the cascade
   band exactly `STROKE` long; the reverser section between a third and a half
   of the nacelle length.

**Verify:** `npm test`, and in the browser the nacelle looks exactly as before —
this is the one step where the only real check is the eye. Compare the markings
against a screenshot taken before the change.

**Commit:** "split the nacelle skin where the sleeve has to come apart".

---

### Task 5: The reverser module — sleeve, cascades, doors, links

**Files:** `src/engine.js`, `test/clearance.test.mjs`

1. `const mRev = module('reverser', new THREE.Vector3(2.2, 4.4, 0))`, created
   right after `mNac` so the reading order of the file follows the nacelle
   forward to aft.
2. Move the aft pieces from task 4 into `mRev`, inside a child group
   `sleeveGroup` — the module's own `position` is written every frame by the
   exploded view, so the translation cannot live there.
3. Cascade box, fixed, in `mRev` directly: a frame ring, dividers, and one
   `InstancedMesh` of 72 × 4 turning vanes tilted forward and outward.
4. Twelve door groups: hinge at `(ST.sleeve, R)` inside `sleeveGroup` so they
   translate with it, each rotated about the engine axis to its clock position,
   the door plate rotating about its own hinge by `blockerAngle(travel)`.
5. Twelve drag links: a thin rod from the door's link point to a bracket at
   `(ST.sleeve + LINK.u0·(−1)…)` — that is, the anchor the linkage was solved
   against. Rebuilt each time the doors move: it is 12 short tubes, and the
   alternative is a second copy of the kinematics.
6. `PROXY`: shorten `mNac` to `ST.lip … ST.reverser`, add
   `[mRev, ST.reverser, ST.bypassExit, 2.3, true]`.
7. `labels`: `{ module: mRev, key: 'label.reverser', pos: … }`.
8. `setReverser(travel)` in the returned object, and `parts.mRev`.
9. `clearance.test.mjs`: with `setReverser(STROKE)` applied, no door vertex is
   inside the core cowl envelope, the doors close ≥ 85 % of the duct, and the
   deployed sleeve's trailing edge is ahead of `ST.coreExit`.

**Verify:** `npm test`; in the browser drive `setReverser` by hand through the
console before the UI exists.

**Commit:** the geometry and its clearance checks.

---

### Task 6: Wiring — state machine, UI, frame loop

**Files:** `src/main.js`, `index.html`, `src/style.css` if needed

1. `const rev = createReverser()` next to `createEngineState()`.
2. Frame loop, **before** `eng.update`:
   `rev.update(dt · timeScale)`, then
   `eng.update(dt · timeScale, Math.min(state.throttle, rev.throttleLimit()))`,
   then `engine.setReverser(rev.travel)`.
   The time scale applies to the reverser too: a ×4 start with a ×1 sleeve would
   be two clocks in one scene.
3. Thrust display: `eng.grossThrust · thrustFactor(rev.travel)`. The hash guard
   in `updateGauges` must include the travel, or the number freezes mid-stroke.
4. `refreshReverserUI()` alongside `refreshModeUI()`, and the same
   compare-against-shown trick in the loop, since `deploying → deployed` happens
   inside the machine.
5. Button `btn-rev` and status bar `rev-bar` in `index.html`, in the power
   block under the throttle. `REV_CLASS = { stowed: 'off', deploying: 'busy',
   deployed: '', stowing: 'busy' }` — class names only, text from the
   dictionary, as `MODE_CLASS` and `VERDICT_CLASS` do.
   `style.css` needs one rule: `button.big:disabled { opacity: .35;
   pointer-events: none; }`. The only "disabled" styling in the file today is
   `#thr-wrap.disabled`, which is bound to that one id.
6. Key `r`/`R`/`к`/`К` in the keydown listener; `footer.keys2` gains it.
7. The button is disabled outside `run`: `refreshModeUI` already runs on every
   mode change, so it does the toggling.
8. Pass `rev.blocked` to `airflow.update` and `sound.update` (both still ignore
   it at this point — the argument arrives before the behaviour, so this commit
   stays about the wiring).

**Verify:** in the browser — deploy, stow, deploy mid-stow, try the button while
shut down, shut down while deployed, watch the thrust go negative.

**Commit:** the wiring, with the English strings still hard-coded nowhere: the
keys go in with task 8. To keep `npm test` green (`i18n.test.mjs` compares
`index.html` against the dictionary) tasks 6 and 8 land as one commit if the
markup carries `data-i18n`. **So: do task 8 before committing task 6.**

---

### Task 7: Flow and sound

**Files:** `src/airflow.js`, `src/sound.js`

Two independent changes, two commits.

**`airflow.js`.** A `Uint8Array deflected` and a `Float32Array pr` (the
particle's radius once it has left the duct) alongside the existing per-particle
arrays. In `update(dt, level, burn, blocked = 0)`:

* a bypass particle crossing `ST.sleeve` is marked deflected with probability
  `blocked` — sampled once, at the crossing, not re-rolled every frame;
* a deflected particle moves at `−cos 45°` in x and `+sin 45°` in r, at the
  local duct speed, and fades out through `edgeFade` on x plus a radial fade
  past the skin;
* it respawns when it leaves the domain, like any other particle;
* `blocked = 0` restores exactly today's behaviour, which the absence of any
  change to the flow picture with the reverser stowed will show.

The cascade station is a local constant next to the other tables, carrying the
same "follows the stations from `src/engine.js`" comment they do. Importing `ST`
would be tempting and is wrong: `airflow.js` depends on nothing today, and
importing `engine.js` would pull the materials, the livery canvas and
`buildEngine` into its module graph for the sake of one number. The duplication
is the deliberate arrangement this file already lives with.

**`sound.js`.** `update(n1, n2, burn, pan, nearness, rev = 0)`:

* one new branch built in `build()`: brown noise → bandpass 300 Hz, Q 0.9 →
  `revGain`, into the bus, with `turb` modulating it;
* `set(revGain.gain, 0.42 · rev · Math.pow(n1, 0.8))`;
* the fan-driven part of the jet noise scaled by `(1 − 0.85·rev)`, the
  combustion-driven part untouched;
* `fanBbGain` scaled up by `(1 + 1.4·rev)` and `fanBbBand.frequency` pulled down
  by `(1 − 0.35·rev)`;
* the comb, the blade passing tones and the rumble untouched.

**Verify:** `npm test` (neither is covered by the Node tests beyond not
throwing); by ear in the browser; and `test/audio/` rendered offline to confirm
the new branch shows in the spectrum.

**Commits:** one for the flow, one for the sound.

---

### Task 8: The eight dictionaries

**Files:** `src/locales/*.js` (8), `index.html`

Keys, English first:

```
'panel.rev.title':    'Thrust reverser'
'panel.rev.hint':     'translating sleeve, cascades, blocker doors'
'panel.reverser':     'Reverser'
'rev.stowed':         'STOWED'
'rev.deploying':      'DEPLOYING'
'rev.deployed':       'DEPLOYED'
'rev.stowing':        'STOWING'
'rev.hint.deploy':    'the sleeve slides aft, the doors close the bypass duct'
'rev.hint.stow':      'the doors open, the sleeve slides home'
'rev.hint.moving':    'the sleeve is moving, the throttle is held at idle'
'rev.hint.off':       'the engine must be running'
'label.reverser':     'Reverser'
'module.reverser.title': 'Thrust reverser'
'module.reverser.info':  <the card, ~60 words>
'footer.keys2':       '... · R — reverser'   (changed)
```

Translate into `ru`, `es`, `zh-Hans`, `fr`, `pt-BR`, `de`, `ja`. Whole
sentences, never assembled from fragments. Terminology to get right per
language: "translating sleeve", "blocker door", "cascade" are terms of art in
aviation and each language has its own — use the one a maintenance manual in
that language would use, not a literal translation.

`index.html` gets the same English on the new markup, `data-i18n` on every
piece.

**Verify:** `node test/i18n.test.mjs` — it checks key parity, placeholder
parity, emptiness and the `index.html` copy.

**Commit:** together with task 6 (the markup and the strings are one change).

---

### Task 9: Documentation

**Files:** the ten documents in the spec's table, `README.md`, `CLAUDE.md`

Recount before writing. The numbers to recount, off the built scene under Node
and off `dist/` after a build:

* triangles, draw calls, blade rows, blades, picking proxies, modules;
* the number of checks across the test files (`npm test | grep -c '^OK'`);
* the bundle size, raw and gzipped.

The current documented yardstick is 771 k triangles, 123 draw calls, 37 rows /
2341 blades, 11 proxies, 239 checks, 734 kB / 200 kB gzip. A first count of the
scene as it stands gives 38 instanced rows and 2351 blades by the crude measure
"every `InstancedMesh`" — the spinner spiral is one, with `count = 1`. Settle
what the documented figure counts and say so in `08-development.md`, so the next
recount does not have to rediscover it.

Then the prose, per the spec's table. `09-backlog.md` needs BL-05 struck in two
places — the summary table and its own section — and the cross-reference under
BL-20 updated: the reverser is now a separate group with its own stations, which
is the half of the structural breakdown that task asked to have designed first.

**Commit:** documentation that is not attached to a code change goes in one
commit; anything that documents a specific change should already have gone in
with it. In practice: the counts, the backlog and the file tables here; the
behaviour prose with the tasks above.

---

### Task 10: Verification

* `npm test` — nine files, all green.
* `npm run build` — no warnings, and record the size.
* In the browser at 5188: the reverser through a full cycle at ×1 and ×4; the
  markings on the nacelle unchanged with the sleeve home; the flow with and
  without the reverser and with and without the cutaway; the sound at each
  stage; the module card and label; the exploded view with the reverser
  deployed; picking the reverser and the nacelle separately.
* A pass over the diff for anything left half-done: `TODO`, a test that is
  skipped, a branch that is not reachable.

---

## Order and why

Tasks 1 → 2 → 3 are self-contained and each leaves the tree green. Task 4 is the
riskiest single step (the texture) and is deliberately isolated: nothing moves,
so any change to the picture is a bug in the split. Task 5 adds the parts, task
6 + 8 make them move, task 7 is the two consequences that can be judged only by
eye and ear. Documentation last, because that is when the numbers are true.

## What could go wrong

| Risk | Sign | Response |
|---|---|---|
| UV remap off by one point | Markings slide aft on the sleeve | Compare `v` at the cut from both pieces; they must be equal |
| Doors clip the core cowl | Clearance test fails at some travel, not at the ends | Sample the whole sweep, not just full deploy — the minimum is at θ = 90° |
| Triangle count jumps | Over 810 k | Halve the vane rows; four rows is a preference, not a requirement |
| Deployed sleeve fights the cutaway planes | Sleeve is cut in a different place from the rest | Sleeve materials are shell materials; they already carry the planes |
| `thr-wrap` disabled state | Slider unusable in reverse | The reverser only deploys in `run`, where the wrap is enabled |
