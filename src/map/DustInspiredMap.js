import * as THREE from 'three';

function canvasTexture(base, accent, type = 'stone') {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128; const ctx = canvas.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0,0,128,128);
  const seed = type.length * 171;
  for (let i=0;i<360;i++) { const x=(i*47+seed)%128,y=(i*83+seed)%128,size=1+(i%4); ctx.fillStyle=`${accent}${24+(i%30).toString(16).padStart(2,'0')}`;ctx.fillRect(x,y,size,size); }
  if(type==='stone'){ctx.strokeStyle='#806c4a77';ctx.lineWidth=2;for(let y=0;y<128;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y);ctx.stroke();}for(let x=0;x<128;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,128);ctx.stroke();}}
  if(type==='wood'){ctx.strokeStyle='#25180d88';for(let x=5;x<128;x+=18){ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+8,40,x-5,80,x+4,128);ctx.stroke();}}
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS=texture.wrapT=THREE.RepeatWrapping; texture.colorSpace=THREE.SRGBColorSpace; return texture;
}

export class DustInspiredMap {
  constructor(scene, config, settings) {
    this.scene=scene;this.config=config;this.settings=settings;this.group=new THREE.Group();this.group.name=config.name;this.raycastTargets=[];
    this.materials={
      sandstone:new THREE.MeshStandardMaterial({map:canvasTexture('#c7a46c','#f4d99d','stone'),roughness:.94,color:0xffffff}),
      stone:new THREE.MeshStandardMaterial({map:canvasTexture('#806e51','#dac58f','stone'),roughness:1}),
      wood:new THREE.MeshStandardMaterial({map:canvasTexture('#755031','#d3a15f','wood'),roughness:.86}),
      metal:new THREE.MeshStandardMaterial({color:0x4c5550,roughness:.55,metalness:.65}),
      ground:new THREE.MeshStandardMaterial({map:canvasTexture('#b09667','#ddc88e','sand'),roughness:1,color:0xffffff})
    };
  }
  build() {
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(this.config.size.width,this.config.size.depth),this.materials.ground);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.userData.surface='sand';this.group.add(floor);this.raycastTargets.push(floor);
    for(const wall of this.config.walls){const mesh=new THREE.Mesh(new THREE.BoxGeometry(wall.w,wall.h,wall.d),this.materials[wall.material]||this.materials.sandstone);mesh.position.set(wall.x,wall.y,wall.z);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.surface=wall.material||'stone';mesh.userData.solid=true;this.group.add(mesh);this.raycastTargets.push(mesh);}
    this.buildCrates();this.buildLandmarks();
    this.scene.add(this.group);return this;
  }
  buildCrates(){const geo=new THREE.BoxGeometry(1,1,1);const mesh=new THREE.InstancedMesh(geo,this.materials.wood,this.config.crates.length);const matrix=new THREE.Matrix4();this.config.crates.forEach((c,i)=>{matrix.compose(new THREE.Vector3(c.x,c.y,c.z),new THREE.Quaternion(),new THREE.Vector3(c.w,c.h,c.d));mesh.setMatrixAt(i,matrix);});mesh.castShadow=mesh.receiveShadow=true;mesh.userData.surface='wood';mesh.userData.solid=true;this.group.add(mesh);this.raycastTargets.push(mesh);}
  buildLandmarks(){
    for(const site of this.config.bombSites){const ring=new THREE.Mesh(new THREE.RingGeometry(site.radius*.68,site.radius*.86,32),new THREE.MeshBasicMaterial({color:site.id==='A'?0xbd4d32:0xc28a38,side:THREE.DoubleSide,transparent:true,opacity:.72}));ring.rotation.x=-Math.PI/2;ring.position.set(site.x,.025,site.z);this.group.add(ring);const mark=document.createElement('canvas');mark.width=mark.height=128;const c=mark.getContext('2d');c.fillStyle='rgba(20,20,16,.65)';c.font='bold 84px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(site.id,64,70);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(mark),transparent:true,depthWrite:false}));sprite.position.set(site.x,5,site.z);sprite.scale.set(5,5,1);this.group.add(sprite);}
    const scale=this.config.scale||1;const archMat=this.materials.stone;for(const [x,z,rotation] of [[0,1,0],[-42,13,Math.PI/2],[18,-31,0]]){const arch=new THREE.Mesh(new THREE.TorusGeometry(3,1.1,6,16,Math.PI),archMat);arch.rotation.set(0,rotation,0);arch.position.set(x*scale,3.8,z*scale);arch.castShadow=true;this.group.add(arch);}
    for(const ramp of this.config.ramps){const mesh=new THREE.Mesh(new THREE.BoxGeometry(ramp.w,.6,ramp.d),this.materials.stone);mesh.position.set(ramp.x,.4,ramp.z);mesh.rotation.x=ramp.rotation;mesh.castShadow=mesh.receiveShadow=true;this.group.add(mesh);}
    const signTexture=(text,color)=>{const c=document.createElement('canvas');c.width=256;c.height=96;const x=c.getContext('2d');x.fillStyle='#2b2d26';x.fillRect(0,0,256,96);x.strokeStyle=color;x.lineWidth=5;x.strokeRect(6,6,244,84);x.fillStyle=color;x.font='bold 45px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(text,128,50);return new THREE.CanvasTexture(c);};
    [['A →',0xd76a42,-7,2,17,Math.PI/2],['← B',0xd59a42,-19,2,-5,0]].forEach(([text,color,x,y,z,ry])=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(3.7,1.4),new THREE.MeshBasicMaterial({map:signTexture(text,color)}));m.position.set(x*scale,y,z*scale);m.rotation.y=ry;this.group.add(m);});
  }
  dispose(){this.scene.remove(this.group);this.group.traverse(o=>{o.geometry?.dispose();});Object.values(this.materials).forEach(m=>{m.map?.dispose();m.dispose();});}
}
