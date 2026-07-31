import { WEAPON_SKINS } from './WeaponSkinDefinitions.js';
import { KNIFE_SKINS } from './KnifeSkinDefinitions.js';
export class SkinManager {
  constructor(save){this.save=save;this.weaponSkins=save.get('weaponSkins',{});this.knife=save.get('knife',{type:'butterfly',skin:'classic'});}
  weapon(id){return WEAPON_SKINS[this.weaponSkins[id]||'standard'];}
  setWeapon(id,skin){if(WEAPON_SKINS[skin]){this.weaponSkins[id]=skin;this.save.set('weaponSkins',this.weaponSkins);}}
  setKnife(type,skin){if(KNIFE_SKINS[skin]){this.knife={type,skin};this.save.set('knife',this.knife);}}
  knifeStyle(){return KNIFE_SKINS[this.knife.skin]||KNIFE_SKINS.classic;}
}
