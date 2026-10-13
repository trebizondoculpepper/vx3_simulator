import { BoxGeometry, Group, Mesh } from 'three';
import type { Material } from 'three';
import { createPs1Material } from '../rendering/ps1-material';

/** The same Bakelite rocker and off-state locator lamp in every room. */
export function createLightSwitch(worldUnitsPerMetre: number) {
  const m = worldUnitsPerMetre;
  const group = new Group();
  group.name = 'RoomLightSwitch';
  group.userData.sound = 'rocker';
  const materials: Material[] = [];
  const part = (
    w: number,
    h: number,
    d: number,
    color: string,
    x: number,
    y: number,
    z: number,
    parent = group,
  ) => {
    const finish = createPs1Material({ color });
    materials.push(finish);
    const mesh = new Mesh(new BoxGeometry(w * m, h * m, d * m), finish);
    mesh.position.set(x * m, y * m, z * m);
    parent.add(mesh);
    return mesh;
  };
  const plate = part(0.14, 0.18, 0.025, '#2b2723', 0, 0, 0);
  const pivot = new Group();
  pivot.position.z = 0.026 * m;
  group.add(pivot);
  const rocker = part(0.056, 0.084, 0.04, '#d8cfb8', 0, 0.012, 0, pivot);
  const finderMaterial = createPs1Material({ color: '#ffca42' }, true, true);
  materials.push(finderMaterial);
  const finder = new Mesh(
    new BoxGeometry(0.014 * m, 0.01 * m, 0.006 * m),
    finderMaterial,
  );
  finder.position.set(0, -0.068 * m, 0.019 * m);
  group.add(finder);
  return {
    group,
    parts: [plate, rocker, finder],
    update(on: boolean) {
      pivot.rotation.x = on ? -0.35 : 0.35;
      finderMaterial.color.set(on ? '#3a2c1c' : '#ffca42');
    },
    dispose() {
      for (const material of materials) material.dispose();
    },
  };
}
