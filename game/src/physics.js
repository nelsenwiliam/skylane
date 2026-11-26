// SKYLANE flight model — an arcade model with real trade-offs:
// throttle sets target speed, banking turns the plane, pitch trades speed for
// altitude, and below stall speed the nose drops. Ground contact is checked
// against the same heightAt() the terrain mesh uses.
import { CONFIG } from './config.js';
import { heightAt } from './terrain.js';

const P = CONFIG.plane;
const R = CONFIG.runway;

export function createFlightState() {
  return {
    pos: { x: -880, y: 110, z: 120 },
    yaw: 0, pitch: 0, roll: 0,
    speed: 45, throttle: 0.55,
    fuel: P.fuelCapacity, damage: 0,
    verticalSpeed: 0,
    airborne: true, landed: false, crashed: false,
  };
}

export function resetFlight(state, spawn) {
  state.pos.x = spawn.x; state.pos.y = spawn.y; state.pos.z = spawn.z;
  state.yaw = spawn.yaw; state.pitch = 0; state.roll = 0;
  state.speed = spawn.speed ?? 45; state.throttle = spawn.throttle ?? 0.55;
  state.fuel = P.fuelCapacity; state.damage = 0;
  state.verticalSpeed = 0; state.airborne = true; state.landed = false; state.crashed = false;
}

// Forward vector from yaw/pitch (yaw 0 = -Z, yaw grows clockwise from above).
export function forwardVector(state) {
  const cy = Math.cos(state.yaw), sy = Math.sin(state.yaw);
  const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
  return { x: -sy * cp, y: sp, z: -cy * cp };
}

export function isOverRunway(x, z) {
  return Math.abs(x - R.centerX) <= R.length / 2 && Math.abs(z - R.centerZ) <= R.width / 2 + 4;
}

// One simulation step. input: { roll: -1..1, pitch: -1..1, throttleUp, throttleDown }.
// Returns an event string ('crash' | 'landed' | null) when something decisive happens.
export function stepFlight(state, input, dt) {
  if (state.crashed || state.landed) return null;

  // throttle
  if (input.throttleUp) state.throttle = Math.min(1, state.throttle + dt * 0.45);
  if (input.throttleDown) state.throttle = Math.max(0, state.throttle - dt * 0.6);
  if (state.fuel <= 0) state.throttle = 0;
  state.fuel = Math.max(0, state.fuel - state.throttle * P.fuelDrain * dt);

  // speed chases the throttle target; drag grows when slow or pitched hard
  const targetSpeed = state.throttle * P.maxSpeed;
  const drag = 1 + Math.abs(state.pitch) * 1.4;
  state.speed += (targetSpeed - state.speed) * Math.min(1, (P.accel / P.maxSpeed) * drag * dt * 2.2);
  if (state.speed < 0) state.speed = 0;

  // bank towards the input, then turn with the bank
  const targetRoll = -input.roll * P.maxBank;
  state.roll += (targetRoll - state.roll) * Math.min(1, P.bankRate * dt);
  const turnAuthority = Math.min(1, state.speed / 40);
  state.yaw -= Math.sin(state.roll) * P.turnRate * turnAuthority * dt;

  // pitch towards the input; stall drops the nose and bleeds speed
  const stalling = state.speed < P.stallSpeed;
  const targetPitch = input.pitch * P.maxPitch - (stalling ? 0.35 : 0);
  state.pitch += (targetPitch - state.pitch) * Math.min(1, P.pitchRate * dt);

  const fwd = forwardVector(state);
  state.verticalSpeed = fwd.y * state.speed;
  state.pos.x += fwd.x * state.speed * dt;
  state.pos.y += fwd.y * state.speed * dt;
  state.pos.z += fwd.z * state.speed * dt;

  // keep the plane inside the world
  const bound = CONFIG.world.size / 2 - 40;
  state.pos.x = Math.max(-bound, Math.min(bound, state.pos.x));
  state.pos.z = Math.max(-bound, Math.min(bound, state.pos.z));
  if (state.pos.y > 420) { state.pos.y = 420; state.pitch = Math.min(state.pitch, 0); }

  // ground contact
  const ground = heightAt(state.pos.x, state.pos.z);
  const clearance = state.pos.y - ground;
  if (clearance <= 1.4) {
    const onRunway = isOverRunway(state.pos.x, state.pos.z);
    const soft = state.verticalSpeed > -5.5 && state.speed < 52 && Math.abs(state.roll) < 0.3;
    if (onRunway && soft && state.airborne) {
      state.pos.y = ground + 1.4;
      state.landed = true;
      state.speed = Math.max(0, state.speed - 18);
      return 'landed';
    }
    const impact = -state.verticalSpeed;
    if (impact > 4 || state.speed > 60) {
      state.damage = 100;
      state.crashed = true;
      state.pos.y = ground + 1.2;
      return 'crash';
    }
    // hard bump: damage, bounce back up a little
    state.damage = Math.min(100, state.damage + 30);
    state.pos.y = ground + 3;
    state.pitch = 0.15;
    state.speed *= 0.55;
    if (state.damage >= 100) { state.crashed = true; return 'crash'; }
    return 'bump';
  }
  return null;
}
