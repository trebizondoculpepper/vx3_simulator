import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  PlaneGeometry,
  RepeatWrapping,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { BufferGeometry, Material, Texture } from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { createGalvanizedZincMap } from '../rendering/galvanized-zinc';
import { createCanvasTexture, createLabelTexture } from './screens';

export type ServiceKind =
  | 'duct'
  | 'round-duct'
  | 'clad-duct'
  | 'pipe'
  | 'sprinkler'
  | 'tray'
  | 'ladder'
  | 'basket'
  | 'trunking'
  | 'conduit'
  | 'detector';

/** A take-off from a main. All distances are in metres. */
export interface ServiceBranch {
  /** Distance from the start of the run. */
  at: number;
  /** Pipes: which way the branch turns, toward smaller or larger `across`. */
  side?: 1 | -1;
  /** Pipes: how far the branch runs across the run. */
  reach?: number;
  /** How far below the main the branch drops before it turns. */
  drop?: number;
  /** Pipes: end in a valve and blank flange, or pass into the wall. */
  end?: 'valve' | 'wall';
}

export interface ServiceLane {
  kind: ServiceKind;
  /** Position across the run, in world units. */
  across: number;
  /** Gap between the ceiling and the top of the service, in metres. */
  hang?: number;
  /** Paint colour for pipes and trunking. */
  color?: string;
  /** Pipe, conduit or round duct diameter in metres. */
  diameter?: number;
  /** Rectangular ducts: wrapped in silver foil-faced insulation. */
  clad?: boolean;
  /** Pipes: what the pipe carries, printed on its identification labels. */
  medium?: string;
  /** Pipes: the way the flow arrows point, toward `to` (1) or `from` (-1). */
  flow?: 1 | -1;
  /** Pipes: branches ending in valves. Ducts: spigots down to grilles. */
  branches?: ServiceBranch[];
  /** Sprinklers and detectors: metres between heads. */
  spacing?: number;
  /** Sprinklers and detectors: metres from the start of the run to the first head. */
  offset?: number;
  /** Sprinklers: how far below the ceiling the heads hang, in metres. */
  drop?: number;
  /** Detectors: optical smoke or rate-of-rise heat. */
  detector?: 'smoke' | 'heat';
  /** Trays, ladders and baskets: width in metres. */
  width?: number;
  /** Trays, ladders and baskets: carried by a trapeze rather than their own rods. */
  onTrapeze?: boolean;
}

/**
 * A row of slotted steel channel trapezes on threaded rods, carrying the
 * cable runs and pipes between its ends together.
 */
export interface ServiceTrapeze {
  /** The ends of the channel, across the run, in world units. */
  across: [number, number];
  /** Gap between the ceiling and the top of the channel, in metres. */
  hang: number;
  /** Metres between trapezes. */
  spacing?: number;
  /** Metres from the start of the run to the first. */
  offset?: number;
}

export interface ServiceRun {
  /** The direction the services run in. */
  axis: 'x' | 'z';
  from: number;
  to: number;
  ceilingY: number;
  worldUnitsPerMetre: number;
  lanes: ServiceLane[];
  trapezes?: ServiceTrapeze[];
  /**
   * Keep the pipe labels at full brightness whatever the lab's light switch
   * says, for spaces the switch does not light.
   */
  glowingSigns?: boolean;
}

const SILVER = '#ccd1d0';
const STRAP = '#767c79';
const IRON = '#2f2f2b';
const BRASS = '#b39a52';
const BAND = '#e6e3d6';
const LEVER = '#d8b23a';
const HANDWHEEL = '#a8261d';
const LED_ON = new Color('#ff3b2a');
const LED_OFF = new Color('#3a0f0c');

/**
 * Non-functional basement services under a ceiling: galvanised and
 * silver-clad ducts with grilles on spigots, painted pipes on clamps with
 * gate and ball valves, flow arrows, DIN-style medium labels and branches,
 * a wet sprinkler main with pendant heads, perforated cable trays, cable
 * ladders of heavy black cable, wire baskets of bundled data cable, slotted
 * channel trapezes carrying several runs together, steel trunking, thin conduit, and smoke and heat detectors whose LEDs
 * blink now and then. The group's meshes share materials by colour; call
 * update every frame for the LEDs and dispose to free everything.
 */
export function createCeilingServices(run: ServiceRun) {
  const { axis, from, to, ceilingY, worldUnitsPerMetre: m } = run;
  const group = new Group();
  group.name = 'CeilingServices';
  const sprinklerHeads: Group[] = [];
  const palette = new Map<string, Material>();
  const extras: Material[] = [];
  const textures: Texture[] = [];
  const paint = (color: string) => {
    let material = palette.get(color);
    if (!material) {
      material = createPs1Material({ color });
      palette.set(color, material);
    }
    return material;
  };
  const zinc = new Map<'box' | 'round', Material>();
  const galvanized = (shape: 'box' | 'round') => {
    const existing = zinc.get(shape);
    if (existing) return existing;
    const repeats = Math.max(1, (to - from) / m / 0.65);
    const map = createGalvanizedZincMap(
      shape === 'box' ? 791 : 1249,
      shape === 'box' ? repeats : 1,
      shape === 'round' ? repeats : 1,
    );
    textures.push(map);
    const finish = createPs1Material({
      color: '#ffffff',
      map,
      metalness: 0.58,
      roughness: 0.63,
    });
    extras.push(finish);
    zinc.set(shape, finish);
    return finish;
  };
  const length = to - from;
  const middle = (from + to) / 2;
  const put = (result: Mesh, along: number, y: number, across: number) => {
    if (axis === 'x') result.position.set(along, y, across);
    else result.position.set(across, y, along);
    group.add(result);
    return result;
  };
  /**
   * Place a mesh at (along, y, across) in run coordinates. Boxes are sized
   * (along, height, across). Cylinders stand on y unless laid along or
   * across the run.
   */
  const place = (
    geometry: BufferGeometry,
    look: string | Material,
    along: number,
    y: number,
    across: number,
    orient: 'up' | 'along' | 'across' = 'up',
  ) => {
    const material = typeof look === 'string' ? paint(look) : look;
    const result = put(new Mesh(geometry, material), along, y, across);
    if (axis === 'z') result.rotation.y = Math.PI / 2;
    const towardX = (orient === 'along') === (axis === 'x');
    if (orient !== 'up')
      result.rotation.set(
        towardX ? 0 : Math.PI / 2,
        0,
        towardX ? Math.PI / 2 : 0,
      );
    return result;
  };
  const rods = (
    across: number,
    bottom: number,
    spacing: number,
    spread: number,
  ) => {
    for (let at = from + spacing / 2; at < to; at += spacing)
      for (const side of spread ? [-spread, spread] : [0])
        rod(at, across + side, bottom);
  };
  const rod = (at: number, across: number, bottom: number) => {
    const h = ceilingY - bottom;
    place(
      new CylinderGeometry(0.01, 0.01, h, 3),
      '#3b3b36',
      at,
      bottom + h / 2,
      across,
    );
  };
  /** The heading of something pointing along the run, toward `to` or `from`. */
  const heading = (flow: number) =>
    (axis === 'x' ? 0 : -Math.PI / 2) + (flow < 0 ? Math.PI : 0);

  // Printed identification labels, one texture per medium.
  const signs = new Map<string, { material: Material; aspect: number }>();
  const label = (
    text: string,
    along: number,
    y: number,
    across: number,
    flow: number,
  ) => {
    let sign = signs.get(text);
    if (!sign) {
      const image = createLabelTexture(text, {
        ink: '#151511',
        plate: '#e8e4d4',
        size: 12,
      });
      textures.push(image.texture);
      const material = createPs1Material(
        { map: image.texture },
        true,
        run.glowingSigns ?? false,
      );
      extras.push(material);
      sign = { material, aspect: image.width / image.height };
      signs.set(text, sign);
    }
    const h = 0.06 * m;
    const result = put(
      new Mesh(new PlaneGeometry(h * sign.aspect, h), sign.material),
      along,
      y,
      across,
    );
    // Face down, reading along the run toward `to` (1) or `from` (-1).
    result.rotation.order = 'YXZ';
    result.rotation.set(Math.PI / 2, heading(flow), 0);
  };

  /** A white arrow on the underside of a pipe, pointing with the flow. */
  const arrow = (along: number, y: number, across: number, flow: number) => {
    const w = 0.03 * m;
    place(
      new BoxGeometry(0.1 * m, 0.005 * m, w * 0.4),
      BAND,
      along - flow * 0.04 * m,
      y,
      across,
    );
    // A three-sided cone with no height is a flat triangle; its first
    // corner points along +z.
    const head = place(
      new CylinderGeometry(0, w, 0.005 * m, 3),
      BAND,
      along + flow * 0.025 * m,
      y,
      across,
    );
    head.rotation.set(0, heading(flow) + Math.PI / 2, 0);
  };

  /** An inline gate valve with a handwheel, or a ball valve with a lever. */
  const inlineValve = (
    along: number,
    y: number,
    across: number,
    r: number,
    color: string,
    kind: 'gate' | 'ball',
  ) => {
    for (const s of [-1, 1]) {
      place(
        new CylinderGeometry(r * 2, r * 2, r * 0.6, 8),
        color,
        along + s * r * 2.2,
        y,
        across,
        'along',
      );
      // Flange bolts.
      for (const t of [-1, 1])
        place(
          new BoxGeometry(r * 0.9, r * 0.35, r * 0.35),
          IRON,
          along + s * r * 2.2,
          y - r * 1.7,
          across + t * r * 0.6,
        );
    }
    place(
      new CylinderGeometry(r * 1.5, r * 1.5, r * 3.6, 8),
      color,
      along,
      y,
      across,
      'along',
    );
    if (kind === 'gate') {
      // Bonnet and stem hang down to a red handwheel facing the floor.
      place(
        new CylinderGeometry(r * 0.8, r * 1.15, r * 2.4, 6),
        color,
        along,
        y - r * 2.4,
        across,
      );
      place(
        new CylinderGeometry(r * 0.15, r * 0.15, r * 2, 4),
        '#c4c6c0',
        along,
        y - r * 4.4,
        across,
      );
      const wheelY = y - r * 5.3;
      const wheel = place(
        new TorusGeometry(r * 2.3, Math.max(r * 0.22, 0.02), 3, 12),
        HANDWHEEL,
        along,
        wheelY,
        across,
      );
      wheel.rotation.set(Math.PI / 2, 0, 0);
      for (const turn of [0, Math.PI / 2])
        place(
          new BoxGeometry(r * 4.6, r * 0.3, r * 0.3),
          HANDWHEEL,
          along,
          wheelY,
          across,
        ).rotation.y += turn;
    } else {
      place(
        new CylinderGeometry(r * 0.4, r * 0.4, r * 1.8, 4),
        IRON,
        along,
        y - r * 2.2,
        across,
      );
      // The lever lies along the pipe: the valve is open.
      place(
        new BoxGeometry(r * 7, r * 0.5, r),
        LEVER,
        along + r * 2.8,
        y - r * 3.2,
        across,
      );
    }
  };

  /**
   * A tee off the main that drops, turns across the run, and then either
   * turns down to a ball valve and a blank flange or passes into the wall.
   */
  const pipeBranch = (
    branch: ServiceBranch,
    across: number,
    r: number,
    y: number,
    color: string,
  ) => {
    const at = from + branch.at * m;
    const side = branch.side ?? 1;
    const reach = (branch.reach ?? 0.5) * m;
    const drop = (branch.drop ?? 0.3) * m;
    const br = r * 0.75;
    const low = y - drop;
    const end = across + side * reach;
    place(
      new CylinderGeometry(r * 1.25, r * 1.25, r * 3, 6),
      color,
      at,
      y,
      across,
      'along',
    );
    place(
      new CylinderGeometry(br, br, drop, 6),
      color,
      at,
      y - drop / 2,
      across,
    );
    place(new SphereGeometry(br * 1.3, 6, 4), color, at, low, across);
    if (reach > 0) {
      place(
        new CylinderGeometry(br, br, reach, 6),
        color,
        at,
        low,
        across + (side * reach) / 2,
        'across',
      );
      rod(at, across + (side * reach) / 2, low + br);
    }
    if (branch.end === 'wall') {
      // A sleeve plate where it passes through.
      place(new BoxGeometry(br * 5, br * 5, 0.02 * m), IRON, at, low, end);
      return;
    }
    place(new SphereGeometry(br * 1.3, 6, 4), color, at, low, end);
    const leg = 0.12 * m;
    place(new CylinderGeometry(br, br, leg, 6), color, at, low - leg / 2, end);
    const valveY = low - leg - br * 1.5;
    place(
      new CylinderGeometry(br * 1.6, br * 1.6, br * 3, 8),
      color,
      at,
      valveY,
      end,
    );
    place(
      new BoxGeometry(br, br * 0.5, br * 7),
      LEVER,
      at,
      valveY,
      end + side * br * 3.4,
    );
    place(
      new CylinderGeometry(br * 2, br * 2, br * 0.6, 8),
      IRON,
      at,
      valveY - br * 1.9,
      end,
    );
  };

  /** A painted pipe main with clamps, flow markings, valves and branches. */
  const pipe = (
    lane: ServiceLane,
    r: number,
    y: number,
    color: string,
    valves: boolean,
  ) => {
    place(
      new CylinderGeometry(r, r, length, 6),
      color,
      middle,
      y,
      lane.across,
      'along',
    );
    for (let at = from + 0.9 * m; at < to; at += 1.8 * m)
      place(
        new BoxGeometry(0.05, r * 2 + 0.06, r * 2 + 0.06),
        IRON,
        at,
        y,
        lane.across,
      );
    if (valves)
      for (let at = from + 4.1 * m, i = 0; at < to; at += 9.5 * m, i++)
        inlineValve(at, y, lane.across, r, color, i % 2 ? 'ball' : 'gate');
    // Identification band, medium label and flow arrow, every few metres.
    const flow = lane.flow ?? 1;
    const under = y - r - 0.012;
    for (
      let at = from + 1.7 * m, i = 0;
      at < to - 0.5 * m;
      at += 3.6 * m, i++
    ) {
      place(
        new CylinderGeometry(r * 1.12, r * 1.12, 0.05 * m, 6),
        BAND,
        at - flow * 0.3 * m,
        y,
        lane.across,
        'along',
      );
      // Labels alternate in direction, so one reads upright from either side.
      if (lane.medium && i % 2 === 0)
        label(lane.medium, at, under, lane.across, i % 4 ? -flow : flow);
      arrow(at + flow * 0.32 * m, under, lane.across, flow);
    }
    for (const branch of lane.branches ?? [])
      pipeBranch(branch, lane.across, r, y, color);
    rods(lane.across, y, 1.8 * m, 0);
  };

  /** A spigot down from a duct to a slatted supply grille. */
  const grille = (
    branch: ServiceBranch,
    across: number,
    ductBottom: number,
    color: string | Material,
  ) => {
    const at = from + branch.at * m;
    const drop = (branch.drop ?? 0.12) * m;
    const sr = 0.1 * m;
    place(
      new CylinderGeometry(sr, sr, drop + 0.04 * m, 8),
      color,
      at,
      ductBottom - drop / 2 + 0.02 * m,
      across,
    );
    place(
      new CylinderGeometry(sr + 0.02, sr + 0.02, 0.025 * m, 8),
      STRAP,
      at,
      ductBottom - drop * 0.6,
      across,
    );
    const boxY = ductBottom - drop - 0.04 * m;
    place(
      new BoxGeometry(0.4 * m, 0.08 * m, 0.4 * m),
      '#b9bcb6',
      at,
      boxY,
      across,
    );
    for (let k = -3; k <= 3; k++)
      place(
        new BoxGeometry(0.36 * m, 0.01 * m, 0.022 * m),
        '#262825',
        at,
        boxY - 0.041 * m,
        across + k * 0.05 * m,
      );
    // Volume damper quadrant on the spigot.
    place(
      new BoxGeometry(0.02 * m, 0.02 * m, 0.08 * m),
      LEVER,
      at,
      ductBottom - drop * 0.3,
      across + sr,
    );
  };

  /** A pendant sprinkler on a drop: brass frame, red glass bulb, deflector. */
  const sprinklerHead = (
    along: number,
    mainY: number,
    headY: number,
    across: number,
    color: string,
  ) => {
    const anchor = new Group();
    if (axis === 'x') anchor.position.set(along, headY - 0.056 * m, across);
    else anchor.position.set(across, headY - 0.056 * m, along);
    group.add(anchor);
    sprinklerHeads.push(anchor);
    const dr = 0.0125 * m;
    place(
      new CylinderGeometry(dr * 2, dr * 2, dr * 4, 6),
      color,
      along,
      mainY,
      across,
      'along',
    );
    place(
      new CylinderGeometry(dr, dr, mainY - headY, 6),
      color,
      along,
      (mainY + headY) / 2,
      across,
    );
    place(
      new CylinderGeometry(dr * 1.3, dr * 1.1, 0.02 * m, 6),
      BRASS,
      along,
      headY - 0.01 * m,
      across,
    );
    for (const s of [-1, 1])
      place(
        new BoxGeometry(0.005 * m, 0.035 * m, 0.006 * m),
        BRASS,
        along + s * 0.012 * m,
        headY - 0.0375 * m,
        across,
      );
    place(
      new CylinderGeometry(0.004 * m, 0.004 * m, 0.022 * m, 4),
      '#d4261c',
      along,
      headY - 0.034 * m,
      across,
    );
    place(
      new CylinderGeometry(0.024 * m, 0.024 * m, 0.003 * m, 8),
      BRASS,
      along,
      headY - 0.056 * m,
      across,
    );
  };

  // Detector LEDs blink briefly every few seconds, each on its own phase.
  const leds: { material: Material & { color: Color }; phase: number }[] = [];
  const detector = (along: number, across: number, type: 'smoke' | 'heat') => {
    const y = ceilingY;
    const white = '#e9e7df';
    place(
      new CylinderGeometry(0.06 * m, 0.06 * m, 0.012 * m, 10),
      '#d8d6cd',
      along,
      y - 0.006 * m,
      across,
    );
    let bottom: number;
    if (type === 'smoke') {
      place(
        new CylinderGeometry(0.05 * m, 0.055 * m, 0.035 * m, 10),
        white,
        along,
        y - 0.0295 * m,
        across,
      );
      // The smoke chamber's dark vent band and its cap.
      place(
        new CylinderGeometry(0.036 * m, 0.036 * m, 0.01 * m, 10),
        '#4d4d48',
        along,
        y - 0.052 * m,
        across,
      );
      place(
        new CylinderGeometry(0.03 * m, 0.036 * m, 0.01 * m, 10),
        white,
        along,
        y - 0.062 * m,
        across,
      );
      bottom = y - 0.047 * m;
    } else {
      place(
        new CylinderGeometry(0.045 * m, 0.05 * m, 0.025 * m, 10),
        white,
        along,
        y - 0.0245 * m,
        across,
      );
      // A black thermistor in a cage of white posts.
      for (let k = 0; k < 4; k++) {
        const angle = (k * Math.PI) / 2 + Math.PI / 4;
        place(
          new BoxGeometry(0.004 * m, 0.016 * m, 0.004 * m),
          white,
          along + Math.cos(angle) * 0.013 * m,
          y - 0.045 * m,
          across + Math.sin(angle) * 0.013 * m,
        );
      }
      place(
        new CylinderGeometry(0.004 * m, 0.004 * m, 0.014 * m, 4),
        '#1c1c1a',
        along,
        y - 0.043 * m,
        across,
      );
      bottom = y - 0.037 * m;
    }
    const material = createPs1Material(
      { color: LED_OFF.clone() },
      true,
      true,
    ) as Material & {
      color: Color;
    };
    extras.push(material);
    put(
      new Mesh(new BoxGeometry(0.009 * m, 0.008 * m, 0.009 * m), material),
      along + 0.035 * m,
      bottom,
      across,
    );
    leds.push({ material, phase: (leds.length * 2.37) % 6 });
  };
  /** Positions along the run of evenly spaced heads, in world units. */
  const spaced = (spacing: number, offset = spacing / 2) => {
    const result: number[] = [];
    for (let at = from + offset * m; at < to; at += spacing * m)
      result.push(at);
    return result;
  };

  // Sheet steel with its holes punched out: canvas patterns tiled along the
  // run, drawn transparent where the holes are and alpha-tested.
  const sheets = new Map<string, Material>();
  const sheet = (
    key: string,
    size: [number, number],
    /** Tile size in metres, along and across. */
    tile: [number, number],
    /** How far the tiled face spans across, in metres. */
    span: number,
    draw: (context: CanvasRenderingContext2D) => void,
  ) => {
    const id = `${key}:${span}`;
    let material = sheets.get(id);
    if (!material) {
      const { context, texture } = createCanvasTexture(size[0], size[1]);
      draw(context);
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.repeat.set(length / (tile[0] * m), span / tile[1]);
      texture.needsUpdate = true;
      textures.push(texture);
      material = createPs1Material({
        map: texture,
        alphaTest: 0.5,
        side: DoubleSide,
      });
      extras.push(material);
      sheets.set(id, material);
    }
    return material;
  };
  const GALV = '#c4c8c3';
  /** Perforated tray floor: staggered oblong slots, solid at the edges. */
  const perforated = (width: number) =>
    sheet('perforated', [32, 64], [0.2, width], width, (c) => {
      c.fillStyle = GALV;
      c.fillRect(0, 0, 32, 64);
      for (let row = 0; row < 6; row++)
        for (const k of [0, 16])
          c.clearRect(2 + (row % 2) * 8 + k, 4 + row * 10, 11, 5);
    });
  /** Side rails: a row of square holes. */
  const railing = () =>
    sheet('rail', [32, 16], [0.2, 0.08], 0.08, (c) => {
      c.fillStyle = '#b4b8b2';
      c.fillRect(0, 0, 32, 16);
      c.clearRect(6, 6, 5, 4);
      c.clearRect(22, 6, 5, 4);
    });
  /** Ladder rungs every 0.3 m, open between. */
  const rungs = () =>
    sheet('rungs', [32, 8], [0.3, 1], 1, (c) => {
      c.fillStyle = GALV;
      c.fillRect(0, 0, 5, 8);
    });
  /** Welded wire mesh on a 0.1 m grid. */
  const welded = (width: number) =>
    sheet('mesh', [16, 16], [0.1, 0.1], width, (c) => {
      c.fillStyle = '#d4d6d1';
      c.fillRect(0, 0, 16, 2);
      c.fillRect(0, 0, 2, 16);
    });

  // Slotted channel trapezes: the channel, its open slot underneath, and a
  // threaded rod with a nut at each end.
  for (const trapeze of run.trapezes ?? []) {
    const [a, b] = [...trapeze.across].sort((p, q) => p - q);
    const span = b - a;
    const mid = (a + b) / 2;
    const h = 0.041 * m;
    const y = ceilingY - trapeze.hang * m - h / 2;
    for (const at of spaced(trapeze.spacing ?? 1.5, trapeze.offset)) {
      place(new BoxGeometry(0.041 * m, h, span), GALV, at, y, mid);
      place(
        new BoxGeometry(0.012 * m, 0.003 * m, span - 0.01 * m),
        '#1d1e1b',
        at,
        y - h / 2 - 0.001 * m,
        mid,
      );
      for (const end of [a + 0.03 * m, b - 0.03 * m]) {
        const bottom = y - h / 2 - 0.025 * m;
        const rise = ceilingY - bottom;
        place(
          new CylinderGeometry(0.005 * m, 0.005 * m, rise, 4),
          '#9a9c95',
          at,
          bottom + rise / 2,
          end,
        );
        place(
          new BoxGeometry(0.017 * m, 0.012 * m, 0.017 * m),
          '#8d8f88',
          at,
          y - h / 2 - 0.008 * m,
          end,
        );
      }
    }
  }

  for (const lane of run.lanes) {
    const hang = (lane.hang ?? 0.05) * m;
    const top = ceilingY - hang;
    switch (lane.kind) {
      case 'duct': {
        const clad = lane.clad ?? false;
        const w = (clad ? 0.56 : 0.5) * m;
        const h = (clad ? 0.38 : 0.32) * m;
        const y = top - h / 2;
        const finish = clad ? paint(SILVER) : galvanized('box');
        place(new BoxGeometry(length, h, w), finish, middle, y, lane.across);
        // Flanged joints, or the straps over the insulation's joints.
        for (let at = from + 0.6 * m; at < to; at += (clad ? 0.6 : 1.2) * m)
          place(
            new BoxGeometry(
              clad ? 0.03 * m : 0.05,
              h + (clad ? 0.02 : 0.08),
              w + (clad ? 0.02 : 0.08),
            ),
            clad ? STRAP : '#6f736c',
            at,
            y,
            lane.across,
          );
        // Hanger straps and a bottom angle under each.
        for (let at = from + 1.2 * m; at < to; at += 2.4 * m)
          place(
            new BoxGeometry(0.06, 0.05, w + 0.3),
            '#3b3b36',
            at,
            top - h - 0.03,
            lane.across,
          );
        rods(lane.across, top - h - 0.03, 2.4 * m, w / 2 + 0.12);
        for (const branch of lane.branches ?? [])
          grille(branch, lane.across, top - h, finish);
        break;
      }
      case 'round-duct':
      case 'clad-duct': {
        const clad = lane.kind === 'clad-duct';
        const r = ((lane.diameter ?? 0.35) * m) / 2;
        const y = top - r;
        const finish = clad ? paint(SILVER) : galvanized('round');
        place(
          new CylinderGeometry(r, r, length, clad ? 10 : 8),
          finish,
          middle,
          y,
          lane.across,
          'along',
        );
        for (let at = from + 0.8 * m; at < to; at += (clad ? 0.6 : 1.6) * m)
          place(
            new CylinderGeometry(r + 0.03, r + 0.03, clad ? 0.03 * m : 0.08, 8),
            clad ? STRAP : '#7c7f77',
            at,
            y,
            lane.across,
            'along',
          );
        if (clad) {
          // Band hangers either side, clear of the insulation.
          rods(lane.across, y, 2 * m, r + 0.04);
          for (let at = from + m; at < to; at += 2 * m)
            place(
              new BoxGeometry(0.04 * m, 0.03, r * 2 + 0.12),
              '#3b3b36',
              at,
              y,
              lane.across,
            );
        } else rods(lane.across, y, 2 * m, 0);
        for (const branch of lane.branches ?? [])
          grille(branch, lane.across, y - r * 0.9, finish);
        break;
      }
      case 'pipe': {
        const r = ((lane.diameter ?? 0.08) * m) / 2;
        pipe(lane, r, top - r, lane.color ?? '#4f6e8a', true);
        break;
      }
      case 'sprinkler': {
        const r = ((lane.diameter ?? 0.05) * m) / 2;
        const y = top - r;
        const color = lane.color ?? '#b3261e';
        pipe(lane, r, y, color, false);
        const headY = ceilingY - (lane.drop ?? 0.5) * m;
        for (const at of spaced(lane.spacing ?? 3, lane.offset))
          sprinklerHead(at, y, headY, lane.across, color);
        break;
      }
      case 'tray': {
        const width = lane.width ?? 0.4;
        const w = width * m;
        const y = top - 0.08 * m;
        place(
          new BoxGeometry(length, 0.02, w),
          perforated(width),
          middle,
          y,
          lane.across,
        );
        for (const side of [-1, 1])
          place(
            new BoxGeometry(length, 0.06 * m, 0.02),
            railing(),
            middle,
            y + 0.03 * m,
            lane.across + side * (w / 2),
          );
        // A heap of cable in mixed sheaths.
        const colors = ['#1c1c1a', '#3a3a35', '#7a3c22', '#26364a', '#4b4b3e'];
        for (const [i, color] of colors.entries()) {
          const r = 0.012 * m + (i % 2) * 0.006 * m;
          place(
            new CylinderGeometry(r, r, length, 4),
            color,
            middle,
            y + r + 0.01 + (i % 2) * r * 1.4,
            lane.across - w * 0.35 + i * w * 0.17,
            'along',
          );
        }
        if (!lane.onTrapeze) rods(lane.across, y, 1.5 * m, w / 2);
        break;
      }
      case 'ladder': {
        // Two perforated side rails with rungs between, laden with heavy
        // black armoured cable, a few riding on top of the rest.
        const w = (lane.width ?? 0.45) * m;
        const railH = 0.08 * m;
        const y = top - railH;
        place(
          new BoxGeometry(length, 0.012 * m, w),
          rungs(),
          middle,
          y + 0.006 * m,
          lane.across,
        );
        for (const side of [-1, 1])
          place(
            new BoxGeometry(length, railH, 0.012 * m),
            railing(),
            middle,
            y + railH / 2,
            lane.across + side * (w / 2),
          );
        const r = 0.018 * m;
        const count = Math.max(3, Math.floor((w * 0.85) / (r * 2.1)));
        for (let i = 0; i < count; i++) {
          const across =
            lane.across - w * 0.42 + ((i + 0.5) * w * 0.84) / count;
          place(
            new CylinderGeometry(r, r, length, 6),
            i % 3 ? '#151514' : '#232220',
            middle,
            y + 0.012 * m + r,
            across,
            'along',
          );
          if (i % 3 === 1)
            place(
              new CylinderGeometry(r * 0.9, r * 0.9, length, 6),
              '#1b1a18',
              middle,
              y + 0.012 * m + r * 2.9,
              across + r,
              'along',
            );
        }
        if (!lane.onTrapeze) rods(lane.across, y, 1.5 * m, w / 2);
        break;
      }
      case 'basket': {
        // Welded wire basket with a bundle of white data cable in velcro
        // ties, and a blue and a green-and-yellow cable beside it.
        const width = lane.width ?? 0.3;
        const w = width * m;
        const sideH = 0.05 * m;
        const y = top - sideH;
        const wire = welded(width);
        place(
          new BoxGeometry(length, 0.004 * m, w),
          wire,
          middle,
          y,
          lane.across,
        );
        for (const side of [-1, 1])
          place(
            new BoxGeometry(length, sideH, 0.004 * m),
            wire,
            middle,
            y + sideH / 2,
            lane.across + side * (w / 2),
          );
        const r = 0.008 * m;
        const bundle = lane.across - w * 0.12;
        for (let i = 0; i < 6; i++)
          place(
            new CylinderGeometry(r, r, length, 5),
            i % 2 ? '#e4e2da' : '#d6d4cb',
            middle,
            y + r + (i >= 3 ? r * 1.7 : 0),
            bundle + ((i % 3) - 1) * r * 2,
            'along',
          );
        for (const [offset, color] of [
          [0.28, '#3f8fc4'],
          [0.38, '#9fb032'],
        ] as const)
          place(
            new CylinderGeometry(r * 0.7, r * 0.7, length, 5),
            color,
            middle,
            y + r * 0.7,
            lane.across + w * offset,
            'along',
          );
        for (let at = from + 0.6 * m; at < to; at += 1.2 * m)
          place(
            new BoxGeometry(0.015 * m, r * 4.4, r * 7),
            '#121211',
            at,
            y + r * 1.8,
            bundle,
          );
        if (!lane.onTrapeze) rods(lane.across, y, 1.5 * m, w / 2);
        break;
      }
      case 'trunking': {
        const w = 0.15 * m;
        const h = 0.1 * m;
        place(
          new BoxGeometry(length, h, w),
          lane.color ?? '#a2a493',
          middle,
          top - h / 2,
          lane.across,
        );
        for (let at = from + 1.5 * m; at < to; at += 3 * m)
          place(
            new BoxGeometry(0.04, h + 0.03, w + 0.03),
            '#55574c',
            at,
            top - h / 2,
            lane.across,
          );
        break;
      }
      case 'conduit': {
        const r = ((lane.diameter ?? 0.025) * m) / 2;
        place(
          new CylinderGeometry(r, r, length, 4),
          lane.color ?? '#5d5f55',
          middle,
          top - r,
          lane.across,
          'along',
        );
        break;
      }
      case 'detector': {
        for (const at of spaced(lane.spacing ?? 5, lane.offset))
          detector(at, lane.across, lane.detector ?? 'smoke');
        break;
      }
    }
  }

  return {
    group,
    sprinklerHeads,
    /** Blink the detector LEDs: a short red wink every six seconds. */
    update(seconds: number, alarm = false) {
      for (const led of leds)
        led.material.color.copy(
          alarm || (seconds + led.phase) % 6 < 0.15 ? LED_ON : LED_OFF,
        );
    },
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const material of palette.values()) material.dispose();
      for (const material of extras) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
