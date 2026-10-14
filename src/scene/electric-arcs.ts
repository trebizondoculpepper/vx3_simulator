import {
  BufferAttribute,
  DoubleSide,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PointLight,
} from 'three';

/**
 * Electrical discharge across a panel: short, jagged arcs jumping between
 * points on its face, each a bright white core inside a wide blue glow,
 * redrawn several times a second while it lasts, with a
 * flash of light at each strike. Built in metres in the panel's own plane
 * (x across, y up, facing +z), over `width` by `height` centred on the
 * origin.
 *
 * The shape is midpoint displacement: a straight segment's midpoint is
 * pushed sideways at random, then each half is treated the same way with
 * a smaller push, and now and then a fork runs off from a midpoint.
 */

const GENERATIONS = 5;
const MAX_POINTS = 2 ** GENERATIONS + 1;

/** A small seeded generator, so the flicker never repeats exactly. */
function generator(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A jagged path from a to b, by midpoint displacement. */
function bolt(
  random: () => number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  roughness: number,
) {
  let points: [number, number][] = [
    [ax, ay],
    [bx, by],
  ];
  let offset = Math.hypot(bx - ax, by - ay) * roughness;
  for (let g = 0; g < GENERATIONS; g++) {
    const next: [number, number][] = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      const length = Math.hypot(x1 - x0, y1 - y0) || 1;
      // Push the midpoint along the segment's normal.
      const push = (random() - 0.5) * 2 * offset;
      next.push([
        (x0 + x1) / 2 + (-(y1 - y0) / length) * push,
        (y0 + y1) / 2 + ((x1 - x0) / length) * push,
      ]);
      next.push(points[i]);
    }
    points = next;
    offset *= 0.55;
  }
  return points;
}

/** A flat ribbon along a path, `width` wide, as triangle positions. */
function ribbon(
  points: [number, number][],
  width: number,
  out: Float32Array,
  z: number,
) {
  let n = 0;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const length = Math.hypot(x1 - x0, y1 - y0) || 1;
    // Thinner towards the ends, as a spark is.
    const along = i / points.length;
    const w = (width / 2) * (0.35 + 0.65 * Math.sin(along * Math.PI));
    const nx = (-(y1 - y0) / length) * w;
    const ny = ((x1 - x0) / length) * w;
    const quad = [
      [x0 - nx, y0 - ny],
      [x0 + nx, y0 + ny],
      [x1 + nx, y1 + ny],
      [x0 - nx, y0 - ny],
      [x1 + nx, y1 + ny],
      [x1 - nx, y1 - ny],
    ];
    for (const [x, y] of quad) {
      out[n++] = x;
      out[n++] = y;
      out[n++] = z;
    }
  }
  return n / 3;
}

export function createElectricArcs({
  width = 0.45,
  height = 1.2,
  arcs = 3,
  seed = 1,
} = {}) {
  const group = new Group();
  group.name = 'ElectricArcs';
  group.userData.noCollision = true;
  const random = generator(seed);
  // Drawn over the face, not added to it: on white enamel additive light
  // would vanish. A saturated blue glow, a pale blue-white core.
  const glow = new MeshBasicMaterial({
    color: '#2f5dff',
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    toneMapped: false,
    side: DoubleSide,
  });
  const core = new MeshBasicMaterial({
    color: '#d8e6ff',
    transparent: true,
    opacity: 1,
    depthWrite: false,
    toneMapped: false,
    side: DoubleSide,
  });
  // A light that flashes with the strikes.
  const flash = new PointLight('#9fb8ff', 0, 1.6, 2);
  flash.position.set(0, 0, 0.15);
  group.add(flash);
  // Each arc: a main bolt and room for a fork, as glow and core ribbons.
  const segments = MAX_POINTS - 1;
  const vertices = segments * 6 * 2;
  const slots = Array.from({ length: arcs }, () => {
    const make = (material: MeshBasicMaterial) => {
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        'position',
        new BufferAttribute(new Float32Array(vertices * 3), 3),
      );
      const mesh = new Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.visible = false;
      group.add(mesh);
      return mesh;
    };
    return {
      glow: make(glow),
      core: make(core),
      /** Seconds until it next changes: strikes or goes dark. */
      wait: random(),
      /** Seconds left on the current strike, if striking. */
      left: 0,
      redraw: 0,
      from: [0, 0] as [number, number],
      to: [0, 0] as [number, number],
    };
  });

  const draw = (slot: (typeof slots)[number]) => {
    const [ax, ay] = slot.from;
    const [bx, by] = slot.to;
    const main = bolt(random, ax, ay, bx, by, 0.32);
    const shapes = [main];
    // Now and then a fork runs off from part-way along.
    if (random() < 0.5) {
      const from = main[Math.floor(main.length * (0.3 + random() * 0.4))];
      const angle = Math.atan2(by - ay, bx - ax) + (random() - 0.5) * 1.6;
      const reach = Math.hypot(bx - ax, by - ay) * (0.3 + random() * 0.3);
      shapes.push(
        bolt(
          random,
          from[0],
          from[1],
          from[0] + Math.cos(angle) * reach,
          from[1] + Math.sin(angle) * reach,
          0.35,
        ),
      );
    }
    for (const [mesh, w, z] of [
      [slot.glow, 0.04, 0.001],
      [slot.core, 0.011, 0.002],
    ] as const) {
      const position = mesh.geometry.attributes.position as BufferAttribute;
      const array = position.array as Float32Array;
      let count = 0;
      for (const shape of shapes)
        count += ribbon(
          shape,
          shape === main ? w : w * 0.6,
          array.subarray(count * 3),
          z,
        );
      mesh.geometry.setDrawRange(0, count);
      position.needsUpdate = true;
    }
  };

  let strikes = 0;
  return {
    group,
    /** How many strikes have begun, for the room to crackle with. */
    get strikes() {
      return strikes;
    },
    /**
     * Strength 0 to 1: how often it strikes. In reduced motion nothing
     * strikes at all, as flashes are what it asks to be spared.
     */
    update(delta: number, strength: number, reducedMotion: boolean) {
      const active = strength > 0.01 && !reducedMotion;
      let lit = 0;
      for (const slot of slots) {
        if (!active) {
          slot.glow.visible = slot.core.visible = false;
          slot.left = 0;
          continue;
        }
        if (slot.left > 0) {
          slot.left -= delta;
          slot.redraw -= delta;
          // The arc dances while it lasts.
          if (slot.redraw <= 0) {
            draw(slot);
            slot.redraw = 0.04 + random() * 0.04;
          }
          if (slot.left <= 0) {
            slot.glow.visible = slot.core.visible = false;
            // A gap before the next: long when weak, short when strong.
            slot.wait = (0.3 + random() * 2.5) / (0.2 + strength);
          } else lit++;
          continue;
        }
        slot.wait -= delta;
        if (slot.wait > 0) continue;
        // Strike: between two points on the face, a hand's width apart.
        const x = (random() - 0.5) * width * 0.9;
        const y = (random() - 0.5) * height * 0.9;
        const angle = random() * Math.PI * 2;
        const reach = 0.12 + random() * 0.22;
        slot.from = [x, y];
        slot.to = [
          Math.max(
            -width / 2,
            Math.min(width / 2, x + Math.cos(angle) * reach),
          ),
          Math.max(
            -height / 2,
            Math.min(height / 2, y + Math.sin(angle) * reach),
          ),
        ];
        slot.left = 0.06 + random() * 0.22;
        slot.redraw = 0;
        slot.glow.visible = slot.core.visible = true;
        strikes++;
        lit++;
      }
      flash.intensity = lit > 0 ? 0.25 + random() * 0.35 : 0;
    },
    dispose() {
      for (const slot of slots) {
        slot.glow.geometry.dispose();
        slot.core.geometry.dispose();
      }
      glow.dispose();
      core.dispose();
    },
  };
}
