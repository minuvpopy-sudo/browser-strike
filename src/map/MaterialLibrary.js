import * as THREE from 'three';

export const MATERIAL_ATLAS_URL = new URL('../assets/workshop-material-atlas.jpg', import.meta.url).href;

export const MATERIAL_ATLAS_CELLS = Object.freeze({
  darkConcrete: [0, 0], plaster: [1, 0], whiteBrick: [2, 0], redBand: [3, 0],
  metal: [0, 1], blueMetal: [1, 1], masonry: [2, 1], concrete: [3, 1],
  asphalt: [0, 2], brick: [1, 2], wood: [2, 2], tile: [3, 2],
  grass: [0, 3], sandstone: [1, 3], tech: [2, 3], dust: [3, 3],
  stone: [2, 1], ice: [3, 2], ground: [3, 3]
});

const MATERIAL_PROPERTIES = Object.freeze({
  metal: { roughness: .48, metalness: .52 }, blueMetal: { roughness: .5, metalness: .48 },
  tech: { roughness: .46, metalness: .58 }, ice: { roughness: .3 }, tile: { roughness: .62 },
  asphalt: { roughness: 1 }, ground: { roughness: 1 }, dust: { roughness: 1 },
  grass: { color: 0xa6b59a, roughness: 1 }
});

function atlasMaterial(texture, id, cell) {
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff,
    roughness: .94,
    metalness: .02,
    ...(MATERIAL_PROPERTIES[id] || {})
  });
  const [column, row] = cell;
  material.userData.atlasCell = { column, row };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.atlasOffset = { value: new THREE.Vector2(column * .25, (3 - row) * .25) };
    shader.uniforms.atlasScale = { value: new THREE.Vector2(.25, .25) };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nuniform vec2 atlasOffset;\nuniform vec2 atlasScale;')
      .replace('texture2D( map, vMapUv )', 'texture2D( map, atlasOffset + clamp( vMapUv, vec2( 0.008 ), vec2( 0.992 ) ) * atlasScale )');
  };
  material.customProgramCacheKey = () => `browser-strike-atlas-${column}-${row}`;
  return material;
}

export function createAtlasMaterials({ anisotropy = 4 } = {}) {
  const texture = new THREE.TextureLoader().load(MATERIAL_ATLAS_URL);
  texture.name = 'workshop-material-atlas';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = anisotropy;
  const materials = Object.fromEntries(Object.entries(MATERIAL_ATLAS_CELLS).map(([id, cell]) => [id, atlasMaterial(texture, id, cell)]));
  return { texture, materials };
}

export function disposeAtlasMaterials(library) {
  if (!library) return;
  for (const material of new Set(Object.values(library.materials || {}))) material.dispose();
  library.texture?.dispose();
}
