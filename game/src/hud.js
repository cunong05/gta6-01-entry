// Solmar Bay — the HUD and the screens: money, health, wanted stars, weapon,
// mission objective, messages, dialogues, and the title / pause / game-over
// overlays. Everything is drawn on the main canvas, no DOM menus.

import { currentObjective, currentMission, missionCount } from './missions.js';

export function drawHUD(ctx, world, view) {
  const { player } = world;
  const w = view.w;
  const h = view.h;

  // --- Top left: health bar and wanted stars -------------------------------
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, 16, 14, 210, 26, 6);
  ctx.fill();
  ctx.fillStyle = player.health > 50 ? '#58c96b' : player.health > 25 ? '#e8b93a' : '#d94f43';
  const hpW = Math.max(0, (player.health / 100) * 196);
  roundRect(ctx, 23, 20, hpW, 14, 4);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`RICO  ${Math.ceil(player.health)}`, 28, 31);

  // Wanted stars.
  const stars = world.wantedStars;
  for (let i = 0; i < 5; i++) {
    const sx = 26 + i * 26;
    const sy = 62;
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillStyle = i < stars ? '#ffd94a' : 'rgba(255,255,255,0.25)';
    ctx.fillText('\u2605', sx, sy);
  }
  if (stars > 0) {
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#ffb347';
    ctx.fillText(world.wantedStars >= 3 ? 'THE PD IS HUNTING YOU' : 'WANTED', 24, 84);
  }

  // --- Top right: money ------------------------------------------------------
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, w - 196, 14, 180, 34, 6);
  ctx.fill();
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(`$${world.money.toLocaleString('en-US')}`, w - 28, 40);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(`earned $${world.totalEarned.toLocaleString('en-US')}`, w - 28, 66);

  // --- Mission objective, top centre ----------------------------------------
  const objective = currentObjective(world);
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px system-ui, sans-serif';
  const ow = ctx.measureText(objective).width + 28;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, (w - ow) / 2, 14, ow, 28, 6);
  ctx.fill();
  ctx.fillStyle = '#ffd94a';
  ctx.fillText(objective, w / 2, 33);
  const mission = currentMission(world);
  if (mission) {
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(`MISSION ${mission.id + 1}/${missionCount()} — ${mission.title}  ·  $${mission.reward}`, w / 2, 58);
  }

  // --- Bottom left: weapon / ammo / speed ------------------------------------
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, 16, h - 58, 190, 42, 6);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  if (world.playerCar) {
    const speedKmh = Math.round(Math.abs(world.playerCar.speed) * 0.45);
    ctx.fillText(`${world.playerCar.name.toUpperCase()}  ${speedKmh} km/h`, 28, h - 34);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('E — exit car   ·   Space — handbrake', 28, h - 20);
  } else {
    const weapon = player.weapon === 'pistol' ? 'PISTOL' : 'FISTS';
    ctx.fillText(`${weapon}   ${player.weapon === 'pistol' ? `Ammo ${player.ammo}` : ''}`, 28, h - 34);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('Click / Space — shoot   ·   1/2 — weapon   ·   E — steal car', 28, h - 20);
  }

  // --- Steal prompt -----------------------------------------------------------
  if (world.nearCar && !world.playerCar) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const label = `Press E to steal the ${world.nearCar.name}`;
    const lw = ctx.measureText(label).width + 30;
    roundRect(ctx, (w - lw) / 2, h - 118, lw, 30, 6);
    ctx.fill();
    ctx.fillStyle = '#ffd94a';
    ctx.fillText(label, w / 2, h - 98);
  }

  // --- Messages ---------------------------------------------------------------
  ctx.textAlign = 'center';
  let my = h - 150;
  for (const msg of world.messages) {
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const mw = ctx.measureText(msg.text).width + 24;
    roundRect(ctx, (w - mw) / 2, my - 20, mw, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(msg.text, w / 2, my - 1);
    my -= 32;
  }

  // --- District name flash ------------------------------------------------------
  if (world.districtFlash > 0) {
    ctx.textAlign = 'center';
    ctx.globalAlpha = Math.min(1, world.districtFlash);
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 8;
    ctx.fillText(world.districtName, w / 2, 110);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // --- Dialogue panel -------------------------------------------------------------
  if (world.dialog) drawDialog(ctx, world, view);
  ctx.restore();
}

function drawDialog(ctx, world, view) {
  const { dialog } = world;
  const line = dialog.lines[dialog.index];
  const w = view.w;
  const h = view.h;
  const pw = Math.min(760, w - 80);
  const ph = 108;
  const px = (w - pw) / 2;
  const py = h - ph - 76;
  ctx.save();
  ctx.fillStyle = 'rgba(10,12,20,0.88)';
  roundRect(ctx, px, py, pw, ph, 10);
  ctx.fill();
  ctx.strokeStyle = '#ffd94a';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(dialog.speaker, px + 20, py + 26);
  ctx.fillStyle = '#ffffff';
  ctx.font = '15px system-ui, sans-serif';
  wrapText(ctx, line, px + 20, py + 52, pw - 40, 20);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '12px system-ui, sans-serif';
  const more = dialog.index < dialog.lines.length - 1 ? 'ENTER \u25B8 next' : 'ENTER \u25B8 continue';
  ctx.fillText(more, px + pw - 16, py + ph - 12);
  ctx.restore();
}

export function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// -- Screens ------------------------------------------------------------------

export function drawTitleScreen(ctx, world, view, hasSave) {
  const w = view.w;
  const h = view.h;
  ctx.save();
  // Warm dusk gradient over the city backdrop.
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(20,16,48,0.55)');
  grad.addColorStop(0.6, 'rgba(20,16,48,0.25)');
  grad.addColorStop(1, 'rgba(8,8,20,0.72)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('A N   O P E N - W O R L D   C R I M E   G A M E', w / 2, h * 0.2);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 18;
  ctx.fillText('SOLMAR BAY', w / 2, h * 0.2 + 88);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'italic 20px system-ui, sans-serif';
  ctx.fillText('Six jobs. One city. No rules but yours.', w / 2, h * 0.2 + 124);

  // Menu card.
  const cw = 460;
  const ch = hasSave ? 250 : 210;
  const cx = (w - cw) / 2;
  const cy = h * 0.52;
  ctx.fillStyle = 'rgba(8,10,22,0.82)';
  roundRect(ctx, cx, cy, cw, ch, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,217,74,0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 19px system-ui, sans-serif';
  let lineY = cy + 44;
  ctx.fillText('ENTER — New game', w / 2, lineY);
  if (hasSave) {
    lineY += 38;
    ctx.fillText('C — Continue saved game', w / 2, lineY);
  }
  lineY += 44;
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('WASD / Arrows — move & drive      E — steal / exit car', w / 2, lineY);
  lineY += 24;
  ctx.fillText('Mouse / Space — shoot      1 / 2 — weapon      P — pause', w / 2, lineY);
  lineY += 24;
  ctx.fillText('M — mute      Reach the yellow marker to work for Mama Rosa', w / 2, lineY);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('An original game. Solmar Bay, Rico Vega and Mama Rosa are fictional — no part of any commercial game.', w / 2, h - 24);
  ctx.restore();
}

export function drawPauseScreen(ctx, world, view) {
  const w = view.w;
  const h = view.h;
  ctx.save();
  ctx.fillStyle = 'rgba(6,8,18,0.66)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('PAUSED', w / 2, h * 0.4);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('P — resume      M — mute      R — restart from save', w / 2, h * 0.4 + 44);
  ctx.fillText(`Money $${world.money}   ·   Mission ${Math.min(world.missionIndex + 1, missionCount())}/${missionCount()}   ·   ${world.wantedStars} star${world.wantedStars === 1 ? '' : 's'}`, w / 2, h * 0.4 + 76);
  ctx.restore();
}

export function drawGameOverScreen(ctx, world, view) {
  const w = view.w;
  const h = view.h;
  ctx.save();
  ctx.fillStyle = 'rgba(10,4,6,0.78)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = world.endReason === 'busted' ? '#7fb2ff' : '#ff5a4a';
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.fillText(world.endReason === 'busted' ? 'BUSTED!' : 'WASTED', w / 2, h * 0.38);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(world.endReason === 'busted'
    ? 'The Solmar Bay PD caught Rico. The story pauses here — for now.'
    : 'Rico went down in the streets of Solmar Bay.', w / 2, h * 0.38 + 42);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`Money $${world.money}   ·   Earned $${world.totalEarned}   ·   Missions done ${world.missionIndex}/${missionCount()}`, w / 2, h * 0.38 + 84);
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillText('ENTER — try again from your last save', w / 2, h * 0.38 + 130);
  ctx.restore();
}

export function drawWinScreen(ctx, world, view) {
  const w = view.w;
  const h = view.h;
  ctx.save();
  ctx.fillStyle = 'rgba(8,14,8,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 60px system-ui, sans-serif';
  ctx.fillText('STORY COMPLETE', w / 2, h * 0.36);
  ctx.fillStyle = '#ffffff';
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText('Rico Vega pulled the big score. Solmar Bay is his now.', w / 2, h * 0.36 + 44);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`Total earned $${world.totalEarned.toLocaleString('en-US')}   ·   All ${missionCount()} missions complete`, w / 2, h * 0.36 + 80);
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText('ENTER — keep roaming Solmar Bay free', w / 2, h * 0.36 + 124);
  ctx.restore();
}
