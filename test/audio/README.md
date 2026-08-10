# Spectral analysis of the engine sound

The scripts used to tune the synthesis in `src/sound.js`. The results and
conclusions are in [docs/06-sound.md](../../docs/06-sound.md).

| Script | What it does |
|---|---|
| `fetch.sh` | Downloads CFM56 recordings from Freesound and converts them to mono WAV |
| `phases.py` | Breaks a recording into phases: where tones dominate, where jet noise does |
| `orders.py` | Sorts the tones by shaft order, produces the buzz-saw envelope |
| `compare.py` | Compares a real recording against the synthesised sound |

They need `python3` with `numpy` and `scipy`, plus `ffmpeg` and `curl`.

## Synthesis for comparison

`compare.py` expects a file called `synth_takeoff.wav`. It is rendered offline
in the browser: open the application and run in the console

```js
const { createEngineSound } = await import('/src/sound.js');
const SR = 44100, off = new OfflineAudioContext(1, SR * 6, SR);
const s = createEngineSound({ makeContext: () => off });
await s.enable(); s.setVolume(0.5); s.update(0.92, 0.95, 0.9, 0, 0.5);
const d = (await off.startRendering()).getChannelData(0);
```

then save `d` (starting from the second second) as a 16-bit mono WAV at
44.1 kHz. The regime 0.92 was chosen because the real recording was made at
exactly 92 % N1.

## Rendering the surge bangs

`startRendering()` runs the whole render with no JavaScript between quanta, so
nothing can call `bang()` while it is rendering. That is why `bang()` takes an
absolute time: the impulses are scheduled *before* the render and land where
they were put.

```js
const { createEngineSound } = await import('/src/sound.js');
const SR = 44100, off = new OfflineAudioContext(1, SR * 3, SR);
const s = createEngineSound({ makeContext: () => off });
await s.enable(); s.setVolume(0.5); s.update(0.30, 0.60, 0.35, 0, 0.5);
[0.5, 0.75, 1.0, 1.25].forEach((t) => s.bang(1, t));   // 4 Hz, as a surge runs
const d = (await off.startRendering()).getChannelData(0);
```

Four impulses a quarter of a second apart, which is what `SURGE_HZ = 4` produces.
What to look for: a 5 ms attack, a 350 ms decay, energy at 90 Hz and 300 Hz, and
**four** distinct impulses — if only two arrive, something has reintroduced the
decay-window guard that `src/sound.js` explains at length why it must not have.

Left as a console procedure rather than a test because Node has no Web Audio at
all; automating it is BL-16 in the backlog.

## Licence of the recordings

The recordings are distributed under a Creative Commons licence and are not
included in the repository — `fetch.sh` downloads them on demand. The authors
are theplax ("Air North 737 take-off") and SoundsLikeYukon ("boing 737-800
start egypt").
