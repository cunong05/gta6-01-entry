// Combat: the pistol (mouse aim, limited ammo), the punch (Space, close range),
// and the pickups scattered around the city (cash, ammo, health). Bullets fly,
// spark on walls, and hurt pedestrians, cops, guards and the chase target.
import { BULLET, PICKUPS, PLAYER } from './config.js';

export function createCombat() {
  return { bullets: [], pickups: [], punchTimer: 0, shootTimer: 0 };
}

/** Fire one pistol round from (x, y) toward an angle. Returns false when out of ammo. */
export function shoot(combat, state, x, y, angle) {
  const player = state.player;
  if (combat.shootTimer > 0 || player.ammo <= 0) return false;
  combat.shootTimer = 0.22;
  player.ammo -= 1;
  combat.bullets.push({
    x: x + Math.cos(angle) * 20,
    y: y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * BULLET.speed,
    vy: Math.sin(angle) * BULLET.speed,
    life: BULLET.life,
    fromPlayer: true,
    active: true,
  });
  state.audio.shoot();
  state.spawnParticles(x + Math.cos(angle) * 26, y + Math.sin(angle) * 26, 4, '#ffd23f', 90);
  return true;
}

/** A punch: hits the nearest hostile or walker inside the arc in front of the player. */
export function punch(combat, state) {
  const player = state.player;
  if (combat.punchTimer > 0) return false;
  combat.punchTimer = 0.35;
  state.audio.punch();
  const px = player.x;
  const py = player.y;
  const angle = player.angle;
  function inArc(target, range) {
    const dx = target.x - px;
    const dy = target.y - py;
    const dist = Math.hypot(dx, dy);
    if (dist > range) return false;
    let diff = Math.atan2(dy, dx) - angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) < PLAYER.punchArc;
  }
  let hit = false;
  for (const cop of state.police.cops) {
    if (cop.active && inArc(cop, PLAYER.punchRange + 14)) {
      cop.hp -= PLAYER.punchDamage;
      if (cop.hp <= 0) cop.active = false;
      hit = true;
    }
  }
  for (const guard of state.missions.guards) {
    if (guard.active && inArc(guard, PLAYER.punchRange + 14)) {
      guard.hp -= PLAYER.punchDamage;
      if (guard.hp <= 0) {
        guard.active = false;
        state.missions.kills += 1;
      }
      hit = true;
    }
  }
  for (const ped of state.peds) {
    if (ped.active && inArc(ped, PLAYER.punchRange + 12)) {
      ped.active = false;
      state.knockPed(ped);
      hit = true;
      break;
    }
  }
  if (hit) state.spawnParticles(px + Math.cos(angle) * 26, py + Math.sin(angle) * 26, 6, '#ffffff', 120);
  return hit;
}

/** Scatter the city's pickups: cash, ammo and health, near roads and landmarks. */
export function spawnPickups(combat, city, random) {
  const spots = [];
  for (let i = 0; i < 14; i += 1) {
    const road = city.nearestRoad(200 + random() * 3200, 200 + random() * 2200);
    const x = road.x + (random() - 0.5) * 160;
    const y = road.y + (random() - 0.5) * 160;
    if (city.isWater(x, y)) continue;
    const kind = i % 3 === 0 ? 'cash' : i % 3 === 1 ? 'ammo' : 'health';
    spots.push({ x, y, kind, bob: random() * Math.PI * 2, active: true });
  }
  combat.pickups = spots;
}

/** Move bullets, test hits, and let the player collect pickups. */
export function updateCombat(combat, state, dt) {
  combat.shootTimer = Math.max(0, combat.shootTimer - dt);
  combat.punchTimer = Math.max(0, combat.punchTimer - dt);
  const player = state.player;
  for (const bullet of combat.bullets) {
    if (!bullet.active) continue;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.life <= 0) { bullet.active = false; continue; }
    const hitWall = state.city.resolveCircle({ x: bullet.x, y: bullet.y }, BULLET.radius);
    if (hitWall) {
      bullet.active = false;
      state.spawnParticles(bullet.x, bullet.y, 5, '#ffb03a', 110);
      continue;
    }
    if (bullet.fromPlayer) {
      let done = false;
      for (const cop of state.police.cops) {
        if (cop.active && Math.hypot(cop.x - bullet.x, cop.y - bullet.y) < 16) {
          cop.hp -= BULLET.damage;
          if (cop.hp <= 0) {
            cop.active = false;
            state.addWanted(2);
          }
          bullet.active = false;
          done = true;
          break;
        }
      }
      if (done) continue;
      for (const guard of state.missions.guards) {
        if (guard.active && Math.hypot(guard.x - bullet.x, guard.y - bullet.y) < 16) {
          guard.hp -= BULLET.damage;
          if (guard.hp <= 0) {
            guard.active = false;
            state.missions.kills += 1;
          }
          bullet.active = false;
          done = true;
          break;
        }
      }
      if (done) continue;
      const target = state.missions.targetCar;
      if (target && target.active && Math.hypot(target.x - bullet.x, target.y - bullet.y) < 26) {
        target.hp -= BULLET.damage;
        state.spawnParticles(bullet.x, bullet.y, 6, '#ff8a3d', 130);
        bullet.active = false;
        continue;
      }
      for (const ped of state.peds) {
        if (ped.active && Math.hypot(ped.x - bullet.x, ped.y - bullet.y) < 14) {
          ped.active = false;
          state.knockPed(ped);
          bullet.active = false;
          break;
        }
      }
    } else if (Math.hypot(player.x - bullet.x, player.y - bullet.y) < 16) {
      // A guard's bullet found the player.
      bullet.active = false;
      state.damagePlayer(BULLET.damage * 0.6, 'tembakan');
    }
  }
  combat.bullets = combat.bullets.filter((b) => b.active);

  // Pickups: walk over one to collect it.
  for (const pickup of combat.pickups) {
    if (!pickup.active) continue;
    pickup.bob += dt * 3;
    if (Math.hypot(player.x - pickup.x, player.y - pickup.y) < 30) {
      pickup.active = false;
      if (pickup.kind === 'cash') {
        player.money += PICKUPS.cash.value;
        state.showMessage(`+$${PICKUPS.cash.value} uang jalanan`);
      } else if (pickup.kind === 'ammo') {
        player.ammo += PICKUPS.ammo.amount;
        state.showMessage(`+${PICKUPS.ammo.amount} peluru`);
      } else {
        player.health = Math.min(100, player.health + PICKUPS.health.amount);
        state.showMessage(`+${PICKUPS.health.amount} nyawa`);
      }
      state.audio.pickup();
    }
  }
}
