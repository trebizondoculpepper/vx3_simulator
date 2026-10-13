import { BoxGeometry, CylinderGeometry, Group, Mesh } from 'three';
import type { Material } from 'three';
import { createPs1Material } from '../rendering/ps1-material';

/**
 * A 1980s typist's chair: a five-star base on castors, a gas column, a
 * seat and a separate backrest on a bent steel post, upholstered in burnt
 * orange. It faces -z, with the backrest on its +z side. Sizes are in
 * metres; the group's origin is on the floor under the column. On castors,
 * it is pushed aside rather than walked round, so it never blocks.
 */
export function createOfficeChair(worldUnitsPerMetre: number) {
  const m = worldUnitsPerMetre;
  const group = new Group();
  group.name = 'Office chair';
  const materials: Material[] = [];
  const paint = (color: string) => {
    const made = createPs1Material({ color });
    materials.push(made);
    return made;
  };
  const frame = paint('#2a2b2d');
  const chrome = paint('#a9adad');
  const fabric = paint('#9a4e2c');
  const parts: Mesh[] = [];
  const add = (mesh: Mesh, x: number, y: number, z: number) => {
    mesh.position.set(x * m, y * m, z * m);
    mesh.userData.noCollision = true;
    group.add(mesh);
    parts.push(mesh);
    return mesh;
  };
  const box = (
    w: number,
    h: number,
    d: number,
    material: Material,
    x: number,
    y: number,
    z: number,
  ) => add(new Mesh(new BoxGeometry(w * m, h * m, d * m), material), x, y, z);

  // The five-star base and its castors.
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + 0.3;
    const leg = box(0.05, 0.035, 0.3, frame, 0, 0.07, 0);
    leg.rotation.y = angle;
    leg.position.set(
      Math.sin(angle) * 0.15 * m,
      0.07 * m,
      Math.cos(angle) * 0.15 * m,
    );
    const caster = add(
      new Mesh(new CylinderGeometry(0.025 * m, 0.025 * m, 0.03 * m, 8), frame),
      Math.sin(angle) * 0.29,
      0.025,
      Math.cos(angle) * 0.29,
    );
    caster.rotation.z = Math.PI / 2;
    caster.rotation.y = angle;
  }
  // The column: a black shroud over a chrome gas spring.
  add(
    new Mesh(new CylinderGeometry(0.035 * m, 0.04 * m, 0.16 * m, 10), frame),
    0,
    0.15,
    0,
  );
  add(
    new Mesh(new CylinderGeometry(0.022 * m, 0.022 * m, 0.16 * m, 8), chrome),
    0,
    0.3,
    0,
  );
  // The seat, on its plate.
  box(0.28, 0.03, 0.26, frame, 0, 0.395, 0);
  box(0.46, 0.07, 0.44, fabric, 0, 0.445, 0);
  // The backrest post, bent up behind the seat, and the backrest.
  box(0.05, 0.025, 0.24, frame, 0, 0.4, 0.16);
  box(0.05, 0.42, 0.025, frame, 0, 0.6, 0.27);
  const back = box(0.42, 0.3, 0.06, fabric, 0, 0.8, 0.255);
  back.rotation.x = -0.12;

  return {
    group,
    /** Every mesh of the chair, for clicking it. */
    parts,
    dispose() {
      for (const part of parts) part.geometry.dispose();
      for (const item of materials) item.dispose();
    },
  };
}
