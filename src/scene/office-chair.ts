import { CylinderGeometry, Group, Mesh, RepeatWrapping, Vector3 } from 'three';
import type { Material, Texture } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createPs1Material } from '../rendering/ps1-material';
import { createCanvasTexture } from './screens';

/** A worn 1980s swivel task chair, facing -z. Dimensions are metres. */
export function createOfficeChair(worldUnitsPerMetre: number) {
  const m = worldUnitsPerMetre;
  const group = new Group();
  group.name = 'Office chair';
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const parts: Mesh[] = [];
  const paint = (color: string, metalness = 0) => {
    const made = createPs1Material({
      color,
      metalness,
      roughness: metalness ? 0.42 : 0.8,
    });
    materials.push(made);
    return made;
  };
  const frame = paint('#292c2b');
  const chrome = paint('#aab0ad', 0.6);
  const trim = paint('#4a332b');

  // Small, close-spaced warp and weft threads with age and colour variation.
  const art = createCanvasTexture(256, 256);
  const c = art.context;
  let seed = 8107;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  c.fillStyle = '#8a4c32';
  c.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 3) {
    c.fillStyle = y % 6 ? 'rgba(213,154,107,.17)' : 'rgba(35,23,22,.18)';
    c.fillRect(0, y, 256, 1);
  }
  for (let x = 0; x < 256; x += 3) {
    c.fillStyle = x % 6 ? 'rgba(235,181,119,.16)' : 'rgba(45,23,20,.18)';
    c.fillRect(x, 0, 1, 256);
  }
  for (let i = 0; i < 3200; i++) {
    const x = random() * 256;
    const y = random() * 256;
    c.fillStyle =
      random() < 0.5 ? 'rgba(244,194,135,.15)' : 'rgba(29,27,27,.14)';
    c.fillRect(x, y, 1 + random() * 2, 1);
  }
  art.texture.wrapS = RepeatWrapping;
  art.texture.wrapT = RepeatWrapping;
  art.texture.repeat.set(2, 2);
  art.texture.needsUpdate = true;
  textures.push(art.texture);
  const fabric = createPs1Material({ map: art.texture, roughness: 0.94 });
  materials.push(fabric);

  const add = (mesh: Mesh, x: number, y: number, z: number) => {
    mesh.position.set(x * m, y * m, z * m);
    mesh.userData.noCollision = true;
    group.add(mesh);
    parts.push(mesh);
    return mesh;
  };
  const rounded = (
    w: number,
    h: number,
    d: number,
    radius: number,
    material: Material,
    x: number,
    y: number,
    z: number,
  ) =>
    add(
      new Mesh(
        new RoundedBoxGeometry(w * m, h * m, d * m, 4, radius * m),
        material,
      ),
      x,
      y,
      z,
    );
  const rod = (a: Vector3, b: Vector3, radius: number, material: Material) => {
    const delta = b.clone().sub(a);
    const mesh = add(
      new Mesh(
        new CylinderGeometry(radius * m, radius * m, delta.length() * m, 10),
        material,
      ),
      (a.x + b.x) / 2,
      (a.y + b.y) / 2,
      (a.z + b.z) / 2,
    );
    mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize());
    return mesh;
  };

  // Five swept feet, separate wheel yokes, and twin castors.
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + 0.3;
    const sx = Math.sin(angle);
    const sz = Math.cos(angle);
    rod(
      new Vector3(0, 0.115, 0),
      new Vector3(sx * 0.29, 0.075, sz * 0.29),
      0.022,
      frame,
    );
    const yoke = rounded(
      0.06,
      0.055,
      0.055,
      0.012,
      frame,
      sx * 0.29,
      0.052,
      sz * 0.29,
    );
    yoke.rotation.y = angle;
    for (const side of [-1, 1]) {
      const wheel = add(
        new Mesh(
          new CylinderGeometry(0.025 * m, 0.025 * m, 0.018 * m, 12),
          frame,
        ),
        sx * 0.29 + sz * side * 0.025,
        0.026,
        sz * 0.29 - sx * side * 0.025,
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.rotation.y = angle;
    }
  }
  add(
    new Mesh(new CylinderGeometry(0.043 * m, 0.047 * m, 0.17 * m, 12), frame),
    0,
    0.165,
    0,
  );
  add(
    new Mesh(new CylinderGeometry(0.022 * m, 0.022 * m, 0.16 * m, 12), chrome),
    0,
    0.31,
    0,
  );
  rounded(0.3, 0.035, 0.28, 0.012, frame, 0, 0.398, 0);

  // Upholstery sits inside a dark welt, with soft radiused cushion edges.
  rounded(0.49, 0.09, 0.46, 0.035, trim, 0, 0.443, -0.005);
  rounded(0.475, 0.09, 0.445, 0.038, fabric, 0, 0.452, -0.012);
  rod(new Vector3(0, 0.4, 0.19), new Vector3(0, 0.61, 0.29), 0.019, chrome);
  rod(new Vector3(0, 0.61, 0.29), new Vector3(0, 0.84, 0.29), 0.019, chrome);
  const backShell = rounded(0.45, 0.34, 0.065, 0.035, trim, 0, 0.82, 0.265);
  backShell.rotation.x = -0.1;
  const backPad = rounded(0.43, 0.32, 0.07, 0.038, fabric, 0, 0.82, 0.215);
  backPad.rotation.x = -0.1;
  const rearPad = rounded(0.43, 0.32, 0.026, 0.025, fabric, 0, 0.82, 0.31);
  rearPad.rotation.x = -0.1;

  // Narrow padded arms make the silhouette read as an office chair.
  for (const side of [-1, 1]) {
    rod(
      new Vector3(side * 0.225, 0.42, 0.12),
      new Vector3(side * 0.245, 0.64, 0.12),
      0.015,
      chrome,
    );
    rod(
      new Vector3(side * 0.22, 0.44, -0.13),
      new Vector3(side * 0.245, 0.64, -0.13),
      0.015,
      chrome,
    );
    rounded(0.075, 0.035, 0.32, 0.015, frame, side * 0.245, 0.65, -0.005);
  }

  return {
    group,
    /** Every mesh of the chair, for clicking it. */
    parts,
    dispose() {
      for (const part of parts) part.geometry.dispose();
      for (const item of materials) item.dispose();
      for (const item of textures) item.dispose();
    },
  };
}
