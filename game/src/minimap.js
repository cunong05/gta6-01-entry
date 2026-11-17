// The minimap: the whole city shrunk into the corner — roads, water, the beach,
// the Spray Shop, the mission marker, the player, traffic and police. North is up.
import { PALETTE, WORLD } from './config.js';
import { currentStage } from './missions.js';

export function drawMinimap(ctx, state, x, y, w, h) {
  const city = state.city;
  const sx = w / WORLD.width;
  const sy = h / WORLD.height;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  // Ground.
  ctx.fillStyle = '#2c4a26';
  ctx.fillRect(x, y, w, h);
  // Water west, beach east.
  ctx.fillStyle = '#2f7fa8';
  ctx.fillRect(x, y, city.waterWest * sx, h);
  ctx.fillRect(x + (WORLD.width - 40) * sx, y, 40 * sx, h);
  ctx.fillStyle = '#e0c98f';
  ctx.fillRect(x + city.sandEast * sx, y, (WORLD.width - city.sandEast) * sx, h);
  // Roads.
  ctx.fillStyle = '#6d7278';
  for (const ax of state.roads.avenues) ctx.fillRect(x + ax * sx - 2, y, 4, h);
  for (const sy2 of state.roads.streets) ctx.fillRect(x, y + sy2 * sy - 2, w, 4);
  // Spray Shop.
  ctx.fillStyle = PALETTE.sprayShop;
  ctx.fillRect(x + city.sprayShop.x * sx - 3, y + city.sprayShop.y * sy - 3, 6, 6);
  // Mission marker.
  const stage = currentStage(state.missions);
  if (stage && stage.x !== undefined) {
    ctx.fillStyle = '#ffcf3f';
    ctx.beginPath();
    ctx.arc(x + stage.x * sx, y + stage.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Police.
  ctx.fillStyle = '#2f7fff';
  for (const car of state.police.cars) {
    ctx.fillRect(x + car.x * sx - 2, y + car.y * sy - 2, 4, 4);
  }
  // Player arrow.
  const player = state.player;
  ctx.save();
  ctx.translate(x + player.x * sx, y + player.y * sy);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  // Frame + label.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '600 10px system-ui, sans-serif';
  ctx.fillText('SOLMAR BAY', x + 6, y + 12);
}
