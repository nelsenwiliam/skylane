// SKYLANE missions — three sorties with different goals:
//   rings:     fly a fixed scenic course of 10 glowing rings, in order
//   landing:   take off airborne and put the plane down on the runway
//   timetrial: 90 seconds, rings keep appearing ahead — grab as many as you can
// Rings are torus meshes; the next one pulses gold, passed ones turn green.
import { CONFIG } from './config.js';
import { mulberry32, heightAt } from './terrain.js';

const THREE = window.THREE;

// Raw course points; each ring's height is clamped to terrain + 45 so no ring
// ever sits inside a hill.
const RAW_COURSE = [
  { x: -600, y: 90, z: 300 }, // west coast sea
  { x: -350, y: 85, z: 560 }, // south coast
  { x: 0, y: 80, z: 720 }, // south sea
  { x: 350, y: 85, z: 640 }, // south-east coast
  { x: 560, y: 95, z: 360 }, // east, near the runway
  { x: 520, y: 100, z: -40 }, // east fields
  { x: 240, y: 95, z: -380 }, // north-east fields
  { x: -140, y: 110, z: -460 }, // north
  { x: -460, y: 120, z: -340 }, // north-west foothills
  { x: -660, y: 110, z: -20 }, // west coast
];
export const RING_COURSE = RAW_COURSE.map((p) => ({
  ...p,
  y: Math.max(p.y, heightAt(p.x, p.z) + 45),
}));

const RING_RADIUS = 15;

export function buildRings(scene) {
  const group = new THREE.Group();
  group.name = 'rings';
  const geo = new THREE.TorusGeometry(RING_RADIUS, 1.3, 10, 40);
  const meshes = RING_COURSE.map((p) => {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffc21a, emissive: 0x8a5c00, transparent: true, opacity: 0.95 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p.x, p.y, p.z);
    mesh.rotation.y = Math.PI / 2; // face along the course (roughly)
    group.add(mesh);
    return mesh;
  });
  scene.add(group);
  return { group, meshes };
}

function ringBearing(from, to) {
  // heading (yaw) the plane needs to fly from -> to. yaw 0 = -Z.
  const dx = to.x - from.x, dz = to.z - from.z;
  return Math.atan2(-dx, -dz);
}

export function createMission() {
  return {
    mode: 'rings', // 'rings' | 'landing' | 'timetrial'
    state: 'idle', // 'idle' | 'flying' | 'done' | 'failed'
    score: 0,
    ringsPassed: 0,
    nextRing: 0,
    timeLeft: 0,
    timeUsed: 0,
    message: '',
    messageUntil: 0,
    rings: [], // active ring positions (course copy or generated)
    spawn: { x: -880, y: 110, z: 120, yaw: 0.8, speed: 45, throttle: 0.55 },
    result: null, // { kind: 'complete'|'landed'|'crashed'|'timeout'|'fuel', ... }
  };
}

export function startMission(mission, mode) {
  mission.mode = mode;
  mission.state = 'flying';
  mission.score = 0;
  mission.ringsPassed = 0;
  mission.nextRing = 0;
  mission.timeUsed = 0;
  mission.result = null;
  if (mode === 'rings') {
    mission.rings = RING_COURSE.map((p) => ({ ...p }));
    mission.timeLeft = CONFIG.missions.rings.timeLimit;
    mission.spawn = { x: -880, y: 110, z: 120, yaw: ringBearing({ x: -880, z: 120 }, RING_COURSE[0]), speed: 45, throttle: 0.55 };
    mission.message = 'RING RUN — fly through all 10 rings!';
  } else if (mode === 'landing') {
    mission.rings = [];
    mission.timeLeft = CONFIG.missions.landing.timeLimit;
    mission.spawn = { x: -520, y: 150, z: 260, yaw: -Math.PI / 2, speed: 48, throttle: 0.6 };
    mission.message = 'LANDING — line up with the runway, slow down, touch down gently.';
  } else {
    mission.rings = [];
    mission.timeLeft = CONFIG.missions.timetrial.timeLimit;
    mission.spawn = { x: -880, y: 110, z: 120, yaw: ringBearing({ x: -880, z: 120 }, RING_COURSE[0]), speed: 50, throttle: 0.7 };
    mission.message = 'TIME TRIAL — 90 seconds, grab every ring you can!';
  }
  mission.messageUntil = 1.8;
  return mission.spawn;
}

// Spawn the next time-trial ring ahead of the plane.
function spawnTrialRing(mission, planePos, yaw) {
  const rand = mulberry32((Date.now() % 100000) + mission.ringsPassed * 7919);
  const dist = 320 + rand() * 120;
  const ahead = yaw + (rand() - 0.5) * 0.7;
  const x = Math.max(-1000, Math.min(1000, planePos.x - Math.sin(ahead) * dist));
  const z = Math.max(-1000, Math.min(1000, planePos.z - Math.cos(ahead) * dist));
  const y = 50 + rand() * 110;
  return { x, y, z };
}

export function missionNextRing(mission) {
  return mission.rings[mission.nextRing] ?? null;
}

// Called every frame while flying. Returns an event for the HUD/sound.
// plane: flight state. dt seconds.
export function updateMission(mission, plane, dt, ringMeshes, scene) {
  if (mission.state !== 'flying') return null;
  mission.timeUsed += dt;
  mission.timeLeft -= dt;
  if (mission.messageUntil > 0) mission.messageUntil -= dt;

  if (mission.timeLeft <= 0) {
    mission.state = 'done';
    mission.result = { kind: mission.mode === 'timetrial' ? 'timeout' : 'timeout', score: mission.score };
    return 'timeout';
  }
  if (plane.fuel <= 0 && plane.speed < 8) {
    mission.state = 'done';
    mission.result = { kind: 'fuel', score: mission.score };
    return 'fuel';
  }

  // time trial: keep one ring alive ahead of the plane
  if (mission.mode === 'timetrial' && mission.rings.length === 0) {
    mission.rings.push(spawnTrialRing(mission, plane.pos, plane.yaw));
    syncTrialRingMesh(mission, ringMeshes, scene);
  }

  const ring = missionNextRing(mission);
  if (ring) {
    const dx = plane.pos.x - ring.x, dy = plane.pos.y - ring.y, dz = plane.pos.z - ring.z;
    const dist = Math.hypot(dx, dy, dz);
    // passed through the hoop: close in 3D and roughly in the ring plane
    if (dist < RING_RADIUS * 0.85) {
      mission.ringsPassed++;
      const gained = CONFIG.missions.rings.ringScore;
      mission.score += gained;
      mission.message = `RING ${mission.ringsPassed} — +${gained}!`;
      mission.messageUntil = 2;
      markRingPassed(ringMeshes, mission);
      if (mission.mode === 'rings' && mission.ringsPassed >= mission.rings.length) {
        const bonus = Math.round(mission.timeLeft) * 2;
        mission.score += bonus;
        mission.state = 'done';
        mission.result = { kind: 'complete', score: mission.score, bonus };
        return 'complete';
      }
      if (mission.mode === 'timetrial') {
        mission.rings = [spawnTrialRing(mission, plane.pos, plane.yaw)];
        syncTrialRingMesh(mission, ringMeshes, scene);
      } else {
        mission.nextRing++;
      }
      return 'ring';
    }
  }
  return null;
}

// The course meshes show the whole ring run; the time-trial ring reuses mesh 0.
function syncTrialRingMesh(mission, ringMeshes, scene) {
  const ring = mission.rings[0];
  if (!ring) return;
  const mesh = ringMeshes[0];
  mesh.position.set(ring.x, ring.y, ring.z);
  mesh.visible = true;
  mesh.material.color.setHex(0xffc21a);
  mesh.material.emissive.setHex(0x8a5c00);
  for (let i = 1; i < ringMeshes.length; i++) ringMeshes[i].visible = false;
}

function markRingPassed(ringMeshes, mission) {
  if (mission.mode === 'timetrial') return;
  const mesh = ringMeshes[mission.nextRing];
  if (mesh) {
    mesh.material.color.setHex(0x2aff66);
    mesh.material.emissive.setHex(0x0a5c22);
  }
}

// Reset ring colours/visibility for a fresh mission.
export function resetRingMeshes(mission, ringMeshes) {
  for (let i = 0; i < ringMeshes.length; i++) {
    const mesh = ringMeshes[i];
    mesh.visible = mission.mode !== 'timetrial' || i === 0;
    if (mission.mode === 'rings' && RING_COURSE[i]) {
      mesh.position.set(RING_COURSE[i].x, RING_COURSE[i].y, RING_COURSE[i].z);
    }
    mesh.material.color.setHex(0xffc21a);
    mesh.material.emissive.setHex(0x8a5c00);
  }
}

// Pulse the next ring so the pilot can spot it.
export function animateRings(mission, ringMeshes, time) {
  const idx = mission.mode === 'timetrial' ? 0 : mission.nextRing;
  const mesh = ringMeshes[idx];
  if (mesh && mesh.visible && mission.state === 'flying') {
    const s = 1 + Math.sin(time * 5) * 0.06;
    mesh.scale.set(s, s, s);
    mesh.rotation.z = time * 0.15;
  }
}
