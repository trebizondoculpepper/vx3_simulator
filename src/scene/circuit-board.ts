import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  Path,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
} from 'three';
import type { MeshBasicMaterial, MeshStandardMaterial, Object3D } from 'three';
import { signal } from '@preact/signals-core';
import { createPs1Material } from '../rendering/ps1-material';
import { wornPaint } from '../rendering/metal-finish';
import { createPartSoundHub } from '../rendering/part-sound-hub';
import {
  createEightiesButton,
  createMicroLabel,
  createPanelLed,
  createSevenSegment,
  kitGlow,
} from './eighties-controls';
import type { CapColour, PanelKit } from './eighties-controls';
import { createPanelMeter, createRoundGauge } from './panel-instruments';
import { createToggle } from './panel-switchgear';
import { createCanvasTexture } from './screens';
import { createCabinetInterior } from './control-cabinet-interior';
import { createPrintedImageTexture } from './printed-image';
import { coreProjection } from '../game/core-projection';
import { createCoreProjectionAnimation } from './core-projection-animation';
import type { CoreProjection } from '../game/core-projection';
import { FERROCORE_MAX_ANGULAR_VELOCITY } from '../game/ferrocore-anomaly';
import type { Texture } from 'three';
import {
  createLedPushbutton,
  createMomentary,
  createSwitch,
} from '../game/world/components';
import { annunciators } from '../game/control-board';
import { REDLINES } from '../game/redlines';
import type { World } from '../game/world/world';

/**
 * The circuit board: the east board redesigned as one bay per circuit, so
 * an operator can read the installation by its systems.
 *
 * - **ENERGIE**: the supply, from the mains through HAUPTSCHALTER, the
 *   rectifier and the column's three switches to the drive's breaker.
 * - **STEUERUNG**: the drive and its permit, from a sealed, purged,
 *   pressurised and recirculating vessel to the heaters, spindle, field
 *   and core, ending at VOLLBETRIEB.
 * - **XENON**: the gas, from the cylinders through the regulator, the
 *   recirculator and the vessel to the pump.
 *
 * Each bay has, top to bottom: its title; its own alarm windows (the
 * board's eighteen, grouped by circuit); a lit mimic schematic in the 1970s
 * manner, a lamp at each stage lit while that stage is live; its
 * instruments; its few critical controls, every one a component
 * (`src/game/world/components.ts`); and BEREIT and STÖRUNG lamps for the
 * circuit. Everything is read from, and worked through, the world model
 * (`src/game/world/world.ts`). Built in metres, facing +z, standing on the
 * floor at its centre.
 */

interface SchematicNode {
  label: string;
  /** Where on the schematic, 0 to 1 across and down. */
  x: number;
  y: number;
  /** Whether this stage is live. */
  lit: (w: World) => boolean;
  colour?: CapColour;
}

interface Instrument {
  label: string;
  kind: 'gauge' | 'meter' | 'readout';
  /** The reading: a share of full scale, or a readout's text. */
  read: (w: World) => number | string;
  scaleMax?: number;
  redFrom?: number;
  unit?: string;
  band?: { from: number; to: number; colour: string };
  digits?: number;
}

/** The recorder row: the CRT and the pen plotters. */
type Recorder =
  | { kind: 'crt'; label: string }
  | {
      kind: 'plotter';
      label: string;
      /** Its scale, printed under the paper. */
      scale: string;
      /** The pen's position, 0 to 1 across the paper. */
      read: (w: World) => number;
    };

type Control =
  | {
      label: string;
      kind: 'led';
      colour: CapColour;
      /** The world state it shows, and the action that flips it. */
      state: string;
      action: string;
    }
  | { label: string; kind: 'momentary'; colour: CapColour; action: string }
  | { label: string; kind: 'switch'; input: string };

interface BayDesign {
  title: string;
  subtitle: string;
  /** Its alarm windows, by label, and how many to a row. */
  alarms: string[];
  alarmColumns: number;
  nodes: SchematicNode[];
  /** Lines between nodes, by index. */
  links: [number, number][];
  instruments: Instrument[];
  recorders: Recorder[];
  controls: Control[];
}

const r = <T = boolean>(w: World, id: string) => w.read<T>(id);

const BAYS: BayDesign[] = [
  {
    title: 'ENERGIE',
    subtitle: 'VERSORGUNG · ANTRIEB',
    alarms: ['NETZ AUS', 'LAST', 'RAUCH', 'BRAND'],
    alarmColumns: 4,
    nodes: [
      { label: 'NETZ 380 V', x: 0.1, y: 0.25, lit: () => true },
      {
        label: 'HAUPTSCHALTER',
        x: 0.33,
        y: 0.25,
        lit: (w) => r(w, 'plant.master'),
      },
      {
        label: 'GLEICHRICHTER',
        x: 0.58,
        y: 0.25,
        lit: (w) => r(w, 'plant.powered'),
      },
      {
        label: 'TRENNER',
        x: 0.85,
        y: 0.25,
        lit: (w) => r(w, 'plant.powered') && r(w, 'column.isolator'),
      },
      {
        label: 'A11 NETZ',
        x: 0.85,
        y: 0.72,
        lit: (w) =>
          r(w, 'plant.powered') &&
          r(w, 'column.isolator') &&
          r(w, 'column.netz'),
      },
      {
        label: 'B13 SÄULE',
        x: 0.6,
        y: 0.72,
        lit: (w) => r(w, 'column.running'),
      },
      { label: 'SCHÜTZ', x: 0.37, y: 0.72, lit: (w) => r(w, 'drive.mains') },
      {
        label: 'HEIZUNG · ANTRIEB',
        x: 0.12,
        y: 0.72,
        lit: (w) => r(w, 'drive.mains') && r<number>(w, 'rig.heater') > 0.05,
        colour: 'amber',
      },
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
    ],
    instruments: [
      {
        label: 'LEISTUNG',
        kind: 'gauge',
        unit: 'kW',
        scaleMax: 8,
        redFrom: REDLINES.load.limit / 8,
        read: (w) => r<number>(w, 'telltales.powerKw') / 8,
      },
      {
        label: 'ENERGIE kWh',
        kind: 'readout',
        digits: 5,
        read: (w) => r<number>(w, 'telltales.energyKwh').toFixed(1),
      },
    ],
    recorders: [
      {
        kind: 'plotter',
        label: 'LEISTUNG · SCHREIBER',
        scale: '0–8 kW',
        read: (w) => r<number>(w, 'telltales.powerKw') / 8,
      },
    ],
    controls: [
      {
        label: 'NETZ',
        kind: 'led',
        colour: 'red',
        state: 'drive.mains',
        action: 'board.NETZ',
      },
      {
        label: 'NOT-AUS',
        kind: 'momentary',
        colour: 'red',
        action: 'board.NOT-AUS',
      },
      {
        label: 'QUITT',
        kind: 'momentary',
        colour: 'white',
        action: 'board.QUITT',
      },
      {
        label: 'L-TEST',
        kind: 'momentary',
        colour: 'grey',
        action: 'board.L-TEST',
      },
    ],
  },
  {
    title: 'STEUERUNG',
    subtitle: 'FREIGABE · FERROKERN',
    alarms: [
      'ABGAS',
      'SPINDEL ROT',
      'FELD ROT',
      'STÖRUNG',
      'DEHNUNG',
      'INSTAB',
    ],
    alarmColumns: 3,
    nodes: [
      { label: 'DICHT', x: 0.1, y: 0.25, lit: (w) => r(w, 'vessel.sealed') },
      { label: 'O2 = 0', x: 0.3, y: 0.25, lit: (w) => r(w, 'vessel.purged') },
      {
        label: 'XE DRUCK',
        x: 0.5,
        y: 0.25,
        lit: (w) => r<number>(w, 'vessel.xenon') >= 1.2,
      },
      {
        label: 'UMWÄLZUNG',
        x: 0.7,
        y: 0.25,
        lit: (w) => r(w, 'recirculator.working'),
      },
      {
        label: 'FREIGABE',
        x: 0.9,
        y: 0.25,
        lit: (w) => r(w, 'drive.permit'),
        colour: 'amber',
      },
      {
        label: 'HEIZUNG',
        x: 0.9,
        y: 0.72,
        lit: (w) => r<number>(w, 'rig.heater') >= 0.95,
      },
      {
        label: 'SPINDEL',
        x: 0.68,
        y: 0.72,
        lit: (w) => r<number>(w, 'rig.spindle') > 0.2,
      },
      {
        label: 'FELD',
        x: 0.47,
        y: 0.72,
        lit: (w) =>
          r<number>(w, 'rig.field') > 0.2 &&
          r<number>(w, 'rig.instability') < 0.1,
      },
      {
        label: 'KERN VOLL',
        x: 0.29,
        y: 0.72,
        lit: (w) => r<string>(w, 'vessel.stage') === 'full',
        colour: 'amber',
      },
      {
        label: 'VOLLBETRIEB',
        x: 0.11,
        y: 0.72,
        lit: (w) => r(w, 'plant.fullyOperational'),
        colour: 'blue',
      },
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [8, 9],
    ],
    instruments: [
      {
        label: 'SPINDEL',
        kind: 'gauge',
        unit: '×10%',
        scaleMax: 10,
        redFrom: REDLINES.spindle.limit,
        read: (w) => r(w, 'rig.spindle'),
      },
      {
        label: 'FELD',
        kind: 'gauge',
        unit: '×10%',
        scaleMax: 10,
        redFrom: REDLINES.field.limit,
        read: (w) => r(w, 'rig.field'),
      },
      {
        label: 'INSTAB',
        kind: 'meter',
        unit: '',
        scaleMax: 10,
        redFrom: 0.55,
        read: (w) => r(w, 'rig.instability'),
      },
      {
        label: 'KERN K',
        kind: 'readout',
        digits: 4,
        read: (w) => String(Math.round(r<number>(w, 'vessel.temperature'))),
      },
      {
        label: 'TRIMM IST/SOLL',
        kind: 'readout',
        digits: 7,
        read: (w) =>
          `${(r<number>(w, 'drive.trim') * 100).toFixed(0).padStart(3)} ${(r<number>(w, 'drive.idealTrim') * 100).toFixed(0).padStart(3)}`,
      },
    ],
    recorders: [
      { kind: 'crt', label: 'FC · RAUMPROJEKTION' },
      {
        kind: 'plotter',
        label: 'FERROKERN ω',
        scale: '0–4 rad/s',
        read: (w) =>
          r<number>(w, 'ferrocore.omega') / FERROCORE_MAX_ANGULAR_VELOCITY,
      },
    ],
    controls: [
      { label: 'ERDE', kind: 'switch', input: 'drive.gnd' },
      { label: 'DÄMPF.', kind: 'switch', input: 'drive.damp' },
      {
        label: 'RÜCKS.',
        kind: 'momentary',
        colour: 'grey',
        action: 'board.RÜCKS.',
      },
    ],
  },
  {
    title: 'XENON',
    subtitle: 'GASVERSORGUNG · KESSEL',
    alarms: [
      'XE FLUSS',
      'UMWÄLZUNG',
      'XE DRUCK',
      'XE VORRAT',
      'KOPF OFFEN',
      'O2 KESSEL',
      'KERN LUFT',
      'KERN DEFEKT',
    ],
    alarmColumns: 4,
    nodes: [
      {
        label: 'FLASCHEN',
        x: 0.1,
        y: 0.25,
        lit: (w) => r<number>(w, 'xenon.contents') > 0.05,
      },
      {
        label: 'REGLER',
        x: 0.36,
        y: 0.25,
        lit: (w) => r<number>(w, 'xenon.flowSlpm') >= 2,
      },
      {
        label: 'UMWÄLZER',
        x: 0.62,
        y: 0.25,
        lit: (w) => r(w, 'recirculator.working'),
      },
      {
        label: 'PUFFER',
        x: 0.88,
        y: 0.25,
        lit: (w) => r<number>(w, 'vessel.supply') > 6.25,
      },
      {
        label: 'EINLASS',
        x: 0.88,
        y: 0.72,
        lit: (w) => r(w, 'vessel.inletOpen'),
      },
      { label: 'KESSEL', x: 0.62, y: 0.72, lit: (w) => r(w, 'vessel.sealed') },
      {
        label: 'AUSLASS',
        x: 0.36,
        y: 0.72,
        lit: (w) => r(w, 'vessel.outletOpen'),
        colour: 'amber',
      },
      {
        label: 'PUMPE',
        x: 0.1,
        y: 0.72,
        lit: (w) => r(w, 'vessel.outletOpen') && r(w, 'vessel.sealed'),
        colour: 'amber',
      },
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
    ],
    instruments: [
      {
        label: 'KAMMERDRUCK',
        kind: 'gauge',
        unit: 'bar',
        scaleMax: 2.5,
        redFrom: 1.8 / 2.5,
        read: (w) => r<number>(w, 'vessel.pressure') / 2.5,
      },
      {
        label: 'LAMBDA-SONDE',
        kind: 'meter',
        unit: 'V  O2',
        scaleMax: 1,
        band: { from: 0.7, to: 1, colour: '#3f9a4a' },
        read: (w) =>
          r(w, 'column.running') ? r<number>(w, 'vessel.lambdaVolts') : 0,
      },
      {
        label: 'FLUSS',
        kind: 'gauge',
        unit: 'SLPM',
        scaleMax: 10,
        redFrom: 1,
        read: (w) => r<number>(w, 'line.flowSlpm') / 10,
      },
      {
        label: 'PUFFER %',
        kind: 'readout',
        digits: 3,
        read: (w) =>
          String(Math.round((r<number>(w, 'vessel.supply') / 25) * 100)),
      },
    ],
    recorders: [
      {
        kind: 'plotter',
        label: 'KAMMERDRUCK · SCHREIBER',
        scale: '0–2.5 bar',
        read: (w) => r<number>(w, 'vessel.pressure') / 2.5,
      },
    ],
    controls: [
      {
        label: 'SPÜLEN',
        kind: 'led',
        colour: 'amber',
        state: 'vessel.outletOpen',
        action: 'board.SPÜLEN',
      },
    ],
  },
];

const BAY_WIDTH = 0.8;
const BAY_GAP = 0.02;
/** The vertical face runs from the top of the sloping ledge up. */
const PANEL_BOTTOM = 0.98;
/** The ledge: its depth down the slope, and its tilt back from upright. */
const LEDGE_DEPTH = 0.26;
const LEDGE_TILT = Math.PI / 3;
/** Where the lower cabinet's front, and its access hatch, stand. */
const CABINET_FRONT = 0.2;
const PLINTH = 0.09;
const BODY_DEPTH = 0.22;
const PANEL_TOP = 2.34;
const PANEL_GREEN = '#4f5f58';
const CABINET = '#3a4540';

export function createCircuitBoard(
  kit: PanelKit,
  world: () => World,
  {
    log = (() => {}) as (text: string) => void,
    /** Bays whose hatch compartment is left empty, for the room to fill. */
    emptyCompartments = [] as string[],
  } = {},
) {
  const group = new Group();
  const uses = new Map<Object3D, (direction?: number) => void>();
  const compartments = new Map<string, Group>();
  const hatches = new Map<Object3D, () => void>();
  const follow: (() => void)[] = [];
  const updates: ((delta: number) => void)[] = [];
  const hub = createPartSoundHub();
  // Bumped when the world is replaced, so bound components re-read it.
  const generation = signal(0);
  const read = <T>(id: string) => {
    void generation.value;
    return world().read<T>(id);
  };
  const wrecked = () => world().read<string>('fire.phase') === 'extinguished';
  /**
   * During the lamp test every lamp on the board flashes together: what a
   * lamp shows, given what it would show otherwise.
   */
  const lit = (normally: () => boolean) =>
    !wrecked() &&
    (world().read<boolean>('board.testing')
      ? world().read<boolean>('board.testFlash')
      : normally());

  const paint = (colour: string) => {
    const material = wornPaint(
      createPs1Material({ color: colour }) as MeshStandardMaterial,
      colour,
      { aspect: 1.6 },
    );
    kit.materials.push(material);
    return material;
  };
  const panelPaint = paint(PANEL_GREEN);
  const housing = createPs1Material({ color: '#202421' });
  const bezel = createPs1Material({ color: '#1a1d1b', metalness: 0.4 });
  kit.materials.push(housing, bezel);
  // Slotted brass screw heads, shared by every window.
  const brass = createPs1Material({ color: '#b39046', metalness: 0.85 });
  const screwSlotPaint = createPs1Material({ color: '#3a2f1a' });
  kit.materials.push(brass, screwSlotPaint);
  const screwHead = new CylinderGeometry(0.0055, 0.006, 0.003, 16);
  const screwSlot = new BoxGeometry(0.0095, 0.0014, 0.0006);
  /**
   * Dirty frosted glass, lit by a bulb behind it: brightest at the middle,
   * falling off to darker edges and corners, with grime gathered at the
   * rim, smudges and dust specks. It multiplies the window's colour, so it
   * shows lit and dark alike. A few variants, so neighbours differ.
   */
  const glassVariants = new Map<number, Texture>();
  const frostedGlass = (seed: number) => {
    const variant = seed % 5;
    const known = glassVariants.get(variant);
    if (known) return known;
    const w = 160;
    const h = 64;
    const art = createCanvasTexture(w, h);
    kit.textures.push(art.texture);
    let a = (variant + 1) * 7919;
    const random = () => {
      a = (a * 16807) % 2147483647;
      return a / 2147483647;
    };
    const image = art.context.createImageData(w, h);
    const smudges = Array.from({ length: 4 }, () => ({
      x: random() * w,
      y: random() * h,
      r: 6 + random() * 18,
      depth: 0.08 + random() * 0.12,
    }));
    for (let py = 0; py < h; py++)
      for (let px = 0; px < w; px++) {
        // Distance from the bulb, scaled to the window's shape.
        const dx = (px - w / 2) / (w / 2);
        const dy = (py - h / 2) / (h / 2);
        const d = Math.hypot(dx * 0.85, dy);
        let v = 1 - 0.5 * Math.min(1, Math.max(0, (d - 0.25) / 0.9)) ** 1.6;
        // Grime gathered against the frame.
        const rim = Math.min(px, w - 1 - px, py, h - 1 - py);
        if (rim < 6) v -= (6 - rim) * 0.035;
        for (const m of smudges) {
          const sd = Math.hypot(px - m.x, py - m.y) / m.r;
          if (sd < 1) v -= m.depth * (1 - sd * sd);
        }
        v += (random() - 0.5) * 0.05;
        const g = Math.round(Math.max(0, Math.min(1, v)) * 255);
        const i = (py * w + px) * 4;
        image.data[i] = g;
        image.data[i + 1] = g;
        image.data[i + 2] = g;
        image.data[i + 3] = 255;
      }
    // Dust specks.
    for (let k = 0; k < 40; k++) {
      const i = (Math.floor(random() * h) * w + Math.floor(random() * w)) * 4;
      const g = Math.round(image.data[i] * 0.55);
      image.data[i] = image.data[i + 1] = image.data[i + 2] = g;
    }
    art.context.putImageData(image, 0, 0);
    art.texture.needsUpdate = true;
    glassVariants.set(variant, art.texture);
    return art.texture;
  };
  // The CRT's pre-rendered green phosphor projections, loaded once.
  let loaded: Map<CoreProjection, Texture> | null = null;
  const projections = () => {
    loaded ??= new Map(
      (
        [
          'basis',
          'cube',
          'polyhedron',
          'irregular',
          'tesseract',
          'fault',
        ] as CoreProjection[]
      ).map((name) => {
        const texture = createPrintedImageTexture(
          `/screens/criticality/${name}.svg`,
          { width: 256, aspect: 0.75, paper: '#021008' },
        );
        kit.textures.push(texture);
        return [name, texture] as const;
      }),
    );
    return loaded;
  };
  const cabinetPaint = paint(CABINET);
  const add = (
    parent: Object3D,
    w: number,
    h: number,
    d: number,
    material: MeshStandardMaterial | MeshBasicMaterial,
    x: number,
    y: number,
    z: number,
  ) => {
    const mesh = new Mesh(new BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const label = (
    parent: Object3D,
    text: string,
    x: number,
    y: number,
    height: number,
    plate: string | null = null,
    ink = '#ece6d2',
  ) => {
    const made = createMicroLabel(kit, text, { height, ink, plate });
    made.position.set(x, y, 0.004);
    parent.add(made);
    return made;
  };

  const totalWidth = BAYS.length * BAY_WIDTH + (BAYS.length - 1) * BAY_GAP;
  BAYS.forEach((design, b) => {
    const bay = new Group();
    bay.position.x =
      -totalWidth / 2 + BAY_WIDTH / 2 + b * (BAY_WIDTH + BAY_GAP);
    group.add(bay);
    // The 1970s profile: a vertical face, a sloping ledge projecting below
    // it for the controls, and a lower cabinet with an access hatch, on a
    // recessed plinth.
    add(
      bay,
      BAY_WIDTH - 0.04,
      PLINTH,
      BODY_DEPTH + CABINET_FRONT - 0.06,
      cabinetPaint,
      0,
      PLINTH / 2,
      (CABINET_FRONT - BODY_DEPTH) / 2 - 0.03,
    );
    const bodyBottom = PANEL_BOTTOM - LEDGE_DEPTH * Math.cos(LEDGE_TILT);
    add(
      bay,
      BAY_WIDTH,
      PANEL_TOP + 0.02 - bodyBottom,
      BODY_DEPTH,
      panelPaint,
      0,
      (PANEL_TOP + 0.02 + bodyBottom) / 2,
      -BODY_DEPTH / 2,
    );
    // The lower cabinet, up to the ledge's front edge.
    const ledgeFrontY = PANEL_BOTTOM - LEDGE_DEPTH * Math.cos(LEDGE_TILT);
    add(
      bay,
      BAY_WIDTH,
      ledgeFrontY - PLINTH,
      BODY_DEPTH + CABINET_FRONT,
      cabinetPaint,
      0,
      (ledgeFrontY + PLINTH) / 2,
      (CABINET_FRONT - BODY_DEPTH) / 2,
    );
    // The access hatch: a door on the cabinet's front, hinged on its left,
    // with louvres to let the heat out and a latch. A click swings it open
    // on a dark compartment of relays and terminals; another shuts it.
    const hatchPaint = paint('#45564e');
    const hatchH = ledgeFrontY - PLINTH - 0.12;
    const hatchY = PLINTH + 0.05 + hatchH / 2;
    const hatchW = BAY_WIDTH - 0.08;
    // The door stands out in a frame, deep enough for what is behind it.
    const doorZ = CABINET_FRONT + 0.052;
    const hinge = new Group();
    hinge.position.set(-hatchW / 2, hatchY, doorZ);
    bay.add(hinge);
    const onLeaf = (x: number) => x + hatchW / 2;
    const leaf = add(hinge, hatchW, hatchH, 0.014, hatchPaint, onLeaf(0), 0, 0);
    leaf.name = `${design.title}: access hatch`;
    const slot = createPs1Material({ color: '#1c2420' });
    kit.materials.push(slot);
    for (let i = 0; i < 6; i++)
      add(
        hinge,
        0.22,
        0.009,
        0.004,
        slot,
        onLeaf(-0.13),
        hatchH / 2 - 0.08 - i * 0.026,
        0.008,
      );
    const fitting = createPs1Material({ color: '#b9b5a2', metalness: 0.6 });
    kit.materials.push(fitting);
    // The hinges stay on the cabinet; the latch goes with the door.
    for (const dy of [-1, 1])
      add(
        bay,
        0.016,
        0.05,
        0.01,
        fitting,
        -BAY_WIDTH / 2 + 0.05,
        hatchY + dy * (hatchH / 2 - 0.07),
        doorZ + 0.009,
      );
    // The frame round the opening.
    for (const [w, h, x, y] of [
      [hatchW + 0.02, 0.012, 0, hatchY + hatchH / 2 + 0.006],
      [hatchW + 0.02, 0.012, 0, hatchY - hatchH / 2 - 0.006],
      [0.012, hatchH, -hatchW / 2 - 0.004, hatchY],
      [0.012, hatchH, hatchW / 2 + 0.004, hatchY],
    ] as const)
      add(bay, w, h, 0.05, hatchPaint, x, y, CABINET_FRONT + 0.025);
    add(
      hinge,
      0.018,
      0.11,
      0.024,
      fitting,
      onLeaf(BAY_WIDTH / 2 - 0.08),
      0,
      0.013,
    );
    label(
      hinge,
      'ZUGANG NUR FÜR FACHPERSONAL',
      onLeaf(0.12),
      hatchH / 2 - 0.06,
      0.012,
      '#e8e2cc',
      '#1f2622',
    ).position.z = 0.009;
    // Behind it: a dark recess, a DIN rail of relays and a terminal strip.
    const recess = createPs1Material({ color: '#151917' });
    const relayPaint = createPs1Material({ color: '#c9c3ad' });
    const terminalPaint = createPs1Material({ color: '#7a6a3a' });
    kit.materials.push(recess, relayPaint, terminalPaint);
    add(
      bay,
      hatchW - 0.02,
      hatchH - 0.02,
      0.004,
      recess,
      0,
      hatchY,
      CABINET_FRONT + 0.001,
    );
    // The compartment, behind the door: a place to fit things.
    const inside = new Group();
    inside.position.set(0, hatchY, CABINET_FRONT + 0.004);
    bay.add(inside);
    compartments.set(design.title, inside);
    // The supply and control bays show a 1970s cabinet's inner workings.
    if (
      !emptyCompartments.includes(design.title) &&
      (design.title === 'ENERGIE' || design.title === 'STEUERUNG')
    )
      inside.add(
        createCabinetInterior(kit, design.title, hatchW - 0.02, hatchH - 0.02),
      );
    else if (!emptyCompartments.includes(design.title))
      for (const [row, y] of [0.12, -0.05].entries()) {
        add(
          bay,
          hatchW - 0.08,
          0.012,
          0.008,
          fitting,
          0,
          hatchY + y,
          CABINET_FRONT + 0.006,
        );
        for (let k = 0; k < (row ? 12 : 6); k++) {
          const pitch = (hatchW - 0.12) / (row ? 12 : 6);
          add(
            bay,
            pitch * 0.8,
            row ? 0.035 : 0.07,
            0.03,
            row ? terminalPaint : relayPaint,
            -hatchW / 2 + 0.06 + (k + 0.5) * pitch,
            hatchY + y,
            CABINET_FRONT + 0.02,
          );
        }
      }
    const hatch = createSwitch({
      sounds: { transitions: { on: 'door-open', off: 'door-close' } },
    });
    hub.add(hatch, leaf, 'hatch');
    // A cabinet door, not a machine control: a room fitting.
    hatches.set(leaf, () => hatch.flip());
    updates.push((delta) => {
      // Swings outward on its hinges, most of the way round.
      const target = hatch.state.value ? -1.9 : 0;
      hinge.rotation.y += (target - hinge.rotation.y) * Math.min(1, delta * 5);
    });
    // The sloping ledge, from the foot of the face down and out to the
    // cabinet's front. Its controls sit on it, facing up and out.
    const ledge = new Group();
    ledge.position.set(
      0,
      PANEL_BOTTOM - (LEDGE_DEPTH / 2) * Math.cos(LEDGE_TILT),
      (LEDGE_DEPTH / 2) * Math.sin(LEDGE_TILT),
    );
    ledge.rotation.x = -LEDGE_TILT;
    bay.add(ledge);
    add(ledge, BAY_WIDTH, LEDGE_DEPTH, 0.025, panelPaint, 0, 0, -0.0125);
    const trim = createPs1Material({ color: '#2a3530' });
    kit.materials.push(trim);
    add(
      bay,
      BAY_WIDTH,
      0.03,
      0.03,
      trim,
      0,
      ledgeFrontY - 0.012,
      CABINET_FRONT + 0.012,
    );
    const face = new Group();
    face.position.z = 0.0;
    bay.add(face);

    // Title.
    label(face, design.title, 0, PANEL_TOP - 0.06, 0.045, '#e8e2cc', '#1f2622');
    label(face, design.subtitle, 0, PANEL_TOP - 0.11, 0.016);

    // Alarm windows.
    const windowsTop = PANEL_TOP - 0.15;
    const columns = design.alarmColumns;
    const tilePitch = (BAY_WIDTH - 0.08) / columns;
    // The glass, narrower than its pitch to leave room in the bezel for a
    // brass screw either side.
    const tileW = tilePitch - 0.036;
    const tileH = 0.05;
    const windowLit: (() => boolean)[] = [];
    design.alarms.forEach((alarm, i) => {
      const meta = annunciators.find((a) => a.label === alarm)!;
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = -BAY_WIDTH / 2 + 0.04 + (col + 0.5) * tilePitch;
      const y = windowsTop - row * (tileH + 0.012) - tileH / 2;
      // Frosted glass, pale and faintly tinted while dark, so its etched
      // legend can be read; bright when its alarm is lit.
      const off = meta.colour === 'red' ? '#8c7a74' : '#8f8770';
      const on = meta.colour === 'red' ? '#ff5a3c' : '#ffc24a';
      // A dark metal bezel, and the glass set in it.
      add(face, tilePitch - 0.006, tileH + 0.008, 0.008, bezel, x, y, 0.004);
      // A slotted brass screw either side, holding the window in.
      for (const side of [-1, 1]) {
        const head = new Mesh(screwHead, brass);
        head.rotation.x = Math.PI / 2;
        head.position.set(x + side * (tileW / 2 + 0.0088), y, 0.0095);
        face.add(head);
        const slot = new Mesh(screwSlot, screwSlotPaint);
        slot.position.set(head.position.x, y, 0.0112);
        // Each screw was left at whatever angle it stopped turning.
        slot.rotation.z = Math.random() * Math.PI;
        face.add(slot);
      }
      const glass = kitGlow(kit, off);
      glass.map = frostedGlass(i + b * 7);
      glass.needsUpdate = true;
      add(face, tileW, tileH, 0.012, glass, x, y, 0.006);
      label(face, alarm, x, y, 0.011, null, '#1b1712').position.z = 0.0135;
      const lit = () => read<boolean>(`board.window.${alarm}`);
      windowLit.push(lit);
      follow.push(() => glass.color.set(lit() ? on : off));
    });
    const alarmRows = Math.ceil(design.alarms.length / columns);
    const schematicTop = windowsTop - alarmRows * (tileH + 0.012) - 0.03;

    // The mimic schematic: printed lines and boxes, lit lamps on top.
    const sw = BAY_WIDTH - 0.08;
    const sh = 0.36;
    const sy = schematicTop - sh / 2;
    const px = 768;
    const py = Math.round((px * sh) / sw);
    const art = createCanvasTexture(px, py);
    kit.textures.push(art.texture);
    const c = art.context;
    c.fillStyle = '#26332f';
    c.fillRect(0, 0, px, py);
    c.strokeStyle = '#d9d2bb';
    c.lineWidth = 6;
    c.lineJoin = 'round';
    const at = (n: SchematicNode) => [n.x * px, n.y * py] as const;
    for (const [a, z] of design.links) {
      const [x1, y1] = at(design.nodes[a]);
      const [x2, y2] = at(design.nodes[z]);
      c.beginPath();
      c.moveTo(x1, y1);
      // Lines run square, as on a printed mimic.
      if (y1 !== y2 && x1 !== x2) c.lineTo(x1, y2);
      c.lineTo(x2, y2);
      c.stroke();
    }
    c.font = 'bold 20px "Courier New", monospace';
    c.textAlign = 'center';
    c.textBaseline = 'top';
    for (const node of design.nodes) {
      const [x, y] = at(node);
      c.fillStyle = '#1b2421';
      c.strokeStyle = '#d9d2bb';
      c.lineWidth = 3;
      c.fillRect(x - 26, y - 26, 52, 52);
      c.strokeRect(x - 26, y - 26, 52, 52);
      c.fillStyle = '#ece6d2';
      c.fillText(node.label, x, y + 32, 150);
    }
    art.texture.needsUpdate = true;
    const printed = createPs1Material({ map: art.texture }, true);
    kit.materials.push(printed);
    const sheet = new Mesh(new PlaneGeometry(sw, sh), printed);
    sheet.position.set(0, sy, 0.002);
    face.add(sheet);
    for (const node of design.nodes) {
      const lamp = createPanelLed(kit, node.colour ?? 'green');
      lamp.group.scale.setScalar(node.label === 'VOLLBETRIEB' ? 4.5 : 3);
      lamp.group.position.set(
        (node.x - 0.5) * sw,
        sy + (0.5 - node.y) * sh,
        0.003,
      );
      face.add(lamp.group);
      follow.push(() => lamp.set(lit(() => node.lit(world()))));
    }

    // Instruments.
    const instrumentsY = sy - sh / 2 - 0.12;
    const pitch = (BAY_WIDTH - 0.06) / design.instruments.length;
    design.instruments.forEach((inst, i) => {
      const x = -BAY_WIDTH / 2 + 0.03 + (i + 0.5) * pitch;
      if (inst.kind === 'readout') {
        const made = createSevenSegment(kit, inst.digits ?? 4, {
          digitHeight: 0.028,
        });
        made.group.position.set(x, instrumentsY, 0.004);
        face.add(made.group);
        follow.push(() =>
          made.show(wrecked() ? '0' : String(inst.read(world()))),
        );
      } else {
        const made =
          inst.kind === 'gauge'
            ? createRoundGauge(kit, {
                radius: 0.065,
                label: inst.unit ?? '',
                scaleMax: inst.scaleMax ?? 10,
                redFrom: inst.redFrom ?? 0.8,
              })
            : createPanelMeter(kit, inst.unit ?? '', {
                width: 0.15,
                scaleMax: inst.scaleMax ?? 10,
                redFrom: inst.redFrom ?? 0.8,
                band: inst.band ?? null,
              });
        made.group.position.set(x, instrumentsY, 0.004);
        face.add(made.group);
        follow.push(() => made.set(wrecked() ? 0 : Number(inst.read(world()))));
        updates.push(made.update);
      }
      label(face, inst.label, x, instrumentsY - 0.095, 0.014);
    });

    // The recorder row, between the instruments and the ledge.
    const recorderY = PANEL_BOTTOM + 0.2;
    const rpitch = (BAY_WIDTH - 0.06) / design.recorders.length;
    design.recorders.forEach((rec, i) => {
      const x = -BAY_WIDTH / 2 + 0.03 + (i + 0.5) * rpitch;
      if (rec.kind === 'crt') {
        // A green phosphor CRT in a deep black housing, showing the
        // ferrocore's geometry as it heats.
        add(face, 0.32, 0.26, 0.07, housing, x, recorderY + 0.01, 0.035);
        const screen = createPs1Material(
          {
            map: projections().get('basis')!,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
          },
          true,
          true,
        ) as MeshBasicMaterial;
        kit.materials.push(screen);
        // The tube's face bulges out towards its middle, as a CRT's does.
        const sw = 0.26;
        const sh = 0.195;
        const bulge = 0.014;
        const curved = new PlaneGeometry(sw, sh, 26, 20);
        const position = curved.attributes.position;
        for (let v = 0; v < position.count; v++) {
          const nx = position.getX(v) / (sw / 2);
          const ny = position.getY(v) / (sh / 2);
          position.setZ(v, bulge * (1 - (nx * nx + ny * ny) / 2));
        }
        curved.computeVertexNormals();
        const screenZ = 0.068;
        const glass = new Mesh(curved, screen);
        glass.position.set(x, recorderY + 0.015, screenZ);
        face.add(glass);
        // A faint glossy skin on the glass, so the curve catches the light.
        const gloss = createPs1Material({
          color: '#0b1410',
          metalness: 0,
          roughness: 0.08,
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
        });
        kit.materials.push(gloss);
        const skin = new Mesh(curved, gloss);
        skin.position.set(x, recorderY + 0.015, screenZ + 0.0008);
        face.add(skin);
        // The moulded bezel, its opening rounded at the corners, standing
        // just proud of the tube's edges.
        const outer = new Shape();
        outer.moveTo(-0.15, -0.12);
        outer.lineTo(0.15, -0.12);
        outer.lineTo(0.15, 0.12);
        outer.lineTo(-0.15, 0.12);
        outer.closePath();
        const hole = new Path();
        const hw = sw / 2 - 0.004;
        const hh = sh / 2 - 0.004;
        const rad = 0.022;
        hole.moveTo(-hw + rad, -hh);
        hole.lineTo(hw - rad, -hh);
        hole.quadraticCurveTo(hw, -hh, hw, -hh + rad);
        hole.lineTo(hw, hh - rad);
        hole.quadraticCurveTo(hw, hh, hw - rad, hh);
        hole.lineTo(-hw + rad, hh);
        hole.quadraticCurveTo(-hw, hh, -hw, hh - rad);
        hole.lineTo(-hw, -hh + rad);
        hole.quadraticCurveTo(-hw, -hh, -hw + rad, -hh);
        outer.holes.push(hole);
        const frame = new Mesh(new ShapeGeometry(outer, 6), housing);
        frame.position.set(x, recorderY + 0.015, screenZ + bulge * 0.35);
        face.add(frame);
        const animation = createCoreProjectionAnimation();
        kit.textures.push(animation.texture);
        const reducedMotion = window.matchMedia(
          '(prefers-reduced-motion: reduce)',
        );
        let phase = 0;
        let clock = 0;
        updates.push((delta) => {
          glass.visible = !wrecked();
          skin.visible = !wrecked();
          if (wrecked()) return;
          const next = coreProjection(
            read<number>('vessel.temperature'),
            read('vessel.failure') !== null,
          );
          const animate =
            read<boolean>('plant.fullyOperational') &&
            next !== 'fault' &&
            !reducedMotion.matches;
          if (!animate) {
            screen.map = projections().get(next)!;
            clock = 0;
            return;
          }
          phase += delta;
          clock += delta;
          if (clock >= 0.1 || screen.map !== animation.texture) {
            animation.draw(next, phase);
            clock %= 0.1;
          }
          screen.map = animation.texture;
        });
        label(face, rec.label, x, recorderY - 0.145, 0.014);
        return;
      }
      // A pen plotter: cream chart paper feeding down behind a window, a
      // red pen tracing the reading, the newest quarter-second at the top.
      add(face, 0.17, 0.25, 0.05, housing, x, recorderY + 0.01, 0.025);
      const paperW = 96;
      const paperH = 160;
      const chart = createCanvasTexture(paperW, paperH);
      kit.textures.push(chart.texture);
      const samples: number[] = Array(paperH).fill(0);
      const draw = () => {
        const c = chart.context;
        c.fillStyle = '#d8cfae';
        c.fillRect(0, 0, paperW, paperH);
        c.strokeStyle = '#a69b7e';
        c.lineWidth = 1;
        for (let y = 0; y < paperH; y += 10) {
          c.beginPath();
          c.moveTo(0, y);
          c.lineTo(paperW, y);
          c.stroke();
        }
        for (let gx = 8; gx < paperW; gx += 16) {
          c.beginPath();
          c.moveTo(gx, 0);
          c.lineTo(gx, paperH);
          c.stroke();
        }
        c.strokeStyle = '#a3312a';
        c.lineWidth = 2;
        c.beginPath();
        samples.forEach((v, y) => {
          const px = 8 + Math.max(0, Math.min(1, v)) * 80;
          if (y === 0) c.moveTo(px, y);
          else c.lineTo(px, y);
        });
        c.stroke();
        chart.texture.needsUpdate = true;
      };
      draw();
      const printedPaper = createPs1Material({ map: chart.texture }, true);
      kit.materials.push(printedPaper);
      const paper = new Mesh(new PlaneGeometry(0.13, 0.2), printedPaper);
      paper.position.set(x, recorderY + 0.015, 0.0505);
      face.add(paper);
      let clock = 0;
      updates.push((delta) => {
        clock += delta;
        if (clock < 0.25) return;
        clock %= 0.25;
        samples.unshift(wrecked() ? 0 : rec.read(world()));
        samples.length = paperH;
        draw();
      });
      label(face, rec.scale, x, recorderY - 0.105, 0.011);
      label(face, rec.label, x, recorderY - 0.13, 0.014);
    });

    // Controls: few, critical, labelled, each a component, on the ledge.
    const controlsY = -0.02;
    const cpitch = (BAY_WIDTH - 0.24) / Math.max(1, design.controls.length);
    design.controls.forEach((spec, i) => {
      const x = -BAY_WIDTH / 2 + 0.06 + (i + 0.5) * cpitch;
      label(
        ledge,
        spec.label,
        x,
        controlsY + 0.07,
        0.016,
        '#e4dfca',
        '#26302a',
      );
      if (spec.kind === 'switch') {
        const part = createSwitch({
          bound: {
            get value() {
              return read<boolean>(spec.input);
            },
            set: (on) => {
              if (on !== world().read(spec.input)) world().work(spec.input);
            },
          },
        });
        const made = createToggle(kit, part.state.value);
        made.group.scale.setScalar(2.4);
        made.group.position.set(x, controlsY, 0.004);
        made.group.name = `${design.title}: ${spec.label}`;
        ledge.add(made.group);
        hub.add(part, made.group, 'toggle');
        uses.set(made.group, () => part.flip());
        follow.push(() => made.set(part.state.value));
        updates.push(made.update);
        return;
      }
      const latching = spec.kind === 'led';
      const made = createEightiesButton(
        kit,
        spec.label.slice(0, 7),
        spec.colour,
        {
          latching,
          size: 0.05,
        },
      );
      made.group.position.set(x, controlsY, 0.004);
      made.cap.name = `${design.title}: ${spec.label}`;
      ledge.add(made.group);
      if (spec.kind === 'led') {
        const part = createLedPushbutton({
          bound: {
            get value() {
              return read<boolean>(spec.state);
            },
            set: (on) => {
              if (on !== world().read(spec.state) && !world().work(spec.action))
                log(`${spec.label}: refused.`);
            },
          },
        });
        hub.add(part, made.group, 'button', () => made.press());
        uses.set(made.cap, () => part.press());
        follow.push(() => {
          made.lit = !wrecked() && part.state.value;
          made.glow = lit(() => part.lit.value);
        });
      } else {
        const part = createMomentary({
          action: () => {
            if (!world().work(spec.action))
              log(`${spec.label}: nothing to do.`);
          },
        });
        hub.add(part, made.group, 'button', () => made.press());
        uses.set(made.cap, () => part.press());
      }
      updates.push(made.update);
    });

    // The circuit's own status: healthy, or something in it wrong.
    const ready = createPanelLed(kit, 'green');
    const fault = createPanelLed(kit, 'red');
    for (const [lamp, dx, text] of [
      [ready, 0.06, 'BEREIT'],
      [fault, 0.13, 'STÖRUNG'],
    ] as const) {
      lamp.group.scale.setScalar(2.6);
      lamp.group.position.set(
        BAY_WIDTH / 2 - 0.19 + dx,
        controlsY + 0.005,
        0.004,
      );
      ledge.add(lamp.group);
      label(ledge, text, BAY_WIDTH / 2 - 0.19 + dx, controlsY - 0.04, 0.011);
    }
    follow.push(() => {
      const any = windowLit.some((lit) => lit());
      fault.set(lit(() => any));
      ready.set(lit(() => !any));
    });
  });

  return {
    group,
    width: totalWidth,
    /** Every control on the board, and what a click on it does. */
    uses,
    onSound: hub.onSound,
    onHeld: hub.onHeld,
    /** The world was replaced: bound parts read the new one. */
    /**
     * A bay's hatch compartment, centred on its opening and facing out,
     * in metres: about 0.7 wide and 0.55 high, 0.04 deep to the door.
     */
    compartment: (title: string) => compartments.get(title),
    /** The bays' hatch doors, and what a click on each does: fittings. */
    hatches,
    restarted() {
      generation.value++;
    },
    update(delta: number) {
      for (const sync of follow) sync();
      for (const step of updates) step(delta);
    },
    dispose: hub.dispose,
  };
}
