import * as THREE from 'three';

export function registerSecondary(rig, object, kind, options = {}) {
  const descriptor = {
    object,
    kind,
    phase: options.phase ?? rig.secondary.length * 0.73,
    weight: options.weight ?? 1,
    baseRotation: object.rotation.clone(),
    basePosition: object.position.clone(),
  };
  rig.secondary.push(descriptor);
  return object;
}

export function makeGroup(parent, name, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(...position);
  group.rotation.set(...rotation);
  if (parent) parent.add(group);
  return group;
}

export function mirroredPoints(points, side) {
  return points.map(([x, y]) => [x * side, y]);
}
