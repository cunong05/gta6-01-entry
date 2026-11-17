// Solmar Bay — pedestrians: ordinary people walking the sidewalks, who stop
// to chat, cross at the corners, and run away from gunfire and speeding cars.

import { WORLD_W, WORLD_H, V_ROADS, H_ROADS, ROAD_HALF } from './config.js';
import { createRandom } from './random.js';
import { collideBuildings } from './city.js';

const SHIRT_COLORS = ['#d96a4f', '#4f8fc9', '#7ab648', '#c9a24f', '#8a5fc9', '#e0e0d8', '#4fc9b8', '#c95f8a'];
const SKIN_COLORS = ['#e8b98a', '#c98a5a', '#8a5a34', '#f0cba0', '#6b4226'];

export function makePedestrian(rand, x, y) {
  return {
    x, y,
    angle: rand() * Math.PI * 2,
    speed: 34 + rand() * 30,
    shirt: SHIRT_COLORS[Math.floor(rand() * SHIRT_COLORS.length)],
    skin: SKIN_COLORS[Math.floor(rand() * SKIN_COLORS.length)],
    walkPhase: rand() * Math.PI * 2,
    // Behaviour: 'walk' along a road, 'idle' chatting, 'flee' from danger.
    state: 'walk',
    stateTimer: 4 + rand() * 8,
    axis: rand() < 0.5 ? 'v' : 'h',
    dir: rand() < 0.5 ? 1 : -1,
    road: 0,
    panic: 0,
  };
}

// Spawn a pedestrian on a sidewalk beside a random road.
export function spawnPedestrian(rand) {
  const vertical = rand() < 0.5;
  let x, y;
  if (vertical) {
    const road = V_ROADS[Math.floor(rand() * V_ROADS.length)];
    x = road + (rand() < 0.5 ? ROAD_HALF + 10 : -(ROAD_HALF + 10));
    y = rand() * WORLD_H;
  } else {
    const road = H_ROADS[Math.floor(rand() * H_ROADS.length)];
    y = road + (rand() < 0.5 ? ROAD_HALF + 10 : -(ROAD_HALF + 10));
    x = rand() * WORLD_W;
  }
  const ped = makePedestrian(rand, x, y);
  ped.axis = vertical ? 'v' : 'h';
  ped.road = vertical ? x : y;
  return ped;
}

export function spawnPedestrians(world, count) {
  const rand = createRandom(world.seed + 131);
  for (let i = 0; i < count; i++) {
    const ped = spawnPedestrian(rand);
    if (Math.hypot(ped.x - world.player.x, ped.y - world.player.y) < 180) continue;
    world.peds.push(ped);
  }
}

export function updatePedestrians(world, dt) {
  const { player, playerCar } = world;
  for (const ped of world.peds) {
    ped.stateTimer -= dt;
    ped.walkPhase += dt * (ped.state === 'walk' ? 8 : 2);

    // Danger: gunshots, a speeding car, or a nearby fight make people run.
    const threat = nearestThreat(world, ped);
    if (threat && ped.state !== 'flee') {
      ped.state = 'flee';
      ped.stateTimer = 2.5;
      ped.panic = 1;
      // Run directly away from the threat.
      ped.angle = Math.atan2(ped.y - threat.y, ped.x - threat.x);
    }

    if (ped.state === 'flee') {
      const speed = 210;
      ped.x += Math.cos(ped.angle) * speed * dt;
      ped.y += Math.sin(ped.angle) * speed * dt;
      if (ped.stateTimer <= 0) {
        ped.state = 'walk';
        ped.stateTimer = 4 + world.rand() * 6;
        // Resume walking along the nearest road.
        const vertical = world.rand() < 0.5;
        ped.axis = vertical ? 'v' : 'h';
        ped.dir = world.rand() < 0.5 ? 1 : -1;
        ped.angle = vertical ? (ped.dir === 1 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir === 1 ? 0 : Math.PI);
      }
    } else if (ped.state === 'walk') {
      const speed = ped.speed;
      if (ped.axis === 'v') {
        ped.y += ped.dir * speed * dt;
        ped.angle = ped.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
        if (ped.y < 60 || ped.y > WORLD_H - 60) ped.dir *= -1;
        // At an intersection, sometimes turn onto the crossing road.
        if (ped.stateTimer <= 0 && nearIntersection(ped.x, ped.y)) {
          ped.axis = 'h';
          ped.dir = world.rand() < 0.5 ? 1 : -1;
          ped.stateTimer = 6 + world.rand() * 8;
        }
      } else {
        ped.x += ped.dir * speed * dt;
        ped.angle = ped.dir === 1 ? 0 : Math.PI;
        if (ped.x < 60 || ped.x > WORLD_W - 60) ped.dir *= -1;
        if (ped.stateTimer <= 0 && nearIntersection(ped.x, ped.y)) {
          ped.axis = 'v';
          ped.dir = world.rand() < 0.5 ? 1 : -1;
          ped.stateTimer = 6 + world.rand() * 8;
        }
      }
      // Occasionally stop to idle for a moment.
      if (ped.stateTimer <= 0 && world.rand() < 0.25) {
        ped.state = 'idle';
        ped.stateTimer = 2 + world.rand() * 4;
      }
    } else if (ped.state === 'idle') {
      if (ped.stateTimer <= 0) {
        ped.state = 'walk';
        ped.stateTimer = 5 + world.rand() * 7;
      }
    }

    // Keep pedestrians out of buildings and water.
    collideBuildings(ped, 12, world.city.buildings);
    ped.x = Math.max(20, Math.min(WORLD_W - 20, ped.x));
    ped.y = Math.max(20, Math.min(WORLD_H - 20, ped.y));

    // A fast car hitting a pedestrian knocks them down: a crime, and a scene.
    if (playerCar && Math.abs(playerCar.speed) > 90) {
      const d = Math.hypot(ped.x - playerCar.x, ped.y - playerCar.y);
      if (d < 30) {
        world.hitPedestrian(ped);
      }
    }
  }

  // Keep the sidewalks populated near the player.
  if (world.peds.length < world.pedTarget) {
    world.peds.push(spawnPedestrian(world.rand));
  }
}

function nearIntersection(x, y) {
  for (const vx of V_ROADS) {
    for (const hy of H_ROADS) {
      if (Math.abs(x - vx) < 70 && Math.abs(y - hy) < 70) return true;
    }
  }
  return false;
}

// The nearest thing a pedestrian should run from, or null.
function nearestThreat(world, ped) {
  const { player, playerCar } = world;
  // Recent gunfire.
  if (world.lastShotAt && world.time - world.lastShotAt < 1.2) {
    const d = Math.hypot(ped.x - world.lastShotX, ped.y - world.lastShotY);
    if (d < 320) return { x: world.lastShotX, y: world.lastShotY };
  }
  // A speeding car bearing down.
  if (playerCar && Math.abs(playerCar.speed) > 120) {
    const d = Math.hypot(ped.x - playerCar.x, ped.y - playerCar.y);
    if (d < 130) return { x: playerCar.x, y: playerCar.y };
  }
  // The player swinging fists.
  if (player && player.attacking) {
    const d = Math.hypot(ped.x - player.x, ped.y - player.y);
    if (d < 90) return { x: player.x, y: player.y };
  }
  return null;
}
