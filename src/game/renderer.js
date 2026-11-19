import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

export const QUALITY_PRESETS = {
  high: {
    label: 'High', maxPixelRatio: 1.75, gtao: true, bloom: true, fxaa: true,
    shadows: true, shadowSize: 2048, bloomStrength: 0.56, bloomRadius: 0.62,
    bloomThreshold: 0.72, aoIntensity: 0.58,
  },
  medium: {
    label: 'Medium', maxPixelRatio: 1.35, gtao: false, bloom: true, fxaa: true,
    shadows: true, shadowSize: 1024, bloomStrength: 0.42, bloomRadius: 0.6,
    bloomThreshold: 0.78, aoIntensity: 0,
  },
  low: {
    label: 'Low', maxPixelRatio: 1, gtao: false, bloom: false, fxaa: true,
    shadows: true, shadowSize: 512, bloomStrength: 0, bloomRadius: 0.5,
    bloomThreshold: 1, aoIntensity: 0,
  },
};

function shouldExcludeFromAO(object) {
  if (object.userData.noAO || object.isSprite || object.isPoints || object.isLine || object.isLine2) return true;
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  return materials.some((material) => material && (
    material.transparent
    || material.depthWrite === false
    || material.blending === THREE.AdditiveBlending
    || material.isShaderMaterial
  ));
}

export function createGameRenderer({ canvas, scene, camera, initialQuality = 'high', onResize = null }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setClearColor(0x070609, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.035);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.92;
  pmrem.dispose();

  const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    depthBuffer: true,
    stencilBuffer: false,
    samples: renderer.capabilities.isWebGL2 === false ? 0 : 4,
  });
  const composer = new EffectComposer(renderer, renderTarget);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const gtaoPass = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
  gtaoPass.output = GTAOPass.OUTPUT.Default;
  gtaoPass.blendIntensity = 0.58;
  gtaoPass.updateGtaoMaterial({
    radius: 0.32,
    distanceExponent: 1.55,
    thickness: 0.9,
    distanceFallOff: 1.0,
    scale: 1.0,
    samples: 12,
    screenSpaceRadius: false,
  });
  gtaoPass.updatePdMaterial({
    lumaPhi: 10,
    depthPhi: 2,
    normalPhi: 3,
    radius: 7,
    radiusExponent: 2,
    rings: 2,
    samples: 12,
  });
  // Transparent effects and the sky must not contribute opaque normals/depth to AO.
  const originalOverrideVisibility = gtaoPass._overrideVisibility.bind(gtaoPass);
  gtaoPass._overrideVisibility = function patchedOverrideVisibility() {
    originalOverrideVisibility();
    const cache = this._visibilityCache;
    this.scene.traverse((object) => {
      if (object.visible && !cache.includes(object) && shouldExcludeFromAO(object)) {
        object.visible = false;
        cache.push(object);
      }
    });
  };
  composer.addPass(gtaoPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.56,
    0.62,
    0.72,
  );
  composer.addPass(bloomPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  const fxaaPass = new FXAAPass();
  composer.addPass(fxaaPass);

  let qualityName = QUALITY_PRESETS[initialQuality] ? initialQuality : 'high';
  let pixelRatio = 1;
  let shadowLight = null;

  function resize(width = window.innerWidth, height = window.innerHeight) {
    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));
    pixelRatio = Math.min(window.devicePixelRatio || 1, QUALITY_PRESETS[qualityName].maxPixelRatio);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(safeWidth, safeHeight, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(safeWidth, safeHeight);
    camera.aspect = safeWidth / safeHeight;
    camera.updateProjectionMatrix();
    onResize?.(pixelRatio, safeWidth, safeHeight);
  }

  function updateShadows() {
    const quality = QUALITY_PRESETS[qualityName];
    renderer.shadowMap.enabled = quality.shadows;
    renderer.shadowMap.needsUpdate = true;
    if (!shadowLight) return;
    shadowLight.castShadow = quality.shadows;
    const current = shadowLight.shadow.mapSize.x;
    if (current !== quality.shadowSize) {
      shadowLight.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
      if (shadowLight.shadow.map) {
        shadowLight.shadow.map.dispose();
        shadowLight.shadow.map = null;
      }
      shadowLight.shadow.needsUpdate = true;
    }
  }

  function setQuality(name) {
    if (!QUALITY_PRESETS[name]) return qualityName;
    qualityName = name;
    const quality = QUALITY_PRESETS[qualityName];
    gtaoPass.enabled = quality.gtao;
    gtaoPass.blendIntensity = quality.aoIntensity;
    bloomPass.enabled = quality.bloom;
    bloomPass.strength = quality.bloomStrength;
    bloomPass.radius = quality.bloomRadius;
    bloomPass.threshold = quality.bloomThreshold;
    fxaaPass.enabled = quality.fxaa;
    updateShadows();
    resize();
    return qualityName;
  }

  function setShadowLight(light) {
    shadowLight = light;
    updateShadows();
  }

  function performanceHint() {
    try {
      const gl = renderer.getContext();
      const extension = gl.getExtension('WEBGL_debug_renderer_info');
      const name = extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      return String(name || '').toLowerCase();
    } catch {
      return '';
    }
  }

  function render(dt) {
    composer.render(dt);
  }

  setQuality(qualityName);
  resize();

  return {
    renderer,
    composer,
    passes: { renderPass, gtaoPass, bloomPass, outputPass, fxaaPass },
    render,
    resize,
    setQuality,
    setShadowLight,
    performanceHint,
    get qualityName() { return qualityName; },
    get qualityLabel() { return QUALITY_PRESETS[qualityName].label; },
    get pixelRatio() { return pixelRatio; },
  };
}
