import { CylinderGeometry, Group, Mesh } from 'three';
import type { Material } from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { createAshtray } from './ashtray';

/** A slim brass and black-enamel floor stand carrying the existing lit dish. */
export function createPedestalAshtray() {
  const group = new Group();
  group.name = 'PedestalAshtray';
  const standParts: Mesh[] = [];
  const materials: Material[] = [];
  const ring = (
    topRadius: number,
    bottomRadius: number,
    height: number,
    color: string,
    y: number,
  ) => {
    const finish = createPs1Material({ color });
    materials.push(finish);
    const item = new Mesh(
      new CylinderGeometry(topRadius, bottomRadius, height, 10),
      finish,
    );
    item.position.y = y;
    group.add(item);
    standParts.push(item);
  };

  ring(0.24, 0.34, 0.11, '#272c29', 0.055);
  ring(0.18, 0.25, 0.07, '#ad8650', 0.15);
  ring(0.055, 0.07, 1.13, '#b18a53', 0.735);
  ring(0.095, 0.075, 0.24, '#302f2a', 0.84);
  ring(0.14, 0.09, 0.12, '#b18a53', 1.33);
  ring(0.3, 0.18, 0.07, '#343b36', 1.43);
  ring(0.32, 0.3, 0.045, '#c19a63', 1.49);

  const dish = createAshtray();
  dish.group.position.y = 1.52;
  dish.group.scale.setScalar(1.25);
  group.add(dish.group);

  return {
    group,
    update: dish.update,
    dispose() {
      dish.dispose();
      for (const item of standParts) item.geometry.dispose();
      for (const item of materials) item.dispose();
    },
  };
}
