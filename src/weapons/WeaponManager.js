import * as THREE from 'three';
import { Firearm } from './Firearm.js';
import { Knife } from './Knife.js';
import { animateKnifeWaves, collectKnifeWaveMaterials, createKnifeBladeMaterial, disposeKnifeMaterial } from '../skins/KnifeMaterial.js';

const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const roundedBoxGeometry = ([width, height, depth], radius = .045) => {
  const w = Math.max(.01, width);
  const h = Math.max(.01, height);
  const d = Math.max(.01, depth);
  const r = Math.min(radius, w * .26, h * .26);
  const shape = new THREE.Shape();
  const left = -w / 2; const right = w / 2; const bottom = -h / 2; const top = h / 2;
  shape.moveTo(left + r, bottom);
  shape.lineTo(right - r, bottom); shape.quadraticCurveTo(right, bottom, right, bottom + r);
  shape.lineTo(right, top - r); shape.quadraticCurveTo(right, top, right - r, top);
  shape.lineTo(left + r, top); shape.quadraticCurveTo(left, top, left, top - r);
  shape.lineTo(left, bottom + r); shape.quadraticCurveTo(left, bottom, left + r, bottom);
  const bevel = Math.min(r * .38, d * .2);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(.004, d - bevel * 2), curveSegments: 3,
    bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2
  });
  geometry.center();
  geometry.userData.rounded = true;
  return geometry;
};

const createAwpDecalTexture = () => {
  if (typeof document === 'undefined') return null;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=192;const context=canvas.getContext('2d');
  context.clearRect(0,0,canvas.width,canvas.height);context.lineJoin='round';context.lineCap='round';
  context.beginPath();context.moveTo(18,124);context.bezierCurveTo(88,80,120,18,205,34);context.bezierCurveTo(172,64,165,85,156,116);context.bezierCurveTo(235,69,298,51,389,58);context.bezierCurveTo(334,83,298,109,265,154);context.bezierCurveTo(204,120,151,129,83,169);context.closePath();context.fillStyle='#f26a19';context.fill();context.strokeStyle='#351811';context.lineWidth=16;context.stroke();
  context.beginPath();context.moveTo(70,136);context.bezierCurveTo(141,100,177,63,231,58);context.bezierCurveTo(204,88,214,105,196,132);context.bezierCurveTo(248,102,303,86,356,86);context.bezierCurveTo(300,112,275,136,252,164);context.bezierCurveTo(189,134,139,146,99,174);context.closePath();context.fillStyle='#b8321d';context.fill();
  context.beginPath();context.moveTo(205,38);context.quadraticCurveTo(238,10,265,37);context.quadraticCurveTo(239,39,224,58);context.closePath();context.fillStyle='#20251d';context.fill();
  context.strokeStyle='#f6a431';context.lineWidth=8;for(const [x,y,length,angle] of [[283,72,92,-.22],[318,96,105,.02],[143,86,76,-.55]]){context.beginPath();context.moveTo(x,y);context.lineTo(x+Math.cos(angle)*length,y+Math.sin(angle)*length);context.stroke();}
  context.fillStyle='#24271f';context.beginPath();context.arc(226,64,13,0,Math.PI*2);context.fill();context.fillStyle='#f3d66d';context.beginPath();context.arc(231,61,4,0,Math.PI*2);context.fill();
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
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
    this.skinTime = 0;
    this.waveMaterials = [];
    this.knifeAction = null;
    this.rebuild();
  }

  update(dt) {
    this.skinTime += dt;
    if (this.waveMaterials?.length) animateKnifeWaves(this.waveMaterials, this.skinTime);
    const active = this.player.inventory.active;
    if (typeof active?.update === 'function') {
      const result = active.update(dt);
      if (result === 'reloaded') this.dispatch('ammo');
    }
    if (active !== this.lastActive) {
      this.rebuild();
      this.dispatch('weapon');
    }

    const moving = Math.hypot(this.player.velocity.x, this.player.velocity.z);
    this.sway += dt * (5 + moving);
    const holdingBomb = active?.definition?.id === 'bomb';
    const holdingGrenade = active?.definition?.category === 'grenades';
    const baseX = active instanceof Knife ? 0.43 : holdingBomb ? .38 : holdingGrenade ? .4 : 0.34;
    const baseY = active instanceof Knife ? -0.4 : holdingBomb ? -.42 : holdingGrenade ? -.43 : -0.31;
    const baseZ = active instanceof Knife ? -1.0 : holdingBomb ? -1.08 : holdingGrenade ? -.95 : -0.62;
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
    if (this.input.justPressed('grenades')) this.player.inventory.selectGrenade();
    if (this.input.justPressed('bomb')) this.player.inventory.equip('bomb');
    if (this.input.justPressed('lastWeapon')) this.player.inventory.quickSwap();
    const wheel = this.input.consumeWheel();
    if (wheel) this.player.inventory.cycle(wheel);

    const active = this.player.inventory.active;
    if(active?.definition?.category==='grenades'){
      const down=this.input.mouseButtons.has(0);
      if(down&&!this.triggerDown)this.dispatchEvent(new CustomEvent('throwgrenade',{detail:{id:active.definition.id}}));
      this.triggerDown=down;this.secondaryDown=this.input.mouseButtons.has(2);return;
    }
    if (this.input.justPressed('reload') && active instanceof Firearm && active.reload()) {
      this.audio.reload();
      this.dispatch('reload');
    }
    if (this.input.justPressed('inspect') && active?.inspect()) this.audio.click();

    const nextScoped = Boolean(active?.definition?.scope && this.input.mouseButtons.has(2));
    if (nextScoped !== this.scoped) this.audio.scope?.(nextScoped);
    this.scoped = nextScoped;
    this.group.visible = !this.scoped;
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
      this.audio.shot(Math.max(0.7, active.definition.damage / 40), active.definition);
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
    else if (active.definition?.id === 'bomb') this.buildBomb();
    else if (active.definition?.category === 'grenades') this.buildGrenade(active.definition);
    else this.buildGun(active.definition);
    this.waveMaterials = collectKnifeWaveMaterials(this.group);
    this.drawTime = active instanceof Knife ? (active.variant === 'karambit' ? 1.02 : .88) : .35;
    this.lastActive = active;
  }

  buildBomb() {
    const body = new THREE.MeshStandardMaterial({ color: 0x263028, metalness: .12, roughness: .82, flatShading: true });
    const panel = new THREE.MeshStandardMaterial({ color: 0x151a16, metalness: .25, roughness: .7, flatShading: true });
    const screen = new THREE.MeshBasicMaterial({ color: 0x98d263 });
    const wireColors = [0xd54737, 0x3979c7, 0xe1c944];
    const pack = new THREE.Mesh(new THREE.BoxGeometry(.62, .38, .23), body);
    pack.name = 'held-bomb';
    this.group.add(pack);
    const keypad = new THREE.Mesh(new THREE.BoxGeometry(.3, .22, .035), panel);
    keypad.position.set(.08, .02, -.135);
    this.group.add(keypad);
    const display = new THREE.Mesh(new THREE.BoxGeometry(.18, .06, .012), screen);
    display.position.set(.08, .095, -.158);
    this.group.add(display);
    for (let i = 0; i < 3; i++) {
      const wire = new THREE.Mesh(
        new THREE.TorusGeometry(.16 + i * .035, .012, 5, 12, Math.PI),
        new THREE.MeshBasicMaterial({ color: wireColors[i] })
      );
      wire.rotation.set(Math.PI / 2, 0, Math.PI / 2);
      wire.position.set(-.2, .12, -.03 + i * .035);
      this.group.add(wire);
    }
    const baseRotation = new THREE.Euler(.12, -.18, -.08, 'YXZ');
    this.group.userData.baseRotation = baseRotation;
    this.group.rotation.copy(baseRotation);
    this.group.position.set(.38, -.42, -1.08);
    this.group.scale.setScalar(.9);
  }

  buildGrenade(definition) {
    const colors={he:0x40513d,flash:0xc9cec5,smoke:0x68776b,decoy:0x3e4d58};
    const accents={he:0xb56b34,flash:0xd9d27a,smoke:0x93a9a0,decoy:0x4aa3c7};
    const bodyMaterial=new THREE.MeshStandardMaterial({color:colors[definition.id]||0x4b554b,metalness:.48,roughness:.52,flatShading:true});
    const dark=new THREE.MeshStandardMaterial({color:0x20251f,metalness:.7,roughness:.34,flatShading:true});
    const accent=new THREE.MeshStandardMaterial({color:accents[definition.id]||0xb2aa64,metalness:.35,roughness:.45});
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.15,.17,.43,14,2),bodyMaterial);body.name='held-grenade';this.group.add(body);
    const top=new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,.1,12),dark);top.position.y=.26;this.group.add(top);
    const lever=new THREE.Mesh(roundedBoxGeometry([.13,.055,.36],.018),dark);lever.position.set(.085,.24,.08);lever.rotation.x=.18;this.group.add(lever);
    const band=new THREE.Mesh(new THREE.TorusGeometry(.155,.022,7,18),accent);band.rotation.x=Math.PI/2;band.position.y=.02;this.group.add(band);
    const pin=new THREE.Mesh(new THREE.TorusGeometry(.085,.014,6,18),dark);pin.rotation.y=Math.PI/2;pin.position.set(-.14,.28,0);this.group.add(pin);
    const baseRotation=new THREE.Euler(.32,-.18,.16,'YXZ');this.group.userData.baseRotation=baseRotation;this.group.rotation.copy(baseRotation);this.group.position.set(.4,-.43,-.95);this.group.scale.setScalar(1.05);
  }

  clearModel() {
    this.waveMaterials = [];
    for (const child of [...this.group.children]) {
      child.traverse((object) => {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) object.material.forEach(disposeKnifeMaterial);
        else disposeKnifeMaterial(object.material);
      });
      this.group.remove(child);
    }
  }

  buildGun(definition) {
    const skin = this.skinManager.weapon(definition.id);
    const referenceAwp=definition.id==='awp';
    const metal = new THREE.MeshStandardMaterial({ color: referenceAwp?0xe3e9b8:skin.colors[0], metalness: referenceAwp?.18:.58, roughness: referenceAwp?.56:.4 });
    const dark = new THREE.MeshStandardMaterial({ color: referenceAwp?0x23271f:skin.colors[1], metalness: .2, roughness: .7 });
    const wood = new THREE.MeshStandardMaterial({ color: definition.id === 'ak47' ? 0x75451f : skin.colors[1], metalness: .04, roughness: .78 });
    const detail = new THREE.MeshStandardMaterial({ color: 0x111412, metalness: .42, roughness: .54 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x426b72, metalness: .18, roughness: .16, emissive: 0x071315 });
    const awpMint=referenceAwp?new THREE.MeshStandardMaterial({color:0xc8dba8,metalness:.12,roughness:.6}):metal;
    const awpOrange=referenceAwp?new THREE.MeshStandardMaterial({color:0xf06a1b,metalness:.25,roughness:.46}):metal;
    const awpRed=referenceAwp?new THREE.MeshStandardMaterial({color:0xa52d20,metalness:.2,roughness:.52}):metal;
    const awpScope=referenceAwp?new THREE.MeshStandardMaterial({color:0x252b22,metalness:.55,roughness:.32}):detail;
    const awpGlass=referenceAwp?new THREE.MeshStandardMaterial({color:0x688875,metalness:.16,roughness:.1,emissive:0x173126,emissiveIntensity:.45}):glass;
    const long = ['rifles', 'machineguns'].includes(definition.category);
    const smg = definition.category === 'smgs';
    const shotgun = definition.category === 'shotguns';
    const pistol = definition.category === 'pistols';
    const machinegun = definition.category === 'machineguns';
    const sniper = ['scout','awp','g3sg1','sg550'].includes(definition.id);
    const bodyLength = long ? (sniper ? 1.02 : .92) : smg || shotgun ? .72 : .52;
    const barrelLength = long ? (['scout','awp'].includes(definition.id) ? .86 : .62) : shotgun ? .58 : smg ? .4 : .34;
    const addBox = (name, size, position, material = metal, rotation = [0, 0, 0], radius = .045) => {
      const mesh = new THREE.Mesh(roundedBoxGeometry(size, radius), material);
      mesh.name = name;
      mesh.position.set(...position);
      mesh.rotation.set(...rotation);
      this.group.add(mesh);
      return mesh;
    };
    const addCylinder = (name, radii, length, position, material = detail, rotation = [Math.PI / 2, 0, 0], segments = 14) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radii[0], radii[1], length, segments), material);
      mesh.name = name;
      mesh.position.set(...position);
      mesh.rotation.set(...rotation);
      this.group.add(mesh);
      return mesh;
    };

    if (pistol) {
      const heavy = definition.id === 'deagle';
      const compact = definition.id === 'p228';
      const longSlide = ['fiveseven','usp'].includes(definition.id);
      const slideLength = heavy ? .68 : compact ? .48 : longSlide ? .59 : .54;
      const buildPistol = (x, secondary = false) => {
        const prefix = secondary ? 'dual-' : '';
        addBox(secondary?'receiver-dual':'receiver',[heavy ? .36 : .29,heavy ? .2 : .17,slideLength],[x,.055,-slideLength*.46],metal,[0,secondary ? .045 : -.025,0],heavy ? .055 : .038);
        addBox(`${prefix}pistol-frame`,[heavy ? .31 : .255,.115,slideLength*.72],[x,-.085,-slideLength*.38],dark,[0,secondary ? .045 : -.025,0],.04);
        addBox(`${prefix}grip`,[heavy ? .235 : .205,.44,.255],[x,-.31,-.075],dark,[-.22,secondary ? .045 : -.025,0],.065);
        addBox(`${prefix}grip-inlay`,[heavy ? .19 : .165,.3,.262],[x,-.315,-.07],detail,[-.22,secondary ? .045 : -.025,0],.055);
        addCylinder(`${prefix}barrel`,[heavy ? .052 : .037,heavy ? .058 : .043],heavy ? .46 : .34,[x,.045,-slideLength-.14],detail,[Math.PI/2,0,0],18);
        addBox(`${prefix}front-sight`,[.045,.065,.06],[x,.18,-slideLength*.91],detail,[0,0,0],.012);
        addBox(`${prefix}rear-sight`,[.13,.05,.055],[x,.175,-.11],detail,[0,0,0],.012);
        addBox(`${prefix}ejection-port`,[heavy ? .22 : .17,.018,.15],[x+.01,.151,-slideLength*.48],detail,[0,0,0],.008);
        for(let i=0;i<4;i++)addBox(`${prefix}slide-serration-${i}`,[heavy ? .31 : .255,.025,.022],[x,.075,-.12-i*.042],detail,[0,0,0],.005);
        const triggerGuard=new THREE.Mesh(new THREE.TorusGeometry(heavy ? .115 : .1,.018,8,20,Math.PI),detail);
        triggerGuard.name=`${prefix}trigger-guard`;triggerGuard.rotation.set(0,Math.PI/2,Math.PI/2);triggerGuard.position.set(x,-.145,-.2);this.group.add(triggerGuard);
        const trigger=new THREE.Mesh(new THREE.TorusGeometry(.055,.012,6,14,Math.PI*.72),metal);
        trigger.name=`${prefix}trigger`;trigger.rotation.set(0,Math.PI/2,Math.PI/2);trigger.position.set(x,-.14,-.2);this.group.add(trigger);
      };
      if(definition.id==='elites'){buildPistol(-.15);buildPistol(.17,true);}else buildPistol(0);
      if(definition.id==='usp'){
        addCylinder('usp-suppressor',[.07,.062],.48,[0,.045,-.92],detail,[Math.PI/2,0,0],20);
        addCylinder('usp-suppressor-cap',[.073,.073],.045,[0,.045,-1.16],metal,[Math.PI/2,0,0],20);
      }
      if(heavy){addBox('deagle-barrel-rib',[.28,.065,.42],[0,.18,-.48],detail,[0,0,0],.025);addCylinder('deagle-muzzle',[.075,.062],.13,[0,.045,-.98],metal,[Math.PI/2,0,0],20);}
    } else {
      addBox('receiver', [.3, .25, bodyLength], [0, .01, -bodyLength * .43], metal);
      addBox('receiver-top', [.26, .09, bodyLength * .72], [0, .18, -bodyLength * .47], detail);
      addCylinder('barrel', [shotgun ? .055 : .038, shotgun ? .062 : .047], barrelLength, [0, .055, -bodyLength - barrelLength * .44]);
      addBox('pistol-grip', [.2, .4, .24], [0, -.29, -.17], dark, [-.22, 0, 0]);
      const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(.105, .018, 4, 12, Math.PI), detail);
      triggerGuard.name = 'rifle-trigger-guard';
      triggerGuard.rotation.set(0, Math.PI / 2, Math.PI / 2);
      triggerGuard.position.set(0, -.16, -.34);
      this.group.add(triggerGuard);

      if (definition.id === 'ak47') {
        addBox('wood-stock', [.34, .25, .52], [0, -.01, .3], wood, [-.08, 0, 0]);
        addBox('wood-stock-comb', [.3, .14, .36], [0, .12, .39], wood, [-.05, 0, 0]);
        addBox('wood-buttplate', [.36, .36, .11], [0, -.03, .61], detail, [-.08, 0, 0]);
        addBox('wood-handguard', [.35, .2, .48], [0, -.03, -bodyLength * .98], wood, [.03, 0, 0]);
        addBox('wood-upper-handguard', [.28, .14, .44], [0, .14, -bodyLength * 1.01], wood, [-.02, 0, 0]);
        addBox('magazine-upper', [.23, .28, .22], [0, -.28, -.38], detail, [-.12, 0, 0]);
        addBox('magazine-middle', [.22, .27, .2], [0, -.49, -.32], detail, [-.3, 0, 0]);
        addBox('magazine-lower', [.2, .23, .18], [0, -.66, -.2], detail, [-.5, 0, 0]);
        addCylinder('gas-tube', [.027, .027], .56, [0, .21, -1.0], detail);
        addBox('gas-block', [.16, .2, .13], [0, .14, -1.23], metal);
        addBox('charging-handle', [.1, .055, .2], [.18, .14, -.35], detail);
        addCylinder('ak-muzzle-brake', [.055, .048], .18, [0, .055, -1.52], metal);
      } else if (definition.id === 'm4a1') {
        addCylinder('m4-buffer-tube', [.045, .045], .5, [0, .06, .28], metal);
        addBox('m4-stock', [.33, .27, .46], [0, -.01, .38], dark, [-.04, 0, 0]);
        addBox('m4-stock-cut', [.2, .12, .28], [0, -.02, .36], metal, [-.04, 0, 0]);
        addBox('m4-buttpad', [.36, .36, .1], [0, -.02, .63], dark);
        addBox('m4-handguard', [.34, .24, .58], [0, -.01, -.88], dark);
        for (const z of [-.65, -.76, -.87, -.98, -1.09]) addBox('m4-handguard-rib', [.36, .035, .045], [0, .12, z], metal);
        addBox('m4-magazine', [.22, .5, .24], [0, -.4, -.36], metal, [.05, 0, 0]);
        addBox('m4-carry-handle', [.18, .14, .46], [0, .3, -.34], dark);
        addBox('m4-carry-support-rear', [.19, .16, .08], [0, .23, -.16], dark);
        addBox('m4-carry-support-front', [.19, .16, .08], [0, .23, -.52], dark);
        addBox('m4-front-sight-base', [.18, .22, .12], [0, .17, -1.2], dark);
        addBox('m4-front-sight-post', [.045, .13, .045], [0, .34, -1.2], metal);
        addCylinder('m4-muzzle-brake', [.053, .045], .17, [0, .055, -1.52], metal);
      } else if (definition.id === 'galil') {
        addBox('galil-stock',[.34,.3,.62],[0,-.01,.38],wood,[-.08,0,0],.075);
        addBox('galil-buttpad',[.37,.34,.1],[0,-.03,.69],detail,[-.08,0,0],.04);
        addBox('galil-handguard',[.34,.23,.55],[0,-.01,-.9],wood,[.02,0,0],.07);
        addBox('galil-carry-handle',[.13,.15,.4],[0,.31,-.43],detail,[0,0,0],.035);
        addBox('galil-magazine',[.22,.5,.24],[0,-.4,-.34],detail,[-.17,0,0],.045);
        addCylinder('galil-gas-tube',[.03,.03],.62,[0,.2,-1.02],detail);
      } else if (definition.id === 'famas') {
        addBox('famas-bullpup-stock',[.42,.43,.72],[0,-.03,.18],dark,[-.04,0,0],.11);
        addBox('famas-cheek-rest',[.34,.13,.58],[0,.22,.1],metal,[0,0,0],.055);
        addBox('famas-handguard',[.34,.28,.62],[0,.01,-.89],dark,[0,0,0],.085);
        addBox('famas-carry-handle',[.16,.18,.72],[0,.34,-.46],detail,[0,0,0],.045);
        addBox('famas-rear-magazine',[.2,.43,.22],[0,-.35,.13],metal,[.08,0,0],.04);
        for(const z of [-.74,-.9,-1.06])addCylinder('famas-handguard-vent',[.027,.027],.36,[0,.13,z],detail,[0,0,Math.PI/2],10);
      } else if (definition.id === 'aug') {
        addBox('aug-bullpup-body',[.44,.46,.78],[0,-.03,.08],dark,[-.025,0,0],.13);
        addBox('aug-cheek-rest',[.37,.14,.6],[0,.24,.08],metal,[0,0,0],.06);
        addBox('aug-rear-magazine',[.2,.46,.24],[0,-.36,.17],glass,[.1,0,0],.045);
        addBox('aug-handguard',[.31,.24,.55],[0,.02,-.86],metal,[0,0,0],.08);
        addCylinder('aug-foregrip',[.045,.055],.34,[0,-.3,-.91],dark,[0,0,0],16);
        addBox('aug-trigger-frame',[.26,.25,.3],[0,-.22,-.36],dark,[0,0,0],.09);
      } else if (definition.id === 'sg552') {
        addBox('sg552-stock',[.32,.31,.58],[0,-.02,.36],dark,[-.07,0,0],.08);
        addBox('sg552-handguard',[.37,.25,.58],[0,-.01,-.88],dark,[0,0,0],.075);
        for(const z of [-.72,-.88,-1.04])addBox('sg552-handguard-slot',[.39,.035,.07],[0,.13,z],metal,[0,0,0],.012);
        addBox('sg552-magazine-upper',[.23,.3,.22],[0,-.29,-.35],detail,[-.12,0,0],.04);
        addBox('sg552-magazine-lower',[.21,.28,.2],[0,-.52,-.26],detail,[-.34,0,0],.04);
        addCylinder('sg552-gas-system',[.032,.032],.57,[0,.2,-.98],detail);
      } else if (definition.id === 'scout' || definition.id === 'awp') {
        const awp=definition.id==='awp';
        addBox(`${definition.id}-stock`,[awp ? .43 : .34,awp ? .37 : .29,awp ? .78 : .7],[0,-.01,awp?.45:.42],awp?metal:wood,[-.07,0,0],.11);
        addBox(`${definition.id}-cheek-rest`,[awp?.34:.3,.12,awp?.48:.42],[0,.23,.37],awp?awpMint:dark,[0,0,0],.055);
        addBox(`${definition.id}-handguard`,[awp ? .39 : .3,awp ? .27 : .2,awp ? .78 : .68],[0,.01,awp?-1.03:-1.0],awp?awpMint:wood,[0,0,0],.08);
        addBox(`${definition.id}-magazine`,[awp ? .24 : .19,awp ? .38 : .3,.24],[0,-.32,-.35],detail,[-.08,0,0],.05);
        addCylinder(`${definition.id}-bolt`,[.025,.025],.2,[.2,.16,-.25],metal,[0,0,Math.PI/2],12);
        const boltKnob=new THREE.Mesh(new THREE.SphereGeometry(awp?.065:.055,12,8),awp?awpOrange:detail);boltKnob.name=`${definition.id}-bolt-knob`;boltKnob.position.set(.3,.16,-.25);this.group.add(boltKnob);
        if(awp){
          addBox('awp-buttpad',[.45,.4,.105],[0,-.035,.86],detail,[-.07,0,0],.04);
          addBox('awp-stock-accent',[.445,.075,.38],[0,.12,.55],awpOrange,[-.07,0,0],.025);
          addBox('awp-receiver-spine',[.31,.075,.72],[0,.225,-.45],awpMint,[0,0,0],.025);
          addBox('awp-fore-end-accent',[.395,.055,.38],[0,.15,-1.13],awpOrange,[0,0,0],.018);
          addCylinder('awp-heavy-barrel',[.058,.07],.92,[0,.055,-1.67],awpScope,[Math.PI/2,0,0],24);
          addCylinder('awp-muzzle-ring',[.077,.077],.075,[0,.055,-2.14],awpOrange,[Math.PI/2,0,0],24);
          addCylinder('awp-muzzle-brake',[.065,.052],.18,[0,.055,-2.25],detail,[Math.PI/2,0,0],24);
          for(const side of [-1,1]){
            const texture=createAwpDecalTexture();const decalMaterial=new THREE.MeshBasicMaterial({color:texture?0xffffff:0xf06a1b,map:texture,transparent:Boolean(texture),side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
            const decal=new THREE.Mesh(new THREE.PlaneGeometry(.78,.22),decalMaterial);decal.name=`awp-skin-decal-${side>0?'right':'left'}`;decal.rotation.y=side>0?Math.PI/2:-Math.PI/2;decal.position.set(side*.157,.025,-.45);this.group.add(decal);
          }
          for(const side of [-1,1]){addBox(`awp-orange-slash-${side}`,[.018,.055,.34],[side*.198,.09,-.94],awpRed,[.55,0,0],.008);addCylinder(`awp-emblem-${side}`,[.055,.055],.014,[side*.201,.055,-.25],awpOrange,[0,0,Math.PI/2],18);}
        }
      } else if (definition.id === 'g3sg1' || definition.id === 'sg550') {
        const g3=definition.id==='g3sg1';
        addBox(`${definition.id}-marksman-stock`,[.36,.34,.68],[0,-.01,.42],g3?wood:dark,[-.065,0,0],.09);
        addBox(`${definition.id}-handguard`,[.36,.24,.67],[0,.01,-1.0],g3?wood:dark,[0,0,0],.075);
        addBox(`${definition.id}-magazine`,[.23,g3 ? .42 : .5,.25],[0,g3 ? -.36 : -.4,-.35],detail,[-.12,0,0],.05);
        addCylinder(`${definition.id}-bipod-left`,[.018,.024],.55,[-.14,-.24,-1.16],detail,[0,0,-.35],10);
        addCylinder(`${definition.id}-bipod-right`,[.018,.024],.55,[.14,-.24,-1.16],detail,[0,0,.35],10);
        addBox(`${definition.id}-cheek-rest`,[.3,.12,.38],[0,.23,.38],dark,[0,0,0],.05);
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
        const scopeLength=definition.id==='awp'?.72:['scout','g3sg1','sg550'].includes(definition.id)?.55:.43;const scopeMaterial=definition.id==='awp'?awpScope:detail;const lensMaterial=definition.id==='awp'?awpGlass:glass;
        addCylinder('scope', [definition.id==='awp'?.1:.087, definition.id==='awp'?.108:.095], scopeLength, [0, definition.id==='awp'?.36:.33, -bodyLength * .45], scopeMaterial, [Math.PI / 2, 0, 0], 24);
        addCylinder('scope-front', [definition.id==='awp'?.15:.125, definition.id==='awp'?.12:.105], definition.id==='awp'?.19:.14, [0, definition.id==='awp'?.36:.33, -bodyLength * .45-scopeLength*.43], scopeMaterial, [Math.PI / 2, 0, 0], 24);
        addCylinder('scope-rear', [definition.id==='awp'?.13:.115, definition.id==='awp'?.11:.1], definition.id==='awp'?.15:.12, [0, definition.id==='awp'?.36:.33, -bodyLength * .45+scopeLength*.45], scopeMaterial, [Math.PI / 2, 0, 0], 24);
        addCylinder('scope-lens', [definition.id==='awp'?.122:.096, definition.id==='awp'?.122:.096], .012, [0, definition.id==='awp'?.36:.33, -bodyLength * .45-scopeLength*.55], lensMaterial, [Math.PI / 2, 0, 0], 24);
        addBox('scope-mount-front', [.12, .15, .09], [0, .225, -bodyLength * .62], dark,[0,0,0],.025);
        addBox('scope-mount-rear', [.12, .15, .09], [0, .225, -bodyLength * .28], dark,[0,0,0],.025);
        if(definition.id==='awp'){addCylinder('awp-scope-orange-ring-front',[.123,.123],.04,[0,.36,-bodyLength*.45-scopeLength*.25],awpOrange,[Math.PI/2,0,0],24);addCylinder('awp-scope-orange-ring-rear',[.116,.116],.035,[0,.36,-bodyLength*.45+scopeLength*.31],awpRed,[Math.PI/2,0,0],24);}
      } else {
        addBox('rear-sight', [.11, .08, .08], [0, .26, -.18], detail);
        addBox('front-sight', [.07, .11, .07], [0, .22, -bodyLength - barrelLength * .7], detail);
      }
    }

    const muzzle = new THREE.PointLight(0xffc16b, 0, 3);
    muzzle.position.set(0, .04, referenceAwp?-2.36:-bodyLength-barrelLength);
    muzzle.name = 'muzzle';
    this.group.add(muzzle);

    const baseRotation = new THREE.Euler(referenceAwp?-.065:-.09, referenceAwp?.055:.04, referenceAwp?.035:.025, 'YXZ');
    this.group.userData.baseRotation = baseRotation;
    this.group.rotation.copy(baseRotation);
    this.group.position.set(referenceAwp?.38:.36, referenceAwp?-.3:-.32, referenceAwp?-.58:-.68);
    this.group.scale.setScalar(referenceAwp?.79:long ? .72 : pistol ? .86 : .78);
  }

  buildKnife(knife) {
    const style = this.skinManager.knifeStyle();
    const bladeMaterial = createKnifeBladeMaterial(style);
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
      pivot.position.z = .95;
      this.group.add(pivot);

      const model = new THREE.Group();
      model.name = 'karambit-model';
      model.position.z = -.95;
      pivot.add(model);

      const bladeShape = new THREE.Shape();
      bladeShape.moveTo(-.2, .04);
      bladeShape.bezierCurveTo(-.7, -.25, -.9, -.92, -.56, -1.36);
      bladeShape.bezierCurveTo(-.36, -1.64, .07, -1.8, .55, -1.7);
      bladeShape.bezierCurveTo(.43, -1.53, .22, -1.28, -.08, -1.03);
      bladeShape.bezierCurveTo(.24, -.77, .31, -.42, .18, -.14);
      bladeShape.lineTo(.14, .04);
      bladeShape.closePath();
      const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(bladeShape, { depth: .07, curveSegments: 10, bevelEnabled: true, bevelThickness: .018, bevelSize: .014, bevelSegments: 2 }), bladeMaterial);
      blade.name = 'karambit-blade';
      blade.rotation.x = Math.PI / 2;
      blade.position.set(0, .035, -.04);
      model.add(blade);

      const edgeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(.15, .075, -.14), new THREE.Vector3(.25, .075, -.43),
        new THREE.Vector3(.15, .075, -.76), new THREE.Vector3(-.08, .075, -1.03),
        new THREE.Vector3(.21, .075, -1.3), new THREE.Vector3(.43, .075, -1.53),
        new THREE.Vector3(.54, .075, -1.69)
      ]);
      const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xd5e1e4, metalness: .96, roughness: .12, flatShading: true });
      const edge = new THREE.Mesh(new THREE.TubeGeometry(edgeCurve, 28, .016, 5, false), edgeMaterial);
      edge.name = 'karambit-edge';
      model.add(edge);

      const handleShape = new THREE.Shape();
      handleShape.moveTo(-.17, -.02);
      handleShape.quadraticCurveTo(-.25, .18, -.2, .35);
      handleShape.quadraticCurveTo(-.27, .6, -.15, .9);
      handleShape.lineTo(.15, .9);
      handleShape.quadraticCurveTo(.27, .69, .19, .48);
      handleShape.quadraticCurveTo(.27, .24, .16, -.02);
      handleShape.closePath();
      const handle = new THREE.Mesh(new THREE.ExtrudeGeometry(handleShape, { depth: .16, curveSegments: 7, bevelEnabled: true, bevelThickness: .018, bevelSize: .014, bevelSegments: 1 }), gripMaterial);
      handle.name = 'karambit-handle';
      handle.rotation.x = Math.PI / 2;
      handle.position.y = .08;
      model.add(handle);

      const inlayMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(style.handle).multiplyScalar(.5), metalness: .12, roughness: .82, flatShading: true });
      for (const y of [-.092, .092]) {
        const inlay = new THREE.Mesh(new THREE.BoxGeometry(.22, .018, .55), inlayMaterial);
        inlay.name = 'karambit-grip-inlay';
        inlay.position.set(0, y, .48);
        inlay.rotation.x = -.04;
        model.add(inlay);
      }

      for (const z of [.2, .5, .75]) {
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(.031, .031, .205, 10), pinMaterial);
        pin.name = 'karambit-handle-pin';
        pin.position.z = z;
        model.add(pin);
      }

      const ring = new THREE.Mesh(new THREE.TorusGeometry(.205, .052, 9, 26), gripMaterial);
      ring.name = 'karambit-ring';
      ring.rotation.x = Math.PI / 2;
      pivot.add(ring);

      const ringLiner = new THREE.Mesh(new THREE.TorusGeometry(.145, .018, 6, 24), pinMaterial);
      ringLiner.name = 'karambit-ring-liner';
      ringLiner.rotation.x = Math.PI / 2;
      pivot.add(ringLiner);

      const guard = new THREE.Mesh(new THREE.BoxGeometry(.48, .13, .12), pinMaterial);
      guard.name = 'karambit-guard';
      guard.position.z = .04;
      model.add(guard);
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
      ? new THREE.Euler(.9, .2, -.12, 'YXZ')
      : new THREE.Euler(1.02, .2, -.1, 'YXZ');
    this.group.userData.baseRotation = baseRotation;
    this.group.rotation.copy(baseRotation);
    this.group.position.set(.4, knife.variant === 'karambit' ? -.39 : -.4, knife.variant === 'karambit' ? -1.28 : -1);
    this.group.scale.setScalar(knife.variant === 'karambit' ? .56 : .68);
  }

  dispatch(type) {
    this.dispatchEvent(new CustomEvent(type, { detail: { weapon: this.player.inventory.active } }));
  }
}
