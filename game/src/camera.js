// SKYLANE camera — two views that never fight the pilot:
//   chase:   sits behind and above the plane, eases to the plane's heading,
//            banks a little with it, and widens its field of view with speed
//   cockpit: sits in the cockpit and looks straight out over the nose
import { CONFIG } from './config.js';
import { forwardVector } from './physics.js';

const THREE = window.THREE;

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(62, 1280 / 720, 0.1, 7000);
  let mode = 'chase'; // 'chase' | 'cockpit'
  let chaseDist = CONFIG.camera.chaseDistance;
  const chasePos = new THREE.Vector3(0, 130, -680);
  return {
    camera,
    get mode() { return mode; },
    toggle() { mode = mode === 'chase' ? 'cockpit' : 'chase'; return mode; },
    setMode(m) { mode = m; },
    // Screenshot shots may pull the chase camera closer so the plane reads
    // bigger; normal play always uses the CONFIG distance.
    setChaseDistance(d) { chaseDist = d; },
    update(plane, dt) {
      const fwd = forwardVector(plane);
      if (mode === 'cockpit') {
        const off = CONFIG.camera.cockpitOffset;
        // cockpit sits in the plane: rotate the offset by yaw and roll
        const cy = Math.cos(plane.yaw), sy = Math.sin(plane.yaw);
        const ox = off.x * cy - off.z * sy;
        const oz = off.x * sy + off.z * cy;
        camera.position.set(plane.pos.x + ox, plane.pos.y + off.y, plane.pos.z + oz);
        camera.up.set(Math.sin(plane.roll) * -0.6, Math.cos(plane.roll), 0);
        camera.lookAt(
          plane.pos.x + fwd.x * 60,
          plane.pos.y + fwd.y * 60,
          plane.pos.z + fwd.z * 60,
        );
        camera.fov += (58 + plane.speed * 0.12 - camera.fov) * Math.min(1, dt * 4);
        camera.updateProjectionMatrix();
      } else {
        const dist = chaseDist;
        const h = CONFIG.camera.chaseHeight;
        const tx = plane.pos.x - fwd.x * dist;
        const ty = plane.pos.y - fwd.y * dist + h;
        const tz = plane.pos.z - fwd.z * dist;
        const k = Math.min(1, CONFIG.camera.chaseSmooth * dt);
        chasePos.x += (tx - chasePos.x) * k;
        chasePos.y += (ty - chasePos.y) * k;
        chasePos.z += (tz - chasePos.z) * k;
        camera.position.copy(chasePos);
        camera.up.set(Math.sin(plane.roll) * -0.35, Math.cos(plane.roll), 0);
        camera.lookAt(
          plane.pos.x + fwd.x * 18,
          plane.pos.y + fwd.y * 18 + 1,
          plane.pos.z + fwd.z * 18,
        );
        camera.fov += (62 + plane.speed * 0.14 - camera.fov) * Math.min(1, dt * 4);
        camera.updateProjectionMatrix();
      }
    },
    snapTo(plane) {
      const fwd = forwardVector(plane);
      chasePos.set(
        plane.pos.x - fwd.x * chaseDist,
        plane.pos.y - fwd.y * chaseDist + CONFIG.camera.chaseHeight,
        plane.pos.z - fwd.z * chaseDist,
      );
      camera.position.copy(chasePos);
    },
  };
}
