import * as THREE from 'three';
import { createAtlasMaterials, disposeAtlasMaterials } from './MaterialLibrary.js';

export class DustInspiredMap {
  constructor(scene, config, settings) {
    this.scene=scene;this.config=config;this.settings=settings;this.group=new THREE.Group();this.group.name=config.name;this.raycastTargets=[];
    this.materialLibrary=createAtlasMaterials({anisotropy:settings?.values?.textureQuality==='high'?8:settings?.values?.textureQuality==='medium'?4:2});
    this.materials=this.materialLibrary.materials;
  }
  build() {
    const floorMaterial=this.materials[this.config.floorMaterial]||this.materials.ground;const floor=new THREE.Mesh(new THREE.PlaneGeometry(this.config.size.width,this.config.size.depth),floorMaterial);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.userData.surface=this.config.floorMaterial||'sand';this.group.add(floor);this.raycastTargets.push(floor);
    for(const wall of this.config.walls){const mesh=new THREE.Mesh(new THREE.BoxGeometry(wall.w,wall.h,wall.d),this.materials[wall.material]||this.materials.sandstone);mesh.position.set(wall.x,wall.y,wall.z);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.surface=wall.material||'stone';mesh.userData.solid=true;this.group.add(mesh);this.raycastTargets.push(mesh);}
    this.buildCrates();this.buildLandmarks();
    this.scene.add(this.group);return this;
  }
  buildCrates(){const groups=this.config.crates.reduce((result,crate)=>{const key=crate.material||'wood';(result[key]||=[]).push(crate);return result;},{});for(const [material,crates] of Object.entries(groups)){if(!crates.length)continue;const geo=new THREE.BoxGeometry(1,1,1);const mesh=new THREE.InstancedMesh(geo,this.materials[material]||this.materials.wood,crates.length);const matrix=new THREE.Matrix4();crates.forEach((crate,index)=>{matrix.compose(new THREE.Vector3(crate.x,crate.y,crate.z),new THREE.Quaternion(),new THREE.Vector3(crate.w,crate.h,crate.d));mesh.setMatrixAt(index,matrix);});mesh.castShadow=mesh.receiveShadow=true;mesh.userData.surface=material;mesh.userData.solid=true;this.group.add(mesh);this.raycastTargets.push(mesh);}}
  buildLandmarks(){
    for(const site of this.config.bombSites){const ring=new THREE.Mesh(new THREE.RingGeometry(site.radius*.68,site.radius*.86,32),new THREE.MeshBasicMaterial({color:site.id==='A'?0xbd4d32:0xc28a38,side:THREE.DoubleSide,transparent:true,opacity:.72}));ring.rotation.x=-Math.PI/2;ring.position.set(site.x,.025,site.z);this.group.add(ring);const mark=document.createElement('canvas');mark.width=mark.height=128;const c=mark.getContext('2d');c.fillStyle='rgba(20,20,16,.65)';c.font='bold 84px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(site.id,64,70);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(mark),transparent:true,depthWrite:false}));sprite.position.set(site.x,5,site.z);sprite.scale.set(5,5,1);this.group.add(sprite);}
    for(const ramp of this.config.ramps||[]){let mesh;if(Number.isFinite(ramp.h)&&ramp.direction){const alongX=ramp.direction==='east'||ramp.direction==='west';const run=alongX?ramp.w:ramp.d;const length=Math.hypot(run,ramp.h);mesh=new THREE.Mesh(new THREE.BoxGeometry(alongX?length:ramp.w,.28,alongX?ramp.d:length),this.materials[ramp.material]||this.materials.concrete);const angle=Math.atan2(ramp.h,run);if(alongX)mesh.rotation.z=ramp.direction==='east'?angle:-angle;else mesh.rotation.x=ramp.direction==='north'?angle:-angle;mesh.position.set(ramp.x,ramp.h/2,ramp.z);mesh.userData.surface=ramp.material||'concrete';}else{mesh=new THREE.Mesh(new THREE.BoxGeometry(ramp.w,.6,ramp.d),this.materials.stone);mesh.position.set(ramp.x,.4,ramp.z);mesh.rotation.x=ramp.rotation;}mesh.castShadow=mesh.receiveShadow=true;this.group.add(mesh);this.raycastTargets.push(mesh);}
    if(this.config.custom)return;
    const scale=this.config.scale||1;const archMat=this.materials.stone;for(const [x,z,rotation] of [[0,1,0],[-42,13,Math.PI/2],[18,-31,0]]){const arch=new THREE.Mesh(new THREE.TorusGeometry(3,1.1,6,16,Math.PI),archMat);arch.rotation.set(0,rotation,0);arch.position.set(x*scale,3.8,z*scale);arch.castShadow=true;this.group.add(arch);}
    const signTexture=(text,color)=>{const c=document.createElement('canvas');c.width=256;c.height=96;const x=c.getContext('2d');x.fillStyle='#2b2d26';x.fillRect(0,0,256,96);x.strokeStyle=color;x.lineWidth=5;x.strokeRect(6,6,244,84);x.fillStyle=color;x.font='bold 45px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(text,128,50);return new THREE.CanvasTexture(c);};
    [['A →',0xd76a42,-7,2,17,Math.PI/2],['← B',0xd59a42,-19,2,-5,0]].forEach(([text,color,x,y,z,ry])=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(3.7,1.4),new THREE.MeshBasicMaterial({map:signTexture(text,color)}));m.position.set(x*scale,y,z*scale);m.rotation.y=ry;this.group.add(m);});
  }
  dispose(){this.scene.remove(this.group);this.group.traverse(o=>{o.geometry?.dispose();});disposeAtlasMaterials(this.materialLibrary);}
}
