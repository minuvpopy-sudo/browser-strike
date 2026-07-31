export class PlayerController {
  constructor(player,movement,camera,input,weaponManager){this.player=player;this.movement=movement;this.camera=camera;this.input=input;this.weaponManager=weaponManager;this.fireHeld=false;}
  fixedUpdate(dt,settings,audio){this.movement.update(dt,this.camera.yaw,settings,audio);this.weaponManager.update(dt);}
  visualUpdate(dt){this.camera.update(dt,this.movement);}
}
