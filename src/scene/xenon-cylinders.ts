import {
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import type { BufferGeometry, Material, Texture } from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { createDialTexture, createLabelTexture } from './screens';

export interface XenonBankOptions {
  /** Floor height in lab coordinates. */
  floorY: number;
  /** Centre of the bank on the floor. */
  x: number;
  z: number;
  /** Point on the back of the main cabinet where the hose plugs in. */
  hoseEnd: Vector3;
  /** Path the hose follows along the floor between the bank and the cabinet. */
  hoseVia: Vector3[];
}

const CYLINDER_HEIGHT = 2.3;
const CYLINDER_RADIUS = 0.17;

/**
 * Three tall xenon cylinders chained to the wall, linked by a brass manifold
 * with a two-gauge regulator on top. A thick black hose runs from the
 * regulator along the floor to the back of the main cabinet.
 */
export function createXenonCylinders(options: XenonBankOptions) {
  const group = new Group();
  group.name = 'XenonCylinders';
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const mesh = (
    geometry: BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    parent: Group = group,
  ) => {
    const material = createPs1Material({ color });
    materials.push(material);
    const result = new Mesh(geometry, material);
    result.position.set(x, y, z);
    parent.add(result);
    return result;
  };
  const textured = (
    texture: Texture,
    width: number,
    height: number,
    x: number,
    y: number,
    z: number,
    parent: Group = group,
  ) => {
    textures.push(texture);
    const material = createPs1Material({ map: texture }, true);
    materials.push(material);
    const result = new Mesh<BufferGeometry, Material>(
      new PlaneGeometry(width, height),
      material,
    );
    result.position.set(x, y, z);
    parent.add(result);
    return result;
  };

  const base = options.floorY - 0.03;
  const top = base + CYLINDER_HEIGHT;
  const spacing = CYLINDER_RADIUS * 2 + 0.06;
  const xs = [-spacing, 0, spacing].map((dx) => options.x + dx);

  for (const [i, x] of xs.entries()) {
    const z = options.z + (i === 1 ? 0.05 : 0);
    // Steel body, domed shoulder, a cream band stencilled XENON.
    mesh(
      new CylinderGeometry(
        CYLINDER_RADIUS,
        CYLINDER_RADIUS,
        CYLINDER_HEIGHT - 0.2,
        10,
      ),
      '#3f5664',
      x,
      base + (CYLINDER_HEIGHT - 0.2) / 2,
      z,
    );
    const shoulder = mesh(
      new SphereGeometry(
        CYLINDER_RADIUS,
        10,
        4,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2,
      ),
      '#3f5664',
      x,
      base + CYLINDER_HEIGHT - 0.2,
      z,
    );
    shoulder.scale.y = 0.9;
    mesh(
      new CylinderGeometry(
        CYLINDER_RADIUS + 0.004,
        CYLINDER_RADIUS + 0.004,
        0.26,
        10,
      ),
      '#d8d2b8',
      x,
      top - 0.5,
      z,
    );
    const band = createLabelTexture('XENON', {
      ink: '#2b3a44',
      plate: '#d8d2b8',
      size: 14,
    });
    textured(
      band.texture,
      band.width / 150,
      band.height / 150,
      x,
      top - 0.5,
      z + CYLINDER_RADIUS + 0.008,
    );
    // Brass cylinder valve and its little handwheel.
    mesh(
      new CylinderGeometry(0.045, 0.055, 0.14, 6),
      '#b8913f',
      x,
      top + 0.04,
      z,
    );
    const wheel = mesh(
      new TorusGeometry(0.055, 0.012, 4, 8),
      '#2c2c28',
      x,
      top + 0.13,
      z,
    );
    wheel.rotation.x = Math.PI / 2;
    // Short copper pigtail up to the manifold.
    mesh(
      new CylinderGeometry(0.014, 0.014, 0.18, 5),
      '#c07a45',
      x,
      top + 0.24,
      z,
    );
  }

  // Wall bracket and safety chain across the cylinders.
  const wallZ = options.z - CYLINDER_RADIUS - 0.08;
  mesh(
    new BoxGeometry(spacing * 2 + 0.6, 0.12, 0.06),
    '#55554c',
    options.x,
    base + 1.45,
    wallZ,
  );
  for (let link = 0; link < 14; link++) {
    const t = link / 13;
    const chain = mesh(
      new TorusGeometry(0.03, 0.008, 3, 6),
      '#8a8a80',
      options.x - spacing - 0.22 + t * (spacing * 2 + 0.44),
      base + 1.45 - Math.sin(t * Math.PI) * 0.06,
      options.z + CYLINDER_RADIUS + 0.03,
    );
    chain.rotation.y = link % 2 ? Math.PI / 2 : 0;
  }

  // Brass manifold bar joining the three valves.
  const manifoldY = top + 0.34;
  const manifold = mesh(
    new CylinderGeometry(0.028, 0.028, spacing * 2 + 0.12, 6),
    '#c9a24e',
    options.x,
    manifoldY,
    options.z + 0.02,
  );
  manifold.rotation.z = Math.PI / 2;

  // Regulator: a brass body with high- and low-pressure gauges and a T-handle.
  const regulator = new Group();
  regulator.position.set(options.x, manifoldY + 0.13, options.z + 0.02);
  group.add(regulator);
  mesh(new BoxGeometry(0.2, 0.2, 0.16), '#b8913f', 0, 0, 0, regulator);
  const bonnet = mesh(
    new CylinderGeometry(0.075, 0.09, 0.14, 8),
    '#9c7a34',
    0,
    0.17,
    0,
    regulator,
  );
  bonnet.rotation.x = 0;
  mesh(
    new CylinderGeometry(0.012, 0.012, 0.1, 5),
    '#2c2c28',
    0,
    0.28,
    0,
    regulator,
  );
  const handle = mesh(
    new CylinderGeometry(0.014, 0.014, 0.18, 5),
    '#2c2c28',
    0,
    0.33,
    0,
    regulator,
  );
  handle.rotation.z = Math.PI / 2;
  for (const side of [-1, 1]) {
    const gaugeX = side * 0.17;
    const stem = mesh(
      new CylinderGeometry(0.014, 0.014, 0.08, 5),
      '#b8913f',
      side * 0.12,
      0.02,
      0,
      regulator,
    );
    stem.rotation.z = Math.PI / 2;
    const bezel = mesh(
      new CylinderGeometry(0.085, 0.085, 0.05, 10),
      '#2a2a22',
      gaugeX,
      0.04,
      0.02,
      regulator,
    );
    bezel.rotation.x = Math.PI / 2;
    const face = textured(
      createDialTexture(side > 0),
      0.15,
      0.15,
      gaugeX,
      0.04,
      0.047,
      regulator,
    );
    face.geometry.dispose();
    face.geometry = new CircleGeometry(0.072, 12);
    // High-pressure needle near full; low-pressure needle at working pressure.
    const needle = mesh(
      new BoxGeometry(0.008, 0.06, 0.004),
      '#a63425',
      gaugeX,
      0.04,
      0.052,
      regulator,
    );
    needle.geometry.translate(0, 0.026, 0);
    needle.rotation.z = side < 0 ? -1.6 : 0.4;
  }
  // Outlet nipple where the hose clamps on.
  const outlet = mesh(
    new CylinderGeometry(0.025, 0.025, 0.12, 6),
    '#b8913f',
    0,
    -0.15,
    0.06,
    regulator,
  );
  outlet.rotation.x = 0.5;

  // The thick black hose: down from the regulator, along the floor behind
  // the bench, then up to a fitting on the back of the main cabinet.
  const outletWorld = new Vector3(
    options.x,
    manifoldY + 0.13 - 0.2,
    options.z + 0.12,
  );
  const hoseFloor = options.floorY + 0.05;
  const hose = new CatmullRomCurve3([
    outletWorld,
    new Vector3(options.x + 0.05, manifoldY - 0.5, options.z + 0.3),
    new Vector3(options.x + 0.3, hoseFloor + 0.25, options.z + 0.35),
    new Vector3(options.x + 0.6, hoseFloor, options.z + 0.2),
    ...options.hoseVia,
    new Vector3(
      options.hoseEnd.x - 0.15,
      hoseFloor + 0.05,
      options.hoseEnd.z - 0.25,
    ),
    new Vector3(
      options.hoseEnd.x,
      options.hoseEnd.y - 0.3,
      options.hoseEnd.z - 0.12,
    ),
    options.hoseEnd,
  ]);
  mesh(new TubeGeometry(hose, 80, 0.05, 6, false), '#1c1c1a', 0, 0, 0);
  // Jubilee clip and a brass bulkhead fitting at the cabinet end.
  mesh(
    new BoxGeometry(0.2, 0.2, 0.06),
    '#b8913f',
    options.hoseEnd.x,
    options.hoseEnd.y,
    options.hoseEnd.z + 0.02,
  );
  const fittingLabel = createLabelTexture('Xe IN', {
    ink: '#e3d8b7',
    plate: '#343d38',
    size: 8,
  });
  textured(
    fittingLabel.texture,
    fittingLabel.width / 220,
    fittingLabel.height / 220,
    options.hoseEnd.x,
    options.hoseEnd.y + 0.17,
    options.hoseEnd.z + 0.01,
  ).rotation.y = Math.PI;

  return {
    group,
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const item of materials) item.dispose();
      for (const item of textures) item.dispose();
    },
  };
}
