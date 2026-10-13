import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  TorusGeometry,
} from 'three';
import type { BufferGeometry, Material, Object3D } from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { PANEL_FONT, kitGlow, kitPaint } from './eighties-controls';
import type { PanelKit } from './eighties-controls';
import { createCanvasTexture } from './screens';

/**
 * Switchgear for the 1980s panels, one part per function: knobs of four
 * kinds, toggle, rocker, key and slide switches, calculator-style keycaps
 * and keypads, and the connectors patched into them. Each is built at real
 * size in metres with its back on the panel face (z = 0), facing +z, and
 * returns its group plus whatever moves on it.
 */

const add = (
  parent: Object3D,
  geometry: BufferGeometry,
  material: Material | Material[],
  x = 0,
  y = 0,
  z = 0,
) => {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
};
/** A cylinder standing out of the panel along +z. */
const peg = (
  parent: Object3D,
  material: Material,
  r: number,
  depth: number,
  z: number,
  segments = 16,
  bottom = r,
) => {
  const mesh = add(
    parent,
    new CylinderGeometry(r, bottom, depth, segments),
    material,
    0,
    0,
    z + depth / 2,
  );
  mesh.rotation.x = Math.PI / 2;
  return mesh;
};

/** Ease a value toward its target at a rate that suits a hand-worked part. */
function eased(apply: (value: number) => void, start: number, rate = 14) {
  let target = start;
  let shown = start;
  apply(start);
  return {
    to(value: number) {
      target = value;
    },
    update(delta: number) {
      if (shown === target) return;
      shown += (target - shown) * Math.min(1, delta * rate);
      if (Math.abs(target - shown) < 1e-4) shown = target;
      apply(shown);
    },
  };
}

export type KnobStyle = 'collet' | 'skirted' | 'instrument' | 'pointer';

export interface Knob {
  group: Group;
  /** The part that turns, and takes a click. */
  spindle: Group;
  /** Turn the knob; 0 to 1 sweeps its 270-degree travel. */
  set(value: number): void;
  update(delta: number): void;
}

/** A printed scale of ticks and numbers round a knob, on the panel face. */
function scaleRing(kit: PanelKit, radius: number, ink: string) {
  const size = 96;
  const { context: c, texture } = createCanvasTexture(size, size);
  kit.textures.push(texture);
  c.clearRect(0, 0, size, size);
  c.strokeStyle = ink;
  c.fillStyle = ink;
  c.lineWidth = 2;
  c.font = `bold 10px ${PANEL_FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  for (let i = 0; i <= 10; i++) {
    const a = ((-135 + i * 27 - 90) * Math.PI) / 180;
    const inner = i % 5 === 0 ? 30 : 33;
    c.beginPath();
    c.moveTo(48 + Math.cos(a) * inner, 48 + Math.sin(a) * inner);
    c.lineTo(48 + Math.cos(a) * 37, 48 + Math.sin(a) * 37);
    c.stroke();
    if (i % 2 === 0)
      c.fillText(String(i), 48 + Math.cos(a) * 43, 48 + Math.sin(a) * 43);
  }
  texture.needsUpdate = true;
  const material = createPs1Material(
    { map: texture, transparent: true, alphaTest: 0.3 },
    true,
  );
  kit.materials.push(material);
  // The ticks reach 37 of 48 pixels out; size the plane to the knob.
  const plane = new Mesh(
    new PlaneGeometry((radius * 2 * 48) / 30, (radius * 2 * 48) / 30),
    material,
  );
  plane.position.z = 0.0004;
  return plane;
}

/**
 * A control knob. `collet`: a fluted black body with an aluminium cap and a
 * white line. `skirted`: the same over a wider skirt that carries the line
 * out to a printed scale. `instrument`: a big fluted black knob with a
 * bright insert, for main adjustments. `pointer`: a bar-shaped selector.
 */
export function createKnob(
  kit: PanelKit,
  {
    radius = 0.011,
    style = 'collet' as KnobStyle,
    scale = false,
    ink = '#f1ecdc',
    accent = '#b9bcbc',
    value = 0.5,
  } = {},
): Knob {
  const group = new Group();
  group.userData.sound = style === 'pointer' ? 'selector' : 'knob';
  const spindle = new Group();
  group.add(spindle);
  const black = kitPaint(kit, '#141414');
  const cap = kitPaint(kit, accent, 0.5);
  const line = kitPaint(kit, '#f2f0e8');
  if (scale) group.add(scaleRing(kit, radius * 1.15, ink));
  if (style === 'pointer') {
    peg(spindle, black, radius * 0.75, radius * 0.5, 0, 14);
    const bar = add(
      spindle,
      new BoxGeometry(radius * 0.7, radius * 2.4, radius * 0.9),
      black,
      0,
      radius * 0.2,
      radius * 0.95,
    );
    bar.scale.set(1, 1, 1);
    add(
      spindle,
      new BoxGeometry(radius * 0.18, radius * 1.1, 0.0008),
      line,
      0,
      radius * 0.75,
      radius * 1.42,
    );
  } else {
    const fluted = style === 'instrument' ? 12 : 18;
    if (style === 'skirted') {
      peg(spindle, black, radius * 1.45, radius * 0.25, 0, 22, radius * 1.5);
      add(
        spindle,
        new BoxGeometry(radius * 0.14, radius * 0.5, 0.0008),
        line,
        0,
        radius * 1.18,
        radius * 0.26,
      );
    }
    const height = style === 'instrument' ? radius * 1.1 : radius * 1.2;
    peg(spindle, black, radius * 0.94, height, 0, fluted, radius);
    peg(
      spindle,
      cap,
      radius * (style === 'instrument' ? 0.55 : 0.72),
      0.0012,
      height,
      16,
    );
    add(
      spindle,
      new BoxGeometry(radius * 0.13, radius * 0.75, 0.0008),
      style === 'instrument' ? black : line,
      0,
      radius * 0.45,
      height + 0.0014,
    );
  }
  const angle = (share: number) =>
    -((-135 + Math.max(0, Math.min(1, share)) * 270) * Math.PI) / 180;
  const turn = eased((a) => (spindle.rotation.z = a), angle(value), 10);
  return {
    group,
    spindle,
    set(next) {
      turn.to(angle(next));
    },
    update: turn.update,
  };
}

export interface Toggle {
  group: Group;
  lever: Group;
  set(up: boolean): void;
  update(delta: number): void;
}

/** A miniature bat-handle toggle: hex nut, threaded bushing, chrome lever. */
export function createToggle(kit: PanelKit, up = true): Toggle {
  const group = new Group();
  group.userData.sound = 'toggle';
  const chrome = kitPaint(kit, '#d2d5d5', 0.65);
  peg(group, kitPaint(kit, '#b8bbbb', 0.6), 0.0052, 0.0018, 0, 6);
  peg(group, chrome, 0.0032, 0.004, 0.0018, 10);
  const lever = new Group();
  lever.position.z = 0.0058;
  group.add(lever);
  const bat = add(
    lever,
    new CylinderGeometry(0.0013, 0.0019, 0.014, 8),
    chrome,
    0,
    0.007,
    0,
  );
  bat.name = 'bat';
  const tilt = (value: boolean) =>
    value ? Math.PI / 2 - 0.42 : Math.PI / 2 + 0.42;
  // A toggle snaps over centre: fast.
  const flip = eased((a) => (lever.rotation.x = a), tilt(up), 40);
  return {
    group,
    lever,
    set(value) {
      flip.to(tilt(value));
    },
    update: flip.update,
  };
}

export interface Rocker {
  group: Group;
  rocker: Mesh;
  set(on: boolean): void;
  update(delta: number): void;
}

/**
 * An illuminated rocker mains switch: a black rectangular bezel with a red
 * translucent rocker, lit when on, marked I and O.
 */
export function createRocker(kit: PanelKit, on = false): Rocker {
  const group = new Group();
  group.userData.sound = 'rocker';
  add(
    group,
    new BoxGeometry(0.022, 0.03, 0.004),
    kitPaint(kit, '#121213'),
    0,
    0,
    0.002,
  );
  const lens = kitGlow(kit, '#7a1f16');
  const rocker = add(
    group,
    new BoxGeometry(0.016, 0.024, 0.006),
    lens,
    0,
    0,
    0.005,
  );
  const mark = kitPaint(kit, '#f2e8de');
  add(rocker, new BoxGeometry(0.0016, 0.006, 0.0008), mark, 0, 0.006, 0.0032);
  const ring = add(
    rocker,
    new TorusGeometry(0.0026, 0.0006, 4, 10),
    mark,
    0,
    -0.006,
    0.0032,
  );
  ring.name = 'O';
  const rock = eased((a) => (rocker.rotation.x = a), on ? -0.18 : 0.18, 35);
  lens.color.set(on ? '#ff4a2e' : '#7a1f16');
  return {
    group,
    rocker,
    set(value) {
      rock.to(value ? -0.18 : 0.18);
      lens.color.set(value ? '#ff4a2e' : '#7a1f16');
    },
    update: rock.update,
  };
}

export interface KeySwitch {
  group: Group;
  key: Group;
  set(on: boolean): void;
  update(delta: number): void;
}

/** A chrome key switch barrel with its key left in, turned 0 or I. */
export function createKeySwitch(kit: PanelKit, on = false): KeySwitch {
  const group = new Group();
  group.userData.sound = 'key-switch';
  const chrome = kitPaint(kit, '#c9cccc', 0.65);
  peg(group, chrome, 0.0105, 0.003, 0, 18);
  peg(group, kitPaint(kit, '#9fa3a3', 0.6), 0.0085, 0.004, 0.003, 18);
  const key = new Group();
  key.position.z = 0.007;
  group.add(key);
  const brass = kitPaint(kit, '#b99b52', 0.6);
  add(key, new BoxGeometry(0.0022, 0.009, 0.006), brass, 0, 0, 0.003);
  add(
    key,
    new BoxGeometry(0.0028, 0.016, 0.012),
    kitPaint(kit, '#1c1c1d'),
    0,
    0,
    0.011,
  );
  const twist = eased((a) => (key.rotation.z = a), on ? -Math.PI / 4 : 0, 9);
  return {
    group,
    key,
    set(value) {
      twist.to(value ? -Math.PI / 4 : 0);
    },
    update: twist.update,
  };
}

export interface SlideSwitch {
  group: Group;
  slider: Mesh;
  set(position: number): void;
  update(delta: number): void;
}

/** A slide switch in a slot, with `positions` stops along it. */
export function createSlideSwitch(
  kit: PanelKit,
  positions = 2,
  at = 0,
): SlideSwitch {
  const group = new Group();
  group.userData.sound = 'slide';
  const travel = 0.004 * (positions - 1);
  add(
    group,
    new BoxGeometry(0.006, travel + 0.008, 0.001),
    kitPaint(kit, '#0c0c0d'),
    0,
    0,
    0.0005,
  );
  const slider = add(
    group,
    new BoxGeometry(0.004, 0.005, 0.005),
    kitPaint(kit, '#2a2a2b'),
    0,
    0,
    0.0035,
  );
  const y = (position: number) =>
    travel / 2 - Math.max(0, Math.min(positions - 1, position)) * 0.004;
  const move = eased((v) => (slider.position.y = v), y(at), 25);
  return {
    group,
    slider,
    set(position) {
      move.to(y(position));
    },
    update: move.update,
  };
}

export interface Keycap {
  group: Group;
  cap: Mesh;
  press(): void;
  update(delta: number): void;
}

/**
 * A low calculator-style keycap with its legend printed on top: wider than
 * tall, slightly dished, for keypads and function rows.
 */
export function createKeycap(
  kit: PanelKit,
  legend: string,
  { width = 0.014, height = 0.011, colour = '#d8d6cc', ink = '#1d1d1a' } = {},
): Keycap {
  const group = new Group();
  group.userData.sound = 'key';
  const px = 48;
  const { context: c, texture } = createCanvasTexture(
    Math.round((px * width) / height),
    px,
  );
  kit.textures.push(texture);
  c.fillStyle = colour;
  c.fillRect(0, 0, c.canvas.width, px);
  c.fillStyle = 'rgba(255,255,255,0.18)';
  c.fillRect(0, 0, c.canvas.width, 4);
  c.fillStyle = 'rgba(0,0,0,0.2)';
  c.fillRect(0, px - 4, c.canvas.width, 4);
  c.fillStyle = ink;
  c.font = `bold ${legend.length > 3 ? 15 : 22}px ${PANEL_FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(legend, c.canvas.width / 2, px / 2 + 1, c.canvas.width - 6);
  texture.needsUpdate = true;
  const top = createPs1Material({ map: texture });
  kit.materials.push(top);
  const side = kitPaint(kit, colour);
  const depth = 0.005;
  add(
    group,
    new BoxGeometry(width + 0.002, height + 0.002, 0.0015),
    kitPaint(kit, '#0f0f10'),
    0,
    0,
    0.00075,
  );
  const cap = add(
    group,
    new BoxGeometry(width, height, depth),
    [side, side, side, side, top, side],
    0,
    0,
    0.0015 + depth / 2,
  );
  cap.name = `Key ${legend}`;
  const rest = cap.position.z;
  let held = 0;
  return {
    group,
    cap,
    press() {
      held = 0.15;
    },
    update(delta) {
      held = Math.max(0, held - delta);
      const target = held > 0 ? rest - 0.002 : rest;
      cap.position.z += (target - cap.position.z) * Math.min(1, delta * 30);
    },
  };
}

/**
 * A keypad: rows of keycaps on a pitch. Keys whose legend is in `accents`
 * get the accent colour.
 */
export function createKeypad(
  kit: PanelKit,
  rows: string[][],
  {
    pitch = 0.017,
    width = 0.014,
    height = 0.012,
    colour = '#d8d6cc',
    accents = {} as Record<string, string>,
  } = {},
) {
  const group = new Group();
  const keys: Keycap[] = [];
  rows.forEach((row, r) =>
    row.forEach((legend, k) => {
      const key = createKeycap(kit, legend, {
        width,
        height,
        colour: accents[legend] ?? colour,
      });
      key.group.position.set(
        (k - (row.length - 1) / 2) * pitch,
        ((rows.length - 1) / 2 - r) * pitch * 0.9,
        0,
      );
      group.add(key.group);
      keys.push(key);
    }),
  );
  return { group, keys };
}

/** A BNC socket: hex flange, barrel and bayonet pins. */
export function createBnc(kit: PanelKit) {
  const group = new Group();
  const nickel = kitPaint(kit, '#cfd2d2', 0.65);
  peg(group, kitPaint(kit, '#b5b8b8', 0.6), 0.0062, 0.002, 0, 6);
  peg(group, nickel, 0.0048, 0.011, 0.002, 12);
  peg(group, kitPaint(kit, '#e9e5d6'), 0.0028, 0.0004, 0.0131, 10);
  for (const s of [-1, 1])
    add(
      group,
      new BoxGeometry(0.0016, 0.0016, 0.0016),
      nickel,
      s * 0.0052,
      0,
      0.009,
    );
  return { group };
}

/** A 4 mm banana socket in a coloured plastic shroud. */
export function createBananaJack(kit: PanelKit, colour = '#c62a1e') {
  const group = new Group();
  peg(group, kitPaint(kit, colour), 0.0055, 0.008, 0, 10, 0.006);
  peg(group, kitPaint(kit, '#0a0a0a'), 0.0021, 0.0004, 0.008, 8);
  return { group };
}

/** A black finned heatsink standing proud of a panel. */
export function createHeatsink(
  kit: PanelKit,
  width: number,
  height: number,
  { fins = 14, depth = 0.05 } = {},
) {
  const group = new Group();
  const black = kitPaint(kit, '#18181a');
  add(
    group,
    new BoxGeometry(width, height, 0.008),
    kitPaint(kit, '#202022'),
    0,
    0,
    0.004,
  );
  const pitch = width / fins;
  for (let i = 0; i < fins; i++)
    add(
      group,
      new BoxGeometry(pitch * 0.32, height * 0.98, depth),
      black,
      (i - (fins - 1) / 2) * pitch,
      0,
      0.008 + depth / 2,
    );
  return { group };
}

export interface KeyLockedKnob {
  group: Group;
  /** The knob's handle, which a click turns when unlocked. */
  handle: Group;
  /** The key in the hub, which a click turns to lock or unlock. */
  key: Group;
  readonly unlocked: boolean;
  readonly position: number;
  /** Turn the key: lock an unlocked knob, unlock a locked one. */
  toggleLock(): void;
  /** Step to the next position; refused, with a jiggle, while locked. */
  turn(): boolean;
  update(delta: number): void;
}

/**
 * A key-operated selector: a black bar knob whose hub is a chrome lock
 * barrel with its key left in. The knob turns between `positions` stops
 * 60 degrees apart, but only once the key has been turned to unlock it;
 * locked, it gives a little and springs back.
 */
export function createKeyLockedKnob(
  kit: PanelKit,
  {
    radius = 0.014,
    positions = 3,
    position = 0,
    unlocked = false,
    ink = '#f1ecdc',
  } = {},
): KeyLockedKnob {
  const group = new Group();
  const black = kitPaint(kit, '#141414');
  const chrome = kitPaint(kit, '#cdd0d0', 0.65);
  const step = Math.PI / 3;
  const angle = (stop: number) => -(stop - (positions - 1) / 2) * step;
  // The printed stops: a tick and a number at each.
  const size = 96;
  const { context: c, texture } = createCanvasTexture(size, size);
  kit.textures.push(texture);
  c.strokeStyle = ink;
  c.fillStyle = ink;
  c.lineWidth = 3;
  c.font = `bold 13px ${PANEL_FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  for (let i = 0; i < positions; i++) {
    const a = -Math.PI / 2 - angle(i);
    c.beginPath();
    c.moveTo(48 + Math.cos(a) * 31, 48 + Math.sin(a) * 31);
    c.lineTo(48 + Math.cos(a) * 37, 48 + Math.sin(a) * 37);
    c.stroke();
    c.fillText(String(i), 48 + Math.cos(a) * 43, 48 + Math.sin(a) * 43);
  }
  texture.needsUpdate = true;
  const scaleMaterial = createPs1Material(
    { map: texture, transparent: true, alphaTest: 0.3 },
    true,
  );
  kit.materials.push(scaleMaterial);
  const scale = new Mesh(
    new PlaneGeometry((radius * 2.3 * 48) / 30, (radius * 2.3 * 48) / 30),
    scaleMaterial,
  );
  scale.position.z = 0.0004;
  group.add(scale);
  // The handle: a round hub with a bar across it, pointer line at one end.
  const handle = new Group();
  handle.name = 'selector handle';
  // It clicks over when unlocked and rattles against its stop when not.
  handle.userData.sound = () => (isUnlocked ? 'selector' : 'locked');
  group.add(handle);
  peg(handle, black, radius, radius * 0.7, 0, 20, radius * 1.05);
  add(
    handle,
    new BoxGeometry(radius * 0.75, radius * 2.7, radius * 1.0),
    black,
    0,
    0,
    radius * 0.5 + radius * 0.5,
  );
  add(
    handle,
    new BoxGeometry(radius * 0.16, radius * 0.9, 0.0008),
    kitPaint(kit, '#f2f0e8'),
    0,
    radius * 0.85,
    radius * 1.51,
  );
  // The lock barrel set in the hub, standing just proud of the bar. It
  // belongs to the key, so a click anywhere on the hub turns the key, and
  // its plug turns with the key as a real lock's does.
  const key = new Group();
  key.name = 'selector key';
  key.userData.sound = 'key-switch';
  key.position.z = radius * 1.56;
  handle.add(key);
  peg(key, chrome, radius * 0.48, radius * 1.15, -radius * 1.16, 16);
  peg(
    key,
    kitPaint(kit, '#8e9292', 0.6),
    radius * 0.36,
    0.0008,
    -radius * 0.01,
    14,
  );
  const brass = kitPaint(kit, '#b99b52', 0.6);
  add(
    key,
    new BoxGeometry(radius * 0.14, radius * 0.5, radius * 0.5),
    brass,
    0,
    0,
    radius * 0.25,
  );
  add(
    key,
    new BoxGeometry(radius * 0.18, radius * 1.1, radius * 0.75),
    kitPaint(kit, '#c3c6c6', 0.6),
    0,
    0,
    radius * 0.85,
  );
  let isUnlocked = unlocked;
  let at = Math.max(0, Math.min(positions - 1, position));
  let jiggle = 0;
  const twist = eased(
    (a) => (key.rotation.z = a),
    unlocked ? -Math.PI / 2 : 0,
    9,
  );
  let handleAngle = angle(at);
  let shown = handleAngle;
  handle.rotation.z = shown;
  return {
    group,
    handle,
    key,
    get unlocked() {
      return isUnlocked;
    },
    get position() {
      return at;
    },
    toggleLock() {
      isUnlocked = !isUnlocked;
      twist.to(isUnlocked ? -Math.PI / 2 : 0);
    },
    turn() {
      if (!isUnlocked) {
        jiggle = 0.35;
        return false;
      }
      at = (at + 1) % positions;
      handleAngle = angle(at);
      return true;
    },
    update(delta) {
      twist.update(delta);
      shown += (handleAngle - shown) * Math.min(1, delta * 12);
      jiggle = Math.max(0, jiggle - delta);
      // A locked knob gives a few degrees and springs back.
      handle.rotation.z = shown - Math.sin(jiggle * 40) * jiggle * 0.18;
    },
  };
}

export interface PowerIsolator {
  group: Group;
  /** The red handle, which a click swings a quarter turn. */
  handle: Group;
  readonly on: boolean;
  toggle(): void;
  set(on: boolean): void;
  update(delta: number): void;
}

/**
 * A surface-mounted rotary power isolator in an IP65 enclosure: a light
 * grey moulded box on a black back, a yellow square plate and ring, and a
 * red handle that swings a quarter turn clockwise from OFF (across) to ON
 * (upright). A window in the ring shows the state. Real size, about
 * 115 x 160 mm and 105 mm deep, mounted on the face it is given.
 */
export function createPowerIsolator(
  kit: PanelKit,
  { on = false, rating = '4P  32A', maker = 'LABEL' } = {},
): PowerIsolator {
  const group = new Group();
  const w = 0.115;
  const h = 0.16;
  add(
    group,
    new BoxGeometry(w + 0.004, h + 0.004, 0.028),
    kitPaint(kit, '#1b1b1c'),
    0,
    0,
    0.014,
  );
  const grey = kitPaint(kit, '#d6d7d3');
  add(group, new BoxGeometry(w, h, 0.074), grey, 0, 0, 0.028 + 0.037);
  // A slightly smaller lid edge, as the moulding steps in at the front.
  add(
    group,
    new BoxGeometry(w - 0.006, h - 0.006, 0.004),
    kitPaint(kit, '#e1e2de'),
    0,
    0,
    0.104,
  );
  const face = 0.106;
  const hole = kitPaint(kit, '#3a3b3c');
  for (const [x, y] of [
    [0.028, 0.06],
    [0.028, -0.068],
  ])
    peg(group, hole, 0.004, 0.0008, face, 10).position.set(x, y, face + 0.0004);
  // Moulded maker's mark and rating.
  const printed = (
    text: string,
    x: number,
    y: number,
    ink: string,
    px: number,
    tilt = 0,
  ) => {
    const probe = createCanvasTexture(8, 8).context;
    probe.font = `bold ${px}px ${PANEL_FONT}`;
    const tw = Math.ceil(probe.measureText(text).width) + 8;
    const { context, texture } = createCanvasTexture(tw, px + 8);
    kit.textures.push(texture);
    context.font = probe.font;
    context.fillStyle = ink;
    context.textBaseline = 'middle';
    context.fillText(text, 4, (px + 8) / 2 + 1);
    if (text === maker) {
      context.strokeStyle = ink;
      context.lineWidth = 2;
      context.strokeRect(1, 1, tw - 2, px + 6);
    }
    texture.needsUpdate = true;
    const material = createPs1Material(
      { map: texture, transparent: true, alphaTest: 0.3 },
      true,
    );
    kit.materials.push(material);
    const metres = 0.0005;
    const mesh = add(
      group,
      new PlaneGeometry(tw * metres, (px + 8) * metres),
      material,
      x,
      y,
      face + 0.0004,
    );
    mesh.rotation.z = tilt;
    return mesh;
  };
  printed(maker, -0.026, 0.058, '#b3261e', 22);
  printed(rating, -0.02, -0.066, '#3a3b3c', 26, 0.06);
  // The yellow plate and ring.
  const yellow = kitPaint(kit, '#f2c418');
  const plateY = -0.004;
  add(
    group,
    new BoxGeometry(0.078, 0.078, 0.005),
    yellow,
    0.004,
    plateY,
    face + 0.0025,
  );
  const ring = peg(group, yellow, 0.037, 0.012, face + 0.005, 28, 0.039);
  ring.position.x = 0.004;
  ring.position.y = plateY;
  // The state window at the top of the ring, redrawn when it changes.
  const { context: wc, texture: windowTexture } = createCanvasTexture(48, 20);
  kit.textures.push(windowTexture);
  const windowMaterial = createPs1Material({ map: windowTexture }, true);
  kit.materials.push(windowMaterial);
  const window = add(
    group,
    new PlaneGeometry(0.013, 0.0055),
    windowMaterial,
    0.004,
    plateY + 0.031,
    face + 0.0172,
  );
  window.name = 'state window';
  const drawWindow = (value: boolean) => {
    wc.fillStyle = '#f4f2ea';
    wc.fillRect(0, 0, 48, 20);
    wc.fillStyle = value ? '#1d6b2a' : '#c0261c';
    wc.font = `bold 15px ${PANEL_FONT}`;
    wc.textAlign = 'center';
    wc.textBaseline = 'middle';
    wc.fillText(value ? 'ON' : 'OFF', 24, 11);
    windowTexture.needsUpdate = true;
  };
  // The red handle: a disc with a bar across it.
  const red = kitPaint(kit, '#d42a1c');
  const handle = new Group();
  handle.name = 'isolator handle';
  group.name = 'power isolator';
  group.userData.sound = 'isolator';
  handle.position.set(0.004, plateY, face + 0.017);
  group.add(handle);
  peg(handle, red, 0.028, 0.006, 0, 24, 0.029);
  peg(handle, kitPaint(kit, '#b8231a'), 0.022, 0.002, 0.006, 20);
  add(handle, new BoxGeometry(0.072, 0.017, 0.016), red, 0, 0, 0.014);
  add(
    handle,
    new BoxGeometry(0.06, 0.004, 0.0008),
    kitPaint(kit, '#e8483a'),
    0,
    0.006,
    0.0224,
  );
  let isOn = on;
  drawWindow(isOn);
  const swing = eased(
    (a) => (handle.rotation.z = a),
    on ? -Math.PI / 2 : 0,
    18,
  );
  const isolator: PowerIsolator = {
    group,
    handle,
    get on() {
      return isOn;
    },
    set(value) {
      if (value === isOn) return;
      isOn = value;
      swing.to(isOn ? -Math.PI / 2 : 0);
      drawWindow(isOn);
    },
    toggle() {
      isolator.set(!isOn);
    },
    update: swing.update,
  };
  return isolator;
}
