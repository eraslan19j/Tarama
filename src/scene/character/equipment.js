import * as THREE from 'three';
import {
  addMesh,
  addPlate,
  addRivets,
  createCapeGeometry,
  createShapeFaceGeometry,
  createShieldShape,
  outlineTube,
  roundedBox,
  tubeFromPoints,
} from '../geometry.js';
import { makeGroup, registerSecondary } from './shared.js';

function createShield(materials) {
  const group = makeGroup(null, 'DragonShield');
  const shape = createShieldShape();
  const outline = shape.getPoints(64).map((point) => [point.x, point.y]);

  const body = new THREE.ExtrudeGeometry(shape, {
    depth: 0.075,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 12,
  });
  body.translate(0, 0, -0.0375);
  addMesh(group, body, materials.steelDark, { name: 'ShieldBody' });
  addMesh(group, createShapeFaceGeometry(shape, 32), materials.shieldFace, {
    position: [0, 0, 0.052],
    castShadow: false,
    name: 'ThreeHeadedDragonSigil',
  });
  outlineTube(group, outline, 0.061, 0.016, materials.darkBrass, 'ShieldRim');
  outlineTube(
    group,
    outline.map(([x, y]) => [x * 0.91, y * 0.91 - 0.005]),
    0.064,
    0.003,
    materials.brass,
    'ShieldInnerFiligree',
  );

  const rivetPoints = [];
  for (let i = 0; i < outline.length; i += 5) {
    const [x, y] = outline[i];
    rivetPoints.push([x * 0.94, y * 0.94, 0.073]);
  }
  addRivets(group, rivetPoints, materials.brass, 0.011, 'ShieldRivets');

  addMesh(group, roundedBox(0.18, 0.045, 0.05, 0.015, 2), materials.leather, {
    position: [0, 0.03, -0.07], name: 'ShieldHandle',
  });
  return group;
}

function createSword(materials) {
  const group = new THREE.Group();
  group.name = ' ValyrianLongsword'.trim();
  addPlate(group, [
    [-0.044, 0], [-0.036, -0.70], [0, -0.965], [0.036, -0.70], [0.044, 0],
  ], materials.steelBright, {
    depth: 0.018,
    bevel: 0.003,
    position: [0, 0, 0],
    name: 'SwordBlade',
  });
  tubeFromPoints(group, [
    [0, -0.035, 0.014], [0, -0.35, 0.014], [0, -0.78, 0.012],
  ], 0.0035, materials.steelDark, { name: 'SwordFuller' });
  addMesh(group, new THREE.CylinderGeometry(0.022, 0.026, 0.18, 12), materials.leather, {
    position: [0, 0.10, 0], name: 'SwordGrip',
  });
  for (let i = 0; i < 5; i += 1) {
    addMesh(group, new THREE.TorusGeometry(0.025, 0.0035, 5, 10), materials.darkBrass, {
      position: [0, 0.035 + i * 0.033, 0],
      rotation: [Math.PI / 2, 0, 0],
      name: `SwordGripWrap${i + 1}`,
    });
  }
  addPlate(group, [
    [-0.17, 0.015], [-0.09, 0.045], [-0.03, 0.018], [0, 0.055],
    [0.03, 0.018], [0.09, 0.045], [0.17, 0.015], [0.105, -0.035],
    [0, -0.012], [-0.105, -0.035],
  ], materials.brass, {
    depth: 0.035,
    bevel: 0.005,
    position: [0, 0, 0],
    name: 'DragonWingCrossguard',
  });
  addMesh(group, new THREE.OctahedronGeometry(0.035, 0), materials.ruby, {
    position: [0, 0.012, 0.028],
    scale: [0.8, 1, 0.45],
    name: 'CrossguardRuby',
  });
  addMesh(group, new THREE.IcosahedronGeometry(0.048, 1), materials.gold, {
    position: [0, 0.215, 0],
    scale: [0.8, 1.05, 0.75],
    name: 'DragonPommel',
  });
  return group;
}

function buildCape(torso, rig, materials) {
  const cape = makeGroup(torso, 'AnimatedCrimsonCape', [0, 0.70, -0.25]);
  const geometry = createCapeGeometry();
  const cloth = addMesh(cape, geometry, materials.redCloth, {
    name: 'CapeCloth',
    castShadow: true,
    receiveShadow: true,
  });
  cloth.frustumCulled = false;
  rig.cape = cape;
  rig.capeMesh = cloth;

  const chain = makeGroup(torso, 'CapeChain', [0, 0, 0]);
  [-1, 1].forEach((side) => {
    addMesh(chain, new THREE.TorusGeometry(0.045, 0.010, 8, 18), materials.brass, {
      position: [side * 0.31, 0.69, 0.245], name: `${side > 0 ? 'Left' : 'Right'}CapeClasp`,
    });
    addMesh(chain, new THREE.OctahedronGeometry(0.027, 0), materials.ruby, {
      position: [side * 0.31, 0.69, 0.256],
      scale: [1, 1, 0.45],
      name: `${side > 0 ? 'Left' : 'Right'}CapeClaspRuby`,
    });
  });
  for (let i = 0; i < 3; i += 1) {
    tubeFromPoints(chain, [
      [-0.31, 0.66, 0.27],
      [-0.16, 0.58 - i * 0.025, 0.30 - i * 0.01],
      [0, 0.55 - i * 0.035, 0.315 - i * 0.01],
      [0.16, 0.58 - i * 0.025, 0.30 - i * 0.01],
      [0.31, 0.66, 0.27],
    ], 0.006 - i * 0.0006, i === 1 ? materials.gold : materials.darkBrass, {
      tubularSegments: 36,
      radialSegments: 5,
      name: `CapeChain${i + 1}`,
    });
  }
  registerSecondary(rig, chain, 'chain', { weight: 0.45 });
  rig.capeChain = chain;
  rig.clasps = chain;
}

function buildHipHilts(hips, materials) {
  [-1, 1].forEach((side) => {
    const group = makeGroup(
      hips,
      `${side > 0 ? 'Left' : 'Right'}HipSword`,
      [side * 0.265, 0.02, 0.18],
      [0.12, side * 0.16, side * 0.18],
    );
    addMesh(group, new THREE.CylinderGeometry(0.022, 0.027, 0.18, 10), materials.leather, {
      position: [0, 0.02, 0], name: `${side > 0 ? 'Left' : 'Right'}HipGrip`,
    });
    addMesh(group, new THREE.IcosahedronGeometry(0.044, 1), materials.gold, {
      position: [0, 0.13, 0], scale: [0.8, 1, 0.75], name: `${side > 0 ? 'Left' : 'Right'}HipPommel`,
    });
    addMesh(group, roundedBox(0.14, 0.028, 0.04, 0.008, 2), materials.brass, {
      position: [0, -0.08, 0], name: `${side > 0 ? 'Left' : 'Right'}HipGuard`,
    });
    addMesh(group, new THREE.CylinderGeometry(0.028, 0.018, 0.46, 8), materials.steelDark, {
      position: [0, -0.31, 0], name: `${side > 0 ? 'Left' : 'Right'}HipScabbard`,
    });
  });
}

export function buildEquipment(rig, materials) {
  buildCape(rig.torso, rig, materials);
  buildHipHilts(rig.hips, materials);

  const shield = createShield(materials);
  shield.position.set(0.04, -0.18, 0.19);
  shield.rotation.set(0.04, -0.18, -0.08);
  rig.elbows.left.add(shield);
  registerSecondary(rig, shield, 'shield', { phase: 1.4, weight: 1 });
  rig.shield = shield;

  const sword = createSword(materials);
  sword.position.set(0, -0.07, 0.07);
  sword.rotation.set(-0.18, 0, 0.10);
  rig.wrists.right.add(sword);
  registerSecondary(rig, sword, 'sword', { phase: 0.8, weight: 1 });
  rig.sword = sword;
}
