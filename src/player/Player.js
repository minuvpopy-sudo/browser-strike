import * as THREE from 'three';
import { PlayerInventory } from './PlayerInventory.js';
import { COMBAT, ECONOMY, awardMoney } from '../config/MatchRules.js';

export class Player {
  constructor(team,knifeChoice){this.team=team;this.position=new THREE.Vector3();this.velocity=new THREE.Vector3();this.maxHealth=COMBAT.maxHealth;this.health=this.maxHealth;this.armor=0;this.helmet=false;this.defuseKit=false;this.money=ECONOMY.startMoney;this.alive=true;this.kills=0;this.deaths=0;this.assists=0;this.inventory=new PlayerInventory(team,knifeChoice);this.isPlayer=true;this.name='Игрок';}
  spawn(point){this.position.set(point.x,0,point.z);this.velocity.set(0,0,0);this.health=this.maxHealth;this.alive=true;this.spawnProtectedUntil=performance.now()+2500;}
  takeDamage(amount,source){if(!this.alive||source&&performance.now()<this.spawnProtectedUntil)return false;this.health=Math.max(0,this.health-amount);if(this.armor>0){this.armor=Math.max(0,this.armor-Math.ceil(amount*.35));}if(this.health===0){this.alive=false;this.deaths++;return true;}this.lastAttacker=source;return false;}
  addMoney(amount){this.money=awardMoney(this.money,amount);}
}
