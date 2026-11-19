import * as THREE from 'three';
import {
  addMesh,
  addPlate,
  addRivets,
  outlineTube,
  roundedBox,
  tubeFromPoints,
} from '../geometry.js';
import { seededRandom } from '../textures.js';
import { makeGroup, mirroredPoints, registerSecondary } from './shared.js';

const BREASTPLATE_POINTS = [
  [-0.42, 0.66], [-0.31, 0.72], [-0.13, 0.70], [0, 0.64],
  [0.13, 0.70], [0.31, 0.72], [0.42, 0.66], [0.39, 0.31],
  [0.33, 0.09], [0.19, -0.03], [0, -0.10], [-0.19, -0.03],
  [-0.33, 0.09], [-0.39, 0.31],
];

function buildPauldron(parent, rig, materials, side, label) {
  const group = makeGroup(parent, `${label}Pauldron`, [0, 0.02, 0], [0, 0, -side * 0.04]);
  addMesh(
    group,
    new THREE.SphereGeometry(0.19, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    materials.steelDark,
    { position: [0, 0.01, 0], scale: [1.05, 0.72, 0.9] },
  );

  for (let layer = 0; layer < 4; layer += 1) {
    const reach = 0.24 + layer * 0.045;
    const points = mirroredPoints([
      [-0.10, 0.13], [0.08, 0.16], [reach, 0.08],
      [reach + 0.025, -0.035], [0.13, -0.15], [-0.11, -0.09],
    ], side);
    addPlate(group, points, layer % 2 ? materials.steel : materials.steelBlue, {
      depth: 0.038,
      bevel: 0.008,
      position: [0, -layer * 0.035, 0.03 + layer * 0.025],
      rotation: [0.10 * layer, side * 0.12, -side * (0.04 + layer * 0.025)],
      name: `${label}PauldronLayer${layer + 1}`,
    });
    const ribs = [];
    for (let rib = 0; rib < 3; rib += 1) {
      ribs.push([
        [side * (0.02 + rib * 0.045), 0.12 - rib * 0.018, 0.056 + layer * 0.025],
        [side * (0.12 + rib * 0.045), 0.04 - rib * 0.025, 0.067 + layer * 0.025],
        [side * (reach - rib * 0.018), -0.02 - rib * 0.012, 0.073 + layer * 0.025],
      ]);
    }
    ribs.forEach((rib, index) => tubeFromPoints(
      group,
      rib,
      0.0035,
      index === 1 ? materials.redTrim : materials.steelBright,
      { tubularSegments: 12, radialSegments: 4, name: `${label}PauldronRib${layer}${index}` },
    ));
  }

  addRivets(group, [
    [-side * 0.10, 0.08, 0.13], [side * 0.11, 0.10, 0.14],
    [side * 0.19, 0.02, 0.15], [side * 0.12, -0.09, 0.14],
  ], materials.darkBrass, 0.012, `${label}PauldronRivets`);
  registerSecondary(rig, group, 'pauldron', { phase: side > 0 ? 0 : Math.PI, weight: 1 });
  return group;
}

function buildArm(shoulder, rig, materials, side, label) {
  addMesh(shoulder, new THREE.CapsuleGeometry(0.095, 0.29, 4, 10), materials.blackLeather, {
    position: [0, -0.20, 0], scale: [1, 1, 0.86], name: `${label}UpperArm`,
  });
  for (let i = 0; i < 3; i += 1) {
    addMesh(shoulder, new THREE.CylinderGeometry(0.122 - i * 0.006, 0.115, 0.055, 14), materials.steelDark, {
      position: [0, -0.10 - i * 0.12, 0], scale: [1, 1, 0.86], name: `${label}ArmBand${i + 1}`,
    });
  }
  addPlate(shoulder, [
    [-0.105, -0.05], [0.105, -0.05], [0.09, -0.34], [0, -0.39], [-0.09, -0.34],
  ], materials.steel, {
    depth: 0.04,
    bevel: 0.008,
    position: [0, 0, 0.105],
    name: `${label}UpperArmPlate`,
  });

  const elbow = makeGroup(shoulder, `${label}Forearm`, [0, -0.42, 0]);
  addMesh(elbow, new THREE.SphereGeometry(0.10, 14, 10), materials.steelDark, {
    position: [0, 0, 0], scale: [1, 0.9, 0.9], name: `${label}Elbow`,
  });
  addMesh(elbow, new THREE.CylinderGeometry(0.115, 0.088, 0.38, 14), materials.steelDark, {
    position: [0, -0.21, 0], scale: [1, 1, 0.85], name: `${label}Vambrace`,
  });
  addPlate(elbow, [
    [-0.105, -0.02], [0.105, -0.02], [0.085, -0.40], [0, -0.44], [-0.085, -0.40],
  ], materials.steel, {
    depth: 0.035,
    bevel: 0.007,
    position: [0, 0, 0.095],
    name: `${label}ForearmPlate`,
  });
  tubeFromPoints(elbow, [
    [0, -0.02, 0.115], [0, -0.19, 0.118], [0, -0.40, 0.10],
  ], 0.007, materials.redTrim, { name: `${label}VambraceTrim` });

  const wrist = makeGroup(elbow, `${label}Hand`, [0, -0.41, 0]);
  addMesh(wrist, roundedBox(0.17, 0.13, 0.13, 0.025), materials.steel, {
    position: [0, -0.035, 0.01], name: `${label}Gauntlet`,
  });
  for (let finger = 0; finger < 4; finger += 1) {
    addMesh(wrist, roundedBox(0.030, 0.11, 0.045, 0.012, 2), materials.steelDark, {
      position: [(finger - 1.5) * 0.035, -0.13, 0.025],
      rotation: [0.12, 0, (finger - 1.5) * 0.025],
      name: `${label}Finger${finger + 1}`,
    });
  }
  addMesh(wrist, roundedBox(0.045, 0.09, 0.05, 0.014, 2), materials.steelDark, {
    position: [-side * 0.095, -0.09, 0.035],
    rotation: [0, 0, side * 0.55],
    name: `${label}Thumb`,
  });
  return { elbow, wrist };
}

function buildLeg(hips, rig, materials, side, label) {
  const leg = makeGroup(hips, `${label}Leg`, [side * 0.18, -0.02, 0]);
  addMesh(leg, new THREE.CapsuleGeometry(0.115, 0.31, 4, 10), materials.blackLeather, {
    position: [0, -0.24, 0], scale: [1, 1, 0.88], name: `${label}Thigh`,
  });
  addPlate(leg, [
    [-0.125, -0.04], [0.125, -0.04], [0.105, -0.40], [0, -0.46], [-0.105, -0.40],
  ], materials.steelDark, {
    depth: 0.045,
    bevel: 0.009,
    position: [0, 0, 0.115],
    name: `${label}Cuisses`,
  });
  for (let i = 0; i < 3; i += 1) {
    addMesh(leg, new THREE.CylinderGeometry(0.132 - i * 0.008, 0.124, 0.045, 14), materials.steel, {
      position: [0, -0.10 - i * 0.13, 0], scale: [1, 1, 0.88], name: `${label}ThighBand${i + 1}`,
    });
  }

  const knee = makeGroup(leg, `${label}Knee`, [0, -0.50, 0]);
  addMesh(knee, roundedBox(0.20, 0.16, 0.18, 0.035), materials.steel, {
    position: [0, -0.01, 0.055], name: `${label}Poleyn`,
  });
  addPlate(knee, mirroredPoints([
    [-0.02, 0.08], [0.16, 0.06], [0.20, -0.02], [0.10, -0.08], [0, -0.03],
  ], side), materials.steelBright, {
    depth: 0.03,
    bevel: 0.006,
    position: [0, 0, 0.11],
    name: `${label}KneeWing`,
  });
  addMesh(knee, new THREE.CylinderGeometry(0.11, 0.088, 0.42, 14), materials.steelDark, {
    position: [0, -0.25, 0], scale: [1, 1, 0.86], name: `${label}Shin`,
  });
  addPlate(knee, [
    [-0.105, -0.04], [0.105, -0.04], [0.085, -0.43], [0, -0.48], [-0.085, -0.43],
  ], materials.steel, {
    depth: 0.038,
    bevel: 0.008,
    position: [0, 0, 0.10],
    name: `${label}Greave`,
  });
  tubeFromPoints(knee, [
    [0, -0.04, 0.123], [0, -0.25, 0.125], [0, -0.46, 0.115],
  ], 0.006, materials.redTrim, { name: `${label}GreaveTrim` });
  addRivets(knee, [
    [-0.075, -0.10, 0.125], [0.075, -0.10, 0.125],
    [-0.065, -0.33, 0.12], [0.065, -0.33, 0.12],
  ], materials.darkBrass, 0.010, `${label}GreaveRivets`);

  const foot = makeGroup(knee, `${label}Foot`, [0, -0.48, 0]);
  addMesh(foot, roundedBox(0.20, 0.14, 0.39, 0.045), materials.blackLeather, {
    position: [0, -0.07, 0.105], name: `${label}Boot`,
  });
  addMesh(foot, roundedBox(0.205, 0.12, 0.16, 0.04), materials.steelDark, {
    position: [0, -0.065, 0.255], name: `${label}BootToe`,
  });
  addMesh(foot, roundedBox(0.19, 0.055, 0.31, 0.02), materials.steel, {
    position: [0, -0.132, 0.12], name: `${label}BootSole`,
  });
  return { leg, knee, foot };
}

function buildFaulds(hips, rig, materials) {
  const rng = seededRandom(1208);
  for (let layer = 0; layer < 3; layer += 1) {
    for (let i = 0; i < 10; i += 1) {
      const angle = (i / 10) * Math.PI * 2;
      const group = makeGroup(
        hips,
        `Fauld${layer + 1}_${i + 1}`,
        [0, -0.02 - layer * 0.125, 0],
        [0, angle, 0],
      );
      addPlate(group, [
        [-0.105, 0.08], [0.105, 0.08], [0.095, -0.10],
        [0, -0.155], [-0.095, -0.10],
      ], layer === 1 ? materials.steelBlue : materials.steelDark, {
        depth: 0.032,
        bevel: 0.006,
        position: [0, -0.075, 0.285 + layer * 0.015],
        name: `FauldPlate${layer + 1}_${i + 1}`,
      });
      if (layer < 2) {
        outlineTube(group, [
          [-0.092, -0.085], [0, -0.135], [0.092, -0.085],
        ], 0.305 + layer * 0.015, 0.0035, materials.redTrim, `FauldTrim${layer}${i}`);
      }
      registerSecondary(rig, group, 'fauld', {
        phase: i * 0.55 + layer * 0.8 + rng() * 0.2,
        weight: 0.65 + layer * 0.18,
      });
    }
  }

  [-1, 1].forEach((side, index) => {
    const group = makeGroup(hips, `Tasset${index + 1}`, [side * 0.14, -0.18, 0.29], [0.06, 0, side * 0.04]);
    addPlate(group, [
      [-0.095, 0.02], [0.095, 0.02], [0.085, -0.34], [0, -0.43], [-0.085, -0.34],
    ], materials.steel, {
      depth: 0.04,
      bevel: 0.008,
      position: [0, -0.19, 0],
      name: `TassetPlate${index + 1}`,
    });
    outlineTube(group, [
      [-0.09, 0.01], [0.09, 0.01], [0.08, -0.34], [0, -0.42], [-0.08, -0.34],
    ], 0.026, 0.004, materials.redTrim, `TassetTrim${index + 1}`);
    registerSecondary(rig, group, 'tasset', { phase: index * Math.PI, weight: 1 });
  });
}

function buildFurCollar(torso, rig, materials) {
  const group = makeGroup(torso, 'FurCollar', [0, 0.72, -0.01]);
  const geometry = new THREE.ConeGeometry(0.028, 0.15, 5);
  const mesh = new THREE.InstancedMesh(geometry, materials.fur, 28);
  mesh.name = 'WhiteFurMantle';
  const dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  const rng = seededRandom(4488);
  for (let i = 0; i < 28; i += 1) {
    const angle = (i / 28) * Math.PI * 2;
    const radiusX = 0.29 + (rng() - 0.5) * 0.025;
    const radiusZ = 0.22 + (rng() - 0.5) * 0.02;
    dummy.position.set(Math.cos(angle) * radiusX, 0.015 + rng() * 0.02, Math.sin(angle) * radiusZ);
    const direction = new THREE.Vector3(Math.cos(angle) * 0.85, -0.25, Math.sin(angle) * 0.9).normalize();
    dummy.quaternion.setFromUnitVectors(up, direction);
    dummy.scale.setScalar(0.8 + rng() * 0.5);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  registerSecondary(rig, group, 'fur', { weight: 0.45 });
  rig.fur = group;
}

export function buildPelvis(hips, rig, materials) {
  addMesh(hips, roundedBox(0.48, 0.24, 0.34, 0.06), materials.blackLeather, {
    position: [0, -0.04, 0], name: 'Pelvis',
  });
  addMesh(hips, new THREE.CylinderGeometry(0.325, 0.325, 0.085, 24, 1, true), materials.leather, {
    position: [0, 0.085, 0], scale: [1, 1, 0.76], name: 'Belt',
  });
  for (let i = 0; i < 9; i += 1) {
    addMesh(hips, roundedBox(0.095, 0.07, 0.025, 0.012, 2), materials.darkBrass, {
      position: [Math.sin(i * 0.7) * 0.31, 0.085, Math.cos(i * 0.7) * 0.235],
      rotation: [0, i * 0.7, 0],
      name: `BeltStud${i + 1}`,
    });
  }
  addMesh(hips, roundedBox(0.12, 0.10, 0.04, 0.018), materials.brass, {
    position: [0, 0.085, 0.27], name: 'BeltBuckle',
  });
  addMesh(hips, new THREE.OctahedronGeometry(0.035, 0), materials.ruby, {
    position: [0, 0.085, 0.295], scale: [1, 1, 0.45], name: 'BeltRuby',
  });
  buildFaulds(hips, rig, materials);
}

export function buildTorso(torso, rig, materials) {
  addMesh(torso, new THREE.CylinderGeometry(0.31, 0.255, 0.72, 20), materials.blackLeather, {
    position: [0, 0.36, 0], scale: [1, 1, 0.72], name: 'TorsoUnderlayer',
  });
  addMesh(torso, new THREE.CylinderGeometry(0.385, 0.30, 0.66, 24, 1, true), materials.steelDark, {
    position: [0, 0.38, 0], scale: [1, 1, 0.73], name: 'TorsoShell',
  });

  addPlate(torso, BREASTPLATE_POINTS, materials.steel, {
    depth: 0.075,
    bevel: 0.014,
    position: [0, 0, 0.225],
    name: 'Breastplate',
  });
  outlineTube(torso, BREASTPLATE_POINTS, 0.272, 0.007, materials.redTrim, 'BreastplateRedInlay');
  addMesh(torso, new THREE.PlaneGeometry(0.68, 0.30), materials.engraving, {
    position: [0, 0.56, 0.294],
    castShadow: false,
    receiveShadow: false,
    name: 'BreastplateEngraving',
  });

  const scaleGeometry = new THREE.SphereGeometry(0.055, 10, 6);
  scaleGeometry.scale(1, 1.24, 0.25);
  const scaleCount = 9 * 8;
  const scales = new THREE.InstancedMesh(scaleGeometry, materials.scale, scaleCount);
  scales.name = 'ScaleMail';
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const rng = seededRandom(5521);
  let index = 0;
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const x = -0.245 + col * 0.07 + (row % 2) * 0.035;
      const y = 0.13 + row * 0.047;
      dummy.position.set(x, y, 0.278 + rng() * 0.008);
      dummy.rotation.set(0, 0, (rng() - 0.5) * 0.08);
      dummy.scale.setScalar(0.93 + rng() * 0.14);
      dummy.updateMatrix();
      scales.setMatrixAt(index, dummy.matrix);
      color.set(0xffffff).multiplyScalar(0.76 + rng() * 0.28);
      scales.setColorAt(index, color);
      index += 1;
    }
  }
  scales.instanceMatrix.needsUpdate = true;
  if (scales.instanceColor) scales.instanceColor.needsUpdate = true;
  scales.castShadow = true;
  scales.receiveShadow = true;
  torso.add(scales);

  tubeFromPoints(torso, [
    [0, 0.68, 0.283], [0, 0.38, 0.292], [0, 0.06, 0.283],
  ], 0.010, materials.steelBright, { name: 'BreastplateSpine' });
  addRivets(torso, [
    [-0.36, 0.61, 0.278], [0.36, 0.61, 0.278],
    [-0.36, 0.31, 0.278], [0.36, 0.31, 0.278],
    [-0.27, 0.05, 0.278], [0.27, 0.05, 0.278],
    [0, -0.055, 0.278],
  ], materials.brass, 0.012, 'BreastplateRivets');

  addMesh(torso, new THREE.CylinderGeometry(0.19, 0.225, 0.13, 20, 1, true), materials.steelBright, {
    position: [0, 0.755, 0], scale: [1, 1, 0.82], name: 'Gorget',
  });
  addMesh(torso, new THREE.TorusGeometry(0.19, 0.014, 8, 28), materials.darkBrass, {
    position: [0, 0.825, 0], rotation: [Math.PI / 2, 0, 0], scale: [1, 0.82, 1], name: 'GorgetRing',
  });
  addPlate(torso, [
    [-0.23, 0.82], [0, 0.77], [0.23, 0.82], [0.18, 0.70], [0, 0.66], [-0.18, 0.70],
  ], materials.steel, {
    depth: 0.045,
    bevel: 0.008,
    position: [0, 0, 0.205],
    name: 'GorgetFront',
  });
  addMesh(torso, new THREE.OctahedronGeometry(0.045, 0), materials.ruby, {
    position: [0, 0.745, 0.235], scale: [1, 1, 0.42], name: 'GorgetRuby',
  });
  buildFurCollar(torso, rig, materials);
}

export function buildArms(torso, rig, materials) {
  rig.arms = {};
  rig.elbows = {};
  rig.wrists = {};
  rig.pauldrons = {};

  for (const [key, side, label] of [['left', 1, 'Left'], ['right', -1, 'Right']]) {
    const shoulder = makeGroup(torso, `${label}Arm`, [side * 0.43, 0.59, 0], [0, 0, side * 0.06]);
    const { elbow, wrist } = buildArm(shoulder, rig, materials, side, label);
    const pauldron = buildPauldron(shoulder, rig, materials, side, label);
    rig.arms[key] = shoulder;
    rig.elbows[key] = elbow;
    rig.wrists[key] = wrist;
    rig.pauldrons[key] = pauldron;
  }
}

export function buildLegs(hips, rig, materials) {
  rig.legs = {};
  rig.knees = {};
  rig.feet = {};
  for (const [key, side, label] of [['left', 1, 'Left'], ['right', -1, 'Right']]) {
    const { leg, knee, foot } = buildLeg(hips, rig, materials, side, label);
    rig.legs[key] = leg;
    rig.knees[key] = knee;
    rig.feet[key] = foot;
  }
}
