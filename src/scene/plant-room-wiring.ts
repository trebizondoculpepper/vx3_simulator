import {
  BoxGeometry,
  CatmullRomCurve3,
  Group,
  Mesh,
  TubeGeometry,
  Vector3,
} from 'three';
import type { Material } from 'three';
import { createPs1Material } from '../rendering/ps1-material';

/**
 * Fifty years of additions to the plant room's wiring, none of them planned:
 * a sagging mains feed, cables slung from the ceiling on hooks and string,
 * a bundle forced through a ragged hole into the lab, a junction box with
 * its lid hanging off, spliced and taped leads, a coil of spare cable on the
 * floor, an orange extension lead run under the door and a cut-off cable
 * nobody can account for.
 *
 * Every cable is a tube, which the walking collision steps over, and the
 * layout comes from a fixed seed, so the mess is the same on every visit.
 */
export function addPlantRoomWiring(
  group: Group,
  materials: Material[],
  options: {
    floorY: number;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    worldUnitsPerMetre: number;
  },
) {
  const { floorY, minX, maxX, minZ, maxZ, worldUnitsPerMetre: m } = options;
  // Positions in metres: back from the east (lab) wall, up from the floor,
  // and out from the south wall.
  const at = (fromEast: number, up: number, fromSouth: number) =>
    new Vector3(maxX - fromEast * m, floorY + up * m, minZ + fromSouth * m);
  const widthM = (maxX - minX) / m;
  const depthM = (maxZ - minZ) / m;

  // A small fixed-seed generator, so the tangle never rearranges itself.
  let seed = 0x5eed1974;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const jitter = (amount: number) => (random() * 2 - 1) * amount;

  const paints = new Map<string, Material>();
  const paint = (color: string) => {
    let material = paints.get(color);
    if (!material) {
      material = createPs1Material({ color });
      paints.set(color, material);
      materials.push(material);
    }
    return material;
  };
  /** A box placed at `position`; returns the box, not the group. */
  const block = (
    width: number,
    height: number,
    depth: number,
    color: string,
    position: Vector3,
  ) => {
    const mesh = new Mesh(
      new BoxGeometry(width * m, height * m, depth * m),
      paint(color),
    );
    mesh.position.copy(position);
    group.add(mesh);
    return mesh;
  };
  const cable = (points: Vector3[], radius: number, color: string) => {
    const curve = new CatmullRomCurve3(points, false, 'centripetal');
    const mesh = new Mesh(
      new TubeGeometry(curve, Math.max(8, points.length * 6), radius * m, 5),
      paint(color),
    );
    mesh.castShadow = true;
    group.add(mesh);
    return curve;
  };
  /**
   * Points from `a` to `b` that sag by `droop` metres in the middle and
   * wander sideways by up to `wander` metres, the way cable hangs when
   * nobody has dressed it.
   */
  const hang = (a: Vector3, b: Vector3, droop: number, wander = 0.03) => {
    const steps = 6 + Math.round(a.distanceTo(b) / m / 0.35);
    return Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      const point = a.clone().lerp(b, t);
      const ends = Math.sin(Math.PI * t);
      point.y -= droop * m * 4 * t * (1 - t);
      if (i > 0 && i < steps) {
        point.x += jitter(wander) * m * ends;
        point.z += jitter(wander) * m * ends;
        point.y += jitter(wander * 0.5) * m * ends;
      }
      return point;
    });
  };
  /** A cable tie or tape wrap: a short ring around a cable. */
  const wrap = (
    curve: CatmullRomCurve3,
    t: number,
    radius: number,
    color: string,
  ) => {
    const centre = curve.getPoint(t);
    const tangent = curve.getTangent(t);
    const side = new Vector3(0, 1, 0).cross(tangent).normalize();
    if (side.lengthSq() < 0.5) side.set(1, 0, 0);
    const up = tangent.clone().cross(side).normalize();
    const ring = Array.from({ length: 6 }, (_, i) => {
      const angle = (i / 6) * Math.PI * 2;
      return centre
        .clone()
        .addScaledVector(side, Math.cos(angle) * radius * m)
        .addScaledVector(up, Math.sin(angle) * radius * m);
    });
    const mesh = new Mesh(
      new TubeGeometry(
        new CatmullRomCurve3(ring, true),
        12,
        radius * 0.35 * m,
        4,
        true,
      ),
      paint(color),
    );
    group.add(mesh);
  };
  const BLACK = '#1b1d1b';
  const GREY = '#6e716a';
  const BROWN = '#5a3a24';
  const BLUE = '#2f4f77';
  const EARTH = '#7f8f2a';
  const RED = '#8c2b22';
  const CLOTH = '#6b5a3c';
  const TAPE = '#c9a227';

  // The mains feed: in over the door, along the ceiling and down the wall to
  // the top of the HAUPTSCHALTER, with a spare loop nobody cut off.
  const feed = cable(
    [
      at(1.1, 2.68, depthM - 0.05),
      ...hang(at(1.0, 2.62, depthM - 0.2), at(0.1, 2.6, 2.6), 0.18, 0.05),
      at(0.07, 2.25, 2.35),
      at(0.09, 1.95, 2.28),
      at(0.07, 1.72, 2.22),
    ],
    0.02,
    BLACK,
  );
  wrap(feed, 0.35, 0.026, BLACK);
  wrap(feed, 0.62, 0.026, BLACK);
  cable(
    [
      at(0.9, 2.6, depthM - 0.3),
      at(0.85, 2.0, depthM - 0.45),
      at(0.7, 1.75, depthM - 0.6),
      at(0.55, 2.05, depthM - 0.7),
      at(0.5, 2.55, depthM - 0.75),
      at(0.12, 2.58, 2.7),
      at(0.08, 1.75, 2.25),
    ],
    0.014,
    CLOTH,
  );

  // HAUPTSCHALTER to the rectifier: three leads in a lazy loop, one of them
  // dragged along the floor.
  for (const [i, color] of [RED, BLACK, GREY].entries()) {
    const curve = cable(
      [
        at(0.06 + i * 0.03, 1.02, 2.18 - i * 0.03),
        ...hang(
          at(0.12 + i * 0.05, 0.85, 2.15),
          at(0.35 + i * 0.04, 1.6, 1.7),
          0.55 + i * 0.32,
          0.06,
        ),
        at(0.32 + i * 0.03, 1.78, 1.55 - i * 0.08),
      ],
      0.013,
      color,
    );
    if (i === 1) wrap(curve, 0.5, 0.02, TAPE);
  }

  // The rectifier's output, forced through a ragged hole into the lab.
  const hole = at(-0.01, 2.28, 0.85);
  block(0.03, 0.24, 0.3, '#151614', hole);
  for (let i = 0; i < 4; i++) {
    const blob = new Mesh(
      new BoxGeometry(
        0.025 * m,
        (0.04 + random() * 0.08) * m,
        (0.04 + random() * 0.08) * m,
      ),
      paint('#8b8f84'),
    );
    blob.position.copy(at(0.005, 2.28 + jitter(0.14), 0.85 + jitter(0.17)));
    blob.rotation.x = jitter(0.6);
    group.add(blob);
  }
  for (const [i, color] of [BLACK, BROWN, BLUE, GREY, BLACK].entries()) {
    const curve = cable(
      [
        at(0.4 + i * 0.05, 1.86, 1.25 + jitter(0.1)),
        ...hang(
          at(0.45 + i * 0.04, 2.05, 1.15),
          at(0.02, 2.28 + jitter(0.06), 0.85 + jitter(0.08)),
          0.12 + random() * 0.3,
          0.04,
        ),
        at(-0.08, 2.28 + jitter(0.05), 0.85 + jitter(0.06)),
      ],
      0.01 + random() * 0.006,
      color,
    );
    if (i % 2 === 0) wrap(curve, 0.55 + jitter(0.15), 0.02, BLACK);
  }

  // Cables slung across the ceiling on three hooks, each span sagging its
  // own way, one escaped and hanging in a loop at head height.
  const hooks = [0.2, 1.6, 2.9, widthM - 0.15].map((fromEast, i) =>
    at(fromEast, 2.62 - (i % 2) * 0.04, 1.1 + i * 0.25),
  );
  for (const hook of hooks.slice(1, -1))
    block(
      0.02,
      0.08,
      0.02,
      GREY,
      hook.clone().add(new Vector3(0, 0.05 * m, 0)),
    );
  for (const [i, color] of [BLACK, GREY, BROWN, EARTH].entries()) {
    const points: Vector3[] = [];
    for (let span = 0; span < hooks.length - 1; span++) {
      const segment = hang(
        hooks[span].clone().add(new Vector3(0, -i * 0.012 * m, i * 0.015 * m)),
        hooks[span + 1]
          .clone()
          .add(new Vector3(0, -i * 0.012 * m, i * 0.015 * m)),
        0.12 + random() * 0.22 + (span === 1 && i === 2 ? 0.75 : 0),
        0.035,
      );
      points.push(...(span === 0 ? segment : segment.slice(1)));
    }
    const curve = cable(points, 0.009 + i * 0.002, color);
    wrap(curve, 0.32 + i * 0.02, 0.025, BLACK);
  }

  // Later cable additions weave beside the joists on both sides of the
  // fluorescent fittings. They are fixed to wall hooks but sag below the
  // ceiling, so the tangle remains visible when the roof is hidden.
  const overheadRuns = [
    { south: 0.36, colors: [BLACK, BROWN, GREY] },
    { south: 1.08, colors: [BLUE, EARTH, BLACK] },
    { south: 4.16, colors: [BLACK, GREY, BROWN] },
  ];
  for (const [runIndex, run] of overheadRuns.entries()) {
    for (const [strand, color] of run.colors.entries()) {
      const fromSouth = run.south + strand * 0.055;
      const curve = cable(
        hang(
          at(widthM - 0.16, 2.59 - strand * 0.018, fromSouth),
          at(0.14, 2.57 - strand * 0.018, fromSouth + 0.12),
          0.12 + runIndex * 0.035 + strand * 0.025,
          0.035,
        ),
        0.009 + strand * 0.001,
        color,
      );
      if (strand === 1) wrap(curve, 0.46, 0.024, TAPE);
    }
  }
  for (const fromEast of [0.24, widthM - 0.22]) {
    for (const [strand, color] of [BLACK, GREY, BLUE].entries())
      cable(
        hang(
          at(fromEast + strand * 0.045, 2.61, 0.25),
          at(fromEast + strand * 0.045, 2.58, depthM - 0.28),
          0.1 + strand * 0.04,
          0.025,
        ),
        0.008,
        color,
      );
  }

  // A junction box on the west wall with its lid hanging off one screw and
  // its contents spilling out.
  const box = at(widthM - 0.06, 1.9, 3.0);
  block(0.1, 0.24, 0.24, '#7c8075', box);
  const lid = new Mesh(
    new BoxGeometry(0.012 * m, 0.25 * m, 0.25 * m),
    paint('#8a8e82'),
  );
  lid.position.copy(at(widthM - 0.16, 1.73, 3.12));
  lid.rotation.set(0.5, 0.4, -0.35);
  group.add(lid);
  const spill = [BROWN, BLUE, EARTH, RED, BLACK, GREY, BROWN];
  for (const [i, color] of spill.entries()) {
    const start = at(widthM - 0.1, 1.9 + jitter(0.08), 3.0 + jitter(0.08));
    const points = [start];
    let point = start.clone();
    for (let step = 0; step < 4; step++) {
      point = point
        .clone()
        .add(
          new Vector3(
            (0.04 + random() * 0.06) * m,
            jitter(0.09) * m - step * 0.02 * m,
            jitter(0.09) * m,
          ),
        );
      points.push(point);
    }
    const curve = cable(points, 0.005, color);
    // One dead end, taped up with whatever was to hand.
    if (i === 3) wrap(curve, 0.98, 0.012, TAPE);
  }
  // From the box: down the wall and across the floor to the xenon cage,
  // held down with tape.
  const floorRun = cable(
    [
      at(widthM - 0.06, 1.78, 2.95),
      at(widthM - 0.04, 1.2, 2.9),
      at(widthM - 0.05, 0.4, 2.85),
      at(widthM - 0.12, 0.02, 2.7),
      at(widthM - 0.6, 0.015, 2.2),
      at(widthM - 1.0, 0.02, 1.7),
      at(widthM - 1.5, 0.018, 1.3),
      at(widthM - 1.7, 0.05, 0.95),
      at(widthM - 1.75, 0.6, 0.92),
    ],
    0.008,
    GREY,
  );
  for (const t of [0.42, 0.58, 0.74]) {
    const point = floorRun.getPoint(t);
    const tape = new Mesh(
      new BoxGeometry(0.1 * m, 0.002 * m, 0.05 * m),
      paint(TAPE),
    );
    tape.position.set(point.x, floorY + 0.001 * m, point.z);
    tape.rotation.y = jitter(1.2);
    group.add(tape);
  }

  // Spare cable left in a careless coil on the floor beside the rectifier.
  const coil: Vector3[] = [];
  for (let i = 0; i <= 40; i++) {
    const angle = i * 0.62;
    const radius = 0.16 + Math.sin(i * 1.7) * 0.03 + i * 0.002;
    coil.push(
      at(
        1.25 + Math.cos(angle) * radius,
        0.012 + (i % 7) * 0.006,
        2.75 + Math.sin(angle) * radius * 0.8,
      ),
    );
  }
  coil.push(at(1.05, 0.01, 3.2), at(0.6, 0.01, 2.9), at(0.08, 0.3, 2.4));
  cable(coil, 0.009, BLACK);

  // An orange extension lead from the junction box, out under the door to
  // somewhere in the corridor.
  cable(
    [
      at(widthM - 0.08, 1.82, 3.08),
      at(widthM - 0.06, 0.9, 3.2),
      at(widthM - 0.15, 0.02, 3.4),
      at(widthM - 0.7, 0.015, 3.9),
      at(widthM * 0.55, 0.015, depthM - 0.35),
      at(widthM * 0.5 + 0.1, 0.012, depthM - 0.05),
      at(widthM * 0.5 + 0.2, 0.012, depthM + 0.4),
    ],
    0.008,
    '#d06a1c',
  );

  // A cable cut off at the ceiling years ago, its frayed end at eye level.
  const stub = cable(
    hang(at(2.3, 2.66, 2.05), at(2.45, 1.92, 2.2), -0.05, 0.03),
    0.011,
    BLACK,
  );
  const end = stub.getPoint(1);
  for (let strand = 0; strand < 5; strand++)
    cable(
      [
        end,
        end
          .clone()
          .add(new Vector3(jitter(0.02) * m, -0.04 * m, jitter(0.02) * m)),
        end
          .clone()
          .add(new Vector3(jitter(0.04) * m, -0.07 * m, jitter(0.04) * m)),
      ],
      0.0015,
      '#b8743a',
    );
}
