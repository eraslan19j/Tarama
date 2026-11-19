import * as THREE from 'three';
import { SIGIL_POSITIONS } from './arena.js';

function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,245,205,1)');
  gradient.addColorStop(0.22, 'rgba(255,160,60,.7)');
  gradient.addColorStop(0.65, 'rgba(255,65,20,.18)');
  gradient.addColorStop(1, 'rgba(255,40,10,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createSigils(scene, arena, effects, audio, hud, onCollect) {
  const glowTexture = makeGlowTexture();
  const crystalGeometry = new THREE.OctahedronGeometry(0.24, 0);
  const coreGeometry = new THREE.OctahedronGeometry(0.13, 1);
  const ringGeometry = new THREE.TorusGeometry(0.42, 0.014, 6, 36);
  const items = [];
  const collected = new Set();
  let active = new Set();
  let enabled = false;

  SIGIL_POSITIONS.forEach((position, index) => {
    const root = new THREE.Group();
    root.name = `DragonfireSigil${index + 1}`;
    root.position.copy(position);
    root.position.y = 1.18;

    const crystalMaterial = new THREE.MeshStandardMaterial({
      color: 0xffb34a,
      emissive: 0xff4b18,
      emissiveIntensity: 2.5,
      metalness: 0.15,
      roughness: 0.18,
      transparent: true,
      opacity: 0.92,
      flatShading: true,
    });
    const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
    crystal.name = `SigilCrystal${index + 1}`;
    crystal.castShadow = true;
    root.add(crystal);

    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe0a3,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.name = `SigilCore${index + 1}`;
    core.scale.setScalar(0.72);
    root.add(core);

    const ringMaterials = [0, 1].map((ringIndex) => new THREE.MeshBasicMaterial({
      color: ringIndex ? 0xffd27a : 0xff5a24,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    const rings = [0, 1].map((ringIndex) => {
      const ring = new THREE.Mesh(ringGeometry, ringMaterials[ringIndex]);
      ring.name = `SigilOrbit${index + 1}-${ringIndex + 1}`;
      ring.rotation.x = ringIndex ? Math.PI / 2.7 : Math.PI / 2;
      ring.rotation.y = ringIndex * 0.6;
      ring.scale.setScalar(ringIndex ? 0.76 : 1);
      root.add(ring);
      return ring;
    });

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xff7a30,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    halo.name = `SigilHalo${index + 1}`;
    halo.scale.set(1.65, 1.65, 1);
    root.add(halo);

    scene.add(root);
    items.push({ root, position: position.clone(), crystal, crystalMaterial, core, coreMaterial, rings, ringMaterials, halo, index });
  });

  function applyVisual(item) {
    const isActive = active.has(item.index);
    const isCollected = collected.has(item.index);
    item.root.visible = !isCollected;
    if (isCollected) return;
    item.crystalMaterial.emissiveIntensity = isActive ? 2.9 : 0.35;
    item.crystalMaterial.opacity = isActive ? 0.96 : 0.24;
    item.coreMaterial.opacity = isActive ? 0.82 : 0.12;
    item.halo.material.opacity = isActive ? 0.65 : 0.08;
    item.halo.material.color.set(isActive ? 0xff9b42 : 0x5d211b);
    item.ringMaterials.forEach((material) => {
      material.opacity = isActive ? 0.58 : 0.1;
      material.color.set(isActive ? 0xffa34a : 0x5a201b);
    });
    item.root.scale.setScalar(isActive ? 1 : 0.78);
  }

  function setWave(indices) {
    active = new Set(indices);
    items.forEach(applyVisual);
  }

  function collect(index) {
    if (!enabled || !active.has(index) || collected.has(index)) return false;
    collected.add(index);
    active.delete(index);
    const item = items[index];
    applyVisual(item);
    arena.setPylonCharged(index, true);
    const point = new THREE.Vector3(item.position.x, 1.15, item.position.z);
    effects.sigil(new THREE.Vector3(item.position.x, 0, item.position.z));
    audio.play('sigil');
    hud.floatText(point, '+ DRAGONFIRE', 'heal');
    onCollect?.(index, collected.size);
    return true;
  }

  function update(dt, time, playerPosition) {
    items.forEach((item, index) => {
      if (!item.root.visible) return;
      const isActive = active.has(index);
      item.root.position.y = 1.16 + Math.sin(time * 1.7 + index * 1.2) * (isActive ? 0.11 : 0.04);
      item.crystal.rotation.y = time * (isActive ? 1.35 : 0.25) + index;
      item.crystal.rotation.x = Math.sin(time * 0.8 + index) * 0.16;
      item.core.rotation.y = -time * 2.1;
      item.rings[0].rotation.z = time * (isActive ? 0.85 : 0.22) + index;
      item.rings[1].rotation.x = Math.PI / 2.7 + Math.sin(time * 1.2 + index) * 0.25;
      item.rings[1].rotation.y = time * (isActive ? 1.1 : 0.2);
      const pulse = 0.9 + Math.sin(time * 3.1 + index) * 0.1;
      item.halo.scale.setScalar((isActive ? 1.65 : 1.1) * pulse);
      if (enabled && isActive && playerPosition) {
        const dx = item.position.x - playerPosition.x;
        const dz = item.position.z - playerPosition.z;
        if (dx * dx + dz * dz < 1.45 * 1.45) collect(index);
      }
    });
  }

  function reset() {
    collected.clear();
    active.clear();
    enabled = false;
    arena.reset();
    items.forEach(applyVisual);
  }

  function setEnabled(value) {
    enabled = Boolean(value);
  }

  function getActivePositions() {
    return items
      .filter((item) => active.has(item.index) && !collected.has(item.index))
      .map((item) => item.position.clone());
  }

  function dispose() {
    items.forEach((item) => scene.remove(item.root));
    crystalGeometry.dispose();
    coreGeometry.dispose();
    ringGeometry.dispose();
    glowTexture.dispose();
  }

  return {
    items,
    setWave,
    collect,
    update,
    reset,
    setEnabled,
    getActivePositions,
    dispose,
    get collectedCount() { return collected.size; },
    get remaining() { return active.size; },
  };
}
