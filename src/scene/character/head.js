import * as THREE from 'three';
import {
  addMesh,
  addPlate,
  outlineTube,
  roundedBox,
  tubeFromPoints,
} from '../geometry.js';
import { seededRandom } from '../textures.js';
import { makeGroup, mirroredPoints, registerSecondary } from './shared.js';

function buildFace(head, materials) {
  addMesh(head, new THREE.SphereGeometry(0.155, 24, 18), materials.skin, {
    position: [0, 0, 0.025],
    scale: [0.90, 1.16, 0.88],
    name: 'Face',
  });
  addMesh(head, roundedBox(0.205, 0.12, 0.16, 0.045), materials.skin, {
    position: [0, -0.105, 0.048], name: 'Jaw',
  });
  addMesh(head, new THREE.ConeGeometry(0.025, 0.075, 4), materials.skin, {
    position: [0, -0.018, 0.158],
    rotation: [Math.PI / 2, 0, Math.PI / 4],
    name: 'Nose',
  });
  [-1, 1].forEach((side) => {
    addMesh(head, new THREE.SphereGeometry(0.023, 10, 8), materials.steelDark, {
      position: [side * 0.055, 0.018, 0.143],
      scale: [1.15, 0.52, 0.35],
      name: `${side > 0 ? 'Left' : 'Right'}Eye`,
    });
    addMesh(head, roundedBox(0.065, 0.012, 0.012, 0.004, 2), materials.hairDark, {
      position: [side * 0.057, 0.055, 0.142],
      rotation: [0, 0, -side * 0.12],
      name: `${side > 0 ? 'Left' : 'Right'}Brow`,
    });
    addMesh(head, new THREE.SphereGeometry(0.042, 12, 8), materials.skin, {
      position: [side * 0.145, -0.005, 0.035],
      scale: [0.42, 1, 0.7],
      name: `${side > 0 ? 'Left' : 'Right'}Ear`,
    });
  });
  addMesh(head, roundedBox(0.075, 0.010, 0.008, 0.003, 2), materials.skinShadow, {
    position: [0, -0.095, 0.13], name: 'Mouth',
  });
}

function buildHair(head, rig, materials) {
  const group = makeGroup(head, 'SilverHair', [0, 0.015, -0.025]);
  addMesh(group, new THREE.SphereGeometry(0.168, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.66), materials.hair, {
    position: [0, 0.035, -0.015],
    scale: [1, 1.08, 1.02],
    name: 'HairCrown',
  });

  const rng = seededRandom(7719);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i += 1) {
      const spread = side * (0.10 + i * 0.012);
      const length = 0.43 + rng() * 0.30;
      const points = [
        [spread, 0.09 - i * 0.008, -0.055 + i * 0.008],
        [spread * 1.17, -0.12 - rng() * 0.06, -0.10],
        [spread * 1.05 + side * rng() * 0.035, -0.34, -0.13 - rng() * 0.04],
        [spread * 1.14 + side * rng() * 0.04, -length, -0.08 - rng() * 0.08],
      ];
      tubeFromPoints(group, points, 0.0065 + rng() * 0.003, i % 3 === 0 ? materials.hairDark : materials.hair, {
        tubularSegments: 18,
        radialSegments: 5,
        name: `HairStrand${side > 0 ? 'L' : 'R'}${i + 1}`,
      });
    }
  }
  for (let i = 0; i < 8; i += 1) {
    const x = (i / 7 - 0.5) * 0.20;
    tubeFromPoints(group, [
      [x, 0.02, -0.16],
      [x * 1.15, -0.24, -0.22],
      [x * 1.3, -0.48 - rng() * 0.16, -0.18],
    ], 0.007, i % 2 ? materials.hair : materials.hairDark, {
      tubularSegments: 14,
      radialSegments: 5,
      name: `BackHairStrand${i + 1}`,
    });
  }
  registerSecondary(rig, group, 'hair', { weight: 1 });
  rig.hair = group;
}

function buildWingFin(parent, materials, side, label) {
  const group = makeGroup(parent, `${label}HelmetWing`, [side * 0.16, 0.13, -0.005], [0, side * 0.14, side * 0.08]);
  group.scale.set(1.08, 1, 1.2);
  const points = mirroredPoints([
    [-0.025, -0.08], [0.055, 0.015], [0.17, 0.07], [0.13, 0.18],
    [0.265, 0.31], [0.215, 0.46], [0.31, 0.60], [0.16, 0.52],
    [0.085, 0.40], [0.02, 0.30], [-0.04, 0.11],
  ], side);
  addPlate(group, points, materials.wingSteel, {
    depth: 0.032,
    bevel: 0.007,
    position: [0, 0, 0.005],
    name: `${label}HelmetWingPlate`,
  });
  outlineTube(group, points, 0.031, 0.0055, materials.glowTrim, `${label}HelmetWingEdge`);

  const ribs = [
    [[0, -0.03, 0.036], [side * 0.09, 0.14, 0.04], [side * 0.17, 0.31, 0.04]],
    [[0, -0.02, 0.037], [side * 0.12, 0.18, 0.041], [side * 0.265, 0.46, 0.041]],
    [[0, -0.01, 0.038], [side * 0.08, 0.22, 0.042], [side * 0.31, 0.59, 0.042]],
  ];
  ribs.forEach((rib, index) => tubeFromPoints(group, rib, 0.0055, index === 1 ? materials.steelBright : materials.redTrim, {
    tubularSegments: 14,
    radialSegments: 5,
    name: `${label}HelmetWingRib${index + 1}`,
  }));

  addMesh(group, new THREE.ConeGeometry(0.042, 0.50, 6), materials.steel, {
    position: [side * 0.215, 0.38, -0.025],
    rotation: [0.08, 0, -side * 0.30],
    scale: [1, 1, 0.72],
    name: `${label}HelmetHorn`,
  });
  addMesh(group, new THREE.TorusGeometry(0.05, 0.012, 6, 12), materials.darkBrass, {
    position: [side * 0.215, 0.14, -0.025],
    rotation: [Math.PI / 2, 0, 0],
    name: `${label}HelmetHornBase`,
  });
  return group;
}

function buildPlume(helmet, rig, materials) {
  const group = makeGroup(helmet, 'CrimsonPlume', [0, 0.27, -0.10], [0.05, 0, 0]);
  const rng = seededRandom(1911);
  const count = 22;
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const x = (t - 0.5) * 0.105;
    const length = 0.42 + rng() * 0.32;
    const endX = x * 1.7 + (rng() - 0.5) * 0.10;
    const endY = -0.12 - rng() * 0.20;
    const endZ = -0.52 - length * 0.65;
    const middle = [x * 1.25, 0.02 + rng() * 0.05, -0.24 - rng() * 0.12];
    tubeFromPoints(group, [
      [x, 0.02, 0.04],
      [x * 1.1, 0.08, -0.12],
      middle,
    ], 0.0075, materials.plumeDark, {
      tubularSegments: 12,
      radialSegments: 4,
      name: `PlumeRoot${i + 1}`,
    });
    tubeFromPoints(group, [
      middle,
      [(middle[0] + endX) * 0.5, -0.02 + rng() * 0.04, (middle[2] + endZ) * 0.5],
      [endX, endY, endZ],
    ], 0.0065, i % 5 === 0 ? materials.plumeDark : materials.plumeRed, {
      tubularSegments: 14,
      radialSegments: 4,
      name: `PlumeTip${i + 1}`,
    });
  }
  registerSecondary(rig, group, 'plume', { weight: 1 });
  rig.plume = group;
  return group;
}

function buildHelmet(head, rig, materials) {
  const helmet = makeGroup(head, 'DragonHelmet');
  addMesh(helmet, new THREE.SphereGeometry(0.215, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.59), materials.steel, {
    position: [0, 0.055, -0.012],
    scale: [1, 1.10, 1.04],
    name: 'HelmetSkull',
  });
  addMesh(helmet, new THREE.CylinderGeometry(0.195, 0.215, 0.16, 20, 1, true, Math.PI / 2, Math.PI), materials.steelDark, {
    position: [0, -0.045, -0.028],
    scale: [1, 1, 1.02],
    name: 'HelmetRearGuard',
  });

  addPlate(helmet, [
    [-0.21, 0.125], [-0.16, 0.215], [-0.055, 0.185], [0, 0.145],
    [0.055, 0.185], [0.16, 0.215], [0.21, 0.125], [0.16, 0.065],
    [0.045, 0.095], [0, 0.025], [-0.045, 0.095], [-0.16, 0.065],
  ], materials.steelBright, {
    depth: 0.04,
    bevel: 0.007,
    position: [0, 0, 0.165],
    name: 'DragonBrow',
  });
  addMesh(helmet, roundedBox(0.31, 0.045, 0.026, 0.010, 2), materials.steelDark, {
    position: [0, 0.083, 0.19], name: 'HelmetEyeSlit',
  });
  addPlate(helmet, [
    [-0.034, 0.105], [0.034, 0.105], [0.021, -0.055], [0, -0.105], [-0.021, -0.055],
  ], materials.steel, {
    depth: 0.025,
    bevel: 0.004,
    position: [0, 0, 0.198],
    name: 'NasalGuard',
  });
  outlineTube(helmet, [
    [-0.032, 0.10], [0.032, 0.10], [0.02, -0.05], [0, -0.10], [-0.02, -0.05],
  ], 0.216, 0.003, materials.redTrim, 'NasalGuardTrim');

  [-1, 1].forEach((side) => {
    addPlate(
      helmet,
      mirroredPoints([
        [0.105, 0.075], [0.20, 0.045], [0.19, -0.095], [0.125, -0.205],
        [0.045, -0.145], [0.065, -0.015],
      ], side),
      materials.steel,
      {
        depth: 0.042,
        bevel: 0.007,
        position: [0, 0, 0.128],
        rotation: [0, side * 0.18, 0],
        name: `${side > 0 ? 'Left' : 'Right'}CheekGuard`,
      },
    );
    addMesh(helmet, new THREE.SphereGeometry(0.022, 10, 8), materials.ruby, {
      position: [side * 0.105, 0.155, 0.192],
      scale: [1.25, 0.55, 0.38],
      name: `${side > 0 ? 'Left' : 'Right'}DragonEyeGem`,
    });
    addMesh(helmet, new THREE.TorusGeometry(0.026, 0.006, 6, 12), materials.darkBrass, {
      position: [side * 0.105, 0.155, 0.19],
      scale: [1.25, 0.6, 1],
      name: `${side > 0 ? 'Left' : 'Right'}GemBezel`,
    });
    buildWingFin(helmet, materials, side, side > 0 ? 'Left' : 'Right');
  });

  addMesh(helmet, roundedBox(0.25, 0.055, 0.045, 0.014, 2), materials.steelDark, {
    position: [0, -0.165, 0.115], name: 'ChinGuard',
  });
  addMesh(helmet, new THREE.ConeGeometry(0.055, 0.30, 4), materials.steelBright, {
    position: [0, 0.265, 0.075],
    rotation: [0.20, Math.PI / 4, 0],
    scale: [0.75, 1, 0.72],
    name: 'HelmetCrest',
  });
  addMesh(helmet, new THREE.ConeGeometry(0.036, 0.38, 6), materials.steel, {
    position: [0, 0.365, -0.025],
    scale: [0.85, 1, 0.75],
    name: 'CentralHelmetSpike',
  });
  for (let i = 0; i < 3; i += 1) {
    addMesh(helmet, roundedBox(0.34 - i * 0.035, 0.045, 0.035, 0.012, 2), i === 1 ? materials.steelBright : materials.steelDark, {
      position: [0, -0.09 - i * 0.055, -0.20],
      rotation: [0.08 * i, 0, 0],
      name: `NeckLame${i + 1}`,
    });
  }

  buildPlume(helmet, rig, materials);
  registerSecondary(rig, helmet, 'helmet', { weight: 0.3 });
  rig.helmet = helmet;
  return helmet;
}

export function buildHead(torso, rig, materials) {
  const neck = makeGroup(torso, 'Neck', [0, 0.79, 0]);
  addMesh(neck, new THREE.CylinderGeometry(0.085, 0.105, 0.17, 14), materials.skin, {
    position: [0, 0.01, 0], name: 'NeckFlesh',
  });
  const head = makeGroup(neck, 'Head', [0, 0.12, 0.02]);
  buildFace(head, materials);
  buildHair(head, rig, materials);
  buildHelmet(head, rig, materials);
  rig.neck = neck;
  rig.head = head;
}
