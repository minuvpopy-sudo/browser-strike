const wall = (x, z, w, d, h = 6, material = 'sandstone', y = h / 2) => ({ x, y, z, w, h, d, material });
const crate = (x, z, size = 3, y = size / 2) => ({ x, y, z, w: size, h: size, d: size });
export const MAP_SCALE = 1.18;

const RAW_MAP_CONFIG = {
  name: 'de_sandstorm2', size: { width: 128, depth: 118 }, floorY: 0,
  attackerSpawns: [{x:-45,z:45},{x:-41,z:48},{x:-48,z:40},{x:-38,z:42},{x:-44,z:36},{x:-36,z:48},{x:-50,z:47},{x:-41,z:38},{x:-34,z:44},{x:-48,z:34}],
  defenderSpawns: [{x:44,z:-43},{x:39,z:-47},{x:48,z:-38},{x:35,z:-42},{x:44,z:-34},{x:50,z:-47},{x:37,z:-35},{x:48,z:-31},{x:33,z:-48},{x:41,z:-39}],
  buyZones: [
    { team:'attackers', x:-43, z:43, radius:14 }, { team:'defenders', x:43, z:-42, radius:14 }
  ],
  bombSites: [
    { id:'A', x:38, z:34, radius:9 }, { id:'B', x:-39, z:-34, radius:9 }
  ],
  walls: [
    wall(0,-58,128,3,9),wall(0,58,128,3,9),wall(-64,0,3,118,9),wall(64,0,3,118,9),
    wall(-35,24,3,48),wall(-20,49,33,3),wall(-52,18,22,3),wall(-52,-5,3,43),
    wall(-44,-25,18,3),wall(-20,-17,3,25),wall(-42,-5,18,3),wall(-25,-5,8,3),
    wall(-44,-48,36,3),wall(-25,-38,3,23),wall(-10,-49,30,3),wall(-3,-35,3,27),
    wall(5,-24,18,3),wall(15,-38,3,39),wall(31,-20,34,3),wall(48,-11,3,21),
    wall(34,2,30,3),wall(18,12,3,30),wall(23.5,25,11,3),wall(38.5,25,11,3),wall(49,40,3,35),
    wall(39.75,49,21.5,3),wall(22,36,3,28),wall(8,50,25,3),wall(3,34,3,33),
    wall(-8,17,25,3),wall(-4,5,3,24),wall(6,-8,20,3),wall(22,-2,3,17),
    wall(-20,18,30,3),wall(-10,31,3,23),wall(-24,34,28,3),
    wall(34,-35,3,22),wall(44,-24,20,3),
    wall(-2,-2,3,12,5,'metal'), wall(3,-2,3,12,5,'metal')
  ],
  crates: [
    crate(-31,42,4),crate(-27,42,4),crate(36,38,4),crate(41,38,4),crate(40,31,3),crate(-42,-37,4),crate(-37,-37,4),crate(-38,-29,3),
    crate(-10,-9,3),crate(11,8,3),crate(27,-13,4),crate(51,14,3),crate(-45,8,4),crate(-17,44,3),crate(30,45,3),crate(-8,-44,4)
  ],
  ramps: [{x:16,z:28,w:9,d:12,rotation:-.18},{x:-30,z:-18,w:10,d:8,rotation:.16}],
  nodes: [
    {id:'tSpawn',x:-43,z:43},{id:'tSplit',x:-28,z:31},{id:'longDoors',x:-47,z:12},{id:'longPit',x:-50,z:-15},{id:'longA',x:-17,z:-27},{id:'aRamp',x:10,z:-20},{id:'siteA',x:38,z:34},
    {id:'midTop',x:-13,z:20},{id:'midDoors',x:0,z:1},{id:'midBottom',x:13,z:-12},{id:'short',x:17,z:18},{id:'shortA',x:28,z:28},
    {id:'upperTunnel',x:-29,z:23},{id:'tunnelB',x:-43,z:-7},{id:'siteB',x:-39,z:-34},{id:'ctB',x:-17,z:-43},{id:'ctMid',x:18,z:-39},{id:'ctSpawn',x:43,z:-42},{id:'ctA',x:47,z:8}
  ],
  links: [
    ['tSpawn','tSplit'],['tSplit','longDoors'],['longDoors','longPit'],['longPit','longA'],['longA','aRamp'],['aRamp','ctMid'],['ctMid','ctSpawn'],['ctSpawn','ctA'],['ctA','siteA'],
    ['tSplit','midTop'],['midTop','midDoors'],['midDoors','midBottom'],['midBottom','ctMid'],['midTop','short'],['short','shortA'],['shortA','siteA'],
    ['tSplit','upperTunnel'],['upperTunnel','tunnelB'],['tunnelB','siteB'],['siteB','ctB'],['ctB','ctMid'],['ctB','ctSpawn']
  ]
};

const scalePoint = (point) => ({ ...point, x: point.x * MAP_SCALE, z: point.z * MAP_SCALE });
const scaleZone = (zone) => ({ ...scalePoint(zone), radius: zone.radius * MAP_SCALE });
const scaleStructure = (item) => ({ ...scalePoint(item), w: item.w * MAP_SCALE, d: item.d * MAP_SCALE });

export const MAP_CONFIG = Object.freeze({
  ...RAW_MAP_CONFIG,
  scale: MAP_SCALE,
  size: { width: RAW_MAP_CONFIG.size.width * MAP_SCALE, depth: RAW_MAP_CONFIG.size.depth * MAP_SCALE },
  attackerSpawns: RAW_MAP_CONFIG.attackerSpawns.map(scalePoint),
  defenderSpawns: RAW_MAP_CONFIG.defenderSpawns.map(scalePoint),
  buyZones: RAW_MAP_CONFIG.buyZones.map(scaleZone),
  bombSites: RAW_MAP_CONFIG.bombSites.map(scaleZone),
  walls: RAW_MAP_CONFIG.walls.map(scaleStructure),
  crates: RAW_MAP_CONFIG.crates.map(scaleStructure),
  ramps: RAW_MAP_CONFIG.ramps.map(scaleStructure),
  nodes: RAW_MAP_CONFIG.nodes.map(scalePoint)
});
