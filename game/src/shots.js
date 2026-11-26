// SKYLANE screenshot presets — ?shot=cover|cockpit|ring|landing (and ?demo=1
// for a hands-free attract flight) place the plane in a composed, readable scene
// and switch on the autopilot, so a headless browser can capture the exact
// frames the entry ships. Nothing here changes normal play.
import { RING_COURSE } from './rings.js';

export function parseShotParams() {
  const q = new URLSearchParams(window.location.search);
  return { shot: q.get('shot') || null, demo: q.get('demo') === '1', seed: Number(q.get('seed') || 1) };
}

// Returns a spawn + mission + camera setup for the requested shot, or null.
export function shotSetup(shot) {
  if (shot === 'cover') {
    // chase view: plane mid-frame, first ring ahead, island + runway behind it
    return {
      mode: 'rings',
      camera: 'chase',
      spawn: { x: -760, y: 105, z: 180, yaw: -2.21, speed: 52, throttle: 0.62 },
      autopilot: true, holdSeconds: 3.2,
    };
  }
  if (shot === 'cockpit') {
    return {
      mode: 'rings',
      camera: 'cockpit',
      spawn: { x: -720, y: 100, z: 210, yaw: -2.21, speed: 55, throttle: 0.65 },
      autopilot: true, holdSeconds: 2.4,
    };
  }
  if (shot === 'ring') {
    // right on top of a ring, about to fly through it
    const r = RING_COURSE[2];
    return {
      mode: 'rings',
      camera: 'chase',
      spawn: { x: r.x - 150, y: r.y + 15, z: r.z - 120, yaw: -2.25, speed: 58, throttle: 0.68 },
      autopilot: true, holdSeconds: 2.4,
    };
  }
  if (shot === 'landing') {
    // short final: low over the threshold, runway filling the frame ahead
    return {
      mode: 'landing',
      camera: 'chase',
      spawn: { x: 40, y: 42, z: 260, yaw: -Math.PI / 2, speed: 44, throttle: 0.42 },
      autopilot: true, holdSeconds: 2.8,
    };
  }
  return null;
}

// Simple autopilot: steer towards a target point, hold altitude and throttle.
// target: {x,y,z} | null (null = fly straight and level).
export function autopilotInput(plane, target, dt, baseThrottle = 0.6) {
  const input = { roll: 0, pitch: 0, throttleUp: false, throttleDown: false };
  if (!target) {
    input.pitch = plane.pitch < -0.05 ? 0.4 : plane.pitch > 0.05 ? -0.4 : 0;
    return input;
  }
  const dx = target.x - plane.pos.x, dy = target.y - plane.pos.y, dz = target.z - plane.pos.z;
  const wantYaw = Math.atan2(-dx, -dz);
  let dyaw = wantYaw - plane.yaw;
  dyaw = ((dyaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  input.roll = Math.max(-1, Math.min(1, -dyaw * 1.6));
  const wantPitch = Math.max(-0.3, Math.min(0.3, dy / 220));
  input.pitch = Math.max(-1, Math.min(1, (wantPitch - plane.pitch) * 2.5));
  input.throttleUp = plane.throttle < baseThrottle;
  input.throttleDown = plane.throttle > baseThrottle + 0.05;
  return input;
}

// Landing autopilot: aim for the threshold, descend gently, flare at the end.
export function landingAutopilot(plane, dt) {
  const input = { roll: 0, pitch: 0, throttleUp: false, throttleDown: false };
  const dx = 380 - plane.pos.x;
  const dz = 260 - plane.pos.z;
  const dist = Math.hypot(dx, dz);
  const wantYaw = Math.atan2(-dx, -dz);
  let dyaw = wantYaw - plane.yaw;
  dyaw = ((dyaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  input.roll = Math.max(-1, Math.min(1, -dyaw * 2.0));
  const wantAlt = 8 + Math.max(0, dist - 230) * 0.09;
  const wantPitch = Math.max(-0.25, Math.min(0.15, (wantAlt - plane.pos.y) / 120));
  input.pitch = Math.max(-1, Math.min(1, (wantPitch - plane.pitch) * 2.0));
  const wantThrottle = dist > 300 ? 0.5 : dist > 120 ? 0.38 : 0.3;
  input.throttleUp = plane.throttle < wantThrottle;
  input.throttleDown = plane.throttle > wantThrottle + 0.05;
  return input;
}
