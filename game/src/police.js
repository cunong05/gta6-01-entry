// The wanted system and the police who answer it. Stars 0-5: the higher the level,
// the more police cars and foot cops spawn, the faster they are and the harder they
// hit. Police cars chase and ram; foot cops run the player down on foot. The heat
// cools slowly when no crime happens out of sight, and the Spray Shop clears it
// at once — for cash.
import { CAR, POLICE, WANTED, WORLD } from './config.js';
import { createCar } from './vehicles.js';

function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createPolice() {
  return {
    wanted: 0,
    cars: [],
    cops: [],
    decayTimer: 0,
    spawnTimer: 0,
    sirenNear: false,
  };
}

/** Raise the wanted level, capped at 5. Returns the new level. */
export function addWanted(police, amount) {
  police.wanted = Math.min(WANTED.max, police.wanted + amount);
  police.decayTimer = 0;
  return police.wanted;
}

/** How many police cars / foot cops this wanted level calls for. */
export function wantedForce(wanted) {
  if (wanted <= 0) return { cars: 0, cops: 0 };
  if (wanted === 1) return { cars: 1, cops: 1 };
  if (wanted === 2) return { cars: 2, cops: 2 };
  if (wanted === 3) return { cars: 3, cops: 3 };
  if (wanted === 4) return { cars: 4, cops: 5 };
  return { cars: 5, cops: 7 };
}

function spawnPointNear(player, random, distance) {
  const angle = random() * Math.PI * 2;
  let x = player.x + Math.cos(angle) * distance;
  let y = player.y + Math.sin(angle) * distance;
  x = Math.max(180, Math.min(WORLD.width - 60, x));
  y = Math.max(40, Math.min(WORLD.height - 40, y));
  return { x, y };
}

/** A foot cop: runs at the player and punches when close. */
function createCop(x, y) {
  return { x, y, speed: 235, hp: 50, punchTimer: 0, active: true };
}

/** Spawn and steer the police for this wanted level. */
export function updatePolice(police, state, dt, random) {
  const player = state.player;
  const wanted = police.wanted;
  const force = wantedForce(wanted);
  police.sirenNear = false;

  // Cool down: no crime and no police close by for a while drops a star.
  if (wanted > 0) {
    const nearest = nearestPoliceDistance(police, player);
    if (nearest > 420) {
      police.decayTimer += dt;
      if (police.decayTimer >= WANTED.decaySeconds) {
        police.wanted -= 1;
        police.decayTimer = 0;
      }
    } else {
      police.decayTimer = 0;
    }
  }

  // Spawn to fill the force, a little at a time so they arrive in waves.
  police.spawnTimer -= dt;
  if (police.spawnTimer <= 0) {
    police.spawnTimer = 1.2;
    if (police.cars.length < force.cars) {
      const p = spawnPointNear(player, random, POLICE.spawnDistance);
      const car = createCar('police', p.x, p.y, Math.atan2(player.y - p.y, player.x - p.x), '#2f6fd0');
      car.speed = 200;
      police.cars.push(car);
    } else if (police.cops.length < force.cops && !player.inCar) {
      const p = spawnPointNear(player, random, POLICE.spawnDistance * 0.7);
      police.cops.push(createCop(p.x, p.y));
    }
  }

  // Police cars: steer toward the player and ram.
  for (const car of police.cars) {
    if (!car.active) continue;
    const target = Math.atan2(player.y - car.y, player.x - car.x);
    const turn = Math.max(-3.2 * dt, Math.min(3.2 * dt, angleDiff(car.angle, target)));
    car.angle += turn;
    const maxSpeed = Math.min(500, 380 + wanted * 30);
    car.speed += Math.max(-500 * dt, Math.min(420 * dt, maxSpeed - car.speed));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.siren = (car.siren + dt) % 1;
    state.city.clampWorld(car, CAR.radius);
    if (Math.hypot(player.x - car.x, player.y - car.y) < 900) police.sirenNear = true;
    // Ram the player's car (or the player on foot) on contact: one shove per
    // cooldown, not a slowdown every frame (that pinned the player forever).
    car.ramTimer = Math.max(0, (car.ramTimer ?? 0) - dt);
    const dist = Math.hypot(player.x - car.x, player.y - car.y);
    if (dist < CAR.radius + (player.inCar ? CAR.radius : 16)) {
      if (car.ramTimer <= 0) {
        car.ramTimer = 1.2;
        state.damagePlayer(5, 'polisi');
        if (player.inCar) {
          player.inCar.speed *= 0.9;
          player.inCar.x += Math.cos(car.angle) * 24;
          player.inCar.y += Math.sin(car.angle) * 24;
        }
        car.speed *= 0.7;
      }
    }
    // Police stay on the roads like everyone else (no cutting through buildings).
    if (state.city.resolveCircle(car, CAR.radius)) car.speed *= 0.8;
  }

  // Police cars keep a little distance from each other so they never stack.
  for (let i = 0; i < police.cars.length; i += 1) {
    for (let j = i + 1; j < police.cars.length; j += 1) {
      const a = police.cars[i];
      const b = police.cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.01 && dist < 50) {
        const push = (50 - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }

  // Foot cops: run at the player, punch up close, give up when the heat is gone.
  for (const cop of police.cops) {
    if (!cop.active) continue;
    if (wanted === 0 || player.inCar) {
      cop.active = false;
      continue;
    }
    const dist = Math.hypot(player.x - cop.x, player.y - cop.y);
    const target = Math.atan2(player.y - cop.y, player.x - cop.x);
    cop.x += Math.cos(target) * cop.speed * dt;
    cop.y += Math.sin(target) * cop.speed * dt;
    cop.punchTimer -= dt;
    if (dist < 30 && cop.punchTimer <= 0) {
      cop.punchTimer = 0.8;
      state.damagePlayer(POLICE.copPunchDamage, 'polisi');
    }
    if (dist > 1400) cop.active = false;
  }
  police.cars = police.cars.filter((c) => c.active && Math.hypot(c.x - player.x, c.y - player.y) < 2200);
  police.cops = police.cops.filter((c) => c.active);
}

function nearestPoliceDistance(police, player) {
  let best = Infinity;
  for (const car of police.cars) best = Math.min(best, Math.hypot(car.x - player.x, car.y - player.y));
  for (const cop of police.cops) best = Math.min(best, Math.hypot(cop.x - player.x, cop.y - player.y));
  return best;
}

/** The Spray Shop: drive in with wanted stars and cash to wipe the slate clean. */
export function sprayShopPrice(wanted) {
  return wanted * WANTED.sprayCostPerStar;
}
