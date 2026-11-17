// Solmar Bay — the wanted system: stars, patrol cars and foot officers who
// chase the player, and the Spray Shop that washes the heat away for cash.

import { WANTED, SPRAY_SHOP, WORLD_W, WORLD_H } from './config.js';
import { createRandom } from './random.js';
import { makeCar } from './vehicles.js';
import { collideBuildings, pointInRect } from './city.js';

export function starsOf(world) {
  return world.wantedStars;
}

export function addHeat(world, amount, reason) {
  world.heat = Math.min(WANTED.maxStars, world.heat + amount);
  const stars = Math.ceil(world.heat);
  if (stars > world.wantedStars) {
    world.wantedStars = stars;
    world.message(`WANTED LEVEL ${stars} — the Solmar Bay PD is on you!`, 3.5);
    world.audio.sirenStart();
    if (reason) world.lastCrime = reason;
  }
}

export function clearWanted(world) {
  world.heat = 0;
  world.wantedStars = 0;
  world.policeCars = [];
  world.cops = [];
  world.audio.sirenStop();
}

export function updateWanted(world, dt) {
  // Heat cools slowly when no officer can see the player.
  const seen = policeCanSeePlayer(world);
  if (!seen && world.wantedStars > 0) {
    world.heat -= WANTED.decayPerSecond * dt;
    if (world.heat <= 0) {
      world.heat = 0;
      world.wantedStars = 0;
      world.message('You lost them. The heat is off — for now.', 3);
      world.audio.sirenStop();
    } else {
      const stars = Math.ceil(world.heat);
      if (stars < world.wantedStars) {
        world.wantedStars = stars;
        if (stars === 0) world.audio.sirenStop();
      }
    }
  }
  if (world.wantedStars === 0 && world.policeCars.length === 0 && world.cops.length === 0) {
    world.audio.sirenStop();
  }

  // Keep the right number of pursuers on the street for the current stars.
  const wantCars = world.wantedStars * WANTED.policeCarPerStar;
  const wantCops = world.wantedStars * WANTED.footCopPerStar;
  if (world.wantedStars > 0) {
    while (world.policeCars.length < wantCars) spawnPoliceCar(world);
    while (world.cops.length < wantCops) spawnFootCop(world);
  }
  while (world.policeCars.length > wantCars) world.policeCars.pop();
  while (world.cops.length > wantCops) world.cops.pop();

  updatePoliceCars(world, dt);
  updateFootCops(world, dt);
  updateSprayShop(world, dt);
}

function policeCanSeePlayer(world) {
  const { player } = world;
  for (const car of world.policeCars) {
    if (Math.hypot(car.x - player.x, car.y - player.y) < 560) return true;
  }
  for (const cop of world.cops) {
    if (Math.hypot(cop.x - player.x, cop.y - player.y) < 420) return true;
  }
  return false;
}

function spawnPoliceCar(world) {
  const { player } = world;
  // Appear on a road a little way off, so they drive in with sirens.
  const angle = world.rand() * Math.PI * 2;
  const dist = 700 + world.rand() * 300;
  const x = Math.max(120, Math.min(WORLD_W - 120, player.x + Math.cos(angle) * dist));
  const y = Math.max(120, Math.min(WORLD_H - 120, player.y + Math.sin(angle) * dist));
  const car = makeCar(x, y, 0, 0, { isPolice: true, color: '#20242c', cruise: 300 });
  car.topSpeed = 380 + world.wantedStars * 18;
  car.accel = 320;
  car.speed = 200;
  world.policeCars.push(car);
}

function spawnFootCop(world) {
  const { player } = world;
  const angle = world.rand() * Math.PI * 2;
  const dist = 260 + world.rand() * 160;
  world.cops.push({
    x: Math.max(40, Math.min(WORLD_W - 40, player.x + Math.cos(angle) * dist)),
    y: Math.max(40, Math.min(WORLD_H - 40, player.y + Math.sin(angle) * dist)),
    angle: 0,
    speed: 150 + world.wantedStars * 12,
    grabTimer: 0,
    walkPhase: world.rand() * 6,
  });
}

function updatePoliceCars(world, dt) {
  const { player, playerCar } = world;
  const target = playerCar || player;
  const aggression = 1 + world.wantedStars * 0.25;
  for (const car of world.policeCars) {
    const dx = target.x - car.x;
    const dy = target.y - car.y;
    const dist = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    // Steer toward the player, with a little wobble so they feel human.
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.4, Math.min(2.4, diff * 2.2)) * dt;
    // Ram speed: faster when far, easing off when close so they bump, not orbit.
    const desired = dist > 260 ? car.topSpeed * aggression : dist > 90 ? 240 : 150;
    car.speed += Math.max(-420, Math.min(300, desired - car.speed)) * dt;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    collideBuildings(car, car.w / 2, world.city.buildings);
    car.x = Math.max(30, Math.min(WORLD_W - 30, car.x));
    car.y = Math.max(30, Math.min(WORLD_H - 30, car.y));

    // Ramming the player hurts: on foot it knocks health down, in a car it
    // shoves the car and rattles the camera.
    if (playerCar) {
      const d = Math.hypot(car.x - playerCar.x, car.y - playerCar.y);
      if (d < 46) {
        const push = 60;
        playerCar.x += Math.cos(car.angle) * push * dt * 4;
        playerCar.y += Math.sin(car.angle) * push * dt * 4;
        playerCar.speed *= 0.94;
        world.shake = Math.min(9, world.shake + 2);
        if (world.rand() < 0.2) world.audio.crash();
      }
    } else {
      const d = Math.hypot(car.x - player.x, car.y - player.y);
      if (d < 34) {
        world.damagePlayer(12 * dt * 4, 'rammed by a patrol car');
      }
    }
  }
}

function updateFootCops(world, dt) {
  const { player } = world;
  for (const cop of world.cops) {
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.hypot(dx, dy) || 1;
    cop.angle = Math.atan2(dy, dx);
    cop.walkPhase += dt * 10;
    if (dist > 26) {
      cop.x += (dx / dist) * cop.speed * dt;
      cop.y += (dy / dist) * cop.speed * dt;
      cop.grabTimer = 0;
    } else {
      // Close enough to grab: hold on and the bust timer runs.
      cop.grabTimer += dt;
      world.damagePlayer(6 * dt, 'caught by an officer');
      if (cop.grabTimer > 1.6 && !world.playerCar) {
        world.busted();
        return;
      }
    }
    collideBuildings(cop, 12, world.city.buildings);
  }
}

// Driving into the Spray Shop with cash washes the stars away.
function updateSprayShop(world, dt) {
  if (!world.playerCar || world.wantedStars === 0) return;
  const car = world.playerCar;
  if (!pointInRect(car.x, car.y, SPRAY_SHOP)) return;
  const cost = world.wantedStars * WANTED.sprayCostPerStar;
  if (world.money < cost) {
    if (!world.sprayWarned) {
      world.message(`Spray Shop: $${cost} to clear ${world.wantedStars} star${world.wantedStars > 1 ? 's' : ''} — you are short!`, 3);
      world.sprayWarned = true;
    }
    return;
  }
  world.money -= cost;
  world.playerCar.color = randomPaint(world);
  clearWanted(world);
  world.message(`Fresh paint, clean slate. -$${cost}. The cops lost your trail.`, 3.5);
  world.audio.cash();
  world.addParticles(car.x, car.y, 16, '#ff9ad5');
  world.sprayWarned = false;
  world.saveGame();
}

function randomPaint(world) {
  const paints = ['#c94f43', '#4f8fc9', '#7ab648', '#e8b93a', '#8a2f6d', '#4fc9b8', '#d8d3c4'];
  return paints[Math.floor(world.rand() * paints.length)];
}
