import * as THREE from 'three';

const horizontalOverlap = (box, x, z, radius = 0) =>
  x + radius > box.minX && x - radius < box.maxX && z + radius > box.minZ && z - radius < box.maxZ;

export class CollisionWorld {
  constructor(config) {
    const boxFor = (object, kind) => ({
      minX: object.x - object.w / 2,
      maxX: object.x + object.w / 2,
      minZ: object.z - object.d / 2,
      maxZ: object.z + object.d / 2,
      minY: object.y - object.h / 2,
      maxY: object.y + object.h / 2,
      material: object.material || (kind === 'crate' ? 'wood' : 'concrete'),
      kind,
      standable: object.standable !== false,
    });
    this.boxes = [
      ...(config.walls || []).map((object) => boxFor(object, 'wall')),
      ...(config.crates || []).map((object) => boxFor(object, 'crate')),
      ...(config.platforms || []).map((object) => boxFor(object, 'platform')),
    ];
    this.ramps = (config.ramps || []).filter((ramp) => Number.isFinite(ramp.h) && ['north', 'south', 'east', 'west'].includes(ramp.direction));
    const fallbackScale = config.scale || 1;
    const width = config.size?.width ?? 123 * fallbackScale;
    const depth = config.size?.depth ?? 122 * fallbackScale;
    const margin = Math.min(2.5, Math.max(.8, Math.min(width, depth) * .02));
    this.bounds = { minX: -width / 2 + margin, maxX: width / 2 - margin, minZ: -depth / 2 + margin, maxZ: depth / 2 - margin };
  }

  moveCircle(position, delta, radius = .55, options = {}) {
    let x = THREE.MathUtils.clamp(position.x, this.bounds.minX + radius, this.bounds.maxX - radius);
    let z = THREE.MathUtils.clamp(position.z, this.bounds.minZ + radius, this.bounds.maxZ - radius);
    const feetY = Number.isFinite(options.feetY) ? options.feetY : Number(position.y) || 0;
    const stepHeight = Number.isFinite(options.stepHeight) ? options.stepHeight : .2;
    const distance = Math.hypot(delta.x, delta.z);
    const steps = Math.max(1, Math.ceil(distance / Math.max(.08, radius * .35)));
    const stepX = delta.x / steps;
    const stepZ = delta.z / steps;
    let blockedX = false;
    let blockedZ = false;
    for (let i = 0; i < steps; i += 1) {
      const nextX = THREE.MathUtils.clamp(x + stepX, this.bounds.minX + radius, this.bounds.maxX - radius);
      if ((nextX === x && stepX !== 0) || this.intersects(nextX, z, radius, feetY, stepHeight)) blockedX = blockedX || stepX !== 0;
      else x = nextX;
      const nextZ = THREE.MathUtils.clamp(z + stepZ, this.bounds.minZ + radius, this.bounds.maxZ - radius);
      if ((nextZ === z && stepZ !== 0) || this.intersects(x, nextZ, radius, feetY, stepHeight)) blockedZ = blockedZ || stepZ !== 0;
      else z = nextZ;
    }
    return { x, z, blockedX, blockedZ, blocked: blockedX || blockedZ };
  }

  intersects(x, z, radius = .55, feetY = 0, stepHeight = .2, bodyHeight = 1.8) {
    return this.boxes.some((box) => horizontalOverlap(box, x, z, radius)
      && box.maxY > feetY + stepHeight
      && box.minY < feetY + bodyHeight);
  }

  findMantle(position, direction, radius = .58, maxRise = 6.2) {
    const planar = new THREE.Vector2(direction.x, direction.z);
    if (planar.lengthSq() < .01) return null;
    planar.normalize();
    const probes = [radius + .3, radius + .65, radius + 1];
    const candidates = [];
    for (const distance of probes) {
      const probeX = position.x + planar.x * distance;
      const probeZ = position.z + planar.y * distance;
      for (const box of this.boxes) {
        if (!box.standable || !horizontalOverlap(box, probeX, probeZ, radius * .42)) continue;
        const rise = box.maxY - position.y;
        if (rise < .35 || rise > maxRise) continue;
        const margin = Math.min(radius + .08, Math.max(.12, (box.maxX - box.minX) * .24), Math.max(.12, (box.maxZ - box.minZ) * .24));
        const targetX = THREE.MathUtils.clamp(probeX, box.minX + margin, box.maxX - margin);
        const targetZ = THREE.MathUtils.clamp(probeZ, box.minZ + margin, box.maxZ - margin);
        const blockedAbove = this.boxes.some((other) => other !== box && horizontalOverlap(other, targetX, targetZ, radius * .72)
          && other.maxY > box.maxY + .15 && other.minY < box.maxY + 1.8);
        if (!blockedAbove) candidates.push({ x: targetX, z: targetZ, y: box.maxY, rise, box });
      }
      if (candidates.length) break;
    }
    return candidates.sort((a, b) => a.rise - b.rise)[0] || null;
  }

  segmentBlocked(a, b, maxHeight = 2) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const distance = Math.hypot(dx, dz);
    const steps = Math.max(2, Math.ceil(distance / .7));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const x = a.x + dx * t;
      const z = a.z + dz * t;
      if (this.boxes.some((box) => x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ && box.minY < maxHeight)) return true;
    }
    return false;
  }

  groundHeightAt(x, z, maxReach = Infinity) {
    let height = 0;
    for (const box of this.boxes) {
      if (box.standable && box.maxY <= maxReach + .001 && horizontalOverlap(box, x, z)) height = Math.max(height, box.maxY);
    }
    for (const ramp of this.ramps) {
      const minX = ramp.x - ramp.w / 2; const maxX = ramp.x + ramp.w / 2;
      const minZ = ramp.z - ramp.d / 2; const maxZ = ramp.z + ramp.d / 2;
      if (x < minX || x > maxX || z < minZ || z > maxZ) continue;
      let progress = 0;
      if (ramp.direction === 'north') progress = (maxZ - z) / ramp.d;
      else if (ramp.direction === 'south') progress = (z - minZ) / ramp.d;
      else if (ramp.direction === 'east') progress = (x - minX) / ramp.w;
      else progress = (maxX - x) / ramp.w;
      const rampHeight = ramp.h * THREE.MathUtils.clamp(progress, 0, 1);
      height = Math.max(height, rampHeight);
    }
    return height;
  }

  surfaceAt(x, z) {
    const ramp = this.ramps.find((item) => x >= item.x - item.w / 2 && x <= item.x + item.w / 2 && z >= item.z - item.d / 2 && z <= item.z + item.d / 2);
    if (ramp) return ramp.material || 'concrete';
    const hits = this.boxes.filter((box) => horizontalOverlap(box, x, z)).sort((a, b) => b.maxY - a.maxY);
    return hits[0]?.material || (Math.abs(x) > 45 ? 'sand' : 'stone');
  }
}
