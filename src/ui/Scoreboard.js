export class Scoreboard {
  constructor(){this.root=document.getElementById('scoreboard');this.rows=document.getElementById('score-rows');}
  show(entities){this.root.classList.add('visible');this.rows.innerHTML='';for(const e of [...entities].sort((a,b)=>a.team.localeCompare(b.team)||b.kills-a.kills)){const row=document.createElement('div');row.className=`score-row ${e.team}`;row.innerHTML=`<span>${e.name}${e.isPlayer?' (Вы)':''}</span><span>${e.kills}</span><span>${e.deaths}</span><span>${e.assists}</span><span>$${e.money}</span><span>${e.alive?'В игре':'Мёртв'}</span><span>${e.isPlayer?'5':18+(e.index||0)*3}</span>`;this.rows.append(row);}}
  hide(){this.root.classList.remove('visible');}
}
