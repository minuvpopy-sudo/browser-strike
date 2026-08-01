import * as THREE from 'three';
import { COMBAT, ECONOMY, awardMoney } from '../config/MatchRules.js';
import { WEAPONS } from '../weapons/WeaponDefinitions.js';
import { animateCharacterLegs, createCharacterModel, setCharacterCrouched } from '../characters/CharacterModel.js';

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export class RemotePlayer {
  constructor({ name = 'Друг', team = 'defenders', scene, spawn }) {
    this.name = name;
    this.team = team;
    this.scene = scene;
    this.position = new THREE.Vector3(spawn?.x || 0, 0, spawn?.z || 0);
    this.targetPosition = this.position.clone();
    this.velocity = new THREE.Vector3();
    this.maxHealth = COMBAT.maxHealth;
    this.health = this.maxHealth;
    this.armor = 0;
    this.helmet = false;
    this.money = ECONOMY.startMoney;
    this.alive = true;
    this.kills = 0;
    this.deaths = 0;
    this.assists = 0;
    this.weapon = WEAPONS[team === 'attackers' ? 'glock' : 'usp'];
    this.isRemotePlayer = true;
    this.isPlayer = false;
    this.ping = 0;
    this.targetYaw = Math.PI;
    this.crouched = false;
    this.spawnProtected = true;
    this.flashTime = 0;
    this.group = this.createModel();
    this.group.position.copy(this.position);
    this.scene.add(this.group);
  }

  createModel() {
    return createCharacterModel(this,this.team,{name:'online-opponent'});
  }

  applyState(state = {}) {
    const x = finite(state.x, this.targetPosition.x);
    const y = finite(state.y, this.targetPosition.y);
    const z = finite(state.z, this.targetPosition.z);
    this.targetPosition.set(x, y, z);
    this.targetYaw = finite(state.yaw, this.targetYaw - Math.PI) + Math.PI;
    this.health = THREE.MathUtils.clamp(finite(state.health, this.health), 0, this.maxHealth);
    this.armor = THREE.MathUtils.clamp(finite(state.armor, this.armor), 0, 100);
    this.alive = Boolean(state.alive);
    this.crouched = Boolean(state.crouched);
    this.spawnProtected = Boolean(state.spawnProtected);
    this.kills = Math.max(0, Math.floor(finite(state.kills, this.kills)));
    this.deaths = Math.max(0, Math.floor(finite(state.deaths, this.deaths)));
    this.money = Math.max(0, Math.floor(finite(state.money, this.money)));
    this.ping = Math.max(0, Math.floor(finite(state.ping, this.ping)));
    const nextWeapon = WEAPONS[state.weaponId];
    if (nextWeapon && nextWeapon !== this.weapon) {
      this.weapon = nextWeapon;
      this.updateWeaponModel();
    }
    this.group.visible = this.alive;
  }

  takeDamage(amount) {
    if (!this.alive || this.spawnProtected || !Number.isFinite(amount) || amount <= 0) return false;
    this.health = Math.max(0, this.health - amount);
    if (this.armor > 0) this.armor = Math.max(0, this.armor - Math.ceil(amount * .35));
    if (this.health > 0) return false;
    this.alive = false;
    this.deaths++;
    this.group.visible = false;
    return true;
  }

  addMoney(amount) {
    this.money = awardMoney(this.money, amount);
  }

  showShot() {
    this.flashTime = .06;
  }

  updateWeaponModel() {
    const model = this.group.getObjectByName('weapon');
    if (!model) return;
    const pistol = this.weapon.category === 'pistols';
    const sniper = Boolean(this.weapon.scope);
    model.scale.set(pistol ? .82 : 1, pistol ? .88 : 1, pistol ? .58 : sniper ? 1.5 : 1.22);
    model.position.z = pistol ? .13 : .28;
  }

  updateVisual(dt) {
    if (!this.alive) return;
    const previous = this.position.clone();
    this.position.lerp(this.targetPosition, Math.min(1, dt * 14));
    this.velocity.copy(this.position).sub(previous).divideScalar(Math.max(.001, dt));
    this.group.position.copy(this.position);
    let delta = this.targetYaw - this.group.rotation.y;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    this.group.rotation.y += delta * Math.min(1, dt * 16);
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    setCharacterCrouched(this.group,this.crouched);
    animateCharacterLegs(this.group,speed);
    this.flashTime = Math.max(0, this.flashTime - dt);
    const light = this.group.getObjectByName('shot-light');
    if (light) light.intensity = this.flashTime > 0 ? 4 : 0;
  }

  targets() {
    return this.alive ? [this.group] : [];
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
      else object.material?.dispose?.();
    });
  }
}
