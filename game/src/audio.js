// SOLMAR CITY — audio.js
// All sound is synthesised with WebAudio: no audio files, no network.
// Engine hum, siren, gunshots, crashes, pickups and a bassline. Every call
// is safe when audio is muted, locked or unavailable (headless screenshots).

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenTimer = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  // The bassline: a slow sunset groove in A minor, one note per beat.
  const BASSLINE = [55, 0, 55, 65.41, 55, 0, 49, 58.27, 55, 0, 55, 65.41, 82.41, 0, 73.42, 65.41];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted || !ensure()) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch {
      // Audio is decoration; a failure never stops the game.
    }
  }

  function noise(dur, vol, lowpass) {
    if (muted || !ensure()) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass || 1200;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.25;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch {
      // See above.
    }
  }

  return {
    get muted() {
      return muted;
    },
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.35;
      return muted;
    },
    shoot() {
      noise(0.12, 0.3, 2400);
      tone(180, 0.09, 'square', 0.12, 60);
    },
    copShoot() {
      noise(0.1, 0.18, 1800);
    },
    crash() {
      noise(0.28, 0.4, 700);
      tone(90, 0.25, 'sawtooth', 0.2, 40);
    },
    explosion() {
      noise(0.6, 0.5, 500);
      tone(60, 0.5, 'sine', 0.3, 30);
    },
    pickup() {
      tone(660, 0.1, 'sine', 0.2);
      setTimeout(() => tone(880, 0.14, 'sine', 0.2), 90);
    },
    jingle() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.22), i * 110));
    },
    busted() {
      [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.16), i * 160));
    },
    // A two-tone siren while the player is wanted; silent otherwise.
    setSiren(on) {
      if (on && !sirenTimer) {
        let high = false;
        sirenTimer = setInterval(() => {
          high = !high;
          tone(high ? 960 : 720, 0.42, 'sine', 0.07);
        }, 430);
      } else if (!on && sirenTimer) {
        clearInterval(sirenTimer);
        sirenTimer = null;
      }
    },
    // Engine hum follows the car's speed; call every frame with 0 when on foot.
    setEngine(speed01) {
      if (muted) return;
      if (speed01 <= 0.02) {
        if (engineOsc) {
          try { engineOsc.stop(); } catch { /* already stopped */ }
          engineOsc = null;
          engineGain = null;
        }
        return;
      }
      if (!ensure()) return;
      try {
        if (!engineOsc) {
          engineOsc = ctx.createOscillator();
          engineOsc.type = 'sawtooth';
          engineGain = ctx.createGain();
          engineGain.gain.value = 0.04;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 500;
          engineOsc.connect(filter);
          filter.connect(engineGain);
          engineGain.connect(master);
          engineOsc.start();
        }
        engineOsc.frequency.setValueAtTime(55 + speed01 * 130, ctx.currentTime);
        engineGain.gain.setValueAtTime(0.03 + speed01 * 0.05, ctx.currentTime);
      } catch {
        // See above.
      }
    },
    startMusic() {
      if (musicTimer) return;
      musicTimer = setInterval(() => {
        if (muted) return;
        const note = BASSLINE[musicStep % BASSLINE.length];
        musicStep += 1;
        if (note) tone(note, 0.42, 'triangle', 0.1);
      }, 430);
    },
    stopMusic() {
      if (musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
    },
  };
}
