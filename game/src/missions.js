// SOLMAR CITY — missions.js
// The five-mission story. Each mission is a list of steps; a step is either
// "get in a car", "go to this place", or "wait here a moment". The mission
// module owns the step list and the advance rules; the world owns the player
// and calls updateMission every step. Completing a mission pays cash, shows a
// banner and unlocks the next one; after the fifth, the city is free roam.

import { MISSION_REWARDS, PLACES } from './config.js';

export const MISSIONS = [
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    briefing: 'Lena needs wheels. Steal a parked car, then bring it to her garage.',
    steps: [
      { type: 'enterCar', text: 'Steal a parked car (walk up and press E)' },
      { type: 'goto', place: 'garage', text: 'Drive to Lena\'s Garage' },
    ],
  },
  {
    id: 'payday-run',
    title: 'Payday Run',
    briefing: 'A courier left a payout at Palm Bank. Grab it and get back to the garage — quietly.',
    steps: [
      { type: 'goto', place: 'bank', text: 'Drive to Palm Bank' },
      { type: 'goto', place: 'garage', text: 'Bring the payout to Lena\'s Garage', wantedOnArrive: 1 },
    ],
  },
  {
    id: 'heat-wave',
    title: 'Heat Wave',
    briefing: 'The heat is on. Lose the cops and make it to the Safehouse — it clears your wanted level.',
    steps: [
      { type: 'goto', place: 'safehouse', text: 'Reach the Safehouse with the cops on you', wantedAtStart: 3 },
    ],
  },
  {
    id: 'harbor-job',
    title: 'Harbor Job',
    briefing: 'Crates are waiting at Solmar Harbor. Pick them up and deliver them to the Old Warehouse.',
    steps: [
      { type: 'goto', place: 'harbour', text: 'Drive to Solmar Harbor' },
      { type: 'wait', place: 'harbour', seconds: 2.5, text: 'Loading the crates…' },
      { type: 'goto', place: 'warehouse', text: 'Deliver the crates to the Old Warehouse' },
    ],
  },
  {
    id: 'star-job',
    title: 'The Star Job',
    briefing: 'The Starlight Casino keeps its cash upstairs. Grab the bags and vanish to the Safehouse.',
    steps: [
      { type: 'goto', place: 'casino', text: 'Get to the Starlight Casino' },
      { type: 'wait', place: 'casino', seconds: 3, text: 'Grabbing the money bags…' },
      { type: 'goto', place: 'safehouse', text: 'Escape to the Safehouse', wantedOnArrive: 4 },
    ],
  },
];

export function missionCount() {
  return MISSIONS.length;
}

export function createMissionState(startIndex) {
  return {
    index: Math.min(startIndex, MISSIONS.length - 1),
    step: 0,
    waitLeft: 0,
    done: startIndex >= MISSIONS.length,
    justCompleted: null, // title of the mission completed this step, if any
    started: false,
  };
}

export function currentMission(state) {
  if (state.done) return null;
  return MISSIONS[state.index];
}

export function currentStep(state) {
  const mission = currentMission(state);
  if (!mission) return null;
  return mission.steps[state.step];
}

// The place a step points at, or null for steps with no destination.
export function stepTarget(state) {
  const step = currentStep(state);
  if (!step || !step.place) return null;
  const place = PLACES[step.place];
  return { x: place.x, y: place.y, label: place.name };
}

export function stepText(state) {
  const step = currentStep(state);
  if (!step) return 'Free roam — Solmar City is yours.';
  return step.text;
}

// Start (or restart) the current mission: apply its opening wanted level.
export function startMission(state) {
  const mission = currentMission(state);
  if (!mission) return 0;
  state.started = true;
  const step = mission.steps[0];
  return step && step.wantedAtStart ? step.wantedAtStart : 0;
}

// Advance the story. `context` is what the world knows: whether the player
// is in a car, where they are, and a callback to raise the wanted level.
// Returns the cash earned by a mission completed on this call (0 otherwise).
export function updateMission(state, context, dt) {
  state.justCompleted = null;
  if (state.done) return 0;
  const mission = MISSIONS[state.index];
  const step = mission.steps[state.step];
  if (!step) return 0;

  if (step.type === 'enterCar') {
    if (context.inCar) {
      state.step += 1;
      return 0;
    }
    return 0;
  }

  if (step.type === 'wait') {
    const place = PLACES[step.place];
    const d = Math.hypot(context.x - place.x, context.y - place.y);
    if (d < 190) {
      state.waitLeft -= dt;
      if (state.waitLeft <= 0) {
        state.step += 1;
        state.waitLeft = 0;
        return 0;
      }
    } else {
      state.waitLeft = step.seconds;
    }
    return 0;
  }

  // 'goto' steps: arrive within the place's radius and move on.
  const place = PLACES[step.place];
  const d = Math.hypot(context.x - place.x, context.y - place.y);
  if (d < 200) {
    if (step.wantedOnArrive) context.addWanted(step.wantedOnArrive);
    state.step += 1;
    if (state.step >= mission.steps.length) {
      const reward = MISSION_REWARDS[state.index];
      state.justCompleted = mission.title;
      state.index += 1;
      state.step = 0;
      state.waitLeft = 0;
      if (state.index >= MISSIONS.length) state.done = true;
      else {
        const next = MISSIONS[state.index];
        const first = next.steps[0];
        if (first && first.type === 'wait') state.waitLeft = first.seconds;
        if (first && first.wantedAtStart) context.addWanted(first.wantedAtStart);
      }
      return reward;
    }
    const nextStep = mission.steps[state.step];
    if (nextStep && nextStep.type === 'wait') state.waitLeft = nextStep.seconds;
  }
  return 0;
}

// Reset the wait timer when a mission (re)starts, so a staged scene that
// begins mid-mission does not complete instantly.
export function primeMission(state) {
  const step = currentStep(state);
  if (step && step.type === 'wait') state.waitLeft = step.seconds;
}
