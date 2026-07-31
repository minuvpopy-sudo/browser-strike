import { WEAPONS, GRENADES } from '../weapons/WeaponDefinitions.js';
import { Firearm } from '../weapons/Firearm.js';
import { Knife } from '../weapons/Knife.js';

export class BombEquipment {
  constructor() {
    this.definition = { id: 'bomb', name: 'C4', category: 'objective', moveSpeed: .92 };
  }
  update() {}
}

export class PlayerInventory {
  constructor(team,knifeChoice){this.team=team;this.slots={primary:null,pistol:new Firearm(WEAPONS[team==='attackers'?'glock':'usp']),knife:new Knife(WEAPONS.knife,knifeChoice.type,knifeChoice.skin),grenades:[],bomb:null};this.activeSlot='pistol';this.previousSlot='knife';}
  get active(){return this.slots[this.activeSlot];}
  equip(slot){if(!this.slots[slot]||(Array.isArray(this.slots[slot])&&this.slots[slot].length===0))return false;if(slot!==this.activeSlot){this.previousSlot=this.activeSlot;this.activeSlot=slot;return true;}return false;}
  equipDefinition(def){const weapon=new Firearm(def);if(def.category==='pistols')this.slots.pistol=weapon;else this.slots.primary=weapon;this.equip(def.category==='pistols'?'pistol':'primary');return weapon;}
  addGrenade(id){if(!GRENADES[id]||this.slots.grenades.length>=4)return false;this.slots.grenades.push(id);return true;}
  setBomb(owned) {
    this.slots.bomb = owned ? new BombEquipment() : null;
    if (!owned && this.activeSlot === 'bomb') this.equipFallback('bomb');
    return this.slots.bomb;
  }
  remove(slot) {
    const item = this.slots[slot];
    if (!item) return null;
    this.slots[slot] = null;
    if (this.activeSlot === slot) this.equipFallback(slot);
    return item;
  }
  equipFallback(excluded) {
    const fallback = [this.previousSlot, 'primary', 'pistol', 'knife']
      .find((slot) => slot !== excluded && this.slots[slot] && (!Array.isArray(this.slots[slot]) || this.slots[slot].length));
    if (!fallback) return false;
    this.activeSlot = fallback;
    this.previousSlot = ['knife', 'pistol', 'primary'].find((slot) => slot !== fallback && this.slots[slot]) || fallback;
    return true;
  }
  quickSwap(){return this.equip(this.previousSlot);}
  cycle(direction=1){const order=['primary','pistol','knife','grenades','bomb'].filter(s=>this.slots[s]&&(s!=='grenades'||this.slots.grenades.length));if(!order.length)return false;const i=Math.max(0,order.indexOf(this.activeSlot));return this.equip(order[(i+Math.sign(direction)+order.length)%order.length]);}
}
