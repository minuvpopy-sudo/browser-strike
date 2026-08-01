import { MAP_CONFIG } from './MapConfig.js';
export function getSpawn(team, index = 0, config = MAP_CONFIG) { const list = team === 'attackers' ? config.attackerSpawns : config.defenderSpawns; return { ...list[index % list.length] }; }
export function randomSpawn(team, config = MAP_CONFIG) { const list = team === 'attackers' ? config.attackerSpawns : config.defenderSpawns; return { ...list[Math.floor(Math.random() * list.length)] }; }
