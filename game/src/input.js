// Solmar Bay — keyboard and mouse input.
// One shared state object; the game loop reads it, the autopilot writes it.

export function createInput() {
  const input = {
    keys: new Set(),
    // Mouse position in canvas pixels (converted to world space by the caller).
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    // Edge-triggered presses, consumed once by whoever reads them.
    pressed: new Set(),
    mouseClicked: false,
    // Autopilot / screenshot staging writes here directly.
    autopilot: false,
  };
  return input;
}

const KEY_ALIASES = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};

export function attachInput(input, canvas) {
  window.addEventListener('keydown', (event) => {
    const code = event.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    input.keys.add(code);
    const alias = KEY_ALIASES[code];
    if (alias) input.keys.add(alias);
    input.pressed.add(code);
    if (alias) input.pressed.add(alias);
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
    const alias = KEY_ALIASES[event.code];
    if (alias) input.keys.delete(alias);
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = event.clientX - rect.left;
    input.mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    input.mouseDown = true;
    input.mouseClicked = true;
    const rect = canvas.getBoundingClientRect();
    input.mouseX = event.clientX - rect.left;
    input.mouseY = event.clientY - rect.top;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button !== 0) return;
    input.mouseDown = false;
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
  });
}

// Read helpers ---------------------------------------------------------------

export function keyDown(input, ...codes) {
  return codes.some((c) => input.keys.has(c));
}

export function keyPressed(input, ...codes) {
  return codes.some((c) => input.pressed.has(c));
}

// Movement vector from WASD / arrows, normalised.
export function moveVector(input) {
  let x = 0;
  let y = 0;
  if (keyDown(input, 'left', 'KeyA', 'ArrowLeft')) x -= 1;
  if (keyDown(input, 'right', 'KeyD', 'ArrowRight')) x += 1;
  if (keyDown(input, 'up', 'KeyW', 'ArrowUp')) y -= 1;
  if (keyDown(input, 'down', 'KeyS', 'ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) {
    const inv = 1 / Math.hypot(x, y);
    x *= inv;
    y *= inv;
  }
  return { x, y };
}

// Clear edge-triggered state at the end of a frame.
export function endFrameInput(input) {
  input.pressed.clear();
  input.mouseClicked = false;
}
