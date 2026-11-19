// SOLMAR CITY — input.js
// Keyboard and mouse. Held keys give a direction every frame; one-shot
// presses (start, pause, enter/exit a car, mute) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost and
// never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_MUTE = 8;

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function createInput(canvas) {
  const held = new Set();
  const mouse = { x: 0, y: 0, down: false };
  // World-space mouse position, filled in by the loop from the camera.
  const mouseWorld = { x: 0, y: 0 };
  let actions = 0;
  let enterCarPressed = false;

  function onKeyDown(event) {
    if (MOVE_KEYS.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
      return;
    }
    if (event.code === 'Space' || event.code === 'Enter') {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
      return;
    }
    if (event.code === 'KeyE') {
      if (!event.repeat) enterCarPressed = true;
      return;
    }
    if (event.code === 'KeyP' || event.code === 'Escape') {
      if (!event.repeat) actions |= ACTION_PAUSE;
      return;
    }
    if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    }
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onBlur() {
    held.clear();
    mouse.down = false;
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }

  function onMouseDown(event) {
    onMouseMove(event);
    mouse.down = true;
  }

  function onMouseUp() {
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  const has = (...codes) => codes.some((c) => held.has(c));

  return {
    mouse,
    mouseWorld,
    // True once when E was pressed since the last call; the world consumes it.
    takeEnterCar() {
      const pressed = enterCarPressed;
      enterCarPressed = false;
      return pressed;
    },
    // Driving: -1 reverse/brake, 0 coast, 1 throttle.
    get drive() {
      return (has('KeyW', 'ArrowUp') ? 1 : 0) - (has('KeyS', 'ArrowDown') ? 1 : 0);
    },
    // Steering: -1 left, 1 right.
    get steer() {
      return (has('KeyD', 'ArrowRight') ? 1 : 0) - (has('KeyA', 'ArrowLeft') ? 1 : 0);
    },
    // Walking: a unit-ish x/y pair from the same keys.
    walkVector() {
      const x = (has('KeyD', 'ArrowRight') ? 1 : 0) - (has('KeyA', 'ArrowLeft') ? 1 : 0);
      const y = (has('KeyS', 'ArrowDown') ? 1 : 0) - (has('KeyW', 'ArrowUp') ? 1 : 0);
      return { x, y };
    },
    get handbrake() {
      return held.has('Space');
    },
    // The one-shot presses since the last call, as ACTION_* flags.
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
