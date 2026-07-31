import { MAP_CONFIG } from './MapConfig.js';
export function getSpawn(team, index = 0) { const list = team === 'attackers' ? MAP_CONFIG.attackerSpawns : MAP_CONFIG.defenderSpawns; return { ...list[index % list.length] }; }
export function randomSpawn(team) { const list = team === 'attackers' ? MAP_CONFIG.attackerSpawns : MAP_CONFIG.defenderSpawns; return { ...list[Math.floor(Math.random() * list.length)] }; }
