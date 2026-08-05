# Спектральный анализ звука двигателя

Скрипты, которыми настраивался синтез в `src/sound.js`. Результаты и выводы —
в [docs/06-sound.md](../../docs/06-sound.md).

| Скрипт | Что делает |
|---|---|
| `fetch.sh` | Скачивает записи CFM56 с Freesound и переводит в моно WAV |
| `phases.py` | Разбор записи по фазам: где доминирует тон, где шум струи |
| `orders.py` | Раскладка тонов по порядкам вала, огибающая buzz-saw |
| `compare.py` | Сравнение реальной записи и синтезированного звука |

Нужны `python3` с `numpy` и `scipy`, а также `ffmpeg` и `curl`.

## Синтез для сравнения

`compare.py` ждёт файл `synth_takeoff.wav`. Он рендерится офлайн в браузере:
откройте приложение и выполните в консоли

```js
const { createEngineSound } = await import('/src/sound.js');
const SR = 44100, off = new OfflineAudioContext(1, SR * 6, SR);
const s = createEngineSound({ makeContext: () => off });
await s.enable(); s.setVolume(0.5); s.update(0.92, 0.95, 0.9, 0, 0.5);
const d = (await off.startRendering()).getChannelData(0);
```

затем сохраните `d` (начиная со второй секунды) как 16-битный моно WAV 44.1 кГц.
Режим 0.92 выбран потому, что реальная запись сделана именно на 92 % N1.

## Лицензия записей

Записи распространяются по лицензии Creative Commons и в репозиторий не
включены — `fetch.sh` скачивает их по требованию. Авторы: theplax
(«Air North 737 take-off»), SoundsLikeYukon («boing 737-800 start egypt»).
