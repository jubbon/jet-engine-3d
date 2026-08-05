#!/usr/bin/env bash
# Скачивает записи CFM56 (Boeing 737) с Freesound для спектрального анализа.
# Лицензия Creative Commons; сами файлы в репозиторий не кладём.
#   820320 — «Air North 737 take-off», автор theplax
#   850015 — «boing 737-800 start egypt», автор SoundsLikeYukon
set -eu
cd "$(dirname "$0")"
fetch() {
  curl -sL -A "Mozilla/5.0" -e "https://freesound.org/" \
    "https://cdn.freesound.org/previews/${1:0:3}/$1-hq.mp3" -o "$2.mp3"
  ffmpeg -v error -y -i "$2.mp3" -ac 1 -ar 44100 -c:a pcm_s16le "$2.wav"
  echo "$2.wav  $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$2.wav") с"
}
fetch 820320_1544275 takeoff
fetch 850015_3625175 start
