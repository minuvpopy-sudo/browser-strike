const DEFAULT_KEYS = {
  forward: 'KeyW', backward: 'KeyS', left: 'KeyA', right: 'KeyD',
  jump: 'Space', crouch: 'ControlLeft', walk: 'ShiftLeft', use: 'KeyE',
  drop: 'KeyG', lastWeapon: 'KeyQ', buy: 'KeyB', team: 'KeyM', knifeMenu: 'KeyN',
  inspect: 'KeyF', reload: 'KeyR', primary: 'Digit1', pistol: 'Digit2', knife: 'Digit3',
  grenades: 'Digit4', bomb: 'Digit5', scoreboard: 'Tab'
};

export const DEFAULT_SETTINGS = Object.freeze({
  difficulty: 'normal', botsPerTeam: 5, roundTime: 150, buyTime: 25, bombTime: 40,
  friendlyFire: false, autoBhop: false, autoPickup: true,
  sensitivity: 1, invertMouse: false, wheelSpeed: 1, keys: DEFAULT_KEYS,
  renderScale: 1, fov: 80, drawDistance: 220, textureQuality: 'high', shadowQuality: 'medium', antialias: true, shadows: true, particles: true,
  showFps: false, fpsLimit: 0, masterVolume: 70, musicVolume: 25,
  shotsVolume: 85, stepsVolume: 65, uiVolume: 60, voiceVolume: 70
});

export class SettingsManager extends EventTarget {
  constructor(storageKey = 'browserStrike.settings.v1') {
    super();
    this.storageKey = storageKey;
    this.values = this.load();
  }

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
      return { ...DEFAULT_SETTINGS, ...saved, keys: { ...DEFAULT_KEYS, ...(saved.keys || {}) } };
    } catch {
      return { ...DEFAULT_SETTINGS, keys: { ...DEFAULT_KEYS } };
    }
  }

  set(key, value) {
    this.values[key] = value;
    this.dispatchEvent(new CustomEvent('change', { detail: { key, value } }));
  }

  bindKey(action, code) {
    this.values.keys[action] = code;
    this.dispatchEvent(new CustomEvent('change', { detail: { key: `keys.${action}`, value: code } }));
  }

  save() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.values));
  }

  reset() {
    this.values = { ...DEFAULT_SETTINGS, keys: { ...DEFAULT_KEYS } };
    this.save();
    this.dispatchEvent(new Event('reset'));
  }
}
