// SOLMAR CITY — main.js
// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between five screens: title, play, paused, busted and story complete.
// Save and best score persist in localStorage; the title screen runs the
// living city behind its panel.
//
// ?seed=N fixes the city. ?shot=1|2|3|4 (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.

import { BEST_KEY, SAVE_KEY } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_MISSION_DONE, EVENT_PICKUP } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const VIEW_W = 1280;
const VIEW_H = 720;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  const save = readSave();
  const best = Math.max(readBest(), save ? save.score || 0 : 0);
  const target = world.stepTarget();
  const mission = world.currentMission();
  const title = mission ? `${mission.title} (${world.state.mission.index + 1}/5)` : 'Free Roam';
  const step = mission ? mission.steps[world.state.mission.step] : null;
  const text = step ? step.text : 'Free roam — Solmar City is yours.';
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, best, target, title, text);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Load a saved run: cash, score and the mission reached come back.
  const save = readSave();
  if (save) {
    world.loadSave();
    if (world.state.mission.done) screen = SCREEN_TITLE;
  }

  function announce(message) {
    status.textContent = message;
  }

  function missionLabel() {
    const mission = world.currentMission();
    if (!mission) return { title: 'Free Roam', text: 'Solmar City is yours.' };
    const step = world.currentStep();
    return { title: `${mission.title} (${world.state.mission.index + 1}/5)`, text: step ? step.text : '' };
  }

  function startGame() {
    world.reset();
    world.loadSave();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startMusic();
    const mission = world.currentMission();
    if (mission) world.showBanner(mission.title, mission.briefing);
    const label = missionLabel();
    announce(`Playing. ${label.title}: ${label.text}`);
  }

  function endGame(busted) {
    screen = busted ? SCREEN_BUSTED : SCREEN_COMPLETE;
    world.saveGame();
    if (world.state.score > best) best = Math.floor(world.state.score);
    announce(busted
      ? `Busted. Score ${Math.floor(world.state.score)}. Best ${best}.`
      : `Story complete. Score ${Math.floor(world.state.score)}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_BUSTED || screen === SCREEN_COMPLETE)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.setEngine(0);
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function updateMouseWorld() {
    const rect = canvas.getBoundingClientRect();
    const scaleX = VIEW_W / Math.max(1, rect.width);
    const scaleY = VIEW_H / Math.max(1, rect.height);
    input.mouseWorld.x = world.state.camera.x + input.mouse.x * scaleX;
    input.mouseWorld.y = world.state.camera.y + input.mouse.y * scaleY;
  }

  function step() {
    updateMouseWorld();
    if (screen === SCREEN_TITLE) {
      world.step(1 / 60, null, null);
      return;
    }
    const events = world.step(1 / 60, input, audio);
    if (events & EVENT_BUSTED) endGame(true);
    else if (events & EVENT_MISSION_DONE) {
      if (world.state.mission.done) endGame(false);
      else {
        const label = missionLabel();
        announce(`${label.title}: ${label.text}`);
      }
    } else if (events & EVENT_PICKUP) {
      announce(`Picked up $50. Cash $${world.state.cash}.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= 1 / 60 && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= 1 / 60;
      }
    } else {
      accumulator = 0;
    }
    const label = missionLabel();
    renderer.draw(world.state, screen, best, world.stepTarget(), label.title, label.text);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('SOLMAR CITY. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
