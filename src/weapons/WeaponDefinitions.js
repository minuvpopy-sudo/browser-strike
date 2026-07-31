const W = (id,name,category,cost,side,damage,rate,mag,reserve,reload,spread,recoil,moveSpeed,range,mode='auto',extra={}) => Object.freeze({id,name,category,cost,side,damage,rate,mag,reserve,reload,spread,recoil,moveSpeed,range,mode,headMultiplier:4,penetration:.5,...extra});

export const WEAPONS = Object.freeze({
  glock:W('glock','Glock 18','pistols',400,'attackers',25,6.5,20,120,2.2,.018,.55,1,85,'burst'),
  usp:W('usp','USP','pistols',500,'defenders',30,5.8,12,100,2.2,.012,.48,1,95,'semi'),
  p228:W('p228','P228','pistols',600,'both',32,5.5,13,78,2.4,.017,.62,.99,95,'semi'),
  deagle:W('deagle','Desert Eagle','pistols',650,'both',54,3.3,7,35,2.2,.022,1.15,.96,120,'semi'),
  fiveseven:W('fiveseven','Five-Seven','pistols',750,'defenders',24,6,20,100,2.5,.014,.45,1,90,'semi'),
  elites:W('elites','Dual Elites','pistols',800,'attackers',28,6.8,30,120,3.2,.025,.55,.98,80,'semi'),
  m3:W('m3','M3','shotguns',1700,'both',18,1.05,8,32,3.5,.07,1.2,.9,45,'pump',{pellets:8}),
  xm1014:W('xm1014','XM1014','shotguns',3000,'both',14,2.6,7,32,3.1,.08,1,.88,42,'semi',{pellets:7}),
  tmp:W('tmp','TMP','smgs',1250,'defenders',20,12,30,120,2.1,.034,.45,1.06,75),
  mac10:W('mac10','MAC-10','smgs',1400,'attackers',24,12.5,30,120,2.4,.046,.58,1.04,70),
  mp5:W('mp5','MP5','smgs',1500,'both',23,11.2,30,120,2.5,.03,.42,1.03,85),
  ump45:W('ump45','UMP45','smgs',1700,'both',29,9.5,25,100,2.6,.035,.58,1.01,88),
  p90:W('p90','P90','smgs',2350,'both',22,14.5,50,100,3,.045,.42,1.02,83),
  galil:W('galil','Galil','rifles',2000,'attackers',30,10.5,35,90,2.7,.03,.75,.94,125),
  famas:W('famas','FAMAS','rifles',2250,'defenders',29,10.8,25,90,2.8,.027,.7,.94,125,'burst'),
  ak47:W('ak47','AK-47','rifles',2500,'attackers',36,10,30,90,2.6,.026,1,.92,150),
  m4a1:W('m4a1','M4A4','rifles',3100,'defenders',33,11,30,90,3.05,.021,.78,.94,145),
  scout:W('scout','Scout','rifles',2750,'both',72,1.4,10,90,2.6,.008,1.25,.98,210,'bolt',{scope:true}),
  awp:W('awp','AWP','rifles',4750,'both',112,.85,10,30,3.65,.006,2.1,.82,260,'bolt',{scope:true}),
  sg552:W('sg552','SG552','rifles',3500,'attackers',34,9.8,30,90,3.1,.025,.86,.91,155,'auto',{scope:true}),
  aug:W('aug','AUG','rifles',3500,'defenders',32,10.2,30,90,3.2,.023,.8,.91,155,'auto',{scope:true}),
  g3sg1:W('g3sg1','G3SG1','rifles',5000,'attackers',80,3.8,20,90,4.2,.014,1.4,.78,230,'semi',{scope:true}),
  sg550:W('sg550','SG550','rifles',4200,'defenders',74,4.1,30,90,4.5,.014,1.3,.79,225,'semi',{scope:true}),
  m249:W('m249','M249','machineguns',5750,'both',32,10.5,100,200,4.7,.048,1.05,.76,145),
  knife:Object.freeze({id:'knife',name:'Нож',category:'knives',cost:0,side:'both',damage:55,heavyDamage:110,rate:1.6,range:2.8,moveSpeed:1.1,mode:'melee'})
});

export const EQUIPMENT = Object.freeze({
  kevlar:{id:'kevlar',name:'Бронежилет',category:'equipment',cost:650}, helmet:{id:'helmet',name:'Броня + шлем',category:'equipment',cost:1000},
  defuse:{id:'defuse',name:'Набор обезвреживания',category:'equipment',cost:400,side:'defenders'}, primaryAmmo:{id:'primaryAmmo',name:'Основные патроны',category:'ammo',cost:60}, pistolAmmo:{id:'pistolAmmo',name:'Пистолетные патроны',category:'ammo',cost:30}
});

export const GRENADES = Object.freeze({
  he:{id:'he',name:'Осколочная граната',category:'grenades',cost:300,damage:95}, flash:{id:'flash',name:'Светошумовая граната',category:'grenades',cost:200}, smoke:{id:'smoke',name:'Дымовая граната',category:'grenades',cost:300}
});
export const BUY_CATEGORIES = Object.freeze([
  ['pistols','Пистолеты'],['shotguns','Дробовики'],['smgs','Пистолеты-пулемёты'],['rifles','Винтовки'],['machineguns','Пулемёты'],['ammo','Боеприпасы'],['equipment','Экипировка'],['grenades','Гранаты']
]);
