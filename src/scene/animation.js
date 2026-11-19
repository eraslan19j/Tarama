import * as THREE from 'three';

export const DEFAULT_STATE = {
  mode: 'walk',
  speed: 1,
  armorFlex: 0.7,
  wind: 0.55,
  autoPatrol: true,
  manualActive: false,
  cinematic: true,
  cape: true,
  helmet: true,
  shield: true,
  sword: true,
  paused: false,
  patrolAngle: -Math.PI / 2,
};

const PATROL_RADIUS = 2.35;

function updateCapeGeometry(geometry, time, motion, wind, cadence) {
  const data = geometry.userData.cape;
  if (!data) return;
  const positions = geometry.attributes.position.array;
  const base = data.base;
  const uValues = data.u;
  const vValues = data.v;
  const drag = 0.10 + motion * 0.38 + wind * 0.22;
  const waveSpeed = 2.0 + motion * 5.2 + wind * 2.4 + cadence * 0.35;

  for (let i = 0; i < vValues.length; i += 1) {
    const v = vValues[i];
    const u = uValues[i];
    const pin = v * v;
    const fold = Math.sin(v * 13.5 - time * waveSpeed + u * 10.5);
    const gust = Math.sin(time * 0.85 + u * 3.1);
    const flutter = fold * (0.020 + 0.068 * v) * (0.32 + wind + motion * 0.55);
    const crossWind = Math.sin(u * Math.PI * 4 + time * 1.15) * 0.025 * wind * v;

    positions[i * 3] = base[i * 3] + crossWind * pin;
    positions[i * 3 + 1] = base[i * 3 + 1]
      + drag * 0.12 * pin
      + gust * 0.014 * wind * pin
      + Math.abs(fold) * 0.008 * pin;
    positions[i * 3 + 2] = base[i * 3 + 2]
      - drag * 0.62 * pin
      - flutter * pin
      - wind * gust * 0.045 * pin;
  }
  geometry.attributes.position.needsUpdate = true;
  geometry.computeVertexNormals();
}

export class CharacterAnimator {
  constructor(rig, state) {
    this.rig = rig;
    this.state = state;
    this.motion = 0;
    this.phase = 0;
    this.footfall = 0;
    this.time = 0;
    this.lastManualMode = 'walk';
  }

  setMode(mode) {
    if (!['idle', 'walk', 'run'].includes(mode)) return;
    this.state.mode = mode;
  }

  reset() {
    this.motion = 0;
    this.phase = 0;
    this.footfall = 0;
    this.state.patrolAngle = DEFAULT_STATE.patrolAngle;
    this.rig.root.position.set(
      Math.cos(this.state.patrolAngle) * PATROL_RADIUS,
      0,
      Math.sin(this.state.patrolAngle) * PATROL_RADIUS,
    );
    this.rig.root.rotation.y = -this.state.patrolAngle;
  }

  applyVisibility() {
    const { rig, state } = this;
    rig.cape.visible = state.cape;
    rig.capeChain.visible = state.cape;
    rig.helmet.visible = state.helmet;
    rig.shield.visible = state.shield;
    rig.sword.visible = state.sword;
  }

  updateRig(time) {
    const { rig, state, phase, motion } = this;
    const breath = Math.sin(time * 1.45);
    const counterBreath = Math.cos(time * 1.45);
    const leftSwing = -Math.sin(phase) * 0.64 * motion;
    const rightSwing = Math.sin(phase) * 0.64 * motion;
    const torsoTwist = Math.sin(phase) * 0.055 * motion;

    rig.hips.position.y = rig.base.hipsY
      + Math.cos(phase * 2) * 0.026 * motion
      + breath * 0.008;
    rig.hips.rotation.set(
      -0.012 - motion * 0.025,
      Math.sin(phase) * 0.018 * motion,
      Math.sin(phase) * 0.025 * motion,
    );

    rig.torso.position.y = rig.base.torsoY + breath * 0.005;
    rig.torso.rotation.set(
      -0.035 * motion + counterBreath * 0.006,
      torsoTwist,
      -Math.sin(phase) * 0.045 * motion,
    );

    rig.legs.left.rotation.x = leftSwing;
    rig.legs.right.rotation.x = rightSwing;
    rig.knees.left.rotation.x = (0.035 + Math.max(0, -Math.sin(phase + 0.55)) * 0.72) * motion;
    rig.knees.right.rotation.x = (0.035 + Math.max(0, -Math.sin(phase + Math.PI + 0.55)) * 0.72) * motion;
    rig.feet.left.rotation.x = -leftSwing * 0.38 - rig.knees.left.rotation.x * 0.42
      + Math.sin(phase + 0.7) * 0.035 * motion;
    rig.feet.right.rotation.x = -rightSwing * 0.38 - rig.knees.right.rotation.x * 0.42
      + Math.sin(phase + Math.PI + 0.7) * 0.035 * motion;

    rig.arms.left.rotation.set(
      -leftSwing * 0.68 + 0.025,
      -torsoTwist * 0.45,
      rig.base.shoulderRotationZ.left + Math.cos(phase) * 0.018 * motion,
    );
    rig.arms.right.rotation.set(
      -rightSwing * 0.68 + 0.025,
      -torsoTwist * 0.45,
      rig.base.shoulderRotationZ.right - Math.cos(phase) * 0.018 * motion,
    );
    rig.elbows.left.rotation.x = 0.12 + motion * 0.08
      + Math.max(0, Math.sin(phase + 0.3)) * 0.22 * motion;
    rig.elbows.right.rotation.x = 0.12 + motion * 0.08
      + Math.max(0, Math.sin(phase + Math.PI + 0.3)) * 0.22 * motion;
    rig.wrists.left.rotation.z = Math.sin(phase) * 0.025 * motion;
    rig.wrists.right.rotation.z = -Math.sin(phase) * 0.025 * motion;

    rig.neck.rotation.set(
      0.012 + motion * 0.012,
      Math.sin(time * 0.48) * 0.025,
      -rig.torso.rotation.z * 0.25,
    );
    rig.head.rotation.set(
      -rig.torso.rotation.x * 0.32,
      -torsoTwist * 0.55 + Math.sin(time * 0.65) * 0.025,
      -rig.torso.rotation.z * 0.58,
    );

    const flex = state.armorFlex;
    const wind = state.wind;
    const clink = Math.pow(Math.max(0, Math.sin(phase * 2)), 6) * motion * flex;
    rig.secondary.forEach((descriptor) => {
      const { object, baseRotation, basePosition, phase: offset, weight, kind } = descriptor;
      object.rotation.set(baseRotation.x, baseRotation.y, baseRotation.z);
      if (kind === 'pauldron') {
        object.rotation.x += (Math.sin(phase * 2 + offset) * 0.028 * motion + clink * 0.032) * flex * weight;
        object.rotation.z += Math.cos(phase + offset) * 0.015 * motion * flex * weight;
      } else if (kind === 'fauld' || kind === 'tasset') {
        object.rotation.x += (Math.sin(phase * 2 + offset) * 0.048 * motion + clink * 0.025) * flex * weight;
        object.rotation.z += Math.cos(phase * 1.4 + offset) * 0.018 * motion * flex * weight;
      } else if (kind === 'plume') {
        object.rotation.x += Math.sin(time * 2.2 + offset) * (0.035 + wind * 0.045 + motion * 0.055) * flex * weight;
        object.rotation.z += Math.sin(time * 1.5 + offset * 0.5) * (0.03 + wind * 0.035) * flex * weight;
        object.rotation.y += Math.sin(time * 1.1) * 0.018 * wind;
      } else if (kind === 'hair') {
        object.rotation.x += Math.sin(time * 1.8 + offset) * (0.018 + wind * 0.03 + motion * 0.035) * flex * weight;
        object.rotation.z += Math.sin(time * 1.25 + offset * 0.5) * (0.012 + wind * 0.02) * flex * weight;
      } else if (kind === 'helmet') {
        object.rotation.z += Math.sin(phase * 2) * 0.006 * motion * flex;
      } else if (kind === 'fur') {
        object.rotation.x += Math.sin(time * 1.6) * 0.01 * wind * flex;
        object.rotation.z += Math.sin(time * 1.1 + offset) * 0.012 * wind * flex;
      } else if (kind === 'shield') {
        object.rotation.x += (Math.sin(phase * 2 + offset) * 0.026 * motion + clink * 0.020) * flex;
        object.rotation.y += Math.sin(phase + offset) * 0.018 * motion * flex;
        object.rotation.z += (Math.cos(phase * 2) * 0.012 * motion + clink * 0.012) * flex;
      } else if (kind === 'sword') {
        object.rotation.x += (Math.sin(phase + offset) * 0.045 * motion + clink * 0.045) * flex;
        object.rotation.z += Math.sin(phase * 1.5 + offset) * 0.035 * motion * flex;
      } else if (kind === 'chain') {
        object.rotation.z += Math.sin(time * 1.2) * 0.004 * wind * flex;
        object.position.y = basePosition.y + Math.sin(time * 1.7) * 0.002;
      }
    });

    if (rig.capeMesh && state.cape) {
      updateCapeGeometry(rig.capeMesh.geometry, time, motion, wind, state.speed);
      rig.cape.rotation.x = 0.045 + motion * 0.17 + wind * 0.055
        + Math.sin(time * 0.9) * 0.012;
      rig.cape.rotation.z = Math.sin(time * 0.75) * 0.018 * (0.4 + wind)
        + Math.sin(phase) * 0.012 * motion;
      rig.cape.position.y = 0.70 + breath * 0.004;
    }
  }

  updateRoot(dt) {
    const { state, rig } = this;
    if (state.manualActive || !state.autoPatrol) return;

    const locomotion = state.mode === 'idle' ? 0 : this.motion;
    const worldSpeed = (state.mode === 'run' ? 2.25 : 1.25) * state.speed * locomotion;
    state.patrolAngle += dt * (worldSpeed / PATROL_RADIUS);
    const angle = state.patrolAngle;
    rig.root.position.set(Math.cos(angle) * PATROL_RADIUS, 0, Math.sin(angle) * PATROL_RADIUS);
    rig.root.rotation.y = -angle;
  }

  update(dt, time = this.time) {
    const state = this.state;
    const clampedDt = Math.min(Math.max(dt, 0), 0.05);
    this.time = time;
    const targetMotion = state.mode === 'idle' ? 0 : state.mode === 'walk' ? 0.56 : 1;
    this.motion = THREE.MathUtils.damp(this.motion, targetMotion, 5.2, clampedDt);
    const cadence = THREE.MathUtils.lerp(1.15, 9.2, this.motion) * state.speed;
    this.phase += clampedDt * cadence;
    this.footfall = Math.pow(Math.max(0, Math.sin(this.phase * 2)), 5) * this.motion;

    this.applyVisibility();
    this.updateRig(time);
    this.updateRoot(clampedDt);

    return {
      motion: this.motion,
      footfall: this.footfall,
      phase: this.phase,
    };
  }
}
