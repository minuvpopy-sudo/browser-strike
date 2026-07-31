export class NavigationGraph {
  constructor(config) {
    this.nodes = new Map(config.nodes.map((n) => [n.id, { ...n, links: [] }]));
    for (const [a,b] of config.links) { this.nodes.get(a)?.links.push(b); this.nodes.get(b)?.links.push(a); }
  }
  nearest(position) { let best=null,dist=Infinity; for(const node of this.nodes.values()){const d=(node.x-position.x)**2+(node.z-position.z)**2;if(d<dist){dist=d;best=node;}}return best; }
  path(startPosition,endPosition) {
    const start=this.nearest(startPosition), goal=this.nearest(endPosition); if(!start||!goal)return [];
    const open=new Set([start.id]),came=new Map(),g=new Map([[start.id,0]]),f=new Map([[start.id,this.distance(start,goal)]]);
    while(open.size){let current=[...open].sort((a,b)=>(f.get(a)??Infinity)-(f.get(b)??Infinity))[0];if(current===goal.id){const result=[];while(current){result.unshift(this.nodes.get(current));current=came.get(current);}return result;}
      open.delete(current);const node=this.nodes.get(current);for(const nextId of node.links){const next=this.nodes.get(nextId);const tentative=(g.get(current)??Infinity)+this.distance(node,next);if(tentative<(g.get(nextId)??Infinity)){came.set(nextId,current);g.set(nextId,tentative);f.set(nextId,tentative+this.distance(next,goal));open.add(nextId);}}}
    return [];
  }
  distance(a,b){return Math.hypot(a.x-b.x,a.z-b.z);}
}
