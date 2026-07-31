export class GameMode extends EventTarget {
  constructor(game){super();this.game=game;this.active=false;}
  start(){this.active=true;}
  stop(){this.active=false;}
  update(){}
  onKill(){}
}
