import * as THREE from 'three';
import { KNIFE_SKINS } from './KnifeSkinDefinitions.js';
import { animateKnifeWaves, createKnifeBladeMaterial, disposeKnifeMaterial } from './KnifeMaterial.js';

export class SkinPreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, .1, 30);
    this.camera.position.set(0, 1.1, 6);
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.scene.add(new THREE.HemisphereLight(0xf7e4bd, 0x26312b, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    this.type = 'butterfly';
    this.skin = 'classic';
    this.inspectLeft = 0;
    this.lastFrame = performance.now();
    this.running = true;
    this.rebuild();
    this.animate(this.lastFrame);
  }

  resize() {
    const width = this.canvas.clientWidth || 480;
    const height = this.canvas.clientHeight || 400;
    if (this.canvas.width !== width * devicePixelRatio || this.canvas.height !== height * devicePixelRatio) {
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
  }

  set(type, skin) {
    this.type = type;
    this.skin = skin;
    this.inspectLeft = 0;
    this.rebuild();
  }

  clearModel() {
    for (const child of [...this.group.children]) {
      child.traverse((object) => {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) object.material.forEach(disposeKnifeMaterial);
        else disposeKnifeMaterial(object.material);
      });
      this.group.remove(child);
    }
  }

  rebuild() {
    this.clearModel();
    const style = KNIFE_SKINS[this.skin] || KNIFE_SKINS.classic;
    const bladeMaterial = createKnifeBladeMaterial(style);
    const gripMaterial = new THREE.MeshStandardMaterial({ color: style.handle, metalness: .28, roughness: .64, flatShading: true });
    const detailMaterial = new THREE.MeshStandardMaterial({ color: 0xb3a371, metalness: .82, roughness: .24, flatShading: true });

    if (this.type === 'karambit') {
      const bladeShape = new THREE.Shape();
      bladeShape.moveTo(-.12, -.02);
      bladeShape.bezierCurveTo(.15, -.85, 1.1, -1.32, 1.95, -1.05);
      bladeShape.bezierCurveTo(2.3, -.95, 2.6, -.65, 2.75, -.28);
      bladeShape.bezierCurveTo(2.4, -.42, 2.05, -.43, 1.73, -.18);
      bladeShape.bezierCurveTo(1.26, .22, .78, .55, .15, .56);
      bladeShape.lineTo(-.1, .36);
      bladeShape.closePath();
      const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(bladeShape, { depth: .1, curveSegments: 12, bevelEnabled: true, bevelThickness: .03, bevelSize: .022, bevelSegments: 2 }), bladeMaterial);
      blade.name = 'karambit-preview-blade';
      this.group.add(blade);

      const edgeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-.07, .38, .145), new THREE.Vector3(.4, .52, .145),
        new THREE.Vector3(.84, .46, .145), new THREE.Vector3(1.3, .16, .145),
        new THREE.Vector3(1.73, -.18, .145), new THREE.Vector3(2.18, -.4, .145),
        new THREE.Vector3(2.7, -.29, .145)
      ]);
      const edge = new THREE.Mesh(new THREE.TubeGeometry(edgeCurve, 28, .025, 6, false), new THREE.MeshStandardMaterial({ color: 0xd8e5e9, metalness: .96, roughness: .12 }));
      edge.name = 'karambit-preview-edge';
      this.group.add(edge);

      const handleShape = new THREE.Shape();
      handleShape.moveTo(-.08, -.08);
      handleShape.quadraticCurveTo(-.76, -.28, -1.5, -.1);
      handleShape.quadraticCurveTo(-1.66, .13, -1.48, .42);
      handleShape.quadraticCurveTo(-.75, .62, -.1, .42);
      handleShape.lineTo(.04, .25);
      handleShape.lineTo(.02, .05);
      handleShape.closePath();
      const handle = new THREE.Mesh(new THREE.ExtrudeGeometry(handleShape, { depth: .24, curveSegments: 8, bevelEnabled: true, bevelThickness: .028, bevelSize: .022, bevelSegments: 2 }), gripMaterial);
      handle.name = 'karambit-preview-handle';
      handle.position.z = -.07;
      this.group.add(handle);

      const inlay = new THREE.Mesh(new THREE.BoxGeometry(1.05, .16, .12), new THREE.MeshStandardMaterial({ color: new THREE.Color(style.handle).multiplyScalar(.5), metalness: .1, roughness: .85, flatShading: true }));
      inlay.position.set(-.78, .17, .18);
      inlay.rotation.z = -.02;
      this.group.add(inlay);

      for (const x of [-.38, -.8, -1.2]) {
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .3, 10), detailMaterial);
        pin.rotation.x = Math.PI / 2;
        pin.position.set(x, .17, .05);
        this.group.add(pin);
      }

      const ring = new THREE.Mesh(new THREE.TorusGeometry(.31, .09, 9, 28), gripMaterial);
      ring.position.set(-1.72, .15, .05);
      ring.name = 'karambit-preview-ring';
      this.group.add(ring);
      const ringLiner = new THREE.Mesh(new THREE.TorusGeometry(.215, .025, 7, 24), detailMaterial);
      ringLiner.position.copy(ring.position);
      this.group.add(ringLiner);

      const guard = new THREE.Mesh(new THREE.BoxGeometry(.17, .58, .2), detailMaterial);
      guard.position.set(-.02, .17, .03);
      guard.rotation.z = -.12;
      this.group.add(guard);
    } else {
      const bladeShape = new THREE.Shape();
      bladeShape.moveTo(-.18, -.15);
      bladeShape.lineTo(2.25, -.04);
      bladeShape.lineTo(2.65, .16);
      bladeShape.lineTo(.15, .48);
      bladeShape.closePath();
      const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(bladeShape, { depth: .08, bevelEnabled: true, bevelThickness: .035, bevelSize: .025, bevelSegments: 1 }), bladeMaterial);
      blade.position.x = -.1;
      this.group.add(blade);
      if (this.type === 'butterfly') {
        for (const y of [-.3, .43]) {
          const handle = new THREE.Mesh(new THREE.BoxGeometry(1.75, .22, .22), gripMaterial);
          handle.position.set(-1, y, .04);
          handle.rotation.z = y < 0 ? -.18 : .18;
          this.group.add(handle);
        }
        const pivot = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .26, 8), bladeMaterial);
        pivot.rotation.x = Math.PI / 2;
        pivot.position.x = -.05;
        this.group.add(pivot);
      } else {
        const handle = new THREE.Mesh(new THREE.BoxGeometry(1.65, .62, .28), gripMaterial);
        handle.position.x = -.92;
        this.group.add(handle);
      }
    }
    this.group.rotation.set(this.type === 'karambit' ? .18 : .25, this.type === 'karambit' ? -.34 : -.45, this.type === 'karambit' ? -.06 : -.12);
  }

  inspect() { this.inspectLeft = this.type === 'karambit' ? 2.2 : 1.5; }

  animate(now) {
    if (!this.running) return;
    requestAnimationFrame((time) => this.animate(time));
    const dt = Math.min(.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.resize();
    animateKnifeWaves(this.group, now / 1000);

    if (this.inspectLeft > 0) {
      const duration = this.type === 'karambit' ? 2.2 : 1.5;
      const progress = 1 - this.inspectLeft / duration;
      if (this.type === 'karambit') {
        const flourish = Math.sin(progress * Math.PI);
        this.group.rotation.x = .18 + Math.sin(progress * Math.PI * 4) * .42 * flourish;
        this.group.rotation.y = -.34 + progress * Math.PI * 4;
        this.group.rotation.z = -.06 + Math.sin(progress * Math.PI * 2) * 1.15 * flourish;
      } else {
        this.group.rotation.y = -.45 + progress * Math.PI * 2;
        this.group.rotation.z = -.12 + Math.sin(progress * Math.PI) * .35;
      }
      this.inspectLeft = Math.max(0, this.inspectLeft - dt);
    } else {
      const idleX = this.type === 'karambit' ? .18 : .25;
      const idleZ = this.type === 'karambit' ? -.06 : -.12;
      this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, idleX, Math.min(1, dt * 5));
      this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, idleZ, Math.min(1, dt * 5));
      this.group.rotation.y += dt * .38;
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.running = false;
    this.clearModel();
    this.renderer.dispose();
  }
}
