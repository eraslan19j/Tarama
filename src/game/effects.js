import * as THREE from 'three';

function createArcGeometry(inner = 1.25, outer = 1.7, angle = 0.95, segments = 28) {
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = -angle / 2 + (i / segments) * angle;
    const x = Math.sin(t);
    const z = -Math.cos(t);
    positions.push(x * inner, 0, z * inner, x * outer, 0, z * outer);
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createRingGeometry() {
  const geometry = new THREE.RingGeometry(0.88, 1, 64);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function colorForCombo(combo) {
  if (combo >= 3) return 0xff3a21;
  if (combo === 2) return 0xffd070;
  return 0xff8b4a;
}

export function createEffects(scene, particles) {
  const arcGeometry = createArcGeometry();
  const ringGeometry = createRingGeometry();
  const arcs = [];
  const rings = [];
  const active = [];
  const scratch = new THREE.Vector3();
  let shake = 0;

  for (let i = 0; i < 8; i += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xff8b4a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(arcGeometry, material);
    mesh.name = `SlashArc${i + 1}`;
    mesh.visible = false;
    mesh.renderOrder = 3;
    scene.add(mesh);
    arcs.push(mesh);
  }

  for (let i = 0; i < 12; i += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xff6a32,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(ringGeometry, material);
    mesh.name = `Shockwave${i + 1}`;
    mesh.visible = false;
    mesh.renderOrder = 2;
    scene.add(mesh);
    rings.push(mesh);
  }

  const flash = new THREE.PointLight(0xff5a22, 0, 8, 2);
  flash.name = 'CombatFlash';
  scene.add(flash);
  let flashIntensity = 0;

  function getArc() {
    return arcs.find((mesh) => !mesh.visible) || arcs[0];
  }

  function getRing() {
    return rings.find((mesh) => !mesh.visible) || rings[0];
  }

  function addEffect(duration, tick, finish) {
    active.push({ age: 0, duration, tick, finish });
  }

  function setFlash(position, color, amount) {
    flash.position.copy(position);
    flash.color.set(color);
    flashIntensity = Math.max(flashIntensity, amount);
    flash.intensity = flashIntensity;
  }

  function createShockwave(position, color, radius = 2.3, duration = 0.55, delay = 0, height = 0.055) {
    const mesh = getRing();
    mesh.visible = true;
    mesh.position.set(position.x, height, position.z);
    mesh.scale.setScalar(0.18);
    mesh.material.color.set(color);
    mesh.material.opacity = 0;
    addEffect(duration + delay, (t, age) => {
      const time = age - delay;
      if (time < 0) return;
      const progress = Math.min(1, time / duration);
      const scale = 0.25 + progress * radius;
      mesh.scale.set(scale, 1, scale);
      mesh.material.opacity = (1 - progress) * 0.62;
    }, () => {
      mesh.visible = false;
      mesh.material.opacity = 0;
    });
  }

  function slash(position, facing, combo = 1) {
    const mesh = getArc();
    const color = colorForCombo(combo);
    mesh.visible = true;
    mesh.position.set(position.x, position.y + 1.12, position.z);
    mesh.rotation.set(0, facing - 0.55, 0);
    mesh.scale.setScalar(0.86);
    mesh.material.color.set(color);
    mesh.material.opacity = 0.72;
    addEffect(0.3, (t) => {
      mesh.rotation.y = facing - 0.55 + t * 1.1;
      mesh.scale.setScalar(0.86 + t * 0.5);
      mesh.material.opacity = (1 - t) * 0.72;
    }, () => {
      mesh.visible = false;
      mesh.material.opacity = 0;
    });

    const forward = scratch.set(Math.sin(facing), 0, Math.cos(facing));
    const center = {
      x: position.x + forward.x * 0.9,
      y: position.y + 1.05,
      z: position.z + forward.z * 0.9,
    };
    particles.burst({
      position: center,
      count: 10 + combo * 4,
      color,
      colorVariance: 0.12,
      speed: 2.5,
      size: 0.065,
      life: 0.38,
      gravity: -3.2,
      direction: { x: forward.x, y: 0.1, z: forward.z },
      coneSpread: 0.7,
      originJitter: 0.35,
    });
    setFlash(new THREE.Vector3(center.x, center.y, center.z), color, 10 + combo * 2);
    shake = Math.min(0.5, shake + 0.08 + combo * 0.015);
  }

  function hit(position, color = 0xff5a26, critical = false) {
    const point = new THREE.Vector3(position.x, position.y + 0.95, position.z);
    particles.burst({
      position: point,
      count: critical ? 34 : 20,
      color,
      colorVariance: 0.14,
      speed: critical ? 4.2 : 3,
      size: critical ? 0.085 : 0.065,
      life: 0.55,
      gravity: -4,
      upward: 0.45,
    });
    createShockwave(position, color, critical ? 1.1 : 0.72, 0.28, 0, 0.08);
    setFlash(point, color, critical ? 18 : 9);
    shake = Math.min(0.6, shake + (critical ? 0.2 : 0.11));
  }

  function block(position, color = 0xffca7a) {
    const point = new THREE.Vector3(position.x, position.y + 1.15, position.z);
    particles.burst({
      position: point,
      count: 22,
      color,
      speed: 2.5,
      size: 0.055,
      life: 0.34,
      gravity: -1.5,
    });
    setFlash(point, color, 12);
    shake = Math.min(0.4, shake + 0.1);
  }

  function shieldBash(position, facing, color = 0xffa34a) {
    createShockwave(position, color, 2.7, 0.42, 0, 0.1);
    slash(position, facing, 1);
    setFlash(new THREE.Vector3(position.x, position.y + 1.1, position.z), color, 16);
    shake = Math.min(0.7, shake + 0.26);
  }

  function dodge(position, facing) {
    const back = { x: -Math.sin(facing), y: 0.05, z: -Math.cos(facing) };
    particles.burst({
      position: { x: position.x, y: 0.12, z: position.z },
      count: 18,
      color: 0xa88b75,
      colorVariance: 0.08,
      speed: 1.4,
      size: 0.11,
      life: 0.65,
      gravity: -0.6,
      drag: 2.6,
      direction: back,
      coneSpread: 0.45,
      upward: 0.35,
    });
    createShockwave(position, 0xb7774e, 1.15, 0.35, 0, 0.04);
  }

  function sigil(position) {
    const point = new THREE.Vector3(position.x, position.y + 0.9, position.z);
    particles.burst({
      position: point,
      count: 56,
      color: 0xffb247,
      colorVariance: 0.18,
      speed: 2.7,
      size: 0.08,
      life: 1.2,
      gravity: -0.7,
      upward: 0.8,
      originJitter: 0.25,
    });
    createShockwave(position, 0xffb247, 3.3, 0.85, 0, 0.06);
    createShockwave(position, 0xffe0a0, 2.1, 0.7, 0.14, 0.07);
    setFlash(point, 0xffb247, 25);
    shake = Math.min(0.5, shake + 0.16);
  }

  function spawn(position, boss = false) {
    const color = boss ? 0xff3a20 : 0x8a231c;
    particles.burst({
      position: { x: position.x, y: 0.15, z: position.z },
      count: boss ? 58 : 24,
      color,
      colorVariance: 0.16,
      speed: boss ? 3.4 : 2.2,
      size: boss ? 0.095 : 0.07,
      life: boss ? 1 : 0.7,
      gravity: -1.3,
      upward: 0.75,
      originJitter: 0.35,
    });
    createShockwave(position, color, boss ? 3.2 : 1.5, boss ? 0.75 : 0.5, 0, 0.05);
    setFlash(new THREE.Vector3(position.x, 0.7, position.z), color, boss ? 24 : 8);
  }

  function enemyDeath(position, boss = false) {
    const color = boss ? 0xff3b20 : 0xa92820;
    particles.burst({
      position: { x: position.x, y: position.y + 0.85, z: position.z },
      count: boss ? 90 : 38,
      color,
      colorVariance: 0.22,
      speed: boss ? 5.5 : 3.4,
      size: boss ? 0.12 : 0.085,
      life: boss ? 1.35 : 0.85,
      gravity: -2.1,
      upward: 0.55,
      originJitter: boss ? 0.6 : 0.25,
    });
    createShockwave(position, color, boss ? 5 : 2, boss ? 0.9 : 0.5, 0, 0.06);
    setFlash(new THREE.Vector3(position.x, position.y + 1, position.z), color, boss ? 32 : 12);
    shake = Math.min(0.9, shake + (boss ? 0.5 : 0.16));
  }

  function bossSlam(position) {
    particles.burst({
      position: { x: position.x, y: 0.18, z: position.z },
      count: 64,
      color: 0xff4a20,
      colorVariance: 0.14,
      speed: 5.2,
      size: 0.1,
      life: 0.9,
      gravity: -2.5,
      upward: 0.3,
      originJitter: 0.4,
    });
    createShockwave(position, 0xff3a20, 6.2, 0.85, 0, 0.055);
    createShockwave(position, 0xffb05a, 4.5, 0.7, 0.12, 0.07);
    setFlash(new THREE.Vector3(position.x, 0.8, position.z), 0xff3a20, 34);
    shake = Math.min(1.2, shake + 0.62);
  }

  function update(dt) {
    const step = Math.min(dt, 0.05);
    for (let i = active.length - 1; i >= 0; i -= 1) {
      const effect = active[i];
      effect.age += step;
      const t = Math.min(1, effect.age / effect.duration);
      effect.tick(t, effect.age);
      if (effect.age >= effect.duration) {
        effect.finish?.();
        active.splice(i, 1);
      }
    }
    flashIntensity = Math.max(0, flashIntensity - step * 55);
    flash.intensity = flashIntensity;
    shake = Math.max(0, shake - step * 2.6);
  }

  function dispose() {
    arcs.forEach((mesh) => { scene.remove(mesh); mesh.material.dispose(); });
    rings.forEach((mesh) => { scene.remove(mesh); mesh.material.dispose(); });
    scene.remove(flash);
    arcGeometry.dispose();
    ringGeometry.dispose();
    active.length = 0;
  }

  return {
    slash,
    hit,
    block,
    shieldBash,
    dodge,
    sigil,
    spawn,
    enemyDeath,
    bossSlam,
    update,
    dispose,
    get shake() { return shake; },
  };
}
