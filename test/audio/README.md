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

## Licence of the recordings

The recordings are distributed under a Creative Commons licence and are not
included in the repository — `fetch.sh` downloads them on demand. The authors
are theplax ("Air North 737 take-off") and SoundsLikeYukon ("boing 737-800
start egypt").
