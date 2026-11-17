// The world: the whole game state and one fixed step. No drawing here, no browser
// except localStorage for the save — step() advances the city, the player, traffic,
// pedestrians, police, missions and combat, and returns what happened as bit flags.
import {
  CAR, DAY, MISSIONS, PEDS, PLAYER, ROADS, SAVE_KEY, TRAFFIC, WANTED,
} from './config.js';
import { createCity } from './city.js';
import { createAudio } from './audio.js';
import {
  collideCars, createCar, drivePlayerCar, nearestCar, spawnTraffic, updateTrafficCar,
} from './vehicles.js';
import { spawnPedestrians, updatePedestrian } from './pedestrians.js';
import {
  addWanted, createPolice, sprayShopPrice, updatePolice,
} from './police.js';
import {
  MISSION_DONE, STORY_DONE, createMissions, currentStage, startMission, updateChaseTarget, updateMissions,
} from './missions.js';
import { createCombat, punch, shoot, spawnPickups, updateCombat } from './combat.js';

export const EVENT_OVER = 1;
export const EVENT_HIT = 2;

const MAX_PARTICLES = 300;
const MAX_SKIDS = 240;

export function createWorld(random) {
  const city = createCity(random);
  const audio = createAudio();
  const state = {
    city,
    roads: ROADS,
    audio,
    random,
    time: 0,
    dayTime: DAY.start,
    player: null,
    cars: [],
    peds: [],
    police: createPolice(),
    missions: createMissions(),
    combat: createCombat(),
    particles: [],
    skids: [],
    message: '',
    messageTimer: 0,
    gameOver: false,
    storyDone: false,
    camera: { x: 1520, y: 1100 },
    damageFlash: 0,
    pedRespawn: 0,
  };

  /** The facade missions.js talks to: state plus the world actions it needs. */
  const worldApi = {
    state,
    audio,
    spawnChaseTarget,
    spawnGuards,
    showMessage,
    saveGame,
    setWanted(n) {
      state.police.wanted = Math.max(0, Math.min(5, n));
    },
    addWanted(n) {
      addWanted(state.police, n);
    },
  };

  function freshPlayer() {
    const start = city.spots.playerStart;
    return {
      x: start.x, y: start.y, angle: -Math.PI / 2,
      health: PLAYER.health, money: PLAYER.startMoney,
      ammo: PLAYER.startAmmo, weapon: 'pistol',
      inCar: null, invulnerable: 0,
    };
  }

  function reset() {
    state.time = 0;
    state.dayTime = DAY.start;
    state.player = freshPlayer();
    state.cars = spawnTraffic(city, random, TRAFFIC.count, state.player.x, state.player.y);
    // The player's own parked car near the start, free to take; it stays put.
    const parked = createCar('traffic', state.player.x + 120, state.player.y + 40, 0, '#e84c3d');
    parked.owned = true;
    parked.parked = true;
    state.cars.push(parked);
    state.peds = spawnPedestrians(city, random, PEDS.count, state.player.x, state.player.y);
    state.police = createPolice();
    state.missions = createMissions();
    state.combat = createCombat();
    spawnPickups(state.combat, city, random);
    state.particles = [];
    state.skids = [];
    state.message = '';
    state.messageTimer = 0;
    state.gameOver = false;
    state.storyDone = false;
    state.camera = { x: state.player.x, y: state.player.y };
    state.damageFlash = 0;
    startMission(state.missions, worldApi, 0);
  }

  function showMessage(text) {
    state.message = text;
    state.messageTimer = 3;
  }

  function spawnParticles(x, y, n, color, speed) {
    for (let i = 0; i < n; i += 1) {
      if (state.particles.length >= MAX_PARTICLES) return;
      const a = random() * Math.PI * 2;
      const s = speed * (0.4 + random() * 0.8);
      state.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.4 + random() * 0.4, maxLife: 0.8, color, size: 2 + random() * 3,
      });
    }
  }

  function damagePlayer(amount, source) {
    const player = state.player;
    if (player.invulnerable > 0 || state.gameOver) return;
    player.health -= amount;
    state.damageFlash = 0.35;
    if (player.health <= 0) {
      player.health = 0;
      state.gameOver = true;
      showMessage(`Rico tumbang karena ${source}.`);
    }
  }
  // Police and combat call these through the state they are handed.
  state.damagePlayer = damagePlayer;
  state.showMessage = showMessage;
  state.spawnParticles = spawnParticles;
  state.knockPed = knockPed;
  state.addWanted = (n) => addWanted(state.police, n);

  function knockPed(ped) {
    spawnParticles(ped.x, ped.y, 10, '#d05a4a', 140);
    addWanted(state.police, WANTED.hitPed);
    showMessage('Pe jalan kaki tertabrak! Polisi mengejarmu.');
    state.pedRespawn = 12;
  }

  function spawnChaseTarget() {
    const player = state.player;
    const road = city.nearestRoad(player.x + 600, player.y);
    const car = createCar('traffic', road.x + 300, road.y, 0, '#8a2f2f');
    car.driver = 'marco';
    car.hp = 120;
    car.dir = 0;
    car.speed = 380;
    return car;
  }

  function spawnGuards(count, x, y) {
    const guards = [];
    for (let i = 0; i < count; i += 1) {
      guards.push({
        x: x + (random() - 0.5) * 300,
        y: y + (random() - 0.5) * 300,
        hp: 60, shootTimer: 1 + random(), active: true,
      });
    }
    return guards;
  }

  function updateGuards(dt) {
    const player = state.player;
    for (const guard of state.missions.guards) {
      if (!guard.active) continue;
      const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
      if (dist < 520 && dist > 120) {
        const a = Math.atan2(player.y - guard.y, player.x - guard.x);
        guard.x += Math.cos(a) * 90 * dt;
        guard.y += Math.sin(a) * 90 * dt;
      }
      guard.shootTimer -= dt;
      if (dist < 400 && guard.shootTimer <= 0) {
        guard.shootTimer = 1.4;
        const a = Math.atan2(player.y - guard.y, player.x - guard.x) + (random() - 0.5) * 0.2;
        state.combat.bullets.push({
          x: guard.x, y: guard.y,
          vx: Math.cos(a) * 700, vy: Math.sin(a) * 700,
          life: 0.9, fromPlayer: false, active: true,
        });
        state.audio.shoot();
      }
    }
  }

  function stealOrExitCar() {
    const player = state.player;
    if (player.inCar) {
      const car = player.inCar;
      player.inCar = null;
      car.isPlayerCar = false;
      player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      player.angle = car.angle;
      car.speed *= 0.3;
      audio.click();
      return;
    }
    const car = nearestCar(state.cars, player.x, player.y, 90);
    if (!car) return;
    player.inCar = car;
    car.isPlayerCar = true;
    car.parked = false;
    player.angle = car.angle;
    if (!car.owned) {
      car.owned = true;
      addWanted(state.police, WANTED.stealCar);
      showMessage('Mobil dicuri! Polisi mengejarmu.');
      audio.crash();
    } else {
      audio.click();
    }
  }

  function sprayShopCheck() {
    const player = state.player;
    const shop = city.sprayShop;
    const wanted = state.police.wanted;
    if (wanted === 0 || !player.inCar) return;
    const car = player.inCar;
    if (car.x > shop.x && car.x < shop.x + shop.w && car.y > shop.y && car.y < shop.y + shop.h) {
      const price = sprayShopPrice(wanted);
      if (player.money >= price) {
        player.money -= price;
        state.police.wanted = 0;
        state.police.cars = [];
        state.police.cops = [];
        showMessage(`Spray Shop: jejak dihapus -$${price}. Bintang wanted hilang!`);
        audio.pickup();
        spawnParticles(car.x, car.y, 20, '#e8b23a', 120);
      } else {
        showMessage(`Spray Shop butuh $${price} — uangmu kurang.`);
        audio.denied();
      }
    }
  }

  function saveGame() {    try {
      const player = state.player;
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: Math.floor(player.money),
        missionIndex: state.missions.index,
        health: Math.floor(player.health),
        ammo: player.ammo,
        x: Math.floor(player.x),
        y: Math.floor(player.y),
      }));
    } catch {
      // Storage can be off: the save then lasts this visit only.
    }
  }

  function loadGame() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function applySave(save) {
    const player = state.player;
    player.money = save.money;
    player.health = save.health;
    player.ammo = save.ammo;
    player.x = save.x;
    player.y = save.y;
    startMission(state.missions, worldApi, Math.min(save.missionIndex, MISSIONS.length - 1));
  }

  /** One fixed step. `input` gives move/actions/click; `attract` runs the city with no player. */
  function step(dt, input, attract) {
    state.time += dt;
    state.dayTime = (DAY.start + state.time / DAY.cycleSeconds) % 1;
    state.messageTimer = Math.max(0, state.messageTimer - dt);
    state.damageFlash = Math.max(0, state.damageFlash - dt);
    state.crashTimer = Math.max(0, (state.crashTimer || 0) - dt);
    const player = state.player;

    // The city lives even on the title screen.
    for (const car of state.cars) {
      if (car !== player.inCar && !car.parked) updateTrafficCar(car, city, dt, state.cars, random, state.time);
    }
    for (const ped of state.peds) {
      updatePedestrian(ped, city, dt, random, null);
    }
    if (attract) {
      state.camera.x = 1500 + Math.cos(state.time * 0.05) * 500;
      state.camera.y = 1050 + Math.sin(state.time * 0.04) * 300;
      return 0;
    }

    const move = input.move();
    const actions = input.takeActions();
    const click = input.takeClick();

    // --- Player on foot or driving ---
    if (player.inCar) {
      const car = player.inCar;
      const skidding = drivePlayerCar(car, move, dt, false);
      if (skidding) {
        state.skids.push({ x: car.x, y: car.y, angle: car.angle, life: 7 });
        if (state.skids.length > MAX_SKIDS) state.skids.shift();
        if (random() < 0.4) spawnParticles(car.x, car.y, 1, '#888888', 40);
      }
      if (city.resolveCircle(car, CAR.radius)) {
        if (Math.abs(car.speed) > CAR.crashDamageSpeed && state.crashTimer <= 0) {
          state.crashTimer = 0.5;
          damagePlayer(6, 'tabrakan');
          audio.crash();
          spawnParticles(car.x, car.y, 12, '#ffb03a', 160);
        }
        car.speed *= 0.45;
      }
      city.clampWorld(car, CAR.radius);
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      // Running over pedestrians is a crime.
      for (const ped of state.peds) {
        if (ped.active && Math.abs(car.speed) > 120 && Math.hypot(ped.x - car.x, ped.y - car.y) < 26) {
          ped.active = false;
          knockPed(ped);
        }
      }
      audio.setEngine(Math.min(1, Math.abs(car.speed) / CAR.maxSpeed));
    } else {
      const speed = PLAYER.walkSpeed;
      player.x += move.x * speed * dt;
      player.y += move.y * speed * dt;
      if (move.x !== 0 || move.y !== 0) player.angle = Math.atan2(move.y, move.x);
      city.resolveCircle(player, PLAYER.radius);
      city.clampWorld(player, PLAYER.radius);
      audio.setEngine(0);
    }

    // --- Actions ---
    if (actions & 4) stealOrExitCar(); // ACTION_INTERACT
    if (actions & 8) punch(state.combat, state); // ACTION_PUNCH
    if (actions & 16) { // ACTION_WEAPON
      player.weapon = player.weapon === 'pistol' ? 'fists' : 'pistol';
      audio.click();
    }
    if (click && !player.inCar && player.weapon === 'pistol') {
      const cam = state.camera;
      const scale = state.viewScale || 1;
      const wx = cam.x + (click.x - state.viewW / 2) / scale;
      const wy = cam.y + (click.y - state.viewH / 2) / scale;
      const angle = Math.atan2(wy - player.y, wx - player.x);
      player.angle = angle;
      if (shoot(state.combat, state, player.x, player.y, angle)) {
        // Firing where the police can hear it raises the heat (at most once per 5 s).
        const near = state.police.cars.some((c) => Math.hypot(c.x - player.x, c.y - player.y) < 550)
          || state.police.cops.some((c) => Math.hypot(c.x - player.x, c.y - player.y) < 400);
        if (near && state.time - (state.lastShotHeat || -99) > 5) {
          state.lastShotHeat = state.time;
          addWanted(state.police, WANTED.shoot);
        }
      } else if (player.ammo <= 0) {
        showMessage('Peluru habis! Cari pickup ammo di jalan.');
        audio.denied();
      }
    }
    if (click && player.inCar) {
      // Drive-by: shoot from the car window toward the mouse.
      const cam = state.camera;
      const scale = state.viewScale || 1;
      const wx = cam.x + (click.x - state.viewW / 2) / scale;
      const wy = cam.y + (click.y - state.viewH / 2) / scale;
      const angle = Math.atan2(wy - player.y, wx - player.x);
      shoot(state.combat, state, player.x, player.y, angle);
    }

    // --- Systems ---
    collideCars([...state.cars, ...state.police.cars]);
    updatePolice(state.police, state, dt, random);
    updateCombat(state.combat, state, dt);
    updateGuards(dt);
    const target = state.missions.targetCar;
    if (target) {
      updateChaseTarget(target, city, dt, player, random);
      if (target.hp <= 0) target.active = false;
      if (target.active) {
        if (city.resolveCircle(target, CAR.radius)) target.speed *= 0.5;
        for (const car of state.cars) {
          if (car.active && Math.hypot(car.x - target.x, car.y - target.y) < CAR.radius * 1.6) {
            target.hp -= 12;
            target.speed *= 0.6;
            car.speed *= 0.6;
            spawnParticles(target.x, target.y, 8, '#ff8a3d', 140);
            audio.crash();
          }
        }
      }
    }
    const missionEvents = updateMissions(state.missions, worldApi, dt);
    if (missionEvents & STORY_DONE) state.storyDone = true;
    sprayShopCheck();

    // Pedestrian respawn keeps the streets alive.
    state.pedRespawn -= dt;
    if (state.pedRespawn <= 0) {
      state.pedRespawn = 8;
      const fresh = spawnPedestrians(city, random, 1, player.x, player.y);
      if (fresh.length) state.peds.push(fresh[0]);
    }

    // Slow health regen while the heat is off.
    if (state.police.wanted === 0 && player.health < PLAYER.health) {
      player.health = Math.min(PLAYER.health, player.health + 2 * dt);
    }
    player.invulnerable = Math.max(0, player.invulnerable - dt);

    // Particles and skid marks age.
    for (const p of state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
    }
    state.particles = state.particles.filter((p) => p.life > 0);
    for (const s of state.skids) s.life -= dt;
    state.skids = state.skids.filter((s) => s.life > 0);

    // Camera follows the player.
    const tx = player.x;
    const ty = player.y;
    state.camera.x += (tx - state.camera.x) * Math.min(1, 6 * dt);
    state.camera.y += (ty - state.camera.y) * Math.min(1, 6 * dt);

    // Siren when police are close and the heat is on.
    audio.siren(state.police.wanted > 0 && state.police.sirenNear, dt);

    if (state.gameOver) return EVENT_OVER;
    return missionEvents & MISSION_DONE ? EVENT_HIT : 0;
  }

  reset();

  return {
    state,
    reset,
    step,
    showMessage,
    spawnParticles,
    damagePlayer,
    knockPed,
    spawnChaseTarget,
    spawnGuards,
    saveGame,
    loadGame,
    applySave,
    setWanted(n) {
      worldApi.setWanted(n);
    },
    addWanted(n) {
      worldApi.addWanted(n);
    },
    /** The current mission stage, for the minimap marker. */
    get missionStage() {
      return currentStage(state.missions);
    },
  };
}
