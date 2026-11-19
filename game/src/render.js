// SOLMAR CITY — render.js
// Drawing only: the world's state and the current screen in, pixels out.
// A camera follows the player across the 3600x2600 city; the canvas is a
// fixed 1280x720 frame scaled to the window. Flat shapes and canvas text:
// the city, the cars, the people, the HUD with its minimap, mission banners
// and the title / pause / busted screens.

import { PALETTE, PLACES, WORLD } from './config.js';
import { isOnBeach, isOnRoad, isInSea } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_COMPLETE = 'complete';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const VIEW_W = 1280;
const VIEW_H = 720;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;

  function text(value, x, y, size, color, align, bold) {
    ctx.font = `${bold ? '700 ' : ''}${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function drawGround(state) {
    const cam = state.camera;
    const x0 = cam.x;
    const y0 = cam.y;
    const x1 = cam.x + VIEW_W;
    const y1 = cam.y + VIEW_H;
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(x0, y0, VIEW_W, VIEW_H);
    // Sea and beach on the east edge.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(Math.max(x0, WORLD.beachX), y0, Math.max(0, x1 - Math.max(x0, WORLD.beachX)), VIEW_H);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(Math.max(x0, WORLD.seaX), y0, Math.max(0, x1 - Math.max(x0, WORLD.seaX)), VIEW_H);
    ctx.fillStyle = PALETTE.seaDeep;
    for (let y = y0; y < y1; y += 90) {
      ctx.fillRect(Math.max(x0, WORLD.seaX + 40), y + 30, 120, 4);
    }
    // Parks.
    ctx.fillStyle = PALETTE.park;
    for (const park of state.city.parks) ctx.fillRect(park.x, park.y, park.w, park.h);
    // Roads: sidewalk border, asphalt, centre dashes.
    const half = WORLD.roadWidth / 2;
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of state.city.roadsV) ctx.fillRect(rx - half - 10, y0, WORLD.roadWidth + 20, VIEW_H);
    for (const ry of state.city.roadsH) ctx.fillRect(x0, ry - half - 10, VIEW_W, WORLD.roadWidth + 20);
    ctx.fillStyle = PALETTE.road;
    for (const rx of state.city.roadsV) ctx.fillRect(rx - half, y0, WORLD.roadWidth, VIEW_H);
    for (const ry of state.city.roadsH) ctx.fillRect(x0, ry - half, VIEW_W, WORLD.roadWidth);
    ctx.fillStyle = PALETTE.lane;
    for (const rx of state.city.roadsV) {
      for (let y = Math.floor(y0 / 46) * 46; y < y1; y += 46) ctx.fillRect(rx - 2, y, 4, 22);
    }
    for (const ry of state.city.roadsH) {
      for (let x = Math.floor(x0 / 46) * 46; x < x1; x += 46) ctx.fillRect(x, ry - 2, 22, 4);
    }
    // Harbour docks: pale planks over the water at the south-west corner.
    ctx.fillStyle = '#c9b18a';
    ctx.fillRect(330, 2160, 280, 18);
    ctx.fillRect(330, 2210, 200, 18);
    ctx.fillStyle = PALETTE.seaDeep;
    ctx.fillRect(300, 2300, 340, 60);
  }

  function drawBuildings(state) {
    for (const b of state.city.buildings) {
      ctx.fillStyle = '#00000022';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#ffffff22';
      ctx.fillRect(b.x, b.y, b.w, 10);
      // Windows.
      ctx.fillStyle = '#2c3a4a';
      for (let wx = b.x + 14; wx < b.x + b.w - 14; wx += 26) {
        for (let wy = b.y + 20; wy < b.y + b.h - 14; wy += 26) ctx.fillRect(wx, wy, 12, 12);
      }
      if (b.name) {
        ctx.font = `700 15px ${FONT}`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2 + 5);
      }
    }
  }

  function drawCar(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = '#00000030';
    roundRect(ctx, -24, -12, 52, 28, 7);
    ctx.fill();
    ctx.fillStyle = car.color;
    roundRect(ctx, -26, -14, 52, 28, 7);
    ctx.fill();
    // Windshield, roof, headlights.
    ctx.fillStyle = '#1d2f42';
    ctx.fillRect(6, -11, 10, 22);
    ctx.fillStyle = '#00000033';
    ctx.fillRect(-8, -11, 12, 22);
    ctx.fillStyle = '#ffe9a3';
    ctx.fillRect(24, -11, 3, 5);
    ctx.fillRect(24, 6, 3, 5);
    if (car.kind === 'police') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-26, -14, 52, 6);
      ctx.fillStyle = '#d83a2f';
      ctx.fillRect(-4, -16, 8, 4);
      ctx.fillStyle = '#2f6fd8';
      ctx.fillRect(4, -16, 8, 4);
      text('PD', 0, 5, 11, '#ffffff', 'center', true);
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 3;
      roundRect(ctx, -26, -14, 52, 28, 7);
      ctx.stroke();
    }
    if (car.hp !== undefined && car.hp < 100 && car.kind !== 'player') {
      ctx.fillStyle = '#5a5f6b';
      ctx.beginPath();
      ctx.arc(-14, -18, 5 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPerson(ped) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.down) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.rotate(ped.angle);
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222222';
    ctx.beginPath();
    ctx.arc(5, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    if (ped.kind === 'cop') {
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 9px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 3);
    }
    ctx.restore();
  }

  function drawBulletsAndParticles(state) {
    ctx.strokeStyle = '#ffe9a3';
    ctx.lineWidth = 3;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life * 2);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPickups(state) {
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      const bob = Math.sin(state.time * 4 + pk.x) * 3;
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bob, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a5c00';
      ctx.font = `700 12px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + bob + 4);
    }
    // Money bags at the casino while the Star Job is running, crates at the harbour.
    const mission = state.mission;
    if (!mission.done && mission.index === 4) {
      const c = PLACES.casino;
      ctx.fillStyle = '#3f7d4a';
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(c.x - 40 + i * 40, c.y + c.h / 2 + 30, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f2c94c';
        ctx.font = `700 12px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('$', c.x - 40 + i * 40, c.y + c.h / 2 + 34);
        ctx.fillStyle = '#3f7d4a';
      }
    }
  }

  function drawMissionMarker(state, target) {
    if (!target) return;
    const pulse = 1 + Math.sin(state.time * 5) * 0.18;
    const cam = state.camera;
    const sx = target.x - cam.x;
    const sy = target.y - cam.y;
    ctx.save();
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.moveTo(target.x, target.y - 52 * pulse);
    ctx.lineTo(target.x - 10, target.y - 30);
    ctx.lineTo(target.x + 10, target.y - 30);
    ctx.closePath();
    ctx.fill();
    // Off-screen: an arrow at the screen edge points the way.
    if (sx < 0 || sx > VIEW_W || sy < 0 || sy > VIEW_H) {
      const cx = Math.max(60, Math.min(VIEW_W - 60, sx));
      const cy = Math.max(60, Math.min(VIEW_H - 60, sy));
      ctx.translate(cx, cy);
      ctx.rotate(Math.atan2(sy - VIEW_H / 2, sx - VIEW_W / 2));
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -12);
      ctx.lineTo(-10, 12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawAim(state) {
    const p = state.player;
    if (p.inCar) return;
    const cam = state.camera;
    const x = p.x + Math.cos(p.aimAngle) * 34 - cam.x;
    const y = p.y + Math.sin(p.aimAngle) * 34 - cam.y;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 13, y);
    ctx.lineTo(x - 5, y);
    ctx.moveTo(x + 5, y);
    ctx.lineTo(x + 13, y);
    ctx.moveTo(x, y - 13);
    ctx.lineTo(x, y - 5);
    ctx.moveTo(x, y + 5);
    ctx.lineTo(x, y + 13);
    ctx.stroke();
  }

  function drawMinimap(state, target) {
    const mw = 216;
    const mh = 156;
    const mx = VIEW_W - mw - 16;
    const my = VIEW_H - mh - 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.fillStyle = '#101418cc';
    ctx.fillRect(mx - 6, my - 6, mw + 12, mh + 12);
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(mx + WORLD.seaX * sx, my, mw - WORLD.seaX * sx, mh);
    ctx.fillStyle = PALETTE.road;
    for (const rx of state.city.roadsV) ctx.fillRect(mx + rx * sx - 2, my, 4, mh);
    for (const ry of state.city.roadsH) ctx.fillRect(mx, my + ry * sy - 2, mw, 4);
    ctx.fillStyle = '#e8e4da';
    for (const b of state.city.buildings) ctx.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
    if (target) {
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(mx + target.x * sx, my + target.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of state.cars) {
      if (car.kind === 'police') {
        ctx.fillStyle = '#3a86ff';
        ctx.beginPath();
        ctx.arc(mx + car.x * sx, my + car.y * sy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const pos = state.player.inCar && state.playerCar ? { x: state.playerCar.x, y: state.playerCar.y } : { x: state.player.x, y: state.player.y };
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx + pos.x * sx, my + pos.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = `700 12px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText('SOLMAR CITY', mx, my - 10);
  }

  function drawHud(state, target, missionTitle, missionText, best) {
    const p = state.player;
    // Top bar.
    ctx.fillStyle = '#101418b8';
    ctx.fillRect(0, 0, VIEW_W, 64);
    text(`$${state.cash.toLocaleString('en-US')}`, 18, 30, 26, '#f2c94c', 'left', true);
    text(`SCORE ${Math.floor(state.score).toLocaleString('en-US')}`, 18, 54, 15, '#e8e4da');
    text(missionTitle, 300, 28, 20, '#ffffff', 'left', true);
    text(missionText, 300, 52, 15, '#ffd94d');
    // Wanted stars, top right.
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.wanted ? '★' : '☆';
    text(stars, VIEW_W - 18, 32, 26, state.wanted > 0 ? '#ff5a4d' : '#8b93a3', 'right', true);
    text(state.wanted > 0 ? 'WANTED' : 'CLEAN', VIEW_W - 18, 54, 14, state.wanted > 0 ? '#ff5a4d' : '#8b93a3', 'right', true);
    // Health bar, bottom left.
    ctx.fillStyle = '#101418b8';
    ctx.fillRect(16, VIEW_H - 44, 220, 28);
    ctx.fillStyle = '#3a3f46';
    ctx.fillRect(76, VIEW_H - 36, 150, 12);
    ctx.fillStyle = p.health > 50 ? '#5fc96b' : p.health > 25 ? '#e8b13c' : '#d83a2f';
    ctx.fillRect(76, VIEW_H - 36, 150 * Math.max(0, p.health) / 100, 12);
    text('HP', 26, VIEW_H - 24, 15, '#ffffff', 'left', true);
    // Speed, bottom left above the health bar.
    if (p.inCar && state.playerCar) {
      const mph = Math.round(Math.abs(state.playerCar.speed) * 0.24);
      text(`${mph} mph`, 26, VIEW_H - 56, 22, '#ffffff', 'left', true);
      text('IN CAR — E to get out', 120, VIEW_H - 56, 14, '#e8e4da');
    } else {
      text('ON FOOT — E near a car to steal it', 26, VIEW_H - 56, 14, '#e8e4da');
    }
    drawMinimap(state, target);
    // Mission banner.
    if (state.banner) {
      const alpha = Math.min(1, state.banner.timer);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#101418d8';
      const bw = 560;
      ctx.fillRect((VIEW_W - bw) / 2, 84, bw, 64);
      ctx.fillStyle = '#ffd94d';
      ctx.fillRect((VIEW_W - bw) / 2, 84, 6, 64);
      text(state.banner.title, VIEW_W / 2, 112, 24, '#ffffff', 'center', true);
      if (state.banner.sub) text(state.banner.sub, VIEW_W / 2, 136, 15, '#ffd94d', 'center');
      ctx.globalAlpha = 1;
    }
    if (best > 0) text(`BEST ${best.toLocaleString('en-US')}`, VIEW_W - 250, VIEW_H - 24, 13, '#8b93a3', 'right');
  }

  function drawPanel(title, lines, prompt) {
    ctx.fillStyle = '#101418cc';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 640;
    const h = 150 + lines.length * 32;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    ctx.fillStyle = '#1d2733';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#e07840';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    text(title, VIEW_W / 2, y + 62, 44, '#ffffff', 'center', true);
    lines.forEach((line, i) => text(line, VIEW_W / 2, y + 108 + i * 32, 19, '#e8e4da', 'center'));
    text(prompt, VIEW_W / 2, y + h - 28, 20, '#ffd94d', 'center', true);
  }

  function draw(state, screen, best, target, missionTitle, missionText) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#101418';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const cam = state.camera;
    ctx.setTransform(1, 0, 0, 1, -cam.x, -cam.y);
    drawGround(state);
    drawBuildings(state);
    drawPickups(state);
    drawMissionMarker(state, target);
    // Parked and traffic cars under the player, police above the traffic.
    for (const car of state.cars) {
      if (car.kind === 'police') continue;
      drawCar(car, car.kind === 'player');
    }
    for (const ped of state.peds) drawPerson(ped);
    for (const cop of state.cops) drawPerson(cop);
    // The player on foot, then the police cars on top.
    const p = state.player;
    if (!p.inCar) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = '#e07840';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222222';
      ctx.beginPath();
      ctx.arc(6, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const car of state.cars) {
      if (car.kind === 'police') drawCar(car, false);
    }
    drawBulletsAndParticles(state);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawAim(state);
    if (screen === SCREEN_TITLE) {
      // The living city runs behind the title panel.
      drawPanel('SOLMAR CITY', [
        'Sunset Getaway — an original open-world crime game',
        'Drive, steal, run missions and outrun the police across Solmar City.',
        'WASD drive / walk · Mouse aim · Click shoot · E steal a car',
        'Space handbrake · P pause · M mute',
        best > 0 ? `Best score ${best.toLocaleString('en-US')}` : 'No save yet — make your first getaway.',
      ], 'Press Enter to start');
      return;
    }
    drawHud(state, target, missionTitle, missionText, best);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for you.', 'Your progress is saved when a mission ends.'], 'Press P to resume');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', [
        `The Solmar police caught up with you.`,
        `Cash $${state.cash.toLocaleString('en-US')} · Score ${Math.floor(state.score).toLocaleString('en-US')}`,
      ], 'Press Enter to try again');
    } else if (screen === SCREEN_COMPLETE) {
      drawPanel('STORY COMPLETE', [
        'You finished all five missions. Solmar City is yours.',
        `Cash $${state.cash.toLocaleString('en-US')} · Score ${Math.floor(state.score).toLocaleString('en-US')}`,
      ], 'Press Enter to keep roaming');
    }
  }

  return { draw };
}
