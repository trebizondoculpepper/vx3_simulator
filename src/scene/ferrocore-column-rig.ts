import { stepKnob } from './rotary-knob';
import {
  BackSide,
  Box3,
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  PointLight,
  RingGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import type { Material, MeshStandardMaterial, Object3D } from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { brushedAluminium, wornPaint } from '../rendering/metal-finish';
import { createCanvasTexture } from './screens';
import { createGasVent } from './gas-vent';
import { createSealPuff } from './seal-puff';
import { createSealLeak, createSootBand } from './seal-leak';
import {
  createBarGraph,
  createEightiesButton,
  createMicroLabel,
  createPanelKit,
  createPanelLed,
  createSevenSegment,
  disposeKit,
  kitGlow,
  kitPaint,
} from './eighties-controls';
import type { CapColour, EightiesButtonOptions } from './eighties-controls';
import {
  createBananaJack,
  createBnc,
  createHeatsink,
  createKeyLockedKnob,
  createKeySwitch,
  createPowerIsolator,
  createKeycap,
  createKeypad,
  createKnob,
  createRocker,
  createSlideSwitch,
  createToggle,
} from './panel-switchgear';
import type { KnobStyle } from './panel-switchgear';
import {
  ACTIVATION,
  AMBIENT,
  FULL_BOTTLE,
  FULL_POWER,
  acknowledge,
  chamberPressure,
  createColumnPrep,
  driveLift,
  PURGE_COMPLETE_VOLTS,
  REGULATOR,
  isExposed,
  isSealed,
  isStarved,
  lambdaVolts,
  oxygenPercent,
  setClamped,
  stepColumnPrep,
  stepLift,
} from '../game/column-prep';
import type { ColumnPrepEvent, ColumnPrepState } from '../game/column-prep';
import { REDLINES } from '../game/redlines';
import { createWorld } from '../game/world/world';
import {
  createCharacterLcd,
  createJewelLamp,
  createLedMatrix,
  createPanelMeter,
  createRoundGauge,
  createVfd,
} from './panel-instruments';

/**
 * The second-generation VX3, installed in the lab (and kept in the
 * developer room for building): a full VX3 rebuilt round a
 * vertically mounted ferrocore column, after reference art posted to
 * r/VXJunkies. Two mismatched racks crowd one olive skid: a grey-blue
 * 19-inch rack of controllers, heatsinks and an open bay where the beam
 * tube leaves the chamber, and a tall olive cabinet of instruments and
 * blank panels. Between them the column: a crown of black actuators on a
 * top plate, a flange stack, the ferrocore itself in a lifting frame with
 * two dark stage discs, and the ported chamber below with its viewports.
 *
 * Built at real size in metres with the origin on the floor under the
 * middle of the skid, facing +z. Every panel part is a component from
 * `eighties-controls.ts`, `panel-switchgear.ts` or `panel-instruments.ts`,
 * laid out after the reference. Every control moves when clicked; the
 * head, clamp, valve, supply and NETZ controls work the column's model,
 * and the rest retain their period panel legends for future wiring.
 */

const U = 0.04445;
const STEEL = '#b9bdbd';
const STEEL_DARK = '#8b9091';
const OLIVE = '#737a5e';
const OLIVE_SKID = '#8a8f78';
const BLUE_TRIM = '#4d5b70';
const CREAM = '#dcd8c8';
const LIGHT_GREY = '#c4c4b8';
const PANEL_BLACK = '#1f2124';
const INK = '#2b2a25';
const HAND = '"Marker Felt", "Comic Sans MS", cursive';

/** Something on the rig that a click works. */
export interface RigClickable {
  object: Object3D;
  name: string;
  /** Work it. Knobs and selectors take the click side: -1 left, 1 right. */
  use(direction?: number): void;
  /**
   * The unit it is on, as its number and name ("B11 SÄULE"), or where it is
   * if not in a cabinet; set once the rig is built.
   */
  unit?: string;
}

export interface FerrocoreColumnRig {
  group: Group;
  clickables: RigClickable[];
  /** Whether the concept is shown running; the mains button switches it. */
  readonly running: boolean;
  readonly powerSelections: {
    isolator: boolean;
    mains: boolean;
    cabinet: boolean;
  };
  /**
   * The rig's supply isolator and the plate it is mounted on (on the grey
   * cabinet). An installation may move the isolator elsewhere, such as onto
   * a wall, and drop the plate; it keeps working wherever it is.
   */
  readonly isolator: { switch: Object3D; plate: Object3D };
  /** Panel layout problems: parts too close to each other or to an edge. */
  layoutProblems(partClearance?: number, edgeClearance?: number): string[];
  /** How many parts are fitted to each panel, by panel name. */
  fittedCounts(): Record<string, number>;
  /**
   * The column's model: head, clamps, gas and core. The panel works the
   * head, clamps and valves; the core's activation temperature and
   * brightness are set from outside, by the game's model in the end.
   */
  readonly prep: ColumnPrepState;
  /**
   * Direct control for the developer room's model drive: `hold` freezes the
   * model's physics so values set by hand stay put, and `power` overrides
   * the rig's own mains (null follows the rig).
   */
  readonly drive: { hold: boolean; power: boolean | null };
  update(seconds: number, delta: number, reducedMotion: boolean): void;
  dispose(): void;
}

/** A dial the drive owns: read and set as a share, 0 to 1. */
export interface DriveDial {
  get(): number;
  set(value: number): void;
}

/**
 * How an installation's ferrocore drive is worked from the column's
 * panels. Without it (as in the developer room) those controls move and do
 * nothing else.
 */
export interface ColumnDriveHookup {
  /** DREHZAHL, FELD, TRIMM and UNTERSETZUNG: the drive's dials. */
  dials: Record<'spindle' | 'field' | 'trim' | 'ratio', DriveDial>;
  /** The valve heater switches HT and LT under HV FIL. */
  heaters: { get(id: 'ht' | 'lt'): boolean; flip(id: 'ht' | 'lt'): void };
  /** ZÜND: bring both heater switches in at once. */
  ignite(): void;
  /** SCHWEBUNG, the key-locked insulation band selector: 0, 0.5 or 1. */
  band: DriveDial;
  /** AUS and STRAHL STOP: trip the drive's breaker. */
  trip(source: string): void;
  /** XE-REGLER − and +: step the plant's xenon regulator. */
  regulator(direction: number): void;
}

export interface FerrocoreColumnRigOptions {
  /** Called with a line of text whenever something happens to the column. */
  log?: (text: string) => void;
  /** Called with everything that happens to the column's vessel. */
  onEvent?: (event: ColumnPrepEvent) => void;
  /** The ferrocore drive the column's panels work, if it has one. */
  drive?: ColumnDriveHookup;
  /**
   * Whether the column's own supply switches (its isolator, its NETZ button
   * and the olive cabinet's rocker) start on; they do unless told otherwise.
   */
  switchedOn?: boolean;
  /**
   * Whether the installation's equipment supply is live (in the lab, the
   * plant room's rectifier). Without it the column is dead, whatever its
   * own switches say; left out, it always is.
   */
  supplied?: () => boolean;
  /**
   * Reads the installation's model by vertex id (`src/game/world/world.ts`),
   * for the cabinets' instruments: each shows a quantity of the model.
   * Left out (the developer room's unhooked copy), they idle plausibly.
   */
  read?: (id: string) => unknown;
}

/** The log line for something that happened to the column. */
function describe(event: ColumnPrepEvent): string {
  switch (event.kind) {
    case 'lowered':
      return 'Column: head down. The core is in the chamber.';
    case 'raised':
      return 'Column: head up. The core is out in the room.';
    case 'active':
      return 'Column: core active. It is glowing.';
    case 'full-power':
      return 'Column: core at full power. It has started to spin, which nobody asked it to do.';
    case 'catastrophe':
      return event.cause === 'burnout'
        ? 'Column: core burnout. It was heated in air. The smell will be in the curtains for weeks.'
        : 'Column: flux inductance catastrophe. The bottle ran dry through the open outlet.';
  }
}

/**
 * Every unit in the two cabinets, by its position: the grey cabinet is A
 * and the olive cabinet B, numbered from the top. Each carries its number on
 * the cabinet's upright beside it; units without a title of their own get
 * their name on the panel. Keys are rack name, top unit and half.
 */
const UNITS: Record<
  string,
  { id: string; name: string; title?: boolean; tag?: string }
> = {
  'grey rack@0': { id: 'A1', name: 'KANÄLE' },
  'grey rack@2': { id: 'A2', name: 'FC-STEUERUNG' },
  'grey rack@6': { id: 'A3', name: 'ENDSTUFE' },
  'grey rack@13': { id: 'A4', name: 'SPULEN', title: true },
  'grey rack@15': { id: 'A5', name: 'HV KATODE' },
  'grey rack@18L': { id: 'A6', name: 'VARISTOR', tag: 'A6/7' },
  'grey rack@18R': { id: 'A7', name: 'XE-REGLER' },
  'grey rack@22': { id: 'A8', name: 'STRAHLSTROM' },
  'grey rack@25': { id: 'A9', name: 'STRAHL' },
  'grey rack@34': { id: 'A10', name: 'TIEGELHEIZUNG' },
  'grey rack@37': { id: 'A11', name: 'VERSORGUNG' },
  'olive cabinet@0': { id: 'B1', name: 'KENNUNG' },
  'olive cabinet@1': { id: 'B2', name: 'MESSWERTE', title: true },
  'olive cabinet@3': { id: 'B3', name: 'VERDAMPFER 1' },
  'olive cabinet@6': { id: 'B4', name: 'VERDAMPFER 2' },
  'olive cabinet@9': { id: 'B5', name: 'ANZEIGE', title: true },
  'olive cabinet@11': { id: 'B6', name: 'ANTRIEB', title: true },
  'olive cabinet@15': { id: 'B7', name: 'KAPAZITÄT' },
  'olive cabinet@19': { id: 'B8', name: 'OFFSET', title: true },
  'olive cabinet@21': { id: 'B9', name: 'SCHWEBUNG' },
  'olive cabinet@25': { id: 'B10', name: 'RESERVE', title: true },
  'olive cabinet@28': { id: 'B11', name: 'SÄULE' },
  'olive cabinet@32': { id: 'B12', name: 'KERN' },
  'olive cabinet@35': { id: 'B13', name: 'VERSORGUNG' },
};

/** The log line for a powered control worked with the column dead. */
const NO_SUPPLY = 'Column: no supply. Nothing happens.';

/** Fitted panel parts must be at least this far apart, metres. */
export const PART_CLEARANCE = 0.001;
/** And at least this far from their panel's edge, metres. */
export const EDGE_CLEARANCE = 0.005;

/**
 * The chamber's windows, as [angle round from the front, height, neck
 * radius, neck length] in metres: five small ones in a row high up, the big
 * front viewport, and one low on the left.
 */
const WINDOWS: [number, number, number, number][] = [
  ...[0, 1, 2, 3, 4].map((i): [number, number, number, number] => [
    -1.0 + i * 0.5,
    0.9,
    0.026,
    0.04,
  ]),
  [0, 0.71, 0.06, 0.07],
  [-0.8, 0.6, 0.03, 0.05],
];
const FRONT_WINDOW = 5;
/** A window's clear bore, as a share of its neck's radius. */
const WINDOW_BORE = 0.78;

/** Full scale of the chamber pressure gauges, bar. */
const CHAMBER_GAUGE_BAR = 2.5;

/** How far the rams carry the head between raised and lowered, metres. */
const HEAD_TRAVEL = 0.38;

export function createFerrocoreColumnRig(
  options: FerrocoreColumnRigOptions = {},
): FerrocoreColumnRig {
  const group = new Group();
  group.name = 'FerrocoreColumnRigConcept';
  const kit = createPanelKit();
  const cache = new Map<string, Material>();
  const paint = (color: string, metalness = 0) => {
    const key = `${color}/${metalness}`;
    let material = cache.get(key);
    if (!material) {
      material = kitPaint(kit, color, metalness);
      cache.set(key, material);
    }
    return material;
  };
  const box = (
    parent: Object3D,
    w: number,
    h: number,
    d: number,
    color: string | Material,
    x: number,
    y: number,
    z: number,
    metalness = 0,
  ) => {
    const mesh = new Mesh(
      new BoxGeometry(w, h, d),
      typeof color === 'string' ? paint(color, metalness) : color,
    );
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  /** A cylinder; `axis` is the direction it runs along. */
  const cyl = (
    parent: Object3D,
    r: number,
    h: number,
    color: string | Material,
    x: number,
    y: number,
    z: number,
    {
      axis = 'y' as 'x' | 'y' | 'z',
      bottom = r,
      segments = 16,
      metalness = 0,
    } = {},
  ) => {
    const mesh = new Mesh(
      new CylinderGeometry(r, bottom, h, segments),
      typeof color === 'string' ? paint(color, metalness) : color,
    );
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const tube = (
    parent: Object3D,
    points: [number, number, number][],
    radius: number,
    color: string,
    segments = 48,
  ) => {
    const curve = new CatmullRomCurve3(
      points.map(([x, y, z]) => new Vector3(x, y, z)),
    );
    const mesh = new Mesh(
      new TubeGeometry(curve, segments, radius, 6, false),
      paint(color),
    );
    parent.add(mesh);
    return mesh;
  };

  const clickables: RigClickable[] = [];
  const updates: ((delta: number) => void)[] = [];
  const ticks: ((seconds: number, on: boolean) => void)[] = [];
  let running = true;
  let selectedMains = () => true;
  const switchedOn = options.switchedOn ?? true;
  const supply = createPowerIsolator(kit, { on: switchedOn });
  let isolatorPlate: Object3D = supply.group;
  const prep = createColumnPrep();
  const drive: { hold: boolean; power: boolean | null } = {
    hold: false,
    power: null,
  };
  const log = options.log ?? (() => {});
  const hookup = options.drive;
  // The olive cabinet's own NETZ rocker is in the rig's supply too.
  let cabinetMains = switchedOn;
  let motion = 1;
  // Every reading comes from the model. Without one (the developer
  // room's unhooked copy), a lab of its own that stays cold, so its
  // instruments read what a switched-off installation would.
  const coldWorld = options.read ? null : createWorld();
  const model = options.read ?? ((id: string) => coldWorld!.read(id));
  /** A number from the model. */
  const num = (id: string) => Number(model(id) ?? 0);
  /** Whether any of the east board's alarm windows named is lit. */
  const alarmed = (...windows: string[]) =>
    windows.some((w) => Boolean(model(`alarm.${w}`)));
  /** The hottest the drive's devices have got, 0 to 1. */
  const hottest = () =>
    Math.max(
      ...Object.values(
        (model('overheat') as { heat: Record<string, number> }).heat,
      ),
    );
  /** A control that a click works, and that moves as it eases. */
  const worked = (
    object: Object3D,
    name: string,
    use: (direction?: number) => void,
    update: (delta: number) => void,
  ) => {
    clickables.push({ object, name, use });
    updates.push(update);
  };

  /** Rename the control just fitted to `parent` under `was`, by its role. */
  const named = (parent: Object3D, was: string, name: string) => {
    for (let i = clickables.length - 1; i >= 0; i--) {
      const c = clickables[i];
      let o: Object3D | null = c.object;
      while (o && o !== parent) o = o.parent;
      if (o && c.name === was) {
        c.name = name;
        return;
      }
    }
  };

  // ---- Placing parts on a panel -------------------------------------------
  /** Every part fitted to a panel, for the layout audit. */
  const fitted = (parent: Object3D, part: Object3D) =>
    (parent.userData.parts as Object3D[] | undefined)?.push(part);
  const place = (parent: Object3D, part: Object3D, x: number, y: number) => {
    part.position.set(x, y, 0);
    parent.add(part);
    fitted(parent, part);
    return part;
  };
  const label = (
    parent: Object3D,
    intended: string,
    x: number,
    y: number,
    {
      height = 0.0032,
      ink = '#f1ecdc',
      plate = null as string | null,
      tilt = 0,
      font = undefined as string | undefined,
      bold = true,
    } = {},
  ) => {
    const mesh = createMicroLabel(kit, intended, {
      height,
      ink,
      plate,
      font,
      bold,
    });
    mesh.name = `Label: ${intended}`;
    mesh.userData.legend = intended;
    // Print ahead of the 2 mm retrofit/title strips as well as bare metal.
    mesh.position.set(x, y, 0.0025);
    mesh.rotation.z = tilt;
    parent.add(mesh);
    fitted(parent, mesh);
    return mesh;
  };
  /** Black Dymo tape with raised white capitals, stuck on slightly askew. */
  const dymo = (parent: Object3D, intended: string, x: number, y: number) =>
    label(parent, intended, x, y, {
      height: 0.0038,
      plate: '#121212',
      ink: '#f4f4f0',
      tilt: Math.sin(x * 97 + y * 41) * 0.03,
    });
  const button = (
    parent: Object3D,
    legend: string,
    colour: CapColour,
    x: number,
    y: number,
    options: EightiesButtonOptions = {},
    onPress?: () => void,
  ) => {
    const made = createEightiesButton(kit, legend, colour, options);
    place(parent, made.group, x, y);
    worked(
      made.cap,
      `${legend} button`,
      () => {
        made.press();
        onPress?.();
      },
      made.update,
    );
    return made;
  };
  const key = (
    parent: Object3D,
    legend: string,
    x: number,
    y: number,
    options: {
      width?: number;
      height?: number;
      colour?: string;
      ink?: string;
    } = {},
  ) => {
    const made = createKeycap(kit, legend, options);
    place(parent, made.group, x, y);
    worked(made.cap, `${legend} key`, made.press, made.update);
    return made;
  };
  const keypad = (
    parent: Object3D,
    rows: string[][],
    x: number,
    y: number,
    options: Parameters<typeof createKeypad>[2] = {},
  ) => {
    const made = createKeypad(kit, rows, options);
    place(parent, made.group, x, y);
    for (const k of made.keys) worked(k.cap, k.cap.name, k.press, k.update);
    return made;
  };
  const led = (
    parent: Object3D,
    colour: CapColour,
    x: number,
    y: number,
    period = 0,
    phase = 0,
    /** What lights it, beyond the cabinet having power. */
    when: () => boolean = () => true,
  ) => {
    const made = createPanelLed(kit, colour, true);
    place(parent, made.group, x, y);
    ticks.push((seconds, on) =>
      made.set(
        on &&
          when() &&
          (period === 0 ||
            motion === 0 ||
            Math.sin((seconds / period + phase) * Math.PI * 2) > 0),
      ),
    );
    return made;
  };
  const lamp = (
    parent: Object3D,
    colour: string,
    x: number,
    y: number,
    period = 0,
    /** What lights it, beyond the cabinet having power. */
    when: () => boolean = () => true,
  ) => {
    const made = createJewelLamp(kit, colour);
    place(parent, made.group, x, y);
    ticks.push((seconds, on) =>
      made.set(
        on &&
          when() &&
          (period === 0 ||
            motion === 0 ||
            Math.sin((seconds / period) * Math.PI * 2) > 0),
      ),
    );
    return made;
  };
  const knob = (
    parent: Object3D,
    x: number,
    y: number,
    radius = 0.009,
    style: KnobStyle = 'collet',
    scale = false,
    ink = '#f1ecdc',
    /** A dial of the drive this knob works, and its name; else decorative. */
    dial?: DriveDial,
    name = 'knob',
  ) => {
    // Pointer selectors click between six positions; the rest turn freely.
    const steps = style === 'pointer' ? 5 : dial ? 20 : 10;
    let value = dial
      ? dial.get()
      : Math.round((0.5 + Math.sin(x * 53 + y * 29) * 0.35) * steps) / steps;
    const made = createKnob(kit, { radius, style, scale, ink, value });
    place(parent, made.group, x, y);
    worked(
      made.group,
      name,
      (direction = 1) => {
        value = stepKnob(dial ? dial.get() : value, direction, steps);
        dial?.set(value);
        made.set(value);
      },
      (delta) => {
        if (dial) made.set(dial.get());
        made.update(delta);
      },
    );
    return made;
  };
  const toggle = (
    parent: Object3D,
    x: number,
    y: number,
    up = true,
    /** A switch of the drive this toggle works, and its name. */
    bound?: { get(): boolean; flip(): void; name: string },
  ) => {
    const made = createToggle(kit, bound ? bound.get() : up);
    place(parent, made.group, x, y);
    let state = up;
    worked(
      made.group,
      bound?.name ?? 'toggle',
      () => {
        if (bound) bound.flip();
        else state = !state;
        made.set(bound ? bound.get() : state);
      },
      (delta) => {
        if (bound) made.set(bound.get());
        made.update(delta);
      },
    );
    return made;
  };
  const slide = (parent: Object3D, x: number, y: number, at = 0) => {
    const made = createSlideSwitch(kit, 2, at);
    place(parent, made.group, x, y);
    let state = at;
    worked(
      made.group,
      'slide switch',
      () => {
        state = 1 - state;
        made.set(state);
      },
      made.update,
    );
  };
  const bnc = (parent: Object3D, x: number, y: number) =>
    place(parent, createBnc(kit).group, x, y);
  const banana = (parent: Object3D, x: number, y: number, colour?: string) =>
    place(parent, createBananaJack(kit, colour).group, x, y);
  const seg = (
    parent: Object3D,
    digits: number,
    x: number,
    y: number,
    value: (seconds: number) => string,
    digitHeight = 0.011,
    colour?: string,
  ) => {
    const made = createSevenSegment(kit, digits, { digitHeight, colour });
    place(parent, made.group, x, y);
    ticks.push((seconds, on) => made.show(on ? value(seconds) : ''));
    return made;
  };
  const bars = (
    parent: Object3D,
    x: number,
    y: number,
    /** What it shows, 0 to 1. */
    value: () => number,
  ) => {
    const made = createBarGraph(kit, 10, { pitch: 0.0042, width: 0.007 });
    place(parent, made.group, x, y);
    ticks.push((_, on) => made.set(on ? value() : 0));
    return made;
  };
  const meter = (
    parent: Object3D,
    unit: string,
    x: number,
    y: number,
    width: number,
    reading: (seconds: number) => number,
  ) => {
    const made = createPanelMeter(kit, unit, { width });
    place(parent, made.group, x, y);
    ticks.push((seconds, on) => made.set(on ? reading(seconds) : 0));
    updates.push(made.update);
    return made;
  };
  const screws = (parent: Object3D, w: number, h: number) => {
    for (const sx of [-1, 1])
      for (const sy of h > 2.5 * U ? [-1, 1] : [0])
        cyl(
          parent,
          0.0032,
          0.002,
          '#a9adad',
          sx * (w / 2 - 0.008),
          sy * (h / 2 - 0.012),
          0.001,
          { axis: 'z', segments: 8, metalness: 0.6 },
        );
  };
  const handles = (parent: Object3D, w: number, h: number) => {
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - 0.022);
      box(parent, 0.008, h * 0.7, 0.008, '#c3c6c6', x, 0, 0.03, 0.5);
      for (const sy of [-1, 1])
        box(
          parent,
          0.008,
          0.008,
          0.03,
          '#c3c6c6',
          x,
          sy * h * 0.35,
          0.015,
          0.5,
        );
    }
  };
  const vents = (
    parent: Object3D,
    x: number,
    y: number,
    w: number,
    rows: number,
  ) => {
    for (let i = 0; i < rows; i++)
      box(
        parent,
        w,
        0.0025,
        0.001,
        '#0d0d0e',
        x,
        y + (i - (rows - 1) / 2) * 0.006,
        0.0006,
      );
  };
  const divider = (
    parent: Object3D,
    x: number,
    h: number,
    colour = '#8f8d82',
  ) => box(parent, 0.0018, h, 0.0016, colour, x, 0, 0.0008);

  interface Rack {
    name: string;
    group: Group;
    top: number;
    width: number;
    frontZ: number;
    /** Where unit numbers go: the front of the cabinet's left upright. */
    upright: { x: number; z: number };
  }
  const panels: { group: Group; w: number; h: number }[] = [];
  /** A front panel `units` high whose top edge is `fromTop` units down the rack. */
  const panel = (
    rack: Rack,
    fromTop: number,
    units: number,
    color: string,
    width = rack.width,
    offsetX = 0,
  ) => {
    const h = units * U - 0.0012;
    const p = new Group();
    p.position.set(
      offsetX,
      rack.top - (fromTop + units / 2) * U,
      rack.frontZ + 0.003,
    );
    rack.group.add(p);
    box(p, width, h, 0.004, color, 0, 0, -0.002);
    screws(p, width, h);
    p.userData.parts = [];
    const side = offsetX < 0 ? ' left half' : offsetX > 0 ? ' right half' : '';
    p.name = `${rack.name} U${fromTop}–${fromTop + units}${side}`;
    panels.push({ group: p, w: width, h });
    const unit =
      UNITS[
        `${rack.name}@${fromTop}${offsetX < 0 ? 'L' : offsetX > 0 ? 'R' : ''}`
      ];
    if (unit) {
      p.userData.unit = `${unit.id} ${unit.name}`;
      // Its number on the cabinet's left upright (the left half's only).
      if (offsetX <= 0) {
        const tag = createMicroLabel(kit, unit.tag ?? unit.id, {
          height: unit.tag ? 0.009 : 0.012,
          plate: '#e8e4d4',
          ink: '#1d1f22',
        });
        tag.position.set(
          rack.upright.x,
          rack.top - (fromTop + units / 2) * U,
          rack.upright.z,
        );
        rack.group.add(tag);
      }
      if (unit.title)
        label(p, unit.name, -width / 2 + 0.045, h / 2 - 0.0095, {
          height: 0.0036,
          plate: '#2b2d31',
          ink: '#e8e4d4',
        });
    }
    return { group: p, w: width, h };
  };

  // ---- The skid ------------------------------------------------------------
  const skidTop = 0.14;
  const skidX = 0.03;
  box(
    group,
    2.06,
    skidTop - 0.02,
    0.88,
    OLIVE_SKID,
    skidX,
    (skidTop + 0.02) / 2,
    0,
  );
  box(group, 2.02, 0.02, 0.84, '#4a4d40', skidX, 0.01, 0);
  for (const x of [-0.94, 1.0]) {
    // Lifting lugs at the front corners.
    box(group, 0.07, 0.05, 0.03, '#d4d6d2', x, 0.07, 0.45);
    box(group, 0.05, 0.02, 0.035, '#9da09c', x, 0.1, 0.46);
  }

  /**
   * The cabinets' sheet steel: in the realistic style, rough matt paint,
   * worn at its edges and corners by decades of use. `aspect` is the
   * height over the width of the faces, so the wear sits on their edges.
   */
  const worn = (colour: string, aspect = 1) => {
    const material = wornPaint(
      createPs1Material({ color: colour }) as MeshStandardMaterial,
      colour,
      { aspect },
    );
    kit.materials.push(material);
    return material;
  };
  const greySide = worn('#a6a9a7', 2.5);
  const blueTrim = worn(BLUE_TRIM);
  const blueUpright = worn(BLUE_TRIM, 6);
  const back = worn('#1a1b1d', 3.5);
  const oliveSide = worn(OLIVE, 2.5);
  const oliveTrim = worn(OLIVE);

  // ---- Left rack: grey-blue 19-inch ---------------------------------------
  const left: Rack = {
    name: 'grey rack',
    group: new Group(),
    top: 1.95,
    width: 0.483,
    frontZ: 0.33,
    upright: { x: -0.262, z: 0.3505 },
  };
  left.group.position.set(-0.66, 0, -0.02);
  group.add(left.group);
  {
    const g = left.group;
    const H = 1.84;
    const y = skidTop + H / 2;
    for (const sx of [-1, 1]) {
      box(g, 0.025, H, 0.7, greySide, sx * 0.29, y, 0);
      box(g, 0.04, H, 0.03, blueUpright, sx * 0.262, y, 0.335);
    }
    box(g, 0.6, 0.03, 0.72, blueTrim, 0, skidTop + H - 0.015, 0);
    box(g, 0.6, 0.03, 0.72, blueTrim, 0, skidTop + 0.015, 0);
    box(g, 0.56, H, 0.02, back, 0, y, -0.34);
    // The rig's own supply isolator, on a plate over the front of the left
    // upright near the top, where it can be reached from the aisle: OFF
    // darkens everything whatever the NETZ button says.
    isolatorPlate = box(g, 0.13, 0.19, 0.01, '#8f9483', -0.31, 1.76, 0.355);
    supply.group.position.set(-0.31, 1.76, 0.36);
    g.add(supply.group);
    worked(supply.group, 'supply isolator', supply.toggle, supply.update);
  }
  {
    // 2U: a strip of eight small channel modules, each with a slide
    // switch, a push button with a green LED and a fault LED.
    const p = panel(left, 0, 2, CREAM);
    // Each channel watches one circuit; its STÖR LED flashes while any of
    // that circuit's alarm windows on the east board is lit.
    const channels: [string, string[]][] = [
      ['NETZ', ['NETZ AUS']],
      ['ABGAS', ['ABGAS']],
      ['SPINDEL', ['SPINDEL ROT']],
      ['FELD', ['FELD ROT']],
      ['LAST', ['LAST']],
      ['XENON', ['XE FLUSS', 'XE DRUCK', 'XE VORRAT']],
      ['KESSEL', ['KOPF OFFEN', 'O2 KESSEL']],
      ['KERN', ['KERN LUFT', 'KERN DEFEKT']],
    ];
    for (let i = 0; i < 8; i++) {
      const x = -0.205 + i * 0.0585;
      if (i > 0)
        box(
          p.group,
          0.0015,
          p.h * 0.92,
          0.0012,
          '#a19e90',
          x - 0.029,
          0,
          0.0006,
        );
      label(p.group, channels[i][0], x, 0.031, { height: 0.0022, ink: INK });
      slide(p.group, x - 0.016, -0.006, i % 3 === 0 ? 1 : 0);
      button(p.group, 'FREI', 'grey', x + 0.006, -0.006, {
        size: 0.015,
        led: 'green',
        lit: i % 3 !== 1,
      });
      led(p.group, 'red', x + 0.02, 0.016, 0.7, i * 0.13, () =>
        alarmed(...channels[i][1]),
      );
      label(p.group, 'H/A', x - 0.016, -0.027, { height: 0.0016, ink: INK });
      label(p.group, 'STÖR', x + 0.02, 0.027, { height: 0.0014, ink: INK });
    }
  }
  {
    // 4U: the column controller: a grey title band, an LCD with four
    // function keys under it, a keypad and a key switch.
    const p = panel(left, 2, 4, '#2c2f35');
    // A printed title strip, kept clear of the panel's edges like the rest.
    const strip = p.h / 2 - EDGE_CLEARANCE - 0.01;
    box(
      p.group,
      p.w - 2 * EDGE_CLEARANCE,
      0.02,
      0.002,
      '#b8b9b4',
      0,
      strip,
      0.0005,
    );
    label(p.group, 'NEUMANN DYNAMIK', -0.16, strip, {
      height: 0.0042,
      ink: '#1d3b6b',
    });
    label(p.group, 'FC-STEUERUNG 86', 0.17, strip, {
      height: 0.003,
      ink: INK,
    });
    const lcd = createCharacterLcd(kit, { columns: 16, rows: 2, cell: 0.0034 });
    place(p.group, lcd.group, -0.115, 0.018);
    ticks.push((_, on) =>
      lcd.show(
        // The field's trim: where it balances, where TRIMM has it, and the
        // drive's delta, OK while the trim matches.
        [
          `SOLL${num('drive.idealTrim').toFixed(2)} IST${num('drive.trim').toFixed(2)}`,
          `DELTA ${num('drive.delta').toFixed(3)} ${num('board.trimMatch') >= 0.8 ? 'OK' : 'ABW'}`,
        ],
        on,
      ),
    );
    for (let i = 0; i < 4; i++)
      key(p.group, `F${i + 1}`, -0.16 + i * 0.03, -0.034, {
        width: 0.02,
        height: 0.01,
        colour: '#8c9097',
        ink: '#f2f2ee',
      });
    keypad(
      p.group,
      [
        ['7', '8', '9', 'CL'],
        ['4', '5', '6', '▲'],
        ['1', '2', '3', '▼'],
        ['0', '.', '−', 'ENT'],
      ],
      0.085,
      -0.004,
      {
        pitch: 0.018,
        width: 0.0145,
        height: 0.0125,
        accents: {
          CL: '#c8574a',
          ENT: '#76a36e',
          '▲': '#a9bccb',
          '▼': '#a9bccb',
        },
      },
    );
    const lock = createKeySwitch(kit, true);
    place(p.group, lock.group, 0.2, -0.008);
    let locked = true;
    worked(
      lock.group,
      'key switch',
      () => {
        locked = !locked;
        lock.set(locked);
      },
      lock.update,
    );
    label(p.group, '0  I', 0.2, 0.017, { height: 0.0026 });
    label(p.group, 'BEDIENUNG', 0.2, -0.032, { height: 0.0022 });
  }
  {
    // 7U: power amplifier with two big finned heatsinks.
    const p = panel(left, 6, 7, '#29292b');
    handles(p.group, p.w, p.h);
    for (const sx of [-1, 1])
      place(
        p.group,
        createHeatsink(kit, 0.18, p.h * 0.9, { fins: 15 }).group,
        sx * 0.105,
        0,
      );
    dymo(p.group, 'ENDSTUFE FC', 0, p.h / 2 - 0.02);
    // The amplifier drives the H-B field: BETRIEB while it does.
    lamp(
      p.group,
      '#ffb43a',
      0,
      -0.05,
      0,
      () => Boolean(model('drive.mains')) && num('rig.field') > 0.02,
    );
    label(p.group, 'BETRIEB', 0, -0.066, { height: 0.0022 });
  }
  {
    // 2U: cream utility panel; the blue patch lead leaves from a BNC.
    const p = panel(left, 13, 2, CREAM);
    label(p.group, 'SPULE 1 2 3', -0.164, 0.026, { height: 0.0024, ink: INK });
    for (let i = 0; i < 3; i++)
      toggle(p.group, -0.19 + i * 0.026, -0.004, i !== 1);
    divider(p.group, -0.125, p.h * 0.8);
    for (let i = 0; i < 4; i++) {
      bnc(p.group, -0.08 + i * 0.032, -0.004);
      label(p.group, ['X', 'Y', 'Z', 'TRIG'][i], -0.08 + i * 0.032, 0.022, {
        height: 0.0018,
        ink: INK,
      });
    }
    banana(p.group, 0.075, 0.006, '#c62a1e');
    banana(p.group, 0.075, -0.012, '#1a1a1a');
    divider(p.group, 0.105, p.h * 0.8);
    button(p.group, 'TEST', 'white', 0.17, -0.002, { latching: false });
    // Lit while the field coils carry current.
    led(p.group, 'green', 0.2, -0.002, 0, 0, () => num('rig.field') > 0.02);
    label(p.group, 'STROM', 0.2, 0.018, { height: 0.0018, ink: INK });
    tube(
      left.group,
      [
        // From the X input down the rack front, then back into the open bay
        // to the measuring port beside the purge outlet (MESSSTUTZEN).
        [0.016, left.top - 14.1 * U, left.frontZ + 0.02],
        [0.03, left.top - 17 * U, left.frontZ + 0.07],
        [0.05, 0.7, left.frontZ + 0.1],
        [0.04, 0.58, left.frontZ + 0.09],
        [-0.02, 0.55, left.frontZ + 0.03],
        [-0.06, 0.55, 0.22],
        [-0.08, 0.565, 0.185],
        [-0.08, 0.565, 0.172],
      ],
      0.0035,
      '#2f5fb8',
      80,
    );
  }
  {
    // 3U: two plug-in modules: three scaled trimmers, and the cathode
    // supply with its readout.
    const p = panel(left, 15, 3, PANEL_BLACK);
    divider(p.group, -0.02, p.h, '#55575c');
    for (let i = 0; i < 3; i++) {
      knob(p.group, -0.19 + i * 0.058, 0.006, 0.0085, 'skirted', true);
      label(p.group, ['GRUND', 'FEIN', 'ABGL.'][i], -0.19 + i * 0.058, -0.03, {
        height: 0.0022,
      });
    }
    label(p.group, 'HV KATODE', 0.04, 0.045, {
      height: 0.003,
      plate: '#8a1f1a',
    });
    seg(
      p.group,
      4,
      0.06,
      0.008,
      // The valve heaters' cathode supply: 2.50 kV when they are warm.
      () => (num('rig.heater') * 2.5).toFixed(2).replace('.', ''),
      0.012,
    );
    knob(p.group, 0.17, 0.004, 0.012, 'instrument', true);
    label(p.group, 'SPANNUNG', 0.17, -0.032, { height: 0.0022 });
    label(p.group, 'IST kV', 0.06, -0.025, { height: 0.0022 });
  }
  {
    // 4U: a black display unit and a cream regulator side by side.
    const half = left.width / 2;
    const a = panel(left, 18, 4, '#232527', half, -half / 2);
    const vfd = createVfd(kit, { columns: 9, height: 0.011 });
    place(a.group, vfd.group, 0, 0.026);
    ticks.push((_, on) =>
      vfd.show([`${(num('rig.field') * 44).toFixed(3)} MH`], on),
    );
    label(a.group, 'VARISTOR', -0.07, 0.048, { height: 0.0024 });
    // What the display reads: the H-B field coils' inductance.
    label(a.group, 'FELD-INDUKTIVITÄT', 0, 0.007, { height: 0.0018 });
    for (let i = 0; i < 4; i++)
      button(
        a.group,
        ['BER', 'AUTO', 'HOLD', 'NULL'][i],
        'grey',
        -0.066 + i * 0.044,
        -0.022,
        {
          size: 0.017,
          latching: i !== 3,
          lit: i === 1,
          led: 'amber',
        },
      );
    label(a.group, 'MODEL VX-M4', 0.06, -0.06, { height: 0.002 });
    const b = panel(left, 18, 4, '#e2ddcc', half, half / 2);
    label(b.group, 'XE-REGLER', -0.06, 0.06, { height: 0.004, ink: '#9a2a22' });
    knob(b.group, 0.04, 0.016, 0.017, 'instrument', true, INK);
    named(b.group, 'knob', 'XE-REGLER SOLL knob');
    for (let i = 0; i < 3; i++) {
      const made = key(
        b.group,
        ['−', '+', 'SET'][i],
        -0.08 + i * 0.024,
        -0.03,
        {
          width: 0.018,
          height: 0.012,
          colour: i === 2 ? '#e5a640' : '#d8d6cc',
        },
      );
      // − and + step the plant's xenon regulator from here.
      if (hookup && i < 2) {
        const entry = clickables.find((c) => c.object === made.cap)!;
        const press = entry.use;
        entry.name = `XE-REGLER ${i === 0 ? '−' : '+'} key`;
        entry.use = (direction) => {
          press(direction);
          hookup.regulator(i === 0 ? -1 : 1);
        };
      }
    }
    // Flashes while too little xenon reaches the machine (XE FLUSS).
    lamp(b.group, '#ff4a2e', -0.08, 0.025, 0.8, () => alarmed('XE FLUSS'));
    label(b.group, 'STÖRUNG', -0.08, 0.008, { height: 0.0022, ink: INK });
    label(b.group, 'SOLL · SLPM', 0.04, -0.062, {
      height: 0.0026,
      ink: '#9a2a22',
    });
  }
  {
    // 3U: black meter panel: two meters and a block of four selectors.
    const p = panel(left, 22, 3, '#191a1c');
    label(p.group, 'MOD. FX 320', -0.19, 0.052, { height: 0.0024 });
    label(p.group, 'KATODE', -0.13, -0.04, { height: 0.0022 });
    label(p.group, 'STRAHLSTROM', 0.13, -0.04, { height: 0.0022 });
    label(p.group, 'BEREICH', 0, 0.046, { height: 0.0022 });
    meter(
      p.group,
      'kV',
      -0.13,
      -0.002,
      0.075,
      // The cathode supply, as A5's readout shows it.
      () => num('rig.heater') * 0.7,
    );
    meter(
      p.group,
      'mA',
      0.13,
      -0.002,
      0.075,
      // The beam current follows the ferrocore's activity.
      () => num('ferrocore.activity') * 0.85,
    );
    for (let i = 0; i < 4; i++)
      button(
        p.group,
        ['I', 'II', 'III', 'IV'][i],
        i < 2 ? 'green' : 'red',
        -0.013 + (i % 2) * 0.026,
        0.014 - Math.floor(i / 2) * 0.026,
        { size: 0.019, lit: i === 0 },
      );
  }
  {
    // 2U: cream panel with the beam stop.
    const p = panel(left, 25, 2, CREAM);
    button(
      p.group,
      'STOP',
      'red',
      -0.02,
      -0.002,
      { latching: false, size: 0.024 },
      () => hookup?.trip('STRAHL STOP'),
    );
    named(p.group, 'STOP button', 'STRAHL STOP button');
    label(p.group, 'STRAHL', -0.065, -0.002, { height: 0.0028, ink: INK });
    for (let i = 0; i < 2; i++) {
      knob(p.group, 0.1 + i * 0.05, 0.0, 0.0075);
      label(p.group, ['X', 'Y'][i], 0.1 + i * 0.05, 0.026, {
        height: 0.002,
        ink: INK,
      });
    }
    dymo(p.group, 'NICHT UMSCHALTEN!', -0.17, 0.004);
  }
  // 27–34: the open bay. The beam tube runs into it from the chamber.
  {
    const g = left.group;
    const y = left.top - 30.5 * U;
    box(g, 0.483, 7 * U, 0.02, '#141516', 0, y, -0.3);
    box(g, 0.483, 0.01, 0.6, '#3a3c3e', 0, left.top - 34 * U + 0.005, 0);
  }
  {
    // 3U: heater switches and a temperature readout.
    const p = panel(left, 34, 3, '#d3d0c2');
    for (let i = 0; i < 4; i++)
      toggle(p.group, -0.2 + i * 0.026, -0.002, i % 2 === 0);
    label(p.group, 'HZG 1 2 3 4', -0.161, 0.026, { height: 0.0024, ink: INK });
    box(p.group, 0.17, 0.056, 0.0008, PANEL_BLACK, 0.07, 0, -0.0001);
    seg(
      p.group,
      4,
      0.06,
      0.006,
      // The crucible sits on the valve heaters' circuit.
      () => String(Math.round(20 + num('rig.heater') * 590)),
      0.015,
      '#ff3b24',
    );
    label(p.group, '°C', 0.138, 0.006, { height: 0.0026 });
    label(p.group, 'TEMP TIEGEL', 0.06, -0.019, { height: 0.0022 });
    // Flashes once any of the drive's devices is hot enough to smoke.
    led(p.group, 'red', 0.2, 0.02, 0.6, 0, () => hottest() >= 0.35);
    label(p.group, 'ÜBERTEMP.', 0.2, -0.005, { height: 0.0022, ink: INK });
  }
  {
    // 3U: the bottom supply, whose red mains button runs the whole concept.
    const p = panel(left, 37, 3, '#d9d6c9');
    const mains = button(p.group, 'NETZ', 'red', -0.19, 0, {
      size: 0.026,
      lit: switchedOn,
    });
    label(p.group, 'NETZ', -0.19, 0.027, { height: 0.0026, ink: INK });
    knob(p.group, -0.1, 0, 0.016, 'instrument', true, INK);
    label(p.group, 'ABGLEICH', -0.1, -0.035, { height: 0.0022, ink: INK });
    for (let i = 0; i < 3; i++)
      button(p.group, ['A', 'B', 'C'][i], 'white', 0.0 + i * 0.024, 0.006, {
        size: 0.018,
        led: (['green', 'amber', 'red'] as const)[i],
        lit: i === 0,
      });
    label(p.group, 'VERSORGUNG NG-3', 0.024, -0.022, {
      height: 0.0026,
      ink: INK,
    });
    vents(p.group, 0.17, 0, 0.07, 7);
    selectedMains = () => mains.lit;
    ticks.push(() => {
      running =
        (options.supplied?.() ?? true) &&
        mains.lit &&
        supply.on &&
        cabinetMains;
    });
  }

  // ---- Right cabinet: tall olive ------------------------------------------
  const right: Rack = {
    name: 'olive cabinet',
    group: new Group(),
    top: 2.03,
    width: 0.54,
    frontZ: 0.36,
    upright: { x: -0.3, z: 0.3805 },
  };
  right.group.position.set(0.69, 0, -0.02);
  group.add(right.group);
  {
    const g = right.group;
    const H = 1.94;
    const y = skidTop + H / 2;
    for (const sx of [-1, 1]) box(g, 0.06, H, 0.76, oliveSide, sx * 0.3, y, 0);
    box(g, 0.66, 0.05, 0.76, oliveTrim, 0, skidTop + H - 0.025, 0);
    box(g, 0.66, 0.06, 0.76, oliveTrim, 0, skidTop + 0.03, 0);
    box(g, 0.56, H, 0.02, back, 0, y, -0.37);
    box(g, 0.02, 0.12, 0.03, '#8f9483', 0.335, 1.15, 0.2);
    box(g, 0.1, 0.022, 0.003, '#d0d0c4', -0.2, skidTop + H - 0.025, 0.382);
  }
  {
    const p = panel(right, 0, 1, '#2a2b2c');
    label(p.group, 'INV.-NR. 0417 / 86', -0.17, 0, {
      height: 0.0026,
      plate: '#e8e4d4',
      ink: '#222',
    });
    led(p.group, 'green', 0.23, 0);
    label(p.group, 'NETZ', 0.2, 0, { height: 0.002, ink: '#f1ecdc' });
  }
  {
    // 2U: three small readouts over a row of channel keys: the core's
    // temperature in kelvin, the chamber pressure in centibar, and the
    // xenon left in the bottle.
    const p = panel(right, 1, 2, '#232426');
    const readings = [
      () => String(Math.round(prep.temperature)),
      () => String(Math.round(chamberPressure(prep) * 100)),
      () => String(Math.round((prep.supply / FULL_BOTTLE) * 100)),
    ];
    readings.forEach((reading, i) =>
      seg(p.group, 4, -0.19 + i * 0.07, 0.014, reading, 0.009),
    );
    label(p.group, 'K', -0.157, 0.014, { height: 0.0022 });
    for (let i = 0; i < 8; i++)
      key(p.group, String(i + 1), 0.03 + i * 0.024, 0.008, {
        width: 0.016,
        height: 0.009,
        colour: i === 3 ? '#e5a640' : '#e6e4da',
      });
    label(p.group, 'KANALWAHL', 0.114, -0.016, { height: 0.0022 });
    ['KERN K', 'DRUCK cbar', 'XE %'].forEach((text, i) =>
      label(p.group, text, -0.19 + i * 0.07, -0.016, { height: 0.0018 }),
    );
  }
  for (const [n, fromTop] of [
    [1, 3],
    [2, 6],
  ] as const) {
    // Twin evaporator controllers, as in the reference.
    const p = panel(right, fromTop, 3, LIGHT_GREY);
    const strip = p.h / 2 - EDGE_CLEARANCE - 0.007;
    box(
      p.group,
      p.w - 2 * EDGE_CLEARANCE,
      0.014,
      0.002,
      '#2a2b2d',
      0,
      strip,
      0.0005,
    );
    label(p.group, `VERDAMPFER ${n}`, -0.18, strip, {
      height: 0.0026,
    });
    label(p.group, 'GORSKIY', 0.21, strip, {
      height: 0.0026,
      ink: '#e7a24b',
    });
    button(
      p.group,
      'AUS',
      'red',
      -0.225,
      -0.006,
      { size: 0.022, latching: false },
      () => hookup?.trip(`VERDAMPFER ${n} AUS`),
    );
    named(p.group, 'AUS button', `VERDAMPFER ${n} AUS button`);
    box(p.group, 0.06, 0.028, 0.0008, '#141416', -0.16, -0.006, -0.0001);
    seg(
      p.group,
      3,
      -0.16,
      -0.006,
      // Evaporator 1 is the HT valve heater, 2 the LT: its temperature.
      () =>
        String(
          Math.round(
            20 +
              (model(`drive.${n === 1 ? 'ht' : 'lt'}`) ? 1 : 0) *
                num('rig.heater') *
                (180 + n * 40),
          ),
        ),
      0.011,
    );
    for (let i = 0; i < 3; i++)
      button(
        p.group,
        ['MAN', 'AUTO', 'RAMP'][i],
        'white',
        -0.1 + i * 0.022,
        -0.006,
        {
          size: 0.017,
          lit: i === 1,
          led: 'green',
        },
      );
    knob(p.group, 0.01, -0.006, 0.017, 'instrument');
    label(p.group, 'SOLL', 0.01, -0.041, { height: 0.0022, ink: INK });
    label(p.group, 'IST °C', -0.16, -0.034, { height: 0.002, ink: INK });
    label(p.group, 'LEISTUNG W', 0.16, -0.034, { height: 0.002, ink: INK });
    label(p.group, 'FREIG.', 0.235, -0.034, { height: 0.0018, ink: INK });
    for (let i = 0; i < 3; i++)
      key(p.group, ['◄', '►', 'MEM'][i], 0.055 + i * 0.02, -0.006, {
        width: 0.015,
        height: 0.016,
        colour: '#2c2c2e',
        ink: '#f1ecdc',
      });
    box(p.group, 0.09, 0.026, 0.0008, '#141416', 0.175, -0.006, -0.0001);
    seg(
      p.group,
      4,
      0.16,
      -0.006,
      // Its power: hard while it warms, a holding load once warm.
      () =>
        String(
          Math.round(
            model(`drive.${n === 1 ? 'ht' : 'lt'}`) && model('drive.mains')
              ? 600 + (1 - num('rig.heater')) * 900
              : 0,
          ),
        ),
      0.009,
    );
    toggle(p.group, 0.235, -0.006);
  }
  {
    // 2U: twin amber dot-matrix readouts.
    const p = panel(right, 9, 2, '#1d1e20');
    for (const [i, x] of [-0.11, 0.11].entries()) {
      const matrix = createLedMatrix(kit, {
        columns: 12,
        rows: 5,
        pitch: 0.0055,
      });
      place(p.group, matrix.group, x, 0.002);
      ticks.push((_, on) => {
        // The left shows the trim: a full column where TRIMM stands (IST),
        // dots top and bottom where the field balances (SOLL). The right
        // shows the strain as a bar, and the instability along the top.
        const ist = Math.round(num('drive.trim') * 11);
        const soll = Math.round(num('drive.idealTrim') * 11);
        const strain = Math.round(num('rig.strain') * 12);
        const unstable = Math.round(num('rig.instability') * 12);
        matrix.draw(
          (c, r) =>
            on &&
            (i === 0
              ? c === ist || (c === soll && (r === 0 || r === 4))
              : (r >= 2 && c < strain) || (r === 0 && c < unstable)),
        );
      });
      label(
        p.group,
        i === 0 ? 'TRIMM  IST │ SOLL ⁚' : 'DEHNUNG ▬  INSTAB. ‾',
        x,
        -0.026,
        { height: 0.0022 },
      );
    }
    // Flashes with the INSTAB window.
    led(p.group, 'red', 0.0, 0.01, 0.9, 0, () => alarmed('INSTAB'));
    label(p.group, 'INSTAB', 0.0, -0.006, { height: 0.0018 });
  }
  {
    // 4U: a modular instrument panel with the big round gauge.
    const p = panel(right, 11, 4, LIGHT_GREY);
    divider(p.group, -0.09, p.h);
    divider(p.group, 0.075, p.h);
    // The drive's three dials: spindle speed, Helmholtz-Blatz field and
    // Blatz trim. The heater switches and ZÜND under HV FIL.
    const dials = ['spindle', 'field', 'trim'] as const;
    for (let i = 0; i < 3; i++) {
      const x = -0.225 + i * 0.065;
      knob(
        p.group,
        x,
        0.022 - (i % 2) * 0.03,
        0.008,
        'skirted',
        true,
        INK,
        hookup?.dials[dials[i]],
        `${['DREHZAHL', 'FELD', 'TRIMM'][i]} knob`,
      );
      label(p.group, ['DREHZAHL', 'FELD', 'TRIMM'][i], x, -0.058, {
        height: 0.0022,
        ink: INK,
      });
    }
    (['ht', 'lt'] as const).forEach((id, i) =>
      toggle(
        p.group,
        -0.05 + i * 0.03,
        0.035,
        i === 0,
        hookup && {
          get: () => hookup.heaters.get(id),
          flip: () => hookup.heaters.flip(id),
          name: `${id.toUpperCase()} heater switch`,
        },
      ),
    );
    label(p.group, 'HT  LT', -0.035, 0.058, { height: 0.0022, ink: INK });
    // The model's heater lamp: lit while either valve heater is in.
    lamp(p.group, '#ffb43a', -0.035, -0.005, 0, () =>
      Boolean(model('column.heaterLamp')),
    );
    button(p.group, 'ZÜND', 'amber', -0.035, -0.045, { latching: false }, () =>
      hookup?.ignite(),
    );
    // The spindle's actual speed beside its DREHZAHL knob, with the red
    // line it must stay under.
    {
      const made = createRoundGauge(kit, {
        radius: 0.058,
        label: 'U/min ×1000',
        redFrom: REDLINES.spindle.limit / REDLINES.spindle.fullScale,
      });
      place(p.group, made.group, 0.165, 0.0);
      ticks.push((_, on) => made.set(on ? num('rig.spindle') : 0));
      updates.push(made.update);
    }
    label(p.group, 'DREHZAHL IST', 0.165, -0.071, { height: 0.0022, ink: INK });
  }
  {
    // 4U: the ferrocore capacity meter.
    const p = panel(right, 15, 4, '#cacabe');
    meter(
      p.group,
      'µB',
      -0.14,
      0.012,
      0.11,
      // How much of the ferrocore's capacity the drive is using.
      () => num('ferrocore.activity'),
    );
    label(p.group, 'FERROKERN AUSLASTUNG', -0.14, -0.06, {
      height: 0.0024,
      ink: INK,
    });
    for (let i = 0; i < 2; i++) {
      knob(p.group, 0.04 + i * 0.055, 0.03, 0.01, 'collet', true, INK);
      label(p.group, ['BEREICH', 'NULL'][i], 0.04 + i * 0.055, 0.0, {
        height: 0.002,
        ink: INK,
      });
    }
    button(p.group, 'PRÜF', 'grey', 0.07, -0.035, {
      size: 0.022,
      latching: false,
      led: 'green',
    });
    button(p.group, 'KAL', 'blue', 0.2, 0.02, { latching: false });
    banana(p.group, 0.19, -0.03, '#c62a1e');
    banana(p.group, 0.215, -0.03, '#1a1a1a');
  }
  {
    // 2U: black strip: a red readout, four level bars and trimmers.
    const p = panel(right, 19, 2, '#18191b');
    seg(
      p.group,
      4,
      -0.19,
      0.002,
      // The energy the drive has drawn, in watt-hours.
      () => String(Math.round(num('telltales.energyKwh') * 1000) % 10000),
      0.014,
    );
    label(p.group, 'ENERGIE Wh', -0.19, -0.028, { height: 0.0018 });
    // The stored heat of the spindle drive, the field coils and the load,
    // and the smoke in the room.
    const heats: (() => number)[] = [
      () =>
        (model('overheat') as { heat: Record<string, number> }).heat.spindle,
      () => (model('overheat') as { heat: Record<string, number> }).heat.field,
      () => (model('overheat') as { heat: Record<string, number> }).heat.load,
      () => num('room.smokeLevel'),
    ];
    for (let i = 0; i < 4; i++)
      bars(p.group, -0.105 + i * 0.016, 0.002, heats[i]);
    label(p.group, 'WÄRME', -0.081, 0.032, { height: 0.0018 });
    label(p.group, 'S  F  L  R', -0.081, -0.028, { height: 0.0016 });
    for (let i = 0; i < 5; i++) {
      knob(p.group, -0.01 + i * 0.05, 0.006, 0.0065);
      named(p.group, 'knob', `OFFSET ${i + 1} knob`);
    }
    label(p.group, 'OFFS. 1 2 3 4 5', 0.09, -0.025, { height: 0.002 });
  }
  {
    // 4U: the beat-frequency panel.
    const p = panel(right, 21, 4, LIGHT_GREY);
    for (let i = 0; i < 4; i++) {
      label(
        p.group,
        ['PHASE', 'FEIN', 'AMPL.', 'SYMM.'][i],
        -0.19 + (i % 2) * 0.075,
        0.008 - Math.floor(i / 2) * 0.056,
        { height: 0.002, ink: INK },
      );
      knob(
        p.group,
        -0.19 + (i % 2) * 0.075,
        0.03 - Math.floor(i / 2) * 0.056,
        0.011,
        'skirted',
        true,
        INK,
      );
    }
    // A key-operated selector: the key must be turned before it will move.
    const selector = createKeyLockedKnob(kit, {
      radius: 0.013,
      positions: 3,
      position: 1,
      ink: INK,
    });
    place(p.group, selector.group, 0.03, 0.002);
    worked(selector.key, 'SCHWEBUNG key', selector.toggleLock, selector.update);
    clickables.push({
      object: selector.handle,
      name: 'SCHWEBUNG band selector',
      use: (direction?: number) => {
        selector.turn(direction);
        hookup?.band.set(selector.position / 2);
      },
    });
    hookup?.band.set(selector.position / 2);
    label(p.group, 'SCHWEBUNG', 0.03, 0.046, { height: 0.0024, ink: INK });
    toggle(p.group, 0.11, 0.03);
    // Flashes with the DEHNUNG window: strain the band should clear.
    lamp(p.group, '#ff4a2e', 0.11, -0.025, 0.45, () => alarmed('DEHNUNG'));
    label(p.group, 'FREIG.', 0.11, 0.057, { height: 0.002, ink: INK });
    label(p.group, 'STÖRUNG', 0.11, -0.048, { height: 0.002, ink: INK });
    label(p.group, 'nur mit Freigabe', 0.2, -0.05, {
      height: 0.004,
      ink: '#1d2a7a',
      font: HAND,
      bold: false,
      tilt: 0.05,
      plate: '#e9dfae',
    });
  }
  // 25–35: blank panels, as a rack fills and empties over the years.
  {
    const a = panel(right, 25, 3, '#b9b8ad');
    vents(a.group, 0, 0, 0.42, 5);
    {
      // 4U: the column station. The rams raise and lower the head, the
      // clamps seal it down, the inlet admits xenon; the outlet is the
      // handwheel valve on the beam tube.
      const p = panel(right, 28, 4, '#c3c2b6');
      label(p.group, 'SÄULE', -0.22, 0.068, { height: 0.0028, ink: INK });
      button(
        p.group,
        'HEBEN',
        'grey',
        -0.225,
        0.03,
        { latching: false, led: 'green' },
        () => {
          if (!running) return log(NO_SUPPLY);
          if (!driveLift(prep, 1))
            log('Column: the clamps are closed; the head will not rise.');
        },
      );
      button(
        p.group,
        'SENKEN',
        'grey',
        -0.225,
        -0.02,
        { latching: false, led: 'amber' },
        () => {
          if (!running) return log(NO_SUPPLY);
          if (!driveLift(prep, 0)) log('Column: the clamps are closed.');
        },
      );
      const top = led(p.group, 'green', -0.195, 0.03);
      const bottom = led(p.group, 'amber', -0.195, -0.02);
      ticks.push((seconds, on) => {
        const moving = prep.lift !== prep.liftTarget;
        const blink = motion === 0 || Math.sin(seconds * 9) > 0;
        top.set(
          on && (prep.lift === 1 || (moving && prep.liftTarget === 1 && blink)),
        );
        bottom.set(
          on && (prep.lift === 0 || (moving && prep.liftTarget === 0 && blink)),
        );
      });
      label(p.group, 'OBEN UNTEN', -0.21, -0.05, { height: 0.0022, ink: INK });
      const clamp = button(
        p.group,
        'SPANNEN',
        'grey',
        -0.15,
        0.005,
        { size: 0.021, led: 'red' },
        () => {
          if (!running) return log(NO_SUPPLY);
          if (!setClamped(prep, !prep.clamped))
            log('Column: the clamps only close on a head that is fully down.');
        },
      );
      const inlet = button(
        p.group,
        'XE EIN',
        'white',
        -0.105,
        0.005,
        { size: 0.021, led: 'blue' },
        () => {
          // The inlet is a solenoid valve: it needs the supply to move.
          if (!running) return log(NO_SUPPLY);
          prep.inletOpen = !prep.inletOpen;
        },
      );
      const outletLed = led(p.group, 'amber', -0.105, -0.035);
      label(p.group, 'AUSLASS', -0.105, -0.05, { height: 0.0022, ink: INK });
      ticks.push((_, on) => {
        clamp.lit = on && prep.clamped;
        inlet.lit = on && prep.inletOpen;
        outletLed.set(on && prep.outletOpen);
      });
      // The chamber's own gauge: mechanical, so it reads with the power off.
      const chamberGauge = createRoundGauge(kit, {
        radius: 0.05,
        label: 'bar',
        scaleMax: CHAMBER_GAUGE_BAR,
        redFrom: REGULATOR / CHAMBER_GAUGE_BAR,
      });
      place(p.group, chamberGauge.group, -0.015, 0.0);
      ticks.push(() =>
        chamberGauge.set(chamberPressure(prep) / CHAMBER_GAUGE_BAR),
      );
      updates.push(chamberGauge.update);
      label(p.group, 'KAMMERDRUCK', -0.015, -0.068, {
        height: 0.0022,
        ink: INK,
      });
      // The lambda probe's meter: about 0.1 V in air, up in the green band
      // once the purge has driven the oxygen out.
      const lambda = createPanelMeter(kit, 'V  O2', {
        width: 0.056,
        scaleMax: 1,
        band: { from: PURGE_COMPLETE_VOLTS, to: 1, colour: '#3f9a4a' },
      });
      place(p.group, lambda.group, 0.075, 0.022);
      ticks.push((_, on) =>
        lambda.set(on ? lambdaVolts(oxygenPercent(prep)) : 0),
      );
      updates.push(lambda.update);
      label(p.group, 'LAMBDA-SONDE', 0.075, 0.056, {
        height: 0.0022,
        ink: INK,
      });
      const purged = lamp(p.group, '#7dff74', 0.075, -0.03);
      ticks.push((_, on) =>
        purged.set(
          on && lambdaVolts(oxygenPercent(prep)) >= PURGE_COMPLETE_VOLTS,
        ),
      );
      label(p.group, 'O2 = 0', 0.075, -0.047, { height: 0.0022, ink: INK });
      box(p.group, 0.075, 0.034, 0.0008, '#141416', 0.15, 0.035, -0.0001);
      seg(
        p.group,
        3,
        0.145,
        0.035,
        () => String(Math.round((prep.supply / FULL_BOTTLE) * 100)),
        0.013,
      );
      label(p.group, 'XE VORRAT %', 0.15, 0.06, { height: 0.0022, ink: INK });
      const sealedLamp = lamp(p.group, '#7dff74', 0.12, -0.03);
      const starvedLamp = lamp(p.group, '#ffb43a', 0.16, -0.03);
      const faultLamp = lamp(p.group, '#ff4a2e', 0.2, -0.03);
      ticks.push((seconds, on) => {
        const blink = motion === 0 || Math.sin(seconds * 6) > 0;
        sealedLamp.set(on && isSealed(prep));
        starvedLamp.set(on && isStarved(prep) && blink);
        // STÖRUNG also flashes while a core warms in a chamber that would
        // burn it, before it does.
        faultLamp.set(
          on && (prep.failure !== null || isExposed(prep)) && blink,
        );
      });
      label(p.group, 'DICHT  DRUCK  STÖRUNG', 0.16, -0.05, {
        height: 0.0022,
        ink: INK,
      });
      button(
        p.group,
        'QUITT',
        'white',
        0.235,
        0.035,
        { latching: false },
        () => {
          if (prep.failure)
            log('Column: fault acknowledged; a fresh bottle of xenon is on.');
          acknowledge(prep);
        },
      );
    }
    {
      // 3U: the core, under the column station: its temperature, and the
      // drive's UNTERSETZUNG (ratio). The core is not set from here: the
      // drive heats it (see gen2-wiring.ts).
      const c = panel(right, 32, 3, '#aeada3');
      label(c.group, 'KERN', -0.22, 0.045, { height: 0.0028, ink: INK });
      seg(c.group, 4, -0.13, 0.01, () => String(Math.round(prep.temperature)));
      label(c.group, 'IST K', -0.13, -0.014, { height: 0.0022, ink: INK });
      knob(
        c.group,
        0.02,
        0.004,
        0.012,
        'skirted',
        true,
        INK,
        hookup?.dials.ratio,
        'UNTERSETZUNG knob',
      );
      label(c.group, 'UNTERSETZUNG', 0.02, -0.035, {
        height: 0.0022,
        ink: INK,
      });
      box(c.group, 0.05, 0.03, 0.001, '#d9d4bf', 0.2, 0.01, 0.0005);
      label(c.group, 'KERNWECHSEL\n04.10.89', 0.2, 0.01, {
        height: 0.0025,
        ink: INK,
      });
    }
  }
  {
    // 4U: the cabinet's own supply: a mains rocker, a meter and a tag.
    const p = panel(right, 35, 4, '#cfcfc3');
    handles(p.group, p.w, p.h);
    const rocker = createRocker(kit, switchedOn);
    place(p.group, rocker.group, -0.17, 0.0);
    worked(
      rocker.group,
      'cabinet supply rocker',
      () => {
        cabinetMains = !cabinetMains;
        rocker.set(cabinetMains);
      },
      rocker.update,
    );
    label(p.group, 'NETZ', -0.17, 0.026, { height: 0.0026, ink: INK });
    // The supply reaching the cabinet: the rectifier, through the rocker.
    meter(p.group, 'V', 0.0, 0.01, 0.07, () =>
      cabinetMains && (options.supplied?.() ?? true) ? 0.55 : 0,
    );
    label(p.group, 'NETZSPANNUNG', 0, -0.036, { height: 0.0022, ink: INK });
    label(p.group, 'ABGLEICH', 0.14, 0.044, { height: 0.0022, ink: INK });
    knob(p.group, 0.14, 0.02, 0.008);
    // A paper tag on a string, hung from the knob.
    const tag = label(p.group, 'DEFEKT?\n12.3.91', 0.155, -0.03, {
      height: 0.005,
      plate: '#f3efe2',
      ink: '#333',
      font: HAND,
      bold: false,
      tilt: -0.25,
    });
    tag.position.z = 0.012;
    box(p.group, 0.0008, 0.03, 0.0008, '#ddd', 0.145, 0.005, 0.012);
  }

  // ---- The ferrocore column ------------------------------------------------
  const column = new Group();
  column.position.set(0, 0, 0.06);
  group.add(column);
  // The vessel's own metal: brushed aluminium in the realistic style.
  const steel = brushedAluminium(
    createPs1Material({
      color: STEEL,
      metalness: 0.55,
    }) as MeshStandardMaterial,
  );
  kit.materials.push(steel);
  const flange = (
    y: number,
    r: number,
    h: number,
    bolts = 0,
    parent: Object3D = column,
  ) => {
    cyl(parent, r, h, steel, 0, y, 0, { segments: 28 });
    for (let i = 0; i < bolts; i++) {
      const a = (i / bolts) * Math.PI * 2;
      cyl(
        parent,
        0.006,
        h + 0.012,
        '#d0d3d3',
        Math.cos(a) * (r - 0.012),
        y,
        Math.sin(a) * (r - 0.012),
        { segments: 6, metalness: 0.6 },
      );
    }
  };
  /**
   * A radial port: a short neck, a bolted flange, and a blank or a window.
   * A window's neck is open right through the wall (the wall has a hole
   * cut for it), so the glass looks into the vessel and the vessel's light
   * shows out through it.
   */
  const port = (
    angle: number,
    y: number,
    r: number,
    length: number,
    glazed: boolean,
    bodyR = 0.22,
  ) => {
    const pivot = new Group();
    pivot.position.set(0, y, 0);
    pivot.rotation.y = angle;
    column.add(pivot);
    const outer = bodyR + length;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      cyl(
        pivot,
        0.004,
        0.022,
        '#d0d3d3',
        Math.cos(a) * r * 1.25,
        Math.sin(a) * r * 1.25,
        outer,
        { axis: 'z', segments: 6 },
      );
    }
    if (!glazed) {
      cyl(pivot, r, length, steel, 0, 0, bodyR + length / 2 - 0.01, {
        axis: 'z',
        segments: 14,
      });
      cyl(pivot, r * 1.45, 0.014, steel, 0, 0, outer, {
        axis: 'z',
        segments: 18,
      });
      // The port's bore, seen from inside the vessel.
      cyl(pivot, r * 0.8, 0.003, '#0d0e0f', 0, 0, bodyR - 0.014, {
        axis: 'z',
        segments: 14,
      });
      cyl(pivot, r * 0.5, 0.01, '#9ea3a4', 0, 0, outer + 0.012, {
        axis: 'z',
        segments: 10,
      });
      return pivot;
    }
    const bore = r * WINDOW_BORE;
    /** An open-ended tube along the port's axis, from `near` to `far`. */
    const sleeve = (
      radius: number,
      near: number,
      far: number,
      material: Material,
    ) => {
      const mesh = new Mesh(
        new CylinderGeometry(radius, radius, far - near, 14, 1, true),
        material,
      );
      mesh.rotation.x = Math.PI / 2;
      mesh.position.z = (near + far) / 2;
      pivot.add(mesh);
    };
    /** A flat ring facing out along the port's axis. */
    const annulus = (inner: number, outerR: number, z: number) => {
      const mesh = new Mesh(new RingGeometry(inner, outerR, 18), rimSteel);
      mesh.position.z = z;
      pivot.add(mesh);
    };
    // The neck, outside and in: its bore runs from the vessel's inner wall
    // to the glass.
    sleeve(r, bodyR - 0.01, outer - 0.007, steel);
    sleeve(bore, innerR - 0.002, outer + 0.004, insideSteel);
    // The flange, a ring with the bore through it.
    sleeve(r * 1.45, outer - 0.007, outer + 0.007, steel);
    annulus(bore, r * 1.45, outer - 0.007);
    annulus(bore, r * 1.45, outer + 0.007);
    // The glass, and the clamping ring that holds it.
    const pane = new Mesh(new CircleGeometry(bore, 14), glass);
    pane.position.z = outer + 0.004;
    pivot.add(pane);
    sleeve(r * 1.1, outer + 0.007, outer + 0.012, steel);
    sleeve(bore * 0.92, outer + 0.004, outer + 0.012, rimSteel);
    annulus(bore * 0.92, r * 1.1, outer + 0.012);
    // A lip where the bore meets the inner wall, seen from inside.
    annulus(bore * 0.86, bore, innerR - 0.0015);
    return pivot;
  };

  // The stand under the chamber.
  for (const [x, z] of [
    [-0.16, -0.16],
    [0.16, -0.16],
    [-0.16, 0.16],
    [0.16, 0.16],
  ])
    box(column, 0.03, 0.3, 0.03, '#7c8170', x, skidTop + 0.15, z);
  box(column, 0.38, 0.025, 0.38, '#7c8170', 0, 0.43, 0);

  // The chamber: a hollow pressure vessel, open at the top when the head is
  // raised. A 12 mm wall, its inside a duller steel, a heater coil
  // spiralling up the wall, a seat on the floor that the core drops into,
  // the xenon inlet nozzle and a thermocouple.
  const chamberBottom = 0.46;
  const chamberTop = 0.98;
  const chamberHeight = chamberTop - chamberBottom;
  const chamberMiddle = (chamberBottom + chamberTop) / 2;
  const outerR = 0.22;
  const innerR = 0.208;
  // Holes cut through the wall for the windows, as an alpha map on the
  // shell and lining: a cylinder's u runs round it from +z the same way a
  // port's angle does, and v up it.
  const holes = createCanvasTexture(512, 256);
  kit.textures.push(holes.texture);
  holes.context.fillStyle = '#fff';
  holes.context.fillRect(0, 0, 512, 256);
  holes.context.fillStyle = '#000';
  for (const [angle, y, r] of WINDOWS) {
    const u = (((angle / (Math.PI * 2)) % 1) + 1) % 1;
    const across = ((r * WINDOW_BORE) / (Math.PI * 2 * innerR)) * 512;
    const up = ((r * WINDOW_BORE) / chamberHeight) * 256;
    for (const wrap of [-512, 0, 512]) {
      holes.context.beginPath();
      holes.context.ellipse(
        u * 512 + wrap,
        ((chamberTop - y) / chamberHeight) * 256,
        across,
        up,
        0,
        0,
        Math.PI * 2,
      );
      holes.context.fill();
    }
  }
  holes.texture.needsUpdate = true;
  // The shell's grain runs round it, three times over its circumference.
  const shellSteel = brushedAluminium(
    createPs1Material({
      color: STEEL,
      metalness: 0.55,
      alphaMap: holes.texture,
      alphaTest: 0.5,
    }) as MeshStandardMaterial,
    { repeat: [3, 1] },
  );
  const insideSteel = createPs1Material({
    color: '#5d6264',
    metalness: 0.4,
    side: BackSide,
  });
  const liningSteel = createPs1Material({
    color: '#5d6264',
    metalness: 0.4,
    side: BackSide,
    alphaMap: holes.texture,
    alphaTest: 0.5,
  });
  // The windows' glass: faintly tinted, and lit from inside by the core.
  const glass = createPs1Material({
    color: '#a9c2c8',
    metalness: 0.2,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: DoubleSide,
  }) as MeshStandardMaterial;
  const floorSteel = createPs1Material({ color: '#4c5153', metalness: 0.3 });
  const rimSteel = brushedAluminium(
    createPs1Material({
      color: STEEL,
      metalness: 0.55,
      side: DoubleSide,
    }) as MeshStandardMaterial,
  );
  kit.materials.push(
    shellSteel,
    insideSteel,
    liningSteel,
    glass,
    floorSteel,
    rimSteel,
  );
  const shell = new Mesh(
    new CylinderGeometry(outerR, outerR, chamberHeight, 28, 1, true),
    shellSteel,
  );
  shell.position.y = chamberMiddle;
  column.add(shell);
  const lining = new Mesh(
    new CylinderGeometry(innerR, innerR, chamberHeight, 28, 1, true),
    liningSteel,
  );
  lining.position.y = chamberMiddle;
  column.add(lining);
  const floor = new Mesh(new CircleGeometry(innerR, 28), floorSteel);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = chamberBottom + 0.012;
  column.add(floor);
  /** A ring-shaped flange, open in the middle so the vessel can be seen into. */
  const openFlange = (y: number, h: number, bolts: number) => {
    const outer = new Mesh(
      new CylinderGeometry(0.25, 0.25, h, 28, 1, true),
      steel,
    );
    outer.position.y = y;
    column.add(outer);
    const inner = new Mesh(
      new CylinderGeometry(innerR, innerR, h, 28, 1, true),
      insideSteel,
    );
    inner.position.y = y;
    column.add(inner);
    for (const face of [-1, 1]) {
      const ring = new Mesh(new RingGeometry(innerR, 0.25, 28), rimSteel);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = y + (face * h) / 2;
      column.add(ring);
    }
    for (let i = 0; i < bolts; i++) {
      const a = (i / bolts) * Math.PI * 2;
      cyl(
        column,
        0.006,
        h + 0.012,
        '#d0d3d3',
        Math.cos(a) * 0.238,
        y,
        Math.sin(a) * 0.238,
        {
          segments: 6,
          metalness: 0.6,
        },
      );
    }
  };
  flange(chamberBottom - 0.004, 0.25, 0.03, 20);
  openFlange(chamberTop + 0.012, 0.04, 24);
  // The core's seat: a collar on the floor with a dark bore and three
  // locating pins.
  cyl(column, 0.075, 0.04, '#6f7476', 0, chamberBottom + 0.032, 0, {
    segments: 20,
    metalness: 0.4,
  });
  cyl(column, 0.05, 0.042, '#25282a', 0, chamberBottom + 0.033, 0, {
    segments: 16,
  });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    cyl(
      column,
      0.005,
      0.03,
      '#c8cbcb',
      Math.cos(a) * 0.062,
      chamberBottom + 0.06,
      Math.sin(a) * 0.062,
      {
        segments: 6,
        metalness: 0.6,
      },
    );
  }
  // A heater coil spiralling up the inner wall on stand-offs.
  const heaterTurns = 5;
  const heaterPoints: [number, number, number][] = [];
  for (let i = 0; i <= heaterTurns * 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    heaterPoints.push([
      Math.cos(a) * 0.19,
      chamberBottom + 0.09 + (i / (heaterTurns * 24)) * (chamberHeight - 0.18),
      Math.sin(a) * 0.19,
    ]);
  }
  tube(column, heaterPoints, 0.0055, '#9a4f2c', 360);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    box(
      column,
      0.012,
      chamberHeight - 0.16,
      0.012,
      '#7a7f80',
      Math.cos(a) * 0.199,
      chamberMiddle,
      Math.sin(a) * 0.199,
    );
  }
  // The xenon inlet nozzle rising from the floor, and a thermocouple.
  cyl(column, 0.012, 0.06, '#b99b52', 0.13, chamberBottom + 0.042, 0.06, {
    segments: 10,
    metalness: 0.5,
  });
  cyl(
    column,
    0.0035,
    chamberHeight * 0.55,
    '#d0d3d3',
    -0.14,
    chamberBottom + 0.012 + (chamberHeight * 0.55) / 2,
    -0.1,
    {
      segments: 6,
      metalness: 0.6,
    },
  );
  cyl(column, 0.09, 0.05, STEEL_DARK, 0, chamberBottom - 0.04, 0, {
    segments: 14,
    metalness: 0.5,
  });

  // The core seen through the glass is the core itself; lit, it lights the
  // glass from inside.
  const coreGlow = kitGlow(kit, '#34373a');
  const windows = WINDOWS.map(([angle, y, r, length]) =>
    port(angle, y, r, length, true),
  );
  // The big front viewport's rotary feedthrough runs across it.
  const front = windows[FRONT_WINDOW];
  box(front, 0.14, 0.012, 0.012, STEEL_DARK, 0, 0, 0.31);
  cyl(front, 0.013, 0.05, '#2a2a2a', 0.08, 0, 0.31, { axis: 'x' });
  port(0.55, 0.56, 0.032, 0.05, false);
  // Clamp lugs on either side.
  for (const sx of [-1, 1]) {
    box(column, 0.05, 0.09, 0.03, '#a7abab', sx * 0.235, 0.62, 0.12, 0.4);
    box(column, 0.02, 0.05, 0.05, '#d4d6d2', sx * 0.255, 0.75, 0.14);
  }

  // The beam tube west, through a bellows and a valve cross, into the
  // left rack's open bay; a blanked port east.
  const beamY = 0.6;
  cyl(column, 0.055, 0.1, steel, -0.26, beamY, 0, { axis: 'x' });
  cyl(column, 0.085, 0.018, steel, -0.3, beamY, 0, { axis: 'x', segments: 20 });
  for (let i = 0; i < 8; i++)
    cyl(
      column,
      i % 2 ? 0.06 : 0.07,
      0.011,
      steel,
      -0.315 - i * 0.011,
      beamY,
      0,
      {
        axis: 'x',
        segments: 16,
      },
    );
  cyl(column, 0.085, 0.018, steel, -0.41, beamY, 0, {
    axis: 'x',
    segments: 20,
  });
  // The valve cross with its handwheel facing out; a click turns it.
  box(column, 0.1, 0.1, 0.1, steel, -0.48, beamY, 0);
  cyl(column, 0.04, 0.1, steel, -0.48, beamY, 0.09, { axis: 'z' });
  cyl(column, 0.012, 0.05, STEEL_DARK, -0.48, beamY, 0.16, { axis: 'z' });
  const wheel = new Group();
  wheel.position.set(-0.48, beamY, 0.185);
  wheel.userData.sound = 'handwheel';
  column.add(wheel);
  wheel.add(
    new Mesh(new TorusGeometry(0.042, 0.007, 6, 16), paint('#c4c8c8', 0.5)),
  );
  for (let i = 0; i < 3; i++)
    box(wheel, 0.084, 0.006, 0.006, '#c4c8c8', 0, 0, 0).rotation.z =
      (i / 3) * Math.PI;
  // It is the chamber's outlet to the pump: three turns open or shut.
  worked(
    wheel,
    'outlet valve',
    () => {
      prep.outletOpen = !prep.outletOpen;
    },
    (delta) => {
      const target = prep.outletOpen ? Math.PI * 6 : 0;
      wheel.rotation.z += (target - wheel.rotation.z) * Math.min(1, delta * 2);
    },
  );
  cyl(column, 0.055, 0.3, steel, -0.69, beamY, 0, { axis: 'x' });
  for (const x of [-0.55, -0.84])
    cyl(column, 0.08, 0.016, steel, x, beamY, 0, { axis: 'x', segments: 20 });
  // A small round gauge riding on the beam tube.
  cyl(column, 0.012, 0.06, steel, -0.72, beamY + 0.08, 0);
  const tubeGauge = createRoundGauge(kit, {
    radius: 0.03,
    label: 'bar',
    scaleMax: CHAMBER_GAUGE_BAR,
    redFrom: REGULATOR / CHAMBER_GAUGE_BAR,
  });
  tubeGauge.group.position.set(-0.72, beamY + 0.13, -0.01);
  column.add(tubeGauge.group);
  ticks.push(() => tubeGauge.set(chamberPressure(prep) / CHAMBER_GAUGE_BAR));
  updates.push(tubeGauge.update);
  cyl(column, 0.05, 0.08, steel, 0.26, 0.66, 0, { axis: 'x' });
  cyl(column, 0.075, 0.02, steel, 0.3, 0.66, 0, { axis: 'x', segments: 20 });

  // ---- The head: everything the rams raise and lower ----------------------
  // Built in its raised position; lowering it slides the core down into the
  // chamber until its mating flange sits on the chamber's top flange.
  const frameTop = 1.4;
  const head = new Group();
  head.name = 'column head';
  column.add(head);

  // The ferrocore, mounted vertically: an iron core in copper windings with
  // glowing bands between the coils. It spins at full power.
  const coreBottom = chamberTop + 0.04;
  const coreTop = frameTop - 0.04;
  const core = new Group();
  head.add(core);
  cyl(
    core,
    0.032,
    coreTop - coreBottom,
    '#3e4142',
    0,
    (coreBottom + coreTop) / 2,
    0,
    {
      segments: 12,
      metalness: 0.3,
    },
  );
  const coils = 6;
  const coilPitch = (coreTop - coreBottom - 0.08) / coils;
  for (let i = 0; i < coils; i++) {
    const y = coreBottom + 0.06 + i * coilPitch;
    cyl(core, 0.064, coilPitch * 0.68, '#b06a32', 0, y, 0, {
      segments: 16,
      metalness: 0.4,
    });
    cyl(core, 0.05, coilPitch * 0.32, coreGlow, 0, y + coilPitch * 0.5, 0, {
      segments: 12,
    });
    // A tie bar across each coil, so the spin shows.
    box(core, 0.136, 0.008, 0.012, '#5a3a1e', 0, y, 0);
  }
  const coreLight = new PointLight('#ff9b3a', 0, 3.2, 1.6);
  coreLight.position.set(0, (coreBottom + coreTop) / 2, 0.15);
  head.add(coreLight);
  // An open three-armed spider holds the foot of the core on the hangers,
  // so the vessel below can be seen into.
  cyl(head, 0.03, 0.02, '#8d9293', 0, coreBottom + 0.02, 0, {
    segments: 12,
    metalness: 0.5,
  });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const arm = box(
      head,
      0.12,
      0.012,
      0.014,
      '#8d9293',
      Math.cos(a) * 0.06,
      coreBottom + 0.02,
      Math.sin(a) * 0.06,
    );
    arm.rotation.y = -a;
  }
  // Hangers from the mating flange down to the lower stage disc.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    cyl(
      head,
      0.006,
      frameTop - coreBottom,
      '#c8cbcb',
      Math.cos(a) * 0.12,
      (frameTop + coreBottom) / 2,
      Math.sin(a) * 0.12,
      {
        segments: 6,
        metalness: 0.6,
      },
    );
  }

  // The mating flange, the heavy collar with its white lugs, a bellows.
  flange(frameTop + 0.01, 0.25, 0.03, 20, head);
  flange(frameTop + 0.055, 0.25, 0.05, 24, head);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    box(
      head,
      0.04,
      0.065,
      0.04,
      '#dcddd8',
      Math.cos(a) * 0.255,
      frameTop + 0.055,
      Math.sin(a) * 0.255,
    );
  }
  for (let i = 0; i < 7; i++)
    cyl(
      head,
      i % 2 ? 0.125 : 0.14,
      0.011,
      steel,
      0,
      frameTop + 0.09 + i * 0.011,
      0,
      { segments: 20 },
    );
  flange(frameTop + 0.175, 0.19, 0.03, 16, head);
  const plateY = 1.75;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    cyl(
      head,
      i % 2 ? 0.011 : 0.024,
      plateY - frameTop - 0.19,
      '#c6c9c9',
      Math.cos(a) * 0.13,
      (frameTop + 0.19 + plateY) / 2,
      Math.sin(a) * 0.13,
      {
        segments: 10,
        metalness: 0.55,
      },
    );
  }
  cyl(head, 0.05, 0.14, steel, 0, frameTop + 0.26, 0, { segments: 14 });
  flange(frameTop + 0.33, 0.075, 0.018, 8, head);
  // The top plate and its crown of black actuators.
  cyl(head, 0.29, 0.016, steel, 0, plateY, 0, { segments: 32 });
  const crown: [number, number, number][] = [
    [-2.5, 0.21, 0.12],
    [-1.7, 0.22, 0.15],
    [-0.8, 0.21, 0.13],
    [0.3, 0.2, 0.14],
    [1.3, 0.21, 0.11],
    [2.2, 0.2, 0.12],
  ];
  for (const [a, r, h] of crown) {
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    cyl(head, 0.014, 0.06, '#c6c9c9', x, plateY - 0.035, z, { segments: 8 });
    cyl(head, 0.038, h, '#1a1a1c', x, plateY + 0.008 + h / 2, z, {
      segments: 14,
    });
    cyl(head, 0.03, 0.014, '#2c2c2e', x, plateY + 0.015 + h, z, {
      segments: 12,
    });
  }
  cyl(head, 0.022, 0.22, '#c6c9c9', 0, plateY + 0.11, 0.02, { segments: 10 });
  cyl(head, 0.034, 0.1, '#1a1a1c', 0, plateY + 0.27, 0.02, { segments: 14 });
  cyl(head, 0.045, 0.02, '#2c2c2e', 0, plateY + 0.33, 0.02, { segments: 14 });

  // ---- Cable glands in the cabinets' back panels --------------------------
  // The back faces of the olive cabinet and of the grey-blue rack.
  const backRight = right.group.position.z - 0.385;
  const backLeft = left.group.position.z - 0.355;
  const gland = (at: [number, number, number], radius: number) => {
    const [x, y, z] = at;
    cyl(group, radius * 1.9, 0.018, '#1a1a1b', x, y, z - 0.004, {
      axis: 'z',
      segments: 10,
    });
    cyl(group, radius * 2.4, 0.004, '#2c2c2e', x, y, z + 0.004, {
      axis: 'z',
      segments: 6,
    });
  };

  // ---- Equipment tags -----------------------------------------------------
  /**
   * An engraved tag on a valve, port or sensor. Unlike the panels'
   * panel legends these carry their warning wording: a plate with the
   * text cut through to a contrasting core, facing +z.
   */
  const tag = (
    parent: Object3D,
    text: string,
    x: number,
    y: number,
    z: number,
    { height = 0.004, plate = '#1d1f22', ink = '#f2f0e8', turn = 0 } = {},
  ) => {
    const holder = new Group();
    holder.position.set(x, y, z);
    holder.rotation.y = turn;
    parent.add(holder);
    const words = createMicroLabel(kit, text, { height, plate, ink });
    words.position.z = 0.0016;
    holder.add(words);
    words.geometry.computeBoundingBox();
    const size = words.geometry.boundingBox!;
    box(
      holder,
      size.max.x - size.min.x + 0.004,
      size.max.y - size.min.y + 0.003,
      0.0015,
      plate,
      0,
      0,
      0.00075,
    );
    return holder;
  };

  // The purge valve's brass tag, hung on a wire from its stem below the
  // handwheel.
  box(column, 0.0012, 0.05, 0.0012, '#c9ccc8', -0.48, beamY - 0.035, 0.168);
  tag(column, 'SPÜLVENTIL\nXE-KREIS', -0.48, beamY - 0.072, 0.168, {
    height: 0.0035,
    plate: '#b99b52',
    ink: '#241f14',
  });

  // ---- The oxygen sensors ---------------------------------------------------
  // Narrowband lambda probes, as in a motorcycle exhaust, each screwed into
  // a boss on the chamber wall and angled down a little, with its slotted
  // tip showing just inside the wall. Returns where its lead leaves the
  // boot, in the rig's coordinates.
  const lambdaProbe = (angle: number, y: number, name: string) => {
    const probe = new Group();
    probe.position.set(0, y, 0);
    probe.rotation.y = angle;
    column.add(probe);
    const tilt = new Group();
    tilt.position.z = 0.22;
    tilt.rotation.x = 0.35;
    probe.add(tilt);
    // The tip inside, short of the heater coil.
    cyl(tilt, 0.0065, 0.014, '#9ea3a4', 0, 0, -0.017, {
      axis: 'z',
      segments: 8,
      metalness: 0.5,
    });
    for (let i = 0; i < 4; i++)
      box(tilt, 0.0012, 0.0136, 0.004, '#1c1d1e', 0, 0, -0.019).rotation.z =
        (i / 4) * Math.PI;
    cyl(tilt, 0.017, 0.016, steel, 0, 0, 0.006, { axis: 'z', segments: 14 });
    cyl(tilt, 0.0125, 0.012, '#b9bcbc', 0, 0, 0.02, {
      axis: 'z',
      segments: 6,
      metalness: 0.6,
    });
    cyl(tilt, 0.009, 0.038, '#c9ccc8', 0, 0, 0.045, {
      axis: 'z',
      segments: 12,
      metalness: 0.6,
    });
    cyl(tilt, 0.0098, 0.005, '#8e9292', 0, 0, 0.066, {
      axis: 'z',
      segments: 12,
      metalness: 0.5,
    });
    cyl(tilt, 0.0075, 0.03, '#202022', 0, 0, 0.083, {
      axis: 'z',
      segments: 10,
      bottom: 0.0085,
    });
    // Its tag, on the chamber wall below the boss.
    const tagged = new Group();
    tagged.rotation.y = angle;
    column.add(tagged);
    tag(tagged, name, 0, y - 0.034, 0.2235, { height: 0.0035 });
    tilt.updateMatrixWorld(true);
    column.updateMatrixWorld(true);
    const start = group.worldToLocal(
      tilt.localToWorld(new Vector3(0, 0, 0.098)),
    );
    return [start.x, start.y, start.z] as [number, number, number];
  };
  /** A point round the chamber, in the rig's coordinates. */
  const around = (angle: number, y: number, r: number) =>
    [Math.sin(angle) * r, y, Math.cos(angle) * r + column.position.z] as [
      number,
      number,
      number,
    ];

  // The first probe's lead runs round to the olive cabinet's back.
  {
    const start = lambdaProbe(-0.5, 0.79, 'O2-SONDE\nLAMBDA');
    const leadEnd: [number, number, number] = [0.66, 0.6, backRight];
    tube(
      group,
      [
        start,
        [start[0] - 0.05, start[1] - 0.07, start[2] + 0.04],
        [-0.27, 0.62, 0.1],
        [-0.3, 0.55, -0.2],
        [0.0, 0.5, -0.33],
        [0.42, 0.55, -0.47],
        leadEnd,
      ],
      0.0028,
      '#3a3f46',
      80,
    );
    gland(leadEnd, 0.006);
  }

  // The second, round the back, has a lead far too long for the run. Its
  // spare is wound round the foot of the chamber, in the clear band between
  // the bottom flange and the lowest port, before it leaves for the olive
  // cabinet's back.
  {
    const start = lambdaProbe(2.9, 0.72, 'O2-SONDE 2\nREFERENZ');
    const lead: [number, number, number][] = [
      start,
      around(2.93, 0.64, 0.3),
      around(3.0, 0.57, 0.262),
      around(3.1, 0.522, 0.234),
    ];
    const from = 3.2;
    const to = 2.6 + Math.PI * 4;
    const turnsPoints = Math.ceil(((to - from) / (Math.PI * 2)) * 32);
    for (let i = 0; i <= turnsPoints; i++) {
      const share = i / turnsPoints;
      lead.push(
        around(from + (to - from) * share, 0.506 - share * 0.024, 0.2285),
      );
    }
    const leadEnd: [number, number, number] = [0.56, 0.64, backRight];
    lead.push(
      around(2.62, 0.5, 0.29),
      [0.2, 0.55, -0.32],
      [0.42, 0.62, -0.47],
      leadEnd,
    );
    tube(group, lead, 0.0018, '#d8cfae', 260);
    gland(leadEnd, 0.005);
  }

  // ---- The purge port --------------------------------------------------------
  // Past the purge valve, at the far end of the beam tube deep in the grey
  // rack's bay, a short stub turns down to a nozzle just above the bay's
  // shelf: about as awkward a place to watch as could be found. With the
  // purge open on a pressurised circuit, xenon jets out, sinks and spreads.
  const purgeVent = createGasVent({ floorDrop: 0.012, spread: 0.18 });
  {
    const x = -0.79;
    cyl(column, 0.016, 0.05, steel, x, beamY - 0.075, 0, { segments: 12 });
    cyl(column, 0.026, 0.008, steel, x, beamY - 0.1, 0, { segments: 14 });
    cyl(column, 0.012, 0.022, '#b99b52', x, beamY - 0.115, 0, {
      segments: 10,
      metalness: 0.5,
    });
    cyl(column, 0.009, 0.012, '#8e7a40', x, beamY - 0.132, 0, {
      segments: 10,
      metalness: 0.5,
    });
    purgeVent.group.position.set(x, beamY - 0.138, 0);
    column.add(purgeVent.group);
    // Its tag, on the tube's front face just above and beside it.
    tag(column, 'SPÜLGAS-AUSLASS', -0.75, beamY, 0.0575);
    // The measuring port beside it, where the blue lead from the grey
    // rack's X input plugs in: a boss on the tube with a BNC socket.
    const portY = beamY - 0.035;
    cyl(column, 0.014, 0.034, steel, -0.74, portY, 0.062, {
      axis: 'z',
      segments: 12,
    });
    cyl(column, 0.009, 0.012, '#c8cbcb', -0.74, portY, 0.085, {
      axis: 'z',
      segments: 12,
      metalness: 0.6,
    });
    tag(column, 'MESSSTUTZEN', -0.705, portY - 0.022, 0.06, { height: 0.003 });
  }

  // The vessel's xenon inlet, under the chamber where the feed hose comes in.
  tag(column, 'XE-EINLASS ▲', 0, 0.424, 0.1925, { height: 0.004 });

  // ---- The lifter: two hydraulic rams behind the column -------------------
  // The barrels stand on brackets off the chamber; the chrome rods and the
  // yoke joining them ride with the head.
  const ramZ = -0.2;
  const yokeY = frameTop + 0.055;
  const barrelBottom = 0.5;
  const barrelTop = yokeY - HEAD_TRAVEL - 0.02;
  for (const sx of [-1, 1]) {
    const x = sx * 0.24;
    cyl(
      column,
      0.03,
      barrelTop - barrelBottom,
      '#3b4450',
      x,
      (barrelTop + barrelBottom) / 2,
      ramZ,
      { segments: 14 },
    );
    cyl(column, 0.036, 0.02, '#2c333c', x, barrelBottom + 0.01, ramZ, {
      segments: 14,
    });
    cyl(column, 0.034, 0.016, '#c9cccc', x, barrelTop - 0.008, ramZ, {
      segments: 14,
      metalness: 0.6,
    });
    // Brackets back to the chamber wall.
    for (const y of [0.62, 0.9]) {
      const bracket = box(
        column,
        0.11,
        0.03,
        0.03,
        '#5a6068',
        x * 0.75,
        y,
        ramZ * 0.75,
      );
      bracket.rotation.y = -Math.atan2(ramZ, x);
    }
    // Hose fittings and hoses to the olive cabinet.
    for (const [n, y] of [barrelBottom + 0.04, barrelTop - 0.04].entries()) {
      cyl(column, 0.008, 0.03, '#b99b52', x + sx * 0.03, y, ramZ, {
        axis: 'x',
        metalness: 0.5,
      });
      // The hoses run back behind the olive cabinet to glands in its back.
      if (sx > 0) {
        const end: [number, number, number] = [
          0.6 + n * 0.05,
          y - 0.07,
          backRight,
        ];
        tube(
          group,
          [
            [x + 0.045, y, ramZ + 0.06],
            [x + 0.08, y - 0.03, ramZ - 0.02],
            [0.32, y - 0.04, -0.32],
            [0.42, y - 0.05, -0.47],
            [0.52, y - 0.06, -0.47],
            end,
          ],
          0.007,
          '#141416',
          32,
        );
        gland(end, 0.012);
      }
    }
    // The rod, long enough to stay in the barrel at full stroke.
    const rodLength = HEAD_TRAVEL + 0.06;
    cyl(head, 0.014, rodLength, '#dfe2e2', x, yokeY - rodLength / 2, ramZ, {
      segments: 10,
      metalness: 0.7,
    });
    box(head, 0.06, 0.05, 0.06, '#2c333c', x, yokeY, ramZ);
  }
  box(head, 0.48, 0.03, 0.05, '#3b4450', 0, yokeY, ramZ);

  // ---- The clamps: four toggle clamps on the chamber's top flange ---------
  const clampArms: Group[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const base = new Group();
    base.position.set(
      Math.cos(a) * 0.272,
      chamberTop + 0.032,
      Math.sin(a) * 0.272,
    );
    // Local +z points out from the column's axis.
    base.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
    column.add(base);
    box(base, 0.032, 0.016, 0.03, '#5a6068', 0, 0.008, 0.005);
    const arm = new Group();
    arm.position.y = 0.012;
    base.add(arm);
    box(arm, 0.022, 0.06, 0.012, '#d8dad6', 0, 0.03, 0);
    box(arm, 0.022, 0.012, 0.04, '#d8dad6', 0, 0.055, -0.018);
    clampArms.push(arm);
  }
  let clampShown = 0;
  // The puff at the seam the instant the head's flange lands on the
  // chamber's.
  const sealPuff = createSealPuff({ radius: 0.252 });
  sealPuff.group.position.y = chamberTop + 0.032;
  column.add(sealPuff.group);
  // Exhaust seeping round the seam of a lowered, unclamped head, and the
  // soot it leaves on the vessel's upper section: on the chamber's lip and
  // top flange below the seam, and on the head's mating collar above it,
  // which carries its stain up when it rises.
  const sealLeak = createSealLeak({ radius: 0.252 });
  sealLeak.group.position.y = chamberTop + 0.032;
  column.add(sealLeak.group);
  const sootBands = [
    {
      parent: column,
      radius: outerR + 0.0015,
      height: 0.16,
      y: chamberTop - 0.08,
      seam: 'top' as const,
      seed: 3,
    },
    {
      parent: column,
      radius: 0.2515,
      height: 0.042,
      y: chamberTop + 0.012,
      seam: 'top' as const,
      seed: 4,
    },
    {
      parent: head,
      radius: 0.2515,
      height: 0.095,
      y: frameTop + 0.035,
      seam: 'bottom' as const,
      seed: 5,
    },
    {
      parent: head,
      radius: 0.1915,
      height: 0.034,
      y: frameTop + 0.175,
      seam: 'bottom' as const,
      seed: 6,
    },
  ].map(({ parent, radius, height, y, seam, seed }) => {
    const band = createSootBand({ radius, height, seam, seed });
    band.mesh.position.y = y;
    parent.add(band.mesh);
    return band;
  });

  // ---- Leads that ride with the head --------------------------------------
  // Their head ends move with it, so they are rebuilt whenever it moves.
  const flexing: {
    mesh: Mesh;
    points: (drop: number) => [number, number, number][];
    radius: number;
  }[] = [];
  const flexLead = (
    points: (drop: number) => [number, number, number][],
    radius: number,
    color: string,
  ) => {
    const mesh = tube(group, points(0), radius, color, 40);
    flexing.push({ mesh, points, radius });
  };
  const crownAt = (i: number) => {
    const [a, r] = crown[i];
    return [Math.cos(a) * r, Math.sin(a) * r + 0.06] as const;
  };
  // From the crown, every lead goes back behind the column and round the
  // back of a cabinet to a gland in its back panel, never through a side.
  for (const [n, i] of [2, 3, 4].entries()) {
    const [x, z] = crownAt(i);
    const end: [number, number, number] = [
      0.6 + n * 0.06,
      1.12 - n * 0.09,
      backRight,
    ];
    flexLead(
      (drop) => [
        [x, plateY + 0.1 - drop, z],
        [x + 0.04, plateY + 0.07 - drop, z - 0.08],
        [0.18 + n * 0.02, plateY - 0.06 - n * 0.04 - drop * 0.8, -0.38],
        [0.42, 1.36 - n * 0.08 - drop * 0.3, -0.48],
        [0.53, 1.22 - n * 0.09, -0.47],
        end,
      ],
      0.0045,
      '#202022',
    );
    gland(end, 0.008);
  }
  for (const [n, i] of [0, 1].entries()) {
    const [x, z] = crownAt(i);
    const end: [number, number, number] = [
      -0.6 - n * 0.07,
      1.05 - n * 0.1,
      backLeft,
    ];
    flexLead(
      (drop) => [
        [x, plateY + 0.12 - drop, z],
        [x - 0.04, plateY + 0.08 - drop, z - 0.08],
        [-0.2 - n * 0.03, plateY - 0.08 - n * 0.05 - drop * 0.8, -0.36],
        [-0.42, 1.3 - n * 0.1 - drop * 0.3, -0.45],
        [-0.52, 1.15 - n * 0.1, -0.44],
        end,
      ],
      0.004,
      n ? '#3a3a3c' : '#202022',
    );
    gland(end, 0.008);
  }
  let leadsDrop = 0;

  // The vessel's black service hose: down from under the chamber, back
  // behind the vessel off the skid, and along behind the olive cabinet into
  // a gland in its back, low down, clear of the floor.
  {
    const end: [number, number, number] = [0.66, skidTop + 0.18, backRight];
    tube(
      group,
      [
        [0.05, 0.42, 0.06],
        [0.08, 0.3, -0.02],
        [0.12, skidTop + 0.12, -0.18],
        [0.22, skidTop + 0.1, -0.36],
        [0.4, skidTop + 0.12, -0.44],
        [0.55, skidTop + 0.16, backRight - 0.04],
        end,
      ],
      0.016,
      '#121214',
      64,
    );
    gland(end, 0.02);
  }

  // ---- The core's look: colour from temperature ---------------------------
  // Cold, it is dark grey. Active, it glows from a deep orange through
  // white-hot to blue as it nears full power; at full power it pulses and
  // spins. Brightness scales the glow. A burnt core flickers dull red.
  const COLD = new Color('#34373a');
  const ramp = ['#ff5a1a', '#ffa040', '#ffe6c0', '#7fc0ff', '#3d7dff'].map(
    (c) => new Color(c),
  );
  const shade = new Color();
  const BLACK = new Color('#000000');
  const display = { kelvin: AMBIENT, brightness: 0.6, failed: false };
  const coreLook = (seconds: number) => {
    if (display.failed) {
      const flicker =
        motion === 0
          ? 0.3
          : 0.15 +
            0.25 * Math.abs(Math.sin(seconds * 23) * Math.sin(seconds * 7));
      shade.set('#ff3a1a');
      return { level: flicker, full: false };
    }
    const h = Math.max(
      0,
      Math.min(1, (display.kelvin - ACTIVATION) / (FULL_POWER - ACTIVATION)),
    );
    if (display.kelvin < ACTIVATION) {
      shade.copy(COLD);
      return { level: 0, full: false };
    }
    const at = h * (ramp.length - 1);
    const i = Math.min(ramp.length - 2, Math.floor(at));
    shade.copy(ramp[i]).lerp(ramp[i + 1], at - i);
    const full = display.kelvin >= FULL_POWER;
    const pulse = full ? 0.72 + 0.28 * Math.sin(seconds * 5.5) * motion : 1;
    const level =
      display.brightness * (0.35 + 0.65 * Math.min(1, h / 0.25)) * pulse;
    return { level, full };
  };

  // ---- Running state -------------------------------------------------------
  const update = (seconds: number, delta: number, reducedMotion: boolean) => {
    motion = reducedMotion ? 0 : 1;
    // Held, the model's physics stop but the rams still run, as long as
    // the column has its supply.
    const events = drive.hold
      ? running
        ? stepLift(prep, delta)
        : []
      : stepColumnPrep(prep, delta, {
          powered: drive.power ?? running,
          ramsPowered: running,
        });
    for (const event of events) {
      log(describe(event));
      options.onEvent?.(event);
      if (event.kind === 'lowered') sealPuff.burst();
    }
    sealPuff.update(delta, reducedMotion);
    sealLeak.update(
      seconds,
      Number(model('column.sealSmoke')) || 0,
      reducedMotion,
    );
    const soot = Number(model('column.soot')) || 0;
    for (const band of sootBands) band.set(soot);
    display.kelvin = prep.temperature;
    display.brightness = prep.brightness;
    display.failed = prep.failure !== null;
    for (const tick of ticks) tick(seconds, running);
    for (const step of updates) step(delta);
    // The head and its leads.
    const drop = (1 - prep.lift) * HEAD_TRAVEL;
    head.position.y = -drop;
    if (Math.abs(drop - leadsDrop) > 0.004) {
      leadsDrop = drop;
      for (const lead of flexing) {
        lead.mesh.geometry.dispose();
        lead.mesh.geometry = new TubeGeometry(
          new CatmullRomCurve3(
            lead.points(drop).map(([x, y, z]) => new Vector3(x, y, z)),
          ),
          40,
          lead.radius,
          6,
          false,
        );
      }
    }
    clampShown +=
      ((prep.clamped ? 1 : 0) - clampShown) * Math.min(1, delta * 8);
    for (const arm of clampArms) arm.rotation.x = (1 - clampShown) * 1.25;
    // The core.
    const { level } = coreLook(seconds);
    const lit = scratch.copy(COLD).lerp(shade, Math.min(1, level * 1.2));
    coreGlow.color.copy(
      display.kelvin < ACTIVATION && !display.failed ? COLD : lit,
    );
    const inChamber = prep.lift < 0.03;
    glass.emissive.copy(
      inChamber && level > 0
        ? scratch.copy(BLACK).lerp(shade, Math.min(1, level) * 0.5)
        : BLACK,
    );
    coreLight.color.copy(shade);
    // Sealed in the steel chamber, only what leaks from the windows lights
    // the room.
    coreLight.intensity = level * (inChamber ? 0.8 : 2.6);
    // The model turns the core; reduced motion holds it still.
    if (motion) core.rotation.y = prep.spinAngle * Math.PI * 2;
    // Gas vents from the purge port while the purge is open on a sealed,
    // pressurised chamber.
    const venting =
      isSealed(prep) && prep.outletOpen
        ? Math.min(1, chamberPressure(prep) / 1.0)
        : 0;
    purgeVent.update(seconds, venting, motion === 0);
  };
  const scratch = new Color();
  update(0, 1, false);

  /**
   * Check every panel's layout: no two fitted parts (displays, controls,
   * lamps, connectors, printed labels) within PART_CLEARANCE of each other,
   * and none within EDGE_CLEARANCE of the panel's edge. Mounting hardware,
   * dividers and the windows set behind readouts are not fitted parts.
   * Returns one line per problem; none means the layout is sound.
   */
  const layoutProblems = (
    partClearance = PART_CLEARANCE,
    edgeClearance = EDGE_CLEARANCE,
  ) => {
    group.updateMatrixWorld(true);
    const problems: string[] = [];
    const mm = (v: number) => `${(v * 1000).toFixed(1)} mm`;
    for (const { group: p, w, h } of panels) {
      const origin = new Vector3().setFromMatrixPosition(p.matrixWorld);
      const parts = (p.userData.parts as Object3D[]).map((part) => {
        const b = new Box3().setFromObject(part);
        return {
          name: part.name || 'part',
          minX: b.min.x - origin.x,
          maxX: b.max.x - origin.x,
          minY: b.min.y - origin.y,
          maxY: b.max.y - origin.y,
        };
      });
      const at = (b: (typeof parts)[number]) =>
        `${b.name} at (${mm((b.minX + b.maxX) / 2)}, ${mm((b.minY + b.maxY) / 2)})`;
      for (const b of parts) {
        const edge = Math.min(
          b.minX + w / 2,
          w / 2 - b.maxX,
          b.minY + h / 2,
          h / 2 - b.maxY,
        );
        if (edge < edgeClearance - 1e-6)
          problems.push(`${p.name}: ${at(b)} is ${mm(edge)} from the edge`);
      }
      for (let i = 0; i < parts.length; i++)
        for (let j = i + 1; j < parts.length; j++) {
          const a = parts[i];
          const b = parts[j];
          const gap = Math.max(
            b.minX - a.maxX,
            a.minX - b.maxX,
            b.minY - a.maxY,
            a.minY - b.maxY,
          );
          if (gap < partClearance - 1e-6)
            problems.push(
              `${p.name}: ${at(a)} and ${at(b)} are ${gap < 0 ? 'overlapping' : mm(gap) + ' apart'}`,
            );
        }
    }
    return problems;
  };

  // Every control has a unique name for the operator's log. The ones that
  // work the column or its drive are named for their role; the rest are
  // spares, named for their panel and numbered where they would repeat.
  const working = new Set([
    'HEBEN button',
    'SENKEN button',
    'SPANNEN button',
    'XE EIN button',
    'QUITT button',
    'outlet valve',
    'supply isolator',
    'NETZ button',
    'cabinet supply rocker',
    'DREHZAHL knob',
    'FELD knob',
    'TRIMM knob',
    'UNTERSETZUNG knob',
    'HT heater switch',
    'LT heater switch',
    'ZÜND button',
    'SCHWEBUNG band selector',
    'SCHWEBUNG key',
    'STRAHL STOP button',
    'XE-REGLER − key',
    'XE-REGLER + key',
    ...[1, 2, 3, 4].map((n) => `VERDAMPFER ${n} AUS button`),
  ]);
  const panelOf = (object: Object3D) => {
    for (let o = object.parent; o; o = o.parent)
      if (o.userData.parts)
        return (o.userData.unit as string | undefined) ?? o.name;
    return undefined;
  };
  // Every control knows its unit, for the log and the runbook.
  for (const c of clickables)
    c.unit =
      panelOf(c.object) ??
      (c.name === 'outlet valve'
        ? 'STRAHLROHR'
        : c.name === 'supply isolator'
          ? 'HAUPTTRENNER'
          : 'SÄULE');
  const spares = clickables.filter((c) => !working.has(c.name));
  for (const c of spares) {
    // Unwired controls keep a real panel purpose; the log also records that
    // they are spare inputs. Use the printed legend nearest their own column.
    if (['knob', 'toggle', 'slide switch', 'key switch'].includes(c.name)) {
      let part = c.object;
      while (part.parent && !part.parent.userData.parts) part = part.parent;
      const legends = (part.parent?.children ?? [])
        .filter((o) => typeof o.userData.legend === 'string')
        .filter(
          (o) =>
            !/^(?:[0-9°µ]|K$|NETZ$|INV\.|MODEL|MOD\.|NEUMANN|GORSKIY|nur mit)/.test(
              String(o.userData.legend),
            ),
        )
        .map((o) => ({
          text: String(o.userData.legend).replace(/\n/g, ' '),
          distance:
            4 * (o.position.x - part.position.x) ** 2 +
            (o.position.y - part.position.y) ** 2,
        }))
        .sort((a, b) => a.distance - b.distance);
      if (legends[0] && legends[0].distance < 0.075 ** 2)
        c.name = `${legends[0].text} ${c.name}`;
    }
    c.name = `spare ${c.name}`;
  }
  // Names are unique within their unit; repeats there are numbered.
  const seen = new Map<string, number>();
  const repeats = new Map<string, number>();
  const unitKey = (c: RigClickable) => `${c.unit}|${c.name}`;
  for (const c of clickables)
    repeats.set(unitKey(c), (repeats.get(unitKey(c)) ?? 0) + 1);
  for (const c of clickables) {
    const k = unitKey(c);
    if ((repeats.get(k) ?? 0) < 2) continue;
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    c.name = `${c.name} #${n}`;
  }

  return {
    group,
    clickables,
    layoutProblems,
    fittedCounts: () =>
      Object.fromEntries(
        panels.map(({ group: p }) => [
          p.name,
          (p.userData.parts as Object3D[]).length,
        ]),
      ),
    get isolator() {
      return { switch: supply.group, plate: isolatorPlate };
    },
    get running() {
      return selectedMains() && supply.on && cabinetMains;
    },
    get powerSelections() {
      return {
        isolator: supply.on,
        mains: selectedMains(),
        cabinet: cabinetMains,
      };
    },
    prep,
    drive,
    update,
    dispose() {
      purgeVent.dispose();
      sealPuff.dispose();
      sealLeak.dispose();
      for (const band of sootBands) band.dispose();
      disposeKit(kit, group);
    },
  };
}
