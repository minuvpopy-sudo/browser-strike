import * as THREE from 'three';

export class CollisionWorld {
  constructor(config) {
    this.boxes = [...config.walls, ...config.crates].map((o) => ({ minX:o.x-o.w/2,maxX:o.x+o.w/2,minZ:o.z-o.d/2,maxZ:o.z+o.d/2,minY:o.y-o.h/2,maxY:o.y+o.h/2,material:o.material||'wood' }));
    this.ramps=(config.ramps||[]).filter((ramp)=>Number.isFinite(ramp.h)&&['north','south','east','west'].includes(ramp.direction));
    const fallbackScale=config.scale||1;const width=config.size?.width??123*fallbackScale,depth=config.size?.depth??122*fallbackScale;
    const margin=Math.min(2.5,Math.max(.8,Math.min(width,depth)*.02));this.bounds = { minX:-width/2+margin,maxX:width/2-margin,minZ:-depth/2+margin,maxZ:depth/2-margin };
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
  groundHeightAt(x,z) {
    let height=0;
    for(const ramp of this.ramps){const minX=ramp.x-ramp.w/2,maxX=ramp.x+ramp.w/2,minZ=ramp.z-ramp.d/2,maxZ=ramp.z+ramp.d/2;if(x<minX||x>maxX||z<minZ||z>maxZ)continue;let progress=0;if(ramp.direction==='north')progress=(maxZ-z)/ramp.d;else if(ramp.direction==='south')progress=(z-minZ)/ramp.d;else if(ramp.direction==='east')progress=(x-minX)/ramp.w;else progress=(maxX-x)/ramp.w;height=Math.max(height,ramp.h*THREE.MathUtils.clamp(progress,0,1));}return height;
  }
  surfaceAt(x,z) { const ramp=this.ramps.find((item)=>x>=item.x-item.w/2&&x<=item.x+item.w/2&&z>=item.z-item.d/2&&z<=item.z+item.d/2);if(ramp)return ramp.material||'concrete';const hit=this.boxes.find((b)=>x>b.minX&&x<b.maxX&&z>b.minZ&&z<b.maxZ); return hit?.material || (Math.abs(x)>45?'sand':'stone'); }
}
