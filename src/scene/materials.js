import * as THREE from 'three';

function standard(color, metalness, roughness, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    envMapIntensity: 1.15,
    ...extra,
  });
}

export function createMaterials(textures = {}) {
  const metalGrain = textures.metalGrain || null;
  const metalSurface = metalGrain
    ? { bumpMap: metalGrain, bumpScale: 0.004 }
    : {};

  const materials = {
    steel: standard(0x303338, 0.94, 0.29, metalSurface),
    steelBright: standard(0x666b70, 0.96, 0.2, metalSurface),
    steelDark: standard(0x171a1e, 0.88, 0.38, metalSurface),
    steelBlue: standard(0x252b32, 0.92, 0.27, metalSurface),
    wingSteel: standard(0x171a1e, 0.62, 0.68, { envMapIntensity: 0.24, ...metalSurface }),
    scale: standard(0x34383d, 0.86, 0.46, { ...metalSurface, envMapIntensity: 0.55 }),
    blackLeather: standard(0x111114, 0.12, 0.76, metalSurface),
    leather: standard(0x251b1a, 0.08, 0.82),
    cloth: standard(0x181719, 0.02, 0.94),
    redTrim: standard(0x751417, 0.68, 0.38),
    glowTrim: standard(0xa52720, 0.5, 0.38, {
      emissive: 0xb8291c,
      emissiveIntensity: 0.55,
    }),
    redDark: standard(0x3a090d, 0.32, 0.56),
    redCloth: standard(0x511016, 0.02, 0.9, {
      map: textures.cape || null,
      side: THREE.DoubleSide,
      roughness: 0.88,
    }),
    brass: standard(0xa87b3f, 0.86, 0.29, metalSurface),
    darkBrass: standard(0x58402a, 0.8, 0.42),
    gold: standard(0xd3a963, 0.95, 0.22),
    skin: standard(0xb79483, 0.0, 0.72),
    skinShadow: standard(0x5d3a38, 0.0, 0.9),
    hair: standard(0xc9c4b7, 0.05, 0.56),
    hairDark: standard(0x77736c, 0.05, 0.72),
    fur: standard(0xc3c0b4, 0.0, 0.95),
    plumeDark: standard(0x171315, 0.02, 0.92),
    plumeRed: standard(0x9c1d1c, 0.0, 0.84),
    ruby: standard(0x8e1013, 0.25, 0.16, {
      emissive: 0xae1d16,
      emissiveIntensity: 0.8,
    }),
    ember: new THREE.MeshStandardMaterial({
      color: 0xff5a20,
      emissive: 0xff3a10,
      emissiveIntensity: 2.7,
      roughness: 0.7,
    }),
    shieldFace: standard(0xffffff, 0.22, 0.78, {
      map: textures.sigil || null,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
    engraving: new THREE.MeshBasicMaterial({
      color: 0xd8d1c1,
      map: textures.engraving || null,
      transparent: true,
      opacity: textures.engraving ? 0.58 : 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    }),
    stone: standard(0x343337, 0.05, 0.93, {
      map: textures.stone || null,
      bumpMap: textures.stone || null,
      bumpScale: 0.025,
    }),
    stoneDark: standard(0x1d1c20, 0.06, 0.96, {
      map: textures.stone || null,
    }),
    stoneWarm: standard(0x3c3430, 0.03, 0.98, {
      map: textures.stone || null,
    }),
    banner: standard(0xffffff, 0.0, 0.96, {
      map: textures.banner || null,
      side: THREE.DoubleSide,
    }),
    ringGlow: new THREE.MeshBasicMaterial({
      color: 0x7e1715,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    flame: new THREE.PointsMaterial({
      color: 0xff6a2a,
      size: 0.17,
      map: textures.flame || null,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  };

  materials.redCloth.color.set(textures.cape ? 0xffffff : 0x511016);
  materials.shieldFace.color.set(textures.sigil ? 0xffffff : 0x5b1114);
  materials.banner.color.set(textures.banner ? 0xffffff : 0x301012);
  materials.engraving.opacity = textures.engraving ? 0.58 : 0.0;
  return materials;
}
