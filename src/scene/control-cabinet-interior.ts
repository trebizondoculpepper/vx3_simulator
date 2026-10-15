import {
  BoxGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Euler,
  Group,
  Matrix4,
  Mesh,
  Quaternion,
  TubeGeometry,
  Vector3,
} from 'three';
import type { BufferGeometry, Material } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createPs1Material } from '../rendering/ps1-material';
import { createMicroLabel } from './eighties-controls';
import type { PanelKit } from './eighties-controls';

/**
 * What is behind the east board's access hatches: the mounting plate of a
 * 1970s industrial control cabinet, purely for looking at. Slotted grey
 * wiring ducts frame each plate; the fittings stand on DIN rails between
 * them; a terminal strip, an earth bar and cable glands take the field
 * wiring in at the foot, some of it laced into a loom in the old way.
 *
 * - **ENERGIE**, the supply: screw-in fuses, the mains contactor and two
 *   smaller ones, a thermal overload relay, an hour meter, a control
 *   transformer, a selenium rectifier stack, smoothing capacitors and a
 *   wire-wound resistor.
 * - **STEUERUNG**, the control logic: a card cage of logic cards with their
 *   lamps, timer relays with dials, plug-in relays under clear covers, and
 *   a pin-matrix programming board.
 *
 * Wire colours follow German practice of the time: black for power, red
 * for the 24 V control circuits, blue for neutral and 0 V, green-yellow for
 * earth. Built in metres for a 0.70 × 0.62 m opening (scaled to fit),
 * centred, with the plate's back at z = 0 and nothing more than 4 cm proud,
 * so the hatch still shuts. Every part of one finish is merged into one
 * mesh, so a whole cabinet is a few draw calls.
 */
export type CabinetInterior = 'ENERGIE' | 'STEUERUNG';

const DESIGN_WIDTH = 0.7;
const DESIGN_HEIGHT = 0.62;
/** The mounting plate's face. */
const PLATE = 0.004;

const WIRE = {
  power: '#1d1d1b',
  control: '#b0261c',
  neutral: '#2a5a9c',
  brown: '#6b4126',
  earthGreen: '#3f8a3a',
  earthYellow: '#d9c23a',
};

export function createCabinetInterior(
  kit: PanelKit,
  kind: CabinetInterior,
  width = DESIGN_WIDTH,
  height = DESIGN_HEIGHT,
) {
  const group = new Group();
  group.name = `${kind}: cabinet interior`;
  group.scale.setScalar(Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT));

  // ---- Building: parts are gathered per finish and merged at the end ----

  const finishes = new Map<string, Material>();
  const parts = new Map<Material, BufferGeometry[]>();
  const finish = (
    colour: string,
    {
      metal = 0,
      lit = false,
      opacity = 1,
    }: { metal?: number; lit?: boolean; opacity?: number } = {},
  ) => {
    const key = `${colour}/${metal}/${lit}/${opacity}`;
    let material = finishes.get(key);
    if (!material) {
      material = createPs1Material(
        {
          color: colour,
          metalness: metal,
          transparent: opacity < 1,
          opacity,
          depthWrite: opacity >= 1,
        },
        lit,
        lit,
      );
      finishes.set(key, material);
      kit.materials.push(material);
    }
    return material;
  };
  const place = (
    geometry: BufferGeometry,
    material: Material,
    x: number,
    y: number,
    z: number,
    rotation?: Euler,
  ) => {
    geometry.applyMatrix4(
      new Matrix4().compose(
        new Vector3(x, y, z),
        new Quaternion().setFromEuler(rotation ?? new Euler()),
        new Vector3(1, 1, 1),
      ),
    );
    const list = parts.get(material) ?? [];
    list.push(geometry);
    parts.set(material, list);
  };
  /** A box standing on the plate (or on `base`), `d` deep. */
  const block = (
    w: number,
    h: number,
    d: number,
    colour: string | Material,
    x: number,
    y: number,
    base = PLATE,
  ) => {
    place(
      new BoxGeometry(w, h, d),
      typeof colour === 'string' ? finish(colour) : colour,
      x,
      y,
      base + d / 2,
    );
    return base + d;
  };
  /** A round part facing out of the plate, its face at `base + d`. */
  const disc = (
    r: number,
    d: number,
    colour: string | Material,
    x: number,
    y: number,
    base = PLATE,
    sides = 10,
  ) =>
    place(
      new CylinderGeometry(r, r, d, sides),
      typeof colour === 'string' ? finish(colour) : colour,
      x,
      y,
      base + d / 2,
      new Euler(Math.PI / 2, 0, 0),
    );
  /** A cylinder lying along x or standing along y. */
  const rod = (
    r: number,
    length: number,
    colour: string | Material,
    x: number,
    y: number,
    z: number,
    along: 'x' | 'y',
    sides = 8,
  ) =>
    place(
      new CylinderGeometry(r, r, length, sides),
      typeof colour === 'string' ? finish(colour) : colour,
      x,
      y,
      z,
      along === 'x' ? new Euler(0, 0, Math.PI / 2) : undefined,
    );
  /** A wire through the given points, as a smooth low tube. */
  const wire = (
    points: [number, number, number][],
    colour: string,
    r = 0.0013,
  ) =>
    place(
      new TubeGeometry(
        new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z))),
        Math.max(4, points.length * 5),
        r,
        4,
      ),
      finish(colour),
      0,
      0,
      0,
    );
  const labels: Mesh[] = [];
  const tag = (
    text: string,
    x: number,
    y: number,
    z: number,
    size = 0.0075,
    plate: string | null = '#ece6cf',
    ink = '#1d211e',
  ) => {
    const made = createMicroLabel(kit, text, { height: size, plate, ink });
    made.position.set(x, y, z + 0.0006);
    labels.push(made);
  };

  // ---- The frame both cabinets share --------------------------------------

  // The galvanised mounting plate.
  block(0.66, 0.6, PLATE, '#8d918a', 0, 0, 0);

  /** A slotted wiring duct with its cover, its fingers at the long sides. */
  const duct = (
    x: number,
    y: number,
    w: number,
    h: number,
    along: 'x' | 'y',
  ) => {
    const top = block(w, h, 0.026, '#9b9e97', x, y);
    block(w + 0.002, h + 0.002, 0.003, '#b3b5ae', x, y, top);
    const length = along === 'x' ? w : h;
    const notch = finish('#4a4d48');
    for (let s = -length / 2 + 0.008; s < length / 2 - 0.004; s += 0.012)
      for (const side of [-1, 1]) {
        const across = (along === 'x' ? h : w) / 2;
        if (along === 'x')
          place(
            new BoxGeometry(0.0035, 0.002, 0.02),
            notch,
            x + s,
            y + side * across,
            PLATE + 0.014,
          );
        else
          place(
            new BoxGeometry(0.002, 0.0035, 0.02),
            notch,
            x + side * across,
            y + s,
            PLATE + 0.014,
          );
      }
  };
  const ductTop = 0.255;
  const ductMiddle = 0.085;
  const ductBottom = -0.155;
  duct(0, ductTop, 0.62, 0.04, 'x');
  duct(0, ductMiddle, 0.54, 0.034, 'x');
  duct(0, ductBottom, 0.54, 0.034, 'x');
  for (const x of [-0.3, 0.3]) duct(x, 0.04, 0.04, 0.39, 'y');

  /** A DIN top-hat rail. */
  const rail = (y: number, from = -0.27, to = 0.27) => {
    block(to - from, 0.035, 0.0035, '#c4c6c0', (from + to) / 2, y);
    block(
      to - from,
      0.025,
      0.004,
      '#d2d4ce',
      (from + to) / 2,
      y,
      PLATE + 0.0035,
    );
  };
  /** A short wire from a fitting's terminal into the nearest duct. */
  const stub = (x: number, from: number, to: number, colour: string) => {
    const bend = (Math.sin(x * 97) * 0.004) as number;
    wire(
      [
        [x, from, 0.026],
        [x + bend, (from * 2 + to) / 3, 0.022],
        [x + bend * 1.5, to, 0.016],
      ],
      colour,
    );
  };
  const rowA = 0.165;
  const rowB = -0.03;
  /** The duct edges each row's wiring runs into. */
  const intoTop = ductTop - 0.02;
  const intoMiddleFromAbove = ductMiddle + 0.017;
  const intoMiddleFromBelow = ductMiddle - 0.017;
  const intoBottom = ductBottom + 0.017;

  // The terminal strip, X1: grey feed-through terminals, blue for the
  // neutral, green-yellow for earth, each with its marker and screws.
  const strip = -0.205;
  rail(strip);
  const pitch = 0.0088;
  const count = 58;
  const first = -((count - 1) * pitch) / 2;
  for (let i = 0; i < count; i++) {
    const x = first + i * pitch;
    const earth = i >= count - 4;
    const neutral = !earth && i % 8 === 7;
    const face = block(
      pitch * 0.86,
      0.046,
      0.028,
      earth ? WIRE.earthGreen : neutral ? '#3d6ea8' : '#aaa99f',
      x,
      strip,
    );
    if (earth)
      block(pitch * 0.88, 0.008, 0.002, WIRE.earthYellow, x, strip, face);
    block(pitch * 0.7, 0.007, 0.002, '#f1eedf', x, strip, face);
    for (const dy of [-0.016, 0.016])
      disc(0.0022, 0.002, '#3c3e3a', x, strip + dy, face, 6);
    // Field wiring below, panel wiring up into the duct.
    stub(
      x,
      strip + 0.023,
      intoBottom - 0.034,
      earth
        ? WIRE.earthGreen
        : neutral
          ? WIRE.neutral
          : kind === 'ENERGIE' && i < 20
            ? WIRE.power
            : WIRE.control,
    );
  }
  tag('X1', -0.29, strip, 0.03, 0.008);

  // The earth bar: copper, with green-yellow leads to it.
  const bar = -0.248;
  block(0.2, 0.012, 0.006, '#b06f3a', -0.15, bar, PLATE + 0.008);
  for (const x of [-0.24, -0.06]) block(0.012, 0.012, 0.008, '#3a3c38', x, bar);
  for (let i = 0; i < 7; i++) {
    const x = -0.225 + i * 0.026;
    disc(0.003, 0.003, '#c9c7bd', x, bar, PLATE + 0.014, 6);
    wire(
      [
        [x, bar, 0.019],
        [x + 0.01, bar + 0.02, 0.024],
        [-0.29 + i * 0.002, ductBottom - 0.01, 0.02],
      ],
      i % 2 ? WIRE.earthGreen : WIRE.earthYellow,
    );
  }
  tag('PE', -0.035, bar, PLATE + 0.012, 0.007, '#d9c23a');

  // The gland plate and the cables coming in from below: thick sheathed
  // cables up to the strip, one of them opened out into a laced loom.
  const gland = -0.284;
  block(0.62, 0.026, 0.01, '#2f3330', 0, gland);
  const entries = [-0.2, -0.08, 0.05, 0.17];
  entries.forEach((x, i) => {
    disc(0.011, 0.012, '#151614', x, gland, PLATE + 0.01, 8);
    disc(0.007, 0.004, '#3b3d39', x, gland, PLATE + 0.022, 8);
    const colour = i === 1 ? '#7d7f78' : '#1b1c1a';
    wire(
      [
        [x, gland - 0.03, 0.02],
        [x, gland, 0.028],
        [x + 0.01, gland + 0.025, 0.03],
        [x + 0.03, strip - 0.03, 0.031],
      ],
      colour,
      0.0055,
    );
  });
  // The loom: a bundle from the left duct down past the earth bar, tied
  // with waxed lacing cord every couple of centimetres.
  const loom: [number, number, number][] = [
    [-0.3, -0.16, 0.024],
    [-0.292, -0.2, 0.031],
    [-0.27, -0.24, 0.032],
    [-0.24, -0.27, 0.03],
  ];
  wire(loom, '#42403a', 0.0065);
  const lacing = new CatmullRomCurve3(
    loom.map(([x, y, z]) => new Vector3(x, y, z)),
  );
  for (let t = 0.08; t < 0.95; t += 0.14) {
    const at = lacing.getPoint(t);
    const along = lacing.getTangent(t);
    place(
      new CylinderGeometry(0.0072, 0.0072, 0.0025, 8),
      finish('#d8cfb0'),
      at.x,
      at.y,
      at.z,
      new Euler().setFromQuaternion(
        new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), along),
      ),
    );
  }

  // Equipment marking and the inspector's sticker.
  tag(
    kind === 'ENERGIE' ? '=E1  ENERGIE / VERSORGUNG' : '=S1  STEUERUNG / LOGIK',
    -0.17,
    0.288,
    PLATE,
    0.011,
    '#ece6cf',
  );
  // On the top duct's cover, where the inspector could reach it.
  const cover = PLATE + 0.029;
  disc(0.016, 0.0008, '#e3c13d', 0.255, ductTop, cover, 14);
  tag('GEPRÜFT\n3/79', 0.255, ductTop, cover + 0.0008, 0.0062, null, '#2a2a22');

  if (kind === 'ENERGIE') {
    // ---- Row A: fuses, contactors, overload relay, hour meter ------------
    rail(rowA);
    // Three screw-in fuse bases, ceramic, with their coloured caps.
    [-0.248, -0.214, -0.18].forEach((x, i) => {
      const face = block(0.03, 0.078, 0.024, '#e4dfcf', x, rowA);
      disc(0.0115, 0.011, '#d6b13a', x, rowA + 0.008, face, 10);
      disc(0.004, 0.002, '#b33a24', x, rowA + 0.008, face + 0.011, 8);
      tag(`F${i + 1}`, x, rowA - 0.03, face, 0.007);
      stub(x, rowA + 0.039, intoTop, WIRE.power);
      stub(x, rowA - 0.039, intoMiddleFromAbove, WIRE.power);
    });
    /** A contactor: grey moulding, black front with its rating plate. */
    const contactor = (x: number, w: number, name: string, coil: string) => {
      const face = block(w, 0.098, 0.03, '#bdb9ac', x, rowA);
      const front = block(
        w * 0.82,
        0.04,
        0.003,
        '#232523',
        x,
        rowA + 0.006,
        face,
      );
      block(w * 0.5, 0.012, 0.0008, '#e9e4d2', x, rowA + 0.012, front);
      block(w * 0.2, 0.008, 0.004, '#3a3c38', x, rowA - 0.01, front);
      for (let p = 0; p < 3; p++) {
        const px = x + (p - 1) * w * 0.3;
        for (const dy of [-0.042, 0.042])
          disc(0.0028, 0.002, '#4b4d48', px, rowA + dy, face, 6);
        stub(px, rowA + 0.049, intoTop, WIRE.power);
        stub(px, rowA - 0.049, intoMiddleFromAbove, WIRE.power);
      }
      stub(x + w * 0.42, rowA + 0.049, intoTop, coil);
      tag(name, x, rowA - 0.03, face, 0.0075);
    };
    contactor(-0.105, 0.078, 'K1 NETZ', WIRE.control);
    contactor(-0.02, 0.054, 'K2 HEIZ.', WIRE.control);
    contactor(0.045, 0.054, 'K3 ANTR.', WIRE.control);
    // The thermal overload relay, with its setting dial and reset button.
    {
      const x = 0.115;
      const face = block(0.05, 0.072, 0.028, '#b7b3a6', x, rowA - 0.01);
      disc(0.009, 0.004, '#2f5d9a', x - 0.008, rowA, face, 10);
      block(
        0.0015,
        0.008,
        0.0012,
        '#eeeeee',
        x - 0.008,
        rowA + 0.003,
        face + 0.004,
      );
      disc(0.0045, 0.006, '#b52a20', x + 0.014, rowA - 0.02, face, 8);
      tag('F4', x, rowA - 0.036, face, 0.007);
      stub(x, rowA - 0.046, intoMiddleFromAbove, WIRE.power);
    }
    // The running-hours meter.
    {
      const x = 0.215;
      const face = block(0.052, 0.052, 0.024, '#1e201e', x, rowA);
      block(0.04, 0.016, 0.001, '#e7e2cf', x, rowA + 0.004, face);
      tag('0 4 7 1 1', x, rowA + 0.004, face + 0.001, 0.009, null, '#1a1a1a');
      tag('h', x, rowA - 0.014, face, 0.007, null, '#e7e2cf');
      tag('P1', x, rowA - 0.04, PLATE, 0.007);
      stub(x - 0.01, rowA + 0.026, intoTop, WIRE.control);
      stub(x + 0.01, rowA + 0.026, intoTop, WIRE.neutral);
    }

    // ---- Row B: transformer, rectifier, capacitors, resistor -------------
    // The control transformer: a laminated iron core, its paper-wrapped
    // coil and a phenolic terminal board on top.
    {
      const x = -0.2;
      const core = block(0.12, 0.1, 0.03, '#3b3d39', x, rowB);
      for (let y = -0.046; y <= 0.046; y += 0.006)
        block(0.12, 0.0012, 0.0006, '#55584f', x, rowB + y, core);
      block(0.07, 0.074, 0.006, '#c9b27a', x, rowB, core);
      block(0.071, 0.012, 0.0062, '#9a8150', x, rowB + 0.016, core);
      const board = block(0.09, 0.016, 0.034, '#5a3a22', x, rowB + 0.058);
      for (let t = 0; t < 4; t++) {
        const tx = x - 0.033 + t * 0.022;
        disc(0.0028, 0.002, '#c9c7bd', tx, rowB + 0.058, board, 6);
        stub(
          tx,
          rowB + 0.066,
          intoMiddleFromBelow,
          t < 2 ? WIRE.power : WIRE.brown,
        );
      }
      for (const dx of [-0.066, 0.066])
        block(0.012, 0.11, 0.004, '#6b6e66', x + dx, rowB);
      tag('T1  380/24 V  250 VA', x, rowB - 0.064, PLATE, 0.0075);
    }
    // The selenium rectifier: a stack of finned plates on a bolt.
    {
      const x = -0.055;
      rod(0.003, 0.1, '#c4c6c0', x, rowB, 0.02, 'x', 6);
      for (let i = 0; i < 9; i++)
        place(
          new BoxGeometry(0.0035, 0.052, 0.032),
          finish(i % 2 ? '#7c3f22' : '#8d4b28'),
          x - 0.04 + i * 0.01,
          rowB,
          PLATE + 0.018,
        );
      for (const dx of [-0.05, 0.05])
        block(0.006, 0.066, 0.03, '#9a9c95', x + dx, rowB);
      tag('V1  GL 24 V', x, rowB - 0.045, PLATE, 0.0075);
      stub(x - 0.045, rowB + 0.033, intoMiddleFromBelow, WIRE.brown);
      stub(x + 0.045, rowB + 0.033, intoMiddleFromBelow, WIRE.control);
    }
    // Smoothing capacitors, standing in their clamps.
    [
      [0.045, 0.016, 0.075, 'C1'],
      [0.088, 0.012, 0.06, 'C2'],
    ].forEach(([x, r, h, name]) => {
      const cx = x as number;
      const radius = r as number;
      rod(radius, h as number, '#55687f', cx, rowB, PLATE + radius, 'y', 10);
      rod(
        radius * 0.9,
        0.004,
        '#c9cbc4',
        cx,
        rowB + (h as number) / 2,
        PLATE + radius,
        'y',
        10,
      );
      block(
        radius * 2.2,
        0.008,
        0.004,
        '#8d908a',
        cx,
        rowB - 0.01,
        PLATE + radius * 2,
      );
      tag(name as string, cx, rowB - (h as number) / 2 - 0.008, PLATE, 0.007);
      stub(
        cx - 0.004,
        rowB + (h as number) / 2,
        intoMiddleFromBelow,
        WIRE.control,
      );
      stub(
        cx + 0.004,
        rowB + (h as number) / 2,
        intoMiddleFromBelow,
        WIRE.neutral,
      );
    });
    // A wire-wound resistor on its brackets.
    {
      const x = 0.19;
      rod(0.009, 0.1, '#d9d0b8', x, rowB + 0.01, 0.02, 'x', 8);
      for (let i = 0; i < 14; i++)
        rod(
          0.0095,
          0.0018,
          '#8a6a3a',
          x - 0.04 + i * 0.006,
          rowB + 0.01,
          0.02,
          'x',
          8,
        );
      rod(0.0096, 0.03, '#3d5a3c', x + 0.03, rowB + 0.01, 0.02, 'x', 8);
      for (const dx of [-0.056, 0.056])
        block(0.006, 0.03, 0.02, '#9a9c95', x + dx, rowB + 0.01);
      tag('R1  2,2 Ω', x, rowB - 0.02, PLATE, 0.0075);
      stub(x - 0.056, rowB + 0.025, intoMiddleFromBelow, WIRE.control);
      // A warning triangle beside it: hot surface.
      tag('⚠ HEISS', x, rowB - 0.072, PLATE, 0.009, '#e3c13d');
    }
  } else {
    // ---- Row A: the logic card cage and the timer relays -----------------
    {
      const left = -0.27;
      const right = 0.07;
      const x = (left + right) / 2;
      const w = right - left;
      block(w, 0.105, 0.004, '#1b1d1b', x, rowA);
      for (const dy of [-0.055, 0.055])
        block(w, 0.01, 0.034, '#c4c6c0', x, rowA + dy);
      for (const dx of [-w / 2, w / 2])
        block(0.006, 0.12, 0.034, '#a5a8a1', x + dx, rowA);
      const cards = 13;
      const step = (w - 0.012) / cards;
      for (let i = 0; i < cards; i++) {
        const cx = left + 0.006 + (i + 0.5) * step;
        // The card's edge, then its front panel and pull handle.
        block(0.0016, 0.094, 0.028, '#2e5a34', cx, rowA, PLATE + 0.004);
        const front = block(
          step * 0.86,
          0.098,
          0.002,
          '#cbc7b6',
          cx,
          rowA,
          PLATE + 0.032,
        );
        block(step * 0.5, 0.008, 0.004, '#1c1d1b', cx, rowA + 0.04, front);
        block(
          step * 0.62,
          0.006,
          0.0008,
          ['#d6b13a', '#3d6ea8', '#3f8a3a'][i % 3],
          cx,
          rowA - 0.04,
          front,
        );
        // Each card's lamp: some lit, as the logic stands.
        const on = [0, 2, 3, 6, 7, 10].includes(i);
        place(
          new CylinderGeometry(0.0022, 0.0022, 0.003, 6),
          finish(on ? '#ff4a2a' : '#4a1712', { lit: on }),
          cx,
          rowA + 0.022,
          front + 0.0015,
          new Euler(Math.PI / 2, 0, 0),
        );
        tag(String(i + 1), cx, rowA - 0.025, front, 0.0065, null, '#26282a');
      }
      tag('A1  LOGIK  24 V', x, rowA - 0.07, PLATE, 0.008);
      for (let i = 0; i < 9; i++)
        stub(
          left + 0.02 + i * 0.035,
          rowA + 0.06,
          intoTop,
          i % 3 ? WIRE.control : WIRE.neutral,
        );
    }
    // Timer relays, each with its time dial.
    [0.105, 0.163, 0.221].forEach((x, i) => {
      rail(rowA, x - 0.026, x + 0.026);
      const face = block(0.048, 0.092, 0.028, '#b0ada0', x, rowA);
      disc(0.016, 0.003, '#efeadb', x, rowA + 0.012, face, 14);
      disc(0.006, 0.005, '#1d1e1c', x, rowA + 0.012, face + 0.003, 8);
      block(
        0.0016,
        0.012,
        0.001,
        '#1d1e1c',
        x,
        rowA + 0.018 + i * 0.001,
        face + 0.008,
      );
      tag(
        ['0,5–5 s', '1–10 s', '3–30 s'][i],
        x,
        rowA - 0.012,
        face,
        0.0065,
        null,
        '#26282a',
      );
      tag(`K${21 + i}`, x, rowA - 0.032, face, 0.0075);
      stub(x - 0.01, rowA + 0.046, intoTop, WIRE.control);
      stub(x + 0.01, rowA - 0.046, intoMiddleFromAbove, WIRE.neutral);
    });

    // ---- Row B: plug-in relays and the pin-matrix board -------------------
    rail(rowB, -0.27, 0.07);
    const cap = finish('#d8cfb4', { opacity: 0.45 });
    for (let i = 0; i < 8; i++) {
      const x = -0.25 + i * 0.04;
      const socket = block(0.036, 0.05, 0.009, '#1a1b19', x, rowB - 0.008);
      // Inside the clear cover: the coil and the contact springs.
      block(0.016, 0.026, 0.016, '#b06a30', x, rowB - 0.004, socket);
      for (const dx of [-0.008, 0, 0.008])
        block(
          0.0015,
          0.03,
          0.002,
          '#d3d0c4',
          x + dx,
          rowB + 0.008,
          socket + 0.017,
        );
      place(new BoxGeometry(0.033, 0.056, 0.026), cap, x, rowB, socket + 0.013);
      tag(`K${11 + i}`, x, rowB - 0.043, PLATE, 0.007);
      stub(x - 0.008, rowB + 0.028, intoMiddleFromBelow, WIRE.control);
      stub(
        x + 0.008,
        rowB - 0.033,
        intoBottom,
        i % 2 ? WIRE.control : WIRE.neutral,
      );
    }
    // The programming board: a grid of sockets, a few pins in place.
    {
      const x = 0.17;
      const face = block(0.13, 0.11, 0.012, '#24262a', x, rowB);
      block(0.12, 0.1, 0.001, '#3a3d42', x, rowB, face);
      const pins: Record<string, string> = {
        '1,0': '#d63a2a',
        '3,1': '#e8e4d6',
        '0,3': '#d6b13a',
        '5,2': '#d63a2a',
        '6,4': '#e8e4d6',
        '2,5': '#d6b13a',
        '7,5': '#d63a2a',
      };
      for (let c = 0; c < 8; c++)
        for (let r = 0; r < 6; r++) {
          const px = x - 0.049 + c * 0.014;
          const py = rowB + 0.036 - r * 0.0145;
          const pin = pins[`${c},${r}`];
          if (pin) disc(0.0028, 0.008, pin, px, py, face + 0.001, 6);
          else block(0.003, 0.003, 0.0006, '#0c0d0e', px, py, face + 0.001);
        }
      tag('STECKTAFEL  S1', x, rowB - 0.064, PLATE, 0.0075);
      stub(x - 0.04, rowB + 0.055, intoMiddleFromBelow, WIRE.control);
      stub(x + 0.04, rowB + 0.055, intoMiddleFromBelow, WIRE.neutral);
    }
  }

  for (const [material, geometries] of parts) {
    const merged = mergeGeometries(geometries);
    for (const geometry of geometries) geometry.dispose();
    if (merged) group.add(new Mesh(merged, material));
  }
  for (const made of labels) group.add(made);
  return group;
}
