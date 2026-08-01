import * as THREE from 'three';
import { Bot } from './Bot.js';
import { BotAI } from './BotAI.js';
import { getSpawn } from '../map/SpawnPoints.js';
import { MAP_SCALE } from '../map/MapConfig.js';

const NAMES=['Барс','Север','Лис','Гром','Кедр','Мираж','Радар','Туман','Штиль','Факел','Вектор','Тайга','Беркут','Норд','Риф','Спектр','Орион','Пилот','Сокол','Шрам'];
const RAW_FRONTLINE_SPAWNS={
  attackers:[{x:55,z:-27},{x:-41,z:48},{x:-48,z:40},{x:-38,z:42},{x:-44,z:36}],
  defenders:[{x:-55,z:25},{x:39,z:-47},{x:48,z:-38},{x:37,z:-42},{x:44,z:-34}]
};
export const BOT_FRONTLINE_SPAWNS=Object.fromEntries(Object.entries(RAW_FRONTLINE_SPAWNS).map(([team,points])=>[team,points.map(point=>({x:point.x*MAP_SCALE,z:point.z*MAP_SCALE}))]));
export class BotManager extends EventTarget {
  constructor(scene,graph,collision,audio,settings,mapConfig=MAP_CONFIG){super();this.scene=scene;this.graph=graph;this.collision=collision;this.audio=audio;this.settings=settings;this.mapConfig=mapConfig;this.bots=[];this.ais=new Map();}
  create(countPerTeam){this.dispose();let index=0;for(const team of ['attackers','defenders'])for(let i=0;i<countPerTeam;i++){const bot=new Bot(`BOT ${NAMES[(index*7+3)%NAMES.length]}`,team,this.scene,index++);this.bots.push(bot);this.ais.set(bot,new BotAI(bot,this.graph,this.collision,this.settings.values.difficulty,this.audio));}}
  spawnAll(){const used={attackers:0,defenders:0};for(const bot of this.bots){const slot=used[bot.team]++;bot.playerTarget=slot===0;const point=this.mapConfig.custom?getSpawn(bot.team,slot+1,this.mapConfig):BOT_FRONTLINE_SPAWNS[bot.team][slot]||getSpawn(bot.team,slot+1,this.mapConfig);bot.spawn(point);bot.position.y=this.collision.groundHeightAt?.(point.x,point.z)||0;this.ais.get(bot)?.reset();}}
  update(dt,player,objectives,smoke){const all=[player,...this.bots];for(const bot of this.bots){const enemies=all.filter(e=>e.team!==bot.team&&e.alive);const candidates=objectives[bot.team]||objectives.default;const site=bot.bombSite||(Array.isArray(candidates)?candidates[(bot.index+Math.floor(performance.now()/12000))%candidates.length]:candidates);const objective=new THREE.Vector3(site.x,0,site.z);this.ais.get(bot).update(dt,enemies,objective,smoke,(killer,victim,weapon)=>this.dispatchEvent(new CustomEvent('kill',{detail:{killer,victim,weapon}})));bot.updateVisual(dt);}}
  alive(team){return this.bots.filter(b=>b.team===team&&b.alive);}
  targets(){return this.bots.filter(b=>b.alive).map(b=>b.group);}
  reset(){this.spawnAll();}
  dispose(){for(const bot of this.bots)bot.dispose();this.bots=[];this.ais.clear();}
}
