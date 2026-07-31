const PATTERN=[0,.18,-.12,.25,-.2,.32,-.3,.24,-.18,.38,-.35,.12];
export class RecoilSystem {
  constructor(definition){this.definition=definition;this.index=0;this.cooldown=0;}
  update(dt){this.cooldown+=dt;if(this.cooldown>.28)this.index=Math.max(0,this.index-Math.ceil(dt*12));}
  shot(crouched=false){const power=(this.definition.recoil||.5)*(crouched?.76:1);const side=(PATTERN[this.index%PATTERN.length]+(Math.random()-.5)*.08)*power;const up=(.65+Math.min(this.index,8)*.055)*power;this.index++;this.cooldown=0;return{x:side*.018,y:up*.018};}
  reset(){this.index=0;this.cooldown=0;}
}
