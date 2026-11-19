import * as THREE from 'three';
import { ARENA_RADIUS } from './arena.js';
import { PlayerAnimator } from './playerAnimation.js';

const PLAYER_RADIUS = 0.4;
const GRAVITY = 15.5;

function angleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class Player {
  constructor({ rig, state, particles, effects, audio, hud, arena, callbacks = {} }) {
    this.rig = rig;
    this.root = rig.root;
    this.state = state;
    this.particles = particles;
    this.effects = effects;
    this.audio = audio;
    this.hud = hud;
    this.arena = arena;
    this.callbacks = callbacks;
    this.playerAnimator = new PlayerAnimator({ rig, state, particles });

    this.position = new THREE.Vector3(0, 0, 4.8);
    this.velocity = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, -1);
    this.desired = new THREE.Vector3();
    this.moveVector = new THREE.Vector3();
    this.cameraForward = new THREE.Vector3();
    this.cameraRight = new THREE.Vector3();
    this.temp = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.position.set(0, 0, 4.8);
    this.velocity.set(0, 0, 0);
    this.facing = Math.PI;
    this.maxHealth = 100;
    this.maxStamina = 100;
    this.health = 100;
    this.stamina = 100;
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.attackChainTimer = 0;
    this.attackComboStep = 0;
    this.motion = 0;
    this.sprinting = false;
    this.grounded = true;
    this.jumpVelocity = 0;
    this.jumpHeight = 0;
    this.verticalOffset = 0;
    this.attackTimer = 0;
    this.attackDuration = 0.5;
    this.attackCooldown = 0;
    this.attackQueued = false;
    this.attackHitPending = false;
    this.shieldHeld = false;
    this.shieldBashTimer = 0;
    this.shieldBashDuration = 0.38;
    this.shieldBashCooldown = 0;
    this.shieldBashHitPending = false;
    this.dodgeTimer = 0;
    this.dodgeDuration = 0.44;
    this.dodgeCooldown = 0;
    this.dodgeProgress = 0;
    this.dodgeDirection = new THREE.Vector3(0, 0, -1);
    this.invulnerable = 0;
    this.hurtTimer = 0;
    this.alive = true;
    this.deathTimer = 0;
    this.lastFootfall = 0;
    this.staminaDelay = 0;
    this.root.position.set(this.position.x, 0, this.position.z);
    this.root.rotation.set(0, this.facing, 0);
    this.root.scale.setScalar(1);
    this.state.manualActive = true;
    this.state.autoPatrol = false;
    this.playerAnimator.reset();
  }

  get blocking() {
    return this.alive && this.shieldHeld && this.shieldBashTimer <= 0
      && this.attackTimer <= 0 && this.dodgeTimer <= 0 && this.stamina > 1;
  }

  get dodging() {
    return this.dodgeTimer > 0;
  }

  get attackProgress() {
    return this.attackTimer > 0 ? 1 - this.attackTimer / this.attackDuration : 0;
  }

  get shieldBashProgress() {
    return this.shieldBashTimer > 0 ? 1 - this.shieldBashTimer / this.shieldBashDuration : 0;
  }

  get status() {
    return {
      health: this.health,
      maxHealth: this.maxHealth,
      stamina: this.stamina,
      maxStamina: this.maxStamina,
      score: this.score,
      kills: this.kills,
      combo: this.combo,
      alive: this.alive,
    };
  }

  setFacing(angle, dt = 1) {
    this.facing += angleDelta(this.facing, angle) * clamp(dt, 0, 1);
    this.forward.set(Math.sin(this.facing), 0, Math.cos(this.facing));
  }

  consumeStamina(amount) {
    this.stamina = Math.max(0, this.stamina - amount);
    this.staminaDelay = 0.55;
  }

  tryAttack() {
    if (!this.alive || this.dodgeTimer > 0 || this.shieldBashTimer > 0) return false;
    if (this.attackTimer > 0) {
      if (this.attackProgress > 0.55) this.attackQueued = true;
      return false;
    }
    if (this.attackCooldown > 0 || this.stamina < 7) {
      if (this.attackCooldown > 0) this.attackQueued = true;
      return false;
    }
    this.attackComboStep = this.attackChainTimer > 0 ? (this.attackComboStep + 1) % 3 : 0;
    this.attackChainTimer = 1.15;
    this.attackDuration = 0.46 + this.attackComboStep * 0.035;
    this.attackTimer = this.attackDuration;
    this.attackCooldown = this.attackDuration * 0.76;
    this.attackHitPending = true;
    this.attackQueued = false;
    this.consumeStamina(7 + this.attackComboStep);
    this.audio.play('attack', { power: 0.85 + this.attackComboStep * 0.16 });
    return true;
  }

  tryShieldBash() {
    if (!this.alive || this.shieldBashCooldown > 0 || this.shieldBashTimer > 0
      || this.dodgeTimer > 0 || this.attackTimer > 0 || this.stamina < 18) return false;
    this.shieldBashTimer = this.shieldBashDuration;
    this.shieldBashCooldown = 0.92;
    this.shieldBashHitPending = true;
    this.consumeStamina(18);
    this.effects.shieldBash(new THREE.Vector3(this.position.x, this.verticalOffset, this.position.z), this.facing);
    this.audio.play('shield');
    this.hud.floatText(
      new THREE.Vector3(this.position.x, this.verticalOffset + 1.8, this.position.z),
      'SHIELD BASH',
      'crit',
    );
    return true;
  }

  tryJump() {
    if (!this.alive || !this.grounded || this.dodgeTimer > 0 || this.stamina < 8) return false;
    this.grounded = false;
    this.jumpVelocity = 6.15;
    this.consumeStamina(8);
    this.audio.play('jump');
    this.particles.burst({
      position: { x: this.position.x, y: 0.08, z: this.position.z },
      count: 12,
      color: 0xb59a83,
      speed: 1.2,
      size: 0.08,
      life: 0.45,
      gravity: -0.8,
      upward: 0.25,
    });
    return true;
  }

  tryDodge(moveVector, cameraYaw) {
    if (!this.alive || !this.grounded || this.dodgeCooldown > 0 || this.stamina < 21) return false;
    const direction = this.temp.copy(moveVector);
    if (direction.lengthSq() < 0.02) direction.copy(this.forward);
    direction.normalize();
    this.dodgeDirection.copy(direction);
    this.dodgeTimer = this.dodgeDuration;
    this.dodgeCooldown = 0.78;
    this.dodgeProgress = 0;
    this.invulnerable = Math.max(this.invulnerable, 0.38);
    this.consumeStamina(21);
    this.effects.dodge(new THREE.Vector3(this.position.x, 0, this.position.z), Math.atan2(direction.x, direction.z));
    this.audio.play('dodge');
    return true;
  }

  registerAttackResult(result) {
    if (!result || result.hits <= 0) return;
    this.combo += result.hits;
    this.comboTimer = 2.35;
    const comboBonus = Math.max(0, this.combo - 1) * 12;
    this.score += Math.round(result.damage * 2 + result.hits * 15 + comboBonus + (result.kills || 0) * 75);
    if (this.combo >= 3) this.hud.setCombo(this.combo);
  }

  heal(amount) {
    if (!this.alive) return;
    const before = this.health;
    this.health = Math.min(this.maxHealth, this.health + amount);
    this.stamina = Math.min(this.maxStamina, this.stamina + 18);
    if (this.health > before) {
      this.audio.play('heal');
      this.hud.floatText(
        new THREE.Vector3(this.position.x, this.verticalOffset + 1.9, this.position.z),
        `+${Math.round(this.health - before)} HP`,
        'heal',
      );
    }
  }

  takeDamage(amount, sourcePosition = null, type = 'melee') {
    if (!this.alive) return { result: 'dead', damage: 0 };
    if (this.invulnerable > 0 || this.dodgeTimer > 0) {
      this.hud.floatText(
        new THREE.Vector3(this.position.x, this.verticalOffset + 1.7, this.position.z),
        'EVADED',
        'heal',
      );
      return { result: 'evaded', damage: 0 };
    }

    let frontal = false;
    if (sourcePosition) {
      const dx = sourcePosition.x - this.position.x;
      const dz = sourcePosition.z - this.position.z;
      const distance = Math.hypot(dx, dz) || 1;
      const dot = (dx / distance) * Math.sin(this.facing) + (dz / distance) * Math.cos(this.facing);
      frontal = dot > 0.05;
    }

    if (this.blocking && frontal) {
      const staminaCost = Math.max(8, amount * 1.45);
      this.stamina = Math.max(0, this.stamina - staminaCost);
      this.invulnerable = 0.14;
      this.effects.block(new THREE.Vector3(this.position.x, this.verticalOffset, this.position.z));
      this.audio.play('block');
      this.hud.floatText(
        new THREE.Vector3(this.position.x, this.verticalOffset + 1.8, this.position.z),
        this.stamina > 0 ? 'BLOCK' : 'GUARD BREAK',
        this.stamina > 0 ? 'heal' : 'crit',
      );
      if (this.stamina > 0) {
        const chip = Math.max(0, Math.round(amount * 0.1));
        this.health = Math.max(0, this.health - chip);
        return { result: 'blocked', damage: chip };
      }
      this.hud.message('GUARD BROKEN', 'boss', 1300);
      amount = Math.round(amount * 0.7);
    }

    this.health = Math.max(0, this.health - amount);
    this.hurtTimer = 0.36;
    this.invulnerable = 0.52;
    this.combo = 0;
    this.comboTimer = 0;
    this.effects.hit(new THREE.Vector3(this.position.x, this.verticalOffset, this.position.z), 0xff2a1c, false);
    this.hud.flashDamage();
    this.hud.floatText(
      new THREE.Vector3(this.position.x, this.verticalOffset + 1.8, this.position.z),
      `-${amount}`,
      'crit',
    );
    this.audio.play('hurt');
    if (this.health <= 0) this.die();
    return { result: 'hit', damage: amount };
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.health = 0;
    this.deathTimer = 0;
    this.shieldHeld = false;
    this.attackTimer = 0;
    this.dodgeTimer = 0;
    this.shieldBashTimer = 0;
    this.audio.play('defeat');
    this.hud.message('THE LAST EMBER FADES', 'boss', 3000);
    this.callbacks.onDeath?.();
  }

  addScore(amount) {
    this.score += Math.round(amount);
  }

  resolveMovement(nextX, nextZ) {
    let x = nextX;
    let z = nextZ;
    this.arena.obstacles.forEach((obstacle) => {
      const dx = x - obstacle.x;
      const dz = z - obstacle.z;
      const minDistance = obstacle.radius + PLAYER_RADIUS;
      const distance = Math.hypot(dx, dz);
      if (distance > 0.001 && distance < minDistance) {
        const push = minDistance - distance;
        x += (dx / distance) * push;
        z += (dz / distance) * push;
      }
    });
    const radius = Math.hypot(x, z);
    const limit = ARENA_RADIUS - PLAYER_RADIUS;
    if (radius > limit) {
      x *= limit / radius;
      z *= limit / radius;
    }
    return { x, z };
  }

  update(dt, time, input, cameraYaw) {
    const step = Math.min(dt, 0.05);
    if (!this.alive) {
      this.deathTimer += step;
      this.motion = THREE.MathUtils.damp(this.motion, 0, 5, step);
      this.root.position.set(this.position.x, 0, this.position.z);
      return this.playerAnimator.update(step, time, this);
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - step);
    this.shieldBashCooldown = Math.max(0, this.shieldBashCooldown - step);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - step);
    this.attackChainTimer = Math.max(0, this.attackChainTimer - step);
    this.comboTimer = Math.max(0, this.comboTimer - step);
    this.invulnerable = Math.max(0, this.invulnerable - step);
    this.hurtTimer = Math.max(0, this.hurtTimer - step);
    this.staminaDelay = Math.max(0, this.staminaDelay - step);
    if (this.comboTimer <= 0) this.combo = 0;

    const movement = input.movement || { x: 0, y: 0 };
    this.cameraForward.set(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
    this.cameraRight.set(-Math.cos(cameraYaw), 0, Math.sin(cameraYaw));
    this.desired.set(0, 0, 0)
      .addScaledVector(this.cameraRight, movement.x)
      .addScaledVector(this.cameraForward, movement.y);
    if (this.desired.lengthSq() > 1) this.desired.normalize();

    if (input.consumeAction('jump')) this.tryJump();
    if (input.consumeAction('dodge')) this.tryDodge(this.desired, cameraYaw);
    if (input.consumeAction('attack')) this.tryAttack();
    if (input.consumeAction('shieldBash')) this.tryShieldBash();

    this.shieldHeld = Boolean(input.shieldHeld) && this.stamina > 0 && this.dodgeTimer <= 0 && this.attackTimer <= 0;

    const moving = this.desired.lengthSq() > 0.001;
    const canSprint = Boolean(input.sprint) && moving && this.stamina > 4 && !this.shieldHeld
      && this.attackTimer <= 0 && this.dodgeTimer <= 0 && this.shieldBashTimer <= 0;
    this.sprinting = canSprint;

    let speed = canSprint ? 4.9 : 2.85;
    if (this.shieldHeld) speed = 1.65;
    if (this.attackTimer > 0) speed *= 0.46;
    if (this.shieldBashTimer > 0) speed *= 0.5;
    if (!this.grounded) speed *= 0.78;
    if (this.dodgeTimer > 0) speed = 9.4;

    this.moveVector.copy(this.desired);
    if (this.dodgeTimer > 0) this.moveVector.copy(this.dodgeDirection);
    const displacement = this.moveVector.multiplyScalar(speed * step);
    const next = this.resolveMovement(this.position.x + displacement.x, this.position.z + displacement.z);
    this.velocity.set((next.x - this.position.x) / Math.max(step, 0.0001), 0, (next.z - this.position.z) / Math.max(step, 0.0001));
    this.position.x = next.x;
    this.position.z = next.z;

    if (moving && !this.dodging) {
      const targetAngle = Math.atan2(this.desired.x, this.desired.z);
      this.setFacing(targetAngle, step * 11);
    } else if (this.dodging) {
      const targetAngle = Math.atan2(this.dodgeDirection.x, this.dodgeDirection.z);
      this.setFacing(targetAngle, step * 14);
    }

    if (this.dodgeTimer > 0) {
      this.dodgeTimer = Math.max(0, this.dodgeTimer - step);
      this.dodgeProgress = 1 - this.dodgeTimer / this.dodgeDuration;
      if (this.dodgeTimer <= 0) this.dodgeProgress = 1;
    } else {
      this.dodgeProgress = 0;
    }

    let dodgeVertical = 0;
    if (this.dodging) dodgeVertical = Math.sin(Math.PI * this.dodgeProgress) * 0.13;
    if (!this.grounded && !this.dodging) {
      this.jumpVelocity -= GRAVITY * step;
      this.jumpHeight += this.jumpVelocity * step;
      if (this.jumpHeight <= 0) {
        this.jumpHeight = 0;
        this.jumpVelocity = 0;
        this.grounded = true;
        this.audio.play('land');
        this.particles.burst({
          position: { x: this.position.x, y: 0.06, z: this.position.z },
          count: 16,
          color: 0xb59a83,
          speed: 1.5,
          size: 0.085,
          life: 0.5,
          gravity: -0.8,
          upward: 0.3,
        });
      }
    }
    this.verticalOffset = this.jumpHeight + dodgeVertical;

    if (canSprint) {
      this.stamina = Math.max(0, this.stamina - 17 * step);
      this.staminaDelay = 0.45;
    } else if (this.shieldHeld) {
      this.stamina = Math.max(0, this.stamina - 2.8 * step);
      this.staminaDelay = 0.25;
    } else if (this.staminaDelay <= 0) {
      this.stamina = Math.min(this.maxStamina, this.stamina + 16 * step);
    }

    if (this.attackTimer > 0) {
      this.attackTimer = Math.max(0, this.attackTimer - step);
      if (this.attackHitPending && this.attackProgress >= 0.36) {
        this.attackHitPending = false;
        const result = this.callbacks.onSwordHit?.(this.attackComboStep, this);
        this.registerAttackResult(result);
      }
      if (this.attackTimer <= 0 && this.attackQueued) {
        this.attackQueued = false;
        this.tryAttack();
      }
    }

    if (this.shieldBashTimer > 0) {
      this.shieldBashTimer = Math.max(0, this.shieldBashTimer - step);
      if (this.shieldBashHitPending && this.shieldBashProgress >= 0.34) {
        this.shieldBashHitPending = false;
        const hits = this.callbacks.onShieldHit?.(this) || 0;
        if (hits > 0) {
          this.addScore(hits * 45);
          this.combo += hits;
          this.comboTimer = 2.2;
        }
      }
    }

    const targetMotion = this.dodging ? 1 : moving ? (canSprint ? 1 : this.shieldHeld ? 0.32 : 0.58) : 0;
    this.motion = THREE.MathUtils.damp(this.motion, targetMotion, 9, step);
    this.root.position.set(this.position.x, this.verticalOffset, this.position.z);
    this.root.rotation.y = this.facing;
    if (this.alive) {
      this.root.rotation.x = 0;
      this.root.rotation.z = 0;
    }

    const animation = this.playerAnimator.update(step, time, this);
    if (animation.footfall > 0.62 && this.lastFootfall <= 0.62 && this.grounded && animation.motion > 0.2) {
      this.audio.play('step');
    }
    this.lastFootfall = animation.footfall;
    return animation;
  }
}
