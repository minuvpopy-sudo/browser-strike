export class GameLoop {
  constructor(fixedUpdate, render, step = 1 / 60, onError = console.error) {
    this.fixedUpdate = fixedUpdate; this.render = render; this.step = step; this.onError = onError;
    this.running = false; this.paused = false; this.last = 0; this.accumulator = 0; this.frame = 0;
    this.errorStreak = 0; this.errorCooldown = 0;
    this.tick = this.tick.bind(this);
  }
  start() { if (this.running) return; this.running = true; this.last = performance.now(); this.frame = requestAnimationFrame(this.tick); }
  stop() { this.running = false; cancelAnimationFrame(this.frame); }
  tick(now) {
    if (!this.running) return;
    const delta = Math.min((now - this.last) / 1000, 0.1); this.last = now;
    if (this.errorCooldown > 0) {
      this.errorCooldown = Math.max(0, this.errorCooldown - delta);
      if (this.running) this.frame = requestAnimationFrame(this.tick);
      return;
    }
    try {
      if (!this.paused) {
        this.accumulator += delta;
        let safety = 0;
        while (this.accumulator >= this.step && safety++ < 6) { this.fixedUpdate(this.step); this.accumulator -= this.step; }
        this.render(delta, this.accumulator / this.step);
        this.errorStreak = 0;
      }
    } catch (error) {
      this.accumulator = 0;
      this.errorStreak++;
      this.errorCooldown = Math.min(.65, .04 * Math.pow(2, Math.min(4, this.errorStreak - 1)));
      this.onError?.(error, { streak: this.errorStreak, cooldown: this.errorCooldown });
    }
    if (this.running) this.frame = requestAnimationFrame(this.tick);
  }
}
