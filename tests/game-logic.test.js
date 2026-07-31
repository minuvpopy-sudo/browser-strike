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
import { BotAI } from '../src/bots/BotAI.js';
import { BOT_FRONTLINE_SPAWNS } from '../src/bots/BotManager.js';
import { Player } from '../src/player/Player.js';
import { Bot } from '../src/bots/Bot.js';
import { BombDefusalMode } from '../src/modes/BombDefusalMode.js';
import { BuyMenu } from '../src/ui/BuyMenu.js';
import { applyDamageSafely, selectMeleeTarget } from '../src/core/CombatResolver.js';
import { InputManager } from '../src/core/InputManager.js';
import { GameLoop } from '../src/core/GameLoop.js';
import { KNIFE_SKINS } from '../src/skins/KnifeSkinDefinitions.js';
import { animateKnifeWaves, collectKnifeWaveMaterials, createKnifeBladeMaterial, disposeKnifeMaterial } from '../src/skins/KnifeMaterial.js';
import { SkinPreview } from '../src/skins/SkinPreview.js';
import { PlayerInventory } from '../src/player/PlayerInventory.js';
import { PlayerMovement } from '../src/player/PlayerMovement.js';
import { AutoUpdater, versionedPageUrl } from '../src/core/AutoUpdater.js';
import { selectSpectatorTarget, takeOverBotState } from '../src/core/SpectatorMode.js';
import { SHOT_PROFILES, SHOT_SAMPLES, shotProfile } from '../src/core/AudioManager.js';

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

test('боты разных команд могут ранить и убивать друг друга',()=>{
  const scene=new THREE.Scene();const bot=new Bot('Цель','defenders',scene,0);bot.playerTarget=true;bot.spawn({x:0,z:0});
  bot.spawnProtectedUntil=0;bot.takeDamage(40,{isPlayer:false,team:'attackers'});assert.equal(bot.health,COMBAT.maxHealth-40);
  bot.takeDamage(COMBAT.maxHealth,{isPlayer:false,team:'attackers'});assert.equal(bot.alive,false);bot.dispose();
});

test('все боты, включая передового, закупают оружие и снаряжение при появлении',()=>{
  const scene=new THREE.Scene();
  const attacker=new Bot('Штурм','attackers',scene,0);attacker.playerTarget=true;attacker.spawn({x:0,z:0});
  assert.equal(attacker.weapon,WEAPONS.deagle);assert.equal(attacker.money,150);assert.equal(attacker.ammo,WEAPONS.deagle.mag);
  const defender=new Bot('Опора','defenders',scene,1);defender.money=3400;defender.spawn({x:0,z:0});
  assert.equal(defender.weapon,WEAPONS.famas);assert.equal(defender.defuseKit,true);assert.equal(defender.armor,100);
  assert.ok(defender.group.getObjectByName('weapon').scale.z>1);
  attacker.dispose();defender.dispose();
});

test('бот-террорист получает бомбу и устанавливает её даже в состоянии атаки',()=>{
  const carrier={team:'attackers',alive:true,isPlayer:false,hasBomb:false,state:'attack',position:new THREE.Vector3(),addMoney(){}};
  const player={team:'defenders',alive:true,isPlayer:true,inventory:{slots:{bomb:false}},position:new THREE.Vector3()};
  const game={scene:new THREE.Scene(),settings:{values:{bombTime:40}},player,botManager:{bots:[carrier],alive:()=>[]},mapConfig:MAP_CONFIG,hud:{interaction(){},message(){}},audio:{tone(){},explosion(){}},explosion:{spawn(){}}};
  const mode=new BombDefusalMode(game,{state:'live',end(){}});mode.beginRound();assert.equal(mode.carrier,carrier);assert.ok(carrier.bombSite);
  carrier.position.set(carrier.bombSite.x,0,carrier.bombSite.z);mode.updatePlant(3.3);assert.equal(mode.planted,true);assert.equal(mode.carrier,null);mode.dispose();
});

test('игрок-террорист всегда получает бомбу, даже если в команде есть живые боты',()=>{
  const bot={team:'attackers',alive:true,isPlayer:false,hasBomb:true,position:new THREE.Vector3()};
  const player={team:'attackers',alive:true,isPlayer:true,hasBomb:false,inventory:{slots:{bomb:false}},position:new THREE.Vector3()};
  const game={scene:new THREE.Scene(),settings:{values:{bombTime:40}},player,botManager:{bots:[bot]},mapConfig:MAP_CONFIG};
  const mode=new BombDefusalMode(game,{state:'live'});mode.beginRound();
  assert.equal(mode.carrier,player);assert.equal(player.hasBomb,true);assert.equal(player.inventory.slots.bomb,true);assert.equal(bot.hasBomb,false);mode.dispose();
});

test('другой бот подбирает выпавшую бомбу и получает новую точку',()=>{
  const picker={team:'attackers',alive:true,isPlayer:false,hasBomb:false,position:new THREE.Vector3(4,0,4)};
  const player={team:'defenders',alive:true,isPlayer:true,position:new THREE.Vector3(50,0,50),inventory:{slots:{bomb:false}}};
  const game={scene:new THREE.Scene(),settings:{values:{bombTime:40}},player,botManager:{bots:[picker],alive:()=>[picker]},mapConfig:MAP_CONFIG,hud:{interaction(){},message(){}},audio:{tone(){},explosion(){}},explosion:{spawn(){}}};
  const mode=new BombDefusalMode(game,{state:'live',end(){}});mode.carrier=picker;picker.hasBomb=true;assert.equal(mode.drop(picker.position),true);mode.updatePlant(.1);assert.equal(mode.carrier,null);mode.pickupCooldown=0;mode.updatePlant(.1);
  assert.equal(mode.carrier,picker);assert.equal(picker.hasBomb,true);assert.ok(picker.bombSite);mode.dispose();
});

test('бомба без ошибки берётся в руки и после выбрасывания сменяется на оружие',()=>{
  const inventory=new PlayerInventory('attackers',{type:'karambit',skin:'classic'});inventory.setBomb(true);assert.equal(inventory.equip('bomb'),true);
  const player={alive:true,velocity:new THREE.Vector3(),inventory};
  const manager=new WeaponManager(new THREE.Group(),player,{justPressed:()=>false,consumeWheel:()=>0,mouseButtons:new Set()},{},{weapon:()=>({colors:[0x333333,0x111111]}),knifeStyle:()=>({blade:0xcccccc,handle:0x222222})});
  assert.doesNotThrow(()=>manager.update(1/60));assert.ok(manager.group.getObjectByName('held-bomb'));
  inventory.setBomb(false);assert.notEqual(inventory.activeSlot,'bomb');assert.ok(inventory.active);assert.doesNotThrow(()=>manager.update(1/60));
});

test('столкновение со стеной гасит скорость по оси и не отбрасывает игрока назад',()=>{
  const collision=new CollisionWorld({scale:1,walls:[{x:1,z:0,y:1,w:1,d:4,h:2}],crates:[]});
  const start=new THREE.Vector3(0,0,0);const moved=collision.moveCircle(start,{x:1.5,z:.6},.5);
  assert.equal(moved.blockedX,true);assert.ok(moved.x>=start.x);assert.ok(moved.z>start.z);assert.ok(moved.z<=.600001);

  const player={alive:true,position:start.clone(),velocity:new THREE.Vector3(6,0,0),inventory:{active:null}};
  const input={action:(name)=>name==='right',justPressed:()=>false};
  const movement=new PlayerMovement(player,collision,input);movement.update(1/60,0,{autoBhop:false},{step(){throw new Error('шаги не должны звучать');},tone(){throw new Error('стуки не должны звучать');}});
  assert.equal(player.velocity.x,0);assert.ok(player.position.x>=0);
});

test('единичный скачок мыши не разворачивает камеру',()=>{
  const originalDocument=globalThis.document;const element={};globalThis.document={pointerLockElement:element};
  try{
    const input=new InputManager(element,{values:{keys:{}}});input.enabled=true;input.onMouseMove({movementX:10000,movementY:-10000});
    assert.deepEqual(input.consumeLook(),{x:120,y:-120});
  }finally{globalThis.document=originalDocument;}
});

test('запасной режим мыши сохраняет прицеливание и стрельбу без Pointer Lock',()=>{
  const originalDocument=globalThis.document;const element={};globalThis.document={pointerLockElement:null};
  try{
    const input=new InputManager(element,{values:{keys:{}}});input.enabled=true;input.fallbackLook=true;let prevented=0;
    input.onMouseMove({movementX:24,movementY:-8});input.onMouseDown({button:2,preventDefault(){prevented++;}});input.onMouseDown({button:0,preventDefault(){prevented++;}});
    assert.deepEqual(input.consumeLook(),{x:24,y:-8});assert.equal(input.mouseButtons.has(2),true);assert.equal(input.mouseButtons.has(0),true);assert.equal(prevented,2);
  }finally{globalThis.document=originalDocument;}
});

test('новая опубликованная версия автоматически обходит кэш браузера',async()=>{
  let replaced='';
  const updater=new AutoUpdater({
    version:'old',
    fetcher:async()=>({ok:true,json:async()=>({version:'new'})}),
    locationRef:{href:'https://example.test/browser-strike/?team=t',replace(url){replaced=url;}},
    documentRef:{baseURI:'https://example.test/browser-strike/',hidden:false},
    canReload:()=>true
  });
  assert.equal(await updater.check(),true);
  assert.equal(new URL(replaced).searchParams.get('bs-version'),'new');
  assert.equal(new URL(versionedPageUrl('https://example.test/game?x=1','v2')).searchParams.get('x'),'1');
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
  let unwantedSounds=0;const combat=new BotCombat(bot,'expert',{shot(){unwantedSounds++;}});combat.update(.2,target,true);
  assert.equal(bot.ammo,29);assert.ok(bot.flashTime>0);
  assert.equal(unwantedSounds,0);
});

test('бот замечает врага, стрейфит и стреляет в ответ',()=>{
  const scene=new THREE.Scene();const bot=new Bot('Охотник','defenders',scene,2);bot.spawn({x:0,z:0});bot.weapon=WEAPONS.m4a1;bot.ammo=30;bot.state='patrol';bot.spawnProtectedUntil=0;
  const enemy={team:'attackers',alive:true,isPlayer:false,position:new THREE.Vector3(0,0,10),armor:0,helmet:false,takeDamage(){return false;}};
  const collision={bounds:{minX:-30,maxX:30,minZ:-30,maxZ:30},segmentBlocked:()=>false,intersects:()=>false,moveCircle:(p,d)=>({x:p.x+d.x,z:p.z+d.z,blockedX:false,blockedZ:false})};
  const graph={nodes:new Map([['center',{x:0,z:0}],['left',{x:-10,z:8}],['right',{x:10,z:8}]]),path:()=>[]};
  const ai=new BotAI(bot,graph,collision,'expert',null);for(let i=0;i<14;i++)ai.update(.1,[enemy],new THREE.Vector3(0,0,20),null);
  assert.ok(bot.ammo<30);assert.ok(['attack','see-enemy','return-fire'].includes(bot.state));assert.ok(Math.abs(bot.position.x)>.05);bot.dispose();
});

test('бот не знает позицию врага за стеной и вместо погони проверяет маршрут',()=>{
  const scene=new THREE.Scene();const bot=new Bot('Разведчик','attackers',scene,1);bot.spawn({x:0,z:0});bot.state='patrol';
  const hiddenEnemy={team:'defenders',alive:true,isPlayer:false,position:new THREE.Vector3(20,0,0)};
  const collision={bounds:{minX:-30,maxX:30,minZ:-30,maxZ:30},segmentBlocked:()=>true,intersects:()=>false,moveCircle:(p,d)=>({x:p.x+d.x,z:p.z+d.z,blockedX:false,blockedZ:false})};
  const graph={nodes:new Map([['a',{x:0,z:0}],['b',{x:0,z:12}],['c',{x:-12,z:5}]]),path:()=>[]};
  const ai=new BotAI(bot,graph,collision,'normal',null);ai.update(.2,[hiddenEnemy],new THREE.Vector3(0,0,18),null);
  assert.equal(ai.target,null);assert.equal(bot.lastSeen,null);assert.ok(ai.patrolTarget);assert.ok(ai.navigation.target.distanceToSquared(hiddenEnemy.position)>4);bot.dispose();
});

test('меню покупки не пересоздаёт кнопки каждый кадр',()=>{
  const menu=Object.create(BuyMenu.prototype);let renders=0,statusUpdates=0;
  menu.root={classList:{contains:()=>true}};menu.category='rifles';menu.itemsKey='';
  menu.updateStatus=()=>{statusUpdates++;};menu.renderItems=()=>{const key=`${menu.category}|${menu.context.player.money}|${menu.context.player.team}|${menu.context.inBuyZone}|${menu.context.buyTime>0}`;if(menu.itemsKey===key)return;menu.itemsKey=key;renders++;};
  const player={money:5000,team:'attackers'};
  menu.update({player,inBuyZone:true,buyTime:25});
  menu.update({player,inBuyZone:true,buyTime:24.98});
  assert.equal(statusUpdates,2);assert.equal(renders,1);
  player.money-=2500;menu.update({player,inBuyZone:true,buyTime:24.9});assert.equal(renders,2);
});

test('удар ножом попадает в цель перед игроком и не выбирает цель за стеной',()=>{
  const origin=new THREE.Vector3(0,1.6,0),direction=new THREE.Vector3(0,0,-1);
  const close={alive:true,position:new THREE.Vector3(.45,0,-2.4)};
  const behind={alive:true,position:new THREE.Vector3(0,0,1)};
  assert.equal(selectMeleeTarget({origin,direction,targets:[behind,close],range:2.8}),close);
  assert.equal(selectMeleeTarget({origin,direction,targets:[close],range:2.8,isBlocked:()=>true}),null);
});

test('некорректная цель попадания не останавливает игру исключением',()=>{
  let reported=false;
  const result=applyDamageSafely({alive:true,takeDamage(){throw new Error('bad target');}},35,{},()=>{reported=true;});
  assert.deepEqual(result,{applied:false,died:false});assert.equal(reported,true);
  assert.deepEqual(applyDamageSafely({alive:true},35,{}),{applied:false,died:false});
});

test('Ctrl и сочетания с ним перехватываются игрой без команды браузеру',()=>{
  const settings={values:{keys:{crouch:'ControlLeft',forward:'KeyW'}}};
  const input=new InputManager({},settings);input.enabled=true;let prevented=0;
  input.onKeyDown({code:'ControlRight',ctrlKey:true,preventDefault(){prevented++;}});
  input.onKeyDown({code:'KeyW',ctrlKey:true,preventDefault(){prevented++;}});
  input.onKeyDown({code:'KeyV',ctrlKey:true,preventDefault(){prevented++;}});
  input.onKeyDown({code:'F4',altKey:true,preventDefault(){prevented++;}});
  input.onPaste({preventDefault(){prevented++;}});
  assert.equal(input.action('crouch'),true);assert.equal(input.action('forward'),true);assert.equal(prevented,5);
  input.onKeyUp({code:'ControlRight'});assert.equal(input.action('crouch'),false);
});

test('игровой цикл продолжает следующий кадр после единичной ошибки',()=>{
  const original=globalThis.requestAnimationFrame;let reported=false;
  globalThis.requestAnimationFrame=()=>77;
  try{
    const loop=new GameLoop(()=>{throw new Error('frame');},()=>{},1/60,()=>{reported=true;});
    loop.running=true;loop.last=0;loop.tick(20);
    assert.equal(reported,true);assert.equal(loop.frame,77);assert.equal(loop.accumulator,0);
  }finally{globalThis.requestAnimationFrame=original;}
});

test('повторяющаяся ошибка получает короткую паузу и не забивает каждый кадр',()=>{
  const original=globalThis.requestAnimationFrame;let updates=0,reports=0;
  globalThis.requestAnimationFrame=()=>91;
  try{
    const loop=new GameLoop(()=>{updates++;throw new Error('repeat');},()=>{},1/60,()=>{reports++;});
    loop.running=true;loop.last=0;loop.tick(20);loop.tick(30);
    assert.equal(updates,1);assert.equal(reports,1);assert.ok(loop.errorCooldown>0);assert.equal(loop.frame,91);
  }finally{globalThis.requestAnimationFrame=original;}
});

test('меню покупки активирует товар одним событием',()=>{
  const menu=Object.setPrototypeOf(new EventTarget(),BuyMenu.prototype);let item=null;
  menu.addEventListener('buy',(event)=>{item=event.detail;});
  menu.activate(WEAPONS.ak47,true);
  assert.equal(item,WEAPONS.ak47);
});

test('классическая модель AK имеет приклад, магазин и скруглённые края',()=>{
  const gun=new Firearm(WEAPONS.ak47);const player={alive:true,velocity:new THREE.Vector3(),inventory:{active:gun}};const camera=new THREE.Group();
  const manager=new WeaponManager(camera,player,{}, {}, {weapon:()=>({colors:[0x343a34,0x151816]})});
  assert.ok(manager.group.getObjectByName('wood-stock'));assert.ok(manager.group.getObjectByName('magazine-lower'));
  assert.equal(manager.group.getObjectByName('receiver').geometry.userData.rounded,true);assert.notEqual(manager.group.getObjectByName('receiver').geometry.type,'BoxGeometry');
});

test('основные винтовки имеют отдельные классические модели AK-47 и M4A4',()=>{
  const skinManager={weapon:()=>({colors:[0x343a34,0x151816]})};
  const akManager=new WeaponManager(new THREE.Group(),{alive:true,velocity:new THREE.Vector3(),inventory:{active:new Firearm(WEAPONS.ak47)}},{},{},skinManager);
  assert.ok(akManager.group.getObjectByName('wood-upper-handguard'));assert.ok(akManager.group.getObjectByName('magazine-middle'));assert.ok(akManager.group.getObjectByName('ak-muzzle-brake'));
  const m4Manager=new WeaponManager(new THREE.Group(),{alive:true,velocity:new THREE.Vector3(),inventory:{active:new Firearm(WEAPONS.m4a1)}},{},{},skinManager);
  assert.equal(WEAPONS.m4a1.name,'M4A4');assert.ok(m4Manager.group.getObjectByName('m4-stock'));assert.ok(m4Manager.group.getObjectByName('m4-handguard'));assert.ok(m4Manager.group.getObjectByName('m4-carry-handle'));assert.ok(m4Manager.group.getObjectByName('m4-magazine'));
});

test('все винтовки имеют сглаженные корпуса и свои узнаваемые детали',()=>{
  const skinManager={weapon:()=>({colors:[0x343a34,0x151816]})};
  const markers={ak47:'wood-stock',m4a1:'m4-stock',galil:'galil-stock',famas:'famas-bullpup-stock',scout:'scout-bolt',awp:'awp-heavy-barrel',sg552:'sg552-stock',aug:'aug-bullpup-body',g3sg1:'g3sg1-marksman-stock',sg550:'sg550-marksman-stock'};
  for(const definition of Object.values(WEAPONS).filter((weapon)=>weapon.category==='rifles')){
    const manager=new WeaponManager(new THREE.Group(),{alive:true,velocity:new THREE.Vector3(),inventory:{active:new Firearm(definition)}},{},{},skinManager);
    assert.equal(manager.group.getObjectByName('receiver').geometry.userData.rounded,true,definition.id);assert.ok(manager.group.getObjectByName(markers[definition.id]),definition.id);
  }
});

test('пистолеты не состоят из квадратных блоков и имеют свои детали',()=>{
  const skinManager={weapon:()=>({colors:[0x343a34,0x151816]})};
  for(const definition of Object.values(WEAPONS).filter((weapon)=>weapon.category==='pistols')){
    const manager=new WeaponManager(new THREE.Group(),{alive:true,velocity:new THREE.Vector3(),inventory:{active:new Firearm(definition)}},{},{},skinManager);
    assert.equal(manager.group.getObjectByName('receiver').geometry.userData.rounded,true,definition.id);assert.ok(manager.group.getObjectByName('ejection-port'),definition.id);
    if(definition.id==='usp')assert.ok(manager.group.getObjectByName('usp-suppressor'));if(definition.id==='elites')assert.ok(manager.group.getObjectByName('receiver-dual'));
  }
});

test('оптический прицел скрывает модель винтовки и включает режим перекрестия',()=>{
  const gun=new Firearm(WEAPONS.awp);const inventory={active:gun,equip(){},quickSwap(){},cycle(){}};const player={alive:true,velocity:new THREE.Vector3(),inventory};
  const scopeSounds=[];const input={justPressed:()=>false,consumeWheel:()=>0,mouseButtons:new Set([2])};const manager=new WeaponManager(new THREE.Group(),player,input,{scope:(enabled)=>scopeSounds.push(enabled)},{weapon:()=>({colors:[0x343a34,0x151816]})});
  manager.handleInput({speed:0,crouched:false,grounded:true},{direction:()=>new THREE.Vector3(0,0,-1)});assert.equal(manager.scoped,true);assert.equal(manager.group.visible,false);assert.ok(manager.group.getObjectByName('scope-lens'));
  manager.handleInput({speed:0,crouched:false,grounded:true},{direction:()=>new THREE.Vector3(0,0,-1)});input.mouseButtons.clear();manager.handleInput({speed:0,crouched:false,grounded:true},{direction:()=>new THREE.Vector3(0,0,-1)});assert.deepEqual(scopeSounds,[true,false]);
});

test('скин «Волны» создаёт анимированный чёрно-синий металлический материал',()=>{
  assert.equal(KNIFE_SKINS.waves.pattern,'waves');
  const material=createKnifeBladeMaterial(KNIFE_SKINS.waves);
  const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material));const waveMaterials=collectKnifeWaveMaterials(root);
  animateKnifeWaves(waveMaterials,1);assert.equal(material.userData.animatedWaves,true);assert.equal(material.type,'MeshStandardMaterial');assert.ok(material.metalness>=.9);assert.equal(waveMaterials.length,1);disposeKnifeMaterial(material);
});

test('скрытый предпросмотр ножа не изменяет размер и не запускает WebGL-рендер',()=>{
  const preview=Object.create(SkinPreview.prototype);preview.canvas={clientWidth:0,clientHeight:0};preview.pixelRatio=1.75;
  preview.renderer={setSize(){throw new Error('hidden preview rendered');}};preview.camera={};
  assert.equal(preview.resize(),false);
});

test('керамбит имеет кольцо, изогнутый клинок и многоосевую анимацию осмотра',()=>{
  const knife=new Knife(WEAPONS.knife,'karambit','classic');const player={alive:true,velocity:new THREE.Vector3(),inventory:{active:knife}};const camera=new THREE.Group();
  const manager=new WeaponManager(camera,player,{}, {}, {knifeStyle:()=>({blade:0xcccccc,handle:0x222222})});
  const pivot=manager.group.getObjectByName('karambit-pivot');const ring=manager.group.getObjectByName('karambit-ring');const blade=manager.group.getObjectByName('karambit-blade');
  assert.ok(pivot);assert.ok(ring);assert.ok(blade);assert.ok(manager.group.getObjectByName('karambit-handle'));assert.ok(manager.group.getObjectByName('karambit-edge'));
  blade.geometry.computeBoundingBox();const bladeSize=new THREE.Vector3();blade.geometry.boundingBox.getSize(bladeSize);
  assert.ok(bladeSize.y>1.7);assert.ok(bladeSize.x>1.1);assert.ok(ring.geometry.parameters.radius>=.2);assert.ok(Math.abs(ring.rotation.x-Math.PI/2)<.001);assert.ok(pivot.position.z>.9);
  manager.drawTime=0;knife.inspecting=2;manager.update(.08);
  assert.notEqual(pivot.rotation.y,0);assert.notEqual(manager.group.rotation.z,manager.group.userData.baseRotation.z);
});

test('наблюдение выбирает только живого союзного бота и сохраняет выбранного',()=>{
  const player={team:'attackers',position:new THREE.Vector3()};
  const enemy={team:'defenders',alive:true,position:new THREE.Vector3(1,0,0)};
  const far={team:'attackers',alive:true,position:new THREE.Vector3(8,0,0)};
  const near={team:'attackers',alive:true,position:new THREE.Vector3(3,0,0)};
  assert.equal(selectSpectatorTarget(player,[enemy,far,near]),near);
  assert.equal(selectSpectatorTarget(player,[enemy,far,near],far),far);
  near.alive=false;far.alive=false;assert.equal(selectSpectatorTarget(player,[enemy,far,near]),null);
});

test('подключение за бота переносит позицию, здоровье, оружие и бомбу игроку',()=>{
  const knife={type:'karambit',skin:'waves'};const player=new Player('attackers',knife);player.alive=false;player.health=0;
  const bot={team:'attackers',alive:true,state:'attack',position:new THREE.Vector3(12,0,-7),velocity:new THREE.Vector3(2,0,1),health:83,armor:64,helmet:true,defuseKit:false,money:2750,weapon:WEAPONS.ak47,ammo:17,reserve:43,hasBomb:true,bombSite:{id:'A'},group:{visible:true}};
  const result=takeOverBotState(player,bot,knife);
  assert.ok(result);assert.equal(player.alive,true);assert.deepEqual(player.position,bot.position);assert.equal(player.health,83);assert.equal(player.armor,64);assert.equal(player.inventory.active.definition.id,'ak47');assert.equal(player.inventory.active.ammo,17);assert.equal(player.inventory.active.reserve,43);assert.ok(player.inventory.slots.bomb);assert.equal(bot.alive,false);assert.equal(bot.group.visible,false);
});

test('Glock-18 использует отдельный многослойный профиль настоящего выстрела',()=>{
  const profile=shotProfile(WEAPONS.glock);
  assert.equal(profile,SHOT_PROFILES.glock);assert.ok(profile.crack.duration<profile.tail.duration);assert.ok(profile.crack.lowpass>profile.tail.lowpass);assert.ok(profile.body.frequency>profile.body.endFrequency);assert.ok(profile.slide.delay>0);assert.equal(shotProfile(WEAPONS.ak47),null);assert.equal(SHOT_SAMPLES.glock.path,'audio/glock-shot.mp3');assert.ok(SHOT_SAMPLES.glock.duration<.7);
  assert.deepEqual(Object.keys(SHOT_SAMPLES).sort(),['awp','deagle','glock','m4a1','usp']);assert.ok(SHOT_SAMPLES.m4a1.duration<.25);assert.ok(SHOT_SAMPLES.awp.duration>SHOT_SAMPLES.m4a1.duration);
});
