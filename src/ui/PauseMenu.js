export class PauseMenu extends EventTarget {
  constructor(){super();this.root=document.getElementById('pause-menu');document.getElementById('resume-game').addEventListener('click',()=>this.dispatchEvent(new Event('resume')));document.getElementById('leave-match').addEventListener('click',()=>this.dispatchEvent(new Event('leave')));document.getElementById('pause-settings').addEventListener('click',()=>this.dispatchEvent(new Event('settings')));document.getElementById('pause-admin').addEventListener('click',()=>this.dispatchEvent(new Event('admin')));}
  show(){this.root.classList.add('visible');}
  hide(){this.root.classList.remove('visible');}
}
