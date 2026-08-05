"""Раскладка тонов по порядкам вала и огибающая buzz-saw.

Проверяем: если тоны стоят на гармониках частоты вала n·f0, то это buzz-saw.
Заодно снимаем огибающую — как уровень тонов зависит от номера порядка.
Эта огибающая напрямую переносится в синтез.
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
    """Подбираем частоту вала так, чтобы максимум тонов попал на её гармоники."""
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

# берём окна с наибольшей тональностью
wins = [(t, x[int(t*sr):int(t*sr)+int(8*sr)]) for t in (60, 72, 24, 36)]
print('### Раскладка тонов по порядкам вала (start.wav)\n')
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
    print(f'окно {t:3.0f} с: частота вала {f0:.2f} Гц ({f0*60:.0f} об/мин, {f0*60/5175*100:.0f}% N1), '
          f'BPF = {f0*24:.0f} Гц')
    print(f'   на гармониках вала: {len(hits)} из {len(fr)} тонов ({frac*100:.0f}%)')
    top = sorted(hits, key=lambda h: -h[2])[:8]
    print('   ' + '  '.join(f'{n}×({f:.0f}Гц,+{a:.0f}дБ)' for n, f, a in sorted(top)))

print('\n### Огибающая по порядкам вала (среднее превышение над фоном, дБ)')
print('  порядок  доля BPF   уровень')
for n in sorted(env):
    if n <= 48:
        v = np.mean(env[n])
        print(f'  {n:7d}  {n/24:8.2f}   {v:5.1f}  ' + '#' * int(max(0, v)))
