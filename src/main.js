import './styles.css';
import { SettingsManager } from './core/SettingsManager.js';
import { SaveManager } from './core/SaveManager.js';
import { AudioManager } from './core/AudioManager.js';
import { SkinManager } from './skins/SkinManager.js';
import { MainMenu } from './ui/MainMenu.js';
import { TeamSelectMenu } from './ui/TeamSelectMenu.js';
import { KnifeMenu } from './ui/KnifeMenu.js';
import { SettingsMenu } from './ui/SettingsMenu.js';
import { Game } from './core/Game.js';
import { KNIFE_TYPES } from './skins/KnifeSkinDefinitions.js';
import { AutoUpdater } from './core/AutoUpdater.js';
import { OnlineSession } from './network/OnlineSession.js';
import { MapWorkshop } from './ui/MapWorkshop.js';
import { MAP_CONFIG } from './map/MapConfig.js';
import { workshopMapToConfig } from './map/WorkshopMap.js';
import { PromoAdminMenu } from './ui/PromoAdminMenu.js';

const settings=new SettingsManager();
const save=new SaveManager();
const audio=new AudioManager(settings);
const skinManager=new SkinManager(save);
const mainMenu=new MainMenu(audio);
const teamMenu=new TeamSelectMenu(save);
const knifeMenu=new KnifeMenu(skinManager);
document.getElementById('knife-label').textContent=KNIFE_TYPES[skinManager.knife.type]||KNIFE_TYPES.standard;
const settingsMenu=new SettingsMenu(settings);
const onlineSession=new OnlineSession().bindUI();
const mapWorkshop=new MapWorkshop().bindUI();
let mode=save.get('mode','bomb');
let selectedMap=MAP_CONFIG;

const mapLabel=document.getElementById('map-label');
const chooseMap=(config,id='default')=>{selectedMap=config;save.set('selectedMapId',id);mapLabel.textContent=config.name||'Карта игрока';};
const savedMapId=save.get('selectedMapId','default');
if(savedMapId!=='default'){
  const savedMap=mapWorkshop.store.get(savedMapId);
  if(savedMap)chooseMap(workshopMapToConfig(savedMap),savedMap.id);else save.set('selectedMapId','default');
}
document.getElementById('select-default-map').addEventListener('click',()=>{chooseMap(MAP_CONFIG);mainMenu.open('main-menu');});
mapWorkshop.addEventListener('selected',event=>{chooseMap(event.detail.config,event.detail.map.id);mainMenu.open('main-menu');});

document.querySelectorAll('.mode-choice').forEach(button=>button.addEventListener('click',()=>{
  mode=button.dataset.mode;save.set('mode',mode);document.querySelectorAll('.mode-choice').forEach(b=>b.classList.toggle('selected',b===button));document.getElementById('mode-label').textContent=mode==='bomb'?'Закладка бомбы':'Командный бой';
}));
document.querySelector(`.mode-choice[data-mode="${mode}"]`)?.click();

const game=new Game({settings,save,audio,skinManager,mainMenu,teamMenu});
const promoAdminMenu=new PromoAdminMenu({save,game,audio});
game.pauseMenu.addEventListener('admin',()=>{game.returnToPause=true;game.mainMenu.open('promo-menu');promoAdminMenu.openTab('admin');});
const start=async(quick=false)=>{audio.unlock();game.adminState={god:false,ammo:false,freeze:false};promoAdminMenu.resetSession();const team=quick?(Math.random()<.5?'attackers':'defenders'):teamMenu.resolved();await game.start({team,mode:quick?'bomb':mode,mapConfig:selectedMap});};
mainMenu.addEventListener('newgame',()=>start(false));
mainMenu.addEventListener('quickmatch',()=>start(true));
onlineSession.addEventListener('ready',async(event)=>{
  audio.unlock();
  const {team,mode:onlineMode,session}=event.detail;
  try { await game.start({team,mode:onlineMode,onlineSession:session,mapConfig:MAP_CONFIG}); }
  catch(error){ console.error('Не удалось запустить онлайн-матч',error);session.disconnect();mainMenu.open('online-menu');session.setStatus('Не удалось запустить матч. Обновите страницу и попробуйте снова.','error'); }
});
mainMenu.addEventListener('open',event=>{mapWorkshop.onScreen(event.detail);if(event.detail!=='online-menu'&&!game.active&&onlineSession.peer)onlineSession.disconnect();});
settingsMenu.addEventListener('saved',()=>audio.click());

const autoUpdater=new AutoUpdater({version:__BUILD_VERSION__,canReload:()=>!game.active}).start();
window.browserStrike={game,settings,onlineSession,mapWorkshop,promoAdminMenu,autoUpdater,version:__BUILD_VERSION__};
