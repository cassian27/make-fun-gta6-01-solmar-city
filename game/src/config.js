// SOLMAR CITY — config.js
// Tuning, palette, city constants, save keys and story-place data.
// One job: every number the rest of the game shares lives here.

export const WORLD = {
  width: 3600,
  height: 2600,
  roadWidth: 116,
  roadsV: [420, 980, 1540, 2100, 2660, 3080],
  roadsH: [420, 940, 1460, 1980, 2320],
  beachX: 3180, // sand starts here
  seaX: 3320, // open water starts here
};

export const PALETTE = {
  grass: '#79b264',
  grassDark: '#6aa355',
  park: '#4f9e57',
  road: '#3c3f46',
  roadEdge: '#2c2f36',
  lane: '#e8d27a',
  sidewalk: '#b9b3a4',
  sand: '#e8cf9a',
  sea: '#2f7fb8',
  seaDeep: '#256b9e',
  buildingRoof: ['#c96f4a', '#d9a05b', '#7d8ba8', '#b0576b', '#5f8f7b', '#a8835f'],
  buildingWall: '#e6dcc8',
  garage: '#e07840',
  casino: '#c94f7c',
  warehouse: '#8a7d6b',
  hospital: '#e8e8e8',
  bank: '#d9c27a',
  harbour: '#5b7d8a',
};

export const PLAYER = {
  walkSpeed: 205,
  health: 100,
  shootCooldown: 0.22,
  bulletSpeed: 780,
  bulletDamage: 34,
  carAccel: 430,
  carReverse: 220,
  carMaxSpeed: 365,
  carTurn: 2.6,
  carBrake: 620,
};

export const TRAFFIC = {
  count: 16,
  speed: 135,
  maxSpeed: 165,
};

export const POLICE = {
  carSpeed: 375,
  carHp: 120,
  ramDamage: 9,
  copHp: 50,
  copShootRange: 420,
  copShootCooldown: 1.15,
};

export const SAVE_KEY = 'solmar-city-save-v1';
export const BEST_KEY = 'solmar-city-best-v1';

// Named story places. Each is a building-sized lot the missions point at.
// Coordinates are the centre of the place; w/h are its footprint.
export const PLACES = {
  garage: { name: "Lena's Garage", x: 880, y: 830, w: 190, h: 130, color: PALETTE.garage },
  safehouse: { name: 'Safehouse', x: 330, y: 1880, w: 160, h: 115, color: '#7d8ba8' },
  harbour: { name: 'Solmar Harbor', x: 470, y: 2240, w: 230, h: 130, color: PALETTE.harbour },
  casino: { name: 'Starlight Casino', x: 2010, y: 830, w: 250, h: 165, color: PALETTE.casino },
  warehouse: { name: 'Old Warehouse', x: 2570, y: 1880, w: 230, h: 145, color: PALETTE.warehouse },
  hospital: { name: 'Solmar General', x: 1450, y: 1360, w: 200, h: 135, color: PALETTE.hospital },
  bank: { name: 'Palm Bank', x: 1450, y: 830, w: 185, h: 125, color: PALETTE.bank },
};

export const MISSION_REWARDS = [400, 900, 1200, 1800, 5000];

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Shortest signed turn from angle `from` towards `to`.
export function angleDiff(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
