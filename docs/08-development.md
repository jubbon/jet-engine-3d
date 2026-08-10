# 08. Development

## Running

```bash
npm install
npm run dev      # http://localhost:5188, listens on 0.0.0.0
npm run build    # build into dist/
npm run preview  # preview the built version
npm test         # state machine, exhaust gas, spiral smear, atmosphere,
                 # contrail, dimensions against the reference, clearances
```

Dependencies: `three` (runtime) and `vite` (build). There are no external assets
at all — no models, no textures, no sound files: all geometry is built in code,
reflections come from the procedural `RoomEnvironment`, the sound is
synthesised.

The server binds to `0.0.0.0`, so it is reachable from the local network without
authentication. Handy for showing colleagues, but on an untrusted network the
port is better closed.

### The Makefile

`make help` lists the targets; they are not repeated here, so that the list
cannot go stale in two places at once. The commands themselves are not restated
in the `Makefile` either — it calls the npm scripts and `docker build` rather
than duplicating them.

What it adds is the one thing an npm script cannot express: when the work can
be skipped. `npm run build` rebuilds unconditionally on every call, while `make
build` compares `dist/` against the sources and does nothing if nothing moved.
The install behaves the same way — `npm ci` wipes and unpacks 50 MB every time
it is called, and make calls it only when the lockfile is newer than what is
already there.

That is also the thing to be careful about. The build is triggered by source
files being newer, and the list of them is the `SOURCES` variable at the top:
`src/`, `index.html` and `vite.config.js`. If a build ever comes to depend on
something outside that list, it has to be added, or make will report there is
nothing to do and be wrong.

A bare `make` prints the help rather than starting a build. The first person to
type it in an unfamiliar repository is usually looking around, and a 50 MB
install is a discourteous answer to that.

`make test-geometry` runs one file — the tests need no runner and no flags,
which is what keeps this a single pattern rule. `make run` builds the image and
serves it; `IMAGE`, `TAG` and `PORT` override, where `PORT` is the host side
only.

## Build size

```
dist/index.html                13.1 kB  (3.7 kB gzip)
dist/assets/index-*.css         8.2 kB  (2.4 kB gzip)
dist/assets/index-*.js        749 kB  (206 kB gzip)
```

The Vite warning about a chunk larger than 500 kB refers to the Three.js library
itself. It can be addressed with `manualChunks` if needed.

Of the JS, 64 kB is the eight locale dictionaries — about 8 kB each, all of them
bundled. Lazy loading them through dynamic `import()` would save some 19 kB
gzipped on first load, at the cost of an async boundary at start-up and a flash
of untranslated text; at 8 kB apiece that is a bad trade. It becomes worth
revisiting if the teaching layer (BL-22) multiplies the text volume, and the
change would be at the single point where a locale is loaded — no `t()` call
site moves.

## Performance

About 777 thousand triangles and 132 draw calls (the breakdown by module is in
[Architecture](01-architecture.md#performance)). On a discrete or integrated GPU
this runs with room to spare; the bottleneck is not the geometry but the
transparent shells in x-ray mode together with the particles and the bloom.

These numbers are verifiable rather than recalled from memory: `buildEngine()`
runs under Node, so triangles, rows and blades are counted by walking the scene.
Recount them whenever the layout changes, otherwise they drift silently — which
is exactly what happened with the earlier "850 thousand and 50 draw calls".

If the scene needs lightening:

* reduce `radialSegments` and `chordSegments` in the `makeBladeGeometry()` calls
  (small blades are built with 5–6 radial sections, which is already the
  minimum);
* reduce the particle counts `N_BYPASS` and `N_CORE` in `src/airflow.js`;
* switch off the `UnrealBloomPass`.

A note on headless browsers: one renders this scene on a software rasteriser
(SwiftShader) at about one frame per second. That says nothing about real
hardware, but it does make checking long processes through a browser impossible
— hence the extracted modules `engineState.js`, `reverser.js`, `atmosphere.js`,
`contrail.js`, `sound.js` and `i18n.js`, which are checked directly.

## Tests

Nine files, 285 checks. There is no framework: each test is a plain Node script
with its own `check()` helper, printing one `OK`/`FAIL` line per check and
exiting with code 1 on failure. A single file is run directly —
`node test/geometry.test.mjs`.

`test/engine-state.test.mjs` — 22 checks of the regime state machine: full
shutdown, the impossibility of reviving the engine with the throttle, a restart
with light-off and temperature overshoot, a realistic start duration, stable
idle, throttle response. The test prints a trace of the processes, which also
makes it a convenient tool for tuning the time constants.

`test/reverser.test.mjs` — 34 checks of the thrust reverser: the deployment and
stow times, the transitions the state machine makes on its own, the interlocks
(refused unless the engine is running, throttle held at idle while the sleeve
moves, N1 limited to 80 % deployed, stowed by a shutdown), and a stow that
interrupts a deployment without the travel jumping. Then the drag-link
kinematics — flush at zero exactly, monotone, finite everywhere including past
the end of the stroke, and closing late: less than a quarter of the duct blocked
at a third of the travel. Then the thrust, driven through the real
`createEngineState()`: exactly ×1 stowed, and −19 kN at the reverse power limit.
Finally the flows, which is why the one Three.js import in an otherwise
dependency-free test is there: with the reverser out, 1115 particles leave
through the cascades, none through the fan nozzle, and the core count is
unchanged. At one frame per second, counting eight thousand dots is a great deal
more reliable than looking at them.

`test/heat-haze.test.mjs` — 10 checks of the exhaust gas: on a cold engine there
is no distortion at all, during a start it appears only after light-off, at
take-off power it reaches its maximum, and after shutdown it dies at around the
15th second. What is checked is the pure function `hazePower()` driven through
the real state machine — the shader itself does not run under Node.

`test/spiral-blur.test.mjs` — 10 checks of the spinner spiral smear: at rest it
is sharp, by take-off power its opacity falls below 3 %, during rundown it
returns. Separately it checks that the copies of the spiral never spread further
apart than its angular thickness — otherwise a fan of stripes would appear
instead of an even ring.

`test/atmosphere.test.mjs` — 48 checks of the ambient conditions against
published tables: temperature, pressure and density at 0, 1, 5, 11 and 12 km,
the join of the two branches at the tropopause, and a real day — a deviation
from standard must move the density while leaving the pressure alone. The
saturation vapour pressure is checked the same way, over water and over ice,
along with the inversion of the curve that gives the dew point and the refusal
to report saturation over ice above freezing. This is one of the few places in
the model with a published answer, so the comparison is against the table rather
than against the model itself.

`test/contrail.test.mjs` — 27 checks of the Schmidt — Appleman criterion. The
threshold temperature comes from a published fit, and checking a fit against
itself proves nothing, so the check is against the property it approximates: at
the threshold the saturation curve must have exactly the slope of the mixing
line. It holds to 0.5 % over the whole range of slopes the panel can produce.
The rest are the behaviour of the criterion — a steeper line means a warmer
threshold, drier air has to be colder, a more efficient engine leaves a trail
more readily — and the altitude at which the verdict flips, checked to be a real
boundary. The last seven check the drawing's own decisions - a persistent trail
runs the whole length, a short-lived one breaks off at a third of it, and a
shut-down engine leaves nothing whatever the air outside. The strip needs no
renderer to answer those, only the shader does.

`test/geometry.test.mjs` — 30 checks of the dimensions against the
[prototype reference data](engines/cfm56-7b-nacelle.json). The test reads the
values straight from the JSON, and the tolerances are the ones the reference
itself states (±0.15 m for measurements off the ACAP drawing, ±0.2…0.3 m for
`derived_low` values). The point is the direction of comparison: editing the
reference breaks the test rather than silently diverging from the model. The
nacelle envelope is computed from vertices rather than from the `lathe` profile
— otherwise the flattened bottom would not be included.

`test/clearance.test.mjs` — 22 checks of the layout clearances: blade rows do
not intersect one another (overlapping both axially and radially), the tips of
the fan and outlet guide vanes stay under their own wall, and the accessory
gearbox holds the overall engine width without piercing the nacelle skin. This
is insurance against the main risk of a tight layout: the core is short, the
stage pitch is small, and any addition to a blade chord drops the rows onto each
other.

The last five check the exhaust plume against the nozzle it leaves. That cone is
built from constants of its own rather than from the gas path, so nothing tied
it to the metal, and it spent a long time Ø 1.5 m wide at a nozzle of Ø 0.82 m —
a rim standing outside the cowl against the sky, which the eye reads as a sleeve
pulled over the engine rather than gas leaving a pipe. The lip is measured off
the model rather than copied from `cowlPts`, and the measurement skips invisible
meshes on purpose: `mExh` carries a picking proxy of radius 1.24 that would
answer the question wrongly and plausibly.

`test/i18n.test.mjs` — 82 checks of the localisation, and most of them are about
agreement rather than content. All eight dictionaries must carry exactly the key
set of the English one, with the same `{placeholders}` in every value and
nothing left empty: a key added to `en.js` and forgotten in the other seven
costs nothing at build time and shows up as an English word in the middle of a
Japanese panel, and a translator who drops `{margin}` leaves a hole in a
sentence that nothing else would catch. The rest cover locale matching
(`pt-PT` → `pt-BR`, `zh-TW` → `zh-Hans`, an unknown language → English), number
formatting (the decimal comma in five of the eight, and no thousands separator
anywhere — grouped, a T4 of 1604 °C reads as German "1.604 °C"), and the
agreement between `index.html` and the dictionary: every `data-i18n` names a key
that exists, no tagged element has child tags, and the English left in the
markup still says what `en.js` says.

Twenty-two of the checks are there for one narrow reason: the language tag is
read from `localStorage`, and a tag inherited from `Object.prototype` used to
get past the guard on it. `locales['__proto__']` is truthy with no dictionary
behind it, and `Intl.NumberFormat('__proto__')` throws — out of `n()`, out of
`updateGauges()`, out of the top of the frame loop, which schedules the next
frame only at its bottom. The result was not a wrong translation but a scene
that stopped and stayed stopped, since the reload read the same tag back. The
checks pin down both halves: such a tag is refused, and a locale that survives
it still formats numbers.

The sound is checked separately, by rendering the graph into an
`OfflineAudioContext` (method and results in the [sound document](06-sound.md)).

The shader pass was checked by eye in the browser, from four views: from behind
(key `9`) and from the nozzle — there the jet must be visible and shimmering;
from the front — there the image must stay sharp, otherwise the occlusion by the
bodies is broken; and with the air flows switched on — there the particles and
streamlines must not drown in the gas.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request into `main` and
`dev`. Two jobs: the test suite on Node 20, 22 and 24, and a build on 22.

Running the whole suite on every push is affordable precisely because none of it
needs a renderer: it is a handful of plain Node scripts and finishes in under a
second. The three versions are the floor Vite still supports, the one the
project is developed on, and the next one; `fail-fast` is off, so a break in one
of them does not hide the state of the others. Installation is `npm ci` rather
than `npm install`: the lockfile is committed, and a run that quietly resolves a
newer Three.js is no longer testing the commit it claims to test.

It carries `--ignore-scripts`, here and in the `Makefile` and the `Dockerfile`
alike, which is the other half of the same idea: pinning what gets installed is
worth little if installing it also runs code out of it. `npm ci` executes the
install hooks of the whole dependency tree by default, and a lockfile pins the
version of a package without saying anything about what that version's
`postinstall` does — the compromise everyone reads about in the news arrives
through exactly this door, on a machine that has a checkout and credentials
sitting next to it.

The tree has one package with an install hook that matters, `esbuild`, and it
does not need it: the binary comes from the platform package in
`optionalDependencies`, and the hook only verifies it. That was checked rather
than assumed — a clean `npm ci --ignore-scripts` in a fresh copy loads esbuild,
passes all 239 checks, and produces a bundle with the same content hash as the
build that ran the hooks.

The build job prints the bundle size into the run summary. That is there for a
specific failure this repository keeps repeating — the size is quoted in four
places and every one of them is copied from memory, so the figures drift.
Measuring it uses Node's `zlib` rather than the `gzip` binary, because Vite
measures with `zlib` and the two disagree by about two kilobytes: 198.29 kB
against 195.88 kB for the same file. Two numbers that both look right are worse
than none. The built `dist/` is kept as an artefact for a week.

What CI does not check is anything needing a GPU: the shader passes, the bloom,
and how the scene actually looks. Those stay a manual pass — see the four views
at the end of the previous section.

## Docker

```bash
docker build -t jet-engine-3d .
docker run --rm -p 5188:5188 jet-engine-3d
```

Two stages. The first is `node:22-alpine`, pinned to the version the project is
developed on: it installs with `npm ci --ignore-scripts` from the committed
lockfile and runs `npm run build`. The second is `nginxinc/nginx-unprivileged:1.29-alpine`, and
the only thing that crosses the boundary is `dist/` — no `node_modules`, no
sources, no npm. The runtime image is 55 MB against the 165 MB of the toolchain
that produced it, and there is nothing in it that could rebuild the bundle.

The unprivileged variant rather than the stock `nginx:alpine`, because nothing
the running container does has a use for root: it reads `dist/` and hands it
out, and never writes anything.

Not because of the port, which is the reflex answer and is wrong. The usual
reason an nginx image keeps root is the bind below 1024, and inside a container
that reason has already evaporated — Docker sets
`net.ipv4.ip_unprivileged_port_start` to 0, against 1024 on the host. Built with
`listen 80` and run as UID 101, this image binds it and answers 200, with
`CapEff: 0000000000000000` in the container's own `/proc/1/status`: no
capabilities at all, port 80 anyway. The choice of port and the choice of user
are independent, and 5188 is not what makes the unprivileged image possible.
The variant is the nginx team's own and tracks the same
releases — the alternative, chowning the stock image's pid and temp paths by
hand, means owning a list that changes quietly between versions. Two `USER`
lines bracket the build: root to clear the seeded document root and copy
`dist/` into it, then back to UID 101 for good. Checked by looking: every
process in the running container, master and all four workers, belongs to
`nginx`, and there is no root process to find.

The manifests are copied ahead of the sources so that the install layer — some
50 MB — survives every commit that does not touch a dependency. `test/` and
`docs/` are excluded from the build context, which mostly matters because
`test/audio` holds 37 MB of reference recordings the image has no use for; the
tests are CI's job, against the same commit.

The port is 5188, the same as the dev and preview servers. It is quoted in the
README and above, and pinned in `vite.config.js` for the same reason — a
container answering on 80 would be the one place the number differs.

`docker ps` nevertheless shows a second port next to the mapping — `8080/tcp`,
and `80/tcp` before the base image changed. That is inherited from the nginx
image, which declares it, and a `Dockerfile` cannot undo an `EXPOSE`. Nothing is
listening there: `netstat` inside the container finds 5188 over v4 and v6 and
nothing else, so publishing the advertised port gets one that refuses
connections.

Which is a small thing, because `EXPOSE` publishes nothing in the first place.
It is metadata with two effects: this line in `docker ps`, and `docker run -P`
picking the ports up — on this image that assigns two random high ones, 5188 to
one and the phantom 8080 to another. Reaching the model on some other port needs
no change here at all, since the host side is chosen at run time and is
unrelated to what the server listens on: `docker run -p 80:5188` serves it on
80, and `make run PORT=8080` on 8080. That is what keeps the internal number at
5188 rather than something more conventional — it costs nobody anything, and it
is the one number the dev server, the preview server, the README and every
bookmark already agree on.

The server configuration is in `docker/nginx.conf`, and one line of it is worth
knowing about. nginx compresses at `gzip_comp_level 1` by default, which sends
the bundle in 234.9 kB — 19 % more than it needs to, and a gap nobody would
think to measure. At level 6 it is 196.8 kB. That is not identical to the
198.29 kB Vite reports, since the two use different zlib window and memory
settings, but it is on the right side of it, so the figure quoted in
[Build size](#build-size) is an upper bound on what actually goes over the
wire. The default `gzip_types` is another: it covers `text/html` alone, which
would have left the whole payload uncompressed.

Then caching. Vite puts a content hash in every asset filename, so anything
under `/assets/` is immutable and cached for a year; `index.html` carries the
pointers to those names and is sent `no-cache`, because a cached copy would keep
asking for yesterday's filenames — which are still on disk and still work,
making a deploy invisible. A path that matches nothing gets a 404 rather than
the usual fallback to `index.html`: there is no router here, so answering a
mistyped URL with the model would hide the mistake instead of reporting it.

Which value applies is chosen by a `map` on `$uri` rather than by a `location`
block, and that is not a stylistic preference. `add_header` in nginx does not
accumulate: a `location` that sets one header of its own discards every header
inherited from the `server` block. With `Cache-Control` living in `location
/assets/` and `location = /index.html`, adding the security headers below to the
server block would have delivered them everywhere except the page and the
bundle — the only two paths anyone requests. The `map` keeps every `add_header`
in one place, where a location added later cannot silently drop them. It also
closed a hole the old form had: `location = /index.html` matches that literal
path and nothing else, so a request for `/` — which is how the page is actually
opened — carried no `Cache-Control` at all.

The headers themselves are worth a paragraph mostly because of how little they
cost here. This page loads nothing from anywhere: one bundle and one stylesheet
of its own, a favicon that is a `data:` URI, no fonts, no images, and no
requests at run time — no `fetch`, no `XMLHttpRequest`, no WebSocket. So the
content security policy is not a negotiation between safety and function, and
it is written down now, while that is still true and the policy can be checked
against a working page rather than retrofitted around one. Two directives are
not `'self'`: `img-src` admits `data:` for the favicon, and `style-src` admits
`'unsafe-inline'` for the `style=""` gradients on the legend swatches — those
are attributes, there is no inline `<style>` and no inline `<script>` at all.
`frame-ancestors 'none'` refuses embedding, and `server_tokens off` stops
sending the nginx version to anyone who asks for a missing file.

All of it was checked against a running container rather than reasoned about:
the three headers appear on `/`, on the hashed bundle and on a 404 (hence
`always` — without it the error response would come back bare), `Server` reads
`nginx` with no version, and the page was then loaded in a browser to confirm
the policy costs nothing. Nothing was blocked, the panel came up, the gauges ran
and the language switch redrew the station table; the only violation reported
was a deliberate inline `<script>` injected to prove the policy was enforced at
all rather than merely present in the response.

What is deliberately not here: no compose file, no image published anywhere,
and the CI workflow does not build the image. Publishing needs a registry and a
tagging policy, and neither has been decided — the choices are laid out in
[BL-28](09-backlog.md#bl-28-publishing-the-container-image).

## Limitations of the model

The model is illustrative. The full list of what is deliberately simplified or
not modelled at all is in
["Physics of the model", section 10](03-physics.md#10-what-the-model-does-not-have).
In short: no gas-dynamic computation, no cycle calculation, no recomputation of
the engine for altitude (the ambient air is there, the characteristics are not),
no engine limits or protections; the absolute
speeds and flow velocities are deliberately reduced for the sake of a legible
picture.

## Possible extensions

* **Bleed air** from behind the compressor for turbine cooling and air
  conditioning: the bleed ports exist geometrically, but no flow goes through
  them.
* **Limits and failures** — surge, flame-out, T4 exceedance, a failed start (hot
  start, hung start).
* **Altitude and airspeed characteristics** — the dependence of thrust and flow
  on altitude and Mach number.
* **Real-time section by an arbitrary plane** — at present only a sector around
  the axis is cut out.
* **Occlusion-aware labels** — labels of internal modules currently show through
  the nacelle.

## File layout

```
index.html              markup of the panel, the legend and the module card
src/main.js             scene, lighting, post-processing, cutaway, UI, frame loop
src/engine.js           geometry of all modules, materials, labels, picking proxies
src/blade.js            procedural generator of blades and rows
src/livery.js           markings on the nacelle skin, drawn into a canvas
src/airflow.js          flow ducts, particles, streamlines, plume
src/heathaze.js         exhaust gas aft of the nozzle (screen-space pass)
src/engineState.js      regime state machine: start, running, shutdown, rundown
src/reverser.js         thrust reverser: deployment, door linkage, reverse thrust
src/atmosphere.js       standard atmosphere and water vapour
src/contrail.js         contrail formation criterion
src/contrailView.js     the trail behind the engine
src/sound.js            sound synthesis on Web Audio
src/i18n.js             lookup, interpolation, number formatting, locale matching
src/locales/            eight dictionaries; en.js is the source, the rest follow it
src/style.css           panel styling
test/                   state machine, exhaust gas, spiral smear, atmosphere,
                        contrail, dimensions, layout clearances and localisation
docs/                   this documentation
docs/engines/           machine-readable reference data on prototypes (JSON)
```
