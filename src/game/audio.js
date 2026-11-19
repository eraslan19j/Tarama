const NOTE = 440;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

/** Small procedural sound engine: no external audio assets, no autoplay assumptions. */
export function createAudio() {
  let context = null;
  let master = null;
  let ambienceGain = null;
  let muted = false;
  let started = false;
  let musicClock = 0;
  let musicStep = 0;
  let intensity = 0;
  let noiseBuffer = null;

  function makeNoiseBuffer(ctx) {
    const length = Math.floor(ctx.sampleRate * 1.4);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 0.35;
    }
    return buffer;
  }

  function makeNoise(ctx, duration, volume, filterType = 'bandpass', frequency = 900) {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = false;
    source.playbackRate.value = 1 + Math.random() * 0.3;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = 1.15;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(gain).connect(master);
    source.start(now);
    source.stop(now + duration + 0.02);
    return { filter, gain };
  }

  function tone(frequency, duration, volume = 0.08, type = 'sine', glideTo = null, delay = 0) {
    if (!context || muted) return;
    const now = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, now + duration * 0.85);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + Math.min(0.025, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function startAmbience() {
    if (!context) return;
    const ctx = context;
    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuffer;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 320;
    windFilter.Q.value = 0.4;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.018;
    wind.connect(windFilter).connect(windGain).connect(ambienceGain);
    wind.start();

    const droneA = ctx.createOscillator();
    const droneB = ctx.createOscillator();
    const droneGain = ctx.createGain();
    const droneFilter = ctx.createBiquadFilter();
    droneA.type = 'sine';
    droneB.type = 'triangle';
    droneA.frequency.value = NOTE / 4;
    droneB.frequency.value = NOTE / 4 * 1.4983;
    droneGain.gain.value = 0.022;
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 520;
    droneA.connect(droneGain);
    droneB.connect(droneGain);
    droneGain.connect(droneFilter).connect(ambienceGain);
    droneA.start();
    droneB.start();

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 0.009;
    lfo.connect(lfoGain).connect(windGain.gain);
    lfo.start();
  }

  function unlock() {
    if (started) {
      if (context?.state === 'suspended') context.resume().catch(() => {});
      return true;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    try {
      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      ambienceGain = context.createGain();
      ambienceGain.gain.value = 0.6;
      ambienceGain.connect(master);
      noiseBuffer = makeNoiseBuffer(context);
      startAmbience();
      if (context.state === 'suspended') context.resume().catch(() => {});
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function play(name, options = {}) {
    if (!started || muted || !context || context.state !== 'running') return;
    const { power = 1 } = options;
    switch (name) {
      case 'attack': {
        const swoosh = makeNoise(context, 0.19, 0.09 * power, 'bandpass', 1500 + power * 500);
        swoosh.filter.frequency.exponentialRampToValueAtTime(280, context.currentTime + 0.18);
        tone(180, 0.1, 0.025, 'sawtooth', 90);
        break;
      }
      case 'hit':
        makeNoise(context, 0.12, 0.12, 'lowpass', 1300);
        tone(110, 0.14, 0.07, 'square', 55);
        break;
      case 'crit':
        makeNoise(context, 0.22, 0.15, 'bandpass', 2100);
        tone(320, 0.2, 0.06, 'sawtooth', 110);
        break;
      case 'shield':
        tone(820, 0.16, 0.055, 'triangle', 410);
        tone(1240, 0.11, 0.035, 'sine', 620);
        makeNoise(context, 0.09, 0.05, 'highpass', 2200);
        break;
      case 'block':
        tone(540, 0.12, 0.05, 'square', 280);
        makeNoise(context, 0.1, 0.07, 'bandpass', 1800);
        break;
      case 'dodge':
        makeNoise(context, 0.24, 0.06, 'bandpass', 650);
        break;
      case 'jump':
        tone(210, 0.12, 0.035, 'sine', 380);
        break;
      case 'land':
        makeNoise(context, 0.1, 0.06, 'lowpass', 360);
        tone(75, 0.09, 0.035, 'sine', 48);
        break;
      case 'step':
        makeNoise(context, 0.075, 0.025 * power, 'lowpass', 420);
        tone(68, 0.06, 0.018, 'sine', 48);
        break;
      case 'sigil':
        [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
          tone(frequency, 0.45, 0.045, 'sine', frequency * 1.01, index * 0.075);
        });
        break;
      case 'enemyDeath':
        makeNoise(context, 0.36, 0.075, 'lowpass', 520);
        tone(150, 0.3, 0.035, 'sawtooth', 42);
        break;
      case 'hurt':
        makeNoise(context, 0.24, 0.11, 'lowpass', 700);
        tone(90, 0.26, 0.055, 'sawtooth', 45);
        break;
      case 'heal':
        tone(392, 0.24, 0.04, 'sine', 588);
        tone(784, 0.32, 0.025, 'sine', 784, 0.08);
        break;
      case 'boss':
        makeNoise(context, 1.1, 0.14, 'lowpass', 260);
        tone(55, 0.95, 0.09, 'sawtooth', 35);
        tone(82.4, 0.8, 0.04, 'triangle', 55, 0.12);
        break;
      case 'slam':
        makeNoise(context, 0.55, 0.18, 'lowpass', 210);
        tone(58, 0.48, 0.09, 'sine', 30);
        break;
      case 'wave':
        [196, 261.6, 392].forEach((frequency, index) => {
          tone(frequency, 0.5, 0.04, 'triangle', frequency, index * 0.12);
        });
        break;
      case 'victory':
        [392, 523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
          tone(frequency, 0.65, 0.055, 'triangle', frequency, index * 0.14);
        });
        break;
      case 'defeat':
        [220, 196, 164.8, 110].forEach((frequency, index) => {
          tone(frequency, 0.65, 0.055, 'sawtooth', frequency * 0.9, index * 0.18);
        });
        break;
      case 'ui':
        tone(660, 0.07, 0.025, 'sine', 880);
        break;
      default:
        break;
    }
  }

  function drum(time, low = true) {
    if (!context || muted) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(low ? 92 : 148, time);
    osc.frequency.exponentialRampToValueAtTime(low ? 38 : 70, time + 0.14);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(low ? 0.055 : 0.026, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
    osc.connect(gain).connect(master);
    osc.start(time);
    osc.stop(time + 0.22);
  }

  function update(dt, intensityValue = 0) {
    if (!started || muted || !context || context.state !== 'running') return;
    intensity += (clamp01(intensityValue) - intensity) * Math.min(1, dt * 1.8);
    const interval = 0.58 - intensity * 0.14;
    musicClock += dt;
    if (musicClock < interval) return;
    musicClock -= interval;
    const now = context.currentTime;
    if (musicStep % 4 === 0) drum(now, true);
    if (musicStep % 4 === 2) drum(now, false);
    if (intensity > 0.32 && musicStep % 2 === 1) {
      const scale = [110, 130.8, 146.8, 164.8, 196];
      const frequency = scale[(musicStep * 3) % scale.length];
      tone(frequency, 0.3, 0.012 + intensity * 0.012, 'triangle', frequency * 0.99);
    }
    musicStep += 1;
  }

  function setMuted(value) {
    muted = Boolean(value);
    if (master && context) {
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(muted ? 0 : 0.5, context.currentTime, 0.04);
    }
    return muted;
  }

  function toggleMuted() {
    return setMuted(!muted);
  }

  return {
    unlock,
    play,
    update,
    setMuted,
    toggleMuted,
    get muted() { return muted; },
    get ready() { return started; },
  };
}
