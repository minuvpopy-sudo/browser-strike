import * as THREE from 'three';
export class BulletImpactPool {
  constructor(scene,max=32){this.scene=scene;this.items=[];const geo=new THREE.CircleGeometry(.045,7);for(let i=0;i<max;i++){const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0x28231c,polygonOffset:true,polygonOffsetFactor:-1}));mesh.visible=false;scene.add(mesh);this.items.push({mesh,life:0});}this.index=0;}
  spawn(point,normal,surface='stone'){const item=this.items[this.index++%this.items.length];item.mesh.visible=true;item.mesh.position.copy(point).addScaledVector(normal,.012);item.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);item.mesh.material.color.set(surface==='metal'?0xb6a476:surface==='wood'?0x24170f:0x322a21);item.life=10;}
  update(dt){for(const item of this.items){if(item.life>0&&(item.life-=dt)<=0)item.mesh.visible=false;}}
  dispose(){for(const i of this.items){this.scene.remove(i.mesh);i.mesh.geometry.dispose();i.mesh.material.dispose();}}
}
