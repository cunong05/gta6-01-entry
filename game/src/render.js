// The renderer: paints the city, everything in it, the day-night tint, the HUD,
// the minimap and the four screens (title, play, paused, game over). It owns the
// canvas and the camera scale, and nothing else owns drawing.
//
// Revision notes (this session): headlight cones for the player's and police cars
// after dark, tracer lines for bullets (from their previous position), the Downtown
// plaza with its fountain, and small red/green traffic-light dots at intersections
// so the light state is visible in the world, not just felt.

import { FONT, PALETTE, ROADS, WORLD } from './config.js';
import { currentStage, totalRewards } from './missions.js';
import { drawHUD } from './hud.js';
import { drawMinimap } from './minimap.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_STORY = 4;

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  /** Daylight factor 0..1 and tint colour for the time of day. */
  function daylight(dayTime) {
    // 0 dawn, 0.25 noon, 0.5 dusk, 0.75 night, 1 dawn again.
    if (dayTime < 0.2) return { light: 0.55 + dayTime * 2, tint: 'rgba(255,180,120,0.10)' };
    if (dayTime < 0.45) return { light: 1, tint: null };
    if (dayTime < 0.6) return { light: 0.9, tint: 'rgba(255,140,60,0.14)' };
    if (dayTime < 0.8) return { light: 0.45, tint: 'rgba(20,30,70,0.35)' };
    return { light: 0.6 + (dayTime - 0.8) * 2, tint: 'rgba(255,170,110,0.08)' };
  }

  function drawGround(state, view) {
    const city = state.city;
    const { x0, y0, x1, y1 } = view;
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Harbour water (west) and open sea (east edge).
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(x0, y0, Math.max(0, city.waterWest - x0), y1 - y0);
    ctx.fillRect(Math.max(x0, WORLD.width - 40), y0, x1 - Math.max(x0, WORLD.width - 40), y1 - y0);
    ctx.fillStyle = PALETTE.deepWater;
    ctx.fillRect(x0, y0, Math.max(0, city.waterWest - 60 - x0), y1 - y0);
    // Beach sand.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(Math.max(x0, city.sandEast), y0, x1 - Math.max(x0, city.sandEast), y1 - y0);
    // Parks.
    ctx.fillStyle = PALETTE.park;
    for (const park of city.parks) {
      if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
      ctx.fillRect(park.x, park.y, park.w, park.h);
    }
    // Plazas (paved squares) with a fountain in the middle.
    for (const plaza of city.plazas) {
      if (plaza.x > x1 || plaza.x + plaza.w < x0 || plaza.y > y1 || plaza.y + plaza.h < y0) continue;
      ctx.fillStyle = PALETTE.plaza;
      ctx.fillRect(plaza.x, plaza.y, plaza.w, plaza.h);
      const fx = plaza.x + plaza.w / 2;
      const fy = plaza.y + plaza.h / 2;
      ctx.fillStyle = '#7a8a94';
      ctx.beginPath();
      ctx.arc(fx, fy, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a9ec9';
      ctx.beginPath();
      ctx.arc(fx, fy, 19, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRoads(state, view) {
    const { x0, y0, x1, y1 } = view;
    const half = ROADS.width / 2;
    const sw = ROADS.sidewalk;
    // Sidewalks (lighter border around each road).
    ctx.fillStyle = PALETTE.sidewalk;
    for (const ax of ROADS.avenues) {
      if (ax + half + sw < x0 || ax - half - sw > x1) continue;
      ctx.fillRect(ax - half - sw, Math.max(y0, 0), ROADS.width + sw * 2, Math.min(y1, WORLD.height) - Math.max(y0, 0));
    }
    for (const sy of ROADS.streets) {
      if (sy + half + sw < y0 || sy - half - sw > y1) continue;
      ctx.fillRect(Math.max(x0, 0), sy - half - sw, Math.min(x1, WORLD.width) - Math.max(x0, 0), ROADS.width + sw * 2);
    }
    // Asphalt.
    ctx.fillStyle = PALETTE.road;
    for (const ax of ROADS.avenues) {
      if (ax + half < x0 || ax - half > x1) continue;
      ctx.fillRect(ax - half, Math.max(y0, 0), ROADS.width, Math.min(y1, WORLD.height) - Math.max(y0, 0));
    }
    for (const sy of ROADS.streets) {
      if (sy + half < y0 || sy - half > y1) continue;
      ctx.fillRect(Math.max(x0, 0), sy - half, Math.min(x1, WORLD.width) - Math.max(x0, 0), ROADS.width);
    }
    // Lane dashes.
    ctx.fillStyle = PALETTE.lane;
    const dash = 26;
    const gap = 30;
    for (const ax of ROADS.avenues) {
      if (ax < x0 || ax > x1) continue;
      for (let y = Math.floor(y0 / (dash + gap)) * (dash + gap); y < y1; y += dash + gap) {
        ctx.fillRect(ax - 2, y, 4, dash);
      }
    }
    for (const sy of ROADS.streets) {
      if (sy < y0 || sy > y1) continue;
      for (let x = Math.floor(x0 / (dash + gap)) * (dash + gap); x < x1; x += dash + gap) {
        ctx.fillRect(x, sy - 2, dash, 4);
      }
    }
    // Crosswalks at intersections.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const ax of ROADS.avenues) {
      for (const sy of ROADS.streets) {
        if (ax < x0 - 60 || ax > x1 + 60 || sy < y0 - 60 || sy > y1 + 60) continue;
        for (let i = -2; i <= 2; i += 1) {
          ctx.fillRect(ax + i * 16 - 5, sy - half - 4, 10, 8);
          ctx.fillRect(ax + i * 16 - 5, sy + half - 4, 10, 8);
        }
      }
    }
  }

  /** A red/green dot at each visible intersection showing the light state. */
  function drawTrafficLights(state, view) {
    const nsGreen = state.city.lightState(state.time) === 'ns';
    for (const light of state.city.lights) {
      if (light.x < view.x0 || light.x > view.x1 || light.y < view.y0 || light.y > view.y1) continue;
      // Phase 0 lights follow the global cycle, phase 1 the opposite.
      const green = light.phase === 0 ? nsGreen : !nsGreen;
      ctx.fillStyle = green ? '#3fd06a' : '#ff4d3d';
      ctx.beginPath();
      ctx.arc(light.x + ROADS.width / 2 + 6, light.y - ROADS.width / 2 - 6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawBuildings(state, view) {
    const { x0, y0, x1, y1 } = view;
    for (const b of state.city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      // Simple drop shadow for height.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 4 + b.height * 2, b.y + 4 + b.height * 2, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      // Rooftop detail: a lighter inner rectangle and a vent block.
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(b.x + b.w / 2 - 8, b.y + b.h / 2 - 6, 16, 12);
    }
  }

  function drawSprayShop(state, view) {
    const shop = state.city.sprayShop;
    if (shop.x > view.x1 || shop.x + shop.w < view.x0 || shop.y > view.y1 || shop.y + shop.h < view.y0) return;
    ctx.fillStyle = '#3a3f46';
    ctx.fillRect(shop.x, shop.y, shop.w, shop.h);
    ctx.fillStyle = PALETTE.sprayShop;
    ctx.fillRect(shop.x, shop.y, shop.w, 14);
    ctx.fillStyle = '#222';
    ctx.font = `700 11px ${FONT}`;
    ctx.fillText('SPRAY SHOP', shop.x + 8, shop.y + 11);
    ctx.fillStyle = '#e8b23a';
    ctx.font = `600 10px ${FONT}`;
    ctx.fillText('$100 / ★ — hapus wanted', shop.x + 6, shop.y + shop.h - 8);
  }

  function drawLampsAndPalms(state, view, night) {
    for (const lamp of state.city.lamps) {
      if (lamp.x < view.x0 || lamp.x > view.x1 || lamp.y < view.y0 || lamp.y > view.y1) continue;
      ctx.fillStyle = '#555';
      ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
      if (night) {
        const glow = ctx.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 60);
        glow.addColorStop(0, 'rgba(255,217,138,0.5)');
        glow.addColorStop(1, 'rgba(255,217,138,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(lamp.x, lamp.y, 60, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const palm of state.city.palms) {
      if (palm.x < view.x0 || palm.x > view.x1 || palm.y < view.y0 || palm.y > view.y1) continue;
      ctx.strokeStyle = '#6d4a2f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(palm.x, palm.y);
      ctx.lineTo(palm.x + 3, palm.y - 10);
      ctx.stroke();
      ctx.fillStyle = '#3f7a3a';
      ctx.beginPath();
      ctx.arc(palm.x + 3, palm.y - 12, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSkids(state) {
    ctx.strokeStyle = 'rgba(20,20,20,0.5)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (const s of state.skids) {
      ctx.globalAlpha = Math.min(0.6, s.life / 7);
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.angle) * 14, s.y - Math.sin(s.angle) * 14);
      ctx.lineTo(s.x + Math.cos(s.angle) * 14, s.y + Math.sin(s.angle) * 14);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** A pale cone of light ahead of a car, drawn only after dark. */
  function drawHeadlight(car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const grad = ctx.createLinearGradient(23, 0, 170, 0);
    grad.addColorStop(0, 'rgba(255,240,180,0.30)');
    grad.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(23, -8);
    ctx.lineTo(170, -46);
    ctx.lineTo(170, 46);
    ctx.lineTo(23, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawCarShape(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRectPath(ctx, -21, -11 + 3, 46, 24, 7);
    ctx.fill();
    // Body.
    ctx.fillStyle = car.color;
    roundRectPath(ctx, -23, -12, 46, 24, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Windshield + rear window.
    ctx.fillStyle = 'rgba(180,220,240,0.85)';
    ctx.fillRect(4, -9, 9, 18);
    ctx.fillRect(-15, -9, 6, 18);
    // Wheels.
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-16, -14, 10, 4);
    ctx.fillRect(-16, 10, 10, 4);
    ctx.fillRect(8, -14, 10, 4);
    ctx.fillRect(8, 10, 10, 4);
    if (car.kind === 'police') {
      // Flashing light bar.
      const phase = Math.floor(car.siren * 4) % 2 === 0;
      ctx.fillStyle = phase ? PALETTE.policeLightRed : PALETTE.policeLightBlue;
      ctx.fillRect(-4, -8, 8, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 8px system-ui, sans-serif';
      ctx.fillText('POLISI', -14, -16);
    }
    if (car.driver === 'marco') {
      ctx.fillStyle = '#ffd23f';
      ctx.font = '700 9px system-ui, sans-serif';
      ctx.fillText('MARCO', -14, -16);
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      roundRectPath(ctx, -25, -14, 50, 28, 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, shirt, skin, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 11 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(6 * scale, 0, 6 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawMarker(state, time) {
    const stage = currentStage(state.missions);
    if (!stage || stage.x === undefined) return;
    const bob = Math.sin(time * 4) * 6;
    ctx.save();
    ctx.translate(stage.x, stage.y + bob - 30);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = PALETTE.marker;
    ctx.fillRect(-11, -11, 22, 22);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-11, -11, 22, 22);
    ctx.restore();
    // Beam of light down to the ground.
    ctx.fillStyle = 'rgba(255,207,63,0.25)';
    ctx.fillRect(stage.x - 3, stage.y - 30 + bob, 6, 30 - bob);
    // Distance readout.
    const dist = Math.round(Math.hypot(state.player.x - stage.x, state.player.y - stage.y));
    ctx.fillStyle = '#fff';
    ctx.font = `700 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${dist}m`, stage.x, stage.y - 52 + bob);
    ctx.textAlign = 'left';
  }

  function drawWorld(state, w, h) {
    const scale = Math.min(w / 1150, h / 750);
    const viewW = w / scale;
    const viewH = h / scale;
    state.viewScale = scale;
    state.viewW = w;
    state.viewH = h;
    const camX = Math.max(viewW / 2, Math.min(WORLD.width - viewW / 2, state.camera.x));
    const camY = Math.max(viewH / 2, Math.min(WORLD.height - viewH / 2, state.camera.y));
    const view = {
      x0: camX - viewW / 2, y0: camY - viewH / 2,
      x1: camX + viewW / 2, y1: camY + viewH / 2,
    };
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-camX, -camY);

    drawGround(state, view);
    drawRoads(state, view);
    drawTrafficLights(state, view);
    drawBuildings(state, view);
    drawSprayShop(state, view);
    drawSkids(state);
    // Pickups.
    for (const pickup of state.combat.pickups) {
      if (!pickup.active) continue;
      const bob = Math.sin(pickup.bob) * 3;
      ctx.save();
      ctx.translate(pickup.x, pickup.y + bob);
      ctx.fillStyle = pickup.kind === 'cash' ? '#7be382' : pickup.kind === 'ammo' ? '#ffd23f' : '#ff6a6a';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#222';
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pickup.kind === 'cash' ? '$' : pickup.kind === 'ammo' ? 'A' : '+', 0, 4);
      ctx.textAlign = 'left';
      ctx.restore();
    }
    // Mission marker.
    drawMarker(state, state.time);
    // Guards.
    for (const guard of state.missions.guards) {
      if (!guard.active) continue;
      drawPerson(guard.x, guard.y, Math.atan2(state.player.y - guard.y, state.player.x - guard.x), '#7a2f2f', '#e8b88a', 1.15);
      ctx.fillStyle = '#3a3f46';
      ctx.fillRect(guard.x - 12, guard.y - 22, 24, 4);
      ctx.fillStyle = '#ff5a4d';
      ctx.fillRect(guard.x - 12, guard.y - 22, 24 * Math.max(0, guard.hp / 60), 4);
    }
    // Pedestrians.
    for (const ped of state.peds) {
      if (!ped.active) continue;
      const bob = Math.sin(ped.walkPhase) * 1.5;
      drawPerson(ped.x, ped.y + bob, [0, Math.PI / 2, Math.PI, -Math.PI / 2][ped.dir], ped.shirt, ped.skin);
    }
    // Cars: traffic, chase target, police.
    for (const car of state.cars) {
      if (!car.active) continue;
      drawCarShape(car, car === state.player.inCar);
    }
    const target = state.missions.targetCar;
    if (target && target.active) {
      drawCarShape(target, false);
      ctx.fillStyle = '#3a3f46';
      ctx.fillRect(target.x - 16, target.y - 30, 32, 5);
      ctx.fillStyle = '#ff5a4d';
      ctx.fillRect(target.x - 16, target.y - 30, 32 * Math.max(0, target.hp / 120), 5);
    }
    for (const car of state.police.cars) {
      if (!car.active) continue;
      drawCarShape(car, false);
    }
    // Police on foot.
    for (const cop of state.police.cops) {
      if (!cop.active) continue;
      drawPerson(cop.x, cop.y, Math.atan2(state.player.y - cop.y, state.player.x - cop.x), '#2f4a7a', '#e8b88a', 1.1);
      ctx.fillStyle = '#2f4a7a';
      ctx.font = '700 8px system-ui, sans-serif';
      ctx.fillText('POLISI', cop.x - 14, cop.y - 16);
    }
    // The player on foot.
    const player = state.player;
    if (!player.inCar) {
      const bob = Math.sin(state.time * 10) * 1;
      drawPerson(player.x, player.y + bob, player.angle, PALETTE.player, '#e8b88a', 1.15);
      ctx.fillStyle = '#fff';
      ctx.font = '700 9px system-ui, sans-serif';
      ctx.fillText('RICO', player.x - 13, player.y - 18);
    }
    // Bullets: a tracer line from the previous position, then the glowing head.
    for (const bullet of state.combat.bullets) {
      ctx.strokeStyle = 'rgba(255,210,63,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bullet.prevX ?? bullet.x, bullet.prevY ?? bullet.y);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Particles.
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    // Headlight cones after dark, for the player's car and the police cars.
    const night = daylight(state.dayTime).light < 0.6;
    if (night) {
      if (player.inCar) drawHeadlight(player.inCar);
      for (const car of state.police.cars) {
        if (car.active) drawHeadlight(car);
      }
    }
    // Lamps and palms (glow pass on top).
    drawLampsAndPalms(state, view, night);

    ctx.restore();

    // Day / night tint over everything.
    const day = daylight(state.dayTime);
    if (day.tint) {
      ctx.fillStyle = day.tint;
      ctx.fillRect(0, 0, w, h);
    }
    // Damage flash.
    if (state.damageFlash > 0) {
      ctx.fillStyle = `rgba(255,40,30,${state.damageFlash * 0.5})`;
      ctx.fillRect(0, 0, w, h);
    }
    // Vignette.
    const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }

  function drawTitle(state, w, h, hasSave) {
    drawWorld(state, w, h);
    ctx.fillStyle = 'rgba(8,12,20,0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = `800 ${Math.round(w * 0.075)}px ${FONT}`;
    ctx.fillText('SOLMAR BAY', w / 2, h * 0.32);
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${Math.round(w * 0.02)}px ${FONT}`;
    ctx.fillText('Kota pesisir. Satu fixer. Enam misi. Tanpa ampun.', w / 2, h * 0.38);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    ctx.fillText('Rico Vega kembali ke Solmar Bay — dan Mama Rosa sudah menunggu.', w / 2, h * 0.43);
    const option = hasSave ? 'ENTER — Lanjutkan cerita' : 'ENTER — Mulai cerita baru';
    ctx.fillStyle = '#fff';
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText(option, w / 2, h * 0.56);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    ctx.fillText('N — Cerita baru dari awal      •      M — Suara on/off', w / 2, h * 0.62);
    ctx.fillText('WASD jalan & mengemudi   •   E curi mobil   •   Klik tembak   •   Spasi pukul   •   P jeda', w / 2, h * 0.68);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `12px ${FONT}`;
    ctx.fillText('Game orisinal — kota, karakter dan cerita fiktif. Bukan GTA, bukan Rockstar.', w / 2, h - 24);
    ctx.textAlign = 'left';
  }

  function drawPaused(state, w, h) {
    drawWorld(state, w, h);
    ctx.fillStyle = 'rgba(8,12,20,0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = `800 54px ${FONT}`;
    ctx.fillText('JEDA', w / 2, h * 0.42);
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('P / Esc — lanjut main      •      Progress tersimpan otomatis', w / 2, h * 0.48);
    ctx.textAlign = 'left';
  }

  function drawOver(state, w, h) {
    drawWorld(state, w, h);
    ctx.fillStyle = 'rgba(20,6,6,0.72)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a4d';
    ctx.font = `800 56px ${FONT}`;
    ctx.fillText('RICO TUMBANG', w / 2, h * 0.38);
    ctx.fillStyle = '#fff';
    ctx.font = `18px ${FONT}`;
    ctx.fillText(`Uang: $${Math.floor(state.player.money)}   •   Misi selesai: ${state.missions.index} dari 6`, w / 2, h * 0.46);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `16px ${FONT}`;
    ctx.fillText('Mama Rosa tidak akan membiarkanmu begitu saja. Bangkit dan coba lagi.', w / 2, h * 0.52);
    ctx.fillStyle = '#fff';
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText('ENTER atau R — Main lagi', w / 2, h * 0.62);
    ctx.textAlign = 'left';
  }

  function drawStory(state, w, h) {
    drawWorld(state, w, h);
    ctx.fillStyle = 'rgba(8,14,10,0.72)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = `800 52px ${FONT}`;
    ctx.fillText('CERITA SELESAI', w / 2, h * 0.34);
    ctx.fillStyle = '#fff';
    ctx.font = `17px ${FONT}`;
    ctx.fillText('Rico menatap matahari terbenam di Teluk Solmar. Uang kas kembali,', w / 2, h * 0.42);
    ctx.fillText('Marco kabur, dan Mama Rosa sudah menyiapkan makan malam.', w / 2, h * 0.46);
    ctx.fillText(`Total hadiah misi: $${totalRewards().toLocaleString('en-US')}   •   Uang akhir: $${Math.floor(state.player.money)}`, w / 2, h * 0.54);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    ctx.fillText('Solmar Bay tetap milik mereka. Terima kasih sudah bermain!', w / 2, h * 0.60);
    ctx.fillStyle = '#fff';
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText('ENTER — Main bebas di kota', w / 2, h * 0.70);
    ctx.textAlign = 'left';
  }

  return {
    /** Paint the current screen. `info` carries save/best flags for the menus. */
    draw(state, screen, info = {}) {
      const { w, h } = resize();
      ctx.clearRect(0, 0, w, h);
      if (screen === SCREEN_TITLE) {
        drawTitle(state, w, h, info.hasSave);
      } else if (screen === SCREEN_PAUSED) {
        drawPaused(state, w, h);
      } else if (screen === SCREEN_OVER) {
        drawOver(state, w, h);
      } else if (screen === SCREEN_STORY) {
        drawStory(state, w, h);
      } else {
        drawWorld(state, w, h);
        drawHUD(ctx, state, w, h);
        drawMinimap(ctx, state, w - 206, h - 156, 192, 142);
        // District label, bottom-right, left of the minimap.
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = `600 13px ${FONT}`;
        ctx.textAlign = 'right';
        ctx.fillText(state.city.districtAt(state.player.x, state.player.y), w - 216, h - 14);
        ctx.textAlign = 'left';
      }
    },
  };
}
