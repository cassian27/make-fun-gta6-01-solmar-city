// SOLMAR CITY — people.js
// Everyone on foot: pedestrians who stroll the sidewalks and flee gunfire,
// and foot cops who walk up to the player and shoot when they can see them.
// People are circles (radius 10) with a heading, a speed and a mood.

import { POLICE, angleTo, clamp } from './config.js';
import { randomRoadPoint, resolveBuildingCollision, segmentBlocked } from './city.js';

const PED_COLORS = ['#e8e4da', '#d8b13c', '#7fb069', '#c96f4a', '#9b7ec4', '#4fa8d8'];
const COP_COLOR = '#2f4fd8';

let nextPedId = 1;

export function makePedestrian(x, y, color) {
  return {
    id: nextPedId++,
    kind: 'ped',
    x, y,
    angle: 0,
    speed: 42,
    color: color || '#e8e4da',
    target: null,
    flee: 0, // seconds left of fleeing
    down: false,
    radius: 10,
  };
}

export function makeCop(x, y) {
  const cop = makePedestrian(x, y, COP_COLOR);
  cop.kind = 'cop';
  cop.hp = POLICE.copHp;
  cop.speed = 95;
  cop.shootTimer = 1;
  cop.radius = 11;
  return cop;
}

// Pedestrians stroll to a nearby road point, pause, then pick another.
// A gunshot nearby (flee > 0) makes them run away from it instead.
export function updatePedestrian(ped, dt, city, rng, dangerX, dangerY) {
  if (ped.down) return;
  if (ped.flee > 0) {
    ped.flee -= dt;
    const away = angleTo(dangerX, dangerY, ped.x, ped.y);
    ped.angle = away;
    ped.x += Math.cos(away) * 150 * dt;
    ped.y += Math.sin(away) * 150 * dt;
  } else {
    if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 24) {
      ped.target = randomRoadPoint(city, rng);
      // Pedestrians keep to the sidewalk edge of the road, not its middle.
      ped.target.x = clamp(ped.target.x + (rng.chance(0.5) ? 62 : -62), 30, city.width - 30);
    }
    const want = angleTo(ped.x, ped.y, ped.target.x, ped.target.y);
    ped.angle = want;
    ped.x += Math.cos(want) * ped.speed * dt;
    ped.y += Math.sin(want) * ped.speed * dt;
  }
  ped.x = clamp(ped.x, 24, city.width - 24);
  ped.y = clamp(ped.y, 24, city.height - 24);
  resolveBuildingCollision(city, ped, ped.radius);
}

// Foot cops walk toward the player and shoot when in range with a clear
// line of sight. Returns a bullet request {x, y, angle} when one fires.
export function updateCop(cop, dt, city, playerX, playerY) {
  if (cop.down) return null;
  const d = Math.hypot(playerX - cop.x, playerY - cop.y);
  const want = angleTo(cop.x, cop.y, playerX, playerY);
  cop.angle = want;
  if (d > 130) {
    cop.x += Math.cos(want) * cop.speed * dt;
    cop.y += Math.sin(want) * cop.speed * dt;
    resolveBuildingCollision(city, cop, cop.radius);
  }
  cop.shootTimer -= dt;
  if (cop.shootTimer <= 0 && d < POLICE.copShootRange && !segmentBlocked(city, cop.x, cop.y, playerX, playerY)) {
    cop.shootTimer = POLICE.copShootCooldown;
    return { x: cop.x + Math.cos(want) * 18, y: cop.y + Math.sin(want) * 18, angle: want, fromCop: true };
  }
  return null;
}

export function spawnPedestrian(city, rng) {
  const p = randomRoadPoint(city, rng);
  const ped = makePedestrian(p.x, p.y, rng.pick(PED_COLORS));
  ped.angle = rng.range(0, Math.PI * 2);
  return ped;
}

export function spawnCopNear(city, rng, nearX, nearY) {
  const angle = rng.range(0, Math.PI * 2);
  const d = rng.range(280, 420);
  const cop = makeCop(
    clamp(nearX + Math.cos(angle) * d, 40, city.width - 40),
    clamp(nearY + Math.sin(angle) * d, 40, city.height - 40),
  );
  return cop;
}
