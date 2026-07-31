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
  assert.equal(input.action('crouch'),true);assert.equal(input.action('forward'),true);assert.equal(prevented,2);
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

test('классическая модель AK имеет приклад, магазин и угловатые материалы',()=>{
  const gun=new Firearm(WEAPONS.ak47);const player={alive:true,velocity:new THREE.Vector3(),inventory:{active:gun}};const camera=new THREE.Group();
  const manager=new WeaponManager(camera,player,{}, {}, {weapon:()=>({colors:[0x343a34,0x151816]})});
  assert.ok(manager.group.getObjectByName('wood-stock'));assert.ok(manager.group.getObjectByName('magazine-lower'));
  assert.equal(manager.group.getObjectByName('receiver').material.flatShading,true);
});

test('основные винтовки имеют отдельные классические модели AK-47 и M4A4',()=>{
  const skinManager={weapon:()=>({colors:[0x343a34,0x151816]})};
  const akManager=new WeaponManager(new THREE.Group(),{alive:true,velocity:new THREE.Vector3(),inventory:{active:new Firearm(WEAPONS.ak47)}},{},{},skinManager);
  assert.ok(akManager.group.getObjectByName('wood-upper-handguard'));assert.ok(akManager.group.getObjectByName('magazine-middle'));assert.ok(akManager.group.getObjectByName('ak-muzzle-brake'));
  const m4Manager=new WeaponManager(new THREE.Group(),{alive:true,velocity:new THREE.Vector3(),inventory:{active:new Firearm(WEAPONS.m4a1)}},{},{},skinManager);
  assert.equal(WEAPONS.m4a1.name,'M4A4');assert.ok(m4Manager.group.getObjectByName('m4-stock'));assert.ok(m4Manager.group.getObjectByName('m4-handguard'));assert.ok(m4Manager.group.getObjectByName('m4-carry-handle'));assert.ok(m4Manager.group.getObjectByName('m4-magazine'));
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
