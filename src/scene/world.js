import * as THREE from 'three';
import { addMesh, roundedBox } from './geometry.js';
import { seededRandom } from './textures.js';

function createFlameMaterial() {
  return new THREE.MeshBasicMaterial({
    color: 0xff5a21,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function addGround(scene, materials, textures) {
  const ground = new THREE.Group();
  ground.name = 'CourtyardGround';

  addMesh(ground, new THREE.CylinderGeometry(11.4, 11.7, 0.34, 96), materials.stoneDark, {
    position: [0, -0.19, 0],
    name: 'BedrockBase',
  });
  addMesh(ground, new THREE.CircleGeometry(11.35, 96), materials.stone, {
    position: [0, -0.008, 0],
    rotation: [-Math.PI / 2, 0, 0],
    name: 'StoneFloor',
  });
  addMesh(ground, new THREE.CylinderGeometry(3.72, 3.88, 0.16, 80), materials.stoneWarm, {
    position: [0, -0.08, 0],
    name: 'SigilDais',
  });

  const floorSigilMaterial = new THREE.MeshBasicMaterial({
    map: textures.sigil || null,
    color: textures.sigil ? 0xff6048 : 0x6b1414,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const floorSigil = addMesh(ground, new THREE.PlaneGeometry(5.8, 5.8), floorSigilMaterial, {
    position: [0, 0.012, 0],
    rotation: [-Math.PI / 2, 0, 0],
    castShadow: false,
    receiveShadow: false,
    name: 'InlaidDragonSigil',
  });

  const rings = [];
  [1.35, 2.55, 3.34].forEach((radius, index) => {
    const material = index === 1 ? materials.ringGlow.clone() : materials.darkBrass;
    const ring = addMesh(ground, new THREE.TorusGeometry(radius, index === 1 ? 0.018 : 0.011, 8, 96), material, {
      position: [0, 0.018, 0],
      rotation: [Math.PI / 2, 0, 0],
      castShadow: false,
      name: `CourtyardRing${index + 1}`,
    });
    rings.push(ring);
  });

  for (let i = 0; i < 24; i += 1) {
    const angle = (i / 24) * Math.PI * 2;
    const length = i % 3 === 0 ? 0.72 : 0.38;
    addMesh(ground, new THREE.BoxGeometry(0.018, 0.012, length), i % 3 === 0 ? materials.redTrim : materials.darkBrass, {
      position: [Math.cos(angle) * 3.05, 0.019, Math.sin(angle) * 3.05],
      rotation: [0, -angle + Math.PI / 2, 0],
      castShadow: false,
      name: `RadialInlay${i + 1}`,
    });
  }

  const rng = seededRandom(4242);
  const slabGeometry = roundedBox(1, 0.11, 1, 0.025, 2);
  const slabSets = [
    new THREE.InstancedMesh(slabGeometry, materials.stone, 46),
    new THREE.InstancedMesh(slabGeometry, materials.stoneWarm, 40),
    new THREE.InstancedMesh(slabGeometry, materials.stoneDark, 40),
  ];
  const dummy = new THREE.Object3D();
  slabSets.forEach((set, setIndex) => {
    for (let i = 0; i < set.count; i += 1) {
      const radius = 4.0 + rng() * 6.5;
      const angle = rng() * Math.PI * 2;
      dummy.position.set(Math.cos(angle) * radius, 0.018 + rng() * 0.014, Math.sin(angle) * radius);
      dummy.rotation.set(0, rng() * Math.PI, 0);
      dummy.scale.set(0.75 + rng() * 0.85, 0.55 + rng() * 0.4, 0.65 + rng() * 0.9);
      dummy.updateMatrix();
      set.setMatrixAt(i, dummy.matrix);
    }
    set.name = `FlagstoneSet${setIndex + 1}`;
    set.instanceMatrix.needsUpdate = true;
    set.receiveShadow = true;
    set.castShadow = false;
    ground.add(set);
  });

  scene.add(ground);
  return { ground, floorSigil, rings };
}

function addRuins(scene, materials) {
  const group = new THREE.Group();
  group.name = 'CourtyardRuins';
  const rng = seededRandom(8801);

  const wallGeometry = new THREE.BoxGeometry(1.55, 1, 0.75);
  const wall = new THREE.InstancedMesh(wallGeometry, materials.stoneDark, 38);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < wall.count; i += 1) {
    const angle = (i / wall.count) * Math.PI * 2;
    const radius = 10.25 + (rng() - 0.5) * 0.18;
    const height = 0.65 + rng() * 1.2;
    dummy.position.set(Math.cos(angle) * radius, height / 2 - 0.02, Math.sin(angle) * radius);
    dummy.rotation.set(0, -angle, (rng() - 0.5) * 0.08);
    dummy.scale.set(0.85 + rng() * 0.25, height, 0.8 + rng() * 0.35);
    dummy.updateMatrix();
    wall.setMatrixAt(i, dummy.matrix);
  }
  wall.name = 'BrokenOuterWall';
  wall.instanceMatrix.needsUpdate = true;
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2 + 0.18;
    const radius = 6.6 + (rng() - 0.5) * 0.5;
    const height = 0.9 + rng() * 1.9;
    const pillar = new THREE.Group();
    pillar.name = `BrokenPillar${i + 1}`;
    pillar.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    pillar.rotation.y = -angle;
    pillar.rotation.z = (rng() - 0.5) * 0.08;
    addMesh(pillar, roundedBox(0.7, 0.22, 0.7, 0.04, 2), materials.stoneWarm, {
      position: [0, 0.11, 0], name: `PillarBase${i + 1}`,
    });
    addMesh(pillar, new THREE.CylinderGeometry(0.24, 0.28, height, 9), materials.stone, {
      position: [0, height / 2 + 0.2, 0], name: `PillarShaft${i + 1}`,
    });
    if (i % 3 !== 0) {
      addMesh(pillar, roundedBox(0.68, 0.18, 0.68, 0.03, 2), materials.stoneWarm, {
        position: [0, height + 0.28, 0], rotation: [0.05, 0.2, 0.03], name: `PillarCapital${i + 1}`,
      });
    }
    for (let k = 0; k < 3; k += 1) {
      addMesh(pillar, new THREE.TorusGeometry(0.255, 0.008, 5, 18), materials.steelDark, {
        position: [0, 0.38 + k * height * 0.27, 0],
        rotation: [Math.PI / 2, 0, 0],
        castShadow: false,
        name: `PillarBand${i}${k}`,
      });
    }
    group.add(pillar);
  }

  for (let i = 0; i < 18; i += 1) {
    const angle = (i / 18) * Math.PI * 2 + 0.1;
    const radius = 13 + rng() * 4;
    const height = 2.2 + rng() * 4.8;
    addMesh(group, new THREE.ConeGeometry(0.55 + rng() * 0.85, height, 5), materials.stoneDark, {
      position: [Math.cos(angle) * radius, height / 2 - 0.4, Math.sin(angle) * radius],
      rotation: [0, rng() * Math.PI, (rng() - 0.5) * 0.12],
      castShadow: false,
      name: `DistantSpike${i + 1}`,
    });
  }
  scene.add(group);
  return group;
}

function createBrazier(materials, flameMaterial, index) {
  const group = new THREE.Group();
  group.name = `DragonfireBrazier${index + 1}`;
  addMesh(group, new THREE.CylinderGeometry(0.075, 0.13, 0.85, 10), materials.steelDark, {
    position: [0, 0.43, 0], name: `BrazierStem${index + 1}`,
  });
  addMesh(group, new THREE.CylinderGeometry(0.34, 0.22, 0.20, 16), materials.steelDark, {
    position: [0, 0.92, 0], name: `BrazierBowl${index + 1}`,
  });
  addMesh(group, new THREE.TorusGeometry(0.33, 0.025, 8, 20), materials.redTrim, {
    position: [0, 1.02, 0], rotation: [Math.PI / 2, 0, 0], name: `BrazierRim${index + 1}`,
  });
  addMesh(group, new THREE.SphereGeometry(0.22, 12, 8), materials.ember, {
    position: [0, 1.03, 0], scale: [1, 0.34, 1], name: `BrazierEmbers${index + 1}`,
  });

  const flames = new THREE.Group();
  flames.name = `AnimatedFlames${index + 1}`;
  for (let i = 0; i < 3; i += 1) {
    addMesh(flames, new THREE.ConeGeometry(0.13 - i * 0.025, 0.55 + i * 0.13, 7), flameMaterial.clone(), {
      position: [(i - 1) * 0.045, 1.22 + i * 0.05, (i % 2) * 0.035],
      rotation: [0.06 * i, i * 0.8, (i - 1) * 0.10],
      castShadow: false,
      name: `Flame${index}${i}`,
    });
  }
  group.add(flames);
  const light = new THREE.PointLight(0xff5426, 12, 7.5, 1.8);
  light.position.set(0, 1.35, 0);
  light.name = `BrazierLight${index + 1}`;
  group.add(light);
  return { group, flames, light, baseIntensity: 12, phase: index * 1.71 };
}

function addBraziers(scene, materials) {
  const flameMaterial = createFlameMaterial();
  const braziers = [];
  for (let i = 0; i < 4; i += 1) {
    const angle = Math.PI / 4 + (i / 4) * Math.PI * 2;
    const radius = 4.75;
    const brazier = createBrazier(materials, flameMaterial, i);
    brazier.group.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    scene.add(brazier.group);
    braziers.push(brazier);
  }
  return braziers;
}

function addBanners(scene, materials) {
  const group = new THREE.Group();
  group.name = 'DragonBanners';
  const banners = [];
  [-4.8, 4.8].forEach((x, index) => {
    const bannerGroup = new THREE.Group();
    bannerGroup.name = `Banner${index + 1}`;
    bannerGroup.position.set(x, 0, -8.2 - index * 0.25);
    addMesh(bannerGroup, new THREE.CylinderGeometry(0.045, 0.055, 4.5, 8), materials.steelDark, {
      position: [-0.82, 2.25, 0], name: `BannerPole${index + 1}`,
    });
    addMesh(bannerGroup, new THREE.CylinderGeometry(0.03, 0.03, 1.7, 8), materials.darkBrass, {
      position: [-0.05, 3.95, 0], rotation: [0, 0, Math.PI / 2], name: `BannerCrossbar${index + 1}`,
    });
    addMesh(bannerGroup, new THREE.ConeGeometry(0.09, 0.25, 6), materials.brass, {
      position: [-0.82, 4.6, 0], name: `BannerFinial${index + 1}`,
    });
    const geometry = new THREE.PlaneGeometry(1.45, 3.25, 10, 24);
    geometry.userData.base = geometry.attributes.position.array.slice();
    const banner = addMesh(bannerGroup, geometry, materials.banner, {
      position: [0, 2.45, 0.04],
      castShadow: true,
      receiveShadow: true,
      name: `AnimatedBannerCloth${index + 1}`,
    });
    group.add(bannerGroup);
    banners.push(banner);
  });
  scene.add(group);
  return banners;
}

function addAtmosphere(scene, materials) {
  const rng = seededRandom(6006);
  const count = 150;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const radius = 1.5 + rng() * 10;
    const angle = rng() * Math.PI * 2;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = 0.2 + rng() * 5;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    speeds[i] = 0.08 + rng() * 0.32;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, materials.flame);
  points.name = 'DriftingEmbers';
  points.frustumCulled = false;
  scene.add(points);

  const dustCount = 90;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustVelocity = new Float32Array(dustCount * 3);
  const dustLife = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i += 1) dustPositions[i * 3 + 1] = -100;
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMaterial = new THREE.PointsMaterial({
    color: 0x9a8270,
    size: 0.055,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  dust.name = 'FootfallDust';
  dust.frustumCulled = false;
  scene.add(dust);

  return {
    points,
    speeds,
    dust,
    dustPositions,
    dustVelocity,
    dustLife,
    dustCursor: 0,
    rng,
  };
}

function addLighting(scene) {
  const hemi = new THREE.HemisphereLight(0x7183a3, 0x1a0c0b, 0.75);
  hemi.name = 'ColdSkyFill';
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xd9d0c4, 2.5);
  key.name = 'MoonlitKey';
  key.position.set(5.5, 9, 6.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.bias = -0.00035;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  const redRim = new THREE.SpotLight(0xe83220, 95, 18, Math.PI / 4.5, 0.65, 1.5);
  redRim.name = 'DragonfireRim';
  redRim.position.set(-5, 4.4, -6.5);
  redRim.target.position.set(0, 1.3, 0);
  scene.add(redRim, redRim.target);

  const coolFill = new THREE.PointLight(0x6386ba, 14, 12, 1.9);
  coolFill.name = 'CoolArmorFill';
  coolFill.position.set(4.5, 2.7, 4.2);
  scene.add(coolFill);

  const hero = new THREE.SpotLight(0xffd9b5, 55, 12, Math.PI / 6, 0.8, 1.6);
  hero.name = 'HeroWarmSpot';
  hero.position.set(2.5, 6, 5);
  hero.target.position.set(0, 1.5, 0);
  scene.add(hero, hero.target);
  return { key, redRim, coolFill, hero };
}

export function createWorld(scene, materials, textures) {
  scene.background = new THREE.Color(0x070609);
  scene.fog = new THREE.FogExp2(0x09070a, 0.032);

  const ground = addGround(scene, materials, textures);
  addRuins(scene, materials);
  const braziers = addBraziers(scene, materials);
  const banners = addBanners(scene, materials);
  const atmosphere = addAtmosphere(scene, materials);
  const lights = addLighting(scene);

  function emitDust(position, strength = 1) {
    if (!position) return;
    const { rng, dustPositions, dustVelocity, dustLife } = atmosphere;
    const count = Math.max(2, Math.round(3 + strength * 4));
    for (let n = 0; n < count; n += 1) {
      const i = atmosphere.dustCursor;
      atmosphere.dustCursor = (atmosphere.dustCursor + 1) % atmosphere.dustLife.length;
      dustPositions[i * 3] = position.x + (rng() - 0.5) * 0.35;
      dustPositions[i * 3 + 1] = 0.05 + rng() * 0.06;
      dustPositions[i * 3 + 2] = position.z + (rng() - 0.5) * 0.35;
      dustVelocity[i * 3] = (rng() - 0.5) * 0.35;
      dustVelocity[i * 3 + 1] = 0.08 + rng() * 0.18;
      dustVelocity[i * 3 + 2] = (rng() - 0.5) * 0.35;
      dustLife[i] = 0.7 + rng() * 0.6;
    }
  }

  function update(dt, time, options = {}) {
    const { motion = 0, position = null, footfall = 0 } = options;

    ground.floorSigil.material.opacity = 0.11 + Math.sin(time * 0.7) * 0.025 + motion * 0.025;
    ground.rings[1].material.opacity = 0.48 + Math.sin(time * 1.3) * 0.16;

    braziers.forEach((brazier, index) => {
      const flicker = 0.83 + 0.14 * Math.sin(time * 8.2 + brazier.phase)
        + 0.08 * Math.sin(time * 17.7 + index * 3.1);
      brazier.light.intensity = brazier.baseIntensity * flicker;
      brazier.flames.children.forEach((flame, childIndex) => {
        flame.scale.set(
          0.9 + 0.12 * Math.sin(time * 6 + childIndex + index),
          0.85 + 0.22 * Math.sin(time * 7.3 + childIndex * 1.7 + brazier.phase),
          0.9 + 0.12 * Math.cos(time * 5.4 + childIndex),
        );
        flame.rotation.y = time * 0.55 + childIndex;
        flame.material.opacity = 0.32 + flicker * 0.16;
      });
    });

    banners.forEach((banner, bannerIndex) => {
      const geometry = banner.geometry;
      const positions = geometry.attributes.position.array;
      const base = geometry.userData.base;
      for (let i = 0; i < positions.length; i += 3) {
        const x = base[i];
        const y = base[i + 1];
        const u = x / 1.45 + 0.5;
        const v = y / 3.25 + 0.5;
        positions[i + 2] = base[i + 2]
          + Math.sin(time * 1.25 + v * 5.2 + bannerIndex) * 0.075 * u
          + Math.sin(time * 2.1 + u * 7) * 0.025 * u;
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();
    });

    const emberPositions = atmosphere.points.geometry.attributes.position.array;
    for (let i = 0; i < atmosphere.speeds.length; i += 1) {
      emberPositions[i * 3 + 1] += dt * atmosphere.speeds[i];
      emberPositions[i * 3] += Math.sin(time * 0.3 + i) * dt * 0.018;
      if (emberPositions[i * 3 + 1] > 5.5) {
        emberPositions[i * 3 + 1] = 0.15;
        const angle = atmosphere.rng() * Math.PI * 2;
        const radius = 1.5 + atmosphere.rng() * 10;
        emberPositions[i * 3] = Math.cos(angle) * radius;
        emberPositions[i * 3 + 2] = Math.sin(angle) * radius;
      }
    }
    atmosphere.points.geometry.attributes.position.needsUpdate = true;

    if (footfall > 0.62 && motion > 0.18) emitDust(position, motion);
    const { dustPositions, dustVelocity, dustLife } = atmosphere;
    for (let i = 0; i < dustLife.length; i += 1) {
      if (dustLife[i] <= 0) continue;
      dustLife[i] -= dt;
      dustPositions[i * 3] += dustVelocity[i * 3] * dt;
      dustPositions[i * 3 + 1] += dustVelocity[i * 3 + 1] * dt;
      dustPositions[i * 3 + 2] += dustVelocity[i * 3 + 2] * dt;
      dustVelocity[i * 3 + 1] *= 0.985;
      if (dustLife[i] <= 0) dustPositions[i * 3 + 1] = -100;
    }
    atmosphere.dust.geometry.attributes.position.needsUpdate = true;

    lights.redRim.intensity = 90 + Math.sin(time * 1.6) * 8;
  }

  return { update, emitDust, ground, braziers, banners, atmosphere, lights };
}
