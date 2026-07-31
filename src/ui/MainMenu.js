export class MainMenu extends EventTarget {
  constructor(audio){super();this.audio=audio;this.current='main-menu';this.history=[];this.bind();}
  bind(){document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>this.open(b.dataset.open)));document.querySelectorAll('[data-back]').forEach(b=>b.addEventListener('click',()=>this.open('main-menu')));document.getElementById('new-game').addEventListener('click',()=>this.dispatchEvent(new Event('newgame')));document.getElementById('quick-match').addEventListener('click',()=>this.dispatchEvent(new Event('quickmatch')));document.getElementById('exit-button').addEventListener('click',()=>{document.exitPointerLock?.();this.open('main-menu');this.dispatchEvent(new Event('exit'));});document.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>this.audio.click()));}
  open(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id)?.classList.add('active');this.current=id;this.dispatchEvent(new CustomEvent('open',{detail:id}));}
  show(){this.open('main-menu');}
  hide(){document.getElementById('main-menu').classList.remove('active');}
}
