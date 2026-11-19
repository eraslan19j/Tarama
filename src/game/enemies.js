import * as THREE from 'three';
import { ARENA_RADIUS } from './arena.js';

export const WAVE_DEFINITIONS = [
  {
    label: 'I · THE ASH WRAITHS',
    objective: 'Recover three dragonfire sigils and defeat the ash wraiths',
    sigils: [0, 1, 2],
    enemies: [
      { type: 'grunt', angle: -2.55, radius: 8.1 },
      { type: 'grunt', angle: -0.55, radius: 8.3 },
      { type: 'grunt', angle: 2.5, radius: 8.2 },
      { type: 'grunt', angle: 4.25, radius: 8.0 },
    ],
  },
  {
    label: 'II · THE CINDER HOST',
    objective: 'Recover the remaining sigils and break the cinder host',
    sigils: [3, 4, 5],
    enemies: [
      { type: 'grunt', angle: -2.8, radius: 8.4 },
      { type: 'brute', angle: -1.55, radius: 7.9 },
      { type: 'grunt', angle: -0.2, radius: 8.2 },
      { type: 'grunt', angle: 1.8, radius: 8.4 },
      { type: 'brute', angle: 2.75, radius: 8.0 },
      { type: 'grunt', angle: 4.65, radius: 8.3 },
    ],
  },
  {
    label: 'III · THE CINDER WARDEN',
    objective: 'Defeat the Cinder Warden and reclaim the courtyard',
    sigils: [],
    enemies: [
      { type: 'boss', angle: -Math.PI / 2, radius: 7.5 },
    ],
  },
];

const ENEMY_TYPES = {
  grunt: {
    health: 58, speed: 1.8, damage: 9, range: 1.75, cooldown: 1.55, radius: 0.48,
    scale: 0.95, score: 120, color: 0xff3a20,
  },
  brute: {
    health: 112, speed: 1.32, damage: 15, range: 2.05, cooldown: 1.9, radius: 0.66,
    scale: 1.24, score: 240, color: 0xff7a30,
  },
  boss: {
    health: 430, speed: 1.38, damage: 21, range: 2.75, cooldown: 1.7, radius: 0.95,
    scale: 1.72, score: 1500, color: 0xffb03e,
  },
};

function angleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function makeGeometries() {
  const shadow = new THREE.CircleGeometry(0.68, 28);
  shadow.rotateX(-Math.PI / 2);
  const telegraph = new THREE.RingGeometry(0.9, 1, 64);
  telegraph.rotateX(-Math.PI / 2);
  const bar = new THREE.PlaneGeometry(1.18, 0.1);
  return {
    cloak: new THREE.CylinderGeometry(0.28, 0.62, 1.45, 8, 3, true),
    hood: new THREE.SphereGeometry(0.36, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.68),
    skull: new THREE.IcosahedronGeometry(0.19, 1),
    eye: new THREE.SphereGeometry(0.045, 8, 6),
    arm: new THREE.CylinderGeometry(0.065, 0.11, 0.78, 6),
    claw: new THREE.ConeGeometry(0.035, 0.24, 5),
    spike: new THREE.ConeGeometry(0.07, 0.36, 5),
    horn: new THREE.ConeGeometry(0.1, 0.55, 6),
    wisp: new THREE.ConeGeometry(0.095, 0.6, 5),
    shard: new THREE.OctahedronGeometry(0.17, 0),
    core: new THREE.IcosahedronGeometry(0.2, 1),
    plate: new THREE.BoxGeometry(0.7, 0.34, 0.16),
    shadow,
    telegraph,
    bar,
  };
}

function makeBaseMaterials() {
  return {
    dark: new THREE.MeshStandardMaterial({
      color: 0x171016, roughness: 0.88, metalness: 0.16, emissive: 0x2a0809,
      emissiveIntensity: 0.35, transparent: true, opacity: 0.96, side: THREE.DoubleSide,
    }),
    armor: new THREE.MeshStandardMaterial({
      color: 0x2b1c21, roughness: 0.5, metalness: 0.6, emissive: 0x3a0a08,
      emissiveIntensity: 0.35,
    }),
    bone: new THREE.MeshStandardMaterial({ color: 0xa29282, roughness: 0.72, metalness: 0.05 }),
    eye: new THREE.MeshBasicMaterial({ color: 0xff4a22 }),
    ember: new THREE.MeshStandardMaterial({
      color: 0xff5a24, emissive: 0xff2b10, emissiveIntensity: 2.7, roughness: 0.35,
    }),
    aura: new THREE.MeshBasicMaterial({
      color: 0xff3a18, transparent: true, opacity: 0.16, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }),
    shadow: new THREE.MeshBasicMaterial({
      color: 0x050304, transparent: true, opacity: 0.34, depthWrite: false,
    }),
    telegraph: new THREE.MeshBasicMaterial({
      color: 0xff2c18, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }),
    barBg: new THREE.MeshBasicMaterial({ color: 0x090608, transparent: true, opacity: 0.82, depthTest: false }),
    barFill: new THREE.MeshBasicMaterial({ color: 0xd83225, transparent: true, opacity: 0.95, depthTest: false }),
  };
}

function createVisual(type, geometries, baseMaterials) {
  const stats = ENEMY_TYPES[type];
  const dark = baseMaterials.dark.clone();
  const armor = baseMaterials.armor.clone();
  const bone = baseMaterials.bone.clone();
  const eye = baseMaterials.eye.clone();
  const ember = baseMaterials.ember.clone();
  const aura = baseMaterials.aura.clone();
  const shadow = baseMaterials.shadow.clone();
  const telegraph = baseMaterials.telegraph.clone();
  const barBg = baseMaterials.barBg.clone();
  const barFill = baseMaterials.barFill.clone();
  const ownedMaterials = [dark, armor, bone, eye, ember, aura, shadow, telegraph, barBg, barFill];
  eye.color.set(stats.color);
  ember.emissive.set(stats.color);
  aura.color.set(stats.color);
  telegraph.color.set(stats.color);
  barFill.color.set(stats.color);

  const root = new THREE.Group();
  root.name = `${type.toUpperCase()}Enemy`;

  const groundShadow = new THREE.Mesh(geometries.shadow, shadow);
  groundShadow.name = 'EnemyGroundShadow';
  groundShadow.position.y = 0.035;
  groundShadow.renderOrder = 0;
  root.add(groundShadow);

  const telegraphMesh = new THREE.Mesh(geometries.telegraph, telegraph);
  telegraphMesh.name = 'EnemyAttackTelegraph';
  telegraphMesh.position.y = 0.055;
  telegraphMesh.visible = false;
  telegraphMesh.renderOrder = 2;
  root.add(telegraphMesh);

  const body = new THREE.Group();
  body.name = 'EnemyBody';
  root.add(body);

  const cloak = new THREE.Mesh(geometries.cloak, dark);
  cloak.name = 'TatteredAshCloak';
  cloak.position.y = 0.9;
  cloak.castShadow = true;
  cloak.receiveShadow = true;
  body.add(cloak);

  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const spike = new THREE.Mesh(geometries.spike, dark);
    spike.position.set(Math.cos(angle) * 0.48, 0.25, Math.sin(angle) * 0.48);
    spike.rotation.set(Math.PI, angle, 0.14);
    spike.scale.setScalar(0.65 + (i % 3) * 0.16);
    spike.castShadow = true;
    spike.name = `CloakTatter${i + 1}`;
    body.add(spike);
  }

  const head = new THREE.Group();
  head.name = 'EnemyHead';
  head.position.y = 1.66;
  body.add(head);

  const hood = new THREE.Mesh(geometries.hood, dark);
  hood.position.y = 0.03;
  hood.castShadow = true;
  hood.name = 'AshHood';
  head.add(hood);

  const skull = new THREE.Mesh(geometries.skull, bone);
  skull.position.set(0, -0.015, 0.19);
  skull.scale.set(0.88, 1, 0.78);
  skull.name = 'PaleSkull';
  head.add(skull);

  [-1, 1].forEach((side) => {
    const eyeMesh = new THREE.Mesh(geometries.eye, eye);
    eyeMesh.position.set(side * 0.082, 0.015, 0.335);
    eyeMesh.name = side < 0 ? 'LeftBurningEye' : 'RightBurningEye';
    head.add(eyeMesh);
  });

  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.name = side < 0 ? 'LeftClawArm' : 'RightClawArm';
    arm.position.set(side * 0.36, 1.28, 0.04);
    arm.rotation.set(0.15, 0, side * 0.38);
    body.add(arm);
    const limb = new THREE.Mesh(geometries.arm, dark);
    limb.position.y = -0.35;
    limb.rotation.z = side * 0.15;
    limb.castShadow = true;
    arm.add(limb);
    for (let i = 0; i < 3; i += 1) {
      const claw = new THREE.Mesh(geometries.claw, bone);
      claw.position.set((i - 1) * 0.065, -0.78, 0.02);
      claw.rotation.set(Math.PI, 0, (i - 1) * 0.1);
      claw.name = `Claw${i + 1}`;
      arm.add(claw);
    }
    return arm;
  });

  const auraGroup = new THREE.Group();
  auraGroup.name = 'EnemyAura';
  body.add(auraGroup);
  const wisps = [];
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2;
    const wisp = new THREE.Mesh(geometries.wisp, aura);
    wisp.position.set(Math.cos(angle) * 0.48, 0.72, Math.sin(angle) * 0.48);
    wisp.rotation.set(0.12, angle, Math.PI);
    wisp.scale.setScalar(type === 'boss' ? 1.5 : 1);
    wisp.name = `AshWisp${i + 1}`;
    auraGroup.add(wisp);
    wisps.push(wisp);
  }

  let shards = null;
  if (type !== 'grunt') {
    const chest = new THREE.Mesh(geometries.plate, armor);
    chest.position.set(0, 1.18, 0.3);
    chest.rotation.x = -0.08;
    chest.castShadow = true;
    chest.name = 'CharredBreastplate';
    body.add(chest);

    [-1, 1].forEach((side) => {
      const horn = new THREE.Mesh(geometries.horn, armor);
      horn.position.set(side * 0.23, 0.17, -0.02);
      horn.rotation.set(-0.35, 0, side * -0.65);
      horn.castShadow = true;
      horn.name = side < 0 ? 'LeftHorn' : 'RightHorn';
      head.add(horn);
      const shoulder = new THREE.Mesh(geometries.spike, armor);
      shoulder.position.set(side * 0.43, 1.38, 0);
      shoulder.rotation.set(0, 0, side * -0.8);
      shoulder.scale.setScalar(type === 'boss' ? 1.55 : 1.1);
      shoulder.castShadow = true;
      body.add(shoulder);
    });
  }

  if (type === 'boss') {
    const core = new THREE.Mesh(geometries.core, ember);
    core.position.set(0, 1.18, 0.42);
    core.name = 'WardenHeart';
    body.add(core);

    shards = new THREE.Group();
    shards.name = 'WardenOrbitingShards';
    body.add(shards);
    for (let i = 0; i < 7; i += 1) {
      const angle = (i / 7) * Math.PI * 2;
      const shard = new THREE.Mesh(geometries.shard, i % 2 ? armor : ember);
      shard.position.set(Math.cos(angle) * 0.92, 1.15 + Math.sin(i * 1.7) * 0.22, Math.sin(angle) * 0.92);
      shard.rotation.set(i * 0.5, angle, i * 0.3);
      shard.scale.setScalar(0.6 + (i % 3) * 0.18);
      shard.castShadow = true;
      shard.name = `WardenShard${i + 1}`;
      shards.add(shard);
    }
    for (let i = 0; i < 5; i += 1) {
      const x = (i - 2) * 0.14;
      const horn = new THREE.Mesh(geometries.horn, armor);
      horn.position.set(x, 0.28 + Math.abs(x) * -0.2, -0.03);
      horn.rotation.set(-0.25, 0, (i - 2) * -0.16);
      horn.scale.setScalar(0.7 + (2 - Math.abs(i - 2)) * 0.14);
      horn.castShadow = true;
      horn.name = `WardenCrown${i + 1}`;
      head.add(horn);
    }
  }

  const bar = new THREE.Group();
  bar.name = `${type}HealthBar`;
  const background = new THREE.Mesh(geometries.bar, barBg);
  background.renderOrder = 20;
  bar.add(background);
  const fill = new THREE.Mesh(geometries.bar, barFill);
  fill.renderOrder = 21;
  fill.position.z = 0.001;
  bar.add(fill);
  bar.visible = false;

  return {
    root, body, head, arms, wisps, auraGroup, shards, telegraph: telegraphMesh,
    bar, barFill: fill, ownedMaterials, groundShadow,
  };
}

export function createEnemies(scene, arena, effects, audio, hud, callbacks = {}) {
  const geometries = makeGeometries();
  const baseMaterials = makeBaseMaterials();
  const enemies = [];
  const scratch = new THREE.Vector3();
  const scratchB = new THREE.Vector3();
  let waveIndex = 0;
  let boss = null;
  let bossSummoned = false;

  function makeEnemy(type, position) {
    const stats = ENEMY_TYPES[type];
    const visual = createVisual(type, geometries, baseMaterials);
    const enemy = {
      type,
      stats,
      visual,
      root: visual.root,
      bar: visual.bar,
      health: stats.health,
      maxHealth: stats.health,
      baseScale: stats.scale,
      radius: stats.radius,
      state: 'spawning',
      timer: 1.05,
      duration: 1.05,
      cooldown: 0.7 + Math.random() * 0.7,
      attackCount: 0,
      attackKind: 'melee',
      attackApplied: false,
      knockback: new THREE.Vector3(),
      hitFlash: 0,
      barTimer: 0,
      deathTimer: 0.48,
      phase: Math.random() * Math.PI * 2,
      remove: false,
      dead: false,
    };
    enemy.root.position.copy(position);
    enemy.root.scale.setScalar(0.001);
    enemy.root.rotation.y = Math.atan2(-position.x, -position.z);
    scene.add(enemy.root);
    scene.add(enemy.bar);
    enemies.push(enemy);
    effects.spawn(position, type === 'boss');
    if (type === 'boss') {
      boss = enemy;
      callbacks.onBossHealth?.(1);
      audio.play('boss');
    }
    return enemy;
  }

  function chooseSpawnPosition(angle, radius, playerPosition, index = 0) {
    for (let attempt = 0; attempt < 14; attempt += 1) {
      const offset = (attempt % 2 ? 1 : -1) * Math.ceil(attempt / 2) * 0.38;
      const a = angle + offset + index * 0.07;
      const r = Math.min(ARENA_RADIUS - 0.65, radius + (attempt % 3) * 0.28);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (playerPosition) {
        const dx = x - playerPosition.x;
        const dz = z - playerPosition.z;
        if (dx * dx + dz * dz < 5.2 * 5.2) continue;
      }
      const blocked = arena.obstacles.some((obstacle) => {
        const dx = x - obstacle.x;
        const dz = z - obstacle.z;
        return dx * dx + dz * dz < (obstacle.radius + 1.05) ** 2;
      });
      if (!blocked) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  }

  function removeEnemy(enemy) {
    scene.remove(enemy.root);
    scene.remove(enemy.bar);
    enemy.visual.ownedMaterials.forEach((material) => material.dispose());
    if (enemy === boss) {
      boss = null;
      callbacks.onBossHealth?.(0);
    }
  }

  function removeAll() {
    for (let i = enemies.length - 1; i >= 0; i -= 1) removeEnemy(enemies[i]);
    enemies.length = 0;
    boss = null;
    bossSummoned = false;
  }

  function spawnWave(index, playerPosition) {
    waveIndex = Math.max(0, Math.min(WAVE_DEFINITIONS.length - 1, index));
    removeAll();
    const wave = WAVE_DEFINITIONS[waveIndex];
    wave.enemies.forEach((spec, enemyIndex) => {
      const position = chooseSpawnPosition(spec.angle, spec.radius, playerPosition, enemyIndex);
      makeEnemy(spec.type, position);
    });
    return wave;
  }

  function beginWindup(enemy) {
    enemy.state = 'windup';
    enemy.attackKind = 'melee';
    if (enemy.type === 'boss' && enemy.attackCount % 3 === 2) enemy.attackKind = 'slam';
    enemy.duration = enemy.attackKind === 'slam' ? 1.05 : enemy.type === 'boss' ? 0.78 : 0.56;
    enemy.timer = enemy.duration;
    enemy.attackApplied = false;
    enemy.visual.telegraph.visible = true;
  }

  function beginAttack(enemy) {
    enemy.state = 'attack';
    enemy.duration = enemy.attackKind === 'slam' ? 0.5 : 0.28;
    enemy.timer = enemy.duration;
    enemy.attackApplied = false;
    enemy.visual.telegraph.visible = false;
  }

  function beginRecover(enemy) {
    enemy.state = 'recover';
    enemy.duration = enemy.type === 'boss' ? 0.72 : 0.52;
    enemy.timer = enemy.duration;
    enemy.cooldown = enemy.stats.cooldown * (0.78 + Math.random() * 0.35);
    enemy.attackCount += 1;
  }

  function performAttack(enemy, player) {
    if (enemy.attackApplied) return;
    enemy.attackApplied = true;
    const from = enemy.root.position;
    const to = player.position;
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const distance = Math.hypot(dx, dz);
    if (enemy.attackKind === 'slam') {
      effects.bossSlam(new THREE.Vector3(from.x, 0, from.z));
      audio.play('slam');
      callbacks.onPlayerDamage?.({
        damage: 27,
        position: new THREE.Vector3(from.x, 0, from.z),
        source: enemy,
        type: 'slam',
        radius: 4.35,
      });
      return;
    }
    effects.slash(new THREE.Vector3(from.x, 0, from.z), enemy.root.rotation.y, 1);
    audio.play('attack', { power: 0.65 });
    if (distance <= enemy.stats.range + 0.65) {
      callbacks.onPlayerDamage?.({
        damage: enemy.stats.damage,
        position: new THREE.Vector3(from.x, 0, from.z),
        source: enemy,
        type: 'melee',
      });
    }
  }

  function resolvePosition(enemy, desired, dt) {
    const next = scratch.copy(enemy.root.position).add(desired);
    next.addScaledVector(enemy.knockback, dt);
    enemy.knockback.multiplyScalar(Math.max(0, 1 - dt * 5.5));

    enemies.forEach((other) => {
      if (other === enemy || other.dead || other.state === 'spawning') return;
      const dx = next.x - other.root.position.x;
      const dz = next.z - other.root.position.z;
      const minDistance = enemy.radius + other.radius + 0.18;
      const distance = Math.hypot(dx, dz);
      if (distance > 0.001 && distance < minDistance) {
        const push = (minDistance - distance) * 0.55;
        next.x += (dx / distance) * push;
        next.z += (dz / distance) * push;
      }
    });

    arena.obstacles.forEach((obstacle) => {
      const dx = next.x - obstacle.x;
      const dz = next.z - obstacle.z;
      const minDistance = obstacle.radius + enemy.radius;
      const distance = Math.hypot(dx, dz);
      if (distance > 0.001 && distance < minDistance) {
        const push = minDistance - distance;
        next.x += (dx / distance) * push;
        next.z += (dz / distance) * push;
      }
    });

    const boundary = ARENA_RADIUS - enemy.radius - 0.25;
    const radial = Math.hypot(next.x, next.z);
    if (radial > boundary) {
      next.x *= boundary / radial;
      next.z *= boundary / radial;
    }
    enemy.root.position.x = next.x;
    enemy.root.position.z = next.z;
  }

  function setEnemyPose(enemy, time, dt, progress) {
    const { visual, state } = enemy;
    const hover = Math.sin(time * 2.1 + enemy.phase) * 0.055;
    visual.body.position.y = hover;
    visual.body.rotation.z = Math.sin(time * 1.3 + enemy.phase) * 0.025;
    visual.head.rotation.y = Math.sin(time * 0.8 + enemy.phase) * 0.09;
    visual.auraGroup.rotation.y = time * 0.55 + enemy.phase;
    visual.wisps.forEach((wisp, index) => {
      wisp.scale.y = 0.85 + Math.sin(time * 3 + index * 1.4 + enemy.phase) * 0.22;
      wisp.material.opacity = 0.12 + Math.sin(time * 2.4 + index) * 0.04;
    });
    if (visual.shards) {
      visual.shards.rotation.y = -time * 0.75;
      visual.shards.children.forEach((shard, index) => {
        shard.rotation.x += dt * (0.4 + index * 0.05);
        shard.position.y = 1.15 + Math.sin(time * 1.4 + index) * 0.22;
      });
    }

    let armLift = 0;
    let armSwing = 0;
    let pulse = 0;
    if (state === 'windup') {
      armLift = -1.05 * progress;
      pulse = 0.35 + progress * 0.65;
      visual.telegraph.scale.setScalar((enemy.attackKind === 'slam' ? 4.25 : enemy.stats.range) * (0.35 + progress * 0.65));
      visual.telegraph.material.opacity = 0.18 + progress * 0.42;
    } else if (state === 'attack') {
      armSwing = 1.5 * (1 - progress);
      pulse = 1 - progress;
      visual.telegraph.material.opacity = 0;
    } else if (state === 'stagger') {
      armLift = -0.3;
      visual.body.rotation.z = Math.sin(time * 32) * 0.14;
    } else {
      armLift = Math.sin(time * 1.8 + enemy.phase) * 0.1;
      visual.telegraph.material.opacity = 0;
      visual.telegraph.visible = false;
    }
    visual.arms.forEach((arm, index) => {
      const side = index === 0 ? -1 : 1;
      arm.rotation.x = 0.15 + armLift + armSwing + Math.sin(time * 1.5 + index + enemy.phase) * 0.08;
      arm.rotation.z = side * (0.38 + pulse * 0.14);
    });
    visual.head.rotation.x = state === 'windup' ? -0.22 * progress : state === 'attack' ? 0.2 : 0;

    const flash = enemy.hitFlash > 0 ? enemy.hitFlash / 0.16 : 0;
    const dark = visual.ownedMaterials[0];
    dark.emissive.setHex(0x2a0809);
    dark.emissive.lerp(new THREE.Color(0xffd0a0), Math.min(1, flash));
    dark.emissiveIntensity = 0.35 + pulse * 0.5 + flash * 1.2;
    const eye = visual.ownedMaterials[3];
    eye.color.setHex(enemy.stats.color);
    eye.color.lerp(new THREE.Color(0xffe7b0), Math.min(1, pulse * 0.6 + flash));
    if (enemy.state !== 'spawning' && !enemy.dead) {
      enemy.root.scale.setScalar(enemy.baseScale * (1 + pulse * 0.025 + flash * 0.025));
    }
  }

  function updateBar(enemy, camera, playerPosition) {
    const { bar, visual } = enemy;
    const barFill = visual.barFill;
    if (enemy.dead) {
      bar.visible = false;
      return;
    }
    const ratio = Math.max(0, enemy.health / enemy.maxHealth);
    barFill.scale.x = Math.max(0.001, ratio);
    barFill.position.x = -0.59 * (1 - ratio);
    const height = (enemy.type === 'boss' ? 3.55 : 2.28) * enemy.baseScale;
    bar.position.set(enemy.root.position.x, enemy.root.position.y + height, enemy.root.position.z);
    bar.quaternion.copy(camera.quaternion);
    const playerDistance = playerPosition
      ? Math.hypot(enemy.root.position.x - playerPosition.x, enemy.root.position.z - playerPosition.z)
      : 99;
    bar.visible = enemy.type === 'boss' || enemy.barTimer > 0 || playerDistance < 4.5;
    visual.barFill.material.opacity = enemy.barTimer > 0 ? 0.98 : 0.72;
  }

  function summonMinions(playerPosition) {
    bossSummoned = true;
    hud.message('THE WARDEN CALLS THE ASH HOST', 'boss', 2600);
    audio.play('boss');
    const angles = [-2.2, 0.5];
    angles.forEach((angle, index) => {
      const position = chooseSpawnPosition(angle, 7.6, playerPosition, index + 9);
      makeEnemy('grunt', position);
    });
  }

  function update(dt, time, player, camera) {
    const step = Math.min(dt, 0.05);
    const playerPosition = player.position;
    enemies.forEach((enemy) => {
      if (enemy.remove) return;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - step);
      enemy.barTimer = Math.max(0, enemy.barTimer - step);
      enemy.cooldown = Math.max(0, enemy.cooldown - step);

      if (enemy.dead) {
        enemy.deathTimer -= step;
        const t = Math.max(0, enemy.deathTimer / 0.48);
        enemy.root.scale.setScalar(enemy.baseScale * t);
        enemy.root.rotation.y += step * 4;
        enemy.root.position.y = step * 0 + (1 - t) * 0.5;
        updateBar(enemy, camera, playerPosition);
        if (enemy.deathTimer <= 0) enemy.remove = true;
        return;
      }

      if (enemy.state === 'spawning') {
        enemy.timer -= step;
        const t = Math.min(1, 1 - Math.max(0, enemy.timer) / enemy.duration);
        const scale = Math.max(0.001, easeOutBack(t));
        enemy.root.scale.setScalar(enemy.baseScale * scale);
        enemy.root.position.y = (1 - t) * 0.65;
        setEnemyPose(enemy, time, step, t);
        updateBar(enemy, camera, playerPosition);
        if (enemy.timer <= 0) {
          enemy.state = 'chase';
          enemy.root.scale.setScalar(enemy.baseScale);
          enemy.root.position.y = 0;
        }
        return;
      }

      enemy.root.scale.setScalar(enemy.baseScale);
      enemy.root.position.y = Math.sin(time * 1.6 + enemy.phase) * 0.035;

      const dx = playerPosition.x - enemy.root.position.x;
      const dz = playerPosition.z - enemy.root.position.z;
      const distance = Math.hypot(dx, dz) || 0.001;
      const directionX = dx / distance;
      const directionZ = dz / distance;
      const targetAngle = Math.atan2(directionX, directionZ);
      enemy.root.rotation.y += angleDelta(enemy.root.rotation.y, targetAngle) * Math.min(1, step * 8.5);

      const desired = scratchB.set(0, 0, 0);
      let progress = 0;
      if (enemy.state === 'chase') {
        const stop = enemy.stats.range * 0.82;
        if (distance > stop) {
          desired.x = directionX * enemy.stats.speed * step;
          desired.z = directionZ * enemy.stats.speed * step;
        }
        if (enemy.cooldown <= 0 && distance <= enemy.stats.range + (enemy.attackKind === 'slam' ? 2.4 : 0.1)) {
          beginWindup(enemy);
        }
      } else if (enemy.state === 'windup') {
        enemy.timer -= step;
        progress = 1 - Math.max(0, enemy.timer) / enemy.duration;
        if (enemy.attackKind === 'slam' && progress > 0.72) {
          desired.x = directionX * 0.35 * step;
          desired.z = directionZ * 0.35 * step;
        }
        if (enemy.timer <= 0) beginAttack(enemy);
      } else if (enemy.state === 'attack') {
        enemy.timer -= step;
        progress = 1 - Math.max(0, enemy.timer) / enemy.duration;
        performAttack(enemy, player);
        const lunge = enemy.attackKind === 'slam' ? 0.5 : 2.7;
        desired.x = directionX * lunge * step * (1 - progress);
        desired.z = directionZ * lunge * step * (1 - progress);
        if (enemy.timer <= 0) beginRecover(enemy);
      } else if (enemy.state === 'recover') {
        enemy.timer -= step;
        progress = 1 - Math.max(0, enemy.timer) / enemy.duration;
        if (enemy.timer <= 0) enemy.state = 'chase';
      } else if (enemy.state === 'stagger') {
        enemy.timer -= step;
        progress = 1 - Math.max(0, enemy.timer) / enemy.duration;
        if (enemy.timer <= 0) enemy.state = 'chase';
      }

      resolvePosition(enemy, desired, step);
      setEnemyPose(enemy, time, step, progress);
      updateBar(enemy, camera, playerPosition);

      if (enemy.type === 'boss' && !bossSummoned && enemy.health / enemy.maxHealth <= 0.55 && !enemy.dead) {
        summonMinions(playerPosition);
      }
    });

    for (let i = enemies.length - 1; i >= 0; i -= 1) {
      if (enemies[i].remove) {
        removeEnemy(enemies[i]);
        enemies.splice(i, 1);
      }
    }
  }

  function killEnemy(enemy) {
    if (enemy.dead) return;
    enemy.dead = true;
    enemy.state = 'dead';
    enemy.deathTimer = 0.48;
    enemy.bar.visible = false;
    enemy.visual.telegraph.visible = false;
    effects.enemyDeath(new THREE.Vector3(enemy.root.position.x, 0, enemy.root.position.z), enemy.type === 'boss');
    audio.play('enemyDeath');
    callbacks.onEnemyKilled?.(enemy);
    if (enemy.type === 'boss') callbacks.onBossHealth?.(0);
  }

  function damageEnemy(enemy, amount, direction, options = {}) {
    if (enemy.dead || enemy.state === 'spawning') return false;
    enemy.health = Math.max(0, enemy.health - amount);
    enemy.hitFlash = 0.16;
    enemy.barTimer = 2.4;
    enemy.knockback.addScaledVector(direction, options.knockback ?? (enemy.type === 'boss' ? 0.6 : 3.2));
    if (options.stun || enemy.type !== 'boss' || enemy.health < enemy.maxHealth * 0.35) {
      enemy.state = 'stagger';
      enemy.duration = enemy.type === 'boss' ? 0.16 : options.stun ?? 0.28;
      enemy.timer = enemy.duration;
    }
    if (enemy.type === 'boss') callbacks.onBossHealth?.(enemy.health / enemy.maxHealth);
    if (enemy.health <= 0) killEnemy(enemy);
    return true;
  }

  function queryAttack(origin, facing, options = {}) {
    const range = options.range ?? 2.55;
    const arc = options.arc ?? 1.42;
    const cosLimit = Math.cos(arc / 2);
    const forward = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
    let hits = 0;
    let kills = 0;
    let damage = 0;
    enemies.forEach((enemy) => {
      if (enemy.dead || enemy.state === 'spawning') return;
      const dx = enemy.root.position.x - origin.x;
      const dz = enemy.root.position.z - origin.z;
      const distance = Math.hypot(dx, dz);
      if (distance > range + enemy.radius || distance < 0.001) return;
      if ((dx * forward.x + dz * forward.z) / distance < cosLimit) return;
      const critical = options.critical ?? (options.combo >= 3 && Math.random() < 0.24);
      const amount = Math.round((options.damage ?? 25) * (critical ? 1.65 : 1));
      const direction = new THREE.Vector3(dx, 0, dz).normalize();
      const wasAlive = !enemy.dead;
      damageEnemy(enemy, amount, direction, { knockback: options.knockback ?? 3.4, stun: critical ? 0.42 : 0.25 });
      const hitPosition = new THREE.Vector3(
        enemy.root.position.x,
        enemy.root.position.y + 1.55 * enemy.baseScale,
        enemy.root.position.z,
      );
      effects.hit(new THREE.Vector3(enemy.root.position.x, 0, enemy.root.position.z), critical ? 0xffd070 : 0xff5a26, critical);
      hud.floatText(hitPosition, critical ? `CRITICAL ${amount}` : `${amount}`, critical ? 'crit' : '');
      audio.play(critical ? 'crit' : 'hit');
      hits += 1;
      damage += amount;
      if (wasAlive && enemy.dead) kills += 1;
    });
    return { hits, kills, damage };
  }

  function queryShieldBash(origin, facing) {
    const forward = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
    let hits = 0;
    enemies.forEach((enemy) => {
      if (enemy.dead || enemy.state === 'spawning') return;
      const dx = enemy.root.position.x - origin.x;
      const dz = enemy.root.position.z - origin.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 2.85 + enemy.radius || distance < 0.001) return;
      if ((dx * forward.x + dz * forward.z) / distance < Math.cos(0.85)) return;
      const direction = new THREE.Vector3(dx, 0, dz).normalize();
      damageEnemy(enemy, 20, direction, { knockback: 7.5, stun: enemy.type === 'boss' ? 0.25 : 0.72 });
      effects.block(new THREE.Vector3(enemy.root.position.x, 0, enemy.root.position.z), 0xffc06a);
      hud.floatText(new THREE.Vector3(enemy.root.position.x, enemy.root.position.y + 1.6, enemy.root.position.z), 'STAGGER', 'crit');
      hits += 1;
    });
    audio.play('block');
    return hits;
  }

  function getMinimapData() {
    return enemies
      .filter((enemy) => !enemy.dead && enemy.state !== 'spawning')
      .map((enemy) => ({
        x: enemy.root.position.x,
        z: enemy.root.position.z,
        type: enemy.type,
        health: enemy.health / enemy.maxHealth,
      }));
  }

  function reset() {
    removeAll();
    waveIndex = 0;
  }

  function dispose() {
    removeAll();
    Object.values(geometries).forEach((geometry) => geometry.dispose());
    Object.values(baseMaterials).forEach((material) => material.dispose());
  }

  return {
    spawnWave,
    update,
    queryAttack,
    queryShieldBash,
    getMinimapData,
    reset,
    dispose,
    get enemies() { return enemies; },
    get aliveCount() { return enemies.filter((enemy) => !enemy.dead).length; },
    get waveIndex() { return waveIndex; },
    get boss() { return boss; },
    get bossHealth() { return boss ? boss.health / boss.maxHealth : 0; },
  };
}
