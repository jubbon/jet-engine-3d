"""Tones laid out by shaft order, and the buzz-saw envelope.

What is being checked: if the tones sit on harmonics of the shaft frequency
n·f0, then this is buzz-saw. The envelope is taken at the same time — how the
level of the tones depends on the order number. That envelope carries straight
over into the synthesis.
"""
import wave, numpy as np
from scipy import signal

def load(path):
    w = wave.open(path, 'rb'); sr = w.getframerate()
    d = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768.0
    return d, sr

x, sr = load('start.wav')

def spectrum(seg):
    f, p = signal.welch(seg, sr, nperseg=32768, noverlap=24576, window='hann')
    pdb = 10 * np.log10(p + 1e-20)
    m = (f >= 40) & (f <= 6000)
    ff, pp = f[m], pdb[m]
    bg = signal.medfilt(pp, 201)
    return ff, pp - bg, bg

def fit_f0(ff, exc, f0lo=60, f0hi=100):
    """Fit the shaft frequency so that the bulk of the tones lands on its harmonics."""
    idx, _ = signal.find_peaks(exc, prominence=4.0, distance=4)
    fr, am = ff[idx], exc[idx]
    best = (-1, 0)
    for f0 in np.arange(f0lo, f0hi, 0.02):
        s = 0.0
        for f, a in zip(fr, am):
            n = round(f / f0)
            if 1 <= n <= 60 and abs(f - n * f0) < 0.06 * f0:
                s += a
        if s > best[0]:
            best = (s, f0)
    return best[1], fr, am

# take the windows with the strongest tonal content
wins = [(t, x[int(t*sr):int(t*sr)+int(8*sr)]) for t in (60, 72, 24, 36)]
print('### Tones laid out by shaft order (start.wav)\n')
env = {}
for t, seg in wins:
    ff, exc, bg = spectrum(seg)
    f0, fr, am = fit_f0(ff, exc)
    hits = []
    for f, a in zip(fr, am):
        n = round(f / f0)
        if 1 <= n <= 60 and abs(f - n * f0) < 0.06 * f0:
            hits.append((n, f, a))
            env.setdefault(n, []).append(a)
    frac = len(hits) / max(1, len(fr))
    print(f'window {t:3.0f} s: shaft frequency {f0:.2f} Hz ({f0*60:.0f} rpm, {f0*60/5175*100:.0f}% N1), '
          f'BPF = {f0*24:.0f} Hz')
    print(f'   on shaft harmonics: {len(hits)} of {len(fr)} tones ({frac*100:.0f}%)')
    top = sorted(hits, key=lambda h: -h[2])[:8]
    print('   ' + '  '.join(f'{n}×({f:.0f}Hz,+{a:.0f}dB)' for n, f, a in sorted(top)))

print('\n### Envelope by shaft order (mean excess over the background, dB)')
print('    order  BPF frac   level')
for n in sorted(env):
    if n <= 48:
        v = np.mean(env[n])
        print(f'  {n:7d}  {n/24:8.2f}   {v:5.1f}  ' + '#' * int(max(0, v)))
