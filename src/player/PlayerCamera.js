import * as THREE from 'three';
export class PlayerCamera {
  constructor(camera,player,input,settings){this.camera=camera;this.player=player;this.input=input;this.settings=settings;this.yaw=0;this.pitch=0;this.recoilX=0;this.recoilY=0;this.targetRecoilX=0;this.targetRecoilY=0;this.shake=0;}
  update(dt,movement){const look=this.input.consumeLook();const sensitivity=this.settings.values.sensitivity*.00165;this.yaw-=look.x*sensitivity;this.pitch-=look.y*sensitivity*(this.settings.values.invertMouse?-1:1);this.pitch=THREE.MathUtils.clamp(this.pitch,-Math.PI*.48,Math.PI*.48);this.targetRecoilX*=Math.max(0,1-dt*5);this.targetRecoilY*=Math.max(0,1-dt*6);this.recoilX=THREE.MathUtils.lerp(this.recoilX,this.targetRecoilX,dt*18);this.recoilY=THREE.MathUtils.lerp(this.recoilY,this.targetRecoilY,dt*18);
    const eye=movement.crouched?1.15:1.7;const bob=movement.speed>.5&&movement.grounded?Math.sin(movement.bob)*.035:0;const land=movement.landing>0?-Math.sin(movement.landing/.12*Math.PI)*.08:0;this.camera.position.set(this.player.position.x,this.player.position.y+eye+bob+land,this.player.position.z);this.camera.rotation.set(this.pitch-this.recoilY,this.yaw+this.recoilX,Math.sin(movement.bob*.5)*.002,'YXZ');}
  addRecoil(value){this.targetRecoilX+=value.x;this.targetRecoilY+=value.y;}
  direction(offset={x:0,y:0}){const dir=new THREE.Vector3(0,0,-1);const e=new THREE.Euler(this.pitch-this.recoilY+offset.y,this.yaw+this.recoilX+offset.x,0,'YXZ');return dir.applyEuler(e).normalize();}
}
