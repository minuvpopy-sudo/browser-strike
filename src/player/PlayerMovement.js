import * as THREE from 'three';

const smoothstep = (value) => value * value * (3 - 2 * value);

export class PlayerMovement {
  constructor(player, collision, input) {
    this.player = player;this.collision = collision;this.input = input;this.grounded = true;this.crouched = false;this.bob = 0;this.landing = 0;this.speed = 0;this.mantle = null;
  }

  update(dt, yaw, settings, audio) {
    if (!this.player.alive) return;
    if (this.mantle) {
      this.mantle.elapsed = Math.min(this.mantle.duration, this.mantle.elapsed + dt);
      const linear = this.mantle.elapsed / this.mantle.duration;
      const progress = smoothstep(linear);
      this.player.position.x = THREE.MathUtils.lerp(this.mantle.start.x, this.mantle.target.x, progress);
      this.player.position.z = THREE.MathUtils.lerp(this.mantle.start.z, this.mantle.target.z, progress);
      this.player.position.y = THREE.MathUtils.lerp(this.mantle.start.y, this.mantle.target.y, progress) + Math.sin(linear * Math.PI) * .28;
      this.player.velocity.set(0, 0, 0);this.grounded = false;this.speed = 0;
      if (linear >= 1) { this.player.position.y = this.mantle.target.y;this.mantle = null;this.grounded = true;this.landing = .08; }
      return;
    }

    const forward = (this.input.action('forward') ? 1 : 0) - (this.input.action('backward') ? 1 : 0);
    const side = (this.input.action('right') ? 1 : 0) - (this.input.action('left') ? 1 : 0);
    const wish = new THREE.Vector3(side, 0, -forward);
    if (wish.lengthSq() > 0) wish.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const wishDirection = wish.clone();
    this.crouched = this.input.action('crouch');
    const walking = this.input.action('walk');
    let maxSpeed = this.crouched ? 3.2 : walking ? 4.2 : 7.2;
    maxSpeed *= this.player.inventory.active?.definition?.moveSpeed || 1;
    const horizontal = new THREE.Vector3(this.player.velocity.x, 0, this.player.velocity.z);
    const target = wish.multiplyScalar(maxSpeed);
    const accel = this.grounded ? 16 : 3.4;
    horizontal.lerp(target, Math.min(1, accel * dt));
    if (forward === 0 && side === 0 && this.grounded) horizontal.multiplyScalar(Math.max(0, 1 - 9 * dt));
    this.player.velocity.x = horizontal.x;this.player.velocity.z = horizontal.z;

    const startedGrounded = this.grounded;
    const jumpPressed = settings.autoBhop ? this.input.action('jump') : this.input.justPressed('jump');
    let jumped = false;
    if (jumpPressed && this.grounded && !this.crouched) {
      const mantleTarget = this.collision.findMantle?.(this.player.position, wishDirection, .58, 6.2);
      if (mantleTarget) {
        this.mantle = { start: this.player.position.clone(), target: mantleTarget, elapsed: 0, duration: THREE.MathUtils.clamp(.2 + mantleTarget.rise * .035, .22, .42) };
        this.grounded = false;this.player.velocity.set(0, 0, 0);audio?.tone?.('steps', { frequency: 95, endFrequency: 58, gain: .018, duration: .08 });return;
      }
      this.player.velocity.y = 6.1;this.grounded = false;jumped = true;
    }

    this.player.velocity.y -= 17.5 * dt;
    const wasAir = !this.grounded;
    let nextY = this.player.position.y + this.player.velocity.y * dt;
    let moved = this.collision.moveCircle(
      this.player.position,
      { x: this.player.velocity.x * dt, z: this.player.velocity.z * dt },
      .58,
      { feetY: this.player.position.y, stepHeight: startedGrounded && !jumped ? .65 : .08 },
    );
    let groundY = this.collision.groundHeightAt?.(moved.x, moved.z, nextY + (this.player.velocity.y <= 0 ? .32 : .08)) || 0;
    const groundDelta = groundY - this.player.position.y;
    if (startedGrounded && !jumped && groundDelta > .65) {
      moved = { x: this.player.position.x, z: this.player.position.z, blockedX: true, blockedZ: true };
      groundY = this.collision.groundHeightAt?.(moved.x, moved.z, this.player.position.y + .65) || 0;
      this.player.velocity.x = 0;this.player.velocity.z = 0;
    }
    const canFollowSlope = startedGrounded && !jumped && Math.abs(groundY - this.player.position.y) <= .65;
    if (canFollowSlope || nextY <= groundY) {
      nextY = groundY;this.player.velocity.y = 0;this.grounded = true;if (wasAir && !canFollowSlope) this.landing = .12;
    } else this.grounded = false;
    this.player.position.y = nextY;this.player.position.x = moved.x;this.player.position.z = moved.z;
    if (moved.blockedX) this.player.velocity.x = 0;if (moved.blockedZ) this.player.velocity.z = 0;
    this.speed = Math.hypot(this.player.velocity.x, this.player.velocity.z);
    if (this.grounded && this.speed > .8) this.bob += dt * this.speed * 1.65;
    this.landing = Math.max(0, this.landing - dt);
  }
}
