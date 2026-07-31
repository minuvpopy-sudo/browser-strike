import { PlayerInventory } from '../player/PlayerInventory.js';

export function livingTeammates(player, bots) {
  return bots.filter((bot) => bot.alive && bot.team === player.team);
}

export function selectSpectatorTarget(player, bots, current = null) {
  const teammates = livingTeammates(player, bots);
  if (current && teammates.includes(current)) return current;
  if (!teammates.length) return null;
  return teammates.reduce((nearest, bot) => (
    !nearest || bot.position.distanceToSquared(player.position) < nearest.position.distanceToSquared(player.position)
      ? bot
      : nearest
  ), null);
}

export function takeOverBotState(player, bot, knifeChoice) {
  if (!player || player.alive || !bot?.alive || bot.team !== player.team || !bot.weapon) return null;

  const hadBomb = Boolean(bot.hasBomb);
  const bombSite = bot.bombSite || null;
  const inventory = new PlayerInventory(player.team, knifeChoice);
  const firearm = inventory.equipDefinition(bot.weapon);
  firearm.ammo = Math.max(0, Math.min(bot.weapon.mag, bot.ammo ?? bot.weapon.mag));
  firearm.reserve = Math.max(0, bot.reserve ?? bot.weapon.reserve);

  player.position.copy(bot.position);
  player.velocity.set(0, 0, 0);
  player.health = Math.max(1, bot.health);
  player.armor = bot.armor;
  player.helmet = bot.helmet;
  player.defuseKit = bot.defuseKit;
  player.money = bot.money;
  player.inventory = inventory;
  player.alive = true;
  player.hasBomb = hadBomb;
  player.bombSite = bombSite;
  player.lastAttacker = null;
  player.spawnProtectedUntil = 0;
  if (hadBomb) inventory.setBomb(true);

  bot.alive = false;
  bot.state = 'controlled-by-player';
  bot.hasBomb = false;
  bot.bombSite = null;
  bot.velocity.set(0, 0, 0);
  if (bot.group) bot.group.visible = false;

  return { hadBomb, bombSite };
}
