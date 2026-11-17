// Solmar Bay — the world: one state object holding everything, the per-frame
// update that wires every system together, and the localStorage save.

import {
  WORLD_W, WORLD_H, PLAYER, SAVE_KEY, DAY_LENGTH, districtAt, DISTRICT_NAMES,
  SPRAY_SHOP, ROSAS_PLACE,
} from './config.js';
import { createRandom } from './random.js';
import { buildCity, collideBuildings, isInWater, pointInRect } from './city.js';
import { spawnTraffic, updateTraffic, drivePlayerCar, nearestStealableCar } from './vehicles.js';
import { spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { updateWanted, addHeat, clearWanted } from './police.js';
import { startMission, updateMissions } from './missions.js';
import { updateBullets, updateEnemies, updatePickups, playerShoot, playerPunch, spawnPickup } from './combat.js';
import { SoundBank } from './audio.js';
import { moveVector, keyPressed } from './input.js';

export function createWorld(seed = 1) {
  const rand = createRandom(seed);
  const city = buildCity(seed);
  const world = {
    seed,
    rand,
    city,
    audio: new SoundBank(),
    state: 'title', // title | playing | paused | gameover | win
    time: 0,
    dayTime: 0.32, // mid-morning on a fresh game
    // Player.
    player: {
      x: ROSAS_PLACE.x + ROSAS_PLACE.w / 2,
      y: ROSAS_PLACE.y + ROSAS_PLACE.h + 40,
      angle: -Math.PI / 2,
      health: PLAYER.health,
      money: 0, // money lives on the world, kept here for the HUD's sake
      ammo: PLAYER.startAmmo,
      weapon: 'fists',
      walkPhase: 0,
      punchTimer: 0,
      shootTimer: 0,
      attackTimer: 0,
      attacking: false,
    },
    money: PLAYER.startMoney,
    totalEarned: 0,
    // Driving.
    playerCar: null,
    nearCar: null,
    // Everyone else.
    traffic: [],
    trafficTarget: 16,
    parkedCars: [...city.parkedCars],
    peds: [],
    pedTarget: 26,
    policeCars: [],
    cops: [],
    enemies: [],
    bullets: [],
    pickups: [],
    particles: [],
    skids: [],
    // Wanted.
    heat: 0,
    wantedStars: 0,
    lastCrime: '',
    sprayWarned: false,
    // Missions.
    missionIndex: 0,
    missionStage: 'start',
    missionTimer: 0,
    nextMissionTimer: 0,
    passenger: null,
    hotCar: null,
    storyComplete: false,
    // Combat bookkeeping.
    lastShotX: 0,
    lastShotY: 0,
    lastShotAt: -10,
    // Presentation.
    messages: [],
    dialog: null,
    camera: { x: 0, y: 0 },
    shake: 0,
    districtName: '',
    districtFlash: 0,
    endReason: '',
    hasSave: false,
  };

  // A few starter pickups scattered around the spawn.
  spawnPickup(world, ROSAS_PLACE.x - 90, ROSAS_PLACE.y + 160, 'ammo');
  spawnPickup(world, 700, 900, 'health');
  spawnPickup(world, 1500, 300, 'cash');

  spawnTraffic(world, world.trafficTarget);
  spawnPedestrians(world, world.pedTarget);
  return world;
}

// -- Player health, death, messages -------------------------------------------

export function damagePlayer(world, amount, cause) {
  const { player } = world;
  if (world.state !== 'playing' || player.health <= 0) return;
  player.health -= amount;
  if (player.health <= 0) {
    player.health = 0;
    world.endReason = cause && cause.includes('caught') || cause.includes('rammed') || cause.includes('officer')
      ? 'busted' : 'wasted';
    // A bust at the hands of the police is a bust; anything else is wasted.
    if (world.wantedStars > 0 && (cause || '').match(/officer|rammed|caught/)) world.endReason = 'busted';
    else if ((cause || '').match(/officer|rammed|caught/)) world.endReason = 'busted';
    else world.endReason = 'wasted';
    world.state = 'gameover';
    world.audio.sirenStop();
    world.audio.busted();
    world.audio.engine(0, false);
  }
}

export function message(world, text, seconds = 3) {
  world.messages.push({ text, timer: seconds });
  if (world.messages.length > 3) world.messages.shift();
}

export function showDialog(world, speaker, lines) {
  world.dialog = { speaker, lines, index: 0 };
}

export function advanceDialog(world) {
  if (!world.dialog) return;
  world.dialog.index += 1;
  if (world.dialog.index >= world.dialog.lines.length) world.dialog = null;
  else world.audio.click();
}

// -- Particles -------------------------------------------------------------------

export function addParticles(world, x, y, count, color) {
  for (let i = 0; i < count; i++) {
    const a = world.rand() * Math.PI * 2;
    const speed = 30 + world.rand() * 120;
    world.particles.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 0.4 + world.rand() * 0.5,
      maxLife: 0.9,
      size: 2 + world.rand() * 3,
      color,
    });
  }
  if (world.particles.length > 400) world.particles.splice(0, world.particles.length - 400);
}

// -- Entering and leaving cars -----------------------------------------------------

export function enterCar(world, car) {
  // A traffic car has a driver who objects; a parked car is free.
  const wasTraffic = world.traffic.includes(car);
  if (wasTraffic) {
    world.traffic.splice(world.traffic.indexOf(car), 1);
    addHeat(world, 1, 'stole a car');
    message(world, `You stole a ${car.name}! The owner called the cops!`, 3);
  } else {
    const parkedIdx = world.parkedCars.indexOf(car);
    if (parkedIdx >= 0) world.parkedCars.splice(parkedIdx, 1);
    message(world, `You took the ${car.name}.`, 2);
  }
  car.parked = false;
  car.isPlayer = true;
  car.speed = 0;
  world.playerCar = car;
  world.player.x = car.x;
  world.player.y = car.y;
  world.audio.pickup();
  world.saveGame();
}

export function exitCar(world) {
  const car = world.playerCar;
  if (!car) return;
  car.isPlayer = false;
  car.speed = 0;
  car.parked = true;
  // Step out on the driver's side.
  const side = car.angle + Math.PI / 2;
  world.player.x = car.x + Math.cos(side) * 26;
  world.player.y = car.y + Math.sin(side) * 26;
  world.player.angle = car.angle;
  world.parkedCars.push(car);
  world.playerCar = null;
  world.saveGame();
}

export function hitPedestrian(world, ped) {
  const idx = world.peds.indexOf(ped);
  if (idx >= 0) world.peds.splice(idx, 1);
  addParticles(world, ped.x, ped.y, 10, '#ff6a5a');
  world.audio.crash();
  addHeat(world, 1, 'ran over a pedestrian');
  message(world, 'You hit a pedestrian! The cops saw that!', 3);
}

// -- The per-frame update -----------------------------------------------------------

export function updateWorld(world, dt, input) {
  world.time += dt;
  world.dayTime = (world.dayTime + dt / DAY_LENGTH) % 1;
  world.shake = Math.max(0, world.shake - dt * 26);
  world.districtFlash = Math.max(0, world.districtFlash - dt * 0.5);

  // Message timers.
  for (let i = world.messages.length - 1; i >= 0; i--) {
    world.messages[i].timer -= dt;
    if (world.messages[i].timer <= 0) world.messages.splice(i, 1);
  }

  // Particles and skid marks age out.
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const p = world.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= dt;
    if (p.life <= 0) world.particles.splice(i, 1);
  }
  for (let i = world.skids.length - 1; i >= 0; i--) {
    world.skids[i].life -= dt;
    if (world.skids[i].life <= 0) world.skids.splice(i, 1);
  }

  // Dialogue pauses the world (but not the render).
  if (world.dialog) return;

  const { player } = world;
  player.punchTimer = Math.max(0, player.punchTimer - dt);
  player.shootTimer = Math.max(0, player.shootTimer - dt);
  player.attackTimer = Math.max(0, player.attackTimer - dt);
  if (player.attackTimer <= 0) player.attacking = false;

  // --- Player on foot or driving ----------------------------------------------
  // E is handled exactly once per press: it exits the car when driving, and
  // enters the nearest car when on foot. (Handling it twice in one frame
  // used to enter and instantly exit again.)
  if (world.playerCar) {
    drivePlayerCar(world, dt, input);
    player.x = world.playerCar.x;
    player.y = world.playerCar.y;
    player.angle = world.playerCar.angle;
    world.audio.engine(Math.abs(world.playerCar.speed) / world.playerCar.topSpeed, true);
    if (keyPressed(input, 'KeyE')) exitCar(world);
  } else {
    world.audio.engine(0, false);
    const mv = moveVector(input);
    const running = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
    const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const nx = player.x + mv.x * speed * dt;
    const ny = player.y + mv.y * speed * dt;
    if (mv.x !== 0 || mv.y !== 0) {
      player.angle = Math.atan2(mv.y, mv.x);
      player.walkPhase += dt * 11;
    }
    player.x = nx;
    player.y = ny;
    // On foot the player cannot walk through buildings or into the sea.
    collideBuildings(player, PLAYER.radius, world.city.buildings);
    if (isInWater(player.x, player.y)) {
      player.x = nx - mv.x * speed * dt;
      player.y = ny - mv.y * speed * dt;
    }
    player.x = Math.max(20, Math.min(WORLD_W - 20, player.x));
    player.y = Math.max(20, Math.min(WORLD_H - 20, player.y));

    // Nearest stealable car, for the prompt and the E key.
    world.nearCar = nearestStealableCar(world, player.x, player.y);
    if (keyPressed(input, 'KeyE') && world.nearCar) {
      enterCar(world, world.nearCar);
      world.nearCar = null;
    }
    // Mouse aim: the player faces the cursor. mouseClicked is edge-triggered,
    // so a quick click that lands between two frames still fires one shot;
    // mouseDown covers holding the button down.
    if (input.mouseDown || input.mouseClicked || keyPressed(input, 'Space')) {
      const aimX = world.camera.x + input.mouseX;
      const aimY = world.camera.y + input.mouseY;
      playerShoot(world, aimX, aimY);
    }
    // Space also punches when the fists are out.
    if (keyPressed(input, 'Space') && player.weapon === 'fists') playerPunch(world);
    if (keyPressed(input, 'Digit1')) { player.weapon = 'fists'; world.audio.click(); }
    if (keyPressed(input, 'Digit2')) {
      player.weapon = 'pistol';
      world.audio.click();
      message(world, player.ammo > 0 ? 'Pistol ready.' : 'Pistol ready — no ammo!', 2);
    }
  }

  // Passenger follows the player on foot; rides along in the car.
  if (world.passenger && !world.passenger.inCar) {
    const p = world.passenger;
    const d = Math.hypot(player.x - p.x, player.y - p.y);
    if (d > 46) {
      const a = Math.atan2(player.y - p.y, player.x - p.x);
      p.angle = a;
      p.x += Math.cos(a) * 190 * dt;
      p.y += Math.sin(a) * 190 * dt;
    }
  }

  // District name flash when the player crosses into a new district.
  const district = districtAt(player.x, player.y);
  if (district !== world.currentDistrict) {
    world.currentDistrict = district;
    world.districtName = DISTRICT_NAMES[district];
    world.districtFlash = 2.2;
  }

  // --- Every other system -------------------------------------------------------
  updateTraffic(world, dt);
  updatePedestrians(world, dt);
  updateWanted(world, dt);
  updateMissions(world, dt);
  updateBullets(world, dt);
  updateEnemies(world, dt);
  updatePickups(world, dt);

  // Slow health regen when the player is safe and calm.
  if (world.wantedStars === 0 && player.health > 0 && player.health < PLAYER.health) {
    player.health = Math.min(PLAYER.health, player.health + 1.2 * dt);
  }
}

// -- Save / load ----------------------------------------------------------------------

export function saveGame(world) {
  try {
    const data = {
      money: world.money,
      totalEarned: world.totalEarned,
      missionIndex: world.missionIndex,
      health: world.player.health,
      ammo: world.player.ammo,
      x: world.player.x,
      y: world.player.y,
      wantedStars: world.wantedStars,
      heat: world.heat,
      dayTime: world.dayTime,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    world.hasSave = true;
  } catch {
    /* storage unavailable (private mode, etc.) — the game still plays */
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function applySave(world, save) {
  if (!save) return;
  world.money = save.money ?? PLAYER.startMoney;
  world.totalEarned = save.totalEarned ?? 0;
  world.missionIndex = save.missionIndex ?? 0;
  world.player.health = save.health ?? PLAYER.health;
  world.player.ammo = save.ammo ?? PLAYER.startAmmo;
  world.player.x = save.x ?? world.player.x;
  world.player.y = save.y ?? world.player.y;
  world.wantedStars = save.wantedStars ?? 0;
  world.heat = save.heat ?? 0;
  world.dayTime = save.dayTime ?? 0.32;
  world.missionStage = 'start';
  if (world.missionIndex < 6) {
    // Restart the current mission fresh from its intro.
    startMission(world, world.missionIndex);
  }
}

// Attach the methods the other modules call on the world object.
export function bindWorldMethods(world) {
  world.message = (text, seconds) => message(world, text, seconds);
  world.showDialog = (speaker, lines) => showDialog(world, speaker, lines);
  world.addParticles = (x, y, count, color) => addParticles(world, x, y, count, color);
  world.damagePlayer = (amount, cause) => damagePlayer(world, amount, cause);
  world.busted = () => {
    world.endReason = 'busted';
    world.state = 'gameover';
    world.audio.sirenStop();
    world.audio.busted();
    world.audio.engine(0, false);
  };
  world.hitPedestrian = (ped) => hitPedestrian(world, ped);
  world.exitCar = () => exitCar(world);
  world.saveGame = () => saveGame(world);
  world.currentDistrict = districtAt(world.player.x, world.player.y);
  world.districtName = DISTRICT_NAMES[world.currentDistrict];
  world.districtFlash = 0;
}
