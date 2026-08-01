import { hitDamage } from '../config/MatchRules.js';

const DIFFICULTY = {
  easy: { reaction: .58, accuracy: .44, burst: 3 }, normal: { reaction: .28, accuracy: .68, burst: 5 },
  hard: { reaction: .16, accuracy: .82, burst: 7 }, expert: { reaction: .09, accuracy: .92, burst: 9 }
};

export class BotCombat {
  constructor(bot, difficulty, audio) {
    this.bot = bot; this.profile = DIFFICULTY[difficulty] || DIFFICULTY.normal; this.audio = audio;
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
    if (this.burst >= this.profile.burst) { this.cooldown += .14 + Math.random() * .2; this.burst = 0; }
    const distance = this.bot.position.distanceTo(target.position);
    const movePenalty = Math.min(.12, Math.hypot(this.bot.velocity.x, this.bot.velocity.z) * .009);
    const targetScale = target.isPlayer ? .72 : 1;
    const hitChance = Math.max(.12, Math.max(.24, this.profile.accuracy - movePenalty - distance * .0027) * targetScale);
    if (Math.random() >= hitChance) return;
    const head = !target.isPlayer && Math.random() < this.profile.accuracy * .16;
    const rawDamage = hitDamage(this.bot.weapon.damage, head ? 'head' : 'chest', distance, this.bot.weapon.range, target.armor || 0, target.helmet || false);
    const damage = target.isPlayer ? Math.max(2, Math.round(rawDamage * .62)) : rawDamage;
    const died = target.takeDamage(damage, this.bot);
    if (died) { this.bot.kills++; this.bot.addMoney(300); onKill?.(this.bot, target, this.bot.weapon.name); }
  }
}
