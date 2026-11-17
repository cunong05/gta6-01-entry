# Solmar Bay — Open-World Crime

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/cunong05/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/cunong05/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar Bay** is an original open-world crime game built for make.fun's
[Make GTA 6 bounty](https://make.fun/bounty/gta6-01) (referral `0ene8b3q`).
It runs entirely offline in a desktop browser — no network requests, no
libraries, just vanilla JavaScript on a canvas.

You are **Rico Vega**, a freelance driver in the fictional tropical port city
of **Solmar Bay**. Work six chained missions for the fixer **Mama Rosa**,
from a first courier run at the old pier to the big score at the Solmar Bay
Bank — and in between, steal cars, outrun the police, and make the city yours.

## What is in the game

- **A city to explore on foot and by car** — harbour, downtown, beach and
  suburbs on a road grid, with parks, piers, a boardwalk and streetlights.
- **Traffic AI** — cars follow the roads, keep their lane, queue behind each
  other and stop at red lights; pedestrians walk the sidewalks and flee from
  gunfire and speeding cars.
- **Steal and drive** — walk up to any parked or slow car and press **E** to
  take it. Arcade handling with acceleration, braking, handbrake skids and
  collisions.
- **Wanted level, 0–5 stars** — crimes raise the heat; patrol cars ram you
  and foot officers try to grab you. Lose them by hiding, or pay cash at the
  **Spray Shop** for a fresh coat of paint and a clean slate.
- **Six story missions** — delivery, pickup, a hot-wheels heist, a police
  escape, a dockside fight and the bank job, each with a map marker, dialogue
  and a cash reward.
- **Combat** — fists and a pistol (mouse-aimed, Space to fire), armed thugs
  who shoot back, ammo and health pickups.
- **HUD + minimap** — money, health, wanted stars, weapon and ammo, mission
  objective, and a live minimap with the player, police and mission marker.
- **Start screen, pause, game over, story-complete screen, and saving** via
  localStorage (money, mission progress, position).
- **Synthesised sound** — engine hum, police sirens, gunshots, crashes and
  pickups, all built with WebAudio. No audio files.
- **Polish** — a day/dusk/night cycle, dusk haze, streetlight glow at night,
  dust, smoke and spark particles, skid marks, and a bouncing mission beacon.

## How to play

```sh
node serve.ts
# open http://localhost:8080
```

| Key | Action |
| --- | --- |
| WASD / Arrows | Move on foot, drive the car |
| Shift | Run |
| E | Steal / enter a car, exit a car |
| Mouse click / Space | Shoot (pistol) or punch (fists) |
| 1 / 2 | Fists / pistol |
| Space (in car) | Handbrake |
| P | Pause |
| M | Mute |
| Enter | Advance dialogue, start / restart |

## Structure

All game code is original, split into one job per file under `game/src/`:

| File | Job |
| --- | --- |
| `config.js` | World size, roads, districts, vehicles, prices |
| `random.js` | Seeded RNG (starter) — repeatable cities and shots |
| `input.js` | Keyboard and mouse state |
| `audio.js` | WebAudio synth: engine, siren, shots, pickups |
| `city.js` | City generation, roads, buildings, traffic lights |
| `vehicles.js` | Traffic AI, parked cars, player driving |
| `pedestrians.js` | Sidewalk walkers who flee from danger |
| `police.js` | Wanted stars, pursuit, Spray Shop |
| `missions.js` | The six chained story missions |
| `combat.js` | Fists, pistol, bullets, enemies, pickups |
| `hud.js` | HUD, dialogue, title / pause / game-over screens |
| `minimap.js` | Live minimap |
| `render.js` | Canvas rendering, camera, day/night cycle |
| `world.js` | World state, update loop, save / load |
| `shots.js` | Screenshot staging (plays the real game) |
| `main.js` | Entry point, game loop, screen states |

## Screenshots

The four screenshots under `screenshots/` are real renders of the game,
staged by `game/src/shots.js` through `?shot=<name>&seed=1`: a dusk police
chase (cover), downtown on foot, a mission in progress, and the title screen.

## Originality

Solmar Bay, Rico Vega, Mama Rosa, and every name, character, map, vehicle and
sound in this game are original fiction. Nothing is taken from Rockstar
Games' Grand Theft Auto series or any other commercial game.

## License

MIT — see [LICENSE](LICENSE).
