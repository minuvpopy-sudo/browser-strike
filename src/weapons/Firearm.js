import { Weapon } from './Weapon.js';
import { SpreadSystem } from './SpreadSystem.js';
import { RecoilSystem } from './RecoilSystem.js';
import { ReloadSystem } from './ReloadSystem.js';

export class Firearm extends Weapon {
  constructor(definition){super(definition);this.ammo=definition.mag;this.reserve=definition.reserve;this.spread=new SpreadSystem(definition);this.recoil=new RecoilSystem(definition);this.reloadSystem=new ReloadSystem(definition);this.shots=0;}
  update(dt){super.update(dt);this.spread.update(dt);this.recoil.update(dt);const loaded=this.reloadSystem.update(dt,this.ammo,this.reserve);if(loaded){this.ammo=loaded.ammo;this.reserve=loaded.reserve;return 'reloaded';}return null;}
  tryFire(movement){if(this.reloadSystem.active||this.cooldown>0)return{ok:false,reason:'cooldown'};if(this.ammo<=0)return{ok:false,reason:'empty'};if(!this.infiniteAmmo)this.ammo--;this.cooldown=1/this.definition.rate;this.spread.shot();this.shots++;return{ok:true,offset:this.spread.offset(movement),recoil:this.recoil.shot(movement.crouched),pellets:this.definition.pellets||1};}
  reload(){return this.reloadSystem.start(this.ammo,this.reserve);}
  addAmmo(){this.reserve=this.definition.reserve;}
}
