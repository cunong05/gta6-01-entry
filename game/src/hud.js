// The HUD: money and health top-left, wanted stars top-right, weapon and ammo
// bottom-left, the mission objective top-centre, speed while driving, the dialog
// box, and short toast messages. Drawn in screen space, after the world.
//
// Revision notes (this session): the objective panel now shows a thin progress bar
// for stages with measurable progress (wait / survive / kill / chase) via
// objectiveProgress(), and low health (<30) pulses a red vignette so the danger is
// impossible to miss.

import { FONT, PALETTE } from './config.js';
import { objectiveProgress, objectiveText } from './missions.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.panel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

function drawStars(ctx, wanted, x, y, size) {
  for (let i = 0; i < 5; i += 1) {
    ctx.font = `${size}px ${FONT}`;
    ctx.fillStyle = i < wanted ? '#ffd23f' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', x + i * (size + 2), y);
  }
}

export function drawHUD(ctx, state, screenW, screenH) {
  const player = state.player;
  const missions = state.missions;
  ctx.textBaseline = 'alphabetic';

  // Low-health pulse: a red edge that breathes while Rico is close to down.
  if (player.health <= 30 && player.health > 0) {
    const pulse = 0.10 + 0.08 * Math.sin(state.time * 6);
    const grad = ctx.createRadialGradient(
      screenW / 2, screenH / 2, Math.min(screenW, screenH) * 0.35,
      screenW / 2, screenH / 2, Math.max(screenW, screenH) * 0.7,
    );
    grad.addColorStop(0, 'rgba(255,40,30,0)');
    grad.addColorStop(1, `rgba(255,40,30,${pulse})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, screenW, screenH);
  }

  // Money + health, top-left.
  panel(ctx, 14, 12, 210, 72);
  ctx.fillStyle = PALETTE.money;
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText(`$${Math.floor(player.money)}`, 28, 40);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 11px ${FONT}`;
  ctx.fillText('NYAWA', 28, 62);
  ctx.fillStyle = '#3a3f46';
  ctx.fillRect(72, 52, 138, 10);
  ctx.fillStyle = player.health > 30 ? '#5ad06a' : PALETTE.danger;
  ctx.fillRect(72, 52, 138 * Math.max(0, player.health / 100), 10);

  // Wanted stars, top-right.
  panel(ctx, screenW - 224, 12, 210, 44);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 11px ${FONT}`;
  ctx.fillText(state.police.wanted >= 5 ? 'WANTED — BURON' : 'WANTED', screenW - 210, 30);
  drawStars(ctx, state.police.wanted, screenW - 148, 42, 22);

  // Objective, top-centre, with a progress bar when the stage is measurable.
  const objective = objectiveText(missions);
  const progress = objectiveProgress(missions);
  ctx.font = `600 14px ${FONT}`;
  const ow = Math.min(screenW - 480, ctx.measureText(objective).width + 28);
  const oh = progress === null ? 34 : 42;
  panel(ctx, (screenW - ow) / 2, 12, ow, oh);
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(objective, (screenW - ow) / 2 + 14, 34);
  if (progress !== null) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect((screenW - ow) / 2 + 14, 40, ow - 28, 4);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect((screenW - ow) / 2 + 14, 40, (ow - 28) * progress, 4);
  }

  // Weapon + ammo, bottom-left.
  panel(ctx, 14, screenH - 58, 200, 44);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 16px ${FONT}`;
  const weapon = player.weapon === 'pistol' ? 'PISTOL' : 'TINJU';
  ctx.fillText(weapon, 28, screenH - 30);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText(player.weapon === 'pistol' ? `Ammo ${player.ammo}  (1/2 ganti)` : 'Spasi = pukul', 96, screenH - 30);

  // Speed while driving, bottom-centre.
  if (player.inCar) {
    const kmh = Math.round(Math.abs(player.inCar.speed) * 0.36);
    panel(ctx, screenW / 2 - 70, screenH - 58, 140, 44);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 24px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${kmh}`, screenW / 2 - 14, screenH - 28);
    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('km/h', screenW / 2 + 34, screenH - 28);
    ctx.textAlign = 'left';
  }

  // Dialog box, bottom-centre above the speed panel.
  if (missions.dialog) {
    const text = missions.dialog.text;
    ctx.font = `15px ${FONT}`;
    const lines = wrapText(ctx, text, screenW - 360);
    const dh = 34 + lines.length * 20;
    panel(ctx, 160, screenH - 190 - dh + 34, screenW - 320, dh);
    ctx.fillStyle = '#ffd23f';
    ctx.font = `700 14px ${FONT}`;
    ctx.fillText(missions.dialog.speaker, 180, screenH - 190 - dh + 58);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `15px ${FONT}`;
    lines.forEach((line, i) => {
      ctx.fillText(line, 180, screenH - 190 - dh + 80 + i * 20);
    });
  }

  // Toast message, under the objective.
  if (state.messageTimer > 0) {
    ctx.globalAlpha = Math.min(1, state.messageTimer);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 16px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(state.message, screenW / 2, 66);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  // Controls hint, only while the heat is off and the player is new.
  if (state.police.wanted === 0 && missions.index === 0 && state.time < 25) {
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('WASD jalan / mengemudi   •   E curi mobil   •   Klik tembak   •   Spasi pukul   •   P jeda   •   M suara', screenW / 2, screenH - 14);
    ctx.textAlign = 'left';
  }
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
