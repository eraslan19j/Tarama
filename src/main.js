import * as THREE from 'three';
import './style.css';
import { createMaterials } from './scene/materials.js';
import { createProceduralTextures } from './scene/textures.js';
import { createDragonKnight } from './scene/character/index.js';
import { createWorld } from './scene/world.js';
import { DEFAULT_STATE } from './scene/animation.js';
import { createExportAnimations } from './scene/export.js';
import { createGameRenderer } from './game/renderer.js';
import { createHUD } from './game/hud.js';
import { EmberfallGame } from './game/game.js';

const canvas = document.getElementById('scene');
const loading = document.getElementById('loading');
let game = null;

function reportStartupError(error) {
  console.error('Emberfall failed to start', error);
  if (loading) {
    const heading = loading.querySelector('h1');
    const copy = loading.querySelector('p');
    if (heading) heading.textContent = 'Unable to start Emberfall';
    if (copy) copy.textContent = 'This game needs WebGL. Try a current Chrome, Firefox, Edge or Safari browser with hardware acceleration enabled.';
    loading.classList.remove('is-hidden');
  }
  window.__EMBERFALL_ERROR__ = error instanceof Error ? error.message : String(error);
}

try {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 150);

  const renderSystem = createGameRenderer({
    canvas,
    scene,
    camera,
    initialQuality: 'high',
    onResize: (ratio, width, height) => game?.handleResize(ratio, width, height),
  });

  const rendererHint = renderSystem.performanceHint();
  const coarsePointer = Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const softwareRenderer = /swiftshader|llvmpipe|software|softpipe|mesa offscreen/i.test(rendererHint);
  const startingQuality = softwareRenderer
    ? (coarsePointer ? 'low' : 'medium')
    : (coarsePointer || window.innerWidth < 760 ? 'medium' : 'high');
  renderSystem.setQuality(startingQuality);

  const textures = createProceduralTextures(renderSystem.renderer);
  const materials = createMaterials(textures);
  const { root, rig } = createDragonKnight(materials);
  scene.add(root);
  const world = createWorld(scene, materials, textures);

  const state = { ...DEFAULT_STATE };
  const hud = createHUD(camera);

  game = new EmberfallGame({
    canvas,
    scene,
    camera,
    renderSystem,
    materials,
    textures,
    world,
    root,
    rig,
    state,
    hud,
  });

  async function exportCharacter() {
    hud.toast('Preparing the Dragon Knight GLB…', 1600);
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
    hud.toast('dragon-knight.glb exported', 1700);
    return 'ok';
  }

  window.__EMBERFALL__ = {
    THREE,
    scene,
    camera,
    renderer: renderSystem.renderer,
    renderSystem,
    game,
    start: () => game.start(),
    pause: () => game.pause(),
    resume: () => game.resume(),
    restart: () => game.start(),
    toggleFullscreen: () => game.toggleFullscreen(),
    setQuality: (name) => {
      renderSystem.setQuality(name);
      hud.setQualityLabel(renderSystem.qualityLabel);
      return renderSystem.qualityName;
    },
    get phase() { return game.phase; },
    get state() { return game.getHUDState(); },
  };

  // Compatibility hook for the original model QA tooling.
  window.__DRAGON_KNIGHT__ = {
    THREE,
    scene,
    camera,
    renderer: renderSystem.renderer,
    root,
    rig,
    state,
    world,
    player: game.player,
    game,
    setMode: (mode) => {
      game.player.playerAnimator.animator.setMode(mode);
      return mode;
    },
    setToggle: (key, value) => {
      state[key] = Boolean(value);
      return state[key];
    },
    setCameraPreset: () => game.cameraController.reset(),
    exportCharacter,
  };
} catch (error) {
  reportStartupError(error);
}
