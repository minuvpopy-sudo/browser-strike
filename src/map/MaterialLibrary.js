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
  return material;
}

export function createAtlasMaterials({ anisotropy = 4 } = {}) {
  const source = document.createElement('img');source.decoding='async';const tiles=new Map();const materials={};
  for(const [id,cell] of Object.entries(MATERIAL_ATLAS_CELLS)){
    const key=cell.join(':');let tile=tiles.get(key);
    if(!tile){const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const context=canvas.getContext('2d');context.fillStyle='#77736b';context.fillRect(0,0,256,256);const texture=new THREE.CanvasTexture(canvas);texture.name=`workshop-material-${key}`;texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.anisotropy=anisotropy;tile={cell,context,texture};tiles.set(key,tile);}
    materials[id]=atlasMaterial(tile.texture,id,cell);
  }
  source.addEventListener('load',()=>{const width=source.naturalWidth/4,height=source.naturalHeight/4;for(const {cell,context,texture} of tiles.values()){context.clearRect(0,0,256,256);context.drawImage(source,cell[0]*width,cell[1]*height,width,height,0,0,256,256);texture.needsUpdate=true;}});
  source.src=MATERIAL_ATLAS_URL;
  return { source, textures:[...tiles.values()].map((tile)=>tile.texture), materials };
}

export function disposeAtlasMaterials(library) {
  if (!library) return;
  for (const material of new Set(Object.values(library.materials || {}))) material.dispose();
  for(const texture of library.textures||[])texture.dispose();
  if(library.source)library.source.src='';
}
