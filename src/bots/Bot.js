import * as THREE from 'three';
import { COMBAT, ECONOMY, awardMoney } from '../config/MatchRules.js';
import { WEAPONS } from '../weapons/WeaponDefinitions.js';
import { animateCharacterLegs, createCharacterModel } from '../characters/CharacterModel.js';

export class Bot {
  constructor(name, team, scene, index = 0) {
    this.name = name; this.team = team; this.scene = scene; this.index = index;
    this.position = new THREE.Vector3(); this.velocity = new THREE.Vector3();
    this.maxHealth = COMBAT.maxHealth; this.health = this.maxHealth; this.armor = 0; this.helmet = false; this.money = ECONOMY.startMoney; this.alive = true;
    this.kills = 0; this.deaths = 0; this.assists = 0; this.state = 'spawn';
    this.weapon = WEAPONS[team === 'attackers' ? 'glock' : 'usp'];
    this.ammo = this.weapon.mag; this.reserve = this.weapon.reserve; this.reloadTime = 0;
    this.hasBomb = false; this.defuseKit = false; this.lastSeen = null; this.flashTime = 0; this.blindedTime = 0;
    this.group = this.createModel(); scene.add(this.group);
  }

  createModel() {
    return createCharacterModel(this,this.team,{name:`bot-${this.team}`});
  }

  spawn(point) {
    this.position.set(point.x, 0, point.z); this.group.position.copy(this.position); this.group.visible = true;
    this.health = this.maxHealth; this.armor = 0; this.helmet = false; this.alive = true; this.state = 'buy'; this.hasBomb = false; this.bombSite = null; this.defuseKit = false;
    this.weapon = WEAPONS[this.team === 'attackers' ? 'glock' : 'usp'];
    this.reloadTime = 0; this.flashTime = 0; this.blindedTime = 0; this.ammo = this.weapon.mag; this.reserve = this.weapon.reserve; this.lastSeen = null; this.lastAttacker = null; this.spawnProtectedUntil = performance.now() + 2500;
    this.buy();
  }

  takeDamage(amount, source) {
    if (!this.alive || source && !source.isPlayer && performance.now() < this.spawnProtectedUntil) return false;
    this.health = Math.max(0, this.health - amount);
    if (this.health === 0) {
      this.alive = false; this.deaths++; this.state = 'dead'; this.group.visible = false; this.hasBomb = false;
      return true;
    }
    this.lastAttacker = source; this.state = 'take-cover'; return false;
  }

  buy() {
    const purchased = [];
    const choices = this.team === 'attackers' ? ['ak47', 'galil', 'mp5', 'deagle'] : ['m4a1', 'famas', 'mp5', 'deagle'];
    const equipmentReserve = this.money >= 1650 ? (this.team === 'defenders' ? 1050 : 650) : 0;
    for (const id of choices) {
      const definition = WEAPONS[id];
      if (this.money - equipmentReserve >= definition.cost) {
        this.money -= definition.cost; this.weapon = definition; this.ammo = definition.mag; this.reserve = definition.reserve; purchased.push(id); break;
      }
    }
    if (this.team === 'defenders' && this.money >= 400) {
      this.money -= 400; this.defuseKit = true; purchased.push('defuse');
    }
    if (this.money >= 1000) {
      this.money -= 1000; this.armor = 100; this.helmet = true; purchased.push('helmet');
    } else if (this.money >= 650) {
      this.money -= 650; this.armor = 100; purchased.push('kevlar');
    }
    this.updateWeaponModel();
    this.state = 'move-to-target';
    return purchased;
  }

  updateWeaponModel() {
    const model = this.group.getObjectByName('weapon');
    if (!model) return;
    const pistol = this.weapon.category === 'pistols';
    const sniper = Boolean(this.weapon.scope);
    model.scale.set(pistol ? .82 : 1, pistol ? .88 : 1, pistol ? .58 : sniper ? 1.5 : 1.22);
    model.position.z = pistol ? .13 : .28;
  }

  addMoney(amount) { this.money = awardMoney(this.money, amount); }

  updateVisual(dt) {
    if (!this.alive) return;
    this.group.position.copy(this.position);
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    animateCharacterLegs(this.group,speed);
    this.flashTime = Math.max(0, this.flashTime - dt);
    const shotLight = this.group.getObjectByName('shot-light');
    if (shotLight) shotLight.intensity = this.flashTime > 0 ? 4 : 0;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); });
  }
}
