export class InputManager extends EventTarget {
  constructor(element, settings) {
    super();
    this.element = element;
    this.settings = settings;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseButtons = new Set();
    this.lookX = 0; this.lookY = 0; this.wheel = 0;
    this.enabled = false; this.listening = false; this.fallbackLook = false;
    this.handlers = {
      keydown: (e) => this.onKeyDown(e), keyup: (e) => this.onKeyUp(e),
      paste: (e) => this.onPaste(e),
      mousedown: (e) => this.onMouseDown(e), mouseup: (e) => this.onMouseUp(e),
      mousemove: (e) => this.onMouseMove(e), wheel: (e) => this.onWheel(e),
      contextmenu: (e) => e.preventDefault(), blur: () => this.clear(),
      pointerlockchange: () => { const locked=document.pointerLockElement===this.element;if(locked)this.fallbackLook=false;this.dispatchEvent(new CustomEvent('lockchange',{detail:locked})); }
    };
  }
  attach() {
    if (this.listening) return;
    this.listening = true;
    for (const type of ['keydown','keyup']) window.addEventListener(type, this.handlers[type], { capture: true });
    window.addEventListener('paste', this.handlers.paste, { capture: true });
    for (const type of ['mousedown','mouseup','mousemove','wheel','contextmenu']) this.element.addEventListener(type, this.handlers[type], { passive: type === 'wheel' });
    window.addEventListener('blur', this.handlers.blur);
    document.addEventListener('pointerlockchange', this.handlers.pointerlockchange);
  }
  detach() {
    if (!this.listening) return;
    this.listening = false;
    for (const type of ['keydown','keyup']) window.removeEventListener(type, this.handlers[type], true);
    window.removeEventListener('paste', this.handlers.paste, true);
    for (const type of ['mousedown','mouseup','mousemove','wheel','contextmenu']) this.element.removeEventListener(type, this.handlers[type]);
    window.removeEventListener('blur', this.handlers.blur);
    document.removeEventListener('pointerlockchange', this.handlers.pointerlockchange);
    this.clear();
  }
  normalizedCode(code) {
    if (code === 'ControlRight' && this.settings.values.keys.crouch === 'ControlLeft') return 'ControlLeft';
    return code;
  }
  onKeyDown(e) {
    if (!this.enabled) return;
    const code = this.normalizedCode(e.code);
    const gameplayKeys = Object.values(this.settings.values.keys);
    if (gameplayKeys.includes(code) || this.blockedShortcut(e,code)) e.preventDefault();
    if (!this.keys.has(code)) this.pressed.add(code);
    this.keys.add(code);
  }
  onKeyUp(e) { const code=this.normalizedCode(e.code);if(this.enabled&&this.blockedShortcut(e,code))e.preventDefault?.();this.keys.delete(code); }
  blockedShortcut(e,code=this.normalizedCode(e.code)){return Boolean(e.ctrlKey||code.startsWith('Control')||(e.altKey&&code==='F4'));}
  onPaste(e){if(this.enabled)e.preventDefault();}
  onMouseDown(e) { if(this.enabled){if(e.button===0||e.button===2)e.preventDefault?.();this.mouseButtons.add(e.button);} }
  onMouseUp(e) { this.mouseButtons.delete(e.button); }
  onMouseMove(e) {
    if (!this.enabled || (document.pointerLockElement !== this.element && !this.fallbackLook)) return;
    const clampDelta = (value) => Math.max(-120, Math.min(120, Number.isFinite(value) ? value : 0));
    this.lookX += clampDelta(e.movementX);
    this.lookY += clampDelta(e.movementY);
  }
  onWheel(e) { if (this.enabled) this.wheel += Math.sign(e.deltaY); }
  action(name) { return this.keys.has(this.settings.values.keys[name]); }
  justPressed(name) { const code = this.settings.values.keys[name]; if (!this.pressed.has(code)) return false; this.pressed.delete(code); return true; }
  consumeLook() { const value = { x: Math.max(-180,Math.min(180,this.lookX)), y: Math.max(-180,Math.min(180,this.lookY)) }; this.lookX = 0; this.lookY = 0; return value; }
  consumeWheel() { const value = this.wheel; this.wheel = 0; return value; }
  endFrame() { this.pressed.clear(); }
  clear() { this.keys.clear(); this.pressed.clear(); this.mouseButtons.clear(); this.lookX = this.lookY = this.wheel = 0; }
  lock() { this.fallbackLook=false;if(typeof this.element.requestPointerLock!=='function'){this.fallbackLook=true;this.dispatchEvent(new Event('lockerror'));return;}try{const request=this.element.requestPointerLock();if(request?.catch)request.catch(()=>{this.fallbackLook=true;this.dispatchEvent(new Event('lockerror'));});}catch{this.fallbackLook=true;this.dispatchEvent(new Event('lockerror'));} }
  unlock() { this.fallbackLook=false;if (document.pointerLockElement === this.element) document.exitPointerLock(); }
}
