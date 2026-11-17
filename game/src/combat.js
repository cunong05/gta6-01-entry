// Solmar Bay — combat: fists, a pistol, bullets, armed thugs, and the
// pickups they drop. Shooting is mouse-aimed on foot; Space fires too.

import { PLAYER } from './config.js';
import { collideBuildings } from './city.js';
import { addHeat } from './police.js';

export function spawnEnemy(world, x, y, opts = {}) {
  const enemy = {
    x, y,
    angle: 0,
    hp: opts.hp || 60,
    maxHp: opts.hp || 60,
    gun: !!opts.gun,
    speed: 120 + world.rand() * 30,
    shootTimer: 1 + world.rand(),
    walkPhase: world.rand() * 6,
    state: 'chase',
  };
  world.enemies.push(enemy);
  return enemy;
}

export function spawnPickup(world, x, y, kind) {
  world.pickups.push({ x, y, kind, bob: world.rand() * 6 });
}

export function playerPunch(world) {
  const { player } = world;
  if (player.punchTimer > 0 || world.playerCar) return;
  player.punchTimer = PLAYER.punchCooldown;
  player.attacking = true;
  player.attackTimer = 0.18;
  world.audio.punch();
  const reach = PLAYER.punchRange + 14;
  const cx = player.x + Math.cos(player.angle) * reach;
  const cy = player.y + Math.sin(player.angle) * reach;
  // Enemies first, then pedestrians (a crime), then nothing but air.
  for (const enemy of world.enemies) {
    if (Math.hypot(enemy.x - cx, enemy.y - cy) < 34) {
      damageEnemy(world, enemy, PLAYER.punchDamage);
      world.addParticles(enemy.x, enemy.y, 6, '#ffd27a');
      return;
    }
  }
  for (const ped of world.peds) {
    if (Math.hypot(ped.x - cx, ped.y - cy) < 30) {
      world.peds.splice(world.peds.indexOf(ped), 1);
      world.addParticles(ped.x, ped.y, 8, '#ff6a5a');
      addHeat(world, 1, 'assaulted a pedestrian');
      world.message('That was a civilian! The cops saw that.', 3);
      return;
    }
  }
}

export function playerShoot(world, targetX, targetY) {
  const { player } = world;
  if (world.playerCar) return;
  if (player.shootTimer > 0) return;
  if (player.weapon !== 'pistol') {
    playerPunch(world);
    return;
  }
  if (player.ammo <= 0) {
    world.message('Out of ammo! Find a green ammo box.', 2.5);
    world.audio.click();
    player.shootTimer = 0.3;
    return;
  }
  player.shootTimer = PLAYER.pistolCooldown;
  player.ammo -= 1;
  const angle = Math.atan2(targetY - player.y, targetX - player.x);
  player.angle = angle;
  world.bullets.push({
    x: player.x + Math.cos(angle) * 20,
    y: player.y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * 720,
    vy: Math.sin(angle) * 720,
    fromPlayer: true,
    damage: PLAYER.pistolDamage,
    life: 1.2,
  });
  world.lastShotX = player.x;
  world.lastShotY = player.y;
  world.lastShotAt = world.time;
  world.audio.gunshot();
  world.addParticles(player.x + Math.cos(angle) * 24, player.y + Math.sin(angle) * 24, 3, '#ffe08a');
  addHeat(world, 0.25, 'fired a gun in public');
}

export function damageEnemy(world, enemy, amount) {
  enemy.hp -= amount;
  if (enemy.hp <= 0) {
    const idx = world.enemies.indexOf(enemy);
    if (idx >= 0) world.enemies.splice(idx, 1);
    world.addParticles(enemy.x, enemy.y, 14, '#ff6a5a');
    world.audio.crash();
    // Thugs drop cash and sometimes ammo.
    const cash = 30 + Math.floor(world.rand() * 40);
    world.money += cash;
    world.message(`Thug down. +$${cash} looted.`, 2.5);
    if (world.rand() < 0.5) spawnPickup(world, enemy.x + 12, enemy.y + 8, 'ammo');
    addHeat(world, 0.5, 'shot a thug in self-defence');
  }
}

export function updateBullets(world, dt) {
  for (let i = world.bullets.length - 1; i >= 0; i--) {
    const b = world.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    // Walls stop bullets.
    for (const building of world.city.buildings) {
      if (b.x >= building.x && b.x <= building.x + building.w && b.y >= building.y && b.y <= building.y + building.h) {
        world.addParticles(b.x, b.y, 4, '#c9c2b2');
        dead = true;
        break;
      }
    }
    if (dead) { world.bullets.splice(i, 1); continue; }
    if (b.fromPlayer) {
      for (const enemy of [...world.enemies]) {
        if (Math.hypot(enemy.x - b.x, enemy.y - b.y) < 18) {
          damageEnemy(world, enemy, b.damage);
          dead = true;
          break;
        }
      }
      if (dead) { world.bullets.splice(i, 1); continue; }
      // A stray round can hit a pedestrian: a crime with witnesses.
      for (const ped of [...world.peds]) {
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
          world.peds.splice(world.peds.indexOf(ped), 1);
          world.addParticles(ped.x, ped.y, 8, '#ff6a5a');
          addHeat(world, 1, 'shot a pedestrian');
          dead = true;
          break;
        }
      }
      if (dead) { world.bullets.splice(i, 1); }
    } else {
      const { player } = world;
      if (!world.playerCar && Math.hypot(player.x - b.x, player.y - b.y) < 15) {
        world.damagePlayer(b.damage * 0.6, 'shot by a thug');
        world.bullets.splice(i, 1);
      }
    }
  }
}

export function updateEnemies(world, dt) {
  const { player } = world;
  const target = world.playerCar || player;
  for (const enemy of [...world.enemies]) {
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    enemy.angle = Math.atan2(dy, dx);
    enemy.walkPhase += dt * 9;
    enemy.shootTimer -= dt;
    if (dist > 260) {
      // Too far: walk toward the player.
      enemy.x += (dx / dist) * enemy.speed * dt;
      enemy.y += (dy / dist) * enemy.speed * dt;
    } else if (dist < 120) {
      // Too close: back off a little and shoot.
      enemy.x -= (dx / dist) * enemy.speed * 0.4 * dt;
      enemy.y -= (dy / dist) * enemy.speed * 0.4 * dt;
    }
    if (enemy.gun && enemy.shootTimer <= 0 && dist < 420 && !world.playerCar) {
      enemy.shootTimer = 1.1 + world.rand() * 0.8;
      const spread = (world.rand() - 0.5) * 0.22;
      const angle = enemy.angle + spread;
      world.bullets.push({
        x: enemy.x + Math.cos(angle) * 20,
        y: enemy.y + Math.sin(angle) * 20,
        vx: Math.cos(angle) * 560,
        vy: Math.sin(angle) * 560,
        fromPlayer: false,
        damage: 14,
        life: 1.4,
      });
      world.audio.enemyShot();
      world.addParticles(enemy.x + Math.cos(angle) * 24, enemy.y + Math.sin(angle) * 24, 3, '#ffe08a');
    }
    // Melee range: thugs punch.
    if (dist < 30 && !world.playerCar) {
      world.damagePlayer(14 * dt, 'beaten by a thug');
    }
    collideBuildings(enemy, 13, world.city.buildings);
  }
}

export function updatePickups(world, dt) {
  const { player } = world;
  const target = world.playerCar || player;
  for (let i = world.pickups.length - 1; i >= 0; i--) {
    const p = world.pickups[i];
    p.bob += dt * 3;
    if (Math.hypot(p.x - target.x, p.y - target.y) < 34) {
      if (p.kind === 'ammo') {
        player.ammo += 24;
        world.message('Ammo +24', 2);
      } else if (p.kind === 'health') {
        player.health = Math.min(100, player.health + 35);
        world.message('Health +35', 2);
      } else if (p.kind === 'cash') {
        world.money += 50;
        world.message('Cash +$50', 2);
      }
      world.audio.pickup();
      world.pickups.splice(i, 1);
    }
  }
}
