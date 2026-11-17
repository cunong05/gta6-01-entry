// Solmar Bay — the renderer: the whole city drawn on one canvas, with a
// camera that follows the player, a day/dusk/night cycle, streetlight glow,
// skid marks, particles and the mission beacon.

import {
  WORLD_W, WORLD_H, V_ROADS, H_ROADS, ROAD_HALF, HARBOR_WATER_X, BEACH_Y, SEA_Y,
  SPRAY_SHOP, SAFEHOUSE, ROSAS_PLACE, BANK, GARAGE, HARBOR_PIER, COLORS, DAY_LENGTH,
} from './config.js';
import { districtAt } from './config.js';
import { lightForAxis } from './city.js';
import { missionMarker } from './missions.js';

// Lighting from the time of day: 0 = deep night, 1 = full daylight.
export function lightingOf(world) {
  const t = world.dayTime; // 0..1, 0.25 = morning, 0.5 = noon, 0.75 = evening
  const daylight = smoothstep(0.18, 0.28, t) * (1 - smoothstep(0.72, 0.82, t));
  const dusk = Math.max(0, 1 - Math.abs(t - 0.78) / 0.08) * 0.8
    + Math.max(0, 1 - Math.abs(t - 0.22) / 0.08) * 0.5;
  return { daylight, night: 1 - daylight, dusk: Math.min(1, dusk) };
}

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function drawWorld(ctx, world, view) {
  const { player } = world;
  const focus = world.playerCar || player;
  const shakeX = world.shake > 0 ? (world.rand() - 0.5) * world.shake : 0;
  const shakeY = world.shake > 0 ? (world.rand() - 0.5) * world.shake : 0;
  const camX = clamp(focus.x - view.w / 2 + shakeX, 0, WORLD_W - view.w);
  const camY = clamp(focus.y - view.h / 2 + shakeY, 0, WORLD_H - view.h);
  world.camera = { x: camX, y: camY };
  const light = lightingOf(world);

  ctx.save();
  ctx.translate(-camX, -camY);

  drawGround(ctx, world, camX, camY, view);
  drawRoads(ctx, world, camX, camY, view);
  drawLandmarks(ctx, world);
  drawBuildings(ctx, world, camX, camY, view);
  drawTrees(ctx, world, camX, camY, view);
  drawSkids(ctx, world);
  drawPickups(ctx, world);
  drawCars(ctx, world);
  drawPedestrians(ctx, world);
  drawEnemies(ctx, world);
  drawPlayer(ctx, world);
  drawBullets(ctx, world);
  drawParticles(ctx, world);
  drawMissionBeacon(ctx, world);
  drawTrafficLights(ctx, world, camX, camY, view);

  ctx.restore();

  // Day / dusk / night overlay, then streetlight glow on top of the dark.
  if (light.dusk > 0.05) {
    ctx.fillStyle = `rgba(255,110,40,${(light.dusk * 0.16).toFixed(3)})`;
    ctx.fillRect(0, 0, view.w, view.h);
  }
  if (light.night > 0.05) {
    ctx.fillStyle = `rgba(8,12,44,${(light.night * 0.42).toFixed(3)})`;
    ctx.fillRect(0, 0, view.w, view.h);
    if (light.night > 0.35) drawLampGlow(ctx, world, light);
  }
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function visible(ctx, camX, camY, view, x, y, w, h) {
  return x + w >= camX - 60 && x <= camX + view.w + 60 && y + h >= camY - 60 && y <= camY + view.h + 60;
}

// -- Ground -------------------------------------------------------------------

function drawGround(ctx, world, camX, camY, view) {
  // Base grass.
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(camX - 10, camY - 10, view.w + 20, view.h + 20);
  // Mow stripes for a little texture.
  ctx.fillStyle = COLORS.grassDark;
  const stripeH = 90;
  const startY = Math.floor(camY / stripeH) * stripeH;
  for (let y = startY; y < camY + view.h + stripeH; y += stripeH * 2) {
    ctx.fillRect(camX - 10, y, view.w + 20, stripeH);
  }
  // Parks.
  for (const park of world.city.parks) {
    if (!visible(ctx, camX, camY, view, park.x, park.y, park.w, park.h)) continue;
    ctx.fillStyle = COLORS.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
  }
  // Beach sand and sea.
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(camX - 10, BEACH_Y, view.w + 20, SEA_Y - BEACH_Y);
  ctx.fillStyle = COLORS.sea;
  ctx.fillRect(camX - 10, SEA_Y, view.w + 20, WORLD_H - SEA_Y);
  ctx.fillStyle = COLORS.seaDeep;
  ctx.fillRect(camX - 10, HARBOR_WATER_X - 140 < 0 ? 0 : 0, 0, 0);
  // Harbour water on the west edge.
  ctx.fillStyle = COLORS.sea;
  ctx.fillRect(0, camY - 10, HARBOR_WATER_X, view.h + 20);
  // Animated wave lines on the sea.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  const waveOff = (world.time * 24) % 46;
  for (let y = SEA_Y + 18; y < WORLD_H; y += 46) {
    ctx.beginPath();
    for (let x = Math.max(0, camX - 20); x < camX + view.w + 20; x += 60) {
      const wy = y + Math.sin((x + waveOff) * 0.02) * 4;
      if (x === Math.max(0, camX - 20)) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.stroke();
  }
  // Piers into the harbour.
  ctx.fillStyle = '#8a6b48';
  ctx.fillRect(40, HARBOR_PIER.y, 110, HARBOR_PIER.h);
  ctx.fillRect(40, 1400, 110, 26);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  for (let x = 48; x < 150; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, HARBOR_PIER.y);
    ctx.lineTo(x, HARBOR_PIER.y + HARBOR_PIER.h);
    ctx.stroke();
  }
}

// -- Roads ----------------------------------------------------------------------

function drawRoads(ctx, world, camX, camY, view) {
  // Asphalt + sidewalk edges.
  for (const vx of V_ROADS) {
    ctx.fillStyle = COLORS.sidewalk;
    ctx.fillRect(vx - ROAD_HALF - 12, camY - 10, ROAD_HALF * 2 + 24, view.h + 20);
    ctx.fillStyle = COLORS.asphalt;
    ctx.fillRect(vx - ROAD_HALF, camY - 10, ROAD_HALF * 2, view.h + 20);
  }
  for (const hy of H_ROADS) {
    ctx.fillStyle = COLORS.sidewalk;
    ctx.fillRect(camX - 10, hy - ROAD_HALF - 12, view.w + 20, ROAD_HALF * 2 + 24);
    ctx.fillStyle = COLORS.asphalt;
    ctx.fillRect(camX - 10, hy - ROAD_HALF, view.w + 20, ROAD_HALF * 2);
  }
  // Centre dashes.
  ctx.fillStyle = '#e8d44f';
  const dash = 26;
  const gap = 22;
  for (const vx of V_ROADS) {
    const startY = Math.floor(camY / (dash + gap)) * (dash + gap);
    for (let y = startY; y < camY + view.h; y += dash + gap) {
      ctx.fillRect(vx - 2, y, 4, dash);
    }
  }
  for (const hy of H_ROADS) {
    const startX = Math.floor(camX / (dash + gap)) * (dash + gap);
    for (let x = startX; x < camX + view.w; x += dash + gap) {
      ctx.fillRect(x, hy - 2, dash, 4);
    }
  }
  // Crosswalks at intersections.
  ctx.fillStyle = COLORS.crosswalk;
  for (const vx of V_ROADS) {
    for (const hy of H_ROADS) {
      if (!visible(ctx, camX, camY, view, vx - ROAD_HALF, hy - ROAD_HALF, ROAD_HALF * 2, ROAD_HALF * 2)) continue;
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(vx + i * 12 - 4, hy - ROAD_HALF - 4, 8, 10);
        ctx.fillRect(vx + i * 12 - 4, hy + ROAD_HALF - 6, 8, 10);
      }
    }
  }
}

// -- Buildings and landmarks -----------------------------------------------------

function drawBuildings(ctx, world, camX, camY, view) {
  for (const b of world.city.buildings) {
    if (!visible(ctx, camX, camY, view, b.x, b.y, b.w, b.h)) continue;
    // Drop shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 5, b.y + 7, b.w, b.h);
    // Walls and roof.
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    // Roof detail: a lighter inner slab.
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
    // Windows on tall downtown slabs.
    if (b.tall) {
      ctx.fillStyle = 'rgba(20,30,44,0.55)';
      const cols = Math.floor(b.w / 26);
      const rows = Math.floor(b.h / 26);
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if ((b.winSeed + c * 7 + r * 13) % 5 === 0) continue;
          ctx.fillRect(b.x + 10 + c * 26, b.y + 10 + r * 26, 12, 14);
        }
      }
    }
  }
}

function drawLandmarks(ctx, world) {
  drawLandmarkBuilding(ctx, SPRAY_SHOP, '#ff9ad5', 'SPRAY SHOP');
  drawLandmarkBuilding(ctx, SAFEHOUSE, '#7dff8a', 'SAFEHOUSE');
  drawLandmarkBuilding(ctx, ROSAS_PLACE, '#e8b93a', "MAMA ROSA'S");
  drawLandmarkBuilding(ctx, BANK, '#9ab8d8', 'BANK');
  drawLandmarkBuilding(ctx, GARAGE, '#c9a24f', 'CHOP GARAGE');
}

function drawLandmarkBuilding(ctx, spot, color, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(spot.x + 5, spot.y + 7, spot.w, spot.h);
  ctx.fillStyle = color;
  ctx.fillRect(spot.x, spot.y, spot.w, spot.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(spot.x + 1, spot.y + 1, spot.w - 2, spot.h - 2);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, spot.x + spot.w / 2, spot.y + spot.h / 2 + 5);
}

function drawTrees(ctx, world, camX, camY, view) {
  for (const tree of world.city.trees) {
    if (!visible(ctx, camX, camY, view, tree.x - 20, tree.y - 20, 40, 40)) continue;
    if (tree.palm) {
      ctx.strokeStyle = '#7a5a3a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(tree.x, tree.y + 10);
      ctx.lineTo(tree.x + 3, tree.y - 8);
      ctx.stroke();
      ctx.fillStyle = '#3f8a3a';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(tree.x + Math.cos(a) * 10, tree.y - 8 + Math.sin(a) * 7, 12, 5, a, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#2f5e28';
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4c8a3d';
      ctx.beginPath();
      ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// -- Traffic lights -------------------------------------------------------------

function drawTrafficLights(ctx, world, camX, camY, view) {
  for (const vx of V_ROADS) {
    for (const hy of H_ROADS) {
      if (!visible(ctx, camX, camY, view, vx - 60, hy - 60, 120, 120)) continue;
      const ns = lightForAxis(world.time, 'v');
      const ew = lightForAxis(world.time, 'h');
      drawLightPost(ctx, vx + ROAD_HALF + 4, hy - ROAD_HALF - 4, ns);
      drawLightPost(ctx, vx - ROAD_HALF - 4, hy + ROAD_HALF + 4, ew);
    }
  }
}

function drawLightPost(ctx, x, y, state) {
  ctx.fillStyle = '#2c2c30';
  ctx.fillRect(x - 2, y - 12, 4, 12);
  ctx.fillStyle = '#1c1c20';
  ctx.beginPath();
  ctx.arc(x, y - 14, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = state === 'green' ? '#58c96b' : state === 'amber' ? '#e8b93a' : '#d94f43';
  ctx.beginPath();
  ctx.arc(x, y - 14, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawLampGlow(ctx, world, light) {
  const { camera } = world;
  ctx.save();
  for (const lamp of world.city.lamps) {
    const sx = lamp.x - camera.x;
    const sy = lamp.y - camera.y;
    if (sx < -80 || sx > 1360 || sy < -80 || sy > 880) continue;
    const grad = ctx.createRadialGradient(sx, sy, 4, sx, sy, 90);
    grad.addColorStop(0, `rgba(255,214,120,${(0.35 * light.night).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, 90, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// -- Cars, people, effects ---------------------------------------------------------

function drawCarShape(ctx, car, isPlayerCar) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-car.w / 2 + 3, -car.h / 2 + 4, car.w, car.h);
  // Wheels.
  ctx.fillStyle = '#141414';
  const ww = 10;
  const wh = 5;
  ctx.fillRect(-car.w / 2 + 4, -car.h / 2 - 2, ww, wh);
  ctx.fillRect(car.w / 2 - 14, -car.h / 2 - 2, ww, wh);
  ctx.fillRect(-car.w / 2 + 4, car.h / 2 - 3, ww, wh);
  ctx.fillRect(car.w / 2 - 14, car.h / 2 - 3, ww, wh);
  // Body.
  ctx.fillStyle = car.color;
  roundRectPath(ctx, -car.w / 2, -car.h / 2, car.w, car.h, 7);
  ctx.fill();
  if (isPlayerCar) {
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Roof and windshield.
  ctx.fillStyle = 'rgba(20,30,44,0.75)';
  ctx.fillRect(-car.w * 0.12, -car.h / 2 + 3, car.w * 0.24, car.h - 6);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-car.w * 0.12, -car.h / 2 + 3, car.w * 0.24, 4);
  // Headlights.
  ctx.fillStyle = '#fff6c9';
  ctx.fillRect(car.w / 2 - 3, -car.h / 2 + 3, 3, 5);
  ctx.fillRect(car.w / 2 - 3, car.h / 2 - 8, 3, 5);
  // Brake lights.
  if (car.brakeLight) {
    ctx.fillStyle = '#ff2a1a';
    ctx.fillRect(-car.w / 2, -car.h / 2 + 3, 3, 5);
    ctx.fillRect(-car.w / 2, car.h / 2 - 8, 3, 5);
  }
  // Police light bar, flashing red and blue.
  if (car.isPolice) {
    const phase = Math.floor(worldTimeOf(car) * 6) % 2 === 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-car.w * 0.1, -car.h / 2 + 2, car.w * 0.1, car.h - 4);
    ctx.fillStyle = phase ? '#ff2a1a' : '#2a6bff';
    ctx.fillRect(-car.w * 0.22, -car.h / 2 + 2, car.w * 0.1, car.h - 4);
    ctx.fillStyle = phase ? '#2a6bff' : '#ff2a1a';
    ctx.fillRect(-car.w * 0.02, -car.h / 2 + 2, car.w * 0.1, car.h - 4);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
  }
  // The hot gold car of mission 2 gets a marker ring.
  if (car.hot) {
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, car.w * 0.75, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

let worldClock = 0;
function worldTimeOf() {
  return worldClock;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCars(ctx, world) {
  worldClock = world.time;
  for (const car of world.parkedCars) drawCarShape(ctx, car, false);
  for (const car of world.traffic) drawCarShape(ctx, car, false);
  for (const car of world.policeCars) drawCarShape(ctx, car, false);
  if (world.playerCar) drawCarShape(ctx, world.playerCar, true);
}

function drawPerson(ctx, x, y, angle, shirt, skin, walkPhase, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 6, 12 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(angle + Math.PI / 2);
  // Legs, animated.
  const swing = Math.sin(walkPhase) * 4 * scale;
  ctx.fillStyle = '#2c3440';
  ctx.fillRect(-6 * scale, -2 * scale + swing, 4 * scale, 12 * scale);
  ctx.fillRect(2 * scale, -2 * scale - swing, 4 * scale, 12 * scale);
  // Body.
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(0, -2 * scale, 9 * scale, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -6 * scale, 6 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPedestrians(ctx, world) {
  for (const ped of world.peds) {
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.skin, ped.walkPhase);
  }
  for (const cop of world.cops) {
    drawPerson(ctx, cop.x, cop.y, cop.angle, '#20242c', '#e8b98a', cop.walkPhase);
    // Police cap.
    ctx.save();
    ctx.translate(cop.x, cop.y - 6);
    ctx.fillStyle = '#20242c';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd94a';
    ctx.fillRect(-6, -1, 12, 2);
    ctx.restore();
  }
  if (world.passenger && !world.passenger.inCar) {
    const p = world.passenger;
    drawPerson(ctx, p.x, p.y, p.angle || 0, '#e8b93a', '#c98a5a', world.time * 8);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TICO', p.x, p.y - 20);
  }
}

function drawEnemies(ctx, world) {
  for (const enemy of world.enemies) {
    drawPerson(ctx, enemy.x, enemy.y, enemy.angle, '#7a2020', '#e8b98a', enemy.walkPhase);
    // Health bar.
    const w = 30;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(enemy.x - w / 2, enemy.y - 24, w, 5);
    ctx.fillStyle = '#ff5a4a';
    ctx.fillRect(enemy.x - w / 2, enemy.y - 24, w * Math.max(0, enemy.hp / enemy.maxHp), 5);
    // Gun.
    if (enemy.gun) {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(enemy.angle);
      ctx.fillStyle = '#1c1c20';
      ctx.fillRect(6, -1.5, 12, 3);
      ctx.restore();
    }
  }
}

function drawPlayer(ctx, world) {
  if (world.playerCar) return;
  const { player } = world;
  const bob = Math.sin(player.walkPhase) * 1.5;
  // A white ring and a name tag, so the hero reads at a glance among the crowd.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + 8, 16, 7, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('RICO', player.x, player.y - 22);
  ctx.restore();
  drawPerson(ctx, player.x, player.y + bob, player.angle, '#e8c33a', '#e8b98a', player.walkPhase, 1.3);
  // Pistol in hand when armed.
  if (player.weapon === 'pistol') {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.fillStyle = '#1c1c20';
    ctx.fillRect(8, -2, 14, 4);
    ctx.restore();
  }
  // Punch swing arc.
  if (player.attackTimer > 0) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(18, 0, 12, -0.9, 0.9);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBullets(ctx, world) {
  ctx.strokeStyle = '#ffe08a';
  ctx.lineWidth = 2;
  for (const b of world.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawPickups(ctx, world) {
  for (const p of world.pickups) {
    const bob = Math.sin(p.bob) * 3;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    if (p.kind === 'ammo') {
      ctx.fillStyle = '#58c96b';
      ctx.fillRect(-9, -7, 18, 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AMMO', 0, 3);
    } else if (p.kind === 'health') {
      ctx.fillStyle = '#ff5a4a';
      ctx.fillRect(-9, -9, 18, 18);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2, -6, 4, 12);
      ctx.fillRect(-6, -2, 12, 4);
    } else {
      ctx.fillStyle = '#7dff8a';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1c5e24';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 4);
    }
    ctx.restore();
  }
}

function drawParticles(ctx, world) {
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSkids(ctx, world) {
  ctx.save();
  ctx.strokeStyle = 'rgba(20,20,20,0.4)';
  ctx.lineWidth = 5;
  for (const s of world.skids) {
    ctx.globalAlpha = Math.max(0, s.life / 5) * 0.7;
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 12, s.y - Math.sin(s.angle) * 12);
    ctx.lineTo(s.x + Math.cos(s.angle) * 12, s.y + Math.sin(s.angle) * 12);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawMissionBeacon(ctx, world) {
  const marker = missionMarker(world);
  if (!marker) return;
  const bounce = Math.sin(world.time * 5) * 6;
  const { x, y } = marker;
  // A beam of light down to the marker.
  const grad = ctx.createLinearGradient(x, y - 180, x, y);
  grad.addColorStop(0, 'rgba(255,217,74,0)');
  grad.addColorStop(1, 'rgba(255,217,74,0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - 14, y - 180, 28, 180);
  // The diamond.
  ctx.save();
  ctx.translate(x, y - 40 + bounce);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#ffd94a';
  ctx.fillRect(-11, -11, 22, 22);
  ctx.strokeStyle = '#7a5a10';
  ctx.lineWidth = 2;
  ctx.strokeRect(-11, -11, 22, 22);
  ctx.restore();
  // Ground ring.
  ctx.strokeStyle = 'rgba(255,217,74,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, y, 34 + Math.sin(world.time * 4) * 4, 12, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Label.
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(marker.label.toUpperCase(), x, y - 58 + bounce);
}
