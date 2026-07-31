import * as THREE from 'three';
import { KNIFE_SKINS } from './KnifeSkinDefinitions.js';

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
        object.material?.dispose();
      });
      this.group.remove(child);
    }
  }

  rebuild() {
    this.clearModel();
    const style = KNIFE_SKINS[this.skin] || KNIFE_SKINS.classic;
    const bladeMaterial = new THREE.MeshStandardMaterial({ color: style.blade, metalness: .82, roughness: .25, flatShading: true });
    const gripMaterial = new THREE.MeshStandardMaterial({ color: style.handle, metalness: .28, roughness: .64, flatShading: true });

    if (this.type === 'karambit') {
      const bladeShape = new THREE.Shape();
      bladeShape.moveTo(-.05, -.12);
      bladeShape.quadraticCurveTo(1.15, -.62, 2.25, .2);
      bladeShape.quadraticCurveTo(1.55, .08, .72, .48);
      bladeShape.lineTo(.02, .42);
      bladeShape.closePath();
      const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(bladeShape, { depth: .09, bevelEnabled: true, bevelThickness: .035, bevelSize: .025, bevelSegments: 1 }), bladeMaterial);
      this.group.add(blade);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(1.55, .5, .28, 1, 1, 1), gripMaterial);
      handle.position.set(-.8, .17, .04);
      handle.rotation.z = -.08;
      this.group.add(handle);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.28, .085, 7, 18), gripMaterial);
      ring.position.set(-1.7, .2, .04);
      ring.name = 'karambit-preview-ring';
      this.group.add(ring);
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
    this.group.rotation.set(.25, -.45, -.12);
  }

  inspect() { this.inspectLeft = this.type === 'karambit' ? 2.2 : 1.5; }

  animate(now) {
    if (!this.running) return;
    requestAnimationFrame((time) => this.animate(time));
    const dt = Math.min(.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.resize();

    if (this.inspectLeft > 0) {
      const duration = this.type === 'karambit' ? 2.2 : 1.5;
      const progress = 1 - this.inspectLeft / duration;
      if (this.type === 'karambit') {
        const flourish = Math.sin(progress * Math.PI);
        this.group.rotation.x = .25 + Math.sin(progress * Math.PI * 4) * .42 * flourish;
        this.group.rotation.y = -.45 + progress * Math.PI * 4;
        this.group.rotation.z = -.12 + Math.sin(progress * Math.PI * 2) * 1.15 * flourish;
      } else {
        this.group.rotation.y = -.45 + progress * Math.PI * 2;
        this.group.rotation.z = -.12 + Math.sin(progress * Math.PI) * .35;
      }
      this.inspectLeft = Math.max(0, this.inspectLeft - dt);
    } else {
      this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, .25, Math.min(1, dt * 5));
      this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, -.12, Math.min(1, dt * 5));
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
