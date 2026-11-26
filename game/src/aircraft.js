// SKYLANE aircraft — the plane is built from primitives so it reads as a machine,
// not a triangle: tapered fuselage, cabin with windows, swept wings with tips,
// tailplane + fin, a spinning propeller with a blur disc, nav lights and gear.
// The plane faces -Z in its local space; forward is -Z.
const THREE = window.THREE;

export function buildAircraft() {
  const plane = new THREE.Group();
  plane.name = 'skylane-plane';

  const orange = new THREE.MeshLambertMaterial({ color: 0xff7a1a });
  const white = new THREE.MeshLambertMaterial({ color: 0xf4f1ea });
  const dark = new THREE.MeshLambertMaterial({ color: 0x22303c });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1d4e6b, emissive: 0x0a2a3a });
  const metal = new THREE.MeshLambertMaterial({ color: 0x9aa3ab });

  // fuselage: a tapered cylinder (nose -Z) + rounded nose cone + tail cone
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 5.6, 12), orange);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.set(0, 0, 0.4);
  plane.add(fuselage);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), orange);
  nose.scale.set(1, 1, 1.35);
  nose.position.set(0, 0, -2.4);
  plane.add(nose);
  const tailCone = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.12, 2.6, 10), orange);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.set(0, 0.25, 4.3);
  plane.add(tailCone);

  // cabin hump with windows
  const cabin = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 10), white);
  cabin.scale.set(0.92, 0.72, 1.5);
  cabin.position.set(0, 0.55, -0.6);
  plane.add(cabin);
  const windshield = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8, 0, Math.PI * 2, 0, 0.9), glass);
  windshield.scale.set(0.85, 0.6, 1.1);
  windshield.position.set(0, 0.72, -1.35);
  windshield.rotation.x = -0.5;
  plane.add(windshield);
  for (const s of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.34, 12), glass);
    win.position.set(s * 0.86, 0.62, -0.35);
    win.rotation.y = s * Math.PI / 2;
    plane.add(win);
    const win2 = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), glass);
    win2.position.set(s * 0.8, 0.6, 0.55);
    win2.rotation.y = s * Math.PI / 2;
    plane.add(win2);
  }

  // main wings: low wing, slightly swept, orange tips
  const wingGeo = new THREE.BoxGeometry(11.4, 0.22, 1.9);
  const wing = new THREE.Mesh(wingGeo, white);
  wing.position.set(0, -0.35, 0.1);
  plane.add(wing);
  for (const s of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.24, 1.9), orange);
    tip.position.set(s * 5.35, -0.35, 0.1);
    plane.add(tip);
  }

  // tailplane + vertical fin
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 1.1), white);
  stab.position.set(0, 0.42, 5.2);
  plane.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.7, 1.5), orange);
  fin.position.set(0, 1.05, 5.15);
  fin.rotation.x = -0.15;
  plane.add(fin);

  // propeller: spinner + two blades, spins around Z (forward axis)
  const prop = new THREE.Group();
  prop.name = 'propeller';
  prop.position.set(0, 0, -3.35);
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 10), metal);
  spinner.rotation.x = -Math.PI / 2;
  prop.add(spinner);
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.4, 0.1), bladeMat);
    blade.rotation.z = a;
    blade.position.z = 0.1;
    prop.add(blade);
  }
  plane.add(prop);
  // translucent blur disc, visible at high throttle
  const blur = new THREE.Mesh(
    new THREE.CircleGeometry(1.85, 24),
    new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  blur.position.set(0, 0, -3.4);
  blur.name = 'prop-blur';
  plane.add(blur);

  // nav lights: red left, green right, white tail strobe
  const navLights = {};
  const lightGeo = new THREE.SphereGeometry(0.16, 8, 6);
  navLights.left = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  navLights.left.position.set(-5.7, -0.35, 0.1);
  plane.add(navLights.left);
  navLights.right = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0x20ff60 }));
  navLights.right.position.set(5.7, -0.35, 0.1);
  plane.add(navLights.right);
  navLights.tail = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  navLights.tail.position.set(0, 0.3, 5.6);
  plane.add(navLights.tail);

  // fixed landing gear: two wheels + struts, one tail wheel
  for (const s of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), metal);
    strut.position.set(s * 0.9, -1.15, -0.4);
    plane.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(s * 0.9, -1.7, -0.4);
    plane.add(wheel);
  }

  return { group: plane, prop, blur, navLights };
}

// Per-frame dressing: spin the prop, fade the blur disc in with throttle,
// blink the tail strobe. Called from the main loop.
export function animateAircraft(parts, dt, throttle, time) {
  parts.prop.rotation.z -= dt * (4 + throttle * 55);
  parts.blur.material.opacity = Math.min(0.28, Math.max(0, throttle - 0.25) * 0.45);
  const strobe = (time % 1.2) < 0.12;
  parts.navLights.tail.material.color.setHex(strobe ? 0xffffff : 0x555555);
}
