import { hitDamage } from '../config/MatchRules.js';

export const BOT_DIFFICULTIES = Object.freeze({
  easy: Object.freeze({ reaction: .72, accuracy: .34, burst: 2, burstPause: .42, minHitChance: .03, headChance: .025, sightRange: 38, fovDot: .38, moveScale: .86, memory: 2.2, thinkMin: .2, thinkMax: .34 }),
  normal: Object.freeze({ reaction: .36, accuracy: .58, burst: 4, burstPause: .28, minHitChance: .07, headChance: .065, sightRange: 52, fovDot: .18, moveScale: 1, memory: 3.5, thinkMin: .12, thinkMax: .22 }),
  hard: Object.freeze({ reaction: .18, accuracy: .74, burst: 6, burstPause: .18, minHitChance: .11, headChance: .11, sightRange: 65, fovDot: .03, moveScale: 1.08, memory: 4.8, thinkMin: .075, thinkMax: .14 }),
  expert: Object.freeze({ reaction: .085, accuracy: .86, burst: 8, burstPause: .1, minHitChance: .16, headChance: .17, sightRange: 78, fovDot: -.12, moveScale: 1.16, memory: 6.2, thinkMin: .045, thinkMax: .09 })
});

export class BotCombat {
  constructor(bot, difficulty, audio) {
    this.bot = bot; this.difficulty = BOT_DIFFICULTIES[difficulty] ? difficulty : 'normal';this.profile = BOT_DIFFICULTIES[this.difficulty]; this.audio = audio;
    this.cooldown = 0; this.reaction = this.profile.reaction; this.burst = 0;
  }

  update(dt, target, visible, onKill) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.bot.reloadTime > 0) {
      this.bot.reloadTime -= dt;
      if (this.bot.reloadTime <= 0) {
        const add = Math.min(this.bot.weapon.mag - this.bot.ammo, this.bot.reserve);
        this.bot.ammo += add; this.bot.reserve -= add; this.bot.state = 'attack';
      }
      return;
    }
    if (!visible || !target?.alive) { this.reaction = this.profile.reaction; this.burst = 0; return; }
    this.reaction -= dt;
    if (this.reaction > 0) return;
    if (this.bot.ammo <= 0) {
      if (this.bot.reserve > 0) { this.bot.state = 'reload'; this.bot.reloadTime = this.bot.weapon.reload; }
      return;
    }
    if (this.cooldown > 0) return;

    this.bot.state = 'attack'; this.cooldown = 1 / this.bot.weapon.rate; this.bot.ammo--; this.bot.flashTime = .055;
    this.audio?.shotAt?.(this.bot.position, this.bot.weapon, .82);
    this.burst++;
    if (this.burst >= this.profile.burst) { this.cooldown += this.profile.burstPause + Math.random() * this.profile.burstPause * .55; this.burst = 0; }
    const distance = this.bot.position.distanceTo(target.position);
    const movePenalty = Math.min(.12, Math.hypot(this.bot.velocity.x, this.bot.velocity.z) * .009);
    const targetScale = target.isPlayer ? .78 : 1;
    const hitChance = Math.max(this.profile.minHitChance, Math.max(.08, this.profile.accuracy - movePenalty - distance * .0032) * targetScale);
    if (Math.random() >= hitChance) return;
    const head = Math.random() < this.profile.headChance * (target.isPlayer ? .55 : 1);
    const rawDamage = hitDamage(this.bot.weapon.damage, head ? 'head' : 'chest', distance, this.bot.weapon.range, target.armor || 0, target.helmet || false);
    const damage = target.isPlayer ? Math.max(2, Math.round(rawDamage * .62)) : rawDamage;
    const died = target.takeDamage(damage, this.bot);
    if (died) { this.bot.kills++; this.bot.addMoney(300); onKill?.(this.bot, target, this.bot.weapon.name); }
  }
}
