// SKYLANE terrain — one procedural island: sea, beaches, fields, forest,
// rocky mountains, a small town and a runway, plus sky, sun and drifting clouds.
// Every height is deterministic (seeded noise), so the world is identical each load
// and physics can ask heightAt(x, z) for the same ground the mesh shows.
import { CONFIG } from './config.js';

const THREE = window.THREE;

// --- seeded random + value noise -------------------------------------------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise2D(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = (t) => t * t * (3 - 2 * t);
  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const h = (ix, iy) => perm[(perm[ix & 255] + iy) & 255] / 255;
    const u = fade(xf), v = fade(yf);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
  }
  return function fbm(x, y, octaves = 4) {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let o = 0; o < octaves; o++) { sum += noise(x * freq, y * freq) * amp; norm += amp; amp *= 0.5; freq *= 2.03; }
    return sum / norm;
  };
}

const fbm = makeNoise2D(CONFIG.world.seed);
const fieldNoise = makeNoise2D(CONFIG.world.seed + 77);
const R = CONFIG.runway;

// Smoothstep helper for flattening the runway / town pads.
function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function runwayMask(x, z) {
  const dx = Math.abs(x - R.centerX) / (R.length / 2);
  const dz = Math.abs(z - R.centerZ) / (R.width / 2 + 34);
  if (dx > 1.15 || dz > 1.15) return 0;
  return (1 - smoothstep(0.75, 1.15, dx)) * (1 - smoothstep(0.6, 1.15, dz));
}

function townMask(x, z) {
  const d = Math.hypot((x - 180) / 260, (z - 470) / 170);
  return 1 - smoothstep(0.55, 1.0, d);
}

// The ground height. Used by the mesh builder AND by physics collisions.
export function heightAt(x, z) {
  const d = Math.hypot(x, z) / 1180; // island falloff
  const island = 1 - smoothstep(0.55, 1.05, d);
  let h = -8 + island * 26;
  h += fbm(x * 0.0016 + 13.7, z * 0.0016 + 4.2, 4) * 34 * island;
  // mountain ridge in the north-west
  const mx = (x + 620) / 420, mz = (z + 620) / 420;
  const ridge = Math.exp(-(mx * mx + mz * mz));
  h += ridge * 150 * island;
  h += fbm(x * 0.006 + 3.1, z * 0.006 + 9.4, 3) * 7 * island;
  // flatten runway + town pads
  const rm = runwayMask(x, z);
  if (rm > 0) h = h * (1 - rm) + R.height * rm;
  const tm = townMask(x, z);
  if (tm > 0) h = h * (1 - tm) + 10 * tm;
  return h;
}

// --- colours ----------------------------------------------------------------
function groundColor(h, slope, x, z) {
  // returns [r, g, b] 0..1
  if (h < 1.5) return [0.86, 0.78, 0.55]; // sand beach
  if (h < 3.2) return [0.76, 0.72, 0.45]; // wet sand / shallows edge
  const field = fieldNoise(x * 0.004 + 40, z * 0.004 + 9, 2);
  if (h < 55) {
    // patchwork fields: alternate wheat green / meadow green
    if (field > 0.25) return [0.62, 0.68, 0.25]; // wheat
    if (field > -0.1) return [0.32, 0.55, 0.22]; // meadow
    return [0.25, 0.48, 0.28]; // dark meadow
  }
  if (h < 105) return slope > 0.55 ? [0.45, 0.42, 0.38] : [0.16, 0.38, 0.16]; // forest / rock
  if (h < 150) return [0.48, 0.46, 0.43]; // rock
  return [0.94, 0.94, 0.97]; // snow
}

// --- builders ---------------------------------------------------------------
export function buildTerrain(scene) {
  const size = CONFIG.world.size;
  const seg = CONFIG.world.segments;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const h = heightAt(v.x, v.z);
    pos.setY(i, h);
    // slope estimate from neighbours
    const slope = Math.abs(heightAt(v.x + 6, v.z) - h) / 6 + Math.abs(heightAt(v.x, v.z + 6) - h) / 6;
    const c = groundColor(h, slope, v.x, v.z);
    colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'island';
  scene.add(mesh);

  // Sea: a big translucent plane at y = 0 with a second deeper disc below.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(size * 2.4, size * 2.4),
    new THREE.MeshLambertMaterial({ color: 0x1e6f9e, transparent: true, opacity: 0.86 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0;
  sea.name = 'sea';
  scene.add(sea);

  buildRunway(scene);
  buildTown(scene);
  buildTrees(scene);
  buildClouds(scene);
  buildSky(scene);
  return { heightAt };
}

function buildRunway(scene) {
  const g = new THREE.Group();
  g.name = 'runway';
  const y = R.height + 0.15;
  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(R.length, R.width),
    new THREE.MeshLambertMaterial({ color: 0x2b2e33 }),
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(R.centerX, y, R.centerZ);
  g.add(asphalt);
  // centreline dashes
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f5 });
  for (let x = -R.length / 2 + 25; x < R.length / 2 - 10; x += 42) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(20, 1.6), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(R.centerX + x, y + 0.05, R.centerZ);
    g.add(dash);
  }
  // threshold bars at both ends
  for (const end of [-1, 1]) {
    for (let k = -2; k <= 2; k++) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.2), dashMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(R.centerX + end * (R.length / 2 - 16), y + 0.05, R.centerZ + k * 4.4);
      g.add(bar);
    }
  }
  // runway edge lights (small amber posts)
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffc861 });
  for (let x = -R.length / 2 + 12; x <= R.length / 2 - 12; x += 46) {
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), lightMat);
      l.position.set(R.centerX + x, y + 0.8, R.centerZ + s * (R.width / 2 + 2));
      g.add(l);
    }
  }
  // windsock near the runway
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 12, 6),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }),
  );
  pole.position.set(R.centerX - 120, y + 6, R.centerZ - 34);
  g.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 7, 8),
    new THREE.MeshLambertMaterial({ color: 0xff5a2a }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(R.centerX - 116, y + 11, R.centerZ - 34);
  g.add(sock);
  scene.add(g);
}

function buildTown(scene) {
  const rand = mulberry32(CONFIG.world.seed + 5);
  const g = new THREE.Group();
  g.name = 'town';
  const wallColors = [0xf2e8d5, 0xffffff, 0xf5d9a8, 0xe8d8c8];
  const roofColors = [0xc8552e, 0x8a4a2b, 0x5a6b8a, 0x3f6b4a];
  for (let i = 0; i < 46; i++) {
    const x = 180 + (rand() - 0.5) * 420;
    const z = 470 + (rand() - 0.5) * 260;
    if (Math.abs(x - R.centerX) < R.length / 2 + 40 && Math.abs(z - R.centerZ) < 60) continue;
    const w = 9 + rand() * 12, d = 9 + rand() * 10, h = 6 + rand() * 9;
    const y = heightAt(x, z);
    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: wallColors[(rand() * wallColors.length) | 0] }),
    );
    walls.position.set(x, y + h / 2 - 0.5, z);
    walls.rotation.y = rand() * Math.PI;
    g.add(walls);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(w, d) * 0.72, 3.5 + rand() * 2.5, 4),
      new THREE.MeshLambertMaterial({ color: roofColors[(rand() * roofColors.length) | 0] }),
    );
    roof.position.set(x, y + h + 1.2, z);
    roof.rotation.y = walls.rotation.y + Math.PI / 4;
    g.add(roof);
  }
  // church tower with a spire, the town landmark
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(10, 26, 10),
    new THREE.MeshLambertMaterial({ color: 0xf8f4ea }),
  );
  tower.position.set(150, heightAt(150, 430) + 12, 430);
  g.add(tower);
  const spire = new THREE.Mesh(
    new THREE.ConeGeometry(7.5, 12, 4),
    new THREE.MeshLambertMaterial({ color: 0x3f6b8a }),
  );
  spire.position.set(150, heightAt(150, 430) + 31, 430);
  spire.rotation.y = Math.PI / 4;
  g.add(spire);
  scene.add(g);
}

function buildTrees(scene) {
  const rand = mulberry32(CONFIG.world.seed + 11);
  const count = 420;
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 4, 5);
  const canopyGeo = new THREE.ConeGeometry(3.4, 11, 7);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
  const canopyMat = new THREE.MeshLambertMaterial({ color: 0x1e5c26 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  let placed = 0, tries = 0;
  while (placed < count && tries < count * 12) {
    tries++;
    const x = (rand() - 0.5) * 2100;
    const z = (rand() - 0.5) * 2100;
    const h = heightAt(x, z);
    if (h < 6 || h > 100) continue;
    if (Math.abs(x - R.centerX) < R.length / 2 + 30 && Math.abs(z - R.centerZ) < 50) continue;
    if (Math.hypot(x - 180, z - 470) < 240) continue;
    const sc = 0.8 + rand() * 0.9;
    s.set(sc, sc * (0.9 + rand() * 0.4), sc);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
    m.compose(new THREE.Vector3(x, h + 2 * sc, z), q, s);
    trunks.setMatrixAt(placed, m);
    m.compose(new THREE.Vector3(x, h + (4 + 5.5) * sc, z), q, s);
    canopies.setMatrixAt(placed, m);
    placed++;
  }
  trunks.count = placed; canopies.count = placed;
  trunks.name = 'tree-trunks'; canopies.name = 'tree-canopies';
  scene.add(trunks); scene.add(canopies);
}

const clouds = [];
export function buildClouds(scene) {
  const rand = mulberry32(CONFIG.world.seed + 23);
  // unlit basic material: clouds stay bright white from every angle
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.94, fog: false });
  for (let i = 0; i < 16; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + ((rand() * 3) | 0);
    for (let p = 0; p < puffs; p++) {
      const r = 14 + rand() * 22;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
      puff.position.set((rand() - 0.5) * 46, (rand() - 0.5) * 6, (rand() - 0.5) * 22);
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set((rand() - 0.5) * 2200, 190 + rand() * 130, (rand() - 0.5) * 2200);
    cloud.userData.drift = 1.5 + rand() * 2.5;
    clouds.push(cloud);
    scene.add(cloud);
  }
}

export function updateClouds(dt) {
  for (const c of clouds) {
    c.position.x += c.userData.drift * dt;
    if (c.position.x > 1250) c.position.x = -1250;
  }
}

function buildSky(scene) {
  scene.background = new THREE.Color(0x8ec8ee);
  scene.fog = new THREE.Fog(0xcfe2f2, 1000, 2800);
  // gradient dome: pale horizon to deep blue zenith
  const geo = new THREE.SphereGeometry(3200, 24, 16);
  const top = new THREE.Color(0x2f7fc9), bottom = new THREE.Color(0xd8ecf7);
  const colors = new Float32Array(geo.attributes.position.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < geo.attributes.position.count; i++) {
    v.fromBufferAttribute(geo.attributes.position, i);
    const t = Math.min(1, Math.max(0, v.y / 3200 + 0.12));
    const c = bottom.clone().lerp(top, t);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  dome.name = 'sky-dome';
  scene.add(dome);
  // sun disc + glow
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(90, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false }),
  );
  sun.position.set(-1800, 900, -2400);
  sun.lookAt(0, 0, 0);
  sun.name = 'sun';
  scene.add(sun);
}
