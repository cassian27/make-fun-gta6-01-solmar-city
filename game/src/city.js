// SOLMAR CITY — city.js
// The city itself: a deterministic road grid, seeded buildings, parks, the
// beach and the sea, and the named story places. One job: build the map once
// from a seed, and answer "is this point on a road / inside a building / in
// the water" for everyone else.

import { PALETTE, PLACES, WORLD } from './config.js';
import { createRng } from './random.js';

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function placeRect(place) {
  return { x: place.x - place.w / 2, y: place.y - place.h / 2, w: place.w, h: place.h };
}

export function buildCity(seed) {
  const rng = createRng(seed);
  const buildings = [];
  const parks = [];

  // The story places are buildings too, so the map and the missions agree.
  for (const key of Object.keys(PLACES)) {
    const place = PLACES[key];
    const r = placeRect(place);
    buildings.push({
      x: r.x, y: r.y, w: r.w, h: r.h,
      color: place.color, name: place.name, place: key, roof: place.color,
    });
  }

  // Fill every block between the roads with one or two seeded buildings.
  // A block is the rectangle between two neighbouring vertical roads and two
  // neighbouring horizontal roads, shrunk by the road and sidewalk margins.
  const xs = [0, ...WORLD.roadsV, WORLD.width];
  const ys = [0, ...WORLD.roadsH, WORLD.height];
  for (let ix = 0; ix < xs.length - 1; ix += 1) {
    for (let iy = 0; iy < ys.length - 1; iy += 1) {
      const bx0 = xs[ix] + (ix === 0 ? 40 : WORLD.roadWidth / 2 + 26);
      const bx1 = xs[ix + 1] - (ix === xs.length - 2 ? 40 : WORLD.roadWidth / 2 + 26);
      const by0 = ys[iy] + (iy === 0 ? 40 : WORLD.roadWidth / 2 + 26);
      const by1 = ys[iy + 1] - (iy === ys.length - 2 ? 40 : WORLD.roadWidth / 2 + 26);
      if (bx1 - bx0 < 150 || by1 - by0 < 120) continue;
      // The easternmost strip is beach, not blocks; the harbour corner is a park.
      if (bx0 > WORLD.beachX - 120) continue;
      if (rng.chance(0.22)) {
        parks.push({ x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 });
        continue;
      }
      const count = rng.chance(0.55) ? 2 : 1;
      for (let n = 0; n < count; n += 1) {
        const w = rng.range(120, Math.min(260, bx1 - bx0 - 20));
        const h = rng.range(95, Math.min(190, by1 - by0 - 20));
        const x = count === 1
          ? bx0 + (bx1 - bx0 - w) / 2
          : bx0 + 10 + n * ((bx1 - bx0 - w - 20) / Math.max(1, count - 1));
        const y = by0 + (by1 - by0 - h) / 2 + rng.range(-12, 12);
        const candidate = { x, y, w, h, color: rng.pick(PALETTE.buildingRoof), name: '', place: '', roof: '' };
        candidate.roof = candidate.color;
        const clear = buildings.every((b) => !rectsOverlap(candidate, {
          x: b.x - 14, y: b.y - 14, w: b.w + 28, h: b.h + 28,
        }));
        if (clear) buildings.push(candidate);
      }
    }
  }

  const city = {
    width: WORLD.width,
    height: WORLD.height,
    buildings,
    parks,
    // Road centre lines, for traffic waypoints and the minimap.
    roadsV: [...WORLD.roadsV],
    roadsH: [...WORLD.roadsH],
  };

  return city;
}

// --- Queries ---------------------------------------------------------------

export function isOnRoad(city, x, y) {
  const half = WORLD.roadWidth / 2;
  if (city.roadsV.some((rx) => Math.abs(x - rx) <= half)) return true;
  if (city.roadsH.some((ry) => Math.abs(y - ry) <= half)) return true;
  return false;
}

export function isInSea(city, x, y) {
  return x >= WORLD.seaX;
}

export function isOnBeach(city, x, y) {
  return x >= WORLD.beachX && x < WORLD.seaX;
}

export function buildingAt(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

// True when a circle of radius r at (x, y) touches any building.
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

// Push a circle out of whatever building it overlaps; returns the building
// hit, or null. Call it after moving, once per axis is enough for a top-down game.
export function resolveBuildingCollision(city, body, r) {
  const b = hitsBuilding(city, body.x, body.y, r);
  if (!b) return null;
  const left = body.x - (b.x - r);
  const right = b.x + b.w + r - body.x;
  const top = body.y - (b.y - r);
  const bottom = b.y + b.h + r - body.y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) body.x = b.x - r;
  else if (m === right) body.x = b.x + b.w + r;
  else if (m === top) body.y = b.y - r;
  else body.y = b.y + b.h + r;
  return b;
}

// True when the straight segment between two points crosses a building.
// Used for line of sight: cops only shoot when they can see the player.
export function segmentBlocked(city, ax, ay, bx, by) {
  const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 24);
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (buildingAt(city, ax + (bx - ax) * t, ay + (by - ay) * t)) return true;
  }
  return false;
}

// A random point on a road, for spawning traffic and pedestrians.
export function randomRoadPoint(city, rng) {
  if (rng.chance(0.5)) {
    const rx = rng.pick(city.roadsV);
    return { x: rx + rng.range(-40, 40), y: rng.range(80, city.height - 80) };
  }
  const ry = rng.pick(city.roadsH);
  return { x: rng.range(80, city.width - 260), y: ry + rng.range(-40, 40) };
}

// The nearest road intersection to a point, for traffic waypoints.
export function nearestIntersection(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of city.roadsV) {
    for (const ry of city.roadsH) {
      const d = (rx - x) * (rx - x) + (ry - y) * (ry - y);
      if (d < bestD) {
        bestD = d;
        best = { x: rx, y: ry };
      }
    }
  }
  return best;
}
