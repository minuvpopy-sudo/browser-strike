import * as THREE from 'three';

export class CollisionWorld {
  constructor(config) {
    this.boxes = [...config.walls, ...config.crates].map((o) => ({ minX:o.x-o.w/2,maxX:o.x+o.w/2,minZ:o.z-o.d/2,maxZ:o.z+o.d/2,minY:o.y-o.h/2,maxY:o.y+o.h/2,material:o.material||'wood' }));
    const scale=config.scale||1;this.bounds = { minX:-61.5*scale,maxX:61.5*scale,minZ:-55.5*scale,maxZ:55.5*scale };
  }
  moveCircle(position, delta, radius = .55) {
    let x = THREE.MathUtils.clamp(position.x, this.bounds.minX + radius, this.bounds.maxX - radius);
    let z = THREE.MathUtils.clamp(position.z, this.bounds.minZ + radius, this.bounds.maxZ - radius);
    const distance = Math.hypot(delta.x, delta.z);
    const steps = Math.max(1, Math.ceil(distance / Math.max(.08, radius * .35)));
    const stepX = delta.x / steps;
    const stepZ = delta.z / steps;
    let blockedX = false;
    let blockedZ = false;
    for (let i = 0; i < steps; i++) {
      const nextX = THREE.MathUtils.clamp(x + stepX, this.bounds.minX + radius, this.bounds.maxX - radius);
      if ((nextX === x && stepX !== 0) || this.intersects(nextX, z, radius)) blockedX = blockedX || stepX !== 0;
      else x = nextX;
      const nextZ = THREE.MathUtils.clamp(z + stepZ, this.bounds.minZ + radius, this.bounds.maxZ - radius);
      if ((nextZ === z && stepZ !== 0) || this.intersects(x, nextZ, radius)) blockedZ = blockedZ || stepZ !== 0;
      else z = nextZ;
    }
    return { x, z, blockedX, blockedZ, blocked: blockedX && blockedZ };
  }
  intersects(x,z,radius=.55) { return this.boxes.some((b)=>x+radius>b.minX&&x-radius<b.maxX&&z+radius>b.minZ&&z-radius<b.maxZ&&b.maxY>.2); }
  segmentBlocked(a,b,maxHeight=2) {
    const dx=b.x-a.x,dz=b.z-a.z; const distance=Math.hypot(dx,dz); const steps=Math.max(2,Math.ceil(distance/.7));
    for(let i=1;i<steps;i++){const t=i/steps;const x=a.x+dx*t,z=a.z+dz*t;if(this.boxes.some((box)=>x>box.minX&&x<box.maxX&&z>box.minZ&&z<box.maxZ&&box.minY<maxHeight))return true;}
    return false;
  }
  surfaceAt(x,z) { const hit=this.boxes.find((b)=>x>b.minX&&x<b.maxX&&z>b.minZ&&z<b.maxZ); return hit?.material || (Math.abs(x)>45?'sand':'stone'); }
}
