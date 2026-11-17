// Solmar Bay — screenshot staging: each shot builds a fresh world from the
// seed, plays the real game rules for a few seconds with an autopilot, and
// leaves the scene exactly where the screenshot wants it. Nothing here is
// faked: the traffic, the police and the mission marker are all live state.

import { makeCar } from './vehicles.js';
import { startMission } from './missions.js';
import { updateWorld } from './world.js';

function fakeInput() {
  return {
    keys: new Set(),
    pressed: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mouseClicked: false,
    autopilot: true,
  };
}

// Step the real update loop for `seconds` of game time.
function runFrames(world, input, seconds) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) {
    updateWorld(world, 1 / 60, input);
  }
}

function putPlayerInCar(world, x, y, angle, typeIndex, color) {
  const car = makeCar(x, y, angle, typeIndex, { color });
  car.isPlayer = true;
  car.speed = 260;
  world.playerCar = car;
  world.player.x = x;
  world.player.y = y;
  world.player.angle = angle;
  return car;
}

function spawnPoliceBehind(world, car, count) {
  for (let i = 0; i < count; i++) {
    const behind = 170 + i * 130;
    const bx = car.x - Math.cos(car.angle) * behind + (world.rand() - 0.5) * 40;
    const by = car.y - Math.sin(car.angle) * behind + (world.rand() - 0.5) * 40;
    const police = makeCar(bx, by, car.angle, 0, { isPolice: true, color: '#20242c', cruise: 320 });
    police.topSpeed = 430;
    police.accel = 330;
    police.speed = 330;
    world.policeCars.push(police);
  }
}

export function stageShot(world, name) {
  const input = fakeInput();
  world.state = 'playing';
  world.dialog = null;

  if (name === 'chase') {
    // Cover: a golden-dusk car chase, three stars, patrol cars closing in.
    world.dayTime = 0.72;
    world.money = 1250;
    world.totalEarned = 1850;
    world.missionIndex = 0;
    world.missionStage = 'start';
    const car = putPlayerInCar(world, 1500, 1024, 0, 5, '#8a2f6d');
    world.heat = 3;
    world.wantedStars = 3;
    spawnPoliceBehind(world, car, 3);
    input.keys.add('up');
    runFrames(world, input, 2.2);
    world.message('Lose the cops — get to the Spray Shop!', 5);
  } else if (name === 'downtown') {
    // On foot downtown at midday: traffic, pedestrians, full HUD. The player
    // stands on the sidewalk by the 1800/1000 intersection, so the camera
    // frames the crossing, the traffic and the hero without anyone walking
    // into a building.
    world.dayTime = 0.42;
    world.money = 640;
    world.totalEarned = 640;
    world.player.x = 1742;
    world.player.y = 1000;
    world.player.angle = Math.PI / 2;
    world.player.weapon = 'pistol';
    world.player.ammo = 24;
    world.missionIndex = 0;
    world.missionStage = 'start';
    runFrames(world, input, 3.5);
  } else if (name === 'mission') {
    // Mission in progress: Tico waits at the pier, the dialogue is up.
    world.dayTime = 0.5;
    world.money = 800;
    world.totalEarned = 400;
    world.player.x = 560;
    world.player.y = 660;
    world.player.angle = -Math.PI / 2;
    world.player.weapon = 'pistol';
    world.player.ammo = 18;
    runFrames(world, input, 3);
    startMission(world, 1);
  } else if (name === 'start') {
    // Title screen over a living dusk city.
    world.dayTime = 0.74;
    world.state = 'title';
    world.player.x = 1600;
    world.player.y = 1200;
    runFrames(world, { ...fakeInput(), keys: new Set() }, 3);
    world.state = 'title';
  }

  window.__shotReady = true;
}
