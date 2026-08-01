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

function createDoodleTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');canvas.width = 512;canvas.height = 256;const context = canvas.getContext('2d');
  const base = context.createLinearGradient(0, 0, 512, 256);base.addColorStop(0, '#15191b');base.addColorStop(.48, '#2b3032');base.addColorStop(1, '#0d1012');context.fillStyle = base;context.fillRect(0, 0, 512, 256);
  context.lineCap = 'round';context.lineJoin = 'round';context.strokeStyle = '#e7e9e6';context.lineWidth = 5;
  for (let index = 0; index < 46; index += 1) {
    const x = 10 + (index * 83) % 486;const y = 12 + (index * 47) % 228;const radius = 8 + (index % 5) * 3;context.beginPath();
    if (index % 4 === 0) { context.arc(x, y, radius, 0, Math.PI * 1.65);context.lineTo(x + radius * .35, y - radius * .2); }
    else if (index % 4 === 1) { context.moveTo(x - radius, y + radius * .4);context.lineTo(x, y - radius);context.lineTo(x + radius, y + radius * .4);context.lineTo(x - radius * .5, y - radius * .15); }
    else if (index % 4 === 2) { for (let step = 0; step < 6; step += 1) { const px = x + step * radius * .38;const py = y + Math.sin(step * 2.2) * radius * .5;if (!step) context.moveTo(px, py);else context.lineTo(px, py); } }
    else { context.rect(x - radius, y - radius * .55, radius * 1.6, radius * 1.1);context.moveTo(x - radius * .7, y);context.lineTo(x + radius * .3, y); }
    context.stroke();
  }
  context.strokeStyle = '#7252d3';context.fillStyle = '#4c2da6';context.lineWidth = 7;
  for (let index = 0; index < 10; index += 1) { const x = 35 + index * 49;const y = 38 + (index % 3) * 73;context.beginPath();context.moveTo(x, y + 18);context.lineTo(x + 13, y - 18);context.lineTo(x + 27, y + 18);context.stroke();if (index % 2) { context.beginPath();context.arc(x + 13, y, 5, 0, Math.PI * 2);context.fill(); } }
  const texture = new THREE.CanvasTexture(canvas);texture.colorSpace = THREE.SRGBColorSpace;texture.wrapS = texture.wrapT = THREE.RepeatWrapping;texture.repeat.set(1.15, 1);texture.anisotropy = 4;return texture;
}

export function createKnifeBladeMaterial(style) {
  if (style.pattern === 'doodle') {
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, map: createDoodleTexture(), metalness: .82, roughness: .27, emissive: 0x100825, emissiveIntensity: .12, flatShading: false });
    material.userData.doodle = true;
    return material;
  }
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
