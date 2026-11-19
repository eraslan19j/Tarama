import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { seededRandom } from './textures.js';

export function roundedBox(width, height, depth, radius = 0.025, segments = 3) {
  return new RoundedBoxGeometry(width, height, depth, segments, Math.min(radius, width / 2, height / 2, depth / 2));
}

export function addMesh(parent, geometry, material, options = {}) {
  const {
    name = '',
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    castShadow = true,
    receiveShadow = true,
  } = options;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  parent.add(mesh);
  return mesh;
}

export function shapeFromPoints(points) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  return shape;
}

export function plateGeometry(points, depth = 0.055, bevel = 0.01) {
  const geometry = new THREE.ExtrudeGeometry(shapeFromPoints(points), {
    depth,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 8,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

export function addPlate(parent, points, material, options = {}) {
  const { depth = 0.055, bevel = 0.01, ...meshOptions } = options;
  return addMesh(parent, plateGeometry(points, depth, bevel), material, meshOptions);
}

export function tubeFromPoints(parent, points, radius, material, options = {}) {
  const {
    closed = false,
    tubularSegments = Math.max(24, points.length * 5),
    radialSegments = 6,
    name = '',
    ...meshOptions
  } = options;
  const vectors = points.map((point) => new THREE.Vector3(point[0], point[1], point[2] ?? 0));
  const curve = new THREE.CatmullRomCurve3(vectors, closed, 'centripetal', 0.35);
  const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed);
  return addMesh(parent, geometry, material, { name, ...meshOptions });
}

export function outlineTube(parent, points, z, radius, material, name = '') {
  const mapped = points.map(([x, y]) => [x, y, z]);
  return tubeFromPoints(parent, mapped, radius, material, { closed: true, name });
}

export function addRivets(parent, points, material, radius = 0.012, name = 'Rivets') {
  const geometry = new THREE.SphereGeometry(radius, 8, 6);
  const mesh = new THREE.InstancedMesh(geometry, material, points.length);
  mesh.name = name;
  const dummy = new THREE.Object3D();
  points.forEach((p, index) => {
    dummy.position.set(p[0], p[1], p[2] ?? 0);
    dummy.scale.set(1, 1, 0.55);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function createShieldShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.39, 0.47);
  shape.quadraticCurveTo(-0.30, 0.56, 0, 0.58);
  shape.quadraticCurveTo(0.30, 0.56, 0.39, 0.47);
  shape.lineTo(0.36, -0.23);
  shape.quadraticCurveTo(0.24, -0.52, 0, -0.70);
  shape.quadraticCurveTo(-0.24, -0.52, -0.36, -0.23);
  shape.closePath();
  return shape;
}

export function createShapeFaceGeometry(shape, curveSegments = 32) {
  const geometry = new THREE.ShapeGeometry(shape, curveSegments);
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const width = max.x - min.x || 1;
  const height = max.y - min.y || 1;
  const positions = geometry.attributes.position;
  const uvs = geometry.attributes.uv;
  for (let i = 0; i < positions.count; i += 1) {
    uvs.setXY(
      i,
      (positions.getX(i) - min.x) / width,
      (positions.getY(i) - min.y) / height,
    );
  }
  uvs.needsUpdate = true;
  return geometry;
}

export function createCapeGeometry({
  columns = 19,
  rows = 25,
  height = 1.48,
  topHalfWidth = 0.34,
  bottomHalfWidth = 0.76,
  seed = 2701,
} = {}) {
  const rng = seededRandom(seed);
  const positions = new Float32Array(columns * rows * 3);
  const uvs = new Float32Array(columns * rows * 2);
  const indices = [];
  const uValues = new Float32Array(columns * rows);
  const vValues = new Float32Array(columns * rows);
  const hemNoise = Array.from({ length: columns }, () => (rng() - 0.5) * 0.14);

  for (let row = 0; row < rows; row += 1) {
    const v = row / (rows - 1);
    const halfWidth = THREE.MathUtils.lerp(topHalfWidth, bottomHalfWidth, Math.pow(v, 0.78))
      + Math.sin(v * Math.PI * 2.2) * 0.025;
    for (let col = 0; col < columns; col += 1) {
      const u = col / (columns - 1);
      const index = row * columns + col;
      const hemInfluence = Math.max(0, (v - 0.86) / 0.14);
      const x = (u - 0.5) * 2 * halfWidth;
      const y = -v * height + hemInfluence * hemNoise[col];
      const z = -0.02 - 0.11 * v
        + Math.cos(u * Math.PI * 6) * 0.024 * (0.25 + v)
        + Math.sin(v * Math.PI) * 0.025;
      positions[index * 3] = x;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = z;
      uvs[index * 2] = u;
      uvs[index * 2 + 1] = 1 - v;
      uValues[index] = u;
      vValues[index] = v;
    }
  }

  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < columns - 1; col += 1) {
      const a = row * columns + col;
      const b = a + 1;
      const d = (row + 1) * columns + col;
      const e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.cape = {
    base: positions.slice(),
    u: uValues,
    v: vValues,
    height,
  };
  return geometry;
}

export function traverseAndEnableShadows(root) {
  root.traverse((object) => {
    if (!object.isMesh && !object.isInstancedMesh) return;
    object.castShadow = object.castShadow !== false;
    object.receiveShadow = object.receiveShadow !== false;
  });
}
