import * as THREE from 'three';

export class CollisionWorld {
  constructor(config) {
    this.boxes = [...config.walls, ...config.crates].map((o) => ({ minX:o.x-o.w/2,maxX:o.x+o.w/2,minZ:o.z-o.d/2,maxZ:o.z+o.d/2,minY:o.y-o.h/2,maxY:o.y+o.h/2,material:o.material||'wood' }));
    const scale=config.scale||1;this.bounds = { minX:-61.5*scale,maxX:61.5*scale,minZ:-55.5*scale,maxZ:55.5*scale };
  }
  moveCircle(position, delta, radius = .55) {
    let x = THREE.MathUtils.clamp(position.x + delta.x, this.bounds.minX + radius, this.bounds.maxX - radius);
    let z = position.z;
    if (this.intersects(x, z, radius)) x = position.x;
    z = THREE.MathUtils.clamp(position.z + delta.z, this.bounds.minZ + radius, this.bounds.maxZ - radius);
    if (this.intersects(x, z, radius)) z = position.z;
    return { x, z, blocked: x === position.x && z === position.z && (delta.x !== 0 || delta.z !== 0) };
  }
  intersects(x,z,radius=.55) { return this.boxes.some((b)=>x+radius>b.minX&&x-radius<b.maxX&&z+radius>b.minZ&&z-radius<b.maxZ&&b.maxY>.2); }
  segmentBlocked(a,b,maxHeight=2) {
    const dx=b.x-a.x,dz=b.z-a.z; const distance=Math.hypot(dx,dz); const steps=Math.max(2,Math.ceil(distance/.7));
    for(let i=1;i<steps;i++){const t=i/steps;const x=a.x+dx*t,z=a.z+dz*t;if(this.boxes.some((box)=>x>box.minX&&x<box.maxX&&z>box.minZ&&z<box.maxZ&&box.minY<maxHeight))return true;}
    return false;
  }
  surfaceAt(x,z) { const hit=this.boxes.find((b)=>x>b.minX&&x<b.maxX&&z>b.minZ&&z<b.maxZ); return hit?.material || (Math.abs(x)>45?'sand':'stone'); }
}
