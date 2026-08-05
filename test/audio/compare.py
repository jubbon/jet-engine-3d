"""Прямое сравнение реальной записи CFM56 и синтезированного звука.

Один и тот же анализ применяется к обоим сигналам:
  · интервал гребёнки тонов (должен равняться частоте вращения вала НД);
  · доля тонов, попадающих на целые порядки вала (признак buzz-saw);
  · огибающая по порядкам (где максимум относительно BPF);
  · третьоктавный спектр (форма широкополосной части).
"""
import sys, wave, numpy as np
from scipy import signal

def load(path, t0=None, dur=4.0):
    w = wave.open(path, 'rb'); sr = w.getframerate()
    d = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768.0
    if t0 is not None:
        d = d[int(t0 * sr):int((t0 + dur) * sr)]
    return d, sr

def spec(seg, sr):
    nfft = min(32768, 1 << int(np.log2(len(seg))))
    f, p = signal.welch(seg, sr, nperseg=nfft, noverlap=nfft // 2, window='hann')
    return f, 10 * np.log10(p + 1e-20)

def tones(f, pdb, lo=40, hi=6000, prom=4.0):
    m = (f >= lo) & (f <= hi)
    ff, pp = f[m], pdb[m]
    bg = signal.medfilt(pp, 151)
    exc = pp - bg
    idx, _ = signal.find_peaks(exc, prominence=prom, distance=3)
    return ff, exc, bg, ff[idx], exc[idx]

def comb_spacing(f, pdb, lo=800, hi=4000):
    m = (f >= lo) & (f <= hi)
    ff, pp = f[m], pdb[m]
    pp = pp - signal.medfilt(pp, 151)
    pp -= pp.mean()
    ac = np.correlate(pp, pp, 'full')[len(pp)-1:]
    ac /= ac[0]
    df = ff[1] - ff[0]
    a, b = int(30/df), int(300/df)
    k = a + int(np.argmax(ac[a:b]))
    return k * df, ac[k]

def fit_orders(fr, am, f0lo, f0hi):
    best = (-1, 0)
    for f0 in np.arange(f0lo, f0hi, 0.02):
        s = sum(a for f, a in zip(fr, am)
                if 1 <= round(f/f0) <= 60 and abs(f - round(f/f0)*f0) < 0.06*f0)
        if s > best[0]:
            best = (s, f0)
    f0 = best[1]
    hits = [(round(f/f0), f, a) for f, a in zip(fr, am)
            if 1 <= round(f/f0) <= 60 and abs(f - round(f/f0)*f0) < 0.06*f0]
    return f0, hits

def third_octave(f, pdb):
    out, fc = [], 31.25
    while fc <= 8000:
        m = (f >= fc/2**(1/6)) & (f < fc*2**(1/6))
        if m.any():
            out.append((fc, 10*np.log10(np.mean(10**(pdb[m]/10)))))
        fc *= 2**(1/3)
    return out

def report(label, path, t0, f0lo, f0hi, blades=24):
    x, sr = load(path, t0)
    f, pdb = spec(x, sr)
    ff, exc, bg, fr, am = tones(f, pdb)
    sp, r = comb_spacing(f, pdb)
    f0, hits = fit_orders(fr, am, f0lo, f0hi)
    frac = len(hits) / max(1, len(fr))
    print(f'\n=== {label} ===')
    print(f'интервал гребёнки (автокорреляция)  {sp:.1f} Гц   корреляция {r:.2f}')
    print(f'частота вала (подгонка порядков)    {f0:.2f} Гц = {f0*60:.0f} об/мин = {f0*60/5175*100:.0f}% N1')
    print(f'BPF = {blades}×вал                       {f0*blades:.0f} Гц')
    print(f'тонов на целых порядках вала        {len(hits)} из {len(fr)}  ({frac*100:.0f}%)')
    if hits:
        env = {}
        for n, _, a in hits:
            env.setdefault(n, []).append(a)
        pk = max(env, key=lambda n: np.mean(env[n]))
        print(f'максимум огибающей на порядке       {pk}  ({pk/blades:.2f} BPF)')
    return third_octave(f, pdb), frac, f0

real_tob, real_frac, real_f0 = report('ЗАПИСЬ CFM56 (Boeing 737), 92 % N1', 'start.wav', 60, 60, 100)
syn_tob, syn_frac, syn_f0 = report('СИНТЕЗ, 92 % N1', 'synth_takeoff.wav', 0, 60, 100)

print('\n=== Третьоктавный спектр, дБ относительно максимума ===')
print(f'{"Гц":>7} {"запись":>8} {"синтез":>8}  разница')
rm = max(v for _, v in real_tob); sm = max(v for _, v in syn_tob)
diffs = []
for (fc, rv), (_, sv) in zip(real_tob, syn_tob):
    a, b = rv - rm, sv - sm
    if fc <= 5000:
        diffs.append(abs(a - b))
        print(f'{fc:7.0f} {a:8.1f} {b:8.1f}  {b-a:+6.1f}')
print(f'\nсреднее расхождение формы спектра до 5 кГц: {np.mean(diffs):.1f} дБ')
