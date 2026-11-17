// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, game over and story done.
//
// ?seed=N fixes the city. ?shot=chase|downtown|mission|start (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
//
// Revision notes (this session): R now restarts from the game-over screen (the menu
// says so), and the menu reads the restart action through the same action queue as
// every other key instead of a separate listener.

import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_OVER } from './world.js';
import {
  ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput,
} from './input.js';
import {
  SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_STORY, SCREEN_TITLE, createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function runShot(name) {
  const scene = stageShot(name, world);
  window.__world = world;
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { hasSave: scene.hasSave });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const audio = world.state.audio;
  window.__world = world;
  let screen = SCREEN_TITLE;
  let hasSave = world.loadGame() !== null;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame(continueSave) {
    input.takeActions(); // flush stale presses queued on the title screen
    if (continueSave) {
      const save = world.loadGame();
      world.reset();
      if (save) world.applySave(save);
      announce('Cerita dilanjutkan.');
    } else {
      world.reset();
      announce('Cerita baru. Antar paket ke kafe Mama Rosa.');
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
  }

  function endGame() {
    screen = SCREEN_OVER;
    announce('Rico tumbang. Tekan Enter atau R untuk main lagi.');
  }

  function handleActions() {
    // The menu takes only its own bits; the world takes the rest (interact,
    // punch, weapon) in its step, so a keypress is never eaten by the menu.
    const actions = input.takeActions(ACTION_CONFIRM | ACTION_PAUSE | ACTION_MUTE | ACTION_RESTART);
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Suara mati.' : 'Suara hidup.');
    }
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(hasSave);
    } else if (screen === SCREEN_OVER) {
      if (actions & (ACTION_CONFIRM | ACTION_RESTART)) startGame(false);
    } else if (screen === SCREEN_STORY) {
      if (actions & ACTION_CONFIRM) screen = SCREEN_PLAY;
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        world.saveGame();
        screen = SCREEN_PAUSED;
        announce('Jeda. Progress tersimpan.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Lanjut main.');
      }
    }
  }

  // N is not in input.js's action set: watch it here for "new game" on the title.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyN' && !event.repeat && screen === SCREEN_TITLE) startGame(false);
  });

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, input, true);
      return;
    }
    const events = world.step(STEP, input, false);
    if (events & EVENT_OVER) endGame();
    else if (world.state.storyDone && screen === SCREEN_PLAY) {
      screen = SCREEN_STORY;
      announce('Cerita selesai! Solmar Bay milik kita lagi.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, { hasSave });
  }

  // Leaving the tab pauses a running game rather than letting the police close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      world.saveGame();
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    }
  });

  announce('Solmar Bay. Tekan Enter untuk mulai.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
