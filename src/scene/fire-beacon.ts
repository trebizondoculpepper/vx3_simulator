import {
  CylinderGeometry,
  Group,
  Mesh,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { createPs1Material } from '../rendering/ps1-material';

/** A red wall sounder/beacon, with a flared hood and ribbed domed lens. +z faces out. */
export function createFireBeacon(m: number) {
  const group = new Group();
  group.name = 'Lab door red sounder beacon';
  const red = createPs1Material({ color: '#a91f19', roughness: 0.43 });
  const dark = createPs1Material({ color: '#501613', roughness: 0.65 });
  const glass = createPs1Material({ color: '#651411' }, true, true);
  const rim = createPs1Material({ color: '#c43a29', roughness: 0.32 });
  const cylinder = (
    radius: number,
    depth: number,
    z: number,
    material = red,
  ) => {
    const mesh = new Mesh(
      new CylinderGeometry(radius * m, radius * m, depth * m, 32),
      material,
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = z * m;
    group.add(mesh);
    return mesh;
  };
  cylinder(0.093, 0.034, 0.017);
  cylinder(0.086, 0.006, 0.037, dark);
  // Open flared hood: the lens is recessed inside its protective lip.
  const hood = new Mesh(
    new CylinderGeometry(0.095 * m, 0.082 * m, 0.055 * m, 32, 1, true),
    red,
  );
  hood.rotation.x = Math.PI / 2;
  hood.position.z = 0.063 * m;
  group.add(hood);
  cylinder(0.075, 0.004, 0.041, dark);
  const dome = new Mesh(
    new SphereGeometry(0.075 * m, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    glass,
  );
  dome.rotation.x = Math.PI / 2;
  dome.scale.y = 0.48;
  dome.position.z = 0.045 * m;
  group.add(dome);
  // Concentric moulded ribs pick up the flashes, like the reference lens.
  for (const radius of [0.024, 0.038, 0.05, 0.061, 0.069]) {
    const rib = new Mesh(
      new TorusGeometry(radius * m, 0.0008 * m, 5, 32),
      glass,
    );
    rib.position.z = (0.045 + 0.036 * Math.sqrt(1 - (radius / 0.075) ** 2)) * m;
    group.add(rib);
  }
  const lip = new Mesh(new TorusGeometry(0.095 * m, 0.003 * m, 8, 32), rim);
  lip.position.z = 0.091 * m;
  group.add(lip);
  for (const x of [-0.083, 0.083]) {
    const screw = new Mesh(
      new CylinderGeometry(0.0025 * m, 0.0025 * m, 0.003 * m, 8),
      dark,
    );
    screw.rotation.x = Math.PI / 2;
    screw.position.set(x * m, 0, 0.036 * m);
    group.add(screw);
  }
  return {
    group,
    setLit(on: boolean) {
      glass.color.set(on ? '#ff3420' : '#651411');
    },
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const material of [red, dark, glass, rim]) material.dispose();
    },
  };
}
