import * as THREE from 'three';

const material=(color,options={})=>new THREE.MeshStandardMaterial({color,roughness:.72,...options});

function part(group,entity,name,geometry,partMaterial,position,zone,rotation=null){
  const mesh=new THREE.Mesh(geometry,partMaterial);mesh.name=name;mesh.position.set(...position);if(rotation)mesh.rotation.set(...rotation);mesh.userData={entity,zone};mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;
}

function limb(group,entity,name,start,end,radius,partMaterial,zone){
  const from=new THREE.Vector3(...start),to=new THREE.Vector3(...end),direction=to.clone().sub(from);const mesh=part(group,entity,name,new THREE.CylinderGeometry(radius*.82,radius,direction.length(),10,2),partMaterial,from.clone().add(to).multiplyScalar(.5).toArray(),zone);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return mesh;
}

function addChestEmblem(group,entity,attacker){
  const color=attacker?0x35a7c4:0xd6e76d;const disc=part(group,entity,'chest-emblem',new THREE.CircleGeometry(.105,18),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}),[0,1.22,.322],'chest');
  const slash=part(group,entity,'chest-emblem-slash',new THREE.PlaneGeometry(.045,.17),new THREE.MeshBasicMaterial({color:0xf3f1df,side:THREE.DoubleSide}),[0,1.22,.326],'chest',[0,0,-.55]);slash.position.z=disc.position.z+.005;
}

export function createCharacterModel(entity,team,{name='character'}={}){
  const attacker=team==='attackers';const group=new THREE.Group();group.name=name;
  const uniform=material(attacker?0x9b151d:0x195b8e,{metalness:.04,emissive:attacker?0x260407:0x04172b,emissiveIntensity:.22});
  const uniformDark=material(attacker?0x5c1117:0x123a5a,{roughness:.84});const skin=material(attacker?0xb58a68:0xb58f72,{roughness:.94});const boots=material(0x171a17,{roughness:.88});const hair=material(0x171713,{roughness:.9});const glasses=material(0x111719,{metalness:.45,roughness:.2});const glove=material(0x2a2b27,{roughness:.78});

  part(group,entity,'body',new THREE.CapsuleGeometry(.31,.45,7,14),uniform,[0,1.09,0],'chest');
  part(group,entity,'waist',new THREE.CylinderGeometry(.27,.29,.18,12),uniformDark,[0,.67,0],'stomach');
  part(group,entity,'belt',new THREE.CylinderGeometry(.295,.295,.075,14),boots,[0,.73,0],'stomach');
  part(group,entity,'neck',new THREE.CylinderGeometry(.105,.12,.16,10),skin,[0,1.52,0],'head');
  const head=part(group,entity,'head',new THREE.SphereGeometry(.23,14,10),skin,[0,1.72,0],'head');head.scale.set(.9,1.08,.88);

  if(attacker){
    const hairstyle=part(group,entity,'attacker-hair',new THREE.SphereGeometry(.235,14,8,0,Math.PI*2,0,Math.PI/2),hair,[0,1.89,-.01],'head');hairstyle.scale.z=.9;
    for(const x of [-.09,.09])part(group,entity,`sunglasses-${x<0?'left':'right'}`,new THREE.BoxGeometry(.145,.07,.025),glasses,[x,1.77,.208],'head',[0,x<0?.05:-.05,0]);
    part(group,entity,'sunglasses-bridge',new THREE.BoxGeometry(.055,.018,.025),glasses,[0,1.77,.21],'head');
  }else{
    const helmet=part(group,entity,'defender-helmet',new THREE.SphereGeometry(.25,14,8,0,Math.PI*2,0,Math.PI*.62),boots,[0,1.86,-.015],'head');helmet.scale.z=.94;
    part(group,entity,'defender-visor',new THREE.BoxGeometry(.29,.08,.035),glasses,[0,1.77,.21],'head');
  }

  for(const [side,x] of [['left',-.17],['right',.17]]){
    const leg=part(group,entity,`leg-${side}`,new THREE.CapsuleGeometry(.115,.48,6,10),uniformDark,[x,.42,0],'legs');
    const boot=part(leg,entity,`boot-${side}`,new THREE.CapsuleGeometry(.105,.18,5,9),boots,[0,-.38,.07],'legs',[Math.PI/2,0,0]);boot.scale.z=1.18;
  }

  const shoulders={left:[-.3,1.34,0],right:[.3,1.34,0]};const elbows={left:[-.3,1.13,.17],right:[.3,1.13,.17]};const hands={left:[-.12,1.12,.37],right:[.18,1.12,.4]};
  for(const side of ['left','right']){
    limb(group,entity,`upper-arm-${side}`,shoulders[side],elbows[side],.105,uniform,'arms');
    limb(group,entity,`forearm-${side}`,elbows[side],hands[side],.085,uniformDark,'arms');
    part(group,entity,`hand-${side}`,new THREE.SphereGeometry(.09,10,7),glove,hands[side],'arms');
  }
  addChestEmblem(group,entity,attacker);

  const weapon=new THREE.Group();weapon.name='weapon';weapon.position.set(.22,1.17,.25);weapon.userData={entity,zone:'arms'};group.add(weapon);
  part(weapon,entity,'weapon-receiver',new THREE.CapsuleGeometry(.07,.34,5,9),boots,[0,0,.05],'arms',[Math.PI/2,0,0]);
  part(weapon,entity,'weapon-barrel',new THREE.CylinderGeometry(.025,.035,.42,10),boots,[0,.01,.42],'arms',[Math.PI/2,0,0]);
  const shotLight=new THREE.PointLight(0xffb04c,0,4);shotLight.name='shot-light';shotLight.position.set(.22,1.18,.72);group.add(shotLight);
  return group;
}

export function animateCharacterLegs(group,speed,time=performance.now()){
  for(const [index,name] of ['leg-left','leg-right'].entries()){const leg=group.getObjectByName(name);if(leg)leg.rotation.x=Math.sin(time*.009+index*Math.PI)*Math.min(.55,speed*.1);}
}
