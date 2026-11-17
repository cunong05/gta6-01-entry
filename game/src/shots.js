// The screenshot scenes behind ?shot=chase|downtown|mission|start. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot (drive a loop of downtown streets, walk an avenue toward the
// mission marker), so the frame is what real play looks like and the same seed
// always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const CHASE_SECONDS = 26;
const DOWNTOWN_SECONDS = 14;
const MISSION_SECONDS = 0.8;
const START_SECONDS = 8;

/** A stand-in input the autopilot steers: move vector settable, no actions, no clicks. */
function fakeInput() {
  let moveVec = { x: 0, y: 0 };
  return {
    setMove(x, y) { moveVec = { x, y }; },
    move() { return moveVec; },
    takeActions() { return 0; },
    takeClick() { return null; },
  };
}

function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Steer the player's car toward (wx, wy) at full throttle. */
function driveToward(world, input, wx, wy) {
  const player = world.state.player;
  const target = Math.atan2(wy - player.y, wx - player.x);
  const diff = angleDiff(player.angle, target);
  input.setMove(Math.max(-1, Math.min(1, diff * 2.5)), -1);
}

/** Walk the player toward (wx, wy). */
function walkToward(world, input, wx, wy) {
  const player = world.state.player;
  const dx = wx - player.x;
  const dy = wy - player.y;
  const len = Math.hypot(dx, dy) || 1;
  input.setMove(dx / len, dy / len);
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Unknown names stage the title screen.
 */
export function stageShot(name, world) {
  const input = fakeInput();
  if (name === 'chase') {
    world.reset();
    // Put Rico in his own parked car, heat at 3 stars, police on the way.
    const player = world.state.player;
    const parked = world.state.cars[world.state.cars.length - 1];
    player.inCar = parked;
    player.angle = parked.angle;
    world.setWanted(3);
    const loop = [
      [2300, 1050], [2300, 650], [1100, 650], [1100, 1050],
    ];
    let wp = 0;
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      const target = loop[wp];
      driveToward(world, input, target[0], target[1]);
      world.step(STEP, input, false);
      if (Math.hypot(player.x - target[0], player.y - target[1]) < 120) wp = (wp + 1) % loop.length;
    }
    return { screen: SCREEN_PLAY, hasSave: false };
  }
  if (name === 'downtown') {
    world.reset();
    // Walk north up avenue 1500 through Downtown, traffic and walkers around.
    for (let i = 0; i < DOWNTOWN_SECONDS / STEP; i += 1) {
      walkToward(world, input, 1500, 690);
      world.step(STEP, input, false);
    }
    return { screen: SCREEN_PLAY, hasSave: false };
  }
  if (name === 'mission') {
    world.reset();
    // Mission 1 is already active after reset: walk toward Mama Rosa's cafe
    // while her dialog is still on screen.
    for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
      walkToward(world, input, 1520, 690);
      world.step(STEP, input, false);
    }
    world.state.missions.dialog = {
      speaker: 'Mama Rosa',
      text: 'Antar paket ke kafe Mama Rosa di Downtown. Jangan sampai paketnya basah.',
    };
    world.state.missions.dialogTimer = 5;
    return { screen: SCREEN_PLAY, hasSave: false };
  }
  // start: the title screen over a slow pan of the living city.
  world.reset();
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    world.step(STEP, input, true);
  }
  return { screen: SCREEN_TITLE, hasSave: false };
}
