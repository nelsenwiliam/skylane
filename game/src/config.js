// SKYLANE — tuning constants for the flight model, world and missions.
// One place for every number a designer would tweak.
export const CONFIG = {
  world: {
    size: 2400, // terrain spans -1200..1200 on x and z
    seaLevel: 0,
    segments: 128, // terrain mesh resolution (128x128 quads)
    seed: 20261126,
  },
  runway: {
    centerX: 380, centerZ: 260, length: 460, width: 26, height: 8, heading: 0, // along +X
  },
  plane: {
    maxSpeed: 95, // m/s at full throttle
    cruiseSpeed: 55,
    stallSpeed: 24,
    accel: 14, // m/s^2 towards target speed
    maxBank: 1.0, // radians (~57 deg)
    bankRate: 2.2, // rad/s towards target bank
    maxPitch: 0.42, // radians (~24 deg)
    pitchRate: 1.8,
    turnRate: 0.55, // yaw rate per radian of bank, scaled by speed
    climbFactor: 1.0,
    fuelCapacity: 100,
    fuelDrain: 0.55, // per second at full throttle
  },
  missions: {
    rings: { ringCount: 10, timeLimit: 240, ringScore: 100 },
    landing: { timeLimit: 180, baseScore: 300 },
    timetrial: { timeLimit: 90, ringScore: 100 },
  },
  camera: {
    chaseDistance: 16,
    chaseHeight: 5.5,
    chaseSmooth: 5.0,
    cockpitOffset: { x: 0, y: 1.7, z: -1.6 },
  },
};
