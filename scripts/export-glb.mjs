import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createMaterials } from '../src/scene/materials.js';
import { createDragonKnight } from '../src/scene/character/index.js';
import { createExportAnimations } from '../src/scene/export.js';

class NodeFileReader {
  constructor() {
    this.result = null;
    this.error = null;
    this.onloadend = null;
    this.onerror = null;
  }

  readAsArrayBuffer(blob) {
    blob.arrayBuffer()
      .then((buffer) => {
        this.result = buffer;
        if (this.onloadend) this.onloadend({ target: this });
      })
      .catch((error) => {
        this.error = error;
        if (this.onerror) this.onerror({ target: this, error });
        else throw error;
      });
  }

  readAsDataURL(blob) {
    blob.arrayBuffer()
      .then((buffer) => {
        const base64 = Buffer.from(buffer).toString('base64');
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
        if (this.onloadend) this.onloadend({ target: this });
      })
      .catch((error) => {
        this.error = error;
        if (this.onerror) this.onerror({ target: this, error });
        else throw error;
      });
  }
}

if (!globalThis.FileReader) globalThis.FileReader = NodeFileReader;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(__dirname, '../public/models/dragon-knight.glb');
const infoPath = path.resolve(__dirname, '../public/models/dragon-knight.info.json');
const materials = createMaterials({});
const { root, rig } = createDragonKnight(materials);
root.name = 'DragonKnight';
root.updateMatrixWorld(true);

const exporter = new GLTFExporter();
const animations = createExportAnimations();
const glb = await exporter.parseAsync(root, {
  binary: true,
  onlyVisible: true,
  trs: true,
  animations,
  includeCustomExtensions: true,
  maxTextureSize: 1024,
});

let meshCount = 0;
let vertexCount = 0;
let triangleCount = 0;
root.traverse((object) => {
  if (!object.isMesh && !object.isInstancedMesh) return;
  meshCount += 1;
  const geometry = object.geometry;
  const positions = geometry?.attributes?.position;
  if (positions) vertexCount += positions.count * (object.isInstancedMesh ? object.count : 1);
  const indices = geometry?.index?.count || positions?.count || 0;
  triangleCount += Math.floor(indices / 3) * (object.isInstancedMesh ? object.count : 1);
});

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, Buffer.from(glb));
await writeFile(infoPath, `${JSON.stringify({
  name: 'The Dragon Knight',
  generator: 'Tarama procedural character pipeline',
  forwardAxis: '+Z',
  heightMeters: Number(rig.height.toFixed(3)),
  meshCount,
  vertexCount,
  triangleCount,
  animationClips: animations.map((clip) => ({ name: clip.name, duration: clip.duration, tracks: clip.tracks.length })),
  notes: 'Portable texture-free GLB. Use the in-app Export button for the fully textured browser version.',
}, null, 2)}\n`);

console.log(`Wrote ${path.relative(process.cwd(), outputPath)} (${(glb.byteLength / 1024 / 1024).toFixed(2)} MB)`);
console.log(`${meshCount} meshes · ${vertexCount.toLocaleString()} vertices · ${triangleCount.toLocaleString()} triangles · ${animations.length} clips`);
