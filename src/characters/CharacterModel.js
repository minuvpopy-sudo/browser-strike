import * as THREE from 'three';

const TEAM_PALETTES = Object.freeze({
  attackers: Object.freeze([
    Object.freeze({ uniform: 0x861d24, dark: 0x4b171b, vest: 0x342d25, pants: 0x551b20, accent: 0xd8c58d, skin: 0xb88766, headgear: 'hair' }),
    Object.freeze({ uniform: 0x826442, dark: 0x43382a, vest: 0x403b2d, pants: 0x484332, accent: 0xc6a969, skin: 0xa87556, headgear: 'scarf' }),
    Object.freeze({ uniform: 0x566047, dark: 0x30362a, vest: 0x353a2e, pants: 0x3e4436, accent: 0xa8ad7e, skin: 0xbd8d69, headgear: 'mask' })
  ]),
  defenders: Object.freeze([
    Object.freeze({ uniform: 0x244f72, dark: 0x172f47, vest: 0x182632, pants: 0x1c344b, accent: 0x82a8bd, skin: 0xb7896d, headgear: 'helmet' }),
    Object.freeze({ uniform: 0x394b59, dark: 0x202c35, vest: 0x172127, pants: 0x293945, accent: 0x91a5ad, skin: 0xa87c63, headgear: 'gas-mask' }),
    Object.freeze({ uniform: 0x253b43, dark: 0x17252b, vest: 0x202d31, pants: 0x1f3138, accent: 0x799c90, skin: 0xc29372, headgear: 'visor' })
  ])
});

const standardMaterial = (color, options = {}) => new THREE.MeshStandardMaterial({
  color,
  roughness: .82,
  flatShading: true,
  ...options
});

function part(parent, entity, name, geometry, partMaterial, position, zone, rotation = null) {
  const mesh = new THREE.Mesh(geometry, partMaterial);
  mesh.name = name;
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.userData = { entity, zone, operativePart: true };
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function pivot(parent, name, position) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(...position);
  parent.add(group);
  return group;
}

function limb(parent, entity, name, start, end, radius, partMaterial, zone) {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const direction = to.clone().sub(from);
  const mesh = part(
    parent,
    entity,
    name,
    new THREE.CylinderGeometry(radius * .82, radius, direction.length(), 8, 1),
    partMaterial,
    from.clone().add(to).multiplyScalar(.5).toArray(),
    zone
  );
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function entityVariant(entity, count) {
  if (Number.isFinite(entity?.index)) return Math.abs(entity.index) % count;
  const text = String(entity?.name || 'operative');
  let hash = 0;
  for (let index = 0; index < text.length; index++) hash = (hash * 31 + text.charCodeAt(index)) | 0;
  return Math.abs(hash) % count;
}

function addChestEmblem(root, entity, attacker, materials) {
  const color = attacker ? 0x39a9c7 : 0xcfe174;
  const disc = part(root, entity, 'chest-emblem', new THREE.CircleGeometry(.1, 12), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }), [0, 1.24, .329], 'chest');
  const slash = part(root, entity, 'chest-emblem-slash', new THREE.PlaneGeometry(.038, .16), materials.emblem, [0, 1.24, .334], 'chest', [0, 0, -.55]);
  slash.position.z = disc.position.z + .005;
}

function addHeadgear(root, entity, palette, materials) {
  if (palette.headgear === 'hair') {
    const hair = part(root, entity, 'attacker-hair', new THREE.SphereGeometry(.238, 10, 7, 0, Math.PI * 2, 0, Math.PI * .56), materials.hair, [0, 1.91, -.01], 'head');
    hair.scale.z = .9;
    for (const x of [-.09, .09]) part(root, entity, `sunglasses-${x < 0 ? 'left' : 'right'}`, new THREE.BoxGeometry(.14, .065, .025), materials.glass, [x, 1.78, .211], 'head', [0, x < 0 ? .05 : -.05, 0]);
    part(root, entity, 'sunglasses-bridge', new THREE.BoxGeometry(.052, .016, .025), materials.glass, [0, 1.78, .214], 'head');
    part(root, entity, 'attacker-beard', new THREE.BoxGeometry(.19, .08, .025), materials.hair, [0, 1.65, .198], 'head');
    return;
  }

  if (palette.headgear === 'scarf') {
    const scarf = part(root, entity, 'attacker-scarf', new THREE.CylinderGeometry(.225, .205, .18, 10), materials.accent, [0, 1.65, .01], 'head');
    scarf.scale.z = .92;
    part(root, entity, 'attacker-headband', new THREE.BoxGeometry(.43, .09, .08), materials.accent, [0, 1.85, -.04], 'head');
    part(root, entity, 'attacker-scarf-tail', new THREE.BoxGeometry(.12, .34, .055), materials.accent, [.18, 1.58, -.13], 'head', [0, 0, -.18]);
    return;
  }

  if (palette.headgear === 'mask') {
    const mask = part(root, entity, 'attacker-mask', new THREE.SphereGeometry(.238, 10, 8), materials.darkCloth, [0, 1.76, 0], 'head');
    mask.scale.set(.92, 1.08, .9);
    part(root, entity, 'attacker-mask-opening', new THREE.BoxGeometry(.29, .082, .022), materials.skin, [0, 1.79, .215], 'head');
    return;
  }

  const helmet = part(root, entity, 'defender-helmet', new THREE.SphereGeometry(.254, 11, 7, 0, Math.PI * 2, 0, Math.PI * .64), materials.helmet, [0, 1.89, -.015], 'head');
  helmet.scale.z = .95;
  part(root, entity, 'defender-helmet-rim', new THREE.BoxGeometry(.48, .055, .3), materials.helmet, [0, 1.81, -.025], 'head');
  for (const x of [-.245, .245]) part(root, entity, `defender-ear-${x < 0 ? 'left' : 'right'}`, new THREE.CylinderGeometry(.072, .072, .045, 8), materials.helmet, [x, 1.77, 0], 'head', [0, 0, Math.PI / 2]);

  if (palette.headgear === 'gas-mask') {
    part(root, entity, 'defender-gas-mask', new THREE.BoxGeometry(.31, .25, .13), materials.darkCloth, [0, 1.68, .19], 'head');
    for (const x of [-.09, .09]) part(root, entity, `defender-lens-${x < 0 ? 'left' : 'right'}`, new THREE.CylinderGeometry(.058, .058, .018, 10), materials.glass, [x, 1.76, .264], 'head', [Math.PI / 2, 0, 0]);
    part(root, entity, 'defender-filter', new THREE.CylinderGeometry(.065, .075, .09, 9), materials.helmet, [.12, 1.62, .27], 'head', [Math.PI / 2, 0, 0]);
  } else {
    part(root, entity, 'defender-visor', new THREE.BoxGeometry(.3, .08, .035), materials.glass, [0, 1.77, .218], 'head');
    if (palette.headgear === 'visor') part(root, entity, 'defender-face-guard', new THREE.BoxGeometry(.28, .17, .045), materials.darkCloth, [0, 1.65, .204], 'head');
  }
}

function createLeg(root, entity, side, x, materials) {
  const legPivot = pivot(root, `leg-pivot-${side}`, [x, .67, 0]);
  legPivot.userData.baseRotationX = 0;
  const leg = part(legPivot, entity, `leg-${side}`, new THREE.CapsuleGeometry(.115, .37, 5, 8), materials.pants, [0, -.2, 0], 'legs');
  part(legPivot, entity, `knee-${side}`, new THREE.BoxGeometry(.19, .17, .09), materials.pad, [0, -.31, .105], 'legs');
  const boot = part(legPivot, entity, `boot-${side}`, new THREE.CapsuleGeometry(.105, .15, 4, 8), materials.boots, [0, -.57, .075], 'legs', [Math.PI / 2, 0, 0]);
  boot.scale.z = 1.2;
  return { pivot: legPivot, leg };
}

function createArm(root, entity, side, materials) {
  const sign = side === 'left' ? -1 : 1;
  const shoulder = [sign * .34, 1.37, 0];
  const elbow = [sign * .3, 1.13, .17];
  const hand = side === 'left' ? [-.13, 1.12, .39] : [.19, 1.1, .42];
  const armPivot = pivot(root, `arm-pivot-${side}`, shoulder);
  armPivot.userData.baseRotationX = 0;
  limb(armPivot, entity, `upper-arm-${side}`, [0, 0, 0], [elbow[0] - shoulder[0], elbow[1] - shoulder[1], elbow[2] - shoulder[2]], .108, materials.uniform, 'arms');
  limb(armPivot, entity, `forearm-${side}`, [elbow[0] - shoulder[0], elbow[1] - shoulder[1], elbow[2] - shoulder[2]], [hand[0] - shoulder[0], hand[1] - shoulder[1], hand[2] - shoulder[2]], .085, materials.dark, 'arms');
  part(armPivot, entity, `elbow-pad-${side}`, new THREE.SphereGeometry(.105, 8, 6), materials.pad, [elbow[0] - shoulder[0], elbow[1] - shoulder[1], elbow[2] - shoulder[2]], 'arms');
  part(armPivot, entity, `hand-${side}`, new THREE.SphereGeometry(.09, 9, 6), materials.glove, [hand[0] - shoulder[0], hand[1] - shoulder[1], hand[2] - shoulder[2]], 'arms');
  part(root, entity, `shoulder-pad-${side}`, new THREE.SphereGeometry(.145, 8, 6), materials.vest, [sign * .335, 1.38, 0], 'arms');
  return armPivot;
}

export function createCharacterModel(entity, team, { name = 'character', variant = null } = {}) {
  const attacker = team === 'attackers';
  const palettes = TEAM_PALETTES[attacker ? 'attackers' : 'defenders'];
  const variantIndex = variant == null ? entityVariant(entity, palettes.length) : Math.abs(variant) % palettes.length;
  const palette = palettes[variantIndex];
  const group = new THREE.Group();
  group.name = name;
  group.userData.operativeTeam = team;
  group.userData.operativeVariant = variantIndex;

  const root = pivot(group, 'operative-rig', [0, 0, 0]);
  const materials = {
    uniform: standardMaterial(palette.uniform),
    dark: standardMaterial(palette.dark, { roughness: .9 }),
    vest: standardMaterial(palette.vest, { roughness: .88 }),
    pants: standardMaterial(palette.pants, { roughness: .9 }),
    accent: standardMaterial(palette.accent, { roughness: .78 }),
    skin: standardMaterial(palette.skin, { roughness: .95 }),
    boots: standardMaterial(0x141716, { roughness: .92 }),
    glove: standardMaterial(0x252825, { roughness: .86 }),
    pad: standardMaterial(0x202420, { roughness: .8 }),
    helmet: standardMaterial(attacker ? 0x24231d : 0x1a252a, { metalness: .12, roughness: .7 }),
    hair: standardMaterial(0x171512, { roughness: .95 }),
    glass: standardMaterial(0x101719, { metalness: .48, roughness: .16 }),
    darkCloth: standardMaterial(0x20231f, { roughness: .96 }),
    emblem: new THREE.MeshBasicMaterial({ color: 0xf3f1df, side: THREE.DoubleSide })
  };

  const body = part(root, entity, 'body', new THREE.CapsuleGeometry(.31, .45, 6, 10), materials.uniform, [0, 1.1, 0], 'chest');
  part(root, entity, 'tactical-vest', new THREE.BoxGeometry(.57, .5, .17), materials.vest, [0, 1.17, .225], 'chest');
  part(root, entity, 'backpack', new THREE.BoxGeometry(.48, .48, .18), materials.vest, [0, 1.17, -.255], 'chest');
  part(root, entity, 'waist', new THREE.CylinderGeometry(.27, .29, .18, 10), materials.dark, [0, .68, 0], 'stomach');
  part(root, entity, 'belt', new THREE.CylinderGeometry(.297, .297, .075, 12), materials.boots, [0, .75, 0], 'stomach');
  for (const x of [-.19, 0, .19]) part(root, entity, `vest-pouch-${x}`, new THREE.BoxGeometry(.145, .18, .09), materials.accent, [x, .93, .337], 'stomach');
  part(root, entity, 'holster', new THREE.BoxGeometry(.13, .28, .1), materials.pad, [.31, .56, .05], 'legs', [0, 0, -.08]);

  part(root, entity, 'neck', new THREE.CylinderGeometry(.105, .12, .16, 9), materials.skin, [0, 1.52, 0], 'head');
  const head = part(root, entity, 'head', new THREE.SphereGeometry(.23, 11, 8), materials.skin, [0, 1.72, 0], 'head');
  head.scale.set(.9, 1.08, .88);
  part(root, entity, 'nose', new THREE.BoxGeometry(.055, .085, .06), materials.skin, [0, 1.73, .218], 'head');
  addHeadgear(root, entity, palette, materials);

  const leftLeg = createLeg(root, entity, 'left', -.17, materials);
  const rightLeg = createLeg(root, entity, 'right', .17, materials);
  const leftArm = createArm(root, entity, 'left', materials);
  const rightArm = createArm(root, entity, 'right', materials);
  addChestEmblem(root, entity, attacker, materials);

  if (!attacker) {
    part(root, entity, 'radio', new THREE.BoxGeometry(.13, .27, .09), materials.helmet, [-.25, 1.2, -.31], 'chest');
    part(root, entity, 'radio-antenna', new THREE.CylinderGeometry(.009, .012, .35, 6), materials.helmet, [-.25, 1.48, -.31], 'chest', [0, 0, -.12]);
  }

  const weapon = pivot(root, 'weapon', [.22, 1.17, .27]);
  weapon.userData = { entity, zone: 'arms', operativePart: true };
  part(weapon, entity, 'weapon-receiver', new THREE.CapsuleGeometry(.07, .34, 4, 8), materials.boots, [0, 0, .05], 'arms', [Math.PI / 2, 0, 0]);
  part(weapon, entity, 'weapon-stock', new THREE.BoxGeometry(.12, .15, .28), materials.dark, [0, -.02, -.24], 'arms', [-.08, 0, 0]);
  part(weapon, entity, 'weapon-magazine', new THREE.BoxGeometry(.1, .23, .12), materials.dark, [0, -.14, .09], 'arms', [.16, 0, 0]);
  part(weapon, entity, 'weapon-barrel', new THREE.CylinderGeometry(.025, .035, .42, 8), materials.boots, [0, .01, .42], 'arms', [Math.PI / 2, 0, 0]);

  const shotLight = new THREE.PointLight(0xffb04c, 0, 4);
  shotLight.name = 'shot-light';
  shotLight.position.set(.22, 1.18, .75);
  root.add(shotLight);

  group.userData.characterRig = {
    root,
    body,
    head,
    weapon,
    leftLeg: leftLeg.pivot,
    rightLeg: rightLeg.pivot,
    leftArm,
    rightArm,
    weaponRest: weapon.position.clone(),
    bodyRestY: body.position.y,
    headRestY: head.position.y,
    movement: 0,
    crouch: 0,
    crouchTarget: 0
  };
  return group;
}

export function setCharacterCrouched(group, crouched) {
  const rig = group?.userData?.characterRig;
  if (rig) rig.crouchTarget = crouched ? 1 : 0;
}

export function animateCharacterLegs(group, speed, time = performance.now()) {
  const rig = group?.userData?.characterRig;
  if (!rig) return;
  const targetMovement = THREE.MathUtils.clamp(speed / 4.3, 0, 1);
  rig.movement = THREE.MathUtils.lerp(rig.movement, targetMovement, .22);
  rig.crouch = THREE.MathUtils.lerp(rig.crouch, rig.crouchTarget, .2);

  const phase = time * .009;
  const stride = Math.sin(phase) * .64 * rig.movement;
  const bounce = Math.abs(Math.sin(phase)) * .026 * rig.movement;
  const breathing = Math.sin(time * .0025) * .005;
  rig.leftLeg.rotation.x = stride;
  rig.rightLeg.rotation.x = -stride;
  rig.leftArm.rotation.x = -stride * .14;
  rig.rightArm.rotation.x = stride * .11;
  rig.root.position.y = bounce + breathing - rig.crouch * .29;
  rig.root.scale.y = 1 - rig.crouch * .075;
  rig.body.rotation.z = Math.sin(phase * .5) * .018 * rig.movement;
  rig.head.rotation.y = Math.sin(time * .0017) * .025;
  rig.weapon.position.y = rig.weaponRest.y + bounce * .45;
  rig.weapon.position.x = rig.weaponRest.x + Math.sin(phase) * .009 * rig.movement;
  rig.weapon.rotation.z = Math.sin(phase) * .014 * rig.movement;
}
