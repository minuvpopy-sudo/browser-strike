export class SpreadSystem {
  constructor(definition){this.definition=definition;this.heat=0;this.lastShot=10;}
  update(dt){this.lastShot+=dt;this.heat=Math.max(0,this.heat-dt*.85);}
  shot(){this.heat=Math.min(1.7,this.heat+.18);this.lastShot=0;}
  value(movement){let spread=this.definition.spread||0;spread+=movement.speed*.0025;spread+=movement.airborne?.07:0;spread*=movement.crouched?.72:1;spread+=this.heat*spread*2.6;if(this.definition.scope&&movement.scoped)spread*=.18;return spread;}
  offset(movement){const amount=this.value(movement);const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*amount;return{x:Math.cos(a)*r,y:Math.sin(a)*r};}
}
