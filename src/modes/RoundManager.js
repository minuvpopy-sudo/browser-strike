import { ECONOMY, lossReward } from '../config/MatchRules.js';

export class RoundManager extends EventTarget {
  constructor(settings){super();this.settings=settings;this.number=0;this.time=0;this.buyTime=0;this.scores={attackers:0,defenders:0};this.lossStreak={attackers:0,defenders:0};this.state='idle';this.endDelay=0;}
  startRound(){this.number++;this.time=this.settings.values.roundTime;this.buyTime=this.settings.values.buyTime;this.state='live';this.dispatchEvent(new CustomEvent('roundstart',{detail:{number:this.number}}));}
  update(dt,teams,bombPlanted=false){if(this.state==='ended'){this.endDelay-=dt;if(this.endDelay<=0){this.startRound();return 'restart';}return null;}if(this.state!=='live')return null;this.time=Math.max(0,this.time-dt);this.buyTime=Math.max(0,this.buyTime-dt);if(this.time<=0&&!bombPlanted)return this.end('defenders','Время раунда истекло');const attackers=teams.filter(e=>e.team==='attackers'&&e.alive).length,defenders=teams.filter(e=>e.team==='defenders'&&e.alive).length;if(defenders===0)return this.end('attackers','Команда противника уничтожена');if(attackers===0&&!bombPlanted)return this.end('defenders','Команда противника уничтожена');return null;}
  end(winner,reason){if(this.state!=='live')return null;this.state='ended';this.endDelay=4.5;this.scores[winner]++;const loser=winner==='attackers'?'defenders':'attackers';this.lossStreak[winner]=0;this.lossStreak[loser]++;this.dispatchEvent(new CustomEvent('roundend',{detail:{winner,reason}}));return{winner,reason};}
  award(entities,winner){const loser=winner==='attackers'?'defenders':'attackers';for(const entity of entities){entity.addMoney(entity.team===winner?ECONOMY.win:lossReward(this.lossStreak[loser]));}}
}
