import { BoxGeometry, Group, Mesh, PlaneGeometry } from 'three';
import type { Material, Texture } from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { createLabelTexture } from './screens';

/** A BBC Model B, with a flat rear monitor shelf and sloping keyboard.
 * Approximate museum dimensions: 410 × 345 × 75 mm. Front faces +z.
 */
export function createBbcMicro(worldUnitsPerMetre: number) {
  const group = new Group();
  group.name = 'BbcMicroModelB';
  group.scale.setScalar(worldUnitsPerMetre);
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const paints = new Map<string, Material>();
  const box = (
    w: number,
    h: number,
    d: number,
    color: string,
    x: number,
    y: number,
    z: number,
    parent = group,
  ) => {
    let material = paints.get(color);
    if (!material) {
      material = createPs1Material({ color });
      paints.set(color, material);
      materials.push(material);
    }
    const part = new Mesh(new BoxGeometry(w, h, d), material);
    part.position.set(x, y, z);
    parent.add(part);
    return part;
  };
  const cream = '#d4c9a8';
  box(0.41, 0.026, 0.345, cream, 0, 0.021, 0);
  box(0.41, 0.041, 0.15, cream, 0, 0.0545, -0.0975);
  for (const x of [-0.191, 0.191]) {
    const cheek = box(0.028, 0.035, 0.185, cream, x, 0.041, 0.079);
    cheek.rotation.x = 0.18;
  }
  for (const x of [-0.16, 0.16])
    for (const z of [-0.13, 0.13])
      box(0.03, 0.008, 0.025, '#30352c', x, 0.004, z);
  const keyboard = new Group();
  keyboard.position.set(0, 0.04, 0.076);
  keyboard.rotation.x = 0.18;
  group.add(keyboard);
  box(0.355, 0.012, 0.175, '#3a352e', 0, 0, 0, keyboard);
  for (let i = 0; i < 10; i++) {
    box(
      0.022,
      0.012,
      0.019,
      '#b34432',
      -0.145 + i * 0.028,
      0.012,
      -0.067,
      keyboard,
    );
    box(
      0.008,
      0.001,
      0.002,
      '#e6d4bd',
      -0.145 + i * 0.028,
      0.019,
      -0.067,
      keyboard,
    );
  }
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 14; col++) {
      const x = -0.154 + col * 0.0235 + (row % 2) * 0.002;
      const z = -0.035 + row * 0.023;
      box(0.0195, 0.012, 0.019, '#292923', x, 0.012, z, keyboard);
      box(
        0.006,
        0.001,
        0.003,
        '#d1cbbb',
        x - 0.002,
        0.019,
        z - 0.004,
        keyboard,
      );
    }
  box(0.17, 0.012, 0.018, '#302e27', -0.016, 0.012, 0.076, keyboard);
  // Model badge and function-key strip, printed on the upward-facing deck.
  const badge = createLabelTexture('BBC microcomputer   MODEL B', {
    ink: '#252820',
    plate: cream,
    size: 14,
  });
  textures.push(badge.texture);
  const material = createPs1Material({ map: badge.texture }, true);
  materials.push(material);
  const plate = new Mesh(new PlaneGeometry(0.29, 0.019), material);
  plate.rotation.x = -Math.PI / 2;
  plate.position.set(-0.028, 0.076, -0.014);
  group.add(plate);
  for (let i = 0; i < 18; i++)
    box(0.003, 0.002, 0.022, '#716e5e', -0.16 + i * 0.008, 0.076, -0.148);
  box(0.018, 0.018, 0.003, '#342c24', 0.13, 0.046, -0.174);
  box(0.025, 0.021, 0.007, '#a34731', 0.183, 0.049, -0.174);
  return {
    group,
    monitorHeight: 0.075 * worldUnitsPerMetre,
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
