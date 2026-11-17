// Keyboard and pointer input. Held keys give a movement vector; one-shot presses
// (confirm, pause, interact, punch, weapon switch) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost or counted twice.
// Mouse clicks queue a shot with the screen position they were aimed at.
//
// Revision notes (this session): R is now a restart action (ACTION_RESTART) for the
// game-over screen, right-click no longer opens the browser menu over the canvas,
// and takeActions() keeps unmasked bits queued so the menu and the world never eat
// each other's presses.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_WEAPON = 16;
export const ACTION_MUTE = 32;
export const ACTION_RESTART = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter', 'NumpadEnter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const PUNCH = new Set(['Space']);
const WEAPON = new Set(['Digit1', 'Digit2', 'KeyQ']);
const MUTE = new Set(['KeyM']);
const RESTART = new Set(['KeyR']);

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false };
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let clickX = 0;
  let clickY = 0;
  let clicked = false;

  function setHeld(code, value) {
    if (UP.has(code)) held.up = value;
    else if (DOWN.has(code)) held.down = value;
    else if (LEFT.has(code)) held.left = value;
    else if (RIGHT.has(code)) held.right = value;
  }

  window.addEventListener('keydown', (event) => {
    setHeld(event.code, true);
    if (event.repeat) return;
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (INTERACT.has(event.code)) actions |= ACTION_INTERACT;
    else if (PUNCH.has(event.code)) actions |= ACTION_PUNCH;
    else if (WEAPON.has(event.code)) actions |= ACTION_WEAPON;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    else if (RESTART.has(event.code)) actions |= ACTION_RESTART;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => setHeld(event.code, false));
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    clickX = event.clientX - rect.left;
    clickY = event.clientY - rect.top;
    mouseX = clickX;
    mouseY = clickY;
    clicked = true;
    actions |= ACTION_CONFIRM;
  });
  // Right-click is aim, not a menu: keep the browser menu off the canvas.
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  // Space also scrolls the page in some browsers: keep the game from moving it.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') event.preventDefault();
  });

  return {
    /** Normalised WASD / arrow movement vector, {x, y} in world axes. */
    move() {
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    /** Current mouse position in canvas pixels. */
    mouse() {
      return { x: mouseX, y: mouseY };
    },
    /** The last click's canvas position, or null when no click is waiting. */
    takeClick() {
      if (!clicked) return null;
      clicked = false;
      return { x: clickX, y: clickY };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. With a mask,
     * only those bits are taken; the rest stay queued for the next caller. */
    takeActions(mask = 0xffffffff) {
      const taken = actions & mask;
      actions &= ~mask;
      return taken;
    },
  };
}
