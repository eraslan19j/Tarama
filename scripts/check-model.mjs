import * as THREE from 'three';
import { createMaterials } from '../src/scene/materials.js';
import { createDragonKnight } from '../src/scene/character/index.js';
import { createExportAnimations } from '../src/scene/export.js';

const materials = createMaterials({});
const { root, rig } = createDragonKnight(materials);
root.updateMatrixWorld(true);

let meshCount = 0;
let instancedMeshCount = 0;
let vertexCount = 0;
let triangleCount = 0;
let invalidVertices = 0;
const names = new Set();
const duplicateNames = new Set();

root.traverse((object) => {
  if (object.name) {
    if (names.has(object.name)) duplicateNames.add(object.name);
    names.add(object.name);
  }
  if (!object.isMesh && !object.isInstancedMesh) return;
  meshCount += 1;
  if (object.isInstancedMesh) instancedMeshCount += 1;
  const geometry = object.geometry;
  const position = geometry?.attributes?.position;
  if (!position) return;
  vertexCount += position.count * (object.isInstancedMesh ? object.count : 1);
  const indexCount = geometry.index?.count || position.count;
  triangleCount += Math.floor(indexCount / 3) * (object.isInstancedMesh ? object.count : 1);
  for (let i = 0; i < position.array.length; i += 1) {
    if (!Number.isFinite(position.array[i])) invalidVertices += 1;
  }
});

const clips = createExportAnimations();
const missingTracks = [];
clips.forEach((clip) => {
  clip.tracks.forEach((track) => {
    const binding = THREE.PropertyBinding.parseTrackName(track.name);
    if (!root.getObjectByName(binding.nodeName)) missingTracks.push(`${clip.name}: ${track.name}`);
  });
});

const bounds = new THREE.Box3().setFromObject(root);
console.log('Dragon Knight model check');
console.log('-------------------------');
console.log(`Height:              ${rig.height.toFixed(3)} m`);
console.log(`Bounds min / max:    y ${bounds.min.y.toFixed(3)} / ${bounds.max.y.toFixed(3)}`);
console.log(`Meshes:              ${meshCount} (${instancedMeshCount} instanced)`);
console.log(`Vertices / tris:     ${vertexCount.toLocaleString()} / ${triangleCount.toLocaleString()}`);
console.log(`Named nodes:         ${names.size}`);
console.log(`Animation clips:     ${clips.map((clip) => `${clip.name} (${clip.tracks.length} tracks)`).join(', ')}`);
console.log(`Invalid vertices:    ${invalidVertices}`);
console.log(`Missing track nodes: ${missingTracks.length}`);
if (duplicateNames.size) console.log(`Duplicate names:     ${[...duplicateNames].slice(0, 8).join(', ')}`);

if (invalidVertices) throw new Error(`Model contains ${invalidVertices} invalid vertex components.`);
if (missingTracks.length) throw new Error(`Animation tracks reference missing nodes:\n${missingTracks.join('\n')}`);
if (rig.height < 2 || rig.height > 4) throw new Error(`Unexpected model height: ${rig.height}`);
if (bounds.min.y < -0.2) throw new Error(`Model extends too far below ground: ${bounds.min.y}`);
console.log('Result: PASS');
