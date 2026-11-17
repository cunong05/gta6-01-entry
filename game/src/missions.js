// The story: six chained missions for Rico Vega, from Mama Rosa's first package to
// the showdown at the docks. Each mission is stages of goto / wait / survive / chase
// / kill; this file owns the stage machine, the dialog lines and the payouts, and
// the world owns the player, the cars and the guards it asks for.
//
// Revision notes (this session): objectiveProgress() reports how far the current
// stage is (0..1) so the HUD can draw a progress bar for wait / survive / kill
// stages, and totalRewards() sums the story's payouts for the end screen.

import { MISSIONS } from './config.js';
import { ROADS } from './config.js';

export const MISSION_STAGE = 1;
export const MISSION_DONE = 2;
export const STORY_DONE = 4;

const DIALOG_TIME = 5;

export function createMissions() {
  return {
    index: 0,
    stage: 0,
    stageTimer: 0,
    stageProgress: 0,
    dialog: null,
    dialogTimer: 0,
    done: false,
    targetCar: null,
    guards: [],
    kills: 0,
    started: false,
  };
}

export function currentMission(missions) {
  return missions.index < MISSIONS.length ? MISSIONS[missions.index] : null;
}

export function currentStage(missions) {
  const mission = currentMission(missions);
  return mission ? mission.stages[missions.stage] : null;
}

/** The objective line the HUD shows, e.g. "Misi 2/6 — Jemput Tito: Tito menunggu". */
export function objectiveText(missions) {
  const mission = currentMission(missions);
  if (!mission) return 'Solmar Bay bebas — jelajahi kota, cari mobil, cari uang.';
  const stage = currentStage(missions);
  const label = stage ? stage.label : '';
  return `Misi ${missions.index + 1}/6 — ${mission.name}: ${label}`;
}

/** How far the current stage is, 0..1 (null when the stage has no measurable
 * progress, e.g. a goto). The HUD draws this as a thin progress bar. */
export function objectiveProgress(missions) {
  const stage = currentStage(missions);
  if (!stage) return null;
  if (stage.kind === 'wait' || stage.kind === 'survive') {
    return Math.min(1, missions.stageProgress / stage.seconds);
  }
  if (stage.kind === 'kill') {
    return Math.min(1, missions.kills / stage.count);
  }
  if (stage.kind === 'chase') {
    const target = missions.targetCar;
    if (!target) return null;
    return Math.max(0, Math.min(1, 1 - target.hp / 120));
  }
  return null;
}

/** Total payout of all six missions, for the story-complete screen. */
export function totalRewards() {
  return MISSIONS.reduce((sum, m) => sum + m.reward, 0);
}

function setDialog(missions, speaker, text) {
  missions.dialog = { speaker, text };
  missions.dialogTimer = DIALOG_TIME;
}

function startStage(missions, world) {
  const stage = currentStage(missions);
  if (!stage) return;
  missions.stageTimer = 0;
  missions.stageProgress = 0;
  const mission = currentMission(missions);
  if (stage.kind === 'chase') {
    missions.targetCar = world.spawnChaseTarget();
    setDialog(missions, 'Tito', 'Itu mobil Marco! Tabrak dia sampai berhenti, Rico!');
  } else if (stage.kind === 'survive') {
    world.setWanted(3);
    setDialog(missions, 'Mama Rosa', 'Polisi mengepungmu! Bertahan, lalu sembunyi di markas!');
  } else if (stage.kind === 'kill') {
    missions.guards = world.spawnGuards(stage.count, stage.x, stage.y);
    missions.kills = 0;
    setDialog(missions, 'Mama Rosa', 'Penjaga Marco ada di dermaga. Hati-hati, Rico!');
  } else if (stage.kind === 'wait') {
    setDialog(missions, 'Tito', 'Brankasnya terbuka... tahan posisi, alarmnya bunyi!');
  } else if (missions.stage === 0) {
    setDialog(missions, mission.giver, mission.brief);
    world.audio.missionStart();
  }
}

/** Begin mission `index` (0-based). Call once per mission. */
export function startMission(missions, world, index) {
  missions.index = index;
  missions.stage = 0;
  missions.started = true;
  const mission = currentMission(missions);
  setDialog(missions, mission.giver, mission.brief);
  world.audio.missionStart();
  startStage(missions, world);
}

/** Advance the stage machine one step; returns MISSION_* flags. */
export function updateMissions(missions, world, dt) {
  let events = 0;
  if (missions.dialogTimer > 0) {
    missions.dialogTimer -= dt;
    if (missions.dialogTimer <= 0) missions.dialog = null;
  }
  const mission = currentMission(missions);
  if (!mission || missions.done) return events;
  const stage = currentStage(missions);
  const player = world.state.player;
  const dist = stage && stage.x !== undefined
    ? Math.hypot(player.x - stage.x, player.y - stage.y)
    : Infinity;

  let complete = false;
  if (stage.kind === 'goto') {
    complete = dist < stage.radius;
  } else if (stage.kind === 'wait') {
    if (dist < stage.radius) {
      missions.stageProgress += dt;
      if (missions.stageProgress >= stage.seconds) complete = true;
    }
  } else if (stage.kind === 'survive') {
    missions.stageProgress += dt;
    if (missions.stageProgress >= stage.seconds) complete = true;
  } else if (stage.kind === 'chase') {
    const target = missions.targetCar;
    if (target && (!target.active || target.hp <= 0 || target.speed < 5)) {
      missions.stageProgress += dt;
      if (missions.stageProgress > 1.2) complete = true;
    } else {
      missions.stageProgress = 0;
    }
  } else if (stage.kind === 'kill') {
    complete = missions.kills >= stage.count;
  }

  if (!complete) return events;

  // Stage finished: move on, or pay out and start the next mission.
  events |= MISSION_STAGE;
  if (stage.kind === 'wait' && mission.name === 'Rampok Bank Pelabuhan') {
    world.setWanted(4); // the alarm goes off as the vault opens
  }
  if (stage.kind === 'goto' && mission.name === 'Jemput Tito' && missions.stage === 0) {
    setDialog(missions, 'Tito', 'Akhirnya! Antar aku ke Bar Coral, pantainya lagi ramai.');
  }
  missions.stage += 1;
  if (missions.stage >= mission.stages.length) {
    world.state.player.money += mission.reward;
    world.showMessage(`Misi selesai: ${mission.name}  +$${mission.reward}`);
    world.audio.missionDone();
    world.saveGame();
    events |= MISSION_DONE;
    if (missions.index + 1 >= MISSIONS.length) {
      missions.done = true;
      setDialog(missions, 'Mama Rosa', 'Kamu berhasil, Rico. Solmar Bay milik kita lagi.');
      events |= STORY_DONE;
    } else {
      startMission(missions, world, missions.index + 1);
    }
  } else {
    startStage(missions, world);
  }
  return events;
}

/** The chase target flees along the roads, turning away from the player. */
export function updateChaseTarget(car, city, dt, player, random) {
  if (!car.active || car.hp <= 0) return;
  const away = Math.atan2(car.y - player.y, car.x - player.x);
  // Pick the road direction that points most away from the player.
  const dirs = [
    { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 },
  ];
  let bestDir = car.dir;
  let bestScore = -Infinity;
  for (let i = 0; i < 4; i += 1) {
    if (i === (car.dir + 2) % 4) continue;
    const score = dirs[i].dx * Math.cos(away) + dirs[i].dy * Math.sin(away) + random() * 0.3;
    if (score > bestScore) { bestScore = score; bestDir = i; }
  }
  const nearIntersection = ROADS.avenues.some((ax) => Math.abs(car.x - ax) < 30)
    && ROADS.streets.some((sy) => Math.abs(car.y - sy) < 30);
  if (nearIntersection && random() < 0.5) car.dir = bestDir;
  const d = dirs[car.dir];
  const targetAngle = Math.atan2(d.dy, d.dx);
  let diff = (targetAngle - car.angle) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-3 * dt, Math.min(3 * dt, diff));
  car.speed += Math.max(-400 * dt, Math.min(380 * dt, 430 - car.speed));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  city.clampWorld(car, 22);
  // Snap onto the road centreline after a turn, like traffic does.
  if (car.dir === 0 || car.dir === 2) {
    const sy = ROADS.streets.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
    car.y += (sy - car.y) * Math.min(1, 3 * dt);
  } else {
    const ax = ROADS.avenues.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
    car.x += (ax - car.x) * Math.min(1, 3 * dt);
  }
}
