import {
  BoxGeometry,
  Group,
  Mesh,
  NearestFilter,
  SRGBColorSpace,
  TextureLoader,
  TorusGeometry,
} from 'three';
import type { Material } from 'three';
import { createPs1Material } from '../rendering/ps1-material';

/** The thick, wire-bound BBC Micro guide lying beside its disk drive. */
export function createBbcUserGuide(worldUnitsPerMetre: number) {
  const group = new Group();
  group.name = 'BbcMicroUserGuide';
  group.scale.setScalar(worldUnitsPerMetre);
  const materials: Material[] = [];
  const solid = (color: string) => {
    const material = createPs1Material({ color });
    materials.push(material);
    return material;
  };
  const box = (
    width: number,
    height: number,
    depth: number,
    material: Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const mesh = new Mesh(new BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
  };
  const cover = solid('#10100f');
  const pages = solid('#d6c9a8');
  const pageLine = solid('#a99b7e');
  const wire = solid('#ddd7c6');
  box(0.19, 0.005, 0.27, cover, 0, 0.0025, 0);
  box(0.18, 0.039, 0.26, pages, 0, 0.0245, 0);
  for (let i = 0; i < 5; i++)
    box(0.18, 0.0006, 0.001, pageLine, 0, 0.011 + i * 0.007, 0.1305);

  const coverImage = new TextureLoader().load(
    '/reference/bbc-micro-user-guide-cover.png',
  );
  coverImage.colorSpace = SRGBColorSpace;
  coverImage.magFilter = NearestFilter;
  const printedCover = createPs1Material({ map: coverImage }, true);
  materials.push(printedCover);
  // The print is the box's top face, so it cannot fight a second cover surface.
  const top = new Mesh(new BoxGeometry(0.19, 0.005, 0.27), [
    cover,
    cover,
    printedCover,
    cover,
    cover,
    cover,
  ]);
  top.position.y = 0.0465;
  group.add(top);

  // The wire runs down the left, long edge of the portrait cover.
  for (let i = 0; i < 12; i++) {
    const loop = new Mesh(new TorusGeometry(0.015, 0.0022, 5, 10), wire);
    loop.position.set(-0.101, 0.027, -0.116 + i * 0.0211);
    group.add(loop);
  }
  return {
    group,
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const material of materials) material.dispose();
      coverImage.dispose();
    },
  };
}
