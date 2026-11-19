// SOLMAR CITY — world.js
// The game's rules and state, with no drawing and no browser in it: the
// player on foot and in a car, traffic, pedestrians, police, bullets, the
// wanted level, missions, pickups and particles. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react
// (sounds, announcements) without the world knowing about screens.

import { BEST_KEY, PLAYER, PLACES, POLICE, SAVE_KEY, WORLD, clamp } from './config.js';
import { buildCity, hitsBuilding, isInSea, randomRoadPoint, resolveBuildingCollision } from './city.js';
import { createRandom, createRng } from './random.js';
import { makePlayerCar, separateCars, spawnParkedCar, spawnPoliceCar, spawnTrafficCar, updatePlayerCar, updatePoliceCar, updateTraffic } from './cars.js';
import { makeCop, spawnCopNear, spawnPedestrian, updateCop, updatePedestrian } from './people.js';
import { createMissionState, currentMission, currentStep, primeMission, startMission, stepTarget, updateMission } from './missions.js';

export const EVENT_BUSTED = 1;
export const EVENT_MISSION_DONE = 2;
export const EVENT_WANTED = 4;
export const EVENT_PICKUP = 8;
export const EVENT_SHOT = 16;

const STEP = 1 / 60;

export function createWorld(seed) {
  const rng = createRandom(seed);
  const rngObj = createRng(seed + 101);
  const city = buildCity(seed);
  let playerCar = null;

  const state = {
    seed,
    city,
    time: 0,
    player: {
      x: PLACES.garage.x - 40, y: PLACES.garage.y + 110,
      angle: -Math.PI / 2, health: PLAYER.health, inCar: false,
      shootTimer: 0, aimAngle: 0,
    },
    cars: [],
    peds: [],
    cops: [],
    bullets: [],
    particles: [],
    pickups: [],
    wanted: 0,
    quietTimer: 0,
    cash: 0,
    score: 0,
    // The car the player is driving, or null on foot. The renderer and the
    // screenshot scenes read it from here, never from the closure.
    playerCar: null,
    mission: createMissionState(0),
    banner: null, // {title, sub, timer}
    camera: { x: 0, y: 0 },
    busted: false,
    saveLoaded: false,
  };

  function showBanner(title, sub) {
    state.banner = { title, sub: sub || '', timer: 3.2 };
  }

  function addWanted(n) {
    const before = state.wanted;
    state.wanted = clamp(state.wanted + n, 0, 5);
    state.quietTimer = 0;
    if (state.wanted > before) return true;
    return false;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = rng() * Math.PI * 2;
      const s = rng() * (speed || 160);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + rng() * 0.4, color, size: 2 + rng() * 3 });
    }
    if (state.particles.length > 220) state.particles.splice(0, state.particles.length - 220);
  }

  function spawnCashPickups() {
    state.pickups = [];
    for (let i = 0; i < 6; i += 1) {
      const p = randomRoadPoint(city, rngObj);
      state.pickups.push({ x: p.x, y: p.y, kind: 'cash', taken: false });
    }
  }

  function reset() {
    state.time = 0;
    state.cars = [];
    state.peds = [];
    state.cops = [];
    state.bullets = [];
    state.particles = [];
    state.wanted = 0;
    state.quietTimer = 0;
    state.cash = 0;
    state.score = 0;
    state.busted = false;
    state.banner = null;
    state.player.x = PLACES.garage.x - 40;
    state.player.y = PLACES.garage.y + 110;
    state.player.angle = -Math.PI / 2;
    state.player.health = PLAYER.health;
    state.player.inCar = false;
    state.player.shootTimer = 0;
    playerCar = null;
    state.playerCar = null;
    state.mission = createMissionState(0);
    primeMission(state.mission);
    // Parked cars to steal, traffic on the roads, people on the sidewalks.
    for (let i = 0; i < 10; i += 1) state.cars.push(spawnParkedCar(city, rngObj));
    for (let i = 0; i < 16; i += 1) state.cars.push(spawnTrafficCar(city, rngObj));
    for (let i = 0; i < 30; i += 1) state.peds.push(spawnPedestrian(city, rngObj));
    spawnCashPickups();
    state.camera.x = clamp(state.player.x - 640, 0, WORLD.width - 1280);
    state.camera.y = clamp(state.player.y - 360, 0, WORLD.height - 720);
    const mission = currentMission(state.mission);
    if (mission) showBanner(mission.title, mission.briefing);
  }

  function loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const save = JSON.parse(raw);
      state.cash = save.cash || 0;
      state.score = save.score || 0;
      state.mission = createMissionState(save.missionIndex || 0);
      state.saveLoaded = true;
    } catch {
      // A corrupt save is ignored; the game starts fresh.
    }
  }

  function saveGame() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: state.cash, score: state.score, missionIndex: state.mission.index,
      }));
      const best = Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
      if (state.score > best) window.localStorage.setItem(BEST_KEY, String(state.score));
    } catch {
      // Storage can be off: progress then lasts this visit only.
    }
  }

  function playerPos() {
    if (state.player.inCar && playerCar) return { x: playerCar.x, y: playerCar.y };
    return { x: state.player.x, y: state.player.y };
  }

  function nearestCar(x, y, maxD) {
    let best = null;
    let bestD = maxD;
    for (const car of state.cars) {
      if (car.kind === 'police') continue;
      const d = Math.hypot(car.x - x, car.y - y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function fireBullet(x, y, angle, fromCop) {
    state.bullets.push({
      x, y, angle,
      vx: Math.cos(angle) * PLAYER.bulletSpeed,
      vy: Math.sin(angle) * PLAYER.bulletSpeed,
      life: 1.1, fromCop: !!fromCop, damage: fromCop ? 8 : PLAYER.bulletDamage,
    });
  }

  function stepBullets(dt) {
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) continue;
      if (hitsBuilding(city, b.x, b.y, 2) || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height) {
        b.life = 0;
        burst(b.x, b.y, '#e8d27a', 4, 90);
        continue;
      }
      if (b.fromCop) {
        const pos = playerPos();
        const d = Math.hypot(b.x - pos.x, b.y - pos.y);
        if (d < (state.player.inCar ? 24 : 13)) {
          b.life = 0;
          state.player.health -= b.damage;
          burst(pos.x, pos.y, '#d85a4f', 6, 120);
        }
        continue;
      }
      // Player bullets: police cars, cops, pedestrians, traffic cars.
      for (const car of state.cars) {
        if (Math.hypot(b.x - car.x, b.y - car.y) < car.radius) {
          b.life = 0;
          car.hp -= b.damage;
          burst(b.x, b.y, '#e8e4da', 5, 110);
          if (car.kind === 'police' && car.hp <= 0) {
            state.score += 150;
            addWanted(1);
            burst(car.x, car.y, '#5a5f6b', 22, 260);
          }
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const cop of state.cops) {
        if (!cop.down && Math.hypot(b.x - cop.x, b.y - cop.y) < 13) {
          b.life = 0;
          cop.hp -= b.damage;
          if (cop.hp <= 0) {
            cop.down = true;
            state.score += 100;
            addWanted(1);
          }
          burst(b.x, b.y, '#2f4fd8', 6, 120);
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const ped of state.peds) {
        if (!ped.down && Math.hypot(b.x - ped.x, b.y - ped.y) < 12) {
          b.life = 0;
          ped.down = true;
          addWanted(1);
          burst(b.x, b.y, '#d85a4f', 6, 120);
          break;
        }
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);
  }

  function stepPlayer(dt, input, audio) {
    const p = state.player;
    if (p.shootTimer > 0) p.shootTimer -= dt;

    if (p.inCar && playerCar) {
      const car = playerCar;
      const scraped = updatePlayerCar(car, input, dt, city);
      p.x = car.x;
      p.y = car.y;
      if (scraped && Math.abs(car.speed) > 200 && audio) audio.crash();
      // Ramming pedestrians is a crime, and it hurts.
      for (const ped of state.peds) {
        if (!ped.down && Math.hypot(ped.x - car.x, ped.y - car.y) < car.radius + 8) {
          ped.down = true;
          addWanted(1);
          car.speed *= 0.7;
          burst(ped.x, ped.y, '#d85a4f', 8, 150);
          if (audio) audio.crash();
        }
      }
      // Bumping other cars: both slow down, a hard hit is a crash.
      for (const other of state.cars) {
        if (other === car || other.kind === 'parked') continue;
        if (separateCars(car, other)) {
          if (Math.abs(car.speed) > 180) {
            other.hp -= 20;
            car.speed *= 0.75;
            if (audio) audio.crash();
            if (other.kind === 'police' && other.hp <= 0) {
              state.score += 150;
              addWanted(1);
              burst(other.x, other.y, '#5a5f6b', 22, 260);
            }
          }
        }
      }
      return;
    }

    // On foot: walk, aim at the mouse, shoot on click.
    const v = input.walkVector();
    const len = Math.hypot(v.x, v.y) || 1;
    const moving = v.x !== 0 || v.y !== 0;
    if (moving) {
      p.x += (v.x / len) * PLAYER.walkSpeed * dt;
      p.y += (v.y / len) * PLAYER.walkSpeed * dt;
      p.angle = Math.atan2(v.y, v.x);
    }
    p.x = clamp(p.x, 24, WORLD.width - 24);
    p.y = clamp(p.y, 24, WORLD.height - 24);
    if (isInSea(city, p.x, p.y)) p.x = WORLD.seaX - 24;
    resolveBuildingCollision(city, p, 12);
    if (input.mouseWorld) p.aimAngle = Math.atan2(input.mouseWorld.y - p.y, input.mouseWorld.x - p.x);
    if (input.mouse.down && p.shootTimer <= 0) {
      p.shootTimer = PLAYER.shootCooldown;
      fireBullet(p.x + Math.cos(p.aimAngle) * 20, p.y + Math.sin(p.aimAngle) * 20, p.aimAngle, false);
      addWanted(0); // shooting alone draws attention through the noise below
      state.quietTimer = 0;
      for (const ped of state.peds) {
        if (Math.hypot(ped.x - p.x, ped.y - p.y) < 420) ped.flee = 3;
      }
      if (audio) audio.shoot();
    }
  }

  function enterOrExitCar(input, audio) {
    const p = state.player;
    if (!p.inCar) {
      const car = nearestCar(p.x, p.y, 64);
      if (!car) return;
      const alreadyMine = !!car.mine;
      car.kind = 'player';
      car.mine = true;
      playerCar = car;
      state.playerCar = car;
      p.inCar = true;
      p.x = car.x;
      p.y = car.y;
      if (!alreadyMine) {
        // Stealing a car that was not already yours raises heat.
        if (addWanted(1)) showBanner('WANTED', 'That car was not yours. The police are coming.');
      }
      if (audio) audio.pickup();
    } else if (playerCar) {
      const car = playerCar;
      car.kind = 'parked';
      car.speed = 0;
      playerCar = null;
      state.playerCar = null;
      p.inCar = false;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      p.angle = car.angle;
      resolveBuildingCollision(city, p, 12);
    }
  }

  function stepPolice(dt, audio) {
    const pos = playerPos();
    // Police cars: one per wanted star, up to five.
    const wantCars = state.wanted;
    const liveCars = state.cars.filter((c) => c.kind === 'police' && c.hp > 0).length;
    if (liveCars < wantCars && rng() < dt * 0.9) {
      state.cars.push(spawnPoliceCar(city, rngObj, pos.x, pos.y));
    }
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      updatePoliceCar(car, dt, city, pos.x, pos.y);
      const d = Math.hypot(car.x - pos.x, car.y - pos.y);
      if (d < car.radius + 22 && car.hp > 0) {
        // Ramming the player.
        if (state.player.inCar && playerCar) {
          playerCar.speed *= 0.85;
          state.player.health -= POLICE.ramDamage * dt * 4;
        } else {
          state.player.health -= POLICE.ramDamage * dt * 6;
        }
        if (audio && rng() < dt * 2) audio.crash();
      }
    }
    // Foot cops once the heat is serious.
    const wantCops = state.wanted >= 2 ? state.wanted - 1 : 0;
    const liveCops = state.cops.filter((c) => !c.down).length;
    if (liveCops < wantCops && rng() < dt * 0.7) {
      state.cops.push(spawnCopNear(city, rngObj, pos.x, pos.y));
    }
    for (const cop of state.cops) {
      const shot = updateCop(cop, dt, city, pos.x, pos.y);
      if (shot) {
        fireBullet(shot.x, shot.y, shot.angle, true);
        if (audio) audio.copShoot();
      }
    }
    // Wrecked police cars smoke, then get towed away.
    state.cars = state.cars.filter((c) => !(c.kind === 'police' && c.hp <= 0 && rng() < dt * 0.05));
  }

  function step(dt, input, audio) {
    let events = 0;
    state.time += dt;
    if (state.banner) {
      state.banner.timer -= dt;
      if (state.banner.timer <= 0) state.banner = null;
    }
    for (const pt of state.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);

    // Ambient traffic and pedestrians keep moving even on the title screen.
    for (const car of state.cars) {
      if (car.kind === 'traffic') updateTraffic(car, dt, city, rng);
    }
    for (const ped of state.peds) {
      updatePedestrian(ped, dt, city, rngObj, state.player.x, state.player.y);
    }
    if (!input) {
      const pos = playerPos();
      state.camera.x = clamp(pos.x - 640 + Math.sin(state.time * 0.07) * 220, 0, WORLD.width - 1280);
      state.camera.y = clamp(pos.y - 360 + Math.cos(state.time * 0.05) * 120, 0, WORLD.height - 720);
      return 0;
    }

    // Player, police, bullets, missions.
    const enterPressed = input.takeEnterCar ? input.takeEnterCar() : false;
    stepPlayer(dt, input, audio);
    if (enterPressed) enterOrExitCar(input, audio);
    stepBullets(dt);
    stepPolice(dt, audio);

    // Cash pickups.
    const pos = playerPos();
    for (const pk of state.pickups) {
      if (!pk.taken && Math.hypot(pk.x - pos.x, pk.y - pos.y) < 30) {
        pk.taken = true;
        state.cash += 50;
        state.score += 50;
        events |= EVENT_PICKUP;
        burst(pk.x, pk.y, '#f2c94c', 10, 140);
        if (audio) audio.pickup();
      }
    }

    // The Safehouse clears the heat when the player reaches it.
    const safe = PLACES.safehouse;
    if (state.wanted > 0 && Math.hypot(pos.x - safe.x, pos.y - safe.y) < 210) {
      state.wanted = 0;
      state.quietTimer = 0;
      showBanner('CLEAN', 'The Safehouse cleared your wanted level.');
    }

    // Heat fades when the player stays quiet and no police car is close.
    const nearestPolice = state.cars.reduce((m, c) => (c.kind === 'police' && c.hp > 0
      ? Math.min(m, Math.hypot(c.x - pos.x, c.y - pos.y)) : m), Infinity);
    if (state.wanted > 0 && nearestPolice > 520) {
      state.quietTimer += dt;
      if (state.quietTimer > 14) {
        state.wanted -= 1;
        state.quietTimer = 0;
      }
    } else {
      state.quietTimer = 0;
    }

    // Missions.
    const earned = updateMission(state.mission, {
      inCar: state.player.inCar,
      x: pos.x, y: pos.y,
      addWanted: (n) => { if (addWanted(n)) events |= EVENT_WANTED; },
    }, dt);
    if (earned > 0) {
      state.cash += earned;
      state.score += earned;
      events |= EVENT_MISSION_DONE;
      const done = state.mission.justCompleted;
      if (state.mission.done) {
        showBanner('STORY COMPLETE', 'Solmar City is yours. Free roam!');
      } else if (done) {
        const next = currentMission(state.mission);
        showBanner(`${done} — DONE`, `+$${earned}. Next: ${next ? next.title : ''}`);
      }
      if (audio) audio.jingle();
      saveGame();
    }
    const mission = currentMission(state.mission);
    if (mission && !state.mission.started) {
      const w = startMission(state.mission);
      if (w > 0) addWanted(w);
    }

    // Health: slow recovery when nobody is after the player.
    if (state.wanted === 0 && state.player.health < PLAYER.health) {
      state.player.health = Math.min(PLAYER.health, state.player.health + 2 * dt);
    }
    if (state.player.health <= 0 && !state.busted) {
      state.busted = true;
      events |= EVENT_BUSTED;
      if (audio) {
        audio.busted();
        audio.setSiren(false);
        audio.setEngine(0);
      }
    }

    // Score ticks up with driving.
    if (state.player.inCar && playerCar) state.score += Math.abs(playerCar.speed) * dt * 0.02;

    // Camera follows the player.
    state.camera.x = clamp(pos.x - 640, 0, WORLD.width - 1280);
    state.camera.y = clamp(pos.y - 360, 0, WORLD.height - 720);

    if (audio) {
      audio.setSiren(state.wanted > 0 && !state.busted);
      audio.setEngine(state.player.inCar && playerCar ? Math.abs(playerCar.speed) / PLAYER.carMaxSpeed : 0);
    }
    return events;
  }

  reset();
  return {
    state, reset, step, saveGame, loadSave, showBanner,
    playerPos,
    currentMission: () => currentMission(state.mission),
    currentStep: () => currentStep(state.mission),
    stepTarget: () => stepTarget(state.mission),
    STEP,
  };
}
