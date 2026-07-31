import { GameMode } from './GameMode.js';
export class TeamDeathmatchMode extends GameMode {
  constructor(game){super(game);this.time=600;this.scores={attackers:0,defenders:0};this.respawns=new Map();}
  start(){super.start();this.time=600;this.scores={attackers:0,defenders:0};this.respawns.clear();}
  update(dt){if(!this.active)return;this.time=Math.max(0,this.time-dt);for(const [entity,time] of [...this.respawns]){const left=time-dt;if(left<=0){this.game.spawnEntity(entity);this.respawns.delete(entity);}else this.respawns.set(entity,left);}if(this.time<=0){const winner=this.scores.attackers>=this.scores.defenders?'attackers':'defenders';this.dispatchEvent(new CustomEvent('matchend',{detail:{winner,reason:'Время матча истекло'}}));this.active=false;}}
  onKill(killer,victim){this.scores[killer.team]++;this.respawns.set(victim,3);}
}
