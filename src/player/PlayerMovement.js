import * as THREE from 'three';

export class PlayerMovement {
  constructor(player,collision,input){this.player=player;this.collision=collision;this.input=input;this.grounded=true;this.crouched=false;this.bob=0;this.landing=0;this.speed=0;}
  update(dt,yaw,settings,audio){if(!this.player.alive)return;
    const forward=(this.input.action('forward')?1:0)-(this.input.action('backward')?1:0),side=(this.input.action('right')?1:0)-(this.input.action('left')?1:0);const wish=new THREE.Vector3(side,0,-forward);if(wish.lengthSq()>0)wish.normalize().applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
    this.crouched=this.input.action('crouch');const walking=this.input.action('walk');let maxSpeed=this.crouched?3.2:walking?4.2:7.2;maxSpeed*=this.player.inventory.active?.definition?.moveSpeed||1;
    const horizontal=new THREE.Vector3(this.player.velocity.x,0,this.player.velocity.z);const target=wish.multiplyScalar(maxSpeed);const accel=this.grounded?16:3.4;horizontal.lerp(target,Math.min(1,accel*dt));if(forward===0&&side===0&&this.grounded)horizontal.multiplyScalar(Math.max(0,1-9*dt));this.player.velocity.x=horizontal.x;this.player.velocity.z=horizontal.z;
    const jumpPressed=settings.autoBhop?this.input.action('jump'):this.input.justPressed('jump');if(jumpPressed&&this.grounded&&!this.crouched){this.player.velocity.y=6.1;this.grounded=false;}
    this.player.velocity.y-=17.5*dt;const wasAir=!this.grounded;let nextY=this.player.position.y+this.player.velocity.y*dt;if(nextY<=0){nextY=0;this.player.velocity.y=0;this.grounded=true;if(wasAir)this.landing=.12;}this.player.position.y=nextY;
    const moved=this.collision.moveCircle(this.player.position,{x:this.player.velocity.x*dt,z:this.player.velocity.z*dt},.58);this.player.position.x=moved.x;this.player.position.z=moved.z;if(moved.blockedX)this.player.velocity.x=0;if(moved.blockedZ)this.player.velocity.z=0;this.speed=Math.hypot(this.player.velocity.x,this.player.velocity.z);
    if(this.grounded&&this.speed>.8)this.bob+=dt*this.speed*1.65;this.landing=Math.max(0,this.landing-dt);
  }
}
