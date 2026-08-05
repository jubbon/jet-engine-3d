"""Разбор записи по фазам: где доминирует тон вентилятора, где шум струи."""
import sys, wave, numpy as np
from scipy import signal

def load(path):
    w = wave.open(path, 'rb'); sr = w.getframerate()
    d = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768.0
    return d, sr

def analyse(seg, sr):
    f, p = signal.welch(seg, sr, nperseg=16384, noverlap=8192, window='hann')
    pdb = 10 * np.log10(p + 1e-20)
    m = (f >= 30) & (f <= 9000)
    ff, pp = f[m], pdb[m]
    bg = signal.medfilt(pp, kernel_size=151)          # широкополосный фон
    exc = pp - bg                                      # тональное превышение
    idx, _ = signal.find_peaks(exc, prominence=3.0, distance=4)
    # частота максимума широкополосной части
    fpeak = ff[np.argmax(bg)]
    # наклон фона: уровень на характерных частотах относительно пика
    def at(fr):
        return bg[np.argmin(np.abs(ff - fr))] - bg.max()
    return ff, pp, bg, exc, idx, fpeak, {k: at(k) for k in (100, 250, 500, 1000, 2000, 4000, 6000)}

name = sys.argv[1]
nwin = int(sys.argv[2]) if len(sys.argv) > 2 else 10
x, sr = load(name)
dur = len(x) / sr
win = int(sr * 5)
print(f'\n### {name}   {dur:.0f} с, окна по 5 с\n')
print(f'{"t, с":>6} {"ур., дБ":>8} {"пик фона":>9} | {"наклон фона относительно пика, дБ":^44}')
print(f'{"":>6} {"":>8} {"":>9} | ' + ' '.join(f'{k:>5}' for k in (100, 250, 500, 1000, 2000, 4000, 6000)))
rows = []
for i in range(nwin):
    a = int(i * (len(x) - win) / max(1, nwin - 1))
    seg = x[a:a+win]
    lvl = 10 * np.log10(np.mean(seg**2) + 1e-20)
    ff, pp, bg, exc, idx, fpeak, tilt = analyse(seg, sr)
    print(f'{a/sr:6.0f} {lvl:8.1f} {fpeak:8.0f}  | ' + ' '.join(f'{tilt[k]:5.0f}' for k in (100,250,500,1000,2000,4000,6000)))
    rows.append((a/sr, ff, exc, idx, lvl))

print('\nсамые заметные тоны по окнам (частота Гц / превышение дБ):')
for t, ff, exc, idx, lvl in rows:
    top = sorted(idx, key=lambda j: -exc[j])[:6]
    s = '  '.join(f'{ff[j]:6.0f}/{exc[j]:.0f}' for j in sorted(top, key=lambda j: ff[j]))
    print(f'{t:6.0f} с: {s}')
