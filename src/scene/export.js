import * as THREE from 'three';

const euler = new THREE.Euler(0, 0, 0, 'XYZ');
const quaternion = new THREE.Quaternion();

function quatValues(frames, fn) {
  const values = new Float32Array(frames * 4);
  for (let i = 0; i < frames; i += 1) {
    const t = i / (frames - 1);
    const phase = t * Math.PI * 2;
    const [x, y, z] = fn(phase, t, i);
    euler.set(x, y, z, 'XYZ');
    quaternion.setFromEuler(euler);
    values[i * 4] = quaternion.x;
    values[i * 4 + 1] = quaternion.y;
    values[i * 4 + 2] = quaternion.z;
    values[i * 4 + 3] = quaternion.w;
  }
  return values;
}

function qTrack(name, times, frames, fn) {
  return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, quatValues(frames, fn));
}

function hipPositionTrack(times, frames, amplitude) {
  const values = new Float32Array(frames * 3);
  for (let i = 0; i < frames; i += 1) {
    const phase = (i / (frames - 1)) * Math.PI * 2;
    values[i * 3] = 0;
    values[i * 3 + 1] = 1.12 + Math.cos(phase * 2) * 0.026 * amplitude
      + Math.sin(phase) * 0.006;
    values[i * 3 + 2] = 0;
  }
  return new THREE.VectorKeyframeTrack('Hips.position', times, values);
}

function makeClip(name, amplitude, cycles, frames = 33) {
  const times = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) times[i] = i / (frames - 1);

  const phaseFor = (phase) => phase * cycles;
  const tracks = [hipPositionTrack(times, frames, amplitude)];

  const add = (node, fn) => {
    tracks.push(qTrack(node, times, frames, fn));
  };

  add('Hips', (phase) => {
    const p = phaseFor(phase);
    return [-0.012 - amplitude * 0.025, Math.sin(p) * 0.018 * amplitude, Math.sin(p) * 0.025 * amplitude];
  });
  add('Torso', (phase) => {
    const p = phaseFor(phase);
    return [
      -0.035 * amplitude + Math.cos(phase) * 0.006,
      Math.sin(p) * 0.055 * amplitude,
      -Math.sin(p) * 0.045 * amplitude,
    ];
  });

  const legSwing = (phase, side) => -Math.sin(phaseFor(phase) + (side === 'left' ? 0 : Math.PI)) * 0.64 * amplitude;
  for (const side of ['left', 'right']) {
    const label = side === 'left' ? 'Left' : 'Right';
    const offset = side === 'left' ? 0 : Math.PI;
    add(`${label}Leg`, (phase) => [legSwing(phase, side), 0, 0]);
    add(`${label}Knee`, (phase) => [
      (0.035 + Math.max(0, -Math.sin(phaseFor(phase) + offset + 0.55)) * 0.72) * amplitude,
      0,
      0,
    ]);
    add(`${label}Foot`, (phase) => {
      const p = phaseFor(phase);
      const swing = -Math.sin(p + offset) * 0.64 * amplitude;
      const knee = (0.035 + Math.max(0, -Math.sin(p + offset + 0.55)) * 0.72) * amplitude;
      return [-swing * 0.38 - knee * 0.42 + Math.sin(p + offset + 0.7) * 0.035 * amplitude, 0, 0];
    });
    add(`${label}Arm`, (phase) => {
      const p = phaseFor(phase);
      const swing = -Math.sin(p + offset) * 0.64 * amplitude;
      return [
        -swing * 0.68 + 0.025,
        -Math.sin(p) * 0.055 * amplitude * 0.45,
        (side === 'left' ? 0.06 : -0.06) + (side === 'left' ? 1 : -1) * Math.cos(p) * 0.018 * amplitude,
      ];
    });
    add(`${label}Forearm`, (phase) => [
      0.12 + amplitude * 0.08
        + Math.max(0, Math.sin(phaseFor(phase) + offset + 0.3)) * 0.22 * amplitude,
      0,
      0,
    ]);
    add(`${label}Hand`, (phase) => [0, 0, (side === 'left' ? 1 : -1) * Math.sin(phaseFor(phase)) * 0.025 * amplitude]);
    add(`${label}Pauldron`, (phase) => {
      const p = phaseFor(phase);
      const impact = Math.pow(Math.max(0, Math.sin(p * 2)), 6) * amplitude;
      return [
        Math.sin(p * 2 + offset) * 0.028 * amplitude + impact * 0.032,
        0,
        -0.04 + Math.cos(p + offset) * 0.015 * amplitude,
      ];
    });
  }

  add('Neck', (phase) => [0.012, Math.sin(phase * cycles) * 0.016, 0]);
  add('Head', (phase) => [
    0.01 * amplitude,
    -Math.sin(phaseFor(phase)) * 0.03 * amplitude + Math.sin(phase) * 0.025,
    Math.sin(phaseFor(phase)) * 0.026 * amplitude,
  ]);
  add('DragonHelmet', (phase) => [0, 0, Math.sin(phaseFor(phase) * 2) * 0.006 * amplitude]);
  add('SilverHair', (phase) => [
    Math.sin(phase + 0.4) * (0.018 + amplitude * 0.035),
    0,
    Math.sin(phase * 0.75) * 0.016,
  ]);
  add('CrimsonPlume', (phase) => [
    0.05 + Math.sin(phase * 1.4) * (0.035 + amplitude * 0.055),
    Math.sin(phase * 0.6) * 0.018,
    Math.sin(phase * 0.9 + 0.3) * (0.03 + amplitude * 0.025),
  ]);
  add('FurCollar', (phase) => [0, 0, Math.sin(phase * 0.8) * 0.008]);
  add('AnimatedCrimsonCape', (phase) => [
    0.045 + amplitude * 0.17 + Math.sin(phase * 0.6) * 0.012,
    0,
    Math.sin(phase * 0.75) * 0.018 + Math.sin(phaseFor(phase)) * 0.012 * amplitude,
  ]);
  add('DragonShield', (phase) => {
    const p = phaseFor(phase);
    return [
      0.04 + Math.sin(p * 2 + 1.4) * 0.026 * amplitude,
      -0.18 + Math.sin(p + 1.4) * 0.018 * amplitude,
      -0.08 + Math.cos(p * 2) * 0.012 * amplitude,
    ];
  });
  add('ValyrianLongsword', (phase) => {
    const p = phaseFor(phase);
    return [
      -0.18 + Math.sin(p + 0.8) * 0.045 * amplitude,
      0,
      0.10 + Math.sin(p * 1.5 + 0.8) * 0.035 * amplitude,
    ];
  });

  const clip = new THREE.AnimationClip(name, 1, tracks);
  clip.optimize();
  return clip;
}

export function createExportAnimations() {
  return [
    makeClip('Idle', 0, 1),
    makeClip('Walk', 0.56, 1),
    makeClip('Run', 1, 2),
  ];
}
