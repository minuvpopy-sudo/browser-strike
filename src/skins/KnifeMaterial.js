import * as THREE from 'three';

function createWaveTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  const base = context.createLinearGradient(0, 0, 256, 256);
  base.addColorStop(0, '#01040a');
  base.addColorStop(.45, '#06142d');
  base.addColorStop(1, '#02050c');
  context.fillStyle = base;
  context.fillRect(0, 0, 256, 256);

  for (let wave = -2; wave < 9; wave++) {
    context.beginPath();
    for (let x = -24; x <= 280; x += 5) {
      const y = wave * 34 + Math.sin(x * .045 + wave * .9) * 18 + x * .2;
      if (x === -24) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.strokeStyle = wave % 2 ? 'rgba(16,83,216,.68)' : 'rgba(30,158,255,.82)';
    context.lineWidth = wave % 2 ? 13 : 7;
    context.shadowColor = '#087cff';
    context.shadowBlur = 10;
    context.stroke();
    context.shadowBlur = 0;
    context.strokeStyle = 'rgba(125,211,255,.38)';
    context.lineWidth = 2;
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.25, 1.55);
  texture.center.set(.5, .5);
  return texture;
}

export function createKnifeBladeMaterial(style) {
  if (style.pattern !== 'waves') {
    return new THREE.MeshStandardMaterial({ color: style.blade, metalness: .88, roughness: .22, flatShading: true });
  }
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createWaveTexture(),
    metalness: .9,
    roughness: .2,
    emissive: 0x031942,
    emissiveIntensity: .27,
    flatShading: true
  });
  material.userData.animatedWaves = true;
  return material;
}

export function collectKnifeWaveMaterials(root) {
  const visited = new Set();
  const result = [];
  root.traverse((object) => {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material?.userData?.animatedWaves || visited.has(material)) continue;
      visited.add(material);
      result.push(material);
    }
  });
  return result;
}

export function animateKnifeWaves(materials, elapsed) {
  if (!materials || typeof materials[Symbol.iterator] !== 'function') return;
  for (const material of materials) {
    if (material.map) {
      material.map.offset.x = (elapsed * .035) % 1;
      material.map.offset.y = Math.sin(elapsed * .65) * .035;
      material.map.rotation = Math.sin(elapsed * .3) * .025;
    }
    material.emissiveIntensity = .22 + (Math.sin(elapsed * 1.6) + 1) * .065;
  }
}

export function disposeKnifeMaterial(material) {
  material?.map?.dispose();
  material?.dispose();
}
