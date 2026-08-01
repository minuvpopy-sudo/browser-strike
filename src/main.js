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
let mode=save.get('mode','bomb');

document.querySelectorAll('.mode-choice').forEach(button=>button.addEventListener('click',()=>{
  mode=button.dataset.mode;save.set('mode',mode);document.querySelectorAll('.mode-choice').forEach(b=>b.classList.toggle('selected',b===button));document.getElementById('mode-label').textContent=mode==='bomb'?'Закладка бомбы':'Командный бой';
}));
document.querySelector(`.mode-choice[data-mode="${mode}"]`)?.click();

const game=new Game({settings,save,audio,skinManager,mainMenu,teamMenu});
const start=async(quick=false)=>{audio.unlock();const team=quick?(Math.random()<.5?'attackers':'defenders'):teamMenu.resolved();await game.start({team,mode:quick?'bomb':mode});};
mainMenu.addEventListener('newgame',()=>start(false));
mainMenu.addEventListener('quickmatch',()=>start(true));
onlineSession.addEventListener('ready',async(event)=>{
  audio.unlock();
  const {team,mode:onlineMode,session}=event.detail;
  try { await game.start({team,mode:onlineMode,onlineSession:session}); }
  catch(error){ console.error('Не удалось запустить онлайн-матч',error);session.disconnect();mainMenu.open('online-menu');session.setStatus('Не удалось запустить матч. Обновите страницу и попробуйте снова.','error'); }
});
mainMenu.addEventListener('open',event=>{if(event.detail!=='online-menu'&&!game.active&&onlineSession.peer)onlineSession.disconnect();});
settingsMenu.addEventListener('saved',()=>audio.click());

const autoUpdater=new AutoUpdater({version:__BUILD_VERSION__,canReload:()=>!game.active}).start();
window.browserStrike={game,settings,onlineSession,autoUpdater,version:__BUILD_VERSION__};
