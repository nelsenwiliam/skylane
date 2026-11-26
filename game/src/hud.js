// SKYLANE HUD — every instrument is a DOM element, updated from the flight
// state each frame: airspeed, altitude, heading compass, throttle and fuel bars,
// damage, score, timer, ring counter, an attitude indicator canvas, a centre
// message banner and a "next ring" direction arrow with distance.
import { missionNextRing } from './rings.js';

function el(id) { return document.getElementById(id); }

export function createHud() {
  const attitude = el('attitude');
  const actx = attitude.getContext('2d');
  return {
    setVisible(show) { el('hud').style.display = show ? 'block' : 'none'; },
    showBanner(text, sub) {
      const b = el('banner');
      b.querySelector('.banner-title').textContent = text;
      b.querySelector('.banner-sub').textContent = sub || '';
      b.style.display = 'block';
    },
    hideBanner() { el('banner').style.display = 'none'; },
    setObjective(text) { el('objective').textContent = text; },
    update(plane, mission, cameraMode, time) {
      el('speed').textContent = Math.round(plane.speed * 1.94); // knots
      el('alt').textContent = Math.round(plane.pos.y * 3.28); // feet
      const heading = ((-plane.yaw * 180 / Math.PI) % 360 + 360) % 360;
      el('heading').textContent = String(Math.round(heading)).padStart(3, '0') + '°';
      el('throttle-fill').style.width = `${Math.round(plane.throttle * 100)}%`;
      el('fuel-fill').style.width = `${Math.round(plane.fuel)}%`;
      el('fuel-fill').className = 'fill' + (plane.fuel < 25 ? ' low' : '');
      el('damage-fill').style.width = `${Math.round(plane.damage)}%`;
      el('score').textContent = mission.score;
      el('rings').textContent = mission.mode === 'landing' ? '—' : `${mission.ringsPassed}/${mission.mode === 'rings' ? 10 : '∞'}`;
      const t = Math.max(0, Math.ceil(mission.timeLeft));
      el('timer').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
      el('timer').className = t < 30 ? 'warn' : '';
      el('cam-mode').textContent = cameraMode === 'cockpit' ? 'COCKPIT' : 'CHASE';
      el('cockpit-dash').style.display = cameraMode === 'cockpit' ? 'flex' : 'none';
      if (cameraMode === 'cockpit') {
        const needle = (id, frac) => { el(id).style.transform = `rotate(${-120 + Math.max(0, Math.min(1, frac)) * 240}deg)`; };
        needle('needle-spd', (plane.speed * 1.94) / 180);
        needle('needle-alt', (plane.pos.y * 3.28) / 1500);
        needle('needle-thr', plane.throttle);
        needle('needle-fuel', plane.fuel / 100);
      }

      // compass strip: heading ticks slide with heading
      const strip = el('compass-strip');
      let ticks = '';
      for (let d = -60; d <= 60; d += 15) {
        const h = Math.round((heading + d) / 15) * 15;
        const norm = ((h % 360) + 360) % 360;
        const label = norm === 0 ? 'N' : norm === 90 ? 'E' : norm === 180 ? 'S' : norm === 270 ? 'W' : String(norm);
        const off = (h - heading) * 3;
        ticks += `<span style="left:${50 + off}%">${label}</span>`;
      }
      strip.innerHTML = ticks;

      // next-ring arrow: bearing relative to heading, distance in metres
      const ring = missionNextRing(mission);
      const arrow = el('ring-arrow');
      if (ring && mission.state === 'flying') {
        const dx = ring.x - plane.pos.x, dz = ring.z - plane.pos.z;
        const bearing = Math.atan2(-dx, -dz);
        let rel = (bearing - plane.yaw) * 180 / Math.PI;
        rel = ((rel + 540) % 360) - 180;
        const dy = ring.y - plane.pos.y;
        const dist = Math.round(Math.hypot(dx, dy, dz));
        arrow.style.display = 'block';
        arrow.querySelector('.arrow-dir').textContent = rel < -25 ? '◀' : rel > 25 ? '▶' : '▲';
        arrow.querySelector('.arrow-dist').textContent = `${dist}m${dy > 12 ? ' ↑' : dy < -12 ? ' ↓' : ''}`;
      } else {
        arrow.style.display = 'none';
      }

      // message banner from the mission
      if (mission.message && mission.messageUntil > 0) {
        el('message').textContent = mission.message;
        el('message').style.display = 'block';
      } else {
        el('message').style.display = 'none';
      }

      // attitude indicator: horizon line rotated by roll, shifted by pitch
      const w = attitude.width, h = attitude.height;
      actx.clearRect(0, 0, w, h);
      actx.save();
      actx.beginPath(); actx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2); actx.clip();
      actx.translate(w / 2, h / 2);
      actx.rotate(plane.roll);
      const pitchPx = Math.max(-h / 2, Math.min(h / 2, -plane.pitch * 90));
      actx.fillStyle = '#3f8fd2'; actx.fillRect(-w, -h + pitchPx, w * 2, h);
      actx.fillStyle = '#7a5a34'; actx.fillRect(-w, pitchPx, w * 2, h);
      actx.strokeStyle = '#fff'; actx.lineWidth = 2;
      actx.beginPath(); actx.moveTo(-w, pitchPx); actx.lineTo(w, pitchPx); actx.stroke();
      actx.restore();
      actx.strokeStyle = '#ffd23e'; actx.lineWidth = 3;
      actx.beginPath(); actx.moveTo(w / 2 - 14, h / 2); actx.lineTo(w / 2 + 14, h / 2); actx.stroke();
      actx.beginPath(); actx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
      actx.strokeStyle = 'rgba(255,255,255,0.7)'; actx.lineWidth = 2; actx.stroke();
    },
  };
}
