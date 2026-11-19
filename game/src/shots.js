// SOLMAR CITY — shots.js
// The screenshot scenes behind ?shot=1|2|3|4 (also ?shot=start|drive|chase|
// mission). Each one plays the real rules forward from a fresh world for a
// fixed number of steps, steered by a simple autopilot, so the frame is what
// a short game really looks like and the same seed always gives the same
// frame. No scene is drawn by hand: every pixel comes from the game itself.

import { PLACES } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { MISSIONS } from './missions.js';
import { makePlayerCar } from './cars.js';
import { spawnPoliceCar } from './cars.js';

const STEP = 1 / 60;

// Drive the player's car toward a target for a while, using the same
// steering the player would: throttle on, steer toward the waypoint.
function autopilotDrive(world, targetX, targetY, seconds) {
  const input = {
    drive: 1, steer: 0, handbrake: false,
    walkVector: () => ({ x: 0, y: 0 }),
    mouse: { down: false, x: 0, y: 0 },
    mouseWorld: null,
    takeEnterCar: () => false,
  };
  const state = world.state;
  for (let i = 0; i < seconds / STEP; i += 1) {
    const car = state.playerCar;
    if (!car) break;
    const want = Math.atan2(targetY - car.y, targetX - car.x);
    let d = want - car.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    input.steer = d > 0.12 ? 1 : d < -0.12 ? -1 : 0;
    world.step(STEP, input, null);
  }
}

function givePlayerCar(world, x, y, angle) {
  const state = world.state;
  const car = makePlayerCar(x, y, angle);
  state.cars.push(car);
  state.playerCar = car;
  state.player.inCar = true;
  state.player.x = x;
  state.player.y = y;
  return car;
}

function idle(world, seconds) {
  const input = {
    drive: 0, steer: 0, handbrake: false,
    walkVector: () => ({ x: 0, y: 0 }),
    mouse: { down: false, x: 0, y: 0 },
    mouseWorld: null,
    takeEnterCar: () => false,
  };
  for (let i = 0; i < seconds / STEP; i += 1) world.step(STEP, input, null);
}

// Set `world` to the named scene and return the screen to draw over it.
export function stageShot(name, world) {
  const scene = name === '2' || name === 'drive' ? 'drive'
    : name === '3' || name === 'chase' ? 'chase'
      : name === '4' || name === 'mission' ? 'mission' : 'start';
  const state = world.state;

  if (scene === 'start') {
    world.reset();
    // Let the title backdrop's traffic and pedestrians settle for 5 seconds.
    for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, null, null);
    return { screen: SCREEN_TITLE, best: 0 };
  }

  if (scene === 'drive') {
    world.reset();
    // Mission 1: steal a car and drive toward Lena's Garage.
    state.mission.index = 0;
    state.mission.step = 1;
    state.mission.started = true;
    world.showBanner(MISSIONS[0].title, MISSIONS[0].briefing);
    givePlayerCar(world, 700, 940, 0);
    // Drive east along the road past the garage, so the frame catches the
    // car mid-drive with the mission marker on the garage beside it.
    autopilotDrive(world, 1500, 940, 2.6);
    idle(world, 0.1);
    if (state.playerCar) state.playerCar.speed = 230;
    return { screen: SCREEN_PLAY, best: 0 };
  }

  if (scene === 'chase') {
    world.reset();
    state.mission.index = 2;
    state.mission.step = 0;
    state.mission.started = true;
    world.showBanner(MISSIONS[2].title, MISSIONS[2].briefing);
    state.wanted = 3;
    state.cash = 1250;
    state.score = 1840;
    givePlayerCar(world, 1500, 1460, 0.3);
    // Three police cars in pursuit, spread out behind on the same road.
    const chaseOffsets = [[-300, -40], [-460, 50], [-620, -10]];
    for (let i = 0; i < 3; i += 1) {
      const car = spawnPoliceCar(world.state.city, { pick: (l) => l[0], chance: () => false, range: (a, b) => a }, 1500, 1460);
      car.x = 1500 + chaseOffsets[i][0];
      car.y = 1460 + chaseOffsets[i][1];
      state.cars.push(car);
    }
    autopilotDrive(world, 2100, 1460, 2.0);
    idle(world, 0.1);
    if (state.playerCar) state.playerCar.speed = 250;
    return { screen: SCREEN_PLAY, best: 1840 };
  }

  // mission: the Star Job at the casino, four wanted stars, bags on the ground.
  world.reset();
  state.mission.index = 4;
  state.mission.step = 1;
  state.mission.started = true;
  state.mission.waitLeft = 2.5;
  world.showBanner(MISSIONS[4].title, MISSIONS[4].briefing);
  state.wanted = 4;
  state.cash = 4300;
  state.score = 6920;
  state.player.x = PLACES.casino.x;
  state.player.y = PLACES.casino.y + PLACES.casino.h / 2 + 90;
  state.player.inCar = false;
  state.player.aimAngle = -Math.PI / 2;
  for (let i = 0; i < 2; i += 1) {
    const car = spawnPoliceCar(world.state.city, { pick: (l) => l[0], chance: () => false, range: (a, b) => a }, PLACES.casino.x, PLACES.casino.y);
    car.x = PLACES.casino.x - 320 + i * 640;
    car.y = PLACES.casino.y + 260;
    state.cars.push(car);
  }
  idle(world, 1.2);
  return { screen: SCREEN_PLAY, best: 6920 };
}
