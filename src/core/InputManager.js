export class InputManager extends EventTarget {
  constructor(element, settings) {
    super();
    this.element = element;
    this.settings = settings;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseButtons = new Set();
    this.lookX = 0; this.lookY = 0; this.wheel = 0;
    this.enabled = false; this.listening = false;
    this.handlers = {
      keydown: (e) => this.onKeyDown(e), keyup: (e) => this.onKeyUp(e),
      mousedown: (e) => this.onMouseDown(e), mouseup: (e) => this.onMouseUp(e),
      mousemove: (e) => this.onMouseMove(e), wheel: (e) => this.onWheel(e),
      contextmenu: (e) => e.preventDefault(), blur: () => this.clear(),
      pointerlockchange: () => this.dispatchEvent(new CustomEvent('lockchange', { detail: document.pointerLockElement === this.element }))
    };
  }
  attach() {
    if (this.listening) return;
    this.listening = true;
    for (const type of ['keydown','keyup']) window.addEventListener(type, this.handlers[type]);
    for (const type of ['mousedown','mouseup','mousemove','wheel','contextmenu']) this.element.addEventListener(type, this.handlers[type], { passive: type === 'wheel' });
    window.addEventListener('blur', this.handlers.blur);
    document.addEventListener('pointerlockchange', this.handlers.pointerlockchange);
  }
  detach() {
    if (!this.listening) return;
    this.listening = false;
    for (const type of ['keydown','keyup']) window.removeEventListener(type, this.handlers[type]);
    for (const type of ['mousedown','mouseup','mousemove','wheel','contextmenu']) this.element.removeEventListener(type, this.handlers[type]);
    window.removeEventListener('blur', this.handlers.blur);
    document.removeEventListener('pointerlockchange', this.handlers.pointerlockchange);
    this.clear();
  }
  onKeyDown(e) { if (!this.enabled) return; if (!this.keys.has(e.code)) this.pressed.add(e.code); this.keys.add(e.code); if (['Tab','Space'].includes(e.code)) e.preventDefault(); }
  onKeyUp(e) { this.keys.delete(e.code); }
  onMouseDown(e) { if (this.enabled) this.mouseButtons.add(e.button); }
  onMouseUp(e) { this.mouseButtons.delete(e.button); }
  onMouseMove(e) { if (this.enabled && document.pointerLockElement === this.element) { this.lookX += e.movementX; this.lookY += e.movementY; } }
  onWheel(e) { if (this.enabled) this.wheel += Math.sign(e.deltaY); }
  action(name) { return this.keys.has(this.settings.values.keys[name]); }
  justPressed(name) { const code = this.settings.values.keys[name]; if (!this.pressed.has(code)) return false; this.pressed.delete(code); return true; }
  consumeLook() { const value = { x: this.lookX, y: this.lookY }; this.lookX = 0; this.lookY = 0; return value; }
  consumeWheel() { const value = this.wheel; this.wheel = 0; return value; }
  endFrame() { this.pressed.clear(); }
  clear() { this.keys.clear(); this.pressed.clear(); this.mouseButtons.clear(); this.lookX = this.lookY = this.wheel = 0; }
  lock() { const request=this.element.requestPointerLock?.(); if(request?.catch)request.catch(()=>this.dispatchEvent(new Event('lockerror'))); }
  unlock() { if (document.pointerLockElement === this.element) document.exitPointerLock(); }
}
