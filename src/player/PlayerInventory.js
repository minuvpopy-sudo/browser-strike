import { WEAPONS, GRENADES } from '../weapons/WeaponDefinitions.js';
import { Firearm } from '../weapons/Firearm.js';
import { Knife } from '../weapons/Knife.js';

export class PlayerInventory {
  constructor(team,knifeChoice){this.team=team;this.slots={primary:null,pistol:new Firearm(WEAPONS[team==='attackers'?'glock':'usp']),knife:new Knife(WEAPONS.knife,knifeChoice.type,knifeChoice.skin),grenades:[],bomb:false};this.activeSlot='pistol';this.previousSlot='knife';}
  get active(){return this.slots[this.activeSlot];}
  equip(slot){if(!this.slots[slot]||(Array.isArray(this.slots[slot])&&this.slots[slot].length===0))return false;if(slot!==this.activeSlot){this.previousSlot=this.activeSlot;this.activeSlot=slot;return true;}return false;}
  equipDefinition(def){const weapon=new Firearm(def);if(def.category==='pistols')this.slots.pistol=weapon;else this.slots.primary=weapon;this.equip(def.category==='pistols'?'pistol':'primary');return weapon;}
  addGrenade(id){if(!GRENADES[id]||this.slots.grenades.length>=4)return false;this.slots.grenades.push(id);return true;}
  quickSwap(){return this.equip(this.previousSlot);}
  cycle(direction=1){const order=['primary','pistol','knife','grenades','bomb'].filter(s=>this.slots[s]&&(s!=='grenades'||this.slots.grenades.length));const i=order.indexOf(this.activeSlot);return this.equip(order[(i+Math.sign(direction)+order.length)%order.length]);}
}
