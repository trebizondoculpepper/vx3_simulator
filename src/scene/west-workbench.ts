import {
  BoxGeometry,
  CircleGeometry,
  CubicBezierCurve3,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import type { BufferGeometry, Material, Object3D } from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { createSinkLeak } from '../game/sink-leak';

export interface WestWorkbenchOptions {
  floorY: number;
  worldUnitsPerMetre: number;
  /** Inner face of the west wall. The bench runs along it. */
  wallX: number;
  /** North end of the bench. */
  fromZ: number;
  /** South end of the bench: the inner face of the south wall. */
  toZ: number;
}

const TOP = '#5a3f26';
const TOP_EDGE = '#3f2c1b';
const FRAME = '#3c453e';
const CUPBOARD = '#55665f';
const CERAMIC = '#f4f3ed';
const CHROME = '#c8ccc8';

/**
 * A long laboratory workbench against the west wall: an oiled hardwood top
 * on a steel frame, drawers at the north end, a shelf of boxes underneath,
 * a socket trunking upstand, a bench vice, and in the south-west corner a
 * deep glazed sink with an arching swan-neck laboratory tap. The tap runs
 * when clicked. Sizes are in metres; positions are world coordinates.
 */
export function createWestWorkbench(options: WestWorkbenchOptions) {
  const { floorY, worldUnitsPerMetre: m, wallX, fromZ, toZ } = options;
  const group = new Group();
  group.name = 'WestWorkbench';
  const materials: Material[] = [];
  const paint = (color: string, unlit = false) => {
    const material = createPs1Material({ color }, unlit);
    if (color === CERAMIC && material instanceof MeshStandardMaterial)
      material.roughness = 0.22;
    materials.push(material);
    return material;
  };
  const mesh = (
    geometry: BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    unlit = false,
  ) => {
    const result = new Mesh(geometry, paint(color, unlit));
    result.position.set(x, y, z);
    group.add(result);
    return result;
  };
  /** A box sized in metres, placed by distance from the wall and height above the floor. */
  const box = (
    w: number,
    h: number,
    d: number,
    color: string,
    out: number,
    up: number,
    z: number,
  ) =>
    mesh(
      new BoxGeometry(w * m, h * m, d * m),
      color,
      wallX + out * m,
      floorY + up * m,
      z,
    );

  const depth = 0.75;
  const height = 0.9;
  const slab = 0.05;
  const length = (toZ - fromZ) / m;
  const midZ = (fromZ + toZ) / 2;
  // The sink sits in the corner; its basin is cut out of the top.
  const sinkLength = 0.55;
  const sinkWidth = 0.45;
  const sinkOut = 0.1;
  const sinkZ = toZ - (0.12 + sinkLength / 2) * m;
  const sinkNorth = sinkZ - (sinkLength / 2) * m;
  const sinkSouth = sinkZ + (sinkLength / 2) * m;
  const topY = height - slab / 2;
  const basin = 0.38;
  const sinkFloor = height - basin;

  // Worktop in pieces around the sink cut-out, with a dark front edge.
  const run = (z0: number, z1: number, out0: number, out1: number) =>
    box(
      out1 - out0,
      slab,
      (z1 - z0) / m,
      TOP,
      (out0 + out1) / 2,
      topY,
      (z0 + z1) / 2,
    );
  run(fromZ, sinkNorth, 0, depth);
  run(sinkSouth, toZ, 0, depth);
  run(sinkNorth, sinkSouth, 0, sinkOut);
  run(sinkNorth, sinkSouth, sinkOut + sinkWidth, depth);
  box(0.03, slab + 0.02, length, TOP_EDGE, depth - 0.01, topY - 0.01, midZ);

  // Upstand with a socket trunking along the wall.
  box(0.02, 0.15, length, TOP_EDGE, 0.01, height + 0.075, midZ);
  box(0.06, 0.08, length - 0.8, '#a2a493', 0.05, height + 0.12, midZ - 0.4 * m);
  for (let z = fromZ + 0.4 * m; z < sinkNorth - 0.3 * m; z += 0.6 * m) {
    box(0.012, 0.06, 0.08, '#e6e0cc', 0.085, height + 0.12, z);
    box(0.014, 0.02, 0.02, '#1c1c1a', 0.088, height + 0.12, z + 0.02 * m);
  }

  // Steel frame, a low shelf, and a bank of drawers at the north end.
  for (let z = fromZ + 0.05 * m; z < sinkNorth; z += 1.15 * m)
    for (const out of [0.05, depth - 0.06])
      box(0.05, height - slab, 0.05, FRAME, out, (height - slab) / 2, z);
  box(
    depth - 0.08,
    0.03,
    length - 0.7,
    '#4b514c',
    depth / 2,
    0.18,
    midZ - 0.35 * m,
  );
  box(
    depth - 0.08,
    0.04,
    length - 0.7,
    FRAME,
    depth / 2,
    height - slab - 0.04,
    midZ - 0.35 * m,
  );
  for (let i = 0; i < 3; i++) {
    const y = height - slab - 0.16 - i * 0.2;
    const z = fromZ + 0.35 * m;
    box(0.02, 0.18, 0.56, '#6f7a70', depth - 0.03, y, z);
    box(0.03, 0.025, 0.16, '#b9b6aa', depth, y + 0.03, z);
  }
  box(
    depth - 0.08,
    height - slab - 0.1,
    0.6,
    '#59625a',
    depth / 2 - 0.02,
    (height - slab) / 2 + 0.03,
    fromZ + 0.35 * m,
  );
  // Boxes and a coil of cable on the shelf.
  const boxes: [number, number, string][] = [
    [1.6, 0.28, '#8a6e47'],
    [2.1, 0.22, '#6d5a3f'],
    [2.5, 0.3, '#8a6e47'],
  ];
  for (const [at, h, color] of boxes)
    box(0.42, h, 0.36, color, 0.3, 0.2 + h / 2, fromZ + at * m);
  const coil = mesh(
    new CylinderGeometry(0.14 * m, 0.14 * m, 0.08 * m, 10),
    '#26364a',
    wallX + 0.35 * m,
    floorY + 0.24 * m,
    fromZ + 1.2 * m,
  );
  coil.rotation.z = 0.1;

  // Bench vice bolted to the north end.
  {
    const z = fromZ + 0.25 * m;
    box(0.12, 0.08, 0.2, '#2f5f8a', depth - 0.04, height + 0.04, z);
    box(0.05, 0.1, 0.18, '#2f5f8a', depth + 0.04, height + 0.05, z);
    const screw = mesh(
      new CylinderGeometry(0.012 * m, 0.012 * m, 0.22 * m, 6),
      CHROME,
      wallX + (depth + 0.12) * m,
      floorY + (height + 0.04) * m,
      z,
    );
    screw.rotation.z = Math.PI / 2;
    const bar = mesh(
      new CylinderGeometry(0.008 * m, 0.008 * m, 0.2 * m, 5),
      CHROME,
      wallX + (depth + 0.2) * m,
      floorY + (height + 0.04) * m,
      z,
    );
    bar.rotation.x = Math.PI / 2;
  }

  // Under-sink cupboard closes off the corner.
  {
    const z0 = sinkNorth - 0.1 * m;
    const span = (toZ - z0) / m;
    const cz = (z0 + toZ) / 2;
    box(
      depth - 0.04,
      sinkFloor - 0.03,
      span,
      '#46524c',
      depth / 2 - 0.02,
      (sinkFloor - 0.03) / 2,
      cz,
    );
    for (const side of [-1, 1]) {
      box(
        0.02,
        height - slab - 0.12,
        span / 2 - 0.03,
        CUPBOARD,
        depth - 0.02,
        (height - slab) / 2 + 0.03,
        cz + side * (span / 4) * m,
      );
      box(
        0.03,
        0.12,
        0.02,
        '#b9b6aa',
        depth,
        height - slab - 0.15,
        cz + side * 0.06 * m,
      );
    }
    box(0.03, 0.08, span, '#1e221f', depth - 0.06, 0.04, cz);
  }

  // Deep glazed sink, hollow, with a drain and a rolled rim.
  const sinkCentreOut = sinkOut + sinkWidth / 2;
  box(sinkWidth, 0.03, sinkLength, CERAMIC, sinkCentreOut, sinkFloor, sinkZ);
  for (const side of [-1, 1]) {
    // Thick white porcelain lip raised above the wooden worktop.
    box(
      0.05,
      0.045,
      sinkLength + 0.05,
      CERAMIC,
      sinkCentreOut + (side * sinkWidth) / 2,
      height + 0.015,
      sinkZ,
    );
    box(
      sinkWidth + 0.05,
      0.045,
      0.05,
      CERAMIC,
      sinkCentreOut,
      height + 0.015,
      sinkZ + ((side * sinkLength) / 2) * m,
    );
    box(
      0.03,
      basin + 0.02,
      sinkLength,
      CERAMIC,
      sinkCentreOut + side * (sinkWidth / 2 - 0.015),
      sinkFloor + basin / 2,
      sinkZ,
    );
    box(
      sinkWidth,
      basin + 0.02,
      0.03,
      CERAMIC,
      sinkCentreOut,
      sinkFloor + basin / 2,
      sinkZ + side * (sinkLength / 2 - 0.015) * m,
    );
  }
  const drain = mesh(
    new CircleGeometry(0.035 * m, 8),
    '#5f625c',
    wallX + sinkCentreOut * m,
    floorY + (sinkFloor + 0.016) * m,
    sinkZ,
  );
  drain.rotation.x = -Math.PI / 2;

  // Swan-neck laboratory tap rising from the upstand and arching out over
  // the basin, with wrist-action levers either side of its base.
  const tapParts: Object3D[] = [];
  const baseOut = 0.06;
  const neck = new CubicBezierCurve3(
    new Vector3(wallX + baseOut * m, floorY + height * m, sinkZ),
    new Vector3(wallX + baseOut * m, floorY + (height + 0.52) * m, sinkZ),
    new Vector3(wallX + sinkCentreOut * m, floorY + (height + 0.52) * m, sinkZ),
    new Vector3(wallX + sinkCentreOut * m, floorY + (height + 0.3) * m, sinkZ),
  );
  tapParts.push(
    mesh(new TubeGeometry(neck, 24, 0.012 * m, 6, false), CHROME, 0, 0, 0),
  );
  tapParts.push(
    mesh(
      new CylinderGeometry(0.03 * m, 0.035 * m, 0.06 * m, 8),
      CHROME,
      wallX + baseOut * m,
      floorY + (height + 0.03) * m,
      sinkZ,
    ),
  );
  tapParts.push(
    mesh(
      new CylinderGeometry(0.016 * m, 0.012 * m, 0.04 * m, 6),
      CHROME,
      wallX + sinkCentreOut * m,
      floorY + (height + 0.29) * m,
      sinkZ,
    ),
  );
  for (const side of [-1, 1]) {
    tapParts.push(
      mesh(
        new CylinderGeometry(0.018 * m, 0.018 * m, 0.04 * m, 6),
        CHROME,
        wallX + baseOut * m,
        floorY + (height + 0.04) * m,
        sinkZ + side * 0.07 * m,
      ),
    );
    const lever = mesh(
      new BoxGeometry(0.02 * m, 0.012 * m, 0.13 * m),
      side < 0 ? '#2f5f8a' : '#b8241c',
      wallX + (baseOut + 0.02) * m,
      floorY + (height + 0.07) * m,
      sinkZ + side * 0.12 * m,
    );
    lever.rotation.x = side * 0.25;
    tapParts.push(lever);
  }
  // The stream of water, shown while the tap runs.
  const streamLength = 0.3 + basin - 0.02;
  const stream = mesh(
    new CylinderGeometry(0.006 * m, 0.008 * m, streamLength * m, 5),
    '#a9c6d6',
    wallX + sinkCentreOut * m,
    floorY + (height + 0.27 - streamLength / 2) * m,
    sinkZ,
    true,
  );
  stream.visible = false;
  const leak = createSinkLeak();
  const drop = mesh(
    new SphereGeometry(0.008 * m, 6, 4),
    '#b9d4db',
    wallX + sinkCentreOut * m,
    floorY + (height + 0.27) * m,
    sinkZ,
    true,
  );
  drop.visible = false;
  let last: number | undefined;

  return {
    group,
    /** Every mesh of the tap, for clicking. */
    tapParts: tapParts as readonly Object3D[],
    toggleTap() {
      const running = leak.toggle();
      stream.visible = running;
      return running;
    },
    update(seconds: number, reducedMotion: boolean) {
      const delta =
        last === undefined ? 0 : Math.min(0.1, Math.max(0, seconds - last));
      last = seconds;
      const drip = leak.step(delta);
      drop.visible = drip.drop !== null && !reducedMotion;
      if (drip.drop !== null)
        drop.position.y =
          floorY + (height + 0.27 - drip.drop ** 2 * streamLength) * m;
      const wobble = reducedMotion ? 1 : 1 + Math.sin(seconds * 37) * 0.15;
      stream.scale.set(wobble, 1, wobble);
      return drip.impact;
    },
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const item of materials) item.dispose();
    },
  };
}
