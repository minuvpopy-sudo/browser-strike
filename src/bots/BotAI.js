import * as THREE from 'three';
import { BotNavigation } from './BotNavigation.js';
import { BotCombat } from './BotCombat.js';

export class BotAI {
  constructor(bot, graph, collision, difficulty, audio) {
    this.bot = bot;
    this.navigation = new BotNavigation(graph, collision);
    this.combat = new BotCombat(bot, difficulty, audio);
    this.collision = collision;
    this.thinkTimer = 0;
    this.target = null;
  }

  update(dt, enemies, objective, smoke, onKill) {
    if (!this.bot.alive) return;
    if (this.bot.state === 'buy') this.bot.buy();
    this.thinkTimer -= dt;
    if (this.thinkTimer <= 0) {
      this.thinkTimer = 0.14 + Math.random() * 0.11;
      this.target = this.findVisible(enemies, smoke);
      if (this.target) {
        this.bot.lastSeen = this.target.position.clone();
        this.bot.state = 'see-enemy';
      } else if (this.bot.lastSeen && this.bot.position.distanceTo(this.bot.lastSeen) < 1.8) {
        this.bot.lastSeen = null;
      }
    }

    const visible = Boolean(this.target && this.hasSight(this.target, smoke));
    if (visible) {
      const distance = this.bot.position.distanceTo(this.target.position);
      const movementTarget = this.bot.hasBomb ? objective : this.target.position;
      const movementDistance = this.bot.position.distanceTo(movementTarget);
      if (this.bot.hasBomb || distance > 8) {
        this.navigation.setTarget(this.bot, movementTarget);
        this.navigation.update(this.bot, dt, movementDistance > 24 ? 4.5 : 3.25);
      } else {
        this.bot.velocity.multiplyScalar(Math.max(0, 1 - dt * 12));
      }
      this.face(this.target.position);
      this.combat.update(dt, this.target, true, onKill);
      return;
    }

    this.combat.update(dt, null, false, onKill);
    const destination = this.bot.lastSeen || objective;
    if (!this.navigation.target || this.navigation.target.distanceToSquared(destination) > 3 || this.navigation.repath <= 0) {
      this.navigation.setTarget(this.bot, destination);
      this.bot.state = this.bot.lastSeen ? 'search' : 'patrol';
    }
    this.navigation.update(this.bot, dt, this.bot.state === 'take-cover' ? 4.8 : 3.8);
    this.face(destination);
  }

  findVisible(enemies, smoke) {
    let best = null;
    let distance = Infinity;
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const candidateDistance = this.bot.position.distanceToSquared(enemy.position);
      if (candidateDistance < distance && candidateDistance < 65 * 65 && this.hasSight(enemy, smoke)) {
        distance = candidateDistance;
        best = enemy;
      }
    }
    return best;
  }

  hasSight(enemy, smoke) {
    const origin = this.bot.position.clone().setY(1.55);
    const target = enemy.position.clone().setY(enemy.isPlayer ? 1.55 : 1.2);
    return !this.collision.segmentBlocked(origin, target) && !smoke?.blocks(origin, target);
  }

  face(target) {
    const dx = target.x - this.bot.position.x;
    const dz = target.z - this.bot.position.z;
    this.bot.group.rotation.y = Math.atan2(dx, dz);
  }
}
