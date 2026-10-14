import {
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import type { BufferGeometry, Material, Texture } from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { createCanvasTexture, createDialTexture } from './screens';

const WOOD = '#8a5a2e';
const RUBBER = '#1f2120';
const BLACK = '#18191a';
const STEEL = '#8d9290';
const BRASS = '#b8913f';
const COPPER = '#8f4f2d';
const FLEX = '#202020';

/** Where the machines stand on the bench, in metres. */
export interface ContraptionLayout {
  /** Distance of each machine's centre along the bench from its north end. */
  along: readonly number[];
  /** Distance along the bench of the trunking socket each one plugs into. */
  sockets: readonly number[];
  /** Machines' centres, measured out from the wall. */
  out: number;
  /** The socket faces, measured out from the wall, and their height above the worktop. */
  socketOut: number;
  socketUp: number;
}

/**
 * The machines' places on the west bench: clear of the vice at the north
 * end and of the cassette player by the sink, each plugged into the nearest
 * free trunking socket to its north.
 */
export const benchContraptionLayout: ContraptionLayout = {
  along: [0.73, 1.25, 1.75],
  sockets: [0.4, 1.0, 1.6],
  out: 0.4,
  socketOut: 0.091,
  socketUp: 0.12,
};

/** Half the width, along the bench, that each machine occupies, in metres. */
export const contraptionHalfWidths = [0.315, 0.18, 0.25] as const;

/** What the operator writes on switching each machine on, in turn. */
export const contraptionNotes: readonly (readonly string[])[] = [
  [
    'Bench resonator on. The valve lit and the dish began to turn. Nobody has found its input.',
    'Resonator on again. The globe gauge has no scale, only a needle that disagrees with me.',
    'Resonator on. Followed the pink leads while it ran. They go into each other.',
  ],
  [
    'Copper solenoid on. Rings of light climb the coil. All three dials read the same, whatever they measure.',
    'Solenoid on. The bulbs take turns. The coil is warm on one side only.',
    'Solenoid on. Turned the middle dial. The left-hand bulb objected.',
  ],
  [
    'Coil cabinet on. The big bulb surges whenever nobody is looking straight at it.',
    'Coil cabinet on. The circuit board blinks in a script I almost recognise.',
    'Coil cabinet on. Counted the turns on the coils while they lit. Different answer each time.',
  ],
];

export const contraptionNames = [
  'bench resonator',
  'copper solenoid',
  'coil cabinet',
] as const;

/**
 * Three baffling machines for the west workbench, after the user's photos:
 * a resonator board with a lit valve, a ribbed black cone, a globe gauge
 * and looping pink leads; a copper solenoid on a steel box of dials with a
 * green meter and two small bulbs; and an open coil cabinet with two ribbed
 * coil stacks, a silver box under a big bulb, a circuit board and a sprawl
 * of wire. Each stands on its own base with its front to the room, and a
 * mains lead runs from its back to a socket on the bench trunking. Clicking
 * one switches it on or off; running, each has its own animation.
 * `group` is placed at the bench's north end, on the worktop, at the wall.
 */
export function createBenchContraptions(
  worldUnitsPerMetre: number,
  layout: ContraptionLayout,
  powerLeads = true,
) {
  const m = worldUnitsPerMetre;
  const group = new Group();
  group.name = 'BenchContraptions';
  const materials: Material[] = [];
  const textures: Texture[] = [];
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
  /** A light-giving material, dark while its machine is off. */
  const glow = (color: string) => {
    const material = createPs1Material(
      { color },
      true,
      true,
    ) as MeshBasicMaterial;
    materials.push(material);
    return material;
  };
  const clear = (color: string, opacity: number) => {
    const material = createPs1Material({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    materials.push(material);
    return material;
  };
  const put = (
    parent: Group,
    geometry: BufferGeometry,
    look: string | Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const result = new Mesh(
      geometry,
      typeof look === 'string' ? paint(look) : look,
    );
    result.position.set(x * m, y * m, z * m);
    parent.add(result);
    return result;
  };
  const box = (
    parent: Group,
    w: number,
    h: number,
    d: number,
    look: string | Material,
    x: number,
    y: number,
    z: number,
  ) => put(parent, new BoxGeometry(w * m, h * m, d * m), look, x, y, z);
  const cylinder = (
    parent: Group,
    radius: number,
    h: number,
    look: string | Material,
    x: number,
    y: number,
    z: number,
    sides = 10,
  ) =>
    put(
      parent,
      new CylinderGeometry(radius * m, radius * m, h * m, sides),
      look,
      x,
      y,
      z,
    );
  /** The lowest point of every lead, for checking none dips into the bench. */
  const leadFloors: { lowest: number; floor: number }[] = [];
  /**
   * A flexible lead through the given points. The curve is sampled and
   * lifted wherever it would dip into the machine's base or the worktop,
   * so no wire passes through either.
   */
  const wire = (
    parent: Group,
    points: [number, number, number][],
    color: string,
    radius = 0.004,
  ) => {
    const { w, d, top } = parent.userData.footprint as {
      w: number;
      d: number;
      top: number;
    };
    const curve = new CatmullRomCurve3(
      points.map(([x, y, z]) => new Vector3(x, y, z)),
    );
    const floorAt = (x: number, z: number) =>
      (Math.abs(x) <= w / 2 + radius && Math.abs(z) <= d / 2 + radius
        ? top
        : 0) +
      radius +
      0.002;
    const lifted = curve
      .getPoints(48)
      .map(
        (point) =>
          new Vector3(
            point.x,
            Math.max(point.y, floorAt(point.x, point.z)),
            point.z,
          ),
      );
    // The smoothed tube through the lifted points can still sag between
    // them, so check its own samples too and lift again where it does.
    const smooth = new CatmullRomCurve3(lifted, false, 'centripetal');
    const final = smooth
      .getPoints(64)
      .map(
        (point) =>
          new Vector3(
            point.x * m,
            Math.max(point.y, floorAt(point.x, point.z)) * m,
            point.z * m,
          ),
      );
    for (const point of final)
      leadFloors.push({
        lowest: point.y / m - radius,
        floor: floorAt(point.x / m, point.z / m) - radius - 0.002,
      });
    const result = put(
      parent,
      new TubeGeometry(
        new CatmullRomCurve3(final, false, 'centripetal'),
        64,
        radius * m,
        4,
        false,
      ),
      color,
      0,
      0,
      0,
    );
    result.userData.noCollision = true;
    return result;
  };
  /** A stack of black fins: the ribbed coil formers in the photos. */
  const ribbed = (
    parent: Group,
    radius: number,
    h: number,
    x: number,
    y: number,
    z: number,
  ) => {
    const fins = Math.round(h / 0.016);
    for (let i = 0; i < fins; i++)
      cylinder(
        parent,
        i % 2 ? radius : radius * 0.86,
        h / fins,
        BLACK,
        x,
        y + (i + 0.5) * (h / fins),
        z,
      );
  };
  /**
   * A clear lamp: brass cap, a glass stem, two support wires and a coiled
   * tungsten filament strung between them, inside a pale glass globe. The
   * filament's material is returned so the machine can light it.
   */
  const bulb = (
    parent: Group,
    radius: number,
    x: number,
    y: number,
    z: number,
  ) => {
    cylinder(parent, radius * 0.45, radius * 0.6, BRASS, x, y, z, 8);
    const centre = y + radius * 1.25;
    put(
      parent,
      new SphereGeometry(radius * m, 12, 9),
      clear('#f6e7c3', 0.28),
      x,
      centre,
      z,
    ).userData.noCollision = true;
    cylinder(
      parent,
      radius * 0.12,
      radius * 0.7,
      clear('#e8f0ee', 0.5),
      x,
      y + radius * 0.6,
      z,
      6,
    );
    const span = radius * 0.55;
    for (const side of [-1, 1]) {
      const support = cylinder(
        parent,
        0.0008,
        radius * 0.75,
        '#4b4b48',
        x + side * span * 0.5,
        centre - radius * 0.1,
        z,
        3,
      );
      support.rotation.z = side * -0.25;
    }
    const turns = 7;
    const coil: Vector3[] = [];
    for (let i = 0; i <= turns * 8; i++) {
      const t = i / (turns * 8);
      const angle = t * turns * Math.PI * 2;
      coil.push(
        new Vector3(
          (x - span / 2 + t * span) * m,
          (centre + 0.22 * radius + Math.sin(angle) * radius * 0.07) * m,
          (z + Math.cos(angle) * radius * 0.07) * m,
        ),
      );
    }
    const filament = glow('#ffb24a');
    parent.add(
      new Mesh(
        new TubeGeometry(
          new CatmullRomCurve3(coil),
          turns * 8,
          0.0012 * m,
          3,
          false,
        ),
        filament,
      ),
    );
    return filament;
  };
  /** A round meter with a needle, returned so it can be swung. */
  const dial = (parent: Group, x: number, y: number, z: number, r: number) => {
    const face = createDialTexture(null);
    textures.push(face);
    const material = createPs1Material({ map: face }, true);
    materials.push(material);
    const ring = cylinder(parent, r * 1.2, 0.012, BLACK, x, y, z, 12);
    ring.rotation.x = Math.PI / 2;
    put(parent, new CircleGeometry(r * m, 14), material, x, y, z + 0.0065);
    const needle = new Group();
    needle.position.set(x * m, y * m, (z + 0.008) * m);
    parent.add(needle);
    const blade = box(parent, 0.0015, r * 0.8, 0.001, '#9b2a1a', 0, 0, 0);
    needle.add(blade);
    blade.position.set(0, r * 0.4 * m, 0);
    needle.rotation.z = 0.9;
    return needle;
  };
  /** A ring of light that climbs a coil while its machine runs. */
  const climber = (parent: Group, radius: number, x: number, z: number) => {
    const ring = put(
      parent,
      new TorusGeometry(radius * m, 0.004 * m, 3, 14),
      glow('#b9a4ff'),
      x,
      0,
      z,
    );
    ring.rotation.x = Math.PI / 2;
    ring.visible = false;
    ring.userData.noCollision = true;
    return ring;
  };
  const base = (w: number, d: number, top = 0.025) => {
    const parent = new Group();
    parent.userData.footprint = { w, d, top };
    group.add(parent);
    box(parent, w, 0.025, d, WOOD, 0, 0.0125, 0);
    return parent;
  };

  // 1. The resonator board: steel cabinet, a lit valve on a little chassis,
  // a tape-deck front panel, the ribbed black cone, a globe gauge on a
  // stalk, a dish on a post, a whip antenna and looping pink leads.
  const resonator = base(0.62, 0.34, 0.033);
  box(resonator, 0.6, 0.008, 0.32, RUBBER, 0, 0.029, 0);
  box(resonator, 0.16, 0.17, 0.2, '#2b2e2e', -0.21, 0.118, -0.02);
  put(resonator, new CircleGeometry(0.03 * m, 10), BLACK, -0.21, 0.09, 0.081);
  box(resonator, 0.15, 0.06, 0.12, '#3a3c3a', -0.03, 0.063, 0.04);
  box(resonator, 0.13, 0.05, 0.012, '#c9c9c0', -0.03, 0.06, 0.103);
  for (let i = 0; i < 6; i++)
    box(
      resonator,
      0.014,
      0.012,
      0.006,
      '#2d2d2b',
      -0.08 + i * 0.02,
      0.045,
      0.111,
    );
  box(resonator, 0.07, 0.016, 0.004, '#4c4a42', -0.03, 0.072, 0.11);
  cylinder(resonator, 0.02, 0.012, BRASS, -0.03, 0.099, 0.03, 8);
  cylinder(
    resonator,
    0.022,
    0.07,
    clear('#e9d9b6', 0.3),
    -0.03,
    0.14,
    0.03,
  ).userData.noCollision = true;
  // The valve's heater: a hairpin of glowing wire inside a grey anode.
  cylinder(
    resonator,
    0.012,
    0.035,
    clear('#4a4d4a', 0.75),
    -0.03,
    0.14,
    0.03,
    8,
  );
  const valveHeater = glow('#ff9a2e');
  {
    const hairpin = [0, 1, 2, 3, 4, 5, 6].map(
      (i) =>
        new Vector3(
          (-0.03 + (i % 2 ? 0.004 : -0.004)) * m,
          (0.115 + i * 0.008) * m,
          0.03 * m,
        ),
    );
    resonator.add(
      new Mesh(
        new TubeGeometry(
          new CatmullRomCurve3(hairpin),
          24,
          0.0013 * m,
          3,
          false,
        ),
        valveHeater,
      ),
    );
  }
  ribbed(resonator, 0.065, 0.22, 0.18, 0.033, -0.02);
  put(
    resonator,
    new ConeGeometry(0.065 * m, 0.08 * m, 10),
    BLACK,
    0.18,
    0.293,
    -0.02,
  );
  cylinder(resonator, 0.005, 0.16, STEEL, 0.06, 0.11, -0.06, 5);
  const gauge = put(
    resonator,
    new SphereGeometry(0.035 * m, 10, 8),
    '#e8e2cf',
    0.06,
    0.21,
    -0.06,
  );
  gauge.scale.z = 0.55;
  put(
    resonator,
    new TorusGeometry(0.035 * m, 0.004 * m, 4, 12),
    BRASS,
    0.06,
    0.21,
    -0.058,
  );
  const gaugeNeedle = new Group();
  gaugeNeedle.position.set(0.06 * m, 0.21 * m, -0.039 * m);
  resonator.add(gaugeNeedle);
  const gaugeBlade = box(resonator, 0.002, 0.026, 0.002, '#9b2a1a', 0, 0, 0);
  gaugeNeedle.add(gaugeBlade);
  gaugeBlade.position.y = 0.013 * m;
  gaugeNeedle.rotation.z = 0.9;
  cylinder(resonator, 0.004, 0.11, STEEL, -0.12, 0.09, -0.08, 5);
  const dish = new Group();
  dish.position.set(-0.12 * m, 0.15 * m, -0.08 * m);
  resonator.add(dish);
  const bowl = put(
    resonator,
    new SphereGeometry(0.03 * m, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    BLACK,
    0,
    0,
    0,
  );
  dish.add(bowl);
  bowl.rotation.x = Math.PI / 2;
  bowl.position.set(0, 0.01 * m, 0);
  const whip = cylinder(resonator, 0.004, 0.3, '#2a2a28', 0.29, 0.18, 0.05, 5);
  whip.rotation.z = -0.12;
  cylinder(resonator, 0.012, 0.04, BLACK, 0.285, 0.053, 0.05, 6);
  const pink = '#c995a3';
  wire(
    resonator,
    [
      [-0.21, 0.2, -0.02],
      [-0.16, 0.33, 0],
      [-0.08, 0.3, 0.02],
      [-0.03, 0.18, 0.03],
    ],
    pink,
  );
  wire(
    resonator,
    [
      [-0.03, 0.18, 0.03],
      [0.02, 0.36, 0],
      [0.12, 0.38, -0.03],
      [0.17, 0.3, -0.02],
    ],
    pink,
  );
  wire(
    resonator,
    [
      [-0.12, 0.17, -0.08],
      [-0.05, 0.3, -0.1],
      [0.04, 0.27, -0.08],
      [0.06, 0.25, -0.06],
    ],
    pink,
  );
  wire(
    resonator,
    [
      [-0.28, 0.2, -0.05],
      [-0.3, 0.31, 0],
      [-0.25, 0.27, 0.06],
      [-0.2, 0.2, 0.06],
    ],
    pink,
  );
  wire(
    resonator,
    [
      [0.24, 0.06, 0.02],
      [0.2, 0.05, 0.12],
      [0.26, 0.06, 0.14],
      [0.285, 0.07, 0.05],
    ],
    '#3c6fb4',
    0.006,
  );

  // 2. The copper solenoid: a steel box with three dials, a green meter
  // panel, a tall copper coil and two small bulbs on coloured leads.
  const solenoid = base(0.36, 0.3);
  box(solenoid, 0.22, 0.12, 0.12, STEEL, 0, 0.085, 0.05);
  const knobs = [-0.065, 0, 0.065].map((x) => {
    dial(solenoid, x, 0.085, 0.111, 0.022);
    const knob = cylinder(solenoid, 0.006, 0.012, BLACK, x, 0.085, 0.118, 6);
    knob.rotation.x = Math.PI / 2;
    return knob;
  });
  box(solenoid, 0.18, 0.02, 0.16, '#6f7472', 0, 0.155, 0);
  box(solenoid, 0.07, 0.11, 0.012, '#3f6b4f', -0.06, 0.22, -0.01);
  const meterNeedle = dial(solenoid, -0.06, 0.235, -0.0035, 0.022);
  cylinder(solenoid, 0.045, 0.28, COPPER, 0.03, 0.305, -0.02, 14);
  for (let i = 0; i < 9; i++)
    put(
      solenoid,
      new TorusGeometry(0.046 * m, 0.0025 * m, 3, 14),
      '#6e3a1f',
      0.03,
      0.18 + i * 0.03,
      -0.02,
    ).rotation.x = Math.PI / 2;
  cylinder(solenoid, 0.048, 0.008, '#5a3a24', 0.03, 0.449, -0.02, 14);
  const solenoidRing = climber(solenoid, 0.052, 0.03, -0.02);
  const leftLamp = bulb(solenoid, 0.022, -0.06, 0.28, -0.01);
  const rightLamp = bulb(solenoid, 0.018, 0.12, 0.33, -0.01);
  box(solenoid, 0.012, 0.165, 0.012, BLACK, 0.12, 0.248, -0.01);
  wire(
    solenoid,
    [
      [-0.06, 0.28, -0.01],
      [-0.02, 0.36, 0.02],
      [0.0, 0.47, 0.0],
      [0.03, 0.455, -0.02],
    ],
    '#d8b73a',
  );
  wire(
    solenoid,
    [
      [0.12, 0.33, -0.01],
      [0.16, 0.28, 0.02],
      [0.15, 0.17, 0.08],
      [0.11, 0.12, 0.11],
    ],
    '#d8b73a',
  );
  wire(
    solenoid,
    [
      [0.075, 0.2, -0.02],
      [0.14, 0.2, 0.03],
      [0.16, 0.12, 0.06],
      [0.11, 0.06, 0.111],
    ],
    '#2f5fa8',
  );
  wire(
    solenoid,
    [
      [0.075, 0.17, -0.04],
      [0.15, 0.22, -0.05],
      [0.17, 0.1, 0.0],
      [0.11, 0.1, 0.111],
    ],
    '#a33a2e',
  );

  // 3. The coil cabinet: brown sheet-metal sides and back, two ribbed coil
  // stacks, a silver box under a big bulb, a circuit board at the front
  // and a sprawl of white and pink wire.
  const cabinet = base(0.5, 0.36);
  const sheet = '#5d4838';
  box(cabinet, 0.012, 0.3, 0.32, sheet, -0.22, 0.175, -0.01);
  box(cabinet, 0.012, 0.3, 0.32, sheet, 0.22, 0.175, -0.01);
  box(cabinet, 0.44, 0.3, 0.012, sheet, 0, 0.175, -0.165);
  const caps: Mesh[] = [];
  const cabinetRings: Mesh[] = [];
  for (const x of [-0.12, 0.0]) {
    cylinder(cabinet, 0.035, 0.05, BLACK, x, 0.15, -0.06, 10);
    ribbed(cabinet, 0.06, 0.15, x, 0.175, -0.06);
    caps.push(cylinder(cabinet, 0.025, 0.02, STEEL, x, 0.335, -0.06, 6));
    cabinetRings.push(climber(cabinet, 0.066, x, -0.06));
  }
  box(cabinet, 0.09, 0.13, 0.08, '#bfc3bf', 0.12, 0.19, -0.07);
  cylinder(cabinet, 0.01, 0.012, BLACK, 0.12, 0.17, -0.024, 8).rotation.x =
    Math.PI / 2;
  cylinder(cabinet, 0.012, 0.03, STEEL, 0.12, 0.27, -0.07, 8);
  const bigLamp = bulb(cabinet, 0.04, 0.12, 0.285, -0.07);
  box(cabinet, 0.38, 0.11, 0.1, '#232628', 0, 0.08, 0.06);
  const board = createCanvasTexture(96, 32);
  const g = board.context;
  g.fillStyle = '#2d5e9c';
  g.fillRect(0, 0, 96, 32);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = ['#e9d8a6', '#1c1c1c', '#c9a34a', '#d9d9d2'][i % 4];
    g.fillRect(
      4 + ((i * 17) % 86),
      3 + ((i * 7) % 24),
      3 + (i % 3) * 2,
      2 + (i % 2) * 3,
    );
  }
  board.texture.needsUpdate = true;
  textures.push(board.texture);
  const boardMaterial = createPs1Material({ map: board.texture }, true);
  materials.push(boardMaterial);
  put(
    cabinet,
    new PlaneGeometry(0.22 * m, 0.075 * m),
    boardMaterial,
    -0.06,
    0.08,
    0.111,
  );
  const leds = [0, 1, 2, 3, 4].map((i) => {
    const led = glow(['#ff3b2e', '#3bff6a', '#ffcf3b'][i % 3]);
    box(cabinet, 0.008, 0.008, 0.004, led, -0.15 + i * 0.022, 0.123, 0.112);
    return led;
  });
  for (const [i, x] of [0.09, 0.12, 0.15].entries())
    box(
      cabinet,
      0.022,
      0.03,
      0.01,
      ['#e2c64a', '#d9d6cc', '#2c2c2a'][i],
      x,
      0.085,
      0.113,
    );
  // A sprawl of hook-up wire from the front panel, kept within the base.
  for (let i = 0; i < 5; i++)
    wire(
      cabinet,
      [
        [0.13 + i * 0.008, 0.1, 0.11],
        [0.18, 0.14 + i * 0.01, 0.15],
        [0.215, 0.09 - i * 0.005, 0.12 - i * 0.015],
        [0.205, 0.03, 0.08 - i * 0.02],
      ],
      i % 2 ? '#e8e6de' : '#c995a3',
      0.003,
    );
  wire(
    cabinet,
    [
      [-0.12, 0.345, -0.06],
      [-0.1, 0.42, -0.02],
      [-0.04, 0.42, -0.04],
      [0, 0.345, -0.06],
    ],
    '#a87a3d',
    0.004,
  );
  wire(
    cabinet,
    [
      [0, 0.345, -0.06],
      [0.04, 0.44, -0.1],
      [0.1, 0.43, -0.1],
      [0.12, 0.335, -0.07],
    ],
    '#c995a3',
    0.004,
  );

  const machines = [resonator, solenoid, cabinet];
  // Each machine stands out from the wall facing the room, and a mains
  // lead runs from the back of its base, along the worktop behind it, up
  // to a plug in its trunking socket.
  const backs: [number, number, number][] = [
    [-0.21, 0.06, -0.12],
    [-0.08, 0.06, -0.15],
    [-0.12, 0.06, -0.165],
  ];
  for (const [i, machine] of machines.entries()) {
    const along = layout.along[i];
    machine.position.set(layout.out * m, 0, along * m);
    machine.rotation.y = Math.PI / 2;
    if (!powerLeads) continue;
    // In a machine's frame +x runs north along the bench and -z runs
    // towards the wall.
    const socketX = -(layout.sockets[i] - along);
    const socketZ = layout.socketOut - layout.out;
    const plugDepth = 0.035;
    box(
      machine,
      0.045,
      0.045,
      plugDepth,
      '#e6e0cc',
      socketX,
      layout.socketUp,
      socketZ + plugDepth / 2,
    );
    const [bx, by, bz] = backs[i];
    const { d } = machine.userData.footprint as { d: number };
    // Halfway between the plug and the back of the base.
    const behind = (socketZ + plugDepth - d / 2) / 2;
    wire(
      machine,
      [
        [socketX, layout.socketUp - 0.015, socketZ + plugDepth],
        [socketX, layout.socketUp - 0.07, socketZ + plugDepth + 0.02],
        [socketX * 0.7 + bx * 0.3, 0.01, behind],
        [bx, 0.01, -d / 2 - 0.02],
        [bx, by, bz],
      ],
      FLEX,
      0.004,
    );
  }

  // The valve and the big bulb throw a little warm light on the bench.
  const lamps = (
    [
      [resonator, -0.03, 0.2, 0.08],
      [cabinet, 0.12, 0.34, 0.0],
    ] as const
  ).map(([parent, x, y, z]) => {
    const lamp = new PointLight('#ffb35c', 0, 0.9 * m, 2);
    lamp.position.set(x * m, y * m, z * m);
    parent.add(lamp);
    return lamp;
  });

  const OFF = [0.12, 0.08, 0.05];
  const shine = (
    material: MeshBasicMaterial,
    level: number,
    tint: readonly number[] = [1, 0.7, 0.3],
  ) =>
    material.color.setRGB(
      OFF[0] + (tint[0] - OFF[0]) * level,
      OFF[1] + (tint[1] - OFF[1]) * level,
      OFF[2] + (tint[2] - OFF[2]) * level,
    );
  const ringTint = [0.73, 0.64, 1];
  const ledTints = [
    [1, 0.23, 0.18],
    [0.23, 1, 0.42],
    [1, 0.81, 0.23],
  ];
  const running = [false, false, false];
  const levels = [0, 0, 0];
  let last: number | undefined;
  const climb = (
    ring: Mesh,
    from: number,
    to: number,
    t: number,
    level: number,
  ) => {
    ring.visible = level > 0.05;
    ring.position.y = (from + (to - from) * (((t % 1) + 1) % 1)) * m;
    ring.scale.setScalar(0.9 + 0.2 * level);
    shine(ring.material as MeshBasicMaterial, level, ringTint);
  };
  const update = (seconds: number, reducedMotion: boolean) => {
    const delta = last === undefined ? 0 : Math.min(0.1, seconds - last);
    last = seconds;
    for (let i = 0; i < 3; i++)
      levels[i] +=
        ((running[i] ? 1 : 0) - levels[i]) * Math.min(1, delta * 2.5);
    const flicker = (phase: number) =>
      reducedMotion
        ? 1
        : 0.88 +
          0.08 * Math.sin(seconds * 2.3 + phase) +
          0.04 * Math.sin(seconds * 13.7 + phase * 3);
    const spin = reducedMotion ? 0 : delta;

    // Resonator: the valve warms, the dish sweeps, the gauge hunts.
    const r = levels[0];
    shine(valveHeater, r * flicker(0));
    dish.rotation.y += spin * 1.6 * r;
    gaugeNeedle.rotation.z =
      0.9 - r * (1.2 + (reducedMotion ? 0 : 0.25 * Math.sin(seconds * 3.1)));
    lamps[0].intensity = 1.2 * r * flicker(0);

    // Solenoid: rings climb the coil, the bulbs take turns, the meter
    // swings and the knobs settle at their working marks.
    const s = levels[1];
    const turn = reducedMotion ? 0.5 : Math.sin(seconds * 3.4) > 0 ? 1 : 0.2;
    shine(leftLamp, s * (reducedMotion ? 1 : turn) * flicker(1));
    shine(rightLamp, s * (reducedMotion ? 1 : 1.2 - turn) * flicker(2));
    climb(solenoidRing, 0.17, 0.44, reducedMotion ? 0.5 : seconds * 0.8, s);
    meterNeedle.rotation.z =
      0.9 - s * (0.9 + (reducedMotion ? 0 : 0.5 * Math.sin(seconds * 1.7)));
    for (const [k, knob] of knobs.entries())
      knob.rotation.y = s * (k + 1) * 0.8;

    // Coil cabinet: the big bulb surges, rings climb each stack in turn,
    // the caps spin and the board blinks.
    const c = levels[2];
    const surge = reducedMotion
      ? 1
      : 0.7 + 0.3 * Math.max(0, Math.sin(seconds * 0.9));
    shine(bigLamp, c * surge * flicker(3));
    lamps[1].intensity = 1.6 * c * surge;
    for (const [k, ring] of cabinetRings.entries())
      climb(ring, 0.18, 0.33, reducedMotion ? 0.5 : seconds * 0.6 + k * 0.5, c);
    for (const [k, cap] of caps.entries())
      cap.rotation.y += spin * (k ? -3 : 3) * c;
    for (const [k, led] of leds.entries()) {
      const on = reducedMotion
        ? 1
        : Math.sin(seconds * (2 + k * 1.3) + k) > 0
          ? 1
          : 0;
      shine(led, c * on, ledTints[k % 3]);
    }
  };
  update(0, true);

  return {
    group,
    machines: machines as readonly Group[],
    /** Every mesh of each machine, for clicking. */
    parts: machines.map((machine) => {
      const meshes: Mesh[] = [];
      machine.traverse((object) => {
        if (object instanceof Mesh) meshes.push(object);
      });
      return meshes;
    }),
    /** Every lead's lowest point against the surface beneath it, in metres. */
    leadFloors: leadFloors as readonly { lowest: number; floor: number }[],
    /** Whether each machine is switched on. */
    running: running as readonly boolean[],
    /** Switch a machine on or off; returns whether it is now on. */
    toggle(index: number) {
      running[index] = !running[index];
      return running[index];
    },
    update,
    dispose() {
      for (const machine of machines)
        machine.traverse((object) => {
          if (object instanceof Mesh) object.geometry.dispose();
        });
      for (const item of materials) item.dispose();
      for (const item of textures) item.dispose();
    },
  };
}
