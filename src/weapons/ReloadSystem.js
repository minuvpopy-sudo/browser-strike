export class ReloadSystem {
  constructor(definition){this.definition=definition;this.remaining=0;this.active=false;}
  start(current,reserve){if(this.active||current>=this.definition.mag||reserve<=0)return false;this.remaining=this.definition.reload;this.active=true;return true;}
  update(dt,current,reserve){if(!this.active)return null;this.remaining-=dt;if(this.remaining>0)return null;this.active=false;const amount=Math.min(this.definition.mag-current,reserve);return{ammo:current+amount,reserve:reserve-amount};}
  cancel(){this.active=false;this.remaining=0;}
}
