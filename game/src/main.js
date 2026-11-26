// SKYLANE main — boots the renderer, builds the world, and runs the game loop.
// States: menu (attract autopilot flight behind the title) -> playing ->
// paused / over (crashed, landed, course complete, time up). Restart with R.
import { CONFIG } from './config.js';
import { buildTerrain, updateClouds, heightAt } from './terrain.js';
import { buildAircraft, animateAircraft } from './aircraft.js';
import { createFlightState, resetFlight, stepFlight, forwardVector } from './physics.js';
import { buildRings, createMission, startMission, updateMission, resetRingMeshes, animateRings, missionNextRing } from './rings.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createCamera } from './camera.js';
import { parseShotParams, shotSetup, autopilotInput, landingAutopilot } from './shots.js';

const THREE = window.THREE;
window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + String(e.reason)));

const params = parseShotParams();
const shot = params.shot ? shotSetup(params.shot) : null;

// --- renderer / scene -------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x4a6b3a, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
sun.position.set(-600, 900, -800);
scene.add(sun);

buildTerrain(scene);
window.__scene = scene;
window.__renderer = renderer;
const { group: planeGroup, prop, blur, navLights } = buildAircraft();
scene.add(planeGroup);
const aircraftParts = { prop, blur, navLights };
const { meshes: ringMeshes } = buildRings(scene);

const cameraRig = createCamera();
const hud = createHud();
const audio = createAudio();
const input = createInput();
const plane = createFlightState();
const mission = createMission();

let gameState = 'menu'; // 'menu' | 'playing' | 'paused' | 'over'
let autopilot = params.demo || !!shot;
let time = 0;
let fpsFrames = 0, fpsLast = performance.now(), fpsValue = 0;
window.__fps = 0;
window.__game = { get state() { return gameState; }, get score() { return mission.score; }, plane, mission };

// --- menu -------------------------------------------------------------------
const menuEl = document.getElementById('menu');
const overEl = document.getElementById('gameover');
function showMenu() {
  gameState = 'menu';
  menuEl.style.display = 'flex';
  overEl.style.display = 'none';
  hud.setVisible(false);
  autopilot = true;
  // attract flight: ring course, autopilot on
  const spawn = startMission(mission, 'rings');
  resetFlight(plane, spawn);
  resetRingMeshes(mission, ringMeshes);
  cameraRig.setMode('chase');
  cameraRig.snapTo(plane);
  mission.state = 'flying';
  mission.message = '';
}
function startGame(mode) {
  audio.unlock();
  audio.click();
  const spawn = startMission(mission, mode);
  resetFlight(plane, spawn);
  resetRingMeshes(mission, ringMeshes);
  cameraRig.snapTo(plane);
  menuEl.style.display = 'none';
  overEl.style.display = 'none';
  hud.setVisible(true);
  hud.hideBanner();
  hud.setObjective(
    mode === 'rings' ? 'RING RUN — 10 rings, beat the clock'
    : mode === 'landing' ? 'LANDING — put her down on the runway'
    : 'TIME TRIAL — 90 seconds, every ring counts',
  );
  gameState = 'playing';
  autopilot = !!shot || params.demo;
}
function endGame(title, sub, won) {
  gameState = 'over';
  hud.setVisible(false);
  document.getElementById('over-title').textContent = title;
  document.getElementById('over-sub').textContent = sub;
  document.getElementById('over-score').textContent = `SCORE ${mission.score}   •   RINGS ${mission.ringsPassed}   •   TIME ${Math.round(mission.timeUsed)}s`;
  overEl.style.display = 'flex';
  if (won) audio.win();
}
function restart() {
  if (gameState === 'menu') return;
  startGame(mission.mode);
}
function togglePause() {
  if (gameState === 'playing') { gameState = 'paused'; hud.showBanner('PAUSED', 'Press P to resume — R to restart'); }
  else if (gameState === 'paused') { gameState = 'playing'; hud.hideBanner(); }
}

document.querySelectorAll('#menu .mission-btn').forEach((btn) => {
  btn.addEventListener('click', () => startGame(btn.dataset.mode));
});
document.getElementById('restart-btn').addEventListener('click', restart);
document.getElementById('menu-btn').addEventListener('click', showMenu);

// --- autopilot target -------------------------------------------------------
function autopilotTarget() {
  if (mission.mode === 'landing') return null; // landingAutopilot handles it
  const ring = missionNextRing(mission);
  return ring ? { x: ring.x, y: ring.y, z: ring.z } : null;
}

// --- main loop --------------------------------------------------------------
const clock = new THREE.Clock();
let shotTimer = shot ? shot.holdSeconds : 0;
window.__shotReady = false;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  time += dt;

  // fps meter (real wall-clock time, not clamped dt)
  fpsFrames++;
  const nowMs = performance.now();
  if (nowMs - fpsLast >= 1000) {
    fpsValue = Math.round(fpsFrames * 1000 / (nowMs - fpsLast));
    window.__fps = fpsValue;
    fpsFrames = 0; fpsLast = nowMs;
  }

  // global keys
  if (input.consume('KeyP')) togglePause();
  if (input.consume('KeyR')) restart();
  if (input.consume('KeyM')) { audio.setMuted(!audio.isMuted()); }
  if (input.consume('KeyC')) { cameraRig.toggle(); }
  if (input.consume('Enter') && gameState === 'menu') startGame('rings');
  if (input.consume('Digit1') && gameState === 'menu') startGame('rings');
  if (input.consume('Digit2') && gameState === 'menu') startGame('landing');
  if (input.consume('Digit3') && gameState === 'menu') startGame('timetrial');
  if (input.consume('Enter') && gameState === 'over') showMenu();

  updateClouds(dt);
  animateRings(mission, ringMeshes, time);

  if (gameState === 'playing' || gameState === 'menu') {
    // input: player or autopilot
    let flightInput;
    if (autopilot) {
      flightInput = mission.mode === 'landing'
        ? landingAutopilot(plane, dt)
        : autopilotInput(plane, autopilotTarget(), dt, mission.mode === 'timetrial' ? 0.7 : 0.6);
    } else {
      flightInput = { roll: input.roll, pitch: input.pitch, throttleUp: input.throttleUp, throttleDown: input.throttleDown };
    }
    const event = stepFlight(plane, flightInput, dt);
    const mev = updateMission(mission, plane, dt, ringMeshes, scene);

    // In the menu the attract flight just loops: restart it when it ends.
    if (gameState === 'menu') {
      if (mev === 'complete' || mev === 'timeout' || mev === 'fuel' || event === 'crash') showMenu();
    } else if (event === 'crash') {
      audio.crash();
      if (gameState === 'playing') {
        mission.state = 'done';
        mission.result = { kind: 'crashed', score: mission.score };
        endGame('CRASHED', 'The island claims another one. Mind the terrain — and the fuel gauge.', false);
      }
    } else if (event === 'landed') {
      audio.land();
      if (gameState === 'playing') {
        const soft = Math.abs(plane.verticalSpeed) < 3;
        const centred = Math.abs(plane.pos.z - CONFIG.runway.centerZ) < 6;
        const bonus = CONFIG.missions.landing.baseScore + (soft ? 100 : 0) + (centred ? 100 : 0);
        mission.score += bonus;
        mission.state = 'done';
        mission.result = { kind: 'landed', score: mission.score };
        endGame('TOUCHDOWN!', `Clean landing on runway 09. ${soft ? 'Soft. ' : ''}${centred ? 'Dead centre. ' : ''}Bonus +${bonus}.`, true);
      }
    } else if (event === 'bump') {
      audio.land();
    }
    if (mev === 'ring') audio.ring();
    if (gameState === 'playing') {
      if (mev === 'complete') { audio.win(); endGame('COURSE COMPLETE!', `All 10 rings, with ${Math.round(mission.timeLeft)}s to spare. Time bonus included.`, true); }
      if (mev === 'timeout') {
        if (mission.mode === 'timetrial') endGame('TIME UP!', `You grabbed ${mission.ringsPassed} ring${mission.ringsPassed === 1 ? '' : 's'} in 90 seconds.`, mission.ringsPassed >= 5);
        else endGame('OUT OF TIME', `The clock beat you — ${mission.ringsPassed} ring${mission.ringsPassed === 1 ? '' : 's'} down.`, false);
      }
      if (mev === 'fuel') endGame('OUT OF FUEL', 'The tanks ran dry. Glide her in next time.', false);
    }

    // apply the plane transform
    planeGroup.position.set(plane.pos.x, plane.pos.y, plane.pos.z);
    planeGroup.rotation.set(plane.pitch, plane.yaw, plane.roll, 'YXZ');
    animateAircraft(aircraftParts, dt, plane.throttle, time);
    cameraRig.update(plane, dt);
    // in cockpit view the propeller would sweep across the lens: hide it
    const inCockpit = cameraRig.mode === 'cockpit';
    aircraftParts.prop.visible = !inCockpit;
    aircraftParts.blur.visible = !inCockpit;
    if (gameState === 'playing') hud.update(plane, mission, cameraRig.mode, time);
    audio.update(plane.throttle, plane.speed, gameState === 'playing');
  } else if (gameState === 'over') {
    // keep the world alive behind the game-over panel
    planeGroup.position.set(plane.pos.x, plane.pos.y, plane.pos.z);
    planeGroup.rotation.set(plane.pitch, plane.yaw, plane.roll, 'YXZ');
    animateAircraft(aircraftParts, dt, 0, time);
    audio.update(0, 0, false);
  }

  // screenshot mode: signal readiness after the hold time
  if (shot && !window.__shotReady) {
    shotTimer -= dt;
    if (shotTimer <= 0) window.__shotReady = true;
  }

  renderer.render(scene, cameraRig.camera);
}

window.addEventListener('resize', () => {
  cameraRig.camera.aspect = window.innerWidth / window.innerHeight;
  cameraRig.camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- boot -------------------------------------------------------------------
if (shot) {
  // screenshot run: skip the menu, fly the composed scene with autopilot
  const spawn = startMission(mission, shot.mode);
  Object.assign(spawn, shot.spawn);
  resetFlight(plane, spawn);
  resetRingMeshes(mission, ringMeshes);
  if (params.shot === 'ring') {
    // the composed frame sits right before ring 3: mark rings 1-2 as flown
    mission.nextRing = 2;
    mission.ringsPassed = 2;
    mission.score = 200;
    for (let i = 0; i < 2; i++) {
      ringMeshes[i].material.color.setHex(0x2aff66);
      ringMeshes[i].material.emissive.setHex(0x0a5c22);
    }
  }
  cameraRig.setMode(shot.camera);
  if (shot.chaseDistance) cameraRig.setChaseDistance(shot.chaseDistance);
  cameraRig.snapTo(plane);
  menuEl.style.display = 'none';
  hud.setVisible(true);
  hud.setObjective(shot.mode === 'landing' ? 'LANDING — short final' : 'RING RUN — 10 rings');
  gameState = 'playing';
  autopilot = true;
} else {
  showMenu();
}
animate();
