import * as THREE from 'three';
import { GameLoop } from './GameLoop.js';
import { InputManager } from './InputManager.js';
import { AssetManager } from './AssetManager.js';
import { MAP_CONFIG } from '../map/MapConfig.js';
import { DustInspiredMap } from '../map/DustInspiredMap.js';
import { CollisionWorld } from '../map/CollisionWorld.js';
import { NavigationGraph } from '../map/NavigationGraph.js';
import { getSpawn, randomSpawn } from '../map/SpawnPoints.js';
import { Player } from '../player/Player.js';
import { PlayerInventory } from '../player/PlayerInventory.js';
import { PlayerMovement } from '../player/PlayerMovement.js';
import { PlayerCamera } from '../player/PlayerCamera.js';
import { PlayerController } from '../player/PlayerController.js';
import { WeaponManager } from '../weapons/WeaponManager.js';
import { Firearm } from '../weapons/Firearm.js';
import { WEAPONS, EQUIPMENT, GRENADES } from '../weapons/WeaponDefinitions.js';
import { GrenadeSystem } from '../weapons/GrenadeSystem.js';
import { hitDamage } from '../config/MatchRules.js';
import { applyDamageSafely, selectMeleeTarget } from './CombatResolver.js';
import { BotManager } from '../bots/BotManager.js';
import { RoundManager } from '../modes/RoundManager.js';
import { BombDefusalMode } from '../modes/BombDefusalMode.js';
import { TeamDeathmatchMode } from '../modes/TeamDeathmatchMode.js';
import { BulletImpactPool } from '../effects/BulletImpact.js';
import { BloodEffect } from '../effects/BloodEffect.js';
import { SmokeEffect } from '../effects/SmokeEffect.js';
import { ExplosionEffect } from '../effects/ExplosionEffect.js';
import { HUD } from '../ui/HUD.js';
import { BuyMenu } from '../ui/BuyMenu.js';
import { PauseMenu } from '../ui/PauseMenu.js';
import { Scoreboard } from '../ui/Scoreboard.js';
import { EndRoundScreen } from '../ui/EndRoundScreen.js';

export class Game extends EventTarget {
  constructor({settings,save,audio,skinManager,mainMenu,teamMenu}) {
    super();Object.assign(this,{settings,save,audio,skinManager,mainMenu,teamMenu});this.viewport=document.getElementById('viewport');this.renderer=new THREE.WebGLRenderer({antialias:settings.values.antialias,powerPreference:'high-performance'});this.renderer.setAnimationLoop(null);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.LinearToneMapping;this.renderer.toneMappingExposure=1.35;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.viewport.append(this.renderer.domElement);this.input=new InputManager(this.viewport,settings);this.assets=new AssetManager();this.hud=new HUD();this.buyMenu=new BuyMenu();this.pauseMenu=new PauseMenu();this.scoreboard=new Scoreboard();this.endScreen=new EndRoundScreen();this.active=false;this.paused=false;this.modalOpen=false;this.returnToPause=false;this.spotted=new Map();this.bindPermanentEvents();this.resize();
  }
  bindPermanentEvents(){window.addEventListener('resize',()=>this.resize());const requestPlay=()=>{if(this.active&&!this.paused&&!this.modalOpen){this.audio.unlock();this.input.lock();}};this.viewport.addEventListener('click',requestPlay);document.getElementById('click-to-play').addEventListener('click',requestPlay);this.input.addEventListener('lockerror',()=>{this.input.enabled=true;document.getElementById('click-to-play').classList.remove('visible');this.hud.message('Захват курсора недоступен: включён запасной режим управления');});this.input.addEventListener('lockchange',e=>{if(!this.active)return;if(e.detail){this.input.enabled=true;document.getElementById('click-to-play').classList.remove('visible');}else{this.input.enabled=false;if(!this.modalOpen&&this.player?.alive&&!this.leaving)this.pause();}});this.buyMenu.addEventListener('buy',e=>this.purchase(e.detail));this.buyMenu.addEventListener('denied',()=>{this.audio.empty();this.hud.message('Покупка недоступна','error');});this.pauseMenu.addEventListener('resume',()=>this.resume());this.pauseMenu.addEventListener('leave',()=>this.leave());this.pauseMenu.addEventListener('settings',()=>{this.returnToPause=true;this.mainMenu.open('settings-menu');});this.mainMenu.addEventListener('open',e=>{if(e.detail==='main-menu'&&this.returnToPause){this.returnToPause=false;this.mainMenu.open('game-screen');this.pauseMenu.show();}});window.addEventListener('keydown',e=>{if(!this.active)return;if(this.buyMenu.visible&&(e.code==='Escape'||e.code===this.settings.values.keys.buy)){e.preventDefault();this.closeBuy();}else if(this.buyMenu.visible&&/^Digit[1-9]$/.test(e.code)){const i=Number(e.code.at(-1))-1;this.buyMenu.items.children[i]?.click();}});}
  async start({team,mode}){this.disposeMatch();this.leaving=false;this.active=true;this.modeId=mode;this.mapConfig=MAP_CONFIG;this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x9fb7bf);this.scene.fog=new THREE.Fog(0xa9b2a4,85,this.settings.values.drawDistance);this.camera=new THREE.PerspectiveCamera(this.settings.values.fov,innerWidth/innerHeight,.08,this.settings.values.drawDistance);this.scene.add(this.camera);this.setupLights();this.collision=new CollisionWorld(MAP_CONFIG);this.navigation=new NavigationGraph(MAP_CONFIG);this.map=new DustInspiredMap(this.scene,MAP_CONFIG,this.settings).build();await this.assets.loadUserConfig();
    this.player=new Player(team,this.skinManager.knife);this.player.spawn(getSpawn(team,0));this.playerMovement=new PlayerMovement(this.player,this.collision,this.input);this.playerCamera=new PlayerCamera(this.camera,this.player,this.input,this.settings);this.weaponManager=new WeaponManager(this.camera,this.player,this.input,this.audio,this.skinManager);this.playerController=new PlayerController(this.player,this.playerMovement,this.playerCamera,this.input,this.weaponManager);this.botManager=new BotManager(this.scene,this.navigation,this.collision,this.audio,this.settings);this.botManager.create(this.settings.values.botsPerTeam);this.botManager.spawnAll();this.impacts=new BulletImpactPool(this.scene);this.blood=new BloodEffect(this.scene);this.smoke=new SmokeEffect(this.scene);this.explosion=new ExplosionEffect(this.scene);this.grenades=new GrenadeSystem(this);this.bindMatchEvents();this.setupMode();this.loop=new GameLoop(dt=>this.fixedUpdate(dt),(dt)=>this.render(dt),1/60,error=>this.handleLoopError(error));this.input.attach();this.input.enabled=false;this.mainMenu.open('game-screen');document.getElementById('game-screen').classList.add('active');document.getElementById('click-to-play').classList.add('visible');this.resize();this.loop.start();this.hud.message(mode==='bomb'?'Раунд начался':'Командный бой начался');}
  setupLights(){const hemi=new THREE.HemisphereLight(0xdcecff,0x8a714d,1.8);this.scene.add(hemi);this.scene.add(new THREE.AmbientLight(0xfff0d2,.55));const sun=new THREE.DirectionalLight(0xffe3b1,3.5);sun.position.set(-35,70,25);sun.castShadow=this.settings.values.shadows;const shadowSize={low:512,medium:1024,high:2048}[this.settings.values.shadowQuality]||1024;sun.shadow.mapSize.set(shadowSize,shadowSize);sun.shadow.camera.left=sun.shadow.camera.bottom=-75;sun.shadow.camera.right=sun.shadow.camera.top=75;sun.shadow.bias=-.00025;this.scene.add(sun);}
  bindMatchEvents(){this.weaponManager.addEventListener('fire',e=>this.handleShots(e.detail));this.weaponManager.addEventListener('melee',e=>this.handleMelee(e.detail));this.botManager.addEventListener('kill',e=>this.handleKill(e.detail.killer,e.detail.victim,e.detail.weapon));}
  setupMode(){if(this.modeId==='bomb'){this.rounds=new RoundManager(this.settings);this.bombMode=new BombDefusalMode(this,this.rounds);this.mode=this.bombMode;this.mode.start();this.rounds.addEventListener('roundstart',()=>this.resetRound());this.rounds.addEventListener('roundend',e=>{this.bombMode.progress=0;this.bombMode.defuseProgress=0;this.rounds.award([this.player,...this.botManager.bots],e.detail.winner);this.endScreen.show(e.detail.winner,e.detail.reason);this.audio.tone('voice',{frequency:e.detail.winner===this.player.team?620:240,endFrequency:400,gain:.09,duration:.45});});this.rounds.startRound();}else{this.rounds=null;this.bombMode=null;this.mode=new TeamDeathmatchMode(this);this.mode.start();this.mode.addEventListener('matchend',e=>{this.endScreen.show(e.detail.winner,e.detail.reason);this.pause();});this.resetRound();}}
  resetRound(){this.endScreen.hide();document.getElementById('death-screen').classList.remove('visible');const wasDead=!this.player.alive;if(wasDead)this.player.inventory=new PlayerInventory(this.player.team,this.skinManager.knife);this.player.spawn(getSpawn(this.player.team,0));this.botManager.spawnAll();this.weaponManager.player=this.player;this.weaponManager.rebuild();this.playerCamera.yaw=this.player.team==='attackers'?0:Math.PI;this.playerCamera.pitch=0;if(this.bombMode)this.bombMode.beginRound();this.input.clear();this.hud.message(`Раунд ${this.rounds?.number||1}`);}
  fixedUpdate(dt){if(!this.active||this.paused)return;const beforeHealth=this.player.health;this.playerController.fixedUpdate(dt,this.settings.values,this.audio);this.weaponManager.handleInput(this.playerMovement,this.playerCamera);this.handleGameInput();const objectives=this.objectives();this.botManager.update(dt,this.player,objectives,this.smoke);this.grenades.update(dt);this.bombMode?.update(dt);if(this.modeId==='bomb'){this.rounds.update(dt,[this.player,...this.botManager.bots],this.bombMode.planted);}else this.mode.update(dt);if(this.player.health<beforeHealth)this.hud.damage();if(!this.player.alive&&!document.getElementById('death-screen').classList.contains('visible'))this.onPlayerDeath();this.impacts.update(dt);this.blood.update(dt);this.smoke.update(dt);this.explosion.update(dt);this.input.endFrame();}
  render(dt){if(!this.active)return;this.playerController.visualUpdate(dt);const targetFov=this.weaponManager.scoped?this.settings.values.fov*.45:this.settings.values.fov;this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,targetFov,Math.min(1,dt*12));this.camera.updateProjectionMatrix();this.hud.update(this,dt);this.updateScoreboard();this.updateBuyContext();this.renderer.render(this.scene,this.camera);}
  handleGameInput(){if(this.input.action('scoreboard'))this.scoreboard.show([this.player,...this.botManager.bots]);else this.scoreboard.hide();if(this.input.justPressed('buy'))this.openBuy();if(this.input.justPressed('team'))this.openMatchMenu('team-menu');if(this.input.justPressed('knifeMenu'))this.openMatchMenu('knife-menu');if(this.input.justPressed('grenades'))this.throwGrenade();if(this.input.justPressed('drop'))this.dropWeapon();}
  objectives(){if(this.modeId==='bomb'&&this.bombMode.planted){const p=this.bombMode.bomb.position;return{attackers:[p],defenders:[p],default:p};}return{attackers:this.mapConfig.bombSites,defenders:this.mapConfig.bombSites,default:this.mapConfig.bombSites};}
  handleShots({weapon,directions}) {
    for (const direction of directions) {
      const ray = new THREE.Raycaster(this.camera.position, direction, .05, weapon.definition.range);
      const hit = ray.intersectObjects([...this.map.raycastTargets, ...this.botManager.targets()], true)[0];
      if (!hit) continue;
      const entity = hit.object?.userData?.entity;
      if (!entity) {
        const normal = hit.face?.normal?.clone?.() || new THREE.Vector3(0, 1, 0);
        normal.transformDirection(hit.object.matrixWorld);
        this.safeEffect('след пули', () => this.impacts.spawn(hit.point, normal, hit.object.userData.surface));
        continue;
      }
      if (entity.team === this.player.team && !this.settings.values.friendlyFire) {
        const now = performance.now();
        if (!this.friendlyNoticeAt || now - this.friendlyNoticeAt > 2200) {
          this.friendlyNoticeAt = now;
          this.safeEffect('сообщение о союзнике', () => this.hud.message('Это союзник — дружественный огонь выключен'));
        }
        continue;
      }
      const zone = hit.object.userData.zone || 'chest';
      const damage = hitDamage(weapon.definition.damage, zone, hit.distance, weapon.definition.range, entity.armor, entity.helmet);
      const { applied, died } = applyDamageSafely(entity, damage, this.player);
      if (!applied) continue;
      this.safeEffect('метка попадания', () => this.hud.hit(died));
      this.safeEffect('звук попадания', () => this.audio.tone('hit', { frequency: died ? 880 : 620, gain: .025, duration: .035 }));
      this.safeEffect('кровь', () => this.blood.spawn(hit.point));
      if (died) this.handleKill(this.player, entity, weapon.definition.name);
    }
  }
  handleMelee({damage,range,direction}) {
    const targets = this.botManager.bots.filter((bot) => bot.alive && (bot.team !== this.player.team || this.settings.values.friendlyFire));
    const target = selectMeleeTarget({
      origin: this.camera.position,
      direction,
      targets,
      range,
      isBlocked: (from, to) => this.collision.segmentBlocked(from, to, 2.2)
    });
    if (!target) return;
    const { applied, died } = applyDamageSafely(target, damage, this.player);
    if (!applied) return;
    this.safeEffect('метка удара', () => this.hud.hit(died));
    this.safeEffect('кровь', () => this.blood.spawn(target.position.clone().setY(1.1)));
    if (died) this.handleKill(this.player, target, 'Нож');
  }
  safeEffect(label, callback) {
    try {
      callback();
    } catch (error) {
      this.effectWarnings ??= new Set();
      if (!this.effectWarnings.has(label)) {
        this.effectWarnings.add(label);
        console.warn(`Отключён эффект: ${label}`, error);
      }
    }
  }
  handleLoopError(error) {
    const now = performance.now();
    if (!this.loopErrorNoticeAt || now - this.loopErrorNoticeAt > 4000) {
      this.loopErrorNoticeAt = now;
      console.error('Игровой кадр восстановлен после ошибки', error);
      this.safeEffect('восстановление игры', () => this.hud.message('Игра восстановилась после ошибки', 'error'));
    }
  }
  handleKill(killer,victim,weapon){if(!killer||!victim)return;this.safeEffect('лента убийств',()=>this.hud.kill(killer,victim,weapon));if(this.modeId==='tdm')this.mode.onKill(killer,victim);if(victim===this.player)this.onPlayerDeath();}
  onPlayerDeath(){document.getElementById('death-screen').classList.add('visible');this.input.enabled=false;this.leaving=true;this.input.unlock();this.leaving=false;if(this.modeId==='tdm')this.mode.respawns.set(this.player,3);}
  spawnEntity(entity){if(entity===this.player){this.player.inventory=new PlayerInventory(this.player.team,this.skinManager.knife);this.player.spawn(randomSpawn(this.player.team));this.weaponManager.rebuild();document.getElementById('death-screen').classList.remove('visible');document.getElementById('click-to-play').classList.add('visible');}else entity.spawn(randomSpawn(entity.team));}
  openBuy(){if(this.rounds&&this.rounds.state!=='live')return;const context=this.buyContext();if(!context.inBuyZone||context.buyTime<=0){this.hud.message(context.buyTime<=0?'Время покупки закончилось':'Покупка только в стартовой зоне','error');return;}this.modalOpen=true;this.input.enabled=false;this.input.unlock();this.buyMenu.open(context);}
  closeBuy(){this.buyMenu.close();this.modalOpen=false;document.getElementById('click-to-play').classList.add('visible');}
  buyContext(){return{player:this.player,buyTime:this.rounds?.buyTime??this.settings.values.buyTime,inBuyZone:this.inBuyZone()};}
  updateBuyContext(){if(this.buyMenu.visible)this.buyMenu.update(this.buyContext());}
  inBuyZone(){const zone=this.mapConfig.buyZones.find(z=>z.team===this.player.team);return Math.hypot(this.player.position.x-zone.x,this.player.position.z-zone.z)<=zone.radius;}
  purchase(item){if(this.player.money<item.cost)return;this.player.money-=item.cost;if(WEAPONS[item.id])this.player.inventory.equipDefinition(item);else if(GRENADES[item.id]){if(!this.player.inventory.addGrenade(item.id)){this.player.money+=item.cost;this.hud.message('Достигнут лимит гранат');return;}}else if(item===EQUIPMENT.kevlar)this.player.armor=100;else if(item===EQUIPMENT.helmet){this.player.armor=100;this.player.helmet=true;}else if(item===EQUIPMENT.defuse)this.player.defuseKit=true;else if(item.id==='primaryAmmo')this.player.inventory.slots.primary?.addAmmo();else if(item.id==='pistolAmmo')this.player.inventory.slots.pistol?.addAmmo();this.audio.click();this.hud.message(`Куплено: ${item.name}`);this.buyMenu.update(this.buyContext());}
  throwGrenade(){const id=this.player.inventory.slots.grenades.shift();if(!id){this.hud.message('Нет гранат');return;}this.grenades.throw(id,this.camera.position.clone(),this.playerCamera.direction(),this.player);this.hud.message(`Брошена: ${GRENADES[id].name}`);}
  dropWeapon(){const slot=this.player.inventory.activeSlot;if(!['primary','pistol'].includes(slot)){if(slot==='bomb'&&this.bombMode)this.bombMode.drop(this.player.position);return;}if(this.player.inventory.slots[slot]){this.hud.message(`Выброшено: ${this.player.inventory.slots[slot].definition.name}`);this.player.inventory.slots[slot]=null;this.player.inventory.equip(slot==='primary'?'pistol':'knife');}}
  flashPlayers(position){const distance=this.camera.position.distanceTo(position);if(distance<22&&!this.collision.segmentBlocked(position,this.camera.position)){const facing=this.playerCamera.direction().dot(position.clone().sub(this.camera.position).normalize());if(facing>.05){let overlay=document.getElementById('flash-overlay');if(!overlay){overlay=document.createElement('div');overlay.id='flash-overlay';overlay.style.cssText='position:absolute;inset:0;background:white;z-index:80;pointer-events:none;transition:opacity 2.5s';document.getElementById('game-screen').append(overlay);}overlay.style.transition='none';overlay.style.opacity=String(Math.min(1,(1-distance/24)*(facing+.35)));requestAnimationFrame(()=>{overlay.style.transition='opacity 2.5s';overlay.style.opacity='0';});}}}
  isSpotted(bot){if(bot.team===this.player.team)return true;const visible=this.player.position.distanceToSquared(bot.position)<55*55&&!this.collision.segmentBlocked(this.camera.position,bot.position.clone().setY(1));if(visible)this.spotted.set(bot,performance.now()+2500);return(this.spotted.get(bot)||0)>performance.now();}
  updateScoreboard(){if(this.scoreboard.root.classList.contains('visible'))this.scoreboard.show([this.player,...this.botManager.bots]);}
  openMatchMenu(id){this.pause();this.returnToPause=true;this.mainMenu.open(id);}
  pause(){if(!this.active||this.paused)return;this.paused=true;this.loop.paused=true;this.input.enabled=false;this.leaving=true;this.input.unlock();this.leaving=false;this.pauseMenu.show();document.getElementById('click-to-play').classList.remove('visible');}
  resume(){if(!this.active)return;this.paused=false;this.loop.paused=false;this.pauseMenu.hide();this.mainMenu.open('game-screen');this.audio.unlock();this.input.lock();}
  leave(){this.leaving=true;this.input.unlock();this.disposeMatch();this.mainMenu.show();this.leaving=false;}
  resize(){const scale=Number(this.settings.values.renderScale)||1;const width=this.viewport.clientWidth||innerWidth,height=this.viewport.clientHeight||innerHeight;this.renderer.setPixelRatio(Math.min(devicePixelRatio*scale,2));this.renderer.setSize(width,height,false);if(this.camera){this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}}
  disposeMatch(){if(!this.active)return;this.loop?.stop();this.input.detach();this.grenades?.dispose();this.impacts?.dispose();this.bombMode?.dispose();this.botManager?.dispose();this.map?.dispose();this.renderer.renderLists.dispose();this.active=false;this.paused=false;this.modalOpen=false;this.buyMenu.close();this.pauseMenu.hide();this.scoreboard.hide();this.endScreen.hide();}
}
