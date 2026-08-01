import * as THREE from 'three';
import { BotNavigation } from './BotNavigation.js';
import { BotCombat } from './BotCombat.js';

export class BotAI {
  constructor(bot, graph, collision, difficulty, audio) {
    this.bot = bot;
    this.navigation = new BotNavigation(graph, collision);
    this.combat = new BotCombat(bot, difficulty, audio);
    this.profile = this.combat.profile;
    this.collision = collision;
    this.patrolPoints = [...graph.nodes.values()].map((node) => new THREE.Vector3(node.x, 0, node.z));
    this.reset();
  }

  reset() {
    this.thinkTimer = 0;
    this.target = null;
    this.memoryTimer = 0;
    this.patrolTimer = 0;
    this.patrolTarget = null;
    this.patrolCursor = 0;
    this.strafeTimer = 0;
    this.strafeSign = this.bot.index % 2 ? 1 : -1;
    this.navigation.target = null;
    this.navigation.path = [];
  }

  update(dt, enemies, objective, smoke, onKill) {
    if (!this.bot.alive) return;
    if (this.bot.blindedTime > 0) {
      this.bot.blindedTime = Math.max(0, this.bot.blindedTime - dt);
      this.bot.state = 'flashed'; this.bot.velocity.multiplyScalar(Math.max(0, 1 - dt * 8));
      this.combat.update(dt, null, false, onKill); return;
    }
    if (this.bot.state === 'buy') this.bot.buy();
    this.thinkTimer -= dt;
    this.memoryTimer = Math.max(0, this.memoryTimer - dt);
    this.patrolTimer -= dt;

    if (this.thinkTimer <= 0) {
      this.thinkTimer = this.profile.thinkMin + Math.random() * (this.profile.thinkMax - this.profile.thinkMin);
      const attacker = this.bot.lastAttacker;
      const retaliation = attacker?.alive && attacker.team !== this.bot.team && this.hasSight(attacker, smoke, true) ? attacker : null;
      this.target = retaliation || this.findVisible(enemies, smoke);
      if (this.target) {
        this.bot.lastSeen = this.target.position.clone();
        this.memoryTimer = this.profile.memory + Math.random() * this.profile.memory * .35;
        this.bot.state = retaliation ? 'return-fire' : 'see-enemy';
      }
    }

    const visible = Boolean(this.target?.alive && this.hasSight(this.target, smoke, this.target === this.bot.lastAttacker));
    if (visible) {
      this.bot.lastSeen = this.target.position.clone();
      this.memoryTimer = Math.max(this.memoryTimer, this.profile.memory);
      this.combatMovement(dt, this.target, objective);
      this.face(this.target.position);
      this.combat.update(dt, this.target, true, onKill);
      return;
    }

    this.combat.update(dt, null, false, onKill);
    if (this.bot.lastSeen && this.bot.position.distanceToSquared(this.bot.lastSeen) < 1.7 * 1.7 && this.memoryTimer <= 0) {
      this.bot.lastSeen = null;
      this.target = null;
    }

    let destination;
    if (this.bot.lastSeen && this.memoryTimer > 0) {
      destination = this.bot.lastSeen;
      this.bot.state = 'investigate';
    } else if (this.bot.hasBomb) {
      destination = objective;
      this.bot.state = 'objective';
    } else {
      if (!this.patrolTarget || this.patrolTimer <= 0 || this.bot.position.distanceToSquared(this.patrolTarget) < 2.3 * 2.3) {
        this.patrolTarget = this.choosePatrolPoint(objective);
        this.patrolTimer = 5.5 + Math.random() * 4;
      }
      destination = this.patrolTarget || objective;
      this.bot.state = 'patrol';
    }

    if (!this.navigation.target || this.navigation.target.distanceToSquared(destination) > 2.25 || this.navigation.repath <= 0) {
      this.navigation.setTarget(this.bot, destination);
    }
    this.navigation.update(this.bot, dt, (this.bot.state === 'investigate' ? 4.45 : 3.75 + (this.bot.index % 3) * .16) * this.profile.moveScale);
    this.face(this.navigation.path[this.navigation.index] || destination);
  }

  combatMovement(dt, target, objective) {
    const distance = this.bot.position.distanceTo(target.position);
    if (this.bot.hasBomb) {
      this.navigation.setTarget(this.bot, objective);
      this.navigation.update(this.bot, dt, 4.25 * this.profile.moveScale);
      return;
    }
    if (distance > 17) {
      this.navigation.setTarget(this.bot, target.position);
      this.navigation.update(this.bot, dt, 4.5 * this.profile.moveScale);
      return;
    }

    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeTimer = .65 + Math.random() * 1.05;
      if (Math.random() < .58) this.strafeSign *= -1;
    }
    const toward = target.position.clone().sub(this.bot.position).setY(0).normalize();
    const side = new THREE.Vector3(-toward.z, 0, toward.x).multiplyScalar(this.strafeSign);
    if (distance < 7) side.addScaledVector(toward, -.9);
    else if (distance > 12) side.addScaledVector(toward, .45);
    side.normalize();
    const previousX = this.bot.position.x; const previousZ = this.bot.position.z;
    const moved = this.collision.moveCircle(this.bot.position, { x: side.x * 3.15 * this.profile.moveScale * dt, z: side.z * 3.15 * this.profile.moveScale * dt }, .55);
    const groundY=this.collision.groundHeightAt?.(moved.x,moved.z)||0;if(groundY-this.bot.position.y>.75){moved.x=previousX;moved.z=previousZ;}
    this.bot.position.set(moved.x, this.collision.groundHeightAt?.(moved.x,moved.z)||0, moved.z);
    this.bot.velocity.set((moved.x - previousX) / dt, 0, (moved.z - previousZ) / dt);
    if (moved.blockedX || moved.blockedZ) this.strafeSign *= -1;
  }

  choosePatrolPoint(objective) {
    const candidates = this.patrolPoints.filter((point) => {
      const fromBot = point.distanceTo(this.bot.position);
      const fromObjective = point.distanceTo(objective);
      return fromBot > 7 && fromObjective < 58;
    });
    const pool = candidates.length ? candidates : this.patrolPoints;
    if (!pool.length) return objective.clone?.() || new THREE.Vector3(objective.x, 0, objective.z);
    this.patrolCursor++;
    const index = (this.bot.index * 7 + this.patrolCursor * 5) % pool.length;
    return pool[index].clone();
  }

  findVisible(enemies, smoke) {
    let best = null;
    let distance = Infinity;
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const candidateDistance = this.bot.position.distanceToSquared(enemy.position);
      if (candidateDistance < distance && candidateDistance < this.profile.sightRange * this.profile.sightRange && this.hasSight(enemy, smoke)) {
        distance = candidateDistance;
        best = enemy;
      }
    }
    return best;
  }

  hasSight(enemy, smoke, ignoreFieldOfView = false) {
    const origin = this.bot.position.clone().setY(1.55);
    const target = enemy.position.clone().setY(enemy.isPlayer ? 1.55 : 1.2);
    if (this.collision.segmentBlocked(origin, target) || smoke?.blocks(origin, target)) return false;
    const direction = target.clone().sub(origin).setY(0);
    const distance = direction.length();
    if (ignoreFieldOfView || distance < 7) return true;
    direction.normalize();
    const forward = new THREE.Vector3(Math.sin(this.bot.group.rotation.y), 0, Math.cos(this.bot.group.rotation.y));
    return forward.dot(direction) > this.profile.fovDot;
  }

  face(target) {
    const dx = target.x - this.bot.position.x;
    const dz = target.z - this.bot.position.z;
    this.bot.group.rotation.y = Math.atan2(dx, dz);
  }
}
