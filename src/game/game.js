import * as THREE from 'three';
import { createAudio } from './audio.js';
import { createParticles } from './particles.js';
import { createEffects } from './effects.js';
import { createArena, ARENA_RADIUS } from './arena.js';
import { createSigils } from './sigils.js';
import { createEnemies, WAVE_DEFINITIONS } from './enemies.js';
import { Player } from './player.js';
import { createInput } from './input.js';
import { createThirdPersonCamera } from './camera.js';
import { createFullscreen } from './fullscreen.js';
import { QUALITY_PRESETS } from './renderer.js';

function byId(id) {
  return document.getElementById(id);
}

function roman(index) {
  return ['I', 'II', 'III'][index] || String(index + 1);
}

export class EmberfallGame {
  constructor({
    canvas, scene, camera, renderSystem, materials, textures, world,
    root, rig, state, hud,
  }) {
    this.canvas = canvas;
    this.scene = scene;
    this.camera = camera;
    this.renderSystem = renderSystem;
    this.materials = materials;
    this.textures = textures;
    this.world = world;
    this.root = root;
    this.rig = rig;
    this.state = state;
    this.hud = hud;
    this.hud.setCamera(camera);

    this.app = byId('app');
    this.phase = 'title';
    this.time = 0;
    this.ambientTime = 0;
    this.waveIndex = 0;
    this.waveTransition = null;
    this.endPending = null;
    this.bossVisible = false;
    this.bossHealth = 0;
    this.bestCombo = 0;
    this.fps = 60;
    this.fpsFrames = 0;
    this.fpsAccumulator = 0;
    this.lastFrame = performance.now();
    this.fullscreenTransitionUntil = 0;
    this.pointerLockToastShown = false;
    this.coarsePointer = Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    this.particles = createParticles(scene, 2200);
    this.effects = createEffects(scene, this.particles);
    this.audio = createAudio();
    this.arena = createArena(scene, materials, textures);
    renderSystem.setShadowLight(world.lights.key);

    this.sigils = createSigils(
      scene,
      this.arena,
      this.effects,
      this.audio,
      hud,
      (index, total) => this.onSigilCollect(index, total),
    );

    this.enemies = createEnemies(scene, this.arena, this.effects, this.audio, hud, {
      onPlayerDamage: (attack) => this.damagePlayer(attack),
      onEnemyKilled: (enemy) => this.onEnemyKilled(enemy),
      onBossHealth: (ratio) => this.onBossHealth(ratio),
    });

    this.player = new Player({
      rig,
      state,
      particles: this.particles,
      effects: this.effects,
      audio: this.audio,
      hud,
      arena: this.arena,
      callbacks: {
        onSwordHit: (comboStep, player) => this.onSwordHit(comboStep, player),
        onShieldHit: (player) => this.onShieldHit(player),
        onDeath: () => this.onPlayerDeath(),
      },
    });

    this.fullscreen = createFullscreen(this.app, (active) => this.onFullscreenChange(active));
    this.input = createInput(canvas, {
      onPause: () => this.togglePause(),
      onFullscreen: () => this.toggleFullscreen(),
      onMute: () => this.toggleMute(),
      onEnter: () => this.onEnter(),
      onPointerLockChange: (locked) => this.onPointerLockChange(locked),
      onPointerLockError: (reason) => this.onPointerLockError(reason),
    });
    this.cameraController = createThirdPersonCamera(camera, this.player, this.input, this.effects);

    this.loop = this.loop.bind(this);
    this.handleWindowResize = () => this.renderSystem.resize();
    this.attachUI();
    this.boot();
  }

  attachUI() {
    const bind = (id, handler) => byId(id)?.addEventListener('click', handler);
    bind('start-btn', () => this.start());
    bind('title-fullscreen', () => {
      this.fullscreenTransitionUntil = performance.now() + 1200;
      if (!this.fullscreen.supported) this.hud.toast('Fullscreen is not available in this browser');
      else this.fullscreen.enter();
      this.start();
    });
    bind('resume-btn', () => this.resume());
    bind('restart-btn', () => this.start());
    bind('play-again-btn', () => this.start());
    bind('quality-btn', () => this.cycleQuality());
    bind('pause-fullscreen', () => this.toggleFullscreen());
    bind('end-fullscreen', () => this.toggleFullscreen());
    bind('fullscreen-btn', () => this.toggleFullscreen());
    bind('sound-btn', () => this.toggleMute());
    bind('pause-btn', () => this.pause());
    window.addEventListener('resize', this.handleWindowResize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.phase === 'playing') this.pause();
    });
  }

  boot() {
    this.hud.setScreen('title');
    this.hud.setWave(0);
    this.hud.setObjective('Begin the quest');
    this.hud.setBoss(false, 0);
    this.hud.setFullscreen(this.fullscreen.isFullscreen());
    this.hud.setSound(this.audio.muted);
    this.hud.setQualityLabel(this.renderSystem.qualityLabel);
    this.sigils.reset();
    this.sigils.setWave(WAVE_DEFINITIONS[0].sigils);
    this.sigils.setEnabled(false);
    this.enemies.reset();
    this.cameraController.reset();
    this.particles.setPixelRatio(this.renderSystem.pixelRatio, window.innerHeight);
    this.renderSystem.resize();
    window.setTimeout(() => this.hud.hideLoading(), 350);
    this.lastFrame = performance.now();
    requestAnimationFrame(this.loop);
  }

  handleResize(ratio, width, height) {
    this.particles?.setPixelRatio(ratio, height);
  }

  requestGamePointerLock() {
    if (this.coarsePointer) return;
    this.input.requestPointerLock();
  }

  start() {
    this.audio.unlock();
    this.phase = 'playing';
    this.time = 0;
    this.waveIndex = 0;
    this.waveTransition = null;
    this.endPending = null;
    this.bossVisible = false;
    this.bossHealth = 0;
    this.bestCombo = 0;
    this.player.reset();
    this.enemies.reset();
    this.sigils.reset();
    this.sigils.setWave(WAVE_DEFINITIONS[0].sigils);
    this.sigils.setEnabled(true);
    this.cameraController.reset();
    this.input.clear();
    this.input.enabled = true;
    this.enemies.spawnWave(0, this.player.position);
    this.hud.setScreen('playing');
    this.hud.setWave(0);
    this.hud.setBoss(false, 0);
    this.hud.setObjective(this.getObjective());
    this.hud.message('WAVE I — THE ASH WRAITHS', 'boss', 2600);
    this.audio.play('wave');
    this.requestGamePointerLock();
  }

  pause() {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.input.enabled = false;
    this.input.exitPointerLock();
    this.hud.setScreen('paused');
    this.audio.play('ui');
  }

  resume() {
    if (this.phase !== 'paused') return;
    this.audio.unlock();
    this.phase = 'playing';
    this.input.clear();
    this.input.enabled = true;
    this.hud.setScreen('playing');
    this.audio.play('ui');
    this.requestGamePointerLock();
  }

  togglePause() {
    if (this.phase === 'playing') this.pause();
    else if (this.phase === 'paused') this.resume();
  }

  onEnter() {
    if (this.phase === 'title') this.start();
    else if (this.phase === 'paused') this.resume();
    else if (this.phase === 'ended') this.start();
  }

  async toggleFullscreen() {
    if (!this.fullscreen.supported) {
      this.hud.toast('Fullscreen is not available in this browser');
      return;
    }
    this.fullscreenTransitionUntil = performance.now() + 1200;
    const ok = await this.fullscreen.toggle();
    if (!ok) this.hud.toast('Fullscreen request was blocked by the browser');
    this.renderSystem.resize();
  }

  onFullscreenChange(active) {
    this.fullscreenTransitionUntil = performance.now() + 700;
    this.hud.setFullscreen(active);
    this.renderSystem.resize();
    window.setTimeout(() => this.renderSystem.resize(), 120);
  }

  toggleMute() {
    if (!this.audio.muted) {
      this.audio.setMuted(true);
    } else {
      this.audio.unlock();
      this.audio.setMuted(false);
      this.audio.play('ui');
    }
    this.hud.setSound(this.audio.muted);
    this.hud.toast(this.audio.muted ? 'Sound muted' : 'Sound on', 1300);
  }

  cycleQuality() {
    const names = Object.keys(QUALITY_PRESETS);
    const index = names.indexOf(this.renderSystem.qualityName);
    const next = names[(index + 1) % names.length];
    this.renderSystem.setQuality(next);
    this.hud.setQualityLabel(this.renderSystem.qualityLabel);
    this.hud.toast(`Quality: ${this.renderSystem.qualityLabel}`, 1400);
  }

  onPointerLockChange(locked) {
    if (!locked && this.phase === 'playing' && performance.now() > this.fullscreenTransitionUntil) {
      this.pause();
    }
  }

  onPointerLockError() {
    if (this.coarsePointer || this.pointerLockToastShown) return;
    this.pointerLockToastShown = true;
    this.hud.toast('Mouse look unavailable — use Q/E or middle-drag to rotate the camera', 3600);
  }

  onSigilCollect(index, total) {
    this.player.heal(14);
    this.player.addScore(250 + total * 35);
    const waveCount = WAVE_DEFINITIONS[this.waveIndex].sigils.length || 1;
    const recovered = waveCount - this.sigils.remaining;
    this.hud.message(`DRAGONFIRE RECOVERED · ${recovered} / ${waveCount}`, 'good', 1500);
    if (this.sigils.remaining === 0 && this.enemies.aliveCount > 0) {
      this.hud.setObjective('Defeat the remaining host');
    }
    if (index === 5) this.effects.sigil(new THREE.Vector3(0, 0, 0));
  }

  onSwordHit(comboStep, player) {
    const origin = new THREE.Vector3(player.position.x, player.verticalOffset, player.position.z);
    this.effects.slash(origin, player.facing, comboStep + 1);
    const result = this.enemies.queryAttack(player.position, player.facing, {
      damage: 24 + comboStep * 6 + Math.min(12, player.combo * 1.1),
      range: 2.5 + comboStep * 0.12,
      arc: 1.42,
      critical: comboStep === 2 || (player.combo >= 6 && Math.random() < 0.3),
      combo: player.combo,
      knockback: 3.4 + comboStep * 0.8,
    });
    if (result.hits > 0) player.addScore(result.hits * 10);
    return result;
  }

  onShieldHit(player) {
    return this.enemies.queryShieldBash(player.position, player.facing);
  }

  damagePlayer(attack) {
    if (this.phase !== 'playing' || !this.player.alive) return;
    const position = attack.position || new THREE.Vector3();
    if (attack.radius) {
      const dx = this.player.position.x - position.x;
      const dz = this.player.position.z - position.z;
      if (Math.hypot(dx, dz) > attack.radius) return;
      if (this.player.jumpHeight > 0.55) {
        this.hud.floatText(
          new THREE.Vector3(this.player.position.x, this.player.verticalOffset + 1.7, this.player.position.z),
          'LEAPED CLEAR',
          'heal',
        );
        this.audio.play('dodge');
        return;
      }
    }
    const result = this.player.takeDamage(attack.damage ?? 10, position, attack.type || 'melee');
    if (result.result === 'blocked') this.player.addScore(30);
  }

  onEnemyKilled(enemy) {
    this.player.kills += 1;
    this.player.addScore(enemy.stats.score);
    if (enemy.type === 'boss') {
      this.hud.message('THE WARDEN FALLS — CLEAR THE ASH', 'good', 2600);
    } else if (this.enemies.aliveCount === 0 && this.sigils.remaining === 0 && this.waveIndex < 2) {
      this.hud.message('HOST BROKEN — THE GATE STIRS', 'good', 1500);
    }
  }

  onBossHealth(ratio) {
    this.bossHealth = Math.max(0, Math.min(1, ratio));
    this.bossVisible = this.bossHealth > 0 && this.waveIndex === 2;
    this.hud.setBoss(this.bossVisible, this.bossHealth);
  }

  onPlayerDeath() {
    if (this.phase !== 'playing') return;
    this.phase = 'ending';
    this.input.enabled = false;
    this.input.exitPointerLock();
    this.sigils.setEnabled(false);
    this.endPending = { timer: 2.5, victory: false };
  }

  triggerWaveClear() {
    this.waveTransition = { timer: 2.35, next: this.waveIndex + 1 };
    this.player.addScore(500 * (this.waveIndex + 1));
    this.hud.message(`WAVE ${roman(this.waveIndex)} CLEARED`, 'good', 2100);
    this.audio.play('wave');
    this.effects.sigil(new THREE.Vector3(0, 0, -8.6));
  }

  advanceWave() {
    const next = this.waveTransition?.next ?? this.waveIndex + 1;
    this.waveTransition = null;
    this.waveIndex = Math.min(WAVE_DEFINITIONS.length - 1, next);
    const wave = WAVE_DEFINITIONS[this.waveIndex];
    this.sigils.setWave(wave.sigils);
    this.sigils.setEnabled(true);
    this.enemies.spawnWave(this.waveIndex, this.player.position);
    this.hud.setWave(this.waveIndex);
    this.hud.setObjective(this.getObjective());
    this.hud.message(`WAVE ${roman(this.waveIndex)} — ${wave.label.split(' · ')[1]}`, 'boss', 2800);
    if (this.waveIndex < 2) this.audio.play('wave');
  }

  triggerVictory() {
    this.phase = 'ending';
    this.input.enabled = false;
    this.input.exitPointerLock();
    this.sigils.setEnabled(false);
    this.endPending = { timer: 2.6, victory: true };
    this.player.addScore(2000 + Math.round(this.player.health * 12));
    this.audio.play('victory');
    this.hud.setBoss(false, 0);
    this.hud.message('EMBER REBORN — COURTYARD RECLAIMED', 'good', 3000);
    this.effects.sigil(new THREE.Vector3(0, 0, 0));
    this.particles.burst({
      position: { x: 0, y: 0.2, z: 0 },
      count: 120,
      color: 0xffb247,
      colorVariance: 0.16,
      speed: 5,
      size: 0.1,
      life: 1.6,
      gravity: -1.2,
      upward: 0.85,
      originJitter: 2.2,
    });
  }

  updateWaveProgress(dt) {
    if (this.waveTransition) {
      this.waveTransition.timer -= dt;
      if (this.waveTransition.timer <= 0) this.advanceWave();
      return;
    }
    if (this.endPending || !this.player.alive) return;
    if (this.waveIndex < 2) {
      if (this.sigils.remaining === 0 && this.enemies.aliveCount === 0) this.triggerWaveClear();
    } else if (this.enemies.aliveCount === 0) {
      this.triggerVictory();
    }
  }

  updateEnd(dt) {
    if (!this.endPending || this.phase !== 'ending') return;
    this.endPending.timer -= dt;
    if (this.endPending.timer <= 0) {
      const victory = this.endPending.victory;
      this.endPending = null;
      this.phase = 'ended';
      this.hud.showEnd({
        victory,
        score: this.player.score,
        time: this.time,
        sigils: this.sigils.collectedCount,
        kills: this.player.kills,
        wave: this.waveIndex,
        bestCombo: this.bestCombo,
      });
    }
  }

  getObjective() {
    const wave = WAVE_DEFINITIONS[this.waveIndex];
    if (this.waveIndex < 2 && this.sigils.remaining > 0) {
      return `Recover dragonfire sigils · ${this.sigils.remaining} remaining`;
    }
    if (this.waveIndex < 2 && this.enemies.aliveCount > 0) {
      return `Defeat the remaining host · ${this.enemies.aliveCount} left`;
    }
    if (this.waveIndex === 2) return 'Defeat the Cinder Warden';
    return wave.objective;
  }

  getHUDState() {
    return {
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      stamina: this.player.stamina,
      maxStamina: this.player.maxStamina,
      score: this.player.score,
      kills: this.player.kills,
      sigilsCollected: this.sigils.collectedCount,
      sigilsTotal: 6,
      time: this.time,
      fps: this.fps,
      objective: this.getObjective(),
      waveIndex: this.waveIndex,
      combo: this.player.combo,
      bossVisible: this.bossVisible,
      bossHealth: this.bossHealth,
      playerPosition: this.player.position,
      playerFacing: this.player.facing,
      sigils: this.sigils.getActivePositions(),
      enemies: this.enemies.getMinimapData(),
      obstacles: this.arena.obstacles,
      arenaRadius: ARENA_RADIUS,
    };
  }

  updateFps(dt) {
    this.fpsFrames += 1;
    this.fpsAccumulator += dt;
    if (this.fpsAccumulator >= 0.5) {
      this.fps = this.fpsFrames / this.fpsAccumulator;
      this.fpsFrames = 0;
      this.fpsAccumulator = 0;
    }
  }

  updateScene(dt, gameplay) {
    const autoOrbit = this.phase === 'title' || this.phase === 'ended';
    this.cameraController.update(dt, this.ambientTime, { autoOrbit });
    const animation = this.player.update(dt, this.ambientTime, this.input, this.cameraController.yaw);
    this.world.update(dt, this.ambientTime, {
      motion: animation.motion,
      position: this.player.position,
      footfall: animation.footfall,
    });
    this.arena.update(dt, this.ambientTime);
    this.sigils.update(dt, this.ambientTime, this.player.position);
    if (gameplay) this.enemies.update(dt, this.ambientTime, this.player, this.camera);
    this.effects.update(dt);
    this.particles.update(dt);
    const nearby = this.enemies.enemies.filter((enemy) => !enemy.dead && enemy.root.position.distanceTo(this.player.position) < 8).length;
    const intensity = Math.min(1, nearby / 6 + (this.bossVisible ? 0.35 : 0) + (this.player.health < 35 ? 0.2 : 0));
    this.audio.update(dt, gameplay ? intensity : 0);
    this.bestCombo = Math.max(this.bestCombo, this.player.combo);
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    const rawDt = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.updateFps(rawDt || 0.001);
    if (this.phase === 'paused') {
      this.renderSystem.render(0);
      return;
    }

    const dt = rawDt;
    this.ambientTime += dt;
    const gameplay = this.phase === 'playing';
    if (gameplay) this.time += dt;

    this.updateScene(dt, gameplay);

    if (gameplay) {
      this.updateWaveProgress(dt);
      this.hud.update(dt, this.getHUDState());
    } else if (this.phase === 'ending' || this.phase === 'ended') {
      this.hud.update(dt, this.getHUDState());
      this.updateEnd(dt);
    }

    this.renderSystem.render(dt);
  }
}
