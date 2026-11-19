import * as THREE from 'three';
import { CharacterAnimator } from '../scene/animation.js';

function ease(t) {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

function blendRotation(object, x, y, z, amount) {
  if (amount <= 0) return;
  const blend = Math.min(1, amount);
  object.rotation.x = THREE.MathUtils.lerp(object.rotation.x, x, blend);
  object.rotation.y = THREE.MathUtils.lerp(object.rotation.y, y, blend);
  object.rotation.z = THREE.MathUtils.lerp(object.rotation.z, z, blend);
}

function blendPositionY(object, y, amount) {
  if (amount <= 0) return;
  object.position.y = THREE.MathUtils.lerp(object.position.y, y, Math.min(1, amount));
}

/** Extends the procedural Idle/Walk/Run rig with attack, guard, dodge, jump and death poses. */
export class PlayerAnimator {
  constructor({ rig, state, particles }) {
    this.rig = rig;
    this.state = state;
    this.particles = particles;
    this.animator = new CharacterAnimator(rig, state);
    this.attackBlend = 0;
    this.blockBlend = 0;
    this.shieldBlend = 0;
    this.dodgeBlend = 0;
    this.jumpBlend = 0;
    this.hurtBlend = 0;
    this.deathBlend = 0;
    this.lastTip = new THREE.Vector3();
    this.hasLastTip = false;
    this.scratchTip = new THREE.Vector3();
    this.white = new THREE.Color(0xffe7c0);
  }

  configureState() {
    const state = this.state;
    state.manualActive = true;
    state.autoPatrol = false;
    state.cinematic = false;
    state.paused = false;
    state.cape = true;
    state.helmet = true;
    state.shield = true;
    state.sword = true;
    state.armorFlex = 0.82;
    state.wind = 0.68;
    state.speed = 1;
  }

  attackPose(player, t) {
    const { rig } = this;
    const shoulderZ = rig.base.shoulderRotationZ.right;
    let shoulderX = -0.1;
    let shoulderY = 0;
    let shoulderZTarget = shoulderZ;
    let elbowX = 0.12;
    let wristX = 0;
    let swordX = -0.18;
    let swordZ = 0.1;
    let torsoY = 0;
    let torsoX = 0;

    if (t < 0.28) {
      const w = ease(t / 0.28);
      shoulderX = THREE.MathUtils.lerp(-0.1, -2.35, w);
      shoulderZTarget = THREE.MathUtils.lerp(shoulderZ, -0.48, w);
      elbowX = THREE.MathUtils.lerp(0.12, -0.72, w);
      wristX = THREE.MathUtils.lerp(0, -0.22, w);
      swordX = THREE.MathUtils.lerp(-0.18, -0.55, w);
      torsoY = THREE.MathUtils.lerp(0, -0.38, w);
      torsoX = THREE.MathUtils.lerp(0, -0.12, w);
    } else if (t < 0.64) {
      const w = ease((t - 0.28) / 0.36);
      shoulderX = THREE.MathUtils.lerp(-2.35, 0.62, w);
      shoulderZTarget = THREE.MathUtils.lerp(-0.48, 0.5, w);
      elbowX = THREE.MathUtils.lerp(-0.72, 0.16, w);
      wristX = THREE.MathUtils.lerp(-0.22, 0.34, w);
      swordX = THREE.MathUtils.lerp(-0.55, 0.38, w);
      swordZ = THREE.MathUtils.lerp(0.1, 0.28, w);
      torsoY = THREE.MathUtils.lerp(-0.38, 0.46, w);
      torsoX = THREE.MathUtils.lerp(-0.12, 0.16, w);
    } else {
      const w = ease((t - 0.64) / 0.36);
      shoulderX = THREE.MathUtils.lerp(0.62, -0.1, w);
      shoulderZTarget = THREE.MathUtils.lerp(0.5, shoulderZ, w);
      elbowX = THREE.MathUtils.lerp(0.16, 0.12, w);
      wristX = THREE.MathUtils.lerp(0.34, 0, w);
      swordX = THREE.MathUtils.lerp(0.38, -0.18, w);
      swordZ = THREE.MathUtils.lerp(0.28, 0.1, w);
      torsoY = THREE.MathUtils.lerp(0.46, 0, w);
      torsoX = THREE.MathUtils.lerp(0.16, 0, w);
    }
    return { shoulderX, shoulderY, shoulderZTarget, elbowX, wristX, swordX, swordZ, torsoY, torsoX };
  }

  applyCombatPose(player, dt, time) {
    const { rig } = this;
    const attackActive = player.attackTimer > 0;
    const shieldBashActive = player.shieldBashTimer > 0;
    const dodgeActive = player.dodgeTimer > 0;
    const airborne = !player.grounded;
    const hurtActive = player.hurtTimer > 0;

    this.attackBlend = THREE.MathUtils.damp(this.attackBlend, attackActive ? 1 : 0, attackActive ? 22 : 9, dt);
    this.blockBlend = THREE.MathUtils.damp(this.blockBlend, player.blocking ? 1 : 0, 12, dt);
    this.shieldBlend = THREE.MathUtils.damp(this.shieldBlend, shieldBashActive ? 1 : 0, shieldBashActive ? 20 : 10, dt);
    this.dodgeBlend = THREE.MathUtils.damp(this.dodgeBlend, dodgeActive ? 1 : 0, dodgeActive ? 20 : 8, dt);
    this.jumpBlend = THREE.MathUtils.damp(this.jumpBlend, airborne ? 1 : 0, airborne ? 12 : 8, dt);
    this.hurtBlend = THREE.MathUtils.damp(this.hurtBlend, hurtActive ? 1 : 0, hurtActive ? 18 : 6, dt);
    this.deathBlend = THREE.MathUtils.damp(this.deathBlend, player.alive ? 0 : 1, 3.2, dt);

    // Guard: shield arm forward and slightly across the chest.
    blendRotation(rig.arms.left, -1.08, -0.12, 0.24, this.blockBlend * 0.86);
    blendRotation(rig.elbows.left, -0.62, 0, -0.12, this.blockBlend * 0.86);
    blendRotation(rig.shield, -0.32, -0.04, 0.03, this.blockBlend * 0.8);
    rig.torso.rotation.x -= 0.055 * this.blockBlend;

    // Three-stage sword combo: wind-up, diagonal cut, recovery.
    if (this.attackBlend > 0.002) {
      const progress = attackActive ? 1 - player.attackTimer / player.attackDuration : 1;
      const pose = this.attackPose(player, Math.min(0.99, progress));
      blendRotation(rig.arms.right, pose.shoulderX, pose.shoulderY, pose.shoulderZTarget, this.attackBlend);
      blendRotation(rig.elbows.right, pose.elbowX, 0, 0, this.attackBlend);
      blendRotation(rig.wrists.right, pose.wristX, 0, 0, this.attackBlend * 0.85);
      blendRotation(rig.sword, pose.swordX, 0, pose.swordZ, this.attackBlend * 0.85);
      rig.torso.rotation.y = THREE.MathUtils.lerp(rig.torso.rotation.y, pose.torsoY, this.attackBlend);
      rig.torso.rotation.x = THREE.MathUtils.lerp(rig.torso.rotation.x, pose.torsoX, this.attackBlend * 0.8);
      rig.hips.rotation.y = THREE.MathUtils.lerp(rig.hips.rotation.y, pose.torsoY * 0.35, this.attackBlend);
      rig.cape.rotation.x += 0.12 * this.attackBlend * Math.sin(progress * Math.PI);
    }

    // Shield bash: a short forward punch with the kite shield.
    if (this.shieldBlend > 0.002) {
      const progress = shieldBashActive ? 1 - player.shieldBashTimer / player.shieldBashDuration : 1;
      const punch = Math.sin(Math.PI * Math.min(1, progress));
      blendRotation(rig.arms.left, -1.45 + punch * 0.9, -0.2, 0.1, this.shieldBlend);
      blendRotation(rig.elbows.left, -0.82 + punch * 0.35, 0, 0, this.shieldBlend);
      blendRotation(rig.shield, -0.42 + punch * 0.5, 0, -0.12, this.shieldBlend);
      rig.torso.rotation.y = THREE.MathUtils.lerp(rig.torso.rotation.y, -0.28 + punch * 0.5, this.shieldBlend);
    }

    // Dodge roll: compact crouch with tucked limbs and cape kick.
    if (this.dodgeBlend > 0.002) {
      const roll = Math.sin(Math.PI * (player.dodgeProgress || 0));
      blendPositionY(rig.hips, rig.base.hipsY - 0.34 * roll, this.dodgeBlend);
      blendRotation(rig.hips, 0.55 * roll, 0, 0.16 * roll, this.dodgeBlend);
      blendRotation(rig.torso, 0.38 * roll, 0, -0.12 * roll, this.dodgeBlend);
      blendRotation(rig.legs.left, -0.7 * roll, 0, 0.12, this.dodgeBlend);
      blendRotation(rig.legs.right, 0.48 * roll, 0, -0.12, this.dodgeBlend);
      blendRotation(rig.knees.left, 1.05 * roll, 0, 0, this.dodgeBlend);
      blendRotation(rig.knees.right, 1.18 * roll, 0, 0, this.dodgeBlend);
      blendRotation(rig.arms.right, -0.75 * roll, 0, -0.25, this.dodgeBlend);
      blendRotation(rig.arms.left, -0.9 * roll, 0, 0.25, this.dodgeBlend);
      rig.cape.rotation.x += 0.46 * this.dodgeBlend * roll;
    }

    // Airborne tuck and landing anticipation.
    if (this.jumpBlend > 0.002) {
      const height = Math.min(1, player.jumpHeight / 1.15);
      blendRotation(rig.knees.left, 0.28 + height * 0.45, 0, 0, this.jumpBlend);
      blendRotation(rig.knees.right, 0.22 + height * 0.52, 0, 0, this.jumpBlend);
      blendRotation(rig.arms.right, -0.2 - height * 0.25, 0, -0.12, this.jumpBlend * 0.7);
      blendRotation(rig.arms.left, -0.18 - height * 0.2, 0, 0.12, this.jumpBlend * 0.7);
      rig.cape.rotation.x += 0.2 * this.jumpBlend;
    }

    if (this.hurtBlend > 0.002) {
      rig.torso.rotation.x -= 0.24 * this.hurtBlend;
      rig.head.rotation.z += 0.12 * this.hurtBlend;
      rig.cape.rotation.x += 0.14 * this.hurtBlend;
    }

    if (this.deathBlend > 0.002) {
      const t = Math.min(1, player.deathTimer / 1.3);
      const collapse = ease(t);
      blendRotation(rig.hips, 0.95 * collapse, 0, 0.35 * collapse, this.deathBlend);
      blendRotation(rig.torso, 0.42 * collapse, 0, -0.15 * collapse, this.deathBlend);
      blendRotation(rig.arms.right, 0.5 * collapse, 0, 0.4 * collapse, this.deathBlend);
      blendRotation(rig.arms.left, 0.65 * collapse, 0, -0.45 * collapse, this.deathBlend);
      blendRotation(rig.knees.left, 0.9 * collapse, 0, 0, this.deathBlend);
      blendRotation(rig.knees.right, 0.75 * collapse, 0, 0, this.deathBlend);
      blendPositionY(rig.hips, rig.base.hipsY - 0.45 * collapse, this.deathBlend);
      rig.root.rotation.z = THREE.MathUtils.lerp(rig.root.rotation.z, 0.7 * collapse, this.deathBlend);
      rig.root.rotation.x = THREE.MathUtils.lerp(rig.root.rotation.x, -0.3 * collapse, this.deathBlend);
    }

    rig.neck.rotation.y = Math.sin(time * 0.55) * 0.02;
    rig.head.rotation.y -= this.blockBlend * 0.08;
  }

  updateSwordTrail(player) {
    if (!this.particles || player.attackTimer <= 0) {
      this.hasLastTip = false;
      return;
    }
    const progress = 1 - player.attackTimer / player.attackDuration;
    if (progress < 0.24 || progress > 0.7) {
      this.hasLastTip = false;
      return;
    }
    const { rig } = this;
    rig.sword.updateWorldMatrix(true, false);
    const tip = this.scratchTip.set(0, -0.94, 0);
    rig.sword.localToWorld(tip);
    if (!this.hasLastTip) this.lastTip.copy(tip);
    const segments = 4;
    for (let i = 0; i < segments; i += 1) {
      const t = i / segments;
      const x = THREE.MathUtils.lerp(this.lastTip.x, tip.x, t);
      const y = THREE.MathUtils.lerp(this.lastTip.y, tip.y, t);
      const z = THREE.MathUtils.lerp(this.lastTip.z, tip.z, t);
      this.particles.spawn({
        position: { x, y, z },
        velocity: { x: (Math.random() - 0.5) * 0.35, y: (Math.random() - 0.5) * 0.25, z: (Math.random() - 0.5) * 0.35 },
        color: player.attackComboStep === 2 ? 0xff3a21 : 0xffb15c,
        colorVariance: 0.08,
        size: 0.045 + Math.random() * 0.035,
        life: 0.18 + Math.random() * 0.14,
        gravity: -0.8,
        drag: 1.8,
      });
    }
    this.lastTip.copy(tip);
    this.hasLastTip = true;
  }

  update(dt, time, player) {
    this.configureState();
    const mode = !player.alive
      ? 'idle'
      : player.motion < 0.08 ? 'idle' : player.sprinting ? 'run' : 'walk';
    this.state.mode = mode;
    this.state.speed = player.sprinting ? 1.12 : 1;
    this.state.wind = 0.6 + player.motion * 0.32;
    const result = this.animator.update(dt, time);
    this.applyCombatPose(player, dt, time);
    this.updateSwordTrail(player);
    return result;
  }

  reset() {
    this.animator.motion = 0;
    this.animator.phase = 0;
    this.animator.footfall = 0;
    this.attackBlend = 0;
    this.blockBlend = 0;
    this.shieldBlend = 0;
    this.dodgeBlend = 0;
    this.jumpBlend = 0;
    this.hurtBlend = 0;
    this.deathBlend = 0;
    this.hasLastTip = false;
    this.configureState();
  }
}
