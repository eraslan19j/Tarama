import * as THREE from 'three';
import { traverseAndEnableShadows } from '../geometry.js';
import { buildArms, buildLegs, buildPelvis, buildTorso } from './body.js';
import { buildEquipment } from './equipment.js';
import { buildHead } from './head.js';
import { makeGroup } from './shared.js';

export function createDragonKnight(materials) {
  const root = makeGroup(null, 'DragonKnight');
  root.userData.asset = {
    title: 'The Dragon Knight',
    pipeline: 'parametric real-time character',
    scale: 'meters',
    forwardAxis: '+Z',
  };

  const hips = makeGroup(root, 'Hips', [0, 1.12, 0]);
  const torso = makeGroup(hips, 'Torso', [0, 0.20, 0]);

  const rig = {
    root,
    hips,
    torso,
    secondary: [],
    base: {
      hipsY: hips.position.y,
      torsoY: torso.position.y,
      rootRotationY: 0,
      shoulderRotationZ: { left: 0.06, right: -0.06 },
    },
  };

  buildPelvis(hips, rig, materials);
  buildTorso(torso, rig, materials);
  buildLegs(hips, rig, materials);
  buildArms(torso, rig, materials);
  buildHead(torso, rig, materials);
  buildEquipment(rig, materials);

  traverseAndEnableShadows(root);
  const bounds = new THREE.Box3().setFromObject(root);
  rig.bounds = bounds;
  rig.height = bounds.max.y - bounds.min.y;
  root.userData.asset.height = Number(rig.height.toFixed(3));
  return { root, rig };
}
