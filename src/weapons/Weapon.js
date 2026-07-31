export class Weapon {
  constructor(definition){this.definition=definition;this.cooldown=0;this.inspecting=0;}
  update(dt){this.cooldown=Math.max(0,this.cooldown-dt);this.inspecting=Math.max(0,this.inspecting-dt);}
  inspect(){if(this.cooldown<=0){this.inspecting=1.5;return true;}return false;}
}
