// SOLMAR CITY — cars.js
// Everything with four wheels: the player's car physics, traffic that drives
// the road grid, parked cars to steal, and police cars that chase and ram.
// Cars are circles for collision (radius 22) with a heading and a speed.

import { PLAYER, POLICE, TRAFFIC, angleDiff, angleTo, clamp } from './config.js';
import { hitsBuilding, nearestIntersection, resolveBuildingCollision } from './city.js';
import { createRng } from './random.js';

const CAR_COLORS = ['#e8b13c', '#4fa8d8', '#d85a4f', '#e8e4da', '#7fb069', '#9b7ec4', '#d88a3c'];
const POLICE_COLOR = '#2f6fd8';
const PLAYER_COLOR = '#e07840';

let nextCarId = 1;

export function makeCar(kind, x, y, angle, color) {
  return {
    id: nextCarId++,
    kind, // 'player' | 'traffic' | 'parked' | 'police'
    x, y, angle,
    speed: 0,
    color: color || '#888888',
    hp: kind === 'police' ? POLICE.carHp : 100,
    radius: 22,
    target: null, // traffic waypoint (an intersection)
    stuck: 0,
    honk: 0,
    mine: false, // true once the player has owned this car
  };
}

export function makePlayerCar(x, y, angle) {
  const car = makeCar('player', x, y, angle, PLAYER_COLOR);
  car.mine = true;
  return car;
}

function driveForward(car, dt, accel, maxSpeed, turnInput) {
  car.speed = clamp(car.speed + accel * dt, -PLAYER.carReverse, maxSpeed);
  const steer = turnInput * PLAYER.carTurn * clamp(Math.abs(car.speed) / 120, 0.25, 1);
  car.angle += steer * dt * (car.speed >= 0 ? 1 : -1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

function applyDrag(car, dt, rate) {
  if (car.speed > 0) car.speed = Math.max(0, car.speed - rate * dt);
  else if (car.speed < 0) car.speed = Math.min(0, car.speed + rate * dt);
}

// The player's car: W/S (or up/down) throttle and brake, A/D steering,
// Space handbrake. Returns true when the car scraped a building.
export function updatePlayerCar(car, input, dt, city) {
  const throttle = input.drive; // -1 reverse/brake, 0 coast, 1 throttle
  const steer = input.steer; // -1 left, 1 right
  if (throttle > 0) driveForward(car, dt, PLAYER.carAccel, PLAYER.carMaxSpeed, steer);
  else if (throttle < 0) {
    if (car.speed > 30) {
      car.speed = Math.max(0, car.speed - PLAYER.carBrake * dt);
      car.angle += steer * PLAYER.carTurn * 0.5 * dt;
    } else driveForward(car, dt, -PLAYER.carAccel * 0.55, PLAYER.carMaxSpeed, steer);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
  } else {
    applyDrag(car, dt, 150);
    car.angle += steer * PLAYER.carTurn * clamp(Math.abs(car.speed) / 140, 0, 1) * dt * (car.speed >= 0 ? 1 : -1);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
  }
  if (input.handbrake) {
    applyDrag(car, dt, 700);
  }
  car.x = clamp(car.x, 30, city.width - 30);
  car.y = clamp(car.y, 30, city.height - 30);
  const hit = resolveBuildingCollision(city, car, car.radius);
  if (hit && Math.abs(car.speed) > 120) car.speed *= 0.55;
  return hit !== null;
}

// Traffic: each car drives from intersection to intersection along the grid.
// Waypoints are always on roads, so traffic never cuts through buildings.
export function updateTraffic(car, dt, city, rng) {
  if (!car.target) car.target = nearestIntersection(city, car.x, car.y);
  const d = Math.hypot(car.target.x - car.x, car.target.y - car.y);
  if (d < 26) {
    const options = [];
    for (const rx of city.roadsV) options.push({ x: rx, y: car.target.y });
    for (const ry of city.roadsH) options.push({ x: car.target.x, y: ry });
    // Pick a neighbouring intersection on the same road, at random.
    const next = options.filter((o) => Math.hypot(o.x - car.target.x, o.y - car.target.y) > 100
      && Math.hypot(o.x - car.target.x, o.y - car.target.y) < 900);
    car.target = next.length ? next[Math.floor(rng() * next.length)] : nearestIntersection(city, car.x + 400, car.y);
    return;
  }
  const want = angleTo(car.x, car.y, car.target.x, car.target.y);
  car.angle += clamp(angleDiff(car.angle, want), -2.2 * dt, 2.2 * dt);
  car.speed = TRAFFIC.speed;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

// Police: steer straight at the player and ram. A police car that is wrecked
// (hp <= 0) stops and smokes; the world removes it after a while.
export function updatePoliceCar(car, dt, city, targetX, targetY) {
  if (car.hp <= 0) {
    car.speed *= 0.9;
    return;
  }
  const want = angleTo(car.x, car.y, targetX, targetY);
  car.angle += clamp(angleDiff(car.angle, want), -3.1 * dt, 3.1 * dt);
  car.speed = POLICE.carSpeed;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 30, city.width - 30);
  car.y = clamp(car.y, 30, city.height - 30);
  resolveBuildingCollision(city, car, car.radius);
}

// Keep two cars from overlapping: push them apart along the line between them.
export function separateCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = a.radius + b.radius - 4;
  if (d === 0 || d >= min) return false;
  const push = (min - d) / 2;
  const nx = dx / d;
  const ny = dy / d;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  return true;
}

// Spawn a parked car on a roadside lot: near a road, clear of buildings.
// Retries until the spot is clear, so a parked car is never inside a wall
// and the player can always walk up to it and steal it.
export function spawnParkedCar(city, rng) {
  for (let tries = 0; tries < 30; tries += 1) {
    const roadX = rng.pick(city.roadsV);
    const roadY = rng.pick(city.roadsH);
    const horizontal = rng.chance(0.5);
    const offset = rng.range(66, 92) * (rng.chance(0.5) ? 1 : -1);
    const x = horizontal ? rng.range(200, city.width - 500) : roadX + offset;
    const y = horizontal ? roadY + offset : rng.range(200, city.height - 200);
    if (hitsBuilding(city, x, y, 30)) continue;
    if (x > 3180) continue; // never park on the beach
    return makeCar('parked', x, y, horizontal ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2), rng.pick(CAR_COLORS));
  }
  // Fallback: a car in the middle of a road is always reachable.
  const roadX = rng.pick(city.roadsV);
  return makeCar('parked', roadX, rng.range(300, city.height - 300), Math.PI / 2, rng.pick(CAR_COLORS));
}

export function spawnTrafficCar(city, rng) {
  const rx = rng.pick(city.roadsV);
  const ry = rng.pick(city.roadsH);
  const car = makeCar('traffic', rx, rng.range(100, city.height - 100), rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2, rng.pick(CAR_COLORS));
  car.target = { x: rx, y: ry };
  return car;
}

export function spawnPoliceCar(city, rng, nearX, nearY) {
  // Police arrive from a road a few hundred metres away, never on top of the player.
  let x = nearX;
  let y = nearY;
  for (let tries = 0; tries < 12; tries += 1) {
    const rx = rng.pick(city.roadsV);
    const ry = rng.pick(city.roadsH);
    x = rx;
    y = ry;
    if (Math.hypot(x - nearX, y - nearY) > 420) break;
  }
  const car = makeCar('police', x, y, angleTo(x, y, nearX, nearY), POLICE_COLOR);
  return car;
}

export { createRng, TRAFFIC };
