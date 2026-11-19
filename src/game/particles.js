import * as THREE from 'three';

const vertexShader = /* glsl */`
  attribute float aSize;
  attribute float aLife;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  uniform float uViewportHeight;
  varying float vLife;
  varying vec3 vColor;

  void main() {
    vLife = aLife;
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float perspective = uViewportHeight * 0.5 / max(0.15, -mvPosition.z);
    gl_PointSize = clamp(aSize * perspective * uPixelRatio, 1.0, 120.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */`
  varying float vLife;
  varying vec3 vColor;

  void main() {
    if (vLife <= 0.0) discard;
    vec2 uv = gl_PointCoord - 0.5;
    float radius = length(uv);
    if (radius > 0.5) discard;
    float falloff = smoothstep(0.5, 0.0, radius);
    float core = smoothstep(0.23, 0.0, radius);
    float alpha = falloff * (0.24 + 0.76 * vLife) + core * 0.45;
    gl_FragColor = vec4(vColor * (0.8 + core * 1.25), alpha * min(1.0, vLife * 1.5));
  }
`;

/** GPU point sprites with a CPU-updated ring buffer. Used for embers, sparks, dust and magic. */
export function createParticles(scene, maxParticles = 1800) {
  const count = maxParticles;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const life = new Float32Array(count);
  const velocity = new Float32Array(count * 3);
  const maxLife = new Float32Array(count);
  const gravity = new Float32Array(count);
  const drag = new Float32Array(count);

  for (let i = 0; i < count; i += 1) positions[i * 3 + 1] = -1000;

  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  const colorAttribute = new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage);
  const sizeAttribute = new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage);
  const lifeAttribute = new THREE.BufferAttribute(life, 1).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('aColor', colorAttribute);
  geometry.setAttribute('aSize', sizeAttribute);
  geometry.setAttribute('aLife', lifeAttribute);
  geometry.setDrawRange(0, count);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: 1 },
      uViewportHeight: { value: window.innerHeight || 800 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'GameplayParticles';
  points.frustumCulled = false;
  points.renderOrder = 4;
  scene.add(points);

  let cursor = 0;
  let alive = 0;
  const scratchColor = new THREE.Color();

  function setPixelRatio(pixelRatio, viewportHeight) {
    material.uniforms.uPixelRatio.value = pixelRatio;
    material.uniforms.uViewportHeight.value = viewportHeight;
  }

  function spawn(options = {}) {
    const i = cursor;
    cursor = (cursor + 1) % count;
    const p = options.position || { x: 0, y: 0, z: 0 };
    const v = options.velocity || { x: 0, y: 0, z: 0 };
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
    velocity[i * 3] = v.x;
    velocity[i * 3 + 1] = v.y;
    velocity[i * 3 + 2] = v.z;

    scratchColor.set(options.color ?? 0xff7a38);
    if (options.colorVariance) {
      const variance = options.colorVariance;
      scratchColor.offsetHSL(
        (Math.random() - 0.5) * variance,
        (Math.random() - 0.5) * variance * 0.4,
        (Math.random() - 0.5) * variance * 0.35,
      );
    }
    colors[i * 3] = scratchColor.r;
    colors[i * 3 + 1] = scratchColor.g;
    colors[i * 3 + 2] = scratchColor.b;
    sizes[i] = options.size ?? 0.08;
    const duration = Math.max(0.04, options.life ?? 0.8);
    maxLife[i] = duration;
    life[i] = 1;
    gravity[i] = options.gravity ?? -2.5;
    drag[i] = options.drag ?? 1.25;
    colorAttribute.needsUpdate = true;
    sizeAttribute.needsUpdate = true;
    lifeAttribute.needsUpdate = true;
    positionAttribute.needsUpdate = true;
  }

  function burst(options = {}) {
    const amount = Math.max(1, Math.round(options.count ?? 18));
    const position = options.position || new THREE.Vector3();
    const speed = options.speed ?? 2.4;
    const spread = options.spread ?? 1;
    const upward = options.upward ?? 0.5;
    const cone = options.direction || null;
    const coneSpread = options.coneSpread ?? 1;
    for (let n = 0; n < amount; n += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(1 - 2 * Math.random());
      let vx = Math.sin(phi) * Math.cos(theta);
      let vy = Math.cos(phi) * 0.7 + upward;
      let vz = Math.sin(phi) * Math.sin(theta);
      if (cone) {
        vx = cone.x * coneSpread + vx * (1 - coneSpread * 0.35);
        vy = cone.y * coneSpread + vy * (1 - coneSpread * 0.35) + upward * 0.45;
        vz = cone.z * coneSpread + vz * (1 - coneSpread * 0.35);
      }
      const variation = 0.55 + Math.random() * 0.9;
      spawn({
        position: {
          x: position.x + (Math.random() - 0.5) * (options.originJitter ?? 0),
          y: position.y + (Math.random() - 0.5) * (options.originJitter ?? 0),
          z: position.z + (Math.random() - 0.5) * (options.originJitter ?? 0),
        },
        velocity: { x: vx * speed * variation, y: vy * speed * variation, z: vz * speed * variation },
        color: options.color ?? 0xff6a2a,
        colorVariance: options.colorVariance ?? 0.08,
        size: (options.size ?? 0.09) * (0.55 + Math.random() * 0.9),
        life: (options.life ?? 0.75) * (0.65 + Math.random() * 0.7),
        gravity: options.gravity ?? -2.6,
        drag: options.drag ?? 1.3,
      });
    }
  }

  function update(dt) {
    const step = Math.min(dt, 0.05);
    let active = 0;
    for (let i = 0; i < count; i += 1) {
      if (life[i] <= 0) continue;
      const remaining = life[i] - step / maxLife[i];
      if (remaining <= 0) {
        life[i] = 0;
        positions[i * 3 + 1] = -1000;
        continue;
      }
      life[i] = remaining;
      active += 1;
      const damping = Math.max(0, 1 - drag[i] * step);
      velocity[i * 3] *= damping;
      velocity[i * 3 + 1] = velocity[i * 3 + 1] * damping + gravity[i] * step;
      velocity[i * 3 + 2] *= damping;
      positions[i * 3] += velocity[i * 3] * step;
      positions[i * 3 + 1] += velocity[i * 3 + 1] * step;
      positions[i * 3 + 2] += velocity[i * 3 + 2] * step;
    }
    alive = active;
    positionAttribute.needsUpdate = true;
    lifeAttribute.needsUpdate = true;
  }

  function dispose() {
    scene.remove(points);
    geometry.dispose();
    material.dispose();
  }

  return {
    points,
    spawn,
    burst,
    update,
    setPixelRatio,
    dispose,
    get alive() { return alive; },
  };
}
