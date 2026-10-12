import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
} from 'three';
import type { Material, Texture } from 'three';
import { designate } from '../game/machine-parts';
import { createPs1Material } from '../rendering/ps1-material';
import { createLabelTexture } from './screens';

/** A period single external 5¼-inch drive; original geometry, front at +Z. */
export function createBbcDiskDrive(worldUnitsPerMetre: number) {
  const group = new Group();
  group.name = 'BbcExternalDiskDrive';
  group.scale.setScalar(worldUnitsPerMetre);
  const materials: Material[] = [],
    textures: Texture[] = [];
  const box = (
    w: number,
    h: number,
    d: number,
    color: string,
    x: number,
    y: number,
    z: number,
  ) => {
    const material = createPs1Material({ color, roughness: 0.75 });
    materials.push(material);
    const mesh = new Mesh(new BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  box(0.16, 0.057, 0.29, '#d5cbb0', 0, 0.0355, 0);
  box(0.152, 0.051, 0.009, '#252822', 0, 0.034, 0.145);
  box(0.139, 0.002, 0.002, '#555a4c', 0, 0.016, 0.15);
  box(0.124, 0.005, 0.008, '#050706', 0, 0.041, 0.151);
  // Raised disk guides and the closed, quarter-turn locking paddle.
  for (const x of [-0.064, 0.064])
    box(0.006, 0.009, 0.006, '#737a6b', x, 0.041, 0.153);
  box(0.022, 0.022, 0.004, '#191c18', 0.031, 0.041, 0.156);
  const latch = box(0.033, 0.006, 0.008, '#b2b6a0', 0.039, 0.036, 0.161);
  latch.rotation.z = -0.12;
  for (const x of [-0.058, 0.058])
    for (const z of [-0.11, 0.11])
      box(0.015, 0.007, 0.017, '#282b24', x, 0.0035, z);
  for (let i = 0; i < 8; i++)
    box(0.024, 0.001, 0.002, '#807c69', -0.048, 0.0645, -0.102 + i * 0.006);
  const ledMaterial = createPs1Material({ color: '#253b25' }, true, true);
  materials.push(ledMaterial);
  const led = new Mesh(
    new CylinderGeometry(0.0025, 0.0025, 0.002, 8),
    ledMaterial,
  );
  led.rotation.x = Math.PI / 2;
  led.position.set(-0.059, 0.023, 0.152);
  group.add(led);
  designate(led, {
    machine: 'Bench computer',
    name: 'Disk activity light',
    role: 'indicator',
  });
  const badge = createLabelTexture('DISC 0', {
    ink: '#d8d4bd',
    plate: '#252822',
    size: 12,
  });
  textures.push(badge.texture);
  const badgeMaterial = createPs1Material({ map: badge.texture }, true);
  materials.push(badgeMaterial);
  const plate = new Mesh(new PlaneGeometry(0.027, 0.008), badgeMaterial);
  plate.position.set(-0.032, 0.023, 0.151);
  group.add(plate);
  return {
    group,
    update(bootElapsed: number, reducedMotion = false) {
      const reading = bootElapsed >= 1.4 && bootElapsed < 3;
      ledMaterial.color.set(
        reading && (reducedMotion || bootElapsed % 0.16 < 0.11)
          ? '#97f27c'
          : '#253b25',
      );
    },
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
    },
  };
}
