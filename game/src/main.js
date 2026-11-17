// Solmar Bay — entry point: canvas setup, the game loop, screen states,
// and the ?shot= staging mode used for screenshots.

import {
  createWorld, bindWorldMethods, updateWorld, loadSave, applySave, hasSave, saveGame,
  advanceDialog,
} from './world.js';
import { createInput, attachInput, endFrameInput, keyPressed } from './input.js';
import { drawWorld } from './render.js';
import {
  drawHUD, drawTitleScreen, drawPauseScreen, drawGameOverScreen, drawWinScreen,
} from './hud.js';
import { drawMinimap } from './minimap.js';
import { stageShot } from './shots.js';
import { startMission } from './missions.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const input = createInput();
attachInput(input, canvas);

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const shotSeed = Number(params.get('seed') || 1);

let world = createWorld(shotName ? shotSeed : (Date.now() % 100000) + 1);
bindWorldMethods(world);

if (shotName) {
  stageShot(world, shotName);
} else {
  world.hasSave = hasSave();
}

function newGame() {
  world = createWorld((Date.now() % 100000) + 1);
  bindWorldMethods(world);
  world.state = 'playing';
  world.audio.ensure();
  startMission(world, 0);
}

function continueGame() {
  const save = loadSave();
  world = createWorld((Date.now() % 100000) + 1);
  bindWorldMethods(world);
  applySave(world, save);
  world.state = 'playing';
  world.audio.ensure();
  world.message('Welcome back to Solmar Bay, Rico.', 3.5);
}

function restartFromSave() {
  const save = loadSave();
  if (save) continueGame();
  else newGame();
}

// Audio unlocks on the first gesture, as browsers require.
window.addEventListener('keydown', () => world.audio.ensure(), { once: false });
window.addEventListener('mousedown', () => world.audio.ensure(), { once: false });

let lastTime = performance.now();

// A handle for play-testing and debugging (the browser console can inspect
// window.__world); it changes nothing about the game itself.
function frame(now) {
  window.__world = world;
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const view = { w: canvas.width, h: canvas.height };

  if (shotName) {
    // Screenshot mode: the staged scene is frozen and rendered as-is.
    renderFrame(view);
    requestAnimationFrame(frame);
    return;
  }

  // Global keys, handled here so they work on every screen.
  if (keyPressed(input, 'KeyM')) {
    world.audio.setMuted(!world.audio.muted);
    world.message(world.audio.muted ? 'Sound muted.' : 'Sound on.', 1.5);
  }

  if (world.state === 'title') {
    // A living city behind the menu: traffic and pedestrians keep moving.
    const quiet = { keys: new Set(), pressed: new Set(), mouseX: 0, mouseY: 0, mouseDown: false, mouseClicked: false };
    updateWorld(world, dt, quiet);
    if (keyPressed(input, 'Enter')) newGame();
    else if (keyPressed(input, 'KeyC') && world.hasSave) continueGame();
  } else if (world.state === 'playing') {
    if (world.dialog) {
      if (keyPressed(input, 'Enter') || input.mouseClicked) advanceDialog(world);
    } else {
      updateWorld(world, dt, input);
    }
    if (keyPressed(input, 'KeyP')) {
      world.state = 'paused';
      saveGame(world);
    }
  } else if (world.state === 'paused') {
    if (keyPressed(input, 'KeyP') || keyPressed(input, 'Enter')) world.state = 'playing';
    else if (keyPressed(input, 'KeyR')) restartFromSave();
  } else if (world.state === 'gameover') {
    if (keyPressed(input, 'Enter')) restartFromSave();
  } else if (world.state === 'win') {
    if (keyPressed(input, 'Enter')) {
      world.state = 'playing';
      world.storyComplete = true;
    }
  }

  renderFrame(view);
  endFrameInput(input);
  requestAnimationFrame(frame);
}

function renderFrame(view) {
  ctx.clearRect(0, 0, view.w, view.h);
  drawWorld(ctx, world, view);
  if (world.state === 'title') {
    drawTitleScreen(ctx, world, view, world.hasSave);
  } else if (world.state === 'paused') {
    drawHUD(ctx, world, view);
    drawMinimap(ctx, world, view.w - 214, view.h - 176, 190, 142);
    drawPauseScreen(ctx, world, view);
  } else if (world.state === 'gameover') {
    drawGameOverScreen(ctx, world, view);
  } else if (world.state === 'win') {
    drawHUD(ctx, world, view);
    drawMinimap(ctx, world, view.w - 214, view.h - 176, 190, 142);
    drawWinScreen(ctx, world, view);
  } else {
    drawHUD(ctx, world, view);
    drawMinimap(ctx, world, view.w - 214, view.h - 176, 190, 142);
  }
}

requestAnimationFrame(frame);
