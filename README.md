# Solmar Bay — Open-World Crime

[![make.fun](https://img.shields.io/badge/make.fun-gta6--01-ff6b35?style=for-the-badge)](https://make.fun/c/gta6-01)
[![Prize $1,666](https://img.shields.io/badge/prize-%241%2C666-gold?style=for-the-badge)](https://make.fun/c/gta6-01)
[![Play offline](https://img.shields.io/badge/play-offline%20in%20Chrome-2fae5f?style=for-the-badge)](#cara-main)

**Solmar Bay** adalah game open-world crime 2D top-down yang orisinal — kota pesisir
tropis fiktif, bukan GTA dan bukan Rockstar. Dibangun untuk bounty
[make.fun **gta6-01** "Make GTA 6"](https://make.fun/c/gta6-01) ($1.666 total hadiah).

> Referral make.fun: `0ene8b3q`

## Cerita

Rico Vega kembali ke Solmar Bay — dan Mama Rosa, fixer kota itu, sudah menunggu
dengan enam misi berantai: antar paket, jemput Tito, kejar si pengkhianat Marco,
kabur dari polisi, rampok Bank Pelabuhan, sampai showdown terakhir di dermaga.

## Yang ada di game

- **Kota multi-distrik** (Pelabuhan, Downtown, Pantai Coral, Suburb) dijelajahi jalan kaki + mobil
- **Traffic AI** — mobil ikut jalan, berhenti di lampu merah; pejalan kaki di trotoar
- **Curi mobil** (E di dekat mobil) + mengemudi dengan kamera mengikuti
- **Wanted level 0–5 bintang** — polisi mobil + jalan kaki mengejar, makin agresif per bintang
- **Spray Shop** — bayar tunai untuk hapus bintang wanted
- **6 misi cerita berantai** — marker, dialog, hadiah $ (total $3.100)
- **Combat** — pukul (Spasi) + pistol (klik mouse, ammo terbatas)
- **HUD lengkap** — uang, nyawa, wanted stars, senjata/ammo, objektif misi, minimap
- **Start screen, pause, game over + restart, save via localStorage**
- **Suara WebAudio synth** — mesin, sirene, tembakan, pickup (tanpa file audio)
- **Polish** — siklus siang/senja/malam, lampu jalan menyala, partikel, skid mark

## Cara main

```sh
node serve.ts
# buka http://localhost:8080
```

| Kontrol | Aksi |
| --- | --- |
| WASD / panah | Jalan kaki / mengemudi |
| E | Curi mobil / keluar mobil |
| Klik mouse | Tembak pistol |
| Spasi | Pukul |
| 1 / 2 | Ganti senjata |
| P / Esc | Jeda |
| M | Suara on/off |
| Enter | Mulai / lanjut |

## Struktur source

`game/index.html` + `game/src/` — satu file, satu tugas:

| File | Tugas |
| --- | --- |
| `config.js` | Semua angka tuning, warna & data 6 misi |
| `random.js` | RNG seeded (mulberry32) |
| `input.js` | Keyboard + mouse |
| `audio.js` | Suara synth WebAudio |
| `city.js` | Grid kota, distrik, bangunan, lampu |
| `vehicles.js` | Fisika mobil + traffic AI |
| `pedestrians.js` | Pejalan kaki |
| `police.js` | Wanted level + polisi |
| `missions.js` | Mesin 6 misi cerita |
| `combat.js` | Pistol, pukul, pickup |
| `hud.js` | HUD (uang, nyawa, bintang, objektif) |
| `minimap.js` | Minimap kota |
| `render.js` | Renderer + semua layar |
| `world.js` | State game + satu fixed step |
| `shots.js` | 4 scene screenshot (autopilot) |
| `main.js` | Boot + loop utama |

Game statis murni: vanilla JS tanpa library luar, tanpa network request,
playable offline di desktop Chrome. Screenshot diambil dari game yang sedang
berjalan (`?shot=chase|downtown|mission|start&seed=1`).

## Lisensi

MIT — lihat [LICENSE](LICENSE).
