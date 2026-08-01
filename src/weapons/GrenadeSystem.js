import * as THREE from 'three';
import { GRENADES, WEAPONS } from './WeaponDefinitions.js';

const GRENADE_COLORS = { he: 0x40513d, flash: 0xc9cec5, smoke: 0x68776b, decoy: 0x3e4d58 };
const DECOY_WEAPONS = [WEAPONS.ak47, WEAPONS.m4a1, WEAPONS.glock, WEAPONS.mp5];

export class GrenadeSystem {
  constructor(game) { this.game = game; this.items = []; this.decoys = []; }

  throw(type, origin, direction, owner) {
    const definition = GRENADES[type];
    if (!definition || !origin || !direction) return false;
    const material = new THREE.MeshStandardMaterial({ color: GRENADE_COLORS[type], metalness: .45, roughness: .5, flatShading: true });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(.19, 10, 8), material);
    mesh.name = `${type}-grenade`;
    mesh.position.copy(origin);
    mesh.scale.set(1, 1.18, 1);
    this.game.scene.add(mesh);
    this.items.push({ type, definition, mesh, velocity: direction.clone().normalize().multiplyScalar(13).add(new THREE.Vector3(0, 4, 0)), owner, fuse: definition.fuse });
    return true;
  }

  update(dt) {
    for (let index = this.items.length - 1; index >= 0; index--) {
      const grenade = this.items[index];
      grenade.fuse -= dt;
      grenade.velocity.y -= 13 * dt;
      const next = grenade.mesh.position.clone().addScaledVector(grenade.velocity, dt);
      if (next.y < .18) {
        next.y = .18;
        grenade.velocity.y = Math.abs(grenade.velocity.y) * .42;
        grenade.velocity.x *= .72; grenade.velocity.z *= .72;
      }
      if (this.game.collision.intersects(next.x, next.z, .15)) {
        grenade.velocity.x *= -.45; grenade.velocity.z *= -.45;
      } else grenade.mesh.position.copy(next);
      grenade.mesh.rotation.x += dt * 8;
      grenade.mesh.rotation.z += dt * 5;
      if (grenade.fuse <= 0) {
        this.detonate(grenade);
        this.disposeMesh(grenade.mesh);
        this.items.splice(index, 1);
      }
    }
    this.updateDecoys(dt);
  }

  updateDecoys(dt) {
    for (let index = this.decoys.length - 1; index >= 0; index--) {
      const decoy = this.decoys[index];
      decoy.life -= dt; decoy.cooldown -= dt;
      if (decoy.cooldown <= 0 && decoy.life > 0) {
        const weapon = DECOY_WEAPONS[decoy.shots++ % DECOY_WEAPONS.length];
        this.game.audio.shotAt?.(decoy.position, weapon, .72);
        decoy.cooldown = Math.max(.09, .38 - decoy.shots * .012) + Math.random() * .16;
      }
      if (decoy.life <= 0) {
        this.game.explosion.spawn(decoy.position);
        this.game.audio.tone('ui', { frequency: 180, endFrequency: 75, gain: .035, duration: .12 });
        this.decoys.splice(index, 1);
      }
    }
  }

  detonate(grenade) {
    const position = grenade.mesh.position.clone();
    if (grenade.type === 'smoke') {
      this.game.smoke.spawn(position);
      this.game.audio.tone('ui', { frequency: 90, endFrequency: 45, gain: .06, duration: .22 });
      return;
    }
    if (grenade.type === 'flash') {
      this.game.flashPlayers(position);
      this.game.audio.tone('shot', { frequency: 1400, endFrequency: 320, gain: .11, duration: .28 });
      return;
    }
    if (grenade.type === 'decoy') {
      this.decoys.push({ position, life: 8, cooldown: .08, shots: 0 });
      this.game.audio.tone('ui', { frequency: 240, endFrequency: 120, gain: .028, duration: .08 });
      return;
    }
    this.game.explosion.spawn(position);
    this.game.audio.explosion();
    const entities = this.game.onlineSession ? [this.game.player] : [this.game.player, ...this.game.botManager.bots];
    for (const entity of entities) {
      if (!entity.alive) continue;
      const distance = entity.position.distanceTo(position);
      if (distance >= 12 || this.game.collision.segmentBlocked(position, entity.position)) continue;
      const damage = Math.max(5, Math.round((grenade.definition.damage || 105) - distance * 8));
      const died = entity.takeDamage(damage, grenade.owner);
      if (!died) continue;
      if (this.game.onlineSession && grenade.owner?.isRemotePlayer) {
        grenade.owner.kills++; grenade.owner.addMoney(300);
        this.game.onlineSession.send({ type: 'kill-confirm', weapon: 'Граната' });
      }
      this.game.handleKill(grenade.owner, entity, 'Граната');
    }
  }

  disposeMesh(mesh) {
    this.game.scene.remove(mesh);
    mesh.traverse((object) => { object.geometry?.dispose?.(); object.material?.dispose?.(); });
  }

  dispose() {
    for (const grenade of this.items) this.disposeMesh(grenade.mesh);
    this.items = []; this.decoys = [];
  }
}
