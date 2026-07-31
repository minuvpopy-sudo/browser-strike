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
    const karambitPivot = this.group.getObjectByName('karambit-pivot');
    let handleLeft = 0;
    let handleRight = 0;
    let rotX = base.x;
    let rotY = base.y;
    let rotZ = base.z;
    let thrust = 0;
    let pivotX = 0;
    let pivotY = 0;
    let pivotZ = 0;

    if (this.drawTime > 0) {
      this.drawTime = Math.max(0, this.drawTime - dt);
      const duration = knife.variant === 'karambit' ? 1.02 : .88;
      const progress = 1 - this.drawTime / duration;
      const eased = easeOutBack(Math.min(1, progress));
      if (knife.variant === 'karambit') {
        pivotY = (1 - eased) * -Math.PI * 1.8;
        pivotZ = (1 - eased) * Math.PI * 1.25;
        rotX += (1 - eased) * .38;
        thrust = (1 - eased) * .24;
      } else {
        handleLeft = Math.PI * (1 - eased);
        handleRight = -Math.PI * (1 - eased);
        rotX += (1 - eased) * .75;
        rotZ += (1 - eased) * 1.1;
      }
    } else if (knife.inspecting > 0 && knife.variant === 'butterfly') {
      const progress = 1 - knife.inspecting / 1.5;
      const flourish = Math.sin(progress * Math.PI);
      handleLeft = Math.sin(progress * Math.PI * 4) * Math.PI * 0.92;
      handleRight = -Math.sin(progress * Math.PI * 4) * Math.PI * 0.92;
      rotY += progress * Math.PI * 2;
      rotZ += Math.sin(progress * Math.PI * 2) * 0.48 * flourish;
      rotX += Math.sin(progress * Math.PI * 4) * 0.18;
    } else if (knife.inspecting > 0 && knife.variant === 'karambit') {
      const progress = 1 - knife.inspecting / 2.2;
      const flourish = Math.sin(progress * Math.PI);
      pivotX = Math.sin(progress * Math.PI * 4) * .52 * flourish;
      pivotY = progress * Math.PI * 4;
      pivotZ = Math.sin(progress * Math.PI * 2) * 1.05 * flourish;
      rotX += Math.sin(progress * Math.PI * 2) * .22;
      rotY -= Math.sin(progress * Math.PI) * .45;
      rotZ += progress * Math.PI * 2;
      thrust = -flourish * .18;
    }

    if (this.knifeAction) {
      this.knifeAction.elapsed += dt;
      const progress = Math.min(1, this.knifeAction.elapsed / this.knifeAction.duration);
      const arc = Math.sin(progress * Math.PI);
      if (knife.variant === 'karambit') {
        if (this.knifeAction.heavy) {
          rotZ += arc * 1.42;
          rotY -= arc * .72;
          pivotY -= arc * .65;
          thrust = arc * -.42;
        } else {
          rotX -= arc * .38;
          rotY += arc * .82;
          rotZ -= arc * .58;
          pivotZ += arc * .45;
          thrust = arc * -.24;
        }
      } else if (this.knifeAction.heavy) {
        rotX -= arc * .62;
        rotY -= arc * .5;
        thrust = arc * -.34;
      } else {
        rotZ -= arc * 1.05;
        rotY += arc * .32;
        thrust = arc * -.16;
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
    if (karambitPivot) karambitPivot.rotation.set(pivotX, pivotY, pivotZ, 'YXZ');
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
    this.clearModel();
    this.group.scale.setScalar(1);
    this.knifeAction = null;
    const active = this.player.inventory.active;
    if (!active) return;
    if (active instanceof Knife) this.buildKnife(active);
    else this.buildGun(active.definition);
    this.drawTime = active instanceof Knife ? (active.variant === 'karambit' ? 1.02 : .88) : .35;
    this.lastActive = active;
  }

  clearModel() {
    for (const child of [...this.group.children]) {
      child.traverse((object) => {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
        else object.material?.dispose();
      });
      this.group.remove(child);
    }
  }

  buildGun(definition) {
    const skin = this.skinManager.weapon(definition.id);
    const metal = new THREE.MeshStandardMaterial({ color: skin.colors[0], metalness: .52, roughness: .48, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: skin.colors[1], metalness: .18, roughness: .82, flatShading: true });
    const wood = new THREE.MeshStandardMaterial({ color: definition.id === 'ak47' ? 0x75451f : skin.colors[1], metalness: .04, roughness: .9, flatShading: true });
    const detail = new THREE.MeshStandardMaterial({ color: 0x111412, metalness: .32, roughness: .7, flatShading: true });
    const long = ['rifles', 'machineguns'].includes(definition.category);
    const smg = definition.category === 'smgs';
    const shotgun = definition.category === 'shotguns';
    const pistol = definition.category === 'pistols';
    const machinegun = definition.category === 'machineguns';
    const bodyLength = long ? .92 : smg || shotgun ? .72 : .52;
    const barrelLength = long ? .62 : shotgun ? .58 : smg ? .4 : .34;
    const addBox = (name, size, position, material = metal, rotation = [0, 0, 0]) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.name = name;
      mesh.position.set(...position);
      mesh.rotation.set(...rotation);
      this.group.add(mesh);
      return mesh;
    };
    const addCylinder = (name, radii, length, position, material = detail, rotation = [Math.PI / 2, 0, 0], segments = 8) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radii[0], radii[1], length, segments), material);
      mesh.name = name;
      mesh.position.set(...position);
      mesh.rotation.set(...rotation);
      this.group.add(mesh);
      return mesh;
    };

    if (pistol) {
      const heavy = definition.id === 'deagle';
      addBox('receiver', [heavy ? .32 : .27, .17, bodyLength], [-.005, .04, -bodyLength * .48], metal);
      addBox('pistol-frame', [.25, .1, bodyLength * .72], [0, -.08, -bodyLength * .38], dark);
      addBox('grip', [.2, .42, .24], [0, -.3, -.08], dark, [-.2, 0, 0]);
      addCylinder('barrel', [heavy ? .045 : .034, heavy ? .052 : .042], barrelLength, [0, .035, -bodyLength - barrelLength * .45]);
      addBox('front-sight', [.045, .055, .055], [0, .165, -bodyLength * .9], detail);
      addBox('rear-sight', [.11, .045, .045], [0, .16, -.12], detail);
      const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(.1, .018, 4, 10, Math.PI), detail);
      triggerGuard.name = 'trigger-guard';
      triggerGuard.rotation.set(0, Math.PI / 2, Math.PI / 2);
      triggerGuard.position.set(0, -.14, -.2);
      this.group.add(triggerGuard);
    } else {
      addBox('receiver', [.3, .25, bodyLength], [0, .01, -bodyLength * .43], metal);
      addBox('receiver-top', [.26, .09, bodyLength * .72], [0, .18, -bodyLength * .47], detail);
      addCylinder('barrel', [shotgun ? .055 : .038, shotgun ? .062 : .047], barrelLength, [0, .055, -bodyLength - barrelLength * .44]);
      addBox('pistol-grip', [.2, .4, .24], [0, -.29, -.17], dark, [-.22, 0, 0]);

      if (definition.id === 'ak47') {
        addBox('wood-stock', [.31, .28, .62], [0, -.01, .36], wood, [-.08, 0, 0]);
        addBox('wood-handguard', [.31, .2, .48], [0, -.02, -bodyLength * .98], wood);
        addBox('magazine-upper', [.22, .34, .22], [0, -.3, -.38], detail, [-.14, 0, 0]);
        addBox('magazine-lower', [.21, .34, .2], [0, -.57, -.29], detail, [-.38, 0, 0]);
        addCylinder('gas-tube', [.025, .025], .52, [0, .17, -1.0], detail);
      } else {
        const stockMaterial = ['galil', 'scout'].includes(definition.id) ? wood : dark;
        addBox('stock', [.29, .25, smg ? .38 : .56], [0, -.01, smg ? .27 : .34], stockMaterial, [-.07, 0, 0]);
        if (machinegun) {
          addBox('ammo-box', [.36, .4, .34], [0, -.31, -.35], dark, [-.04, 0, 0]);
        } else if (!shotgun) {
          addBox('magazine', [.22, smg ? .42 : .48, .24], [0, smg ? -.33 : -.38, -.35], detail, [smg ? -.05 : -.18, 0, 0]);
        }
        addBox('handguard', [.3, .2, shotgun ? .62 : .48], [0, -.02, -bodyLength * .95], shotgun ? wood : dark);
      }

      if (shotgun) {
        addCylinder('magazine-tube', [.035, .035], .74, [0, -.08, -1.02], detail);
        addBox('pump', [.31, .19, .34], [0, -.08, -.84], wood);
      }

      if (definition.scope) {
        addCylinder('scope', [.085, .085], .42, [0, .31, -bodyLength * .45], detail, [Math.PI / 2, 0, 0], 10);
        addCylinder('scope-front', [.105, .105], .11, [0, .31, -bodyLength * .66], detail, [Math.PI / 2, 0, 0], 10);
        addBox('scope-mount', [.12, .1, .24], [0, .21, -bodyLength * .44], dark);
      } else {
        addBox('rear-sight', [.11, .08, .08], [0, .26, -.18], detail);
        addBox('front-sight', [.07, .11, .07], [0, .22, -bodyLength - barrelLength * .7], detail);
      }
    }

    const muzzle = new THREE.PointLight(0xffc16b, 0, 3);
    muzzle.position.set(0, .04, -bodyLength - barrelLength);
    muzzle.name = 'muzzle';
    this.group.add(muzzle);

    const baseRotation = new THREE.Euler(-.09, .04, .025, 'YXZ');
    this.group.userData.baseRotation = baseRotation;
    this.group.rotation.copy(baseRotation);
    this.group.position.set(.36, -.32, -.68);
    this.group.scale.setScalar(long ? .72 : pistol ? .86 : .78);
  }

  buildKnife(knife) {
    const style = this.skinManager.knifeStyle();
    const bladeMaterial = new THREE.MeshStandardMaterial({
      color: style.blade,
      metalness: .88,
      roughness: .22,
      flatShading: true
    });
    const gripMaterial = new THREE.MeshStandardMaterial({
      color: style.handle,
      metalness: .32,
      roughness: .64,
      flatShading: true
    });
    const pinMaterial = new THREE.MeshStandardMaterial({ color: 0xb3a371, metalness: .82, roughness: .24, flatShading: true });

    if (knife.variant === 'karambit') {
      const pivot = new THREE.Group();
      pivot.name = 'karambit-pivot';
      this.group.add(pivot);
      const bladeShape = new THREE.Shape();
      bladeShape.moveTo(-.11, .03);
      bladeShape.quadraticCurveTo(-.38, -.42, -.19, -.82);
      bladeShape.quadraticCurveTo(.01, -1.18, .24, -.92);
      bladeShape.quadraticCurveTo(.02, -.72, .06, -.23);
      bladeShape.lineTo(.13, .03);
      bladeShape.closePath();
      const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(bladeShape, { depth: .055, bevelEnabled: true, bevelThickness: .02, bevelSize: .014, bevelSegments: 1 }), bladeMaterial);
      blade.name = 'karambit-blade';
      blade.rotation.x = Math.PI / 2;
      blade.position.set(0, .02, -.04);
      pivot.add(blade);

      const handle = new THREE.Mesh(new THREE.BoxGeometry(.28, .18, .82), gripMaterial);
      handle.name = 'karambit-handle';
      handle.position.set(0, 0, .45);
      handle.rotation.x = .08;
      pivot.add(handle);
      for (const z of [.18, .42, .66]) {
        const grip = new THREE.Mesh(new THREE.BoxGeometry(.3, .195, .055), pinMaterial);
        grip.position.z = z;
        pivot.add(grip);
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.16, .045, 7, 18), gripMaterial);
      ring.name = 'karambit-ring';
      ring.position.set(0, 0, .91);
      pivot.add(ring);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(.43, .11, .12), pinMaterial);
      guard.position.z = .04;
      pivot.add(guard);
    } else {
      const bladeShape = new THREE.Shape();
      bladeShape.moveTo(-.1, 0);
      bladeShape.lineTo(-.11, -.78);
      bladeShape.lineTo(0, -1.06);
      bladeShape.lineTo(.12, -.75);
      bladeShape.lineTo(.1, 0);
      bladeShape.closePath();
      const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(bladeShape, { depth: .045, bevelEnabled: true, bevelThickness: .018, bevelSize: .012, bevelSegments: 1 }), bladeMaterial);
      blade.rotation.x = Math.PI / 2;
      blade.position.set(0, .02, -.05);
      this.group.add(blade);
    }

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
    } else if (knife.variant !== 'karambit') {
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.12), pinMaterial);
      this.group.add(guard);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.82), gripMaterial);
      handle.position.z = 0.43;
      this.group.add(handle);
    }

    const baseRotation = knife.variant === 'karambit'
      ? new THREE.Euler(.96, .28, -.22, 'YXZ')
      : new THREE.Euler(1.02, .2, -.1, 'YXZ');
    this.group.userData.baseRotation = baseRotation;
    this.group.rotation.copy(baseRotation);
    this.group.position.set(.4, knife.variant === 'karambit' ? -.36 : -.4, knife.variant === 'karambit' ? -1.08 : -1);
    this.group.scale.setScalar(knife.variant === 'karambit' ? .74 : .68);
  }

  dispatch(type) {
    this.dispatchEvent(new CustomEvent(type, { detail: { weapon: this.player.inventory.active } }));
  }
}
