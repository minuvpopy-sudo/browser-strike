import * as THREE from 'three';
import { Firearm } from './Firearm.js';
import { Knife } from './Knife.js';

const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export class WeaponManager extends EventTarget {
  constructor(camera, player, input, audio, skinManager) {
    super();
    this.camera = camera;
    this.player = player;
    this.input = input;
    this.audio = audio;
    this.skinManager = skinManager;
    this.group = new THREE.Group();
    camera.add(this.group);
    this.lastActive = null;
    this.triggerDown = false;
    this.secondaryDown = false;
    this.sway = 0;
    this.scoped = false;
    this.flashTime = 0;
    this.drawTime = 0;
    this.knifeAction = null;
    this.rebuild();
  }

  update(dt) {
    const active = this.player.inventory.active;
    if (active) {
      const result = active.update(dt);
      if (result === 'reloaded') this.dispatch('ammo');
    }
    if (active !== this.lastActive) {
      this.rebuild();
      this.dispatch('weapon');
    }

    const moving = Math.hypot(this.player.velocity.x, this.player.velocity.z);
    this.sway += dt * (5 + moving);
    const baseX = active instanceof Knife ? 0.43 : 0.34;
    const baseY = active instanceof Knife ? -0.4 : -0.31;
    const baseZ = active instanceof Knife ? -1.0 : -0.62;
    this.group.position.x = baseX + Math.sin(this.sway) * Math.min(0.014, moving * 0.0022);
    this.group.position.y = baseY + Math.abs(Math.cos(this.sway)) * Math.min(0.012, moving * 0.002);
    this.group.position.z = THREE.MathUtils.lerp(this.group.position.z, baseZ, Math.min(1, dt * 16));

    this.flashTime = Math.max(0, this.flashTime - dt);
    const muzzle = this.group.getObjectByName('muzzle');
    if (muzzle) muzzle.intensity = this.flashTime > 0 ? 4 : 0;

    if (active instanceof Knife) {
      this.animateKnife(active, dt);
    } else {
      this.animateFirearm(active, dt, baseY);
    }
  }

  animateFirearm(active, dt, baseY) {
    const baseRotation = this.group.userData.baseRotation || new THREE.Euler(-0.08, 0.04, 0.025, 'YXZ');
    if (active?.reloadSystem?.active) {
      const progress = 1 - active.reloadSystem.remaining / active.definition.reload;
      this.group.rotation.x = baseRotation.x + Math.sin(progress * Math.PI) * 0.22;
      this.group.rotation.y = baseRotation.y - Math.sin(progress * Math.PI) * 0.35;
      this.group.rotation.z = baseRotation.z + Math.sin(progress * Math.PI) * 0.72;
      this.group.position.y = baseY - Math.sin(progress * Math.PI) * 0.24;
    } else if (active?.inspecting > 0) {
      const progress = 1 - active.inspecting / 1.5;
      this.group.rotation.x = baseRotation.x + Math.sin(progress * Math.PI * 2) * 0.18;
      this.group.rotation.y = baseRotation.y + Math.sin(progress * Math.PI) * 0.72;
      this.group.rotation.z = baseRotation.z + Math.sin(progress * Math.PI * 2) * 0.22;
    } else {
      this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, baseRotation.x, Math.min(1, dt * 11));
      this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, baseRotation.y, Math.min(1, dt * 11));
      this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, baseRotation.z, Math.min(1, dt * 11));
    }
  }

  animateKnife(knife, dt) {
    const base = this.group.userData.baseRotation || new THREE.Euler(1.02, 0.2, -0.1, 'YXZ');
    const left = this.group.getObjectByName('butterfly-handle-left');
    const right = this.group.getObjectByName('butterfly-handle-right');
    let handleLeft = 0;
    let handleRight = 0;
    let rotX = base.x;
    let rotY = base.y;
    let rotZ = base.z;
    let thrust = 0;

    if (this.drawTime > 0) {
      this.drawTime = Math.max(0, this.drawTime - dt);
      const progress = 1 - this.drawTime / 0.88;
      const eased = easeOutBack(Math.min(1, progress));
      handleLeft = Math.PI * (1 - eased);
      handleRight = -Math.PI * (1 - eased);
      rotX += (1 - eased) * 0.75;
      rotZ += (1 - eased) * 1.1;
    } else if (knife.inspecting > 0 && knife.variant === 'butterfly') {
      const progress = 1 - knife.inspecting / 1.5;
      const flourish = Math.sin(progress * Math.PI);
      handleLeft = Math.sin(progress * Math.PI * 4) * Math.PI * 0.92;
      handleRight = -Math.sin(progress * Math.PI * 4) * Math.PI * 0.92;
      rotY += progress * Math.PI * 2;
      rotZ += Math.sin(progress * Math.PI * 2) * 0.48 * flourish;
      rotX += Math.sin(progress * Math.PI * 4) * 0.18;
    }

    if (this.knifeAction) {
      this.knifeAction.elapsed += dt;
      const progress = Math.min(1, this.knifeAction.elapsed / this.knifeAction.duration);
      const arc = Math.sin(progress * Math.PI);
      if (this.knifeAction.heavy) {
        rotX -= arc * 0.62;
        rotY -= arc * 0.5;
        thrust = arc * -0.34;
      } else {
        rotZ -= arc * 1.05;
        rotY += arc * 0.32;
        thrust = arc * -0.16;
      }
      if (knife.variant === 'butterfly') {
        handleLeft += Math.sin(progress * Math.PI * 2) * 0.38;
        handleRight -= Math.sin(progress * Math.PI * 2) * 0.38;
      }
      if (progress >= 1) this.knifeAction = null;
    }

    if (left && right) {
      left.rotation.y = handleLeft;
      right.rotation.y = handleRight;
    }
    this.group.rotation.set(rotX, rotY, rotZ, 'YXZ');
    this.group.position.z += thrust;
  }

  handleInput(movement, camera) {
    if (!this.player.alive) return;
    if (this.input.justPressed('primary')) this.player.inventory.equip('primary');
    if (this.input.justPressed('pistol')) this.player.inventory.equip('pistol');
    if (this.input.justPressed('knife')) this.player.inventory.equip('knife');
    if (this.input.justPressed('lastWeapon')) this.player.inventory.quickSwap();
    const wheel = this.input.consumeWheel();
    if (wheel) this.player.inventory.cycle(wheel);

    const active = this.player.inventory.active;
    if (this.input.justPressed('reload') && active instanceof Firearm && active.reload()) {
      this.audio.reload();
      this.dispatch('reload');
    }
    if (this.input.justPressed('inspect') && active?.inspect()) this.audio.click();

    this.scoped = Boolean(active?.definition?.scope && this.input.mouseButtons.has(2));
    const down = this.input.mouseButtons.has(0);
    const auto = active?.definition?.mode === 'auto';
    if (down && (auto || !this.triggerDown)) this.fire(active, movement, camera, false);
    this.triggerDown = down;
    if (this.input.mouseButtons.has(2) && active instanceof Knife && !this.secondaryDown) {
      this.fire(active, movement, camera, true);
    }
    this.secondaryDown = this.input.mouseButtons.has(2);
  }

  fire(active, movement, camera, heavy) {
    if (active instanceof Firearm) {
      const motion = {
        speed: movement.speed,
        crouched: movement.crouched,
        airborne: !movement.grounded,
        scoped: this.scoped
      };
      const result = active.tryFire(motion);
      if (!result.ok) {
        if (result.reason === 'empty' && active.cooldown <= 0) {
          this.audio.empty();
          active.cooldown = 0.25;
        }
        return;
      }
      this.audio.shot(Math.max(0.7, active.definition.damage / 40));
      camera.addRecoil(result.recoil);
      this.group.position.z += 0.1;
      this.flashTime = 0.035;
      this.dispatchEvent(new CustomEvent('fire', {
        detail: {
          weapon: active,
          directions: Array.from({ length: result.pellets }, () =>
            camera.direction(result.pellets > 1 ? active.spread.offset(motion) : result.offset)
          )
        }
      }));
      this.dispatch('ammo');
    } else if (active instanceof Knife) {
      const strike = active.attack(heavy);
      if (strike) {
        this.knifeAction = { elapsed: 0, duration: heavy ? 0.78 : 0.42, heavy };
        this.audio.tone('shot', { frequency: heavy ? 165 : 235, gain: 0.045, duration: 0.12 });
        this.dispatchEvent(new CustomEvent('melee', {
          detail: { ...strike, direction: camera.direction() }
        }));
      }
    }
  }

  rebuild() {
    this.group.clear();
    this.group.scale.setScalar(1);
    this.knifeAction = null;
    const active = this.player.inventory.active;
    if (!active) return;
    if (active instanceof Knife) this.buildKnife(active);
    else this.buildGun(active.definition);
    this.drawTime = active instanceof Knife ? 0.88 : 0.35;
    this.lastActive = active;
  }

  buildGun(definition) {
    const skin = this.skinManager.weapon(definition.id);
    const metal = new THREE.MeshStandardMaterial({ color: skin.colors[0], metalness: 0.6, roughness: 0.38 });
    const dark = new THREE.MeshStandardMaterial({ color: skin.colors[1], roughness: 0.7 });
    const long = ['rifles', 'machineguns'].includes(definition.category);
    const smg = definition.category === 'smgs';
    const shotgun = definition.category === 'shotguns';
    const bodyLength = long ? 0.92 : smg || shotgun ? 0.7 : 0.5;
    const barrelLength = long ? 0.58 : shotgun ? 0.5 : 0.32;

    // Ось оружия направлена вдоль -Z: ствол смотрит туда же, куда камера.
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.2, bodyLength), metal);
    body.position.set(0, 0, -bodyLength * 0.48);
    this.group.add(body);

    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.09, bodyLength * 0.78), dark);
    slide.position.set(0, 0.13, -bodyLength * 0.5);
    this.group.add(slide);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, barrelLength, 8), dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.015, -bodyLength - barrelLength * 0.45);
    this.group.add(barrel);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.38, 0.21), dark);
    grip.position.set(0, -0.26, -bodyLength * 0.18);
    grip.rotation.x = -0.2;
    this.group.add(grip);

    if (long || shotgun) {
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.46), dark);
      stock.position.set(0, -0.03, 0.19);
      stock.rotation.x = -0.08;
      this.group.add(stock);
    }

    if (definition.scope) {
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.35, 10), dark);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.24, -bodyLength * 0.46);
      this.group.add(scope);
    }

    const muzzle = new THREE.PointLight(0xffc16b, 0, 3);
    muzzle.position.set(0, 0.015, -bodyLength - barrelLength);
    muzzle.name = 'muzzle';
    this.group.add(muzzle);

    const baseRotation = new THREE.Euler(-0.08, 0.04, 0.025, 'YXZ');
    this.group.userData.baseRotation = baseRotation;
    this.group.rotation.copy(baseRotation);
    this.group.position.set(0.34, -0.31, -0.62);
    this.group.scale.setScalar(long ? 0.76 : 0.84);
  }

  buildKnife(knife) {
    const style = this.skinManager.knifeStyle();
    const bladeMaterial = new THREE.MeshStandardMaterial({
      color: style.blade,
      metalness: 0.88,
      roughness: 0.22
    });
    const gripMaterial = new THREE.MeshStandardMaterial({
      color: style.handle,
      metalness: 0.32,
      roughness: 0.64
    });
    const pinMaterial = new THREE.MeshStandardMaterial({ color: 0xb3a371, metalness: 0.82, roughness: 0.24 });

    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-0.1, 0);
    bladeShape.lineTo(-0.11, -0.78);
    bladeShape.lineTo(0, -1.06);
    bladeShape.lineTo(0.12, -0.75);
    bladeShape.lineTo(0.1, 0);
    bladeShape.closePath();
    const blade = new THREE.Mesh(
      new THREE.ExtrudeGeometry(bladeShape, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.012, bevelSegments: 1 }),
      bladeMaterial
    );
    blade.rotation.x = Math.PI / 2;
    blade.position.set(0, 0.02, -0.05);
    this.group.add(blade);

    if (knife.variant === 'butterfly') {
      const makeHandle = (name, x) => {
        const pivot = new THREE.Group();
        pivot.name = name;
        pivot.position.set(x, 0, 0);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.78), gripMaterial);
        rail.position.z = 0.39;
        pivot.add(rail);
        for (const z of [0.15, 0.38, 0.61]) {
          const cutout = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.135, 0.08), pinMaterial);
          cutout.position.z = z;
          pivot.add(cutout);
        }
        const end = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.15, 0.12), gripMaterial);
        end.position.z = 0.76;
        pivot.add(end);
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.15, 12), pinMaterial);
        pin.rotation.z = Math.PI / 2;
        pivot.add(pin);
        this.group.add(pivot);
        return pivot;
      };
      makeHandle('butterfly-handle-left', -0.09);
      makeHandle('butterfly-handle-right', 0.09);
    } else {
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.12), pinMaterial);
      this.group.add(guard);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.82), gripMaterial);
      handle.position.z = 0.43;
      this.group.add(handle);
    }

    const baseRotation = new THREE.Euler(1.02, 0.2, -0.1, 'YXZ');
    this.group.userData.baseRotation = baseRotation;
    this.group.rotation.copy(baseRotation);
    this.group.position.set(0.4, -0.4, -1.0);
    this.group.scale.setScalar(0.68);
  }

  dispatch(type) {
    this.dispatchEvent(new CustomEvent(type, { detail: { weapon: this.player.inventory.active } }));
  }
}
