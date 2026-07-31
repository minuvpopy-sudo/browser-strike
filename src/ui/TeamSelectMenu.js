export class TeamSelectMenu extends EventTarget {
  constructor(save){super();this.save=save;this.team=save.get('team','auto');this.buttons=[...document.querySelectorAll('.team-choice')];this.buttons.forEach(b=>b.addEventListener('click',()=>this.select(b.dataset.team)));this.select(this.team,false);}
  select(team,notify=true){this.team=team;this.save.set('team',team);this.buttons.forEach(b=>b.classList.toggle('selected',b.dataset.team===team));document.getElementById('team-label').textContent={attackers:'Террористы',defenders:'Спецназ',auto:'Автовыбор'}[team];if(notify)this.dispatchEvent(new CustomEvent('change',{detail:team}));}
  resolved(){return this.team==='auto'?(Math.random()<.5?'attackers':'defenders'):this.team;}
}
