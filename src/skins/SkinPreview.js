import * as THREE from 'three';
import { KNIFE_SKINS } from './KnifeSkinDefinitions.js';
import { animateKnifeWaves, collectKnifeWaveMaterials, createKnifeBladeMaterial, disposeKnifeMaterial } from './KnifeMaterial.js';

export class SkinPreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, .1, 30);
    this.camera.position.set(0, 1.1, 6);
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.pixelRatio = Math.min(devicePixelRatio, 1.75);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.scene.add(new THREE.HemisphereLight(0xf7e4bd, 0x26312b, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    this.type = 'butterfly';
    this.skin = 'classic';
    this.inspectLeft = 0;
    this.waveMaterials = [];
    this.lastFrame = performance.now();
    this.running = true;
    this.rebuild();
    this.animate(this.lastFrame);
  }

  resize() {
    const width = Math.floor(this.canvas.clientWidth);
    const height = Math.floor(this.canvas.clientHeight);
    if (width < 2 || height < 2) return false;
    const expectedWidth = Math.floor(width * this.pixelRatio);
    const expectedHeight = Math.floor(height * this.pixelRatio);
    if (this.canvas.width !== expectedWidth || this.canvas.height !== expectedHeight) {
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
    return true;
  }

  set(type, skin) {
    this.type = type;
    this.skin = skin;
    this.inspectLeft = 0;
    this.rebuild();
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

  rebuild() {
    this.clearModel();
    const style = KNIFE_SKINS[this.skin] || KNIFE_SKINS.classic;
    const bladeMaterial = createKnifeBladeMaterial(style);
    const gripMaterial = new THREE.MeshStandardMaterial({ color: style.handle, metalness: .28, roughness: .64, flatShading: true });
    const detailMaterial = new THREE.MeshStandardMaterial({ color: 0xb3a371, metalness: .82, roughness: .24, flatShading: true });

    if (this.type === 'karambit') {
      const bladeShape = new THREE.Shape();
      bladeShape.moveTo(-.08, .06);
      bladeShape.bezierCurveTo(.48, .43, 1.08, .45, 1.58, .15);
      bladeShape.bezierCurveTo(2.13, -.17, 2.55, -.73, 2.77, -1.38);
      bladeShape.bezierCurveTo(2.42, -1.13, 2.04, -.78, 1.7, -.44);
      bladeShape.bezierCurveTo(1.22, .02, .68, .12, .12, -.16);
      bladeShape.lineTo(-.1, -.06);
      bladeShape.closePath();
      const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(bladeShape, { depth: .1, curveSegments: 12, bevelEnabled: true, bevelThickness: .03, bevelSize: .022, bevelSegments: 2 }), bladeMaterial);
      blade.name = 'karambit-preview-blade';
      this.group.add(blade);

      const edgeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(.1, -.14, .145), new THREE.Vector3(.58, .09, .145),
        new THREE.Vector3(1.08, .04, .145), new THREE.Vector3(1.52, -.33, .145),
        new THREE.Vector3(1.9, -.7, .145), new THREE.Vector3(2.3, -1.03, .145),
        new THREE.Vector3(2.72, -1.36, .145)
      ]);
      const edge = new THREE.Mesh(new THREE.TubeGeometry(edgeCurve, 28, .025, 6, false), new THREE.MeshStandardMaterial({ color: 0xd8e5e9, metalness: .96, roughness: .12 }));
      edge.name = 'karambit-preview-edge';
      this.group.add(edge);

      const handleShape = new THREE.Shape();
      handleShape.moveTo(-.08, -.16);
      handleShape.quadraticCurveTo(-.48, -.34, -.77, -.24);
      handleShape.quadraticCurveTo(-1.12, -.38, -1.5, -.17);
      handleShape.quadraticCurveTo(-1.7, .12, -1.51, .44);
      handleShape.quadraticCurveTo(-.78, .66, -.08, .43);
      handleShape.lineTo(.06, .23);
      handleShape.lineTo(.04, .02);
      handleShape.closePath();
      for (const x of [-1.22, -.8, -.38]) {
        const hole = new THREE.Path();
        hole.absellipse(x, .12, .13, .16, 0, Math.PI * 2, false, 0);
        handleShape.holes.push(hole);
      }
      const handle = new THREE.Mesh(new THREE.ExtrudeGeometry(handleShape, { depth: .24, curveSegments: 8, bevelEnabled: true, bevelThickness: .028, bevelSize: .022, bevelSegments: 2 }), gripMaterial);
      handle.name = 'karambit-preview-handle';
      handle.position.z = -.07;
      this.group.add(handle);

      const rimMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(style.handle).multiplyScalar(.5), metalness: .1, roughness: .85, flatShading: true });
      for (const x of [-1.22, -.8, -.38]) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(.145, .022, 7, 20), rimMaterial);
        rim.name = 'karambit-preview-handle-hole-rim';
        rim.position.set(x, .12, .19);
        this.group.add(rim);
      }

      const ring = new THREE.Mesh(new THREE.TorusGeometry(.31, .09, 9, 28), gripMaterial);
      ring.position.set(-1.82, .14, .05);
      ring.name = 'karambit-preview-ring';
      this.group.add(ring);
      const ringLiner = new THREE.Mesh(new THREE.TorusGeometry(.215, .025, 7, 24), detailMaterial);
      ringLiner.position.copy(ring.position);
      this.group.add(ringLiner);

      const guard = new THREE.Mesh(new THREE.BoxGeometry(.17, .58, .2), detailMaterial);
      guard.position.set(-.02, .17, .03);
      guard.rotation.z = -.12;
      this.group.add(guard);
    } else if (this.type === 'm9') {
      const bladeShape=new THREE.Shape();bladeShape.moveTo(-.1,-.3);bladeShape.lineTo(1.55,-.28);bladeShape.lineTo(2.38,.03);bladeShape.lineTo(1.66,.42);bladeShape.lineTo(-.08,.42);bladeShape.closePath();
      const bladeHole=new THREE.Path();bladeHole.absellipse(1.55,.08,.12,.085,0,Math.PI*2,false,0);bladeShape.holes.push(bladeHole);
      const blade=new THREE.Mesh(new THREE.ExtrudeGeometry(bladeShape,{depth:.12,curveSegments:8,bevelEnabled:true,bevelThickness:.026,bevelSize:.02,bevelSegments:2}),bladeMaterial);blade.name='m9-preview-blade';this.group.add(blade);
      for(let index=0;index<7;index++){const serration=new THREE.Mesh(new THREE.BoxGeometry(.13,.11,.16),detailMaterial);serration.name='m9-preview-serration';serration.position.set(.18+index*.19,.45,.055);serration.rotation.z=.6;this.group.add(serration);}
      const guard=new THREE.Mesh(new THREE.BoxGeometry(.18,1.02,.22),bladeMaterial);guard.position.set(-.17,.05,.02);this.group.add(guard);
      const guardRing=new THREE.Mesh(new THREE.TorusGeometry(.22,.065,10,26),bladeMaterial);guardRing.position.set(-.19,-.51,.02);this.group.add(guardRing);
      const handle=new THREE.Mesh(new THREE.BoxGeometry(1.48,.48,.3),gripMaterial);handle.position.set(-.98,.05,.01);this.group.add(handle);
      const ribMaterial=new THREE.MeshStandardMaterial({color:new THREE.Color(style.handle).multiplyScalar(.6),metalness:.12,roughness:.86});for(let index=0;index<7;index++){const rib=new THREE.Mesh(new THREE.BoxGeometry(.08,.56,.34),ribMaterial);rib.position.set(-.36-index*.19,.05,.01);this.group.add(rib);}
      const pommel=new THREE.Mesh(new THREE.BoxGeometry(.18,.58,.34),detailMaterial);pommel.position.set(-1.78,.05,.01);this.group.add(pommel);
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
    this.group.rotation.set(this.type === 'karambit' ? .18 : this.type === 'm9' ? .12 : .25, this.type === 'karambit' ? -.34 : this.type === 'm9' ? -.28 : -.45, this.type === 'karambit' ? -.06 : this.type === 'm9' ? -.04 : -.12);
    this.waveMaterials = collectKnifeWaveMaterials(this.group);
  }

  inspect() { this.inspectLeft = this.type === 'karambit' ? 2.6 : this.type === 'm9' ? 2.4 : 1.7; }

  animate(now) {
    if (!this.running) return;
    requestAnimationFrame((time) => this.animate(time));
    const dt = Math.min(.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    if (!this.resize()) return;
    if (this.waveMaterials?.length) animateKnifeWaves(this.waveMaterials, now / 1000);

    if (this.inspectLeft > 0) {
      const duration = this.type === 'karambit' ? 2.6 : this.type === 'm9' ? 2.4 : 1.7;
      const progress = 1 - this.inspectLeft / duration;
      if (this.type === 'karambit') {
        const flourish = Math.sin(progress * Math.PI);
        this.group.rotation.x = .18 + Math.sin(progress * Math.PI * 4) * .42 * flourish;
        this.group.rotation.y = -.34 + progress * Math.PI * 4;
        this.group.rotation.z = -.06 + Math.sin(progress * Math.PI * 2) * 1.15 * flourish;
      } else if (this.type === 'm9') {
        const presentation=Math.sin(progress*Math.PI);const showSide=Math.sin(progress*Math.PI*2);this.group.rotation.x=.12-presentation*.16;this.group.rotation.y=-.28+presentation*.82;this.group.rotation.z=-.04+showSide*.1*presentation;
      } else {
        this.group.rotation.y = -.45 + progress * Math.PI * 2;
        this.group.rotation.z = -.12 + Math.sin(progress * Math.PI) * .35;
      }
      this.inspectLeft = Math.max(0, this.inspectLeft - dt);
    } else {
      const idleX = this.type === 'karambit' ? .18 : this.type === 'm9' ? .12 : .25;
      const idleZ = this.type === 'karambit' ? -.06 : this.type === 'm9' ? -.04 : -.12;
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
