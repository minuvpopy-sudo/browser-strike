import { SkinPreview } from '../skins/SkinPreview.js';
import { KNIFE_TYPES } from '../skins/KnifeSkinDefinitions.js';
export class KnifeMenu {
  constructor(skinManager){this.skinManager=skinManager;this.type=skinManager.knife.type;this.skin=skinManager.knife.skin;this.preview=new SkinPreview(document.getElementById('knife-preview'));this.typeButtons=[...document.querySelectorAll('[data-knife]')];this.skinSelect=document.getElementById('knife-skin');this.skinSelect.value=this.skin;this.typeButtons.forEach(b=>b.addEventListener('click',()=>{this.type=b.dataset.knife;if(this.type==='m9'&&this.skin==='classic'){this.skin='doodle';this.skinSelect.value=this.skin;}this.refresh();}));this.skinSelect.addEventListener('change',()=>{this.skin=this.skinSelect.value;this.refresh();});document.getElementById('inspect-knife').addEventListener('click',()=>this.preview.inspect());document.getElementById('select-knife').addEventListener('click',()=>this.select());this.refresh();}
  refresh(){this.typeButtons.forEach(b=>b.classList.toggle('selected',b.dataset.knife===this.type));this.preview.set(this.type,this.skin);}
  select(){this.skinManager.setKnife(this.type,this.skin);const name=KNIFE_TYPES[this.type]||KNIFE_TYPES.standard;document.getElementById('knife-label').textContent=name;document.getElementById('knife-status').textContent=`Выбрано: ${name.toLowerCase()}`;}
}
