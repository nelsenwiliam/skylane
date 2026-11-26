// SKYLANE input — keyboard state, exposed as flight axes.
// W/S or Shift/Ctrl: throttle. A/D or Left/Right: bank. Up/Down: pitch.
// C camera, P pause, R restart, M mute, Enter start, 1/2/3 pick a mission.
export function createInput() {
  const keys = new Set();
  const pressed = new Set(); // edge-triggered keys, consumed once per frame
  const input = {
    keys, pressed,
    get roll() {
      const left = keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0;
      const right = keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0;
      return left - right;
    },
    get pitch() {
      const up = keys.has('ArrowUp') ? 1 : 0;
      const down = keys.has('ArrowDown') ? 1 : 0;
      return up - down;
    },
    get throttleUp() { return keys.has('KeyW') || keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    get throttleDown() { return keys.has('KeyS') || keys.has('ControlLeft') || keys.has('ControlRight'); },
    consume(code) { if (pressed.has(code)) { pressed.delete(code); return true; } return false; },
  };
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  return input;
}
