import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT, ECONOMY, awardMoney, lossReward, canBuy, hitDamage } from '../src/config/MatchRules.js';
import { WEAPONS } from '../src/weapons/WeaponDefinitions.js';
import { Firearm } from '../src/weapons/Firearm.js';
import { NavigationGraph } from '../src/map/NavigationGraph.js';
import { MAP_CONFIG } from '../src/map/MapConfig.js';
import { RoundManager } from '../src/modes/RoundManager.js';
import * as THREE from 'three';
import { WeaponManager } from '../src/weapons/WeaponManager.js';
import { Knife } from '../src/weapons/Knife.js';
import { CollisionWorld } from '../src/map/CollisionWorld.js';
import { BotNavigation } from '../src/bots/BotNavigation.js';
import { BotCombat } from '../src/bots/BotCombat.js';
import { BOT_FRONTLINE_SPAWNS } from '../src/bots/BotManager.js';
import { Player } from '../src/player/Player.js';
import { Bot } from '../src/bots/Bot.js';
import { BombDefusalMode } from '../src/modes/BombDefusalMode.js';

test('экономика ограничивает деньги и учитывает серию поражений',()=>{
  assert.equal(awardMoney(15900,1000),ECONOMY.maxMoney);
  assert.equal(lossReward(1),1400);assert.equal(lossReward(9),3400);
  assert.equal(canBuy({money:2500,cost:2500,inBuyZone:true,buyTimeLeft:1}),true);
  assert.equal(canBuy({money:2499,cost:2500,inBuyZone:true,buyTimeLeft:1}),false);
  assert.equal(canBuy({money:5000,cost:2500,inBuyZone:false,buyTimeLeft:1}),false);
});

test('урон учитывает зону, броню и дистанцию',()=>{
  const chest=hitDamage(36,'chest',10,150,0,false),head=hitDamage(36,'head',10,150,0,false),armored=hitDamage(36,'chest',10,150,100,true);
  assert.ok(head>chest);assert.ok(armored<chest);assert.ok(hitDamage(36,'chest',145,150,0,false)<chest);assert.ok(hitDamage(500,'head',1,200,0,false)<COMBAT.maxHealth);
});

test('боеприпасы не уходят ниже нуля, перезарядка переносит патроны',()=>{
  const gun=new Firearm({...WEAPONS.deagle,rate:100});
  for(let i=0;i<20;i++){gun.cooldown=0;gun.tryFire({speed:0,crouched:false,airborne:false});}
  assert.equal(gun.ammo,0);assert.equal(gun.tryFire({speed:0}).reason,'empty');assert.ok(gun.reserve>=0);
  assert.equal(gun.reload(),true);gun.update(gun.definition.reload+.01);assert.equal(gun.ammo,gun.definition.mag);assert.equal(gun.reserve,WEAPONS.deagle.reserve-WEAPONS.deagle.mag);
});

test('навигация A* находит маршрут между базами',()=>{
  const graph=new NavigationGraph(MAP_CONFIG);const path=graph.path(MAP_CONFIG.attackerSpawns[0],MAP_CONFIG.defenderSpawns[0]);
  assert.equal(path[0].id,'tSpawn');assert.equal(path.at(-1).id,'ctSpawn');assert.ok(path.length>4);
});

test('таймер раунда завершает раунд и запускает следующий без setTimeout',()=>{
  const rounds=new RoundManager({values:{roundTime:1,buyTime:.5}});const teams=[{team:'attackers',alive:true},{team:'defenders',alive:true}];rounds.startRound();
  const result=rounds.update(1.1,teams,false);assert.equal(result.winner,'defenders');assert.equal(rounds.state,'ended');rounds.update(4.6,teams,false);assert.equal(rounds.state,'live');assert.equal(rounds.number,2);
});

test('набор оружия содержит все основные категории',()=>{
  const categories=new Set(Object.values(WEAPONS).map(w=>w.category));for(const expected of ['pistols','shotguns','smgs','rifles','machineguns','knives'])assert.ok(categories.has(expected));assert.equal(Object.keys(WEAPONS).length,25);
});

test('пистолет направлен стволом вперёд по оси камеры',()=>{
  const pistol=new Firearm(WEAPONS.glock);const player={alive:true,velocity:new THREE.Vector3(),inventory:{active:pistol}};const camera=new THREE.Group();
  const manager=new WeaponManager(camera,player,{}, {}, {weapon:()=>({colors:[0x333333,0x111111]})});
  const muzzle=manager.group.getObjectByName('muzzle');
  assert.ok(muzzle.position.z<-.7);assert.ok(Math.abs(muzzle.position.x)<.001);assert.ok(manager.group.rotation.y<.15);
});

test('нож-бабочка имеет две шарнирные рукояти и анимацию осмотра',()=>{
  const knife=new Knife(WEAPONS.knife,'butterfly','classic');const player={alive:true,velocity:new THREE.Vector3(),inventory:{active:knife}};const camera=new THREE.Group();
  const manager=new WeaponManager(camera,player,{}, {}, {knifeStyle:()=>({blade:0xcccccc,handle:0x222222})});
  const left=manager.group.getObjectByName('butterfly-handle-left'),right=manager.group.getObjectByName('butterfly-handle-right');
  assert.ok(left);assert.ok(right);assert.ok(manager.group.userData.baseRotation.x>.9);assert.ok(manager.group.position.z<=-1);assert.ok(manager.group.scale.x<=.7);manager.drawTime=0;knife.inspecting=1.35;manager.update(.08);assert.notEqual(left.rotation.y,0);assert.equal(Math.sign(left.rotation.y),-Math.sign(right.rotation.y));
});

test('карта увеличена вместе с геометрией и точками',()=>{
  assert.ok(MAP_CONFIG.size.width>150);assert.ok(Math.abs(MAP_CONFIG.attackerSpawns[0].x)>50);
  assert.equal(MAP_CONFIG.walls[0].w,128*MAP_CONFIG.scale);
});

test('передовые точки ботов свободны и дают врага у каждой базы',()=>{
  const collision=new CollisionWorld(MAP_CONFIG);
  for(const team of Object.keys(BOT_FRONTLINE_SPAWNS))for(const point of BOT_FRONTLINE_SPAWNS[team])assert.equal(collision.intersects(point.x,point.z,.7),false);
  assert.ok(Math.hypot(BOT_FRONTLINE_SPAWNS.defenders[0].x-MAP_CONFIG.attackerSpawns[0].x,BOT_FRONTLINE_SPAWNS.defenders[0].z-MAP_CONFIG.attackerSpawns[0].z)<30);
  assert.ok(Math.hypot(BOT_FRONTLINE_SPAWNS.attackers[0].x-MAP_CONFIG.defenderSpawns[0].x,BOT_FRONTLINE_SPAWNS.attackers[0].z-MAP_CONFIG.defenderSpawns[0].z)<30);
});

test('игрок защищён от мгновенной смерти после возрождения',()=>{
  const player=new Player('attackers',{type:'butterfly',skin:'classic'});player.spawn({x:0,z:0});
  player.takeDamage(120,{});assert.equal(player.health,COMBAT.maxHealth);assert.equal(player.alive,true);
  player.spawnProtectedUntil=0;player.takeDamage(40,{});assert.equal(player.health,COMBAT.maxHealth-40);
});

test('передового врага может ранить игрок, но не боты-союзники',()=>{
  const scene=new THREE.Scene();const bot=new Bot('Цель','defenders',scene,0);bot.playerTarget=true;bot.spawn({x:0,z:0});
  bot.takeDamage(120,{isPlayer:false});assert.equal(bot.health,COMBAT.maxHealth);
  bot.takeDamage(40,{isPlayer:true});assert.equal(bot.health,COMBAT.maxHealth-40);bot.dispose();
});

test('бот-террорист получает бомбу и устанавливает её даже в состоянии атаки',()=>{
  const carrier={team:'attackers',alive:true,isPlayer:false,hasBomb:false,state:'attack',position:new THREE.Vector3(),addMoney(){}};
  const player={team:'attackers',alive:true,isPlayer:true,inventory:{slots:{bomb:false}},position:new THREE.Vector3()};
  const game={scene:new THREE.Scene(),settings:{values:{bombTime:40}},player,botManager:{bots:[carrier],alive:()=>[]},mapConfig:MAP_CONFIG,hud:{interaction(){},message(){}},audio:{tone(){},explosion(){}},explosion:{spawn(){}}};
  const mode=new BombDefusalMode(game,{state:'live',end(){}});mode.beginRound();assert.equal(mode.carrier,carrier);assert.ok(carrier.bombSite);
  carrier.position.set(carrier.bombSite.x,0,carrier.bombSite.z);mode.updatePlant(3.3);assert.equal(mode.planted,true);assert.equal(mode.carrier,null);mode.dispose();
});

test('другой бот подбирает выпавшую бомбу и получает новую точку',()=>{
  const picker={team:'attackers',alive:true,isPlayer:false,hasBomb:false,position:new THREE.Vector3(4,0,4)};
  const player={team:'defenders',alive:true,isPlayer:true,position:new THREE.Vector3(50,0,50),inventory:{slots:{bomb:false}}};
  const game={scene:new THREE.Scene(),settings:{values:{bombTime:40}},player,botManager:{bots:[picker],alive:()=>[picker]},mapConfig:MAP_CONFIG,hud:{interaction(){},message(){}},audio:{tone(){},explosion(){}},explosion:{spawn(){}}};
  const mode=new BombDefusalMode(game,{state:'live',end(){}});mode.drop(picker.position);mode.updatePlant(.1);
  assert.equal(mode.carrier,picker);assert.equal(picker.hasBomb,true);assert.ok(picker.bombSite);mode.dispose();
});

test('бот строит проходимый маршрут от базы к точке и действительно движется',()=>{
  const collision=new CollisionWorld(MAP_CONFIG);const navigation=new BotNavigation(new NavigationGraph(MAP_CONFIG),collision);
  const bot={index:1,position:new THREE.Vector3(MAP_CONFIG.attackerSpawns[0].x,0,MAP_CONFIG.attackerSpawns[0].z),velocity:new THREE.Vector3()};
  navigation.setTarget(bot,new THREE.Vector3(MAP_CONFIG.bombSites[0].x,0,MAP_CONFIG.bombSites[0].z));
  assert.ok(navigation.path.length>1);
  for(const [start,target] of [
    [MAP_CONFIG.attackerSpawns[0],MAP_CONFIG.bombSites[0]],
    [MAP_CONFIG.attackerSpawns[0],MAP_CONFIG.bombSites[1]],
    [MAP_CONFIG.defenderSpawns[0],MAP_CONFIG.bombSites[0]],
    [MAP_CONFIG.defenderSpawns[0],MAP_CONFIG.bombSites[1]]
  ])assert.ok(navigation.gridPath(start,target).length>1,`нет маршрута ${start.x},${start.z} -> ${target.id}`);
  const start=bot.position.clone();for(let i=0;i<60;i++)navigation.update(bot,1/60,4.1);
  assert.ok(bot.position.distanceTo(start)>2.5);
  assert.equal(collision.intersects(bot.position.x,bot.position.z,.55),false);
});

test('бот после реакции расходует патрон и создаёт вспышку выстрела',()=>{
  const bot={weapon:WEAPONS.ak47,ammo:30,reserve:90,reloadTime:0,state:'attack',position:new THREE.Vector3(),velocity:new THREE.Vector3(),flashTime:0,kills:0,addMoney(){}};
  const target={alive:true,position:new THREE.Vector3(12,0,0),armor:0,helmet:false,takeDamage(){return false;}};
  const combat=new BotCombat(bot,'expert',null);combat.update(.2,target,true);
  assert.equal(bot.ammo,29);assert.ok(bot.flashTime>0);
});
