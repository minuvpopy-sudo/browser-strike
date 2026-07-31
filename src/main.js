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

const settings=new SettingsManager();
const save=new SaveManager();
const audio=new AudioManager(settings);
const skinManager=new SkinManager(save);
const mainMenu=new MainMenu(audio);
const teamMenu=new TeamSelectMenu(save);
const knifeMenu=new KnifeMenu(skinManager);
document.getElementById('knife-label').textContent=skinManager.knife.type==='butterfly'?'Нож-бабочка':'Стандартный';
const settingsMenu=new SettingsMenu(settings);
let mode=save.get('mode','bomb');

document.querySelectorAll('.mode-choice').forEach(button=>button.addEventListener('click',()=>{
  mode=button.dataset.mode;save.set('mode',mode);document.querySelectorAll('.mode-choice').forEach(b=>b.classList.toggle('selected',b===button));document.getElementById('mode-label').textContent=mode==='bomb'?'Закладка бомбы':'Командный бой';
}));
document.querySelector(`.mode-choice[data-mode="${mode}"]`)?.click();

const game=new Game({settings,save,audio,skinManager,mainMenu,teamMenu});
const start=async(quick=false)=>{audio.unlock();const team=quick?(Math.random()<.5?'attackers':'defenders'):teamMenu.resolved();await game.start({team,mode:quick?'bomb':mode});};
mainMenu.addEventListener('newgame',()=>start(false));
mainMenu.addEventListener('quickmatch',()=>start(true));
settingsMenu.addEventListener('saved',()=>audio.click());

window.browserStrike={game,settings,version:'1.0.0'};
