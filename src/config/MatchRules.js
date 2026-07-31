export const ECONOMY = Object.freeze({
  startMoney: 800, kill: 300, win: 3250, loss: 1400, lossStep: 500,
  lossMax: 3400, plant: 800, defuse: 300, maxMoney: 16000
});
export const COMBAT = Object.freeze({ maxHealth: 200, maxBulletDamage: 140 });

export function clampMoney(value) { return Math.max(0, Math.min(ECONOMY.maxMoney, Math.floor(value))); }
export function awardMoney(current, amount) { return clampMoney(current + amount); }
export function lossReward(streak) { return Math.min(ECONOMY.lossMax, ECONOMY.loss + Math.max(0, streak - 1) * ECONOMY.lossStep); }
export function canBuy({ money, cost, inBuyZone, buyTimeLeft, available = true }) { return available && inBuyZone && buyTimeLeft > 0 && money >= cost; }
export function hitDamage(base, zone, distance, range, armor = 0, helmet = false) {
  const multiplier = { head: 2.5, chest: 1, stomach: 1.2, arms: .9, legs: .75 }[zone] || 1;
  const falloff = Math.max(.55, 1 - Math.max(0, distance - range * .35) / Math.max(1, range) * .35);
  const armored = armor > 0 && (zone !== 'head' || helmet);
  return Math.min(COMBAT.maxBulletDamage,Math.max(1, Math.round(base * multiplier * falloff * (armored ? .72 : 1))));
}
