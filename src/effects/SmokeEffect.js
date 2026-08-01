import * as THREE from 'three';

export class SmokeEffect {
  constructor(scene) { this.scene = scene;this.clouds = []; }

  spawn(position) {
    const group = new THREE.Group();
    const coreGeometry = new THREE.SphereGeometry(1, 8, 6);
    const wispGeometry = new THREE.SphereGeometry(1, 7, 5);
    const coreMaterial = new THREE.MeshBasicMaterial({ color: 0x596058, transparent: true, opacity: .34, depthWrite: false, fog: true });
    const wispMaterial = new THREE.MeshBasicMaterial({ color: 0x747b70, transparent: true, opacity: .22, depthWrite: false, fog: true });
    for (let index = 0; index < 30; index += 1) {
      const core = index < 18;
      const angle = index * 2.399963;
      const radius = core ? Math.sqrt(index / 18) * 2.25 : 2.25 + (index - 18) * .095;
      const mesh = new THREE.Mesh(core ? coreGeometry : wispGeometry, core ? coreMaterial : wispMaterial);
      const scale = (core ? 1.55 : 1.25) + ((index * 17) % 9) * .09;
      mesh.scale.set(scale * (1 + (index % 3) * .08), scale * (.72 + (index % 4) * .08), scale);
      mesh.position.set(Math.cos(angle) * radius, .65 + ((index * 7) % 13) * .15, Math.sin(angle) * radius);
      mesh.rotation.set(index * .19, index * .31, index * .13);
      group.add(mesh);
    }
    group.position.copy(position);group.scale.setScalar(.64);this.scene.add(group);
    this.clouds.push({ group, life: 16.5, age: 0, coreGeometry, wispGeometry, coreMaterial, wispMaterial });
  }

  update(dt) {
    for (let index = this.clouds.length - 1; index >= 0; index -= 1) {
      const cloud = this.clouds[index];cloud.life -= dt;cloud.age += dt;cloud.group.rotation.y += dt * .035;
      const bloom = Math.min(1, cloud.age / 1.15);cloud.group.scale.setScalar(.64 + bloom * .48);
      cloud.group.position.y += dt * .012;
      if (cloud.life < 3.2) {
        const fade = Math.max(0, cloud.life / 3.2);cloud.coreMaterial.opacity = .34 * fade;cloud.wispMaterial.opacity = .22 * fade;
      }
      if (cloud.life <= 0) {
        this.scene.remove(cloud.group);cloud.coreGeometry.dispose();cloud.wispGeometry.dispose();cloud.coreMaterial.dispose();cloud.wispMaterial.dispose();this.clouds.splice(index, 1);
      }
    }
  }

  blocks(a, b) { return this.clouds.some((cloud) => distanceToSegment(cloud.group.position, a, b) < 5.2); }
}

function distanceToSegment(point, a, b) {
  const ab = b.clone().sub(a);const lengthSq = ab.lengthSq();if (lengthSq < .0001) return point.distanceTo(a);
  const t = Math.max(0, Math.min(1, point.clone().sub(a).dot(ab) / lengthSq));return point.distanceTo(a.clone().addScaledVector(ab, t));
}
