import { Weapon } from './Weapon.js';
export class Knife extends Weapon {
  constructor(definition,variant='standard',skin='classic'){super(definition);this.variant=variant;this.skin=skin;}
  attack(heavy=false){if(this.cooldown>0)return null;this.cooldown=heavy?.95:.52;return{damage:heavy?this.definition.heavyDamage:this.definition.damage,range:this.definition.range,heavy};}
  inspect(){if(this.cooldown>0)return false;this.inspecting=this.variant==='karambit'?2.2:1.5;return true;}
}
