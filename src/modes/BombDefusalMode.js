import * as THREE from 'three';
import { GameMode } from './GameMode.js';
import { ECONOMY } from '../config/MatchRules.js';

export class BombDefusalMode extends GameMode {
  constructor(game,rounds){super(game);this.rounds=rounds;this.carrier=null;this.planted=false;this.site=null;this.timer=0;this.progress=0;this.defuseProgress=0;this.beep=0;this.bomb=this.createBomb();this.game.scene.add(this.bomb);this.bomb.visible=false;}
  createBomb(){const g=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(.42,.22,.3),new THREE.MeshStandardMaterial({color:0x273125,roughness:.65}));g.add(body);const light=new THREE.Mesh(new THREE.SphereGeometry(.035,6,5),new THREE.MeshBasicMaterial({color:0xff3322}));light.position.set(.2,.12,0);light.name='light';g.add(light);for(let i=0;i<3;i++){const wire=new THREE.Mesh(new THREE.TorusGeometry(.13+i*.035,.012,4,8,Math.PI),new THREE.MeshBasicMaterial({color:[0xd8493c,0x4b78bd,0xe4ca4d][i]}));wire.rotation.x=Math.PI/2;wire.position.y=.12;g.add(wire);}return g;}
  beginRound(){
    this.carrier=null;this.planted=false;this.site=null;this.timer=this.game.settings.values.bombTime;this.progress=0;this.defuseProgress=0;this.bomb.visible=false;
    const entities=[this.game.player,...this.game.botManager.bots];
    for(const entity of entities){entity.hasBomb=false;entity.bombSite=null;if(entity.isPlayer)entity.inventory.slots.bomb=false;}
    const playerAttacker=this.game.player.team==='attackers'&&this.game.player.alive?this.game.player:null;
    const botAttackers=this.game.botManager.bots.filter(entity=>entity.team==='attackers'&&entity.alive);
    this.carrier=playerAttacker||botAttackers[Math.floor(Math.random()*botAttackers.length)]||null;
    if(this.carrier){this.carrier.hasBomb=true;this.carrier.bombSite=this.game.mapConfig.bombSites[Math.floor(Math.random()*this.game.mapConfig.bombSites.length)];if(this.carrier.isPlayer)this.carrier.inventory.slots.bomb=true;}
    this.emitState();
  }
  update(dt){if(!this.active||this.rounds.state!=='live')return;if(this.carrier&&!this.carrier.alive){this.drop(this.carrier.position);}
    if(!this.planted)this.updatePlant(dt);else this.updateDefuse(dt);
  }
  updatePlant(dt){if(!this.carrier){if(this.bomb.visible){const picker=[...this.game.botManager.alive('attackers'),this.game.player].find(e=>e.team==='attackers'&&e.alive&&e.position.distanceTo(this.bomb.position)<1.5);if(picker)this.pickup(picker);}return;}const site=this.nearSite(this.carrier.position);if(this.carrier.isPlayer){const using=this.game.input.action('use');if(site&&using){this.progress+=dt;this.game.hud.interaction(`УСТАНОВКА НА ТОЧКЕ ${site.id}`,this.progress/3.2);if(this.progress>=3.2)this.plant(site,this.carrier);}else{this.progress=Math.max(0,this.progress-dt*2);this.game.hud.interaction('',0);}}
    else if(site){this.progress+=dt;if(this.progress>=3.2)this.plant(site,this.carrier);}else if(this.carrier.position.distanceTo(this.bomb.position)<1.8&&this.bomb.visible&&!this.planted){this.pickup(this.carrier);}
  }
  updateDefuse(dt){this.timer-=dt;this.beep-=dt;if(this.beep<=0){this.game.audio.tone('ui',{frequency:780,endFrequency:550,gain:.06,duration:.09});this.beep=Math.max(.18,this.timer/15);}this.bomb.getObjectByName('light').visible=Math.sin(performance.now()*.02)>0;
    const defenders=[this.game.player,...this.game.botManager.alive('defenders')].filter(e=>e.team==='defenders'&&e.alive);let defuser=null;if(this.game.player.team==='defenders'&&this.game.player.alive&&this.game.player.position.distanceTo(this.bomb.position)<2.5&&this.game.input.action('use'))defuser=this.game.player;else defuser=defenders.find(e=>!e.isPlayer&&e.position.distanceTo(this.bomb.position)<2.1);
    if(defuser){const duration=defuser.defuseKit?5:10;this.defuseProgress+=dt;this.game.hud.interaction(defuser.isPlayer?'ОБЕЗВРЕЖИВАНИЕ':'СОЮЗНИК ОБЕЗВРЕЖИВАЕТ',this.defuseProgress/duration);if(this.defuseProgress>=duration){defuser.addMoney(ECONOMY.defuse);this.rounds.end('defenders','Бомба обезврежена');this.bomb.visible=false;this.game.audio.tone('voice',{frequency:520,endFrequency:720,gain:.1,duration:.4});}}
    else{this.defuseProgress=Math.max(0,this.defuseProgress-dt*1.7);if(!this.game.input.action('use'))this.game.hud.interaction('',0);}
    if(this.timer<=0){this.explode();}
  }
  plant(site,carrier){this.planted=true;this.site=site;this.timer=this.game.settings.values.bombTime;this.bomb.visible=true;this.bomb.position.set(site.x,.18,site.z);carrier.hasBomb=false;carrier.bombSite=null;if(carrier.isPlayer)carrier.inventory.slots.bomb=false;carrier.addMoney(ECONOMY.plant);this.carrier=null;this.progress=0;this.game.hud.interaction('',0);this.game.hud.message(`Бомба установлена на точке ${site.id}`,'warning');this.emitState();}
  explode(){this.bomb.visible=false;this.game.audio.explosion();this.game.explosion.spawn(this.bomb.position);for(const entity of [this.game.player,...this.game.botManager.bots]){if(entity.alive){const d=entity.position.distanceTo(this.bomb.position);if(d<22)entity.takeDamage(Math.max(15,150-d*6),null);}}this.rounds.end('attackers',`Бомба взорвана на точке ${this.site?.id||''}`);this.emitState();}
  drop(position){if(this.carrier){this.carrier.hasBomb=false;this.carrier.bombSite=null;if(this.carrier.isPlayer)this.carrier.inventory.slots.bomb=false;}this.carrier=null;this.bomb.visible=true;this.bomb.position.copy(position).setY(.18);this.emitState();}
  pickup(entity){this.carrier=entity;entity.hasBomb=true;entity.bombSite=this.game.mapConfig.bombSites.reduce((best,site)=>!best||entity.position.distanceToSquared(new THREE.Vector3(site.x,0,site.z))<entity.position.distanceToSquared(new THREE.Vector3(best.x,0,best.z))?site:best,null);if(entity.isPlayer)entity.inventory.slots.bomb=true;this.bomb.visible=false;this.emitState();}
  nearSite(position){return this.game.mapConfig.bombSites.find(s=>Math.hypot(position.x-s.x,position.z-s.z)<=s.radius);}
  emitState(){this.dispatchEvent(new CustomEvent('bombstate',{detail:{carrier:this.carrier,planted:this.planted,site:this.site,timer:this.timer}}));}
  dispose(){this.game.scene.remove(this.bomb);this.bomb.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
}
