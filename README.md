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

- **Kota multi-distrik** (Pelabuhan, Downtown, Pantai Coral, Suburb) dijelajahi jalan kaki + mobil — plus Plaza Solmar dengan air mancur di tengah Downtown
- **Traffic AI** — mobil ikut jalan, berhenti di lampu merah (dan melambat saat lampu kuning), klakson kalau macet; pejalan kaki di trotoar, kadang berhenti mengobrol
- **Curi mobil** (E di dekat mobil) + mengemudi dengan kamera mengikuti, skid mark saat nge-drift
- **Wanted level 0–5 bintang** — polisi mobil + jalan kaki mengejar, makin agresif per bintang; di bintang 4+ polisi memotong jalan dari depan; sirene melemah dengan jarak
- **Spray Shop** — bayar tunai untuk hapus bintang wanted
- **6 misi cerita berantai** — marker, dialog, progress bar per tahap, hadiah $ (total $3.100)
- **Combat** — pukul (Spasi, ada knockback) + pistol (klik mouse, ammo terbatas, tracer peluru)
- **HUD lengkap** — uang, nyawa (denyut merah saat kritis), wanted stars, senjata/ammo, objektif misi + progress bar, minimap (marker misi, polisi, Marco, kompas N)
- **Start screen, pause, game over + restart (Enter/R), save via localStorage** (berversi — save lama diabaikan, bukan salah baca)
- **Suara WebAudio synth** — mesin, sirene, tembakan, klakson, pickup (tanpa file audio); mute tersimpan
- **Polish** — siklus siang/senja/malam, lampu jalan + cone lampu depan mobil saat malam, partikel, pickup yang muncul lagi

## Cara main

```sh
node serve.ts
# buka http://localhost:8080
```

| Kontrol | Aksi |
| --- | --- |
| WASD / panah | Jalan kaki / mengemudi |
| E | Curi mobil / keluar mobil |
| Klik mouse | Tembak pistol (drive-by dari mobil) |
| Spasi | Pukul |
| 1 / 2 / Q | Ganti senjata |
| P / Esc | Jeda |
| M | Suara on/off |
| Enter / R | Mulai / main lagi |
| N | Cerita baru dari awal (di title) |

## Screenshot

Empat screenshot diambil dari game yang sedang berjalan
(`?shot=chase|downtown|mission|start&seed=1`):

| File | Isi |
| --- | --- |
| `1-chase.jpg` (cover) | Kejar-kejaran mobil, 3 bintang wanted, polisi di belakang |
| `2-downtown.jpg` | Jalan kaki di Downtown, traffic + pejalan kaki + HUD lengkap |
| `3-mission.jpg` | Misi 1 berjalan — marker + dialog Mama Rosa |
| `4-start.jpg` | Title screen di atas kota yang hidup |

## Struktur source

`game/index.html` + `game/src/` — satu file, satu tugas:

| File | Tugas |
| --- | --- |
| `config.js` | Semua angka tuning, warna, tabel difficulty polisi & data 6 misi |
| `random.js` | RNG seeded (mulberry32) |
| `input.js` | Keyboard + mouse (termasuk R restart, blokir klik kanan) |
| `audio.js` | Suara synth WebAudio (sirene berjarak, klakson, mute tersimpan) |
| `city.js` | Grid kota, distrik, bangunan, plaza, lampu |
| `vehicles.js` | Fisika mobil + traffic AI (lampu kuning, klakson) |
| `pedestrians.js` | Pejalan kaki (jalan, jeda mengobrol, kabur) |
| `police.js` | Wanted level + polisi (pincer di bintang 4+) |
| `missions.js` | Mesin 6 misi cerita + progress tiap tahap |
| `combat.js` | Pistol, pukul (knockback), tracer, pickup |
| `hud.js` | HUD (uang, nyawa, bintang, objektif + progress bar) |
| `minimap.js` | Minimap kota (marker, polisi, Marco, kompas) |
| `render.js` | Renderer + semua layar (lampu depan, tracer, lampu lalu lintas) |
| `world.js` | State game + satu fixed step (respawn pickup, save berversi) |
| `shots.js` | 4 scene screenshot (autopilot) |
| `main.js` | Boot + loop utama |

Game statis murni: vanilla JS tanpa library luar, tanpa network request,
playable offline di desktop Chrome.

## Lisensi

MIT — lihat [LICENSE](LICENSE).
