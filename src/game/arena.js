import * as THREE from 'three';
import { seededRandom } from '../scene/textures.js';

export const ARENA_RADIUS = 9.65;

export const SIGIL_POSITIONS = [
  new THREE.Vector3(-5.6, 0, -2.8),
  new THREE.Vector3(5.6, 0, -2.8),
  new THREE.Vector3(-7.1, 0, 1.9),
  new THREE.Vector3(7.1, 0, 1.9),
  new THREE.Vector3(-3.3, 0, 6.6),
  new THREE.Vector3(3.3, 0, 6.6),
];

const COVER_POSITIONS = [
  new THREE.Vector3(-2.35, 0, -6.5),
  new THREE.Vector3(2.35, 0, -6.5),
  new THREE.Vector3(-8.15, 0, -0.7),
  new THREE.Vector3(8.15, 0, -0.7),
];

function makeRadialTexture(inner = 'rgba(255,255,255,.95)', middle = 'rgba(255,255,255,.25)') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.32, middle);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSky(scene) {
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      varying vec3 vDirection;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      void main() {
        vec3 d = normalize(vDirection);
        float horizon = smoothstep(-0.12, 0.55, d.y);
        vec3 low = vec3(0.22, 0.035, 0.035);
        vec3 mid = vec3(0.055, 0.045, 0.075);
        vec3 high = vec3(0.012, 0.018, 0.04);
        vec3 col = mix(low, mid, horizon);
        col = mix(col, high, smoothstep(0.15, 0.92, d.y));
        float haze = exp(-abs(d.y + 0.02) * 11.0);
        col += vec3(0.24, 0.055, 0.025) * haze * (0.55 + 0.12 * sin(uTime * 0.25));
        vec2 starCell = floor(d.xz * 180.0 + d.y * 80.0);
        float star = step(0.9975, hash(starCell)) * smoothstep(0.12, 0.7, d.y);
        float twinkle = 0.65 + 0.35 * sin(uTime * 1.8 + hash(starCell + 7.0) * 20.0);
        col += star * twinkle * vec3(0.7, 0.78, 1.0);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 40, 24), material);
  sky.name = 'EmberfallSky';
  sky.renderOrder = -20;
  sky.frustumCulled = false;
  scene.add(sky);
  return { sky, material };
}

function makeMoon(scene, glowTexture) {
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(1.45, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xc7c8d1, fog: false }),
  );
  moon.position.set(-24, 22, -48);
  moon.name = 'PaleMoon';
  scene.add(moon);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0x8ea0d0,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  }));
  halo.position.copy(moon.position);
  halo.scale.set(11, 11, 1);
  halo.name = 'MoonHalo';
  scene.add(halo);
}

function makePortal(scene, materials, glowTexture) {
  const group = new THREE.Group();
  group.name = 'CinderGate';
  group.position.set(0, 0, -9.25);

  const stone = materials.stoneDark;
  const brass = materials.darkBrass;
  const pillarGeometry = new THREE.CylinderGeometry(0.44, 0.58, 4.35, 7);
  [-1.85, 1.85].forEach((x, index) => {
    const pillar = new THREE.Mesh(pillarGeometry, stone);
    pillar.position.set(x, 2.15, 0);
    pillar.rotation.y = index * 0.2;
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    pillar.name = `GatePillar${index + 1}`;
    group.add(pillar);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.5, 0.3, 7), brass);
    cap.position.set(x, 4.42, 0);
    cap.castShadow = true;
    cap.name = `GateCap${index + 1}`;
    group.add(cap);
  });

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.45, 0.48, 0.92), stone);
  lintel.position.set(0, 4.62, 0);
  lintel.castShadow = true;
  lintel.receiveShadow = true;
  lintel.name = 'GateLintel';
  group.add(lintel);

  const crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), materials.glowTrim);
  crest.position.set(0, 4.63, 0.5);
  crest.scale.set(1.2, 0.85, 0.28);
  crest.name = 'GateDragonCrest';
  group.add(crest);

  const portalMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      varying vec2 vUv;
      float noise(vec2 p) {
        return sin(p.x * 9.0 + uTime * 1.7) * sin(p.y * 12.0 - uTime * 2.1)
          + sin((p.x + p.y) * 16.0 + uTime * 0.9) * 0.5;
      }
      void main() {
        vec2 p = vUv - 0.5;
        float edge = smoothstep(0.52, 0.38, abs(p.x)) * smoothstep(0.5, 0.34, abs(p.y));
        float flow = noise(vUv + vec2(0.0, uTime * 0.06));
        float veins = smoothstep(0.45, 1.2, flow);
        float pulse = 0.72 + 0.28 * sin(uTime * 1.4);
        vec3 color = mix(vec3(0.32, 0.015, 0.01), vec3(1.0, 0.23, 0.045), veins);
        color += vec3(1.0, 0.62, 0.2) * veins * 0.35;
        float alpha = edge * (0.35 + veins * 0.45) * pulse;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.15, 1, 1), portalMaterial);
  portal.position.set(0, 2.3, 0.06);
  portal.name = 'AnimatedCinderRift';
  portal.renderOrder = 2;
  group.add(portal);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xff3a18,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  glow.position.set(0, 2.2, -0.1);
  glow.scale.set(6.5, 7.5, 1);
  glow.name = 'GateGlow';
  group.add(glow);

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xff4b22,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.025, 8, 72), ringMaterial);
  ring.position.set(0, 2.45, 0.18);
  ring.name = 'GateRunicRing';
  group.add(ring);

  const light = new THREE.PointLight(0xff3a18, 18, 12, 1.8);
  light.position.set(0, 2.4, 0.8);
  group.add(light);

  scene.add(group);
  return { group, portal, portalMaterial, ring, ringMaterial, glow, light };
}

function makePylons(scene, materials, textures, glowTexture) {
  const pylons = [];
  const sigilTexture = textures.sigil || null;
  SIGIL_POSITIONS.forEach((position, index) => {
    const group = new THREE.Group();
    group.name = `DragonfirePylon${index + 1}`;
    group.position.copy(position);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, 0.22, 8), materials.stoneWarm);
    base.position.y = 0.11;
    base.castShadow = true;
    base.receiveShadow = true;
    base.name = `PylonBase${index + 1}`;
    group.add(base);

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.46, 0.62, 8), materials.stoneDark);
    pedestal.position.y = 0.52;
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    pedestal.name = `PylonPedestal${index + 1}`;
    group.add(pedestal);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.025, 8, 32), materials.darkBrass);
    rim.position.y = 0.84;
    rim.rotation.x = Math.PI / 2;
    rim.name = `PylonRim${index + 1}`;
    group.add(rim);

    const runeMaterial = new THREE.MeshBasicMaterial({
      color: 0x7b2018,
      map: sigilTexture,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), runeMaterial);
    rune.position.y = 0.035;
    rune.rotation.x = -Math.PI / 2;
    rune.name = `PylonRune${index + 1}`;
    group.add(rune);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xff4c20,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    halo.position.y = 1.08;
    halo.scale.set(2.4, 2.4, 1);
    halo.name = `PylonHalo${index + 1}`;
    group.add(halo);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xb02a1b,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.015, 6, 40), ringMaterial);
    ring.position.y = 0.9;
    ring.rotation.x = Math.PI / 2;
    ring.name = `PylonRing${index + 1}`;
    group.add(ring);

    scene.add(group);
    pylons.push({ group, position: position.clone(), rune, halo, ring, charged: false, index });
  });
  return pylons;
}

function makeRubble(scene, materials, obstacles) {
  const rng = seededRandom(9191);
  const rockGeometry = new THREE.DodecahedronGeometry(0.22, 0);
  const rock = new THREE.InstancedMesh(rockGeometry, materials.stoneDark, 54);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < rock.count; i += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = 5.4 + rng() * 4.2;
    dummy.position.set(Math.cos(angle) * radius, 0.08 + rng() * 0.05, Math.sin(angle) * radius);
    dummy.rotation.set(rng() * 0.6, rng() * Math.PI, rng() * 0.5);
    const scale = 0.35 + rng() * 1.1;
    dummy.scale.set(scale, scale * 0.55, scale);
    dummy.updateMatrix();
    rock.setMatrixAt(i, dummy.matrix);
  }
  rock.name = 'ScatteredRubble';
  rock.castShadow = true;
  rock.receiveShadow = true;
  rock.instanceMatrix.needsUpdate = true;
  scene.add(rock);

  COVER_POSITIONS.forEach((position, index) => {
    const cluster = new THREE.Group();
    cluster.name = `FallenStoneCover${index + 1}`;
    cluster.position.copy(position);
    for (let i = 0; i < 5; i += 1) {
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(0.72 + rng() * 0.55, 0.32 + rng() * 0.4, 0.58 + rng() * 0.5),
        i % 2 ? materials.stone : materials.stoneWarm,
      );
      block.position.set((rng() - 0.5) * 1.2, 0.22 + rng() * 0.12, (rng() - 0.5) * 1.2);
      block.rotation.set((rng() - 0.5) * 0.3, rng() * Math.PI, (rng() - 0.5) * 0.35);
      block.castShadow = true;
      block.receiveShadow = true;
      block.name = `CoverBlock${index + 1}-${i + 1}`;
      cluster.add(block);
    }
    scene.add(cluster);
    obstacles.push({ x: position.x, z: position.z, radius: 0.92, type: 'cover' });
  });
  return rock;
}

function makeMist(scene, glowTexture) {
  const mist = [];
  const material = new THREE.MeshBasicMaterial({
    map: glowTexture,
    color: 0x6c6470,
    transparent: true,
    opacity: 0.07,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  });
  const geometry = new THREE.PlaneGeometry(1, 1);
  const rng = seededRandom(3391);
  for (let i = 0; i < 11; i += 1) {
    const mesh = new THREE.Mesh(geometry, material.clone());
    const angle = rng() * Math.PI * 2;
    const radius = 2 + rng() * 8.5;
    mesh.position.set(Math.cos(angle) * radius, 0.045, Math.sin(angle) * radius);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rng() * Math.PI;
    const width = 4.5 + rng() * 6.5;
    mesh.scale.set(width, width * (0.55 + rng() * 0.5), 1);
    mesh.material.opacity = 0.035 + rng() * 0.05;
    mesh.renderOrder = 1;
    mesh.name = `DriftingMist${i + 1}`;
    scene.add(mesh);
    mist.push({ mesh, phase: rng() * Math.PI * 2, baseOpacity: mesh.material.opacity, drift: 0.08 + rng() * 0.12 });
  }
  return mist;
}

function makeBoundary(scene, materials) {
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x9e2318,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ARENA_RADIUS, 0.028, 8, 160), ringMaterial);
  ring.position.y = 0.035;
  ring.rotation.x = Math.PI / 2;
  ring.name = 'CourtyardWardRing';
  scene.add(ring);

  const obeliskGeometry = new THREE.ConeGeometry(0.25, 2.6, 4);
  const obelisks = new THREE.InstancedMesh(obeliskGeometry, materials.stoneDark, 12);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2 + Math.PI / 12;
    dummy.position.set(Math.cos(angle) * 12.2, 1.1, Math.sin(angle) * 12.2);
    dummy.rotation.set(0, -angle, 0.05 * Math.sin(i));
    dummy.scale.set(1, 0.8 + (i % 3) * 0.2, 1);
    dummy.updateMatrix();
    obelisks.setMatrixAt(i, dummy.matrix);
  }
  obelisks.name = 'DistantObelisks';
  obelisks.castShadow = false;
  obelisks.instanceMatrix.needsUpdate = true;
  scene.add(obelisks);
  return { ring, ringMaterial, obelisks };
}

/** Approximate colliders for the nine pillars created by the original world module. */
function worldPillarColliders() {
  const rng = seededRandom(8801);
  for (let i = 0; i < 38 * 5; i += 1) rng();
  const result = [];
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2 + 0.18;
    const radius = 6.6 + (rng() - 0.5) * 0.5;
    rng(); // height
    rng(); // tilt
    result.push({ x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, radius: 0.42, type: 'pillar' });
  }
  return result;
}

export function createArena(scene, materials, textures) {
  const group = new THREE.Group();
  group.name = 'EmberfallArena';
  scene.add(group);

  const glowTexture = makeRadialTexture();
  const { material: skyMaterial } = makeSky(scene);
  makeMoon(scene, glowTexture);
  const skyExtras = scene.children.filter((child) => ['EmberfallSky', 'PaleMoon', 'MoonHalo'].includes(child.name));
  skyExtras.forEach((child) => group.add(child));

  const portal = makePortal(group, materials, glowTexture);
  const pylons = makePylons(group, materials, textures, glowTexture);
  const obstacles = worldPillarColliders();
  SIGIL_POSITIONS.forEach((position) => obstacles.push({ x: position.x, z: position.z, radius: 0.62, type: 'pylon' }));
  [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4].forEach((angle) => {
    obstacles.push({ x: Math.cos(angle) * 4.75, z: Math.sin(angle) * 4.75, radius: 0.38, type: 'brazier' });
  });
  makeRubble(group, materials, obstacles);
  const mist = makeMist(group, glowTexture);
  const boundary = makeBoundary(group, materials);

  function setPylonCharged(index, charged) {
    const pylon = pylons[index];
    if (!pylon) return;
    pylon.charged = charged;
    pylon.rune.material.color.set(charged ? 0xffb247 : 0x7b2018);
    pylon.rune.material.opacity = charged ? 0.86 : 0.4;
    pylon.halo.material.color.set(charged ? 0xffc36a : 0xff4c20);
    pylon.ring.material.color.set(charged ? 0xffc36a : 0xb02a1b);
  }

  function reset() {
    pylons.forEach((_, index) => setPylonCharged(index, false));
  }

  function update(dt, time) {
    skyMaterial.uniforms.uTime.value = time;
    portal.portalMaterial.uniforms.uTime.value = time;
    portal.ring.rotation.z = time * 0.18;
    portal.ringMaterial.opacity = 0.38 + Math.sin(time * 1.4) * 0.12;
    portal.glow.material.opacity = 0.42 + Math.sin(time * 2.1) * 0.07;
    portal.light.intensity = 17 + Math.sin(time * 3.1) * 3;

    pylons.forEach((pylon, index) => {
      const pulse = 0.85 + Math.sin(time * 2.2 + index * 0.9) * 0.15;
      pylon.ring.rotation.z = time * (pylon.charged ? 0.6 : 0.18) + index;
      pylon.ring.position.y = 0.9 + Math.sin(time * 1.6 + index) * 0.04;
      pylon.ring.material.opacity = (pylon.charged ? 0.72 : 0.28) * pulse;
      pylon.halo.material.opacity = (pylon.charged ? 0.55 : 0.24) * pulse;
      pylon.rune.rotation.z = time * 0.055 * (index % 2 ? 1 : -1);
    });

    mist.forEach((layer, index) => {
      layer.mesh.position.x += Math.sin(time * 0.22 + layer.phase) * layer.drift * dt;
      layer.mesh.position.z += Math.cos(time * 0.19 + layer.phase) * layer.drift * dt;
      layer.mesh.material.opacity = layer.baseOpacity * (0.75 + Math.sin(time * 0.6 + index) * 0.25);
    });

    boundary.ringMaterial.opacity = 0.22 + Math.sin(time * 0.8) * 0.08;
    boundary.ring.rotation.z = time * 0.012;
  }

  function dispose() {
    scene.remove(group);
    group.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        const list = Array.isArray(object.material) ? object.material : [object.material];
        list.forEach((material) => material.dispose());
      }
    });
    glowTexture.dispose();
  }

  return {
    group,
    pylons,
    obstacles,
    portal,
    boundary,
    setPylonCharged,
    reset,
    update,
    dispose,
  };
}
