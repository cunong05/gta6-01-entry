// Solmar Bay — vehicles: traffic AI that follows the roads and obeys the
// lights, parked cars to steal, and the player car's arcade driving model.

import {
  WORLD_W, WORLD_H, V_ROADS, H_ROADS, ROAD_HALF, LANE, CAR_TYPES, DRIVING,
} from './config.js';
import { createRandom } from './random.js';
import { collideBuildings, isInWater, lightForAxis } from './city.js';

export function makeCar(x, y, angle, typeIndex, opts = {}) {
  const type = CAR_TYPES[typeIndex % CAR_TYPES.length];
  return {
    x, y, angle,
    speed: 0,
    type: typeIndex % CAR_TYPES.length,
    name: type.name,
    w: type.w,
    h: type.h,
    topSpeed: type.topSpeed,
    accel: type.accel,
    color: opts.color || type.color,
    // Traffic fields (unused for the player's car).
    axis: opts.axis || 'h',
    road: opts.road || 0,
    dir: opts.dir || 1,
    lane: opts.lane || 1,
    cruise: opts.cruise || 0,
    isPolice: !!opts.isPolice,
    isPlayer: false,
    parked: !!opts.parked,
    honk: 0,
    brakeLight: false,
  };
}

// Spawn a traffic car on a random road, in a random lane and direction.
export function spawnTrafficCar(rand, world) {
  const vertical = rand() < 0.5;
  let x, y, axis, road, dir, angle;
  if (vertical) {
    road = V_ROADS[Math.floor(rand() * V_ROADS.length)];
    dir = rand() < 0.5 ? 1 : -1;
    const lane = dir === 1 ? LANE : -LANE; // right-hand traffic
    x = road + lane;
    y = rand() * WORLD_H;
    angle = dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    axis = 'v';
  } else {
    road = H_ROADS[Math.floor(rand() * H_ROADS.length)];
    dir = rand() < 0.5 ? 1 : -1;
    const lane = dir === 1 ? LANE : -LANE;
    y = road + lane;
    x = rand() * WORLD_W;
    angle = dir === 1 ? 0 : Math.PI;
    axis = 'h';
  }
  const car = makeCar(x, y, angle, Math.floor(rand() * CAR_TYPES.length), {
    axis, road, dir, lane: dir === 1 ? 1 : -1, cruise: 130 + rand() * 70,
  });
  car.speed = car.cruise;
  return car;
}

export function spawnTraffic(world, count) {
  const rand = createRandom(world.seed + 77);
  for (let i = 0; i < count; i++) {
    const car = spawnTrafficCar(rand, world);
    // Keep traffic off the player's spawn so the first frame is clean.
    if (Math.hypot(car.x - world.player.x, car.y - world.player.y) < 220) continue;
    world.traffic.push(car);
  }
}

// -- Traffic update -----------------------------------------------------------

export function updateTraffic(world, dt) {
  const { traffic } = world;
  for (const car of traffic) {
    // Target speed: cruise, slowed by the car ahead and by red lights.
    let target = car.cruise;
    const ahead = carAhead(world, car);
    if (ahead !== null && ahead < 78) target = Math.min(target, Math.max(0, (ahead - 46) * 2.2));
    const light = lightAhead(world, car);
    if (light === 'red' && light !== null) target = 0;
    else if (light === 'amber') target = Math.min(target, 60);

    car.speed += Math.max(-260, Math.min(160, target - car.speed)) * dt;
    if (car.speed < 0) car.speed = 0;
    car.brakeLight = target < car.speed - 20;

    // Move along the road.
    const dx = Math.cos(car.angle) * car.speed * dt;
    const dy = Math.sin(car.angle) * car.speed * dt;
    car.x += dx;
    car.y += dy;

    // Wrap around the far edge so the streets never run dry.
    if (car.x < -80) car.x = WORLD_W + 70;
    if (car.x > WORLD_W + 80) car.x = -70;
    if (car.y < -80) car.y = WORLD_H + 70;
    if (car.y > WORLD_H + 80) car.y = -70;

    // A traffic car that drifted into water or a building gets towed back.
    if (isInWater(car.x, car.y)) {
      const fresh = spawnTrafficCar(world.rand, world);
      car.x = fresh.x; car.y = fresh.y; car.angle = fresh.angle;
      car.axis = fresh.axis; car.road = fresh.road; car.dir = fresh.dir;
    }
  }
  // Keep the streets busy: top the traffic back up near the player.
  if (traffic.length < world.trafficTarget) {
    const car = spawnTrafficCar(world.rand, world);
    traffic.push(car);
  }
}

// Distance to the nearest car ahead in the same lane, or null.
function carAhead(world, car) {
  let best = null;
  for (const other of world.traffic) {
    if (other === car) continue;
    if (other.axis !== car.axis || other.road !== car.road || other.dir !== car.dir) continue;
    const along = car.axis === 'h' ? (other.x - car.x) * car.dir : (other.y - car.y) * car.dir;
    const lateral = car.axis === 'h' ? Math.abs(other.y - car.y) : Math.abs(other.x - car.x);
    if (along > 0 && along < 130 && lateral < 26) {
      if (best === null || along < best) best = along;
    }
  }
  // The player's car counts as traffic to everyone else.
  const pc = world.playerCar;
  if (pc && pc.axis === car.axis && pc.road === car.road && pc.dir === car.dir) {
    const along = car.axis === 'h' ? (pc.x - car.x) * car.dir : (pc.y - car.y) * car.dir;
    const lateral = car.axis === 'h' ? Math.abs(pc.y - car.y) : Math.abs(pc.x - car.x);
    if (along > 0 && along < 130 && lateral < 26 && (best === null || along < best)) best = along;
  }
  return best;
}

// Is there a red light at the next intersection ahead of this car?
function lightAhead(world, car) {
  const state = lightForAxis(world.time, car.axis);
  if (state === 'green') return null;
  // Distance to the next intersection centreline ahead.
  const roads = car.axis === 'v' ? H_ROADS : V_ROADS;
  const pos = car.axis === 'v' ? car.y : car.x;
  for (const r of roads) {
    const d = (r - pos) * car.dir;
    if (d > 0 && d < ROAD_HALF + 70) return state;
  }
  return null;
}

// -- Player driving -----------------------------------------------------------

export function drivePlayerCar(world, dt, input) {
  const car = world.playerCar;
  if (!car) return;
  const up = input.keys.has('up') || input.keys.has('KeyW') || input.keys.has('ArrowUp');
  const down = input.keys.has('down') || input.keys.has('KeyS') || input.keys.has('ArrowDown');
  const left = input.keys.has('left') || input.keys.has('KeyA') || input.keys.has('ArrowLeft');
  const right = input.keys.has('right') || input.keys.has('KeyD') || input.keys.has('ArrowRight');
  const handbrake = input.keys.has('Space');

  const forward = Math.cos(car.angle);
  const sideways = Math.sin(car.angle);

  if (up) car.speed += car.accel * dt;
  if (down) {
    if (car.speed > 12) car.speed -= DRIVING.brake * dt;
    else car.speed -= DRIVING.reverseAccel * dt;
  }
  if (!up && !down) {
    // Coast down with drag.
    car.speed -= car.speed * DRIVING.drag * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  if (handbrake) {
    car.speed -= car.speed * 3.2 * dt;
    world.skids.push({ x: car.x, y: car.y, angle: car.angle, life: 5 });
    if (Math.abs(car.speed) > 120 && world.rand() < 0.3) world.audio.skid();
  }
  car.speed = Math.max(-DRIVING.maxReverse, Math.min(car.topSpeed, car.speed));

  // Steering bites harder the faster the car goes, and reverses when reversing.
  const steerInput = (left ? -1 : 0) + (right ? 1 : 0);
  const speedFactor = Math.min(1, Math.abs(car.speed) / 160);
  car.angle += steerInput * DRIVING.steerRate * speedFactor * dt * (car.speed >= 0 ? 1 : -1);
  if (handbrake) car.angle += steerInput * 1.1 * speedFactor * dt;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = nx;
  car.y = ny;

  // World bounds and water: the beach sand slows the car, the sea stops it.
  car.x = Math.max(30, Math.min(WORLD_W - 30, car.x));
  car.y = Math.max(30, Math.min(WORLD_H - 30, car.y));
  if (isInWater(car.x, car.y)) {
    car.x -= Math.cos(car.angle) * car.speed * dt;
    car.y -= Math.sin(car.angle) * car.speed * dt;
    car.speed *= -0.3;
  }
  const hitBuilding = collideBuildings(car, car.w / 2, world.city.buildings);
  if (hitBuilding && Math.abs(car.speed) > 150) {
    world.audio.crash();
    world.addParticles(car.x, car.y, 10, '#ffb347');
    car.speed *= 0.35;
    world.shake = Math.min(10, Math.abs(car.speed) * 0.02);
  }

  // Bump traffic cars apart.
  for (const other of world.traffic) {
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    const min = (car.w + other.w) / 2 - 6;
    if (d > 0.01 && d < min) {
      const push = (min - d) / 2;
      const ux = dx / d;
      const uy = dy / d;
      other.x += ux * push;
      other.y += uy * push;
      car.x -= ux * push * 0.4;
      car.y -= uy * push * 0.4;
      if (Math.abs(car.speed) > 120) {
        world.audio.crash();
        world.addParticles(other.x, other.y, 8, '#ffd27a');
        other.speed *= 0.5;
        car.speed *= 0.7;
      }
    }
  }

  // Dust and exhaust while moving fast.
  if (Math.abs(car.speed) > 200 && world.rand() < 0.35) {
    world.addParticles(
      car.x - forward * car.w * 0.6 + (world.rand() - 0.5) * 10,
      car.y - sideways * car.w * 0.6 + (world.rand() - 0.5) * 10,
      1, '#c9c2b2',
    );
  }
  // Keep a rough road/axis record so traffic can read the player's car.
  car.road = nearestRoadValue(car);
  car.axis = Math.abs(Math.cos(car.angle)) > Math.abs(Math.sin(car.angle)) ? 'h' : 'v';
  car.dir = car.axis === 'h' ? (Math.cos(car.angle) >= 0 ? 1 : -1) : (Math.sin(car.angle) >= 0 ? 1 : -1);
}

function nearestRoadValue(car) {
  let best = V_ROADS[0];
  let bestD = Infinity;
  for (const r of V_ROADS) {
    const d = Math.abs(car.x - r);
    if (d < bestD) { bestD = d; best = r; }
  }
  for (const r of H_ROADS) {
    const d = Math.abs(car.y - r);
    if (d < bestD) { bestD = d; best = r; }
  }
  return best;
}

// Find the closest stealable car to a point (parked cars, then slow traffic).
export function nearestStealableCar(world, x, y, maxDist = 78) {
  let best = null;
  let bestD = maxDist;
  const consider = (car) => {
    if (car === world.playerCar) return;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  };
  for (const car of world.parkedCars) consider(car);
  for (const car of world.traffic) {
    if (Math.abs(car.speed) < 60) consider(car);
  }
  return best;
}
