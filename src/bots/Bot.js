import * as THREE from 'three';
import { COMBAT, ECONOMY, awardMoney } from '../config/MatchRules.js';
import { WEAPONS } from '../weapons/WeaponDefinitions.js';

export class Bot {
  constructor(name, team, scene, index = 0) {
    this.name = name; this.team = team; this.scene = scene; this.index = index;
    this.position = new THREE.Vector3(); this.velocity = new THREE.Vector3();
    this.maxHealth = COMBAT.maxHealth; this.health = this.maxHealth; this.armor = 0; this.money = ECONOMY.startMoney; this.alive = true;
    this.kills = 0; this.deaths = 0; this.assists = 0; this.state = 'spawn';
    this.weapon = WEAPONS[team === 'attackers' ? 'glock' : 'usp'];
    this.ammo = this.weapon.mag; this.reserve = this.weapon.reserve; this.reloadTime = 0;
    this.hasBomb = false; this.defuseKit = false; this.lastSeen = null; this.flashTime = 0;
    this.group = this.createModel(); scene.add(this.group);
  }

  createModel() {
    const group = new THREE.Group();
    const isAttacker = this.team === 'attackers';
    const uniform = new THREE.MeshStandardMaterial({ color: isAttacker ? 0xa45d24 : 0x176fc1, emissive: isAttacker ? 0x2d1306 : 0x082a52, emissiveIntensity: 0.28, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x252823, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.9, 0.42), uniform);
    body.position.y = 1; body.userData = { entity: this, zone: 'chest' }; group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.44), new THREE.MeshStandardMaterial({ color: 0xb58d6d, roughness: 1 }));
    head.position.y = 1.68; head.userData = { entity: this, zone: 'head' }; group.add(head);
    for (const x of [-0.23, 0.23]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.72, 0.26), dark);
      leg.position.set(x, 0.37, 0); leg.userData = { entity: this, zone: 'legs' }; group.add(leg);
    }
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.68), dark);
    gun.name = 'weapon'; gun.position.set(0.24, 1.18, 0.24); gun.userData = { entity: this, zone: 'arms' }; group.add(gun);
    const shotLight = new THREE.PointLight(0xffb04c, 0, 4);
    shotLight.name = 'shot-light'; shotLight.position.set(0.24, 1.18, 0.62); group.add(shotLight);
    group.traverse((object) => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
    return group;
  }

  spawn(point) {
    this.position.set(point.x, 0, point.z); this.group.position.copy(this.position); this.group.visible = true;
    this.health = this.maxHealth; this.armor = 0; this.alive = true; this.state = 'buy'; this.hasBomb = false; this.bombSite = null;
    this.reloadTime = 0; this.flashTime = 0; this.ammo = this.weapon.mag; this.spawnProtectedUntil = performance.now() + 2500;
  }

  takeDamage(amount, source) {
    if (!this.alive || source && !source.isPlayer && (this.playerTarget || performance.now() < this.spawnProtectedUntil)) return false;
    this.health = Math.max(0, this.health - amount);
    if (this.health === 0) {
      this.alive = false; this.deaths++; this.state = 'dead'; this.group.visible = false; this.hasBomb = false;
      return true;
    }
    this.lastAttacker = source; this.state = 'take-cover'; return false;
  }

  buy() {
    if (this.playerTarget) { this.state = 'move-to-target'; return; }
    const choices = this.team === 'attackers' ? ['ak47', 'galil', 'mp5', 'deagle'] : ['m4a1', 'famas', 'mp5', 'deagle'];
    for (const id of choices) {
      const definition = WEAPONS[id];
      if (this.money >= definition.cost) {
        this.money -= definition.cost; this.weapon = definition; this.ammo = definition.mag; this.reserve = definition.reserve; break;
      }
    }
    if (this.money >= 650) { this.money -= 650; this.armor = 100; }
    this.state = 'move-to-target';
  }

  addMoney(amount) { this.money = awardMoney(this.money, amount); }

  updateVisual(dt) {
    if (!this.alive) return;
    this.group.position.copy(this.position);
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    this.group.children.slice(2, 4).forEach((leg, index) => {
      leg.rotation.x = Math.sin(performance.now() * 0.009 + index * Math.PI) * Math.min(0.55, speed * 0.1);
    });
    this.flashTime = Math.max(0, this.flashTime - dt);
    const shotLight = this.group.getObjectByName('shot-light');
    if (shotLight) shotLight.intensity = this.flashTime > 0 ? 4 : 0;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); });
  }
}
