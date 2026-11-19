import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import './style.css';
import { createMaterials } from './scene/materials.js';
import { createProceduralTextures } from './scene/textures.js';
import { createDragonKnight } from './scene/character/index.js';
import { createWorld } from './scene/world.js';
import { CharacterAnimator, DEFAULT_STATE } from './scene/animation.js';
import { createExportAnimations } from './scene/export.js';

const canvas = document.getElementById('scene');
const loading = document.getElementById('loading');
const fpsLabel = document.getElementById('fps');
const modeReadout = document.getElementById('mode-readout');
const toast = document.getElementById('toast');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
const environment = pmrem.fromScene(new RoomEnvironment(), 0.035);
scene.environment = environment.texture;

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.08, 90);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 2.4;
controls.maxDistance = 17;
controls.minPolarAngle = 0.18;
controls.maxPolarAngle = Math.PI / 2.04;
controls.enablePan = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.28;

const composer = new EffectComposer(renderer);
composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.30,
  0.72,
  0.84,
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const textures = createProceduralTextures(renderer);
const materials = createMaterials(textures);
const { root, rig } = createDragonKnight(materials);
scene.add(root);
const world = createWorld(scene, materials, textures);

const state = { ...DEFAULT_STATE };
const animator = new CharacterAnimator(rig, state);
animator.reset();

const referenceImages = [
  { src: '/references/01-dragon-helm-profile.jpg', label: 'Helmet profile' },
  { src: '/references/02-silver-hair-portrait.jpg', label: 'Silver hair' },
  { src: '/references/03-full-armor-concept.jpg', label: 'Full armor' },
  { src: '/references/04-winged-helm-front.jpg', label: 'Winged helm' },
  { src: '/references/05-helmet-detail.jpg', label: 'Dragon visor' },
  { src: '/references/06-cloak-sigil.jpg', label: 'Cloak sigil' },
  { src: '/references/07-shield-front.jpg', label: 'Shield & plume' },
  { src: '/references/08-scale-armor.jpg', label: 'Scale mail' },
];

let cameraTargetHeight = 1.35;
let cameraTween = null;
let toastTimer = 0;
let elapsed = 0;
let fpsFrames = 0;
let fpsAccumulator = 0;
let sprintReturnMode = null;
const pressedKeys = new Set();
const forwardVector = new THREE.Vector3();
const rightVector = new THREE.Vector3();
const moveVector = new THREE.Vector3();
const desiredTarget = new THREE.Vector3();
const followDelta = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 1, 0);

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function setMode(mode) {
  animator.setMode(mode);
  document.querySelectorAll('#motion-modes button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.mode === mode);
  });
  modeReadout.textContent = mode.toUpperCase();
}

const TOGGLE_STATE_KEYS = {
  patrol: 'autoPatrol',
  cinematic: 'cinematic',
  cape: 'cape',
  helmet: 'helmet',
  shield: 'shield',
  sword: 'sword',
};

function setToggle(key, value) {
  const stateKey = TOGGLE_STATE_KEYS[key] || key;
  state[stateKey] = Boolean(value);
  if (key === 'patrol' && value) {
    state.patrolAngle = Math.atan2(root.position.z, root.position.x);
  }
  if (key === 'cinematic') controls.autoRotate = Boolean(value);
  document.querySelectorAll(`[data-toggle="${key}"]`).forEach((button) => {
    button.classList.toggle('is-active', Boolean(value));
    button.setAttribute('aria-pressed', String(Boolean(value)));
  });
}

function syncSlider(id, stateKey, formatter) {
  const input = document.getElementById(id);
  const output = document.getElementById(`${id}-value`);
  if (!input || !output) return;
  input.value = String(state[stateKey]);
  output.textContent = formatter(state[stateKey]);
}

function setCameraPreset(name, immediate = false) {
  const presets = {
    hero: { offset: [4.4, 2.9, 6.7], targetY: 1.35, fov: 38 },
    portrait: { offset: [1.55, 1.95, 3.9], targetY: 1.92, fov: 31 },
    wide: { offset: [8.2, 5.8, 11.2], targetY: 1.1, fov: 45 },
  };
  const preset = presets[name] || presets.hero;
  cameraTargetHeight = preset.targetY;
  const target = root.position.clone().add(new THREE.Vector3(0, preset.targetY, 0));
  const position = root.position.clone().add(new THREE.Vector3(...preset.offset));

  if (immediate) {
    camera.position.copy(position);
    controls.target.copy(target);
    camera.fov = preset.fov;
    camera.updateProjectionMatrix();
    controls.update();
    return;
  }

  cameraTween = {
    elapsed: 0,
    duration: 0.8,
    fromPosition: camera.position.clone(),
    toPosition: position,
    fromTarget: controls.target.clone(),
    toTarget: target,
    fromFov: camera.fov,
    toFov: preset.fov,
  };
  showToast(`${name[0].toUpperCase()}${name.slice(1)} camera`);
}

function updateCameraTween(dt) {
  if (!cameraTween) return;
  cameraTween.elapsed += dt;
  const t = Math.min(1, cameraTween.elapsed / cameraTween.duration);
  const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  camera.position.lerpVectors(cameraTween.fromPosition, cameraTween.toPosition, eased);
  controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, eased);
  camera.fov = THREE.MathUtils.lerp(cameraTween.fromFov, cameraTween.toFov, eased);
  camera.updateProjectionMatrix();
  if (t >= 1) cameraTween = null;
}

function updateCameraFollow(dt) {
  if (cameraTween) return;
  desiredTarget.set(root.position.x, root.position.y + cameraTargetHeight, root.position.z);
  followDelta.copy(desiredTarget).sub(controls.target).multiplyScalar(1 - Math.exp(-dt * 4.2));
  controls.target.add(followDelta);
  camera.position.add(followDelta);
}

function setupReferences() {
  const rail = document.getElementById('reference-rail');
  const lightbox = document.getElementById('lightbox');
  const lightboxImage = document.getElementById('lightbox-image');
  const lightboxCaption = document.getElementById('lightbox-caption');

  referenceImages.forEach((reference, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'reference-card';
    button.setAttribute('aria-label', `Open reference ${index + 1}: ${reference.label}`);
    const image = document.createElement('img');
    image.src = reference.src;
    image.alt = reference.label;
    image.loading = 'lazy';
    const label = document.createElement('span');
    label.textContent = `${String(index + 1).padStart(2, '0')} · ${reference.label}`;
    button.append(image, label);
    button.addEventListener('click', () => {
      lightboxImage.src = reference.src;
      lightboxImage.alt = reference.label;
      lightboxCaption.textContent = `${String(index + 1).padStart(2, '0')} / ${reference.label}`;
      lightbox.hidden = false;
    });
    rail.appendChild(button);
  });

  const close = () => { lightbox.hidden = true; };
  document.getElementById('lightbox-close').addEventListener('click', close);
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) close();
  });
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Escape' && !lightbox.hidden) close();
  });

  const panel = document.querySelector('.reference-panel');
  const toggle = document.getElementById('toggle-references');
  toggle.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('is-collapsed');
    toggle.textContent = collapsed ? 'Show' : 'Hide';
    toggle.setAttribute('aria-expanded', String(!collapsed));
  });
}

function setupControls() {
  document.querySelectorAll('#motion-modes button').forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.mode));
  });

  const sliders = [
    { id: 'speed', key: 'speed', format: (value) => `${value.toFixed(2)}×` },
    { id: 'armor-flex', key: 'armorFlex', format: (value) => `${Math.round(value * 100)}%` },
    { id: 'wind', key: 'wind', format: (value) => `${Math.round(value * 100)}%` },
  ];
  sliders.forEach(({ id, key, format }) => {
    const input = document.getElementById(id);
    const output = document.getElementById(`${id}-value`);
    const apply = () => {
      state[key] = Number(input.value);
      output.textContent = format(state[key]);
    };
    input.addEventListener('input', apply);
    apply();
  });

  document.querySelectorAll('[data-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.toggle;
      const stateKey = TOGGLE_STATE_KEYS[key] || key;
      setToggle(key, !state[stateKey]);
    });
  });

  document.querySelectorAll('[data-camera]').forEach((button) => {
    button.addEventListener('click', () => setCameraPreset(button.dataset.camera));
  });

  document.getElementById('export-glb').addEventListener('click', exportCharacter);
  document.getElementById('reset-view').addEventListener('click', resetStudio);
}

function resetStudio() {
  Object.assign(state, DEFAULT_STATE);
  pressedKeys.clear();
  sprintReturnMode = null;
  animator.reset();
  setMode('walk');
  setToggle('patrol', true);
  setToggle('cinematic', true);
  ['cape', 'helmet', 'shield', 'sword'].forEach((key) => setToggle(key, true));
  syncSlider('speed', 'speed', (value) => `${value.toFixed(2)}×`);
  syncSlider('armor-flex', 'armorFlex', (value) => `${Math.round(value * 100)}%`);
  syncSlider('wind', 'wind', (value) => `${Math.round(value * 100)}%`);
  setCameraPreset('hero', true);
  showToast('Studio reset');
}

async function exportCharacter() {
  const button = document.getElementById('export-glb');
  button.disabled = true;
  showToast('Preparing named rig and animation clips…');
  try {
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const exporter = new GLTFExporter();
    const { root: exportRoot } = createDragonKnight(materials);
    exportRoot.name = 'DragonKnight';
    exportRoot.position.set(0, 0, 0);
    exportRoot.rotation.set(0, 0, 0);
    exportRoot.traverse((object) => { object.visible = true; });

    const arrayBuffer = await new Promise((resolve, reject) => {
      exporter.parse(
        exportRoot,
        resolve,
        reject,
        {
          binary: true,
          onlyVisible: true,
          trs: true,
          animations: createExportAnimations(),
          includeCustomExtensions: true,
        },
      );
    });

    const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dragon-knight.glb';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('dragon-knight.glb exported');
  } catch (error) {
    console.error('GLB export failed', error);
    showToast('Export failed — see browser console');
  } finally {
    button.disabled = false;
  }
}

function updateManualMovement(dt) {
  const steering = ['KeyW', 'KeyA', 'KeyS', 'KeyD'].some((code) => pressedKeys.has(code));
  if (!steering) {
    state.manualActive = false;
    return;
  }
  camera.getWorldDirection(forwardVector);
  forwardVector.y = 0;
  forwardVector.normalize();
  rightVector.crossVectors(forwardVector, worldUp).normalize();
  moveVector.set(0, 0, 0);
  if (pressedKeys.has('KeyW')) moveVector.add(forwardVector);
  if (pressedKeys.has('KeyS')) moveVector.sub(forwardVector);
  if (pressedKeys.has('KeyD')) moveVector.add(rightVector);
  if (pressedKeys.has('KeyA')) moveVector.sub(rightVector);
  if (moveVector.lengthSq() === 0) {
    state.manualActive = false;
    return;
  }

  state.manualActive = true;
  if (state.autoPatrol) setToggle('patrol', false);
  if (state.mode === 'idle') setMode('walk');
  moveVector.normalize();
  const movementSpeed = (state.mode === 'run' ? 3.2 : 1.55) * state.speed;
  root.position.addScaledVector(moveVector, movementSpeed * dt);
  const horizontal = Math.hypot(root.position.x, root.position.z);
  if (horizontal > 8.8) {
    root.position.x *= 8.8 / horizontal;
    root.position.z *= 8.8 / horizontal;
  }
  const targetYaw = Math.atan2(moveVector.x, moveVector.z);
  const difference = Math.atan2(
    Math.sin(targetYaw - root.rotation.y),
    Math.cos(targetYaw - root.rotation.y),
  );
  root.rotation.y += difference * (1 - Math.exp(-dt * 10));
}

function setupKeyboard() {
  const movementCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);
  const toggleByCode = {
    KeyC: 'cape',
    KeyH: 'helmet',
    KeyB: 'shield',
    KeyV: 'sword',
  };

  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement) return;
    if (movementCodes.has(event.code)) {
      pressedKeys.add(event.code);
      if (state.autoPatrol) setToggle('patrol', false);
      event.preventDefault();
      return;
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      if (state.mode !== 'run') {
        sprintReturnMode = state.mode;
        setMode('run');
      }
      return;
    }
    if (event.code === 'Space') {
      state.paused = !state.paused;
      showToast(state.paused ? 'Animation paused' : 'Animation resumed');
      event.preventDefault();
      return;
    }
    if (event.code === 'Digit1') setMode('idle');
    if (event.code === 'Digit2') setMode('walk');
    if (event.code === 'Digit3') setMode('run');
    if (toggleByCode[event.code]) {
      const key = toggleByCode[event.code];
      setToggle(key, !state[TOGGLE_STATE_KEYS[key]]);
    }
    if (event.code === 'KeyR') setCameraPreset('hero');
  });

  window.addEventListener('keyup', (event) => {
    pressedKeys.delete(event.code);
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      if (sprintReturnMode) {
        setMode(sprintReturnMode);
        sprintReturnMode = null;
      }
    }
  });

  window.addEventListener('blur', () => {
    pressedKeys.clear();
    sprintReturnMode = null;
  });
}

function updateFps(dt) {
  fpsFrames += 1;
  fpsAccumulator += dt;
  if (fpsAccumulator >= 0.6) {
    const fps = Math.round(fpsFrames / fpsAccumulator);
    fpsLabel.textContent = `${fps} FPS`;
    fpsFrames = 0;
    fpsAccumulator = 0;
  }
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  composer.setSize(width, height);
  bloomPass.resolution.set(width, height);
}

setupReferences();
setupControls();
setupKeyboard();
setToggle('cinematic', true);
setMode('walk');
setCameraPreset('hero', true);
window.addEventListener('resize', onResize);

let lastFrameTime = performance.now();
function animate(now = performance.now()) {
  requestAnimationFrame(animate);
  const rawDt = Math.min((now - lastFrameTime) / 1000, 0.08);
  lastFrameTime = now;
  const dt = state.paused ? 0 : rawDt;
  if (!state.paused) elapsed += dt;

  if (!state.paused) {
    updateManualMovement(dt);
    const metrics = animator.update(dt, elapsed);
    world.update(dt, elapsed, {
      motion: metrics.motion,
      position: root.position,
      footfall: metrics.footfall,
    });
  }

  updateCameraTween(rawDt);
  updateCameraFollow(rawDt);
  controls.autoRotate = state.cinematic && !state.paused && !state.manualActive;
  controls.update(rawDt);
  composer.render();
  updateFps(rawDt);
}
animate();

window.setTimeout(() => loading.classList.add('is-hidden'), 550);
window.__DRAGON_KNIGHT__ = {
  THREE,
  scene,
  camera,
  renderer,
  controls,
  root,
  rig,
  state,
  animator,
  world,
  setMode,
  setToggle,
  setCameraPreset,
  exportCharacter,
};
