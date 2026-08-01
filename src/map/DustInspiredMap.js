import * as THREE from 'three';
import { createAtlasMaterials, disposeAtlasMaterials } from './MaterialLibrary.js';

export const MAIN_SAND_TEXTURE_URL = new URL('../assets/sand-ground.jpg', import.meta.url).href;

function loadedSurfaceTexture(url, repeatX, repeatY, anisotropy = 2) {
  const texture=new THREE.TextureLoader().load(url);texture.name='main-map-sand';texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(repeatX,repeatY);texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.anisotropy=anisotropy;return texture;
}

function canvasTexture(base, accent, type = 'stone') {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128; const ctx = canvas.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0,0,128,128);
  const seed = type.length * 171;
  for (let i=0;i<360;i++) { const x=(i*47+seed)%128,y=(i*83+seed)%128,size=1+(i%4); ctx.fillStyle=`${accent}${24+(i%30).toString(16).padStart(2,'0')}`;ctx.fillRect(x,y,size,size); }
  if(type==='stone'){ctx.strokeStyle='#806c4a77';ctx.lineWidth=2;for(let y=0;y<128;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y);ctx.stroke();}for(let x=0;x<128;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,128);ctx.stroke();}}
  if(type==='wood'){ctx.strokeStyle='#25180d88';for(let x=5;x<128;x+=18){ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+8,40,x-5,80,x+4,128);ctx.stroke();}}
  if(type==='brick'){ctx.strokeStyle='#2b171188';ctx.lineWidth=3;for(let y=0;y<128;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y);ctx.stroke();for(let x=(y/24%2)*28;x<128;x+=56){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+24);ctx.stroke();}}}
  if(type==='concrete'){ctx.strokeStyle='#d8ddd833';for(let i=0;i<18;i++){ctx.beginPath();ctx.arc((i*37)%128,(i*61)%128,2+i%5,0,Math.PI*2);ctx.stroke();}}
  if(type==='tech'){ctx.strokeStyle='#63b6c655';ctx.lineWidth=2;for(let y=8;y<128;y+=32){ctx.strokeRect(6,y,116,22);ctx.fillStyle='#72d9e044';ctx.fillRect(14,y+7,24,5);}}
  if(type==='grass'){ctx.strokeStyle='#9cba6b55';for(let i=0;i<90;i++){const x=(i*41)%128,y=(i*73)%128;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(i%3)-1,y-5-i%4);ctx.stroke();}}
  if(type==='ice'){ctx.strokeStyle='#e8ffff77';for(let i=0;i<20;i++){const x=(i*31)%128,y=(i*47)%128;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+18,y-12);ctx.lineTo(x+28,y+5);ctx.stroke();}}
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS=texture.wrapT=THREE.RepeatWrapping; texture.colorSpace=THREE.SRGBColorSpace; return texture;
}

function gateDoorTexture() {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const context=canvas.getContext('2d');
  const wood=context.createLinearGradient(0,0,512,0);wood.addColorStop(0,'#4a2b18');wood.addColorStop(.5,'#8a5a31');wood.addColorStop(1,'#3d2416');context.fillStyle=wood;context.fillRect(0,0,512,512);
  for(let plank=0;plank<8;plank++){const x=plank*64;context.fillStyle=plank%2?'#2a170d55':'#d0985c22';context.fillRect(x,0,64,512);context.strokeStyle='#1e130dcc';context.lineWidth=5;context.beginPath();context.moveTo(x,0);context.lineTo(x,512);context.stroke();for(let knot=0;knot<3;knot++){context.strokeStyle='#26160ca8';context.lineWidth=4;context.beginPath();context.ellipse(x+20+(knot*31)%43,75+knot*158+(plank%3)*19,12,5,plank*.2,0,Math.PI*2);context.stroke();}}
  context.fillStyle='#252b28';context.fillRect(0,62,512,34);context.fillRect(0,408,512,34);context.save();context.translate(256,256);context.rotate(-.63);context.fillRect(-330,-17,660,34);context.restore();
  context.fillStyle='#9b8b6a';for(const y of [79,425])for(let x=28;x<512;x+=57){context.beginPath();context.arc(x,y,6,0,Math.PI*2);context.fill();}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;return texture;
}

export class DustInspiredMap {
  constructor(scene, config, settings) {
    this.scene=scene;this.config=config;this.settings=settings;this.group=new THREE.Group();this.group.name=config.name;this.raycastTargets=[];
    this.materialLibrary=config.custom?createAtlasMaterials({anisotropy:settings?.values?.textureQuality==='high'?4:2}):null;
    this.materials=this.materialLibrary?.materials||{
      sandstone:new THREE.MeshStandardMaterial({map:loadedSurfaceTexture(MAIN_SAND_TEXTURE_URL,4,4,settings?.values?.textureQuality==='high'?4:2),roughness:.96,color:0xffffff}),
      stone:new THREE.MeshStandardMaterial({map:canvasTexture('#806e51','#dac58f','stone'),roughness:1}),
      wood:new THREE.MeshStandardMaterial({map:canvasTexture('#755031','#d3a15f','wood'),roughness:.86}),
      metal:new THREE.MeshStandardMaterial({color:0x4c5550,roughness:.55,metalness:.65}),
      gateDoor:new THREE.MeshStandardMaterial({map:gateDoorTexture(),color:0xffffff,roughness:.78,metalness:.08}),
      brick:new THREE.MeshStandardMaterial({map:canvasTexture('#7d3f30','#d98462','brick'),roughness:.95}),
      concrete:new THREE.MeshStandardMaterial({map:canvasTexture('#777d79','#e2e7e1','concrete'),roughness:1}),
      tech:new THREE.MeshStandardMaterial({map:canvasTexture('#203940','#65d8e0','tech'),roughness:.42,metalness:.55,emissive:0x071b20}),
      grass:new THREE.MeshStandardMaterial({map:canvasTexture('#49633b','#9fc27a','grass'),roughness:1}),
      ice:new THREE.MeshStandardMaterial({map:canvasTexture('#7aaabd','#e8ffff','ice'),roughness:.2,metalness:.08,transparent:true,opacity:.9}),
      ground:new THREE.MeshStandardMaterial({map:canvasTexture('#b09667','#ddc88e','sand'),roughness:1,color:0xffffff})
    };
  }
  build() {
    const floorMaterial=this.materials[this.config.floorMaterial]||this.materials.ground;const floor=new THREE.Mesh(new THREE.PlaneGeometry(this.config.size.width,this.config.size.depth),floorMaterial);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.userData.surface=this.config.floorMaterial||'sand';this.group.add(floor);this.raycastTargets.push(floor);
    for(const wall of this.config.walls){const mesh=new THREE.Mesh(new THREE.BoxGeometry(wall.w,wall.h,wall.d),this.materials[wall.material]||this.materials.sandstone);mesh.position.set(wall.x,wall.y,wall.z);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.surface=wall.material||'stone';mesh.userData.solid=true;this.group.add(mesh);this.raycastTargets.push(mesh);}
    this.buildCrates();this.buildPlatforms();this.buildLandmarks();
    this.scene.add(this.group);return this;
  }
  buildCrates(){const groups=this.config.crates.reduce((result,crate)=>{const key=crate.material||'wood';(result[key]||=[]).push(crate);return result;},{});for(const [material,crates] of Object.entries(groups)){if(!crates.length)continue;const geo=new THREE.BoxGeometry(1,1,1);const mesh=new THREE.InstancedMesh(geo,this.materials[material]||this.materials.wood,crates.length);const matrix=new THREE.Matrix4();crates.forEach((crate,index)=>{matrix.compose(new THREE.Vector3(crate.x,crate.y,crate.z),new THREE.Quaternion(),new THREE.Vector3(crate.w,crate.h,crate.d));mesh.setMatrixAt(index,matrix);});mesh.castShadow=mesh.receiveShadow=true;mesh.userData.surface=material;mesh.userData.solid=true;this.group.add(mesh);this.raycastTargets.push(mesh);}}
  buildPlatforms(){for(const platform of this.config.platforms||[]){const mesh=new THREE.Mesh(new THREE.BoxGeometry(platform.w,platform.h,platform.d),this.materials[platform.material]||this.materials.concrete);mesh.position.set(platform.x,platform.y,platform.z);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.surface=platform.material||'concrete';mesh.userData.solid=true;mesh.userData.standable=true;this.group.add(mesh);this.raycastTargets.push(mesh);}}
  buildLandmarks(){
    for(const site of this.config.bombSites){const ring=new THREE.Mesh(new THREE.RingGeometry(site.radius*.68,site.radius*.86,32),new THREE.MeshBasicMaterial({color:site.id==='A'?0xbd4d32:0xc28a38,side:THREE.DoubleSide,transparent:true,opacity:.72}));ring.rotation.x=-Math.PI/2;ring.position.set(site.x,.025,site.z);this.group.add(ring);const mark=document.createElement('canvas');mark.width=mark.height=128;const c=mark.getContext('2d');c.fillStyle='rgba(20,20,16,.65)';c.font='bold 84px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(site.id,64,70);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(mark),transparent:true,depthWrite:false}));sprite.position.set(site.x,5,site.z);sprite.scale.set(5,5,1);this.group.add(sprite);}
    for(const ramp of this.config.ramps||[]){let mesh;if(Number.isFinite(ramp.h)&&ramp.direction){const alongX=ramp.direction==='east'||ramp.direction==='west';const run=alongX?ramp.w:ramp.d;const length=Math.hypot(run,ramp.h);mesh=new THREE.Mesh(new THREE.BoxGeometry(alongX?length:ramp.w,.28,alongX?ramp.d:length),this.materials[ramp.material]||this.materials.concrete);const angle=Math.atan2(ramp.h,run);if(alongX)mesh.rotation.z=ramp.direction==='east'?angle:-angle;else mesh.rotation.x=ramp.direction==='north'?angle:-angle;mesh.position.set(ramp.x,ramp.h/2,ramp.z);mesh.userData.surface=ramp.material||'concrete';}else{mesh=new THREE.Mesh(new THREE.BoxGeometry(ramp.w,.6,ramp.d),this.materials.stone);mesh.position.set(ramp.x,.4,ramp.z);mesh.rotation.x=ramp.rotation;}mesh.castShadow=mesh.receiveShadow=true;this.group.add(mesh);this.raycastTargets.push(mesh);}
    if(this.config.custom)return;
    const scale=this.config.scale||1;const archMat=this.materials.stone;for(const [x,z,rotation] of [[0,1,0],[-42,13,Math.PI/2],[18,-31,0]]){
      const gate=new THREE.Group();gate.name='dust-double-gate';gate.position.set(x*scale,0,z*scale);gate.rotation.y=rotation;gate.scale.setScalar(scale);
      const arch=new THREE.Mesh(new THREE.TorusGeometry(3.05,.82,8,24,Math.PI),archMat);arch.position.y=4.55;arch.castShadow=true;gate.add(arch);
      for(const side of [-1,1]){const pillar=new THREE.Mesh(new THREE.BoxGeometry(1.15,5.1,1.25),archMat);pillar.position.set(side*3.02,2.55,0);pillar.castShadow=pillar.receiveShadow=true;gate.add(pillar);const cap=new THREE.Mesh(new THREE.BoxGeometry(1.5,.42,1.55),archMat);cap.position.set(side*3.02,5.05,0);cap.castShadow=true;gate.add(cap);}
      const makeLeaf=(side)=>{const pivot=new THREE.Group();pivot.position.set(side*2.55,0,0);pivot.rotation.y=side*.48;const leaf=new THREE.Mesh(new THREE.BoxGeometry(2.45,4.65,.28),this.materials.gateDoor);leaf.position.set(-side*1.23,2.33,0);leaf.castShadow=leaf.receiveShadow=true;pivot.add(leaf);for(const y of [1.15,3.5]){const strap=new THREE.Mesh(new THREE.BoxGeometry(2.48,.16,.34),this.materials.metal);strap.position.set(-side*1.23,y,.01);pivot.add(strap);}gate.add(pivot);};makeLeaf(-1);makeLeaf(1);
      this.group.add(gate);
    }
    const signTexture=(text,color)=>{const c=document.createElement('canvas');c.width=256;c.height=96;const x=c.getContext('2d');x.fillStyle='#2b2d26';x.fillRect(0,0,256,96);x.strokeStyle=color;x.lineWidth=5;x.strokeRect(6,6,244,84);x.fillStyle=color;x.font='bold 45px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(text,128,50);return new THREE.CanvasTexture(c);};
    [['A →',0xd76a42,-7,2,17,Math.PI/2],['← B',0xd59a42,-19,2,-5,0]].forEach(([text,color,x,y,z,ry])=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(3.7,1.4),new THREE.MeshBasicMaterial({map:signTexture(text,color)}));m.position.set(x*scale,y,z*scale);m.rotation.y=ry;this.group.add(m);});
  }
  dispose(){this.scene.remove(this.group);this.group.traverse(o=>{o.geometry?.dispose();});if(this.materialLibrary)disposeAtlasMaterials(this.materialLibrary);else Object.values(this.materials).forEach(m=>{m.map?.dispose();m.dispose();});}
}
