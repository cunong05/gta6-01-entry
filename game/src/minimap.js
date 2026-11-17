// Solmar Bay — the minimap: a live bird's-eye view of the city in the corner
// of the screen, with the player, the police, traffic and the mission marker.

import { WORLD_W, WORLD_H, V_ROADS, H_ROADS, ROAD_HALF } from './config.js';
import { missionMarker } from './missions.js';

export function drawMinimap(ctx, world, x, y, w, h) {
  const sx = w / WORLD_W;
  const sy = h / WORLD_H;
  ctx.save();
  // Frame.
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 4.5, y - 4.5, w + 9, h + 9);
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Land: green suburbs, blue sea at the edges.
  ctx.fillStyle = '#3f6b34';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(x, y + (2290 * sy), w, h - 2290 * sy);
  ctx.fillRect(x, y, 140 * sx, h);
  ctx.fillStyle = '#e0c98f';
  ctx.fillRect(x, y + (2050 * sy), w, (2290 - 2050) * sy);

  // Downtown blocks in a darker shade.
  ctx.fillStyle = '#54606e';
  ctx.fillRect(x + 1150 * sx, y + 750 * sy, 1000 * sx, 1000 * sy);

  // Roads.
  ctx.strokeStyle = '#3c3f45';
  ctx.lineWidth = Math.max(2, ROAD_HALF * 2 * sx);
  for (const vx of V_ROADS) {
    ctx.beginPath();
    ctx.moveTo(x + vx * sx, y);
    ctx.lineTo(x + vx * sx, y + h);
    ctx.stroke();
  }
  for (const hy of H_ROADS) {
    ctx.beginPath();
    ctx.moveTo(x, y + hy * sy);
    ctx.lineTo(x + w, y + hy * sy);
    ctx.stroke();
  }

  // Spray Shop and safehouse.
  ctx.fillStyle = '#ff9ad5';
  ctx.fillRect(x + 1150 * sx - 2, y + 1150 * sy - 2, 5, 5);
  ctx.fillStyle = '#7dff8a';
  ctx.fillRect(x + 2430 * sx - 2, y + 330 * sy - 2, 5, 5);

  // Traffic as faint grey dots.
  ctx.fillStyle = 'rgba(220,220,210,0.85)';
  for (const car of world.traffic) {
    ctx.fillRect(x + car.x * sx - 1, y + car.y * sy - 1, 3, 3);
  }

  // Mission marker: a pulsing yellow diamond.
  const marker = missionMarker(world);
  if (marker) {
    const pulse = 3 + Math.sin(world.time * 6) * 1.5;
    const mx = x + marker.x * sx;
    const my = y + marker.y * sy;
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.moveTo(mx, my - pulse - 3);
    ctx.lineTo(mx + pulse + 3, my);
    ctx.lineTo(mx, my + pulse + 3);
    ctx.lineTo(mx - pulse - 3, my);
    ctx.closePath();
    ctx.fill();
  }

  // Police as red dots.
  ctx.fillStyle = '#ff4a3a';
  for (const car of world.policeCars) {
    ctx.beginPath();
    ctx.arc(x + car.x * sx, y + car.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const cop of world.cops) {
    ctx.fillRect(x + cop.x * sx - 1.5, y + cop.y * sy - 1.5, 3, 3);
  }

  // Enemies as orange dots.
  ctx.fillStyle = '#ff8a3a';
  for (const enemy of world.enemies) {
    ctx.beginPath();
    ctx.arc(x + enemy.x * sx, y + enemy.y * sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // The player: a white arrow that turns with them.
  const p = world.playerCar || world.player;
  const px = x + p.x * sx;
  const py = y + p.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.restore();

  // Label.
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR BAY', x, y + h + 14);
  ctx.restore();
}
