import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
} from 'three';
import type {
  BufferGeometry,
  Material,
  MeshBasicMaterial,
  Texture,
} from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { drawButtonFinish } from './button-finish';
import { createCanvasTexture } from './screens';

/**
 * Panel hardware of the mid-1980s refit, for compact control panels: square
 * illuminated push buttons with their legends printed on the cap, panel
 * LEDs in chrome bezels, seven-segment readouts behind smoked windows, LED
 * bar graphs and small printed lettering. Everything is built at real size
 * in metres; a caller scales the group to world units.
 */

/** The narrow sans of the period's front-panel lettering. */
const PANEL_FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

export interface PanelKit {
  materials: Material[];
  textures: Texture[];
}

export function createPanelKit(): PanelKit {
  return { materials: [], textures: [] };
}

function disposeKit(kit: PanelKit, root: Group) {
  root.traverse((object) => {
    if (object instanceof Mesh) (object.geometry as BufferGeometry).dispose();
  });
  for (const material of kit.materials) material.dispose();
  for (const texture of kit.textures) texture.dispose();
}

/** A lit material kept in the kit for disposal. */
export const kitPaint = (kit: PanelKit, color: string, metalness = 0) => {
  const material = createPs1Material({ color, metalness });
  kit.materials.push(material);
  return material;
};
const paint = kitPaint;

/** A self-lit material whose colour a part changes to light it. */
export const kitGlow = (kit: PanelKit, color: string) => {
  const material = createPs1Material(
    { color },
    true,
    true,
  ) as MeshBasicMaterial;
  kit.materials.push(material);
  return material;
};

export { PANEL_FONT };

/**
 * Small printed lettering: silk-screened legends a few millimetres high. The
 * texture is drawn at a fixed pixel height per line so a long legend stays
 * as crisp as a short one; `height` is the printed cap height in metres.
 */
export function createMicroLabel(
  kit: PanelKit,
  text: string,
  {
    height = 0.004,
    ink = '#f1ecdc',
    plate = null as string | null,
    bold = true,
    align = 'center' as 'center' | 'left' | 'right',
    font = PANEL_FONT,
  } = {},
) {
  const px = 16;
  const lines = text.split('\n');
  const probe = createCanvasTexture(8, 8).context;
  probe.font = `${bold ? 'bold ' : ''}${px}px ${font}`;
  const textWidth = Math.max(...lines.map((l) => probe.measureText(l).width));
  const pad = 4;
  const w = Math.ceil(textWidth) + pad * 2;
  const lineHeight = Math.round(px * 1.15);
  const h = lineHeight * lines.length + pad;
  const { context, texture } = createCanvasTexture(w, h);
  if (plate) {
    context.fillStyle = plate;
    context.fillRect(0, 0, w, h);
  }
  context.fillStyle = ink;
  context.font = probe.font;
  context.textBaseline = 'middle';
  context.textAlign = align;
  const x = align === 'center' ? w / 2 : align === 'left' ? pad : w - pad;
  lines.forEach((line, i) =>
    context.fillText(line, x, pad / 2 + lineHeight * (i + 0.5) + 1),
  );
  texture.needsUpdate = true;
  kit.textures.push(texture);
  // Cap height is about 0.72 of the font size.
  const metresPerPixel = height / (px * 0.72);
  const material = createPs1Material(
    { map: texture, transparent: !plate, alphaTest: plate ? 0 : 0.35 },
    true,
  );
  kit.materials.push(material);
  const mesh = new Mesh(
    new PlaneGeometry(w * metresPerPixel, h * metresPerPixel),
    material,
  );
  mesh.name = `Label ${text}`;
  return mesh;
}

export type CapColour = 'red' | 'amber' | 'green' | 'blue' | 'white' | 'grey';

const CAP: Record<CapColour, { lit: string; dark: string; ink: string }> = {
  red: { lit: '#ff5a3c', dark: '#7a2a20', ink: '#2a0d08' },
  amber: { lit: '#ffb43a', dark: '#7d5420', ink: '#2e1d06' },
  green: { lit: '#7dff74', dark: '#2f6a33', ink: '#0c240e' },
  blue: { lit: '#7fc8ff', dark: '#2c4e6e', ink: '#0b1a28' },
  white: { lit: '#fff8e4', dark: '#a9a597', ink: '#2a2924' },
  grey: { lit: '#c9c6bb', dark: '#8e8b82', ink: '#1d1d1a' },
};

/** German counting words for rows of otherwise identical buttons: EINS, ZWEI, DREI … */
export const GERMAN_COUNT = [
  'EINS',
  'ZWEI',
  'DREI',
  'VIER',
  'FÜNF',
  'SECHS',
  'SIEBEN',
  'ACHT',
  'NEUN',
  'ZEHN',
] as const;

function capTexture(kit: PanelKit, legend: string, ink: string, shift = 0) {
  const size = 64;
  const { context, texture } = createCanvasTexture(size, size);
  // Near-white moulding under the tint keeps lit and unlit cap colours intact.
  drawButtonFinish(
    context,
    size,
    size,
    '#f8f7f3',
    [...legend].reduce((n, letter) => n * 31 + letter.charCodeAt(0), 117),
  );
  context.strokeStyle = 'rgba(0,0,0,0.18)';
  context.lineWidth = 3;
  context.strokeRect(1.5, 1.5, size - 3, size - 3);
  const lines = legend.split('\n');
  const px = lines.length > 1 ? 15 : lines[0].length > 4 ? 14 : 18;
  context.font = `bold ${px}px ${PANEL_FONT}`;
  context.fillStyle = ink;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  lines.forEach((line, i) =>
    context.fillText(
      line,
      size / 2,
      size / 2 + shift + (i - (lines.length - 1) / 2) * (px + 2),
      size - 8,
    ),
  );
  texture.needsUpdate = true;
  kit.textures.push(texture);
  return texture;
}

export interface EightiesButton {
  group: Group;
  /** The part that takes a click. */
  cap: Mesh;
  /** Latching buttons stay in and lit once pressed; momentary ones spring back. */
  latching: boolean;
  lit: boolean;
  /**
   * Whether its light is on, when that is not simply whether it is pressed
   * in: an unpowered latching button stays in, dark. Left null, it lights
   * while pressed in.
   */
  glow: boolean | null;
  /** Press the button: a latching one toggles, a momentary one flashes in. */
  press(): void;
  update(delta: number): void;
}

/**
 * A square push button of the 1980s: a black bezel flush with the panel and
 * a cap standing a few millimetres proud with its legend printed on it. The
 * 1970s rack uses big painted blocks; these are 19 mm on the bezel and sit
 * in rows. By default the cap is translucent and lit from behind when
 * engaged. Give `led` a colour for the other common kind: a plain coloured
 * cap with a small LED window set into its top edge, which lights in that
 * colour instead. `illuminated` lights the cap as well as the LED.
 */
export interface EightiesButtonOptions {
  latching?: boolean;
  size?: number;
  lit?: boolean;
  /** The colour of an LED window in the cap, or none. */
  led?: CapColour | null;
  /** Whether the cap itself lights; by default only when there is no LED. */
  illuminated?: boolean;
}

export function createEightiesButton(
  kit: PanelKit,
  legend: string,
  colour: CapColour = 'amber',
  options: EightiesButtonOptions = {},
): EightiesButton {
  const {
    latching = true,
    size = 0.019,
    lit = false,
    led = null,
    illuminated = led === null,
  } = options;
  const group = new Group();
  group.name = `Button ${legend}`;
  group.userData.sound = 'button';
  const bezel = new Mesh(
    new BoxGeometry(size, size, 0.003),
    paint(kit, '#15161a'),
  );
  bezel.position.z = 0.0015;
  group.add(bezel);
  const capSize = size * 0.78;
  const style = CAP[colour];
  // An unlit cap is ordinary coloured plastic that takes the room's light.
  const plastic = new Color(style.lit).lerp(new Color(style.dark), 0.35);
  const capMaterial = createPs1Material(
    {
      map: capTexture(kit, legend, style.ink, led ? 7 : 0),
      color: illuminated ? style.dark : plastic,
      roughness: 0.52,
    },
    illuminated,
    illuminated,
  ) as MeshBasicMaterial;
  kit.materials.push(capMaterial);
  const sideMaterial = createPs1Material(
    {
      color: illuminated ? style.dark : plastic.clone().multiplyScalar(0.8),
      roughness: 0.54,
    },
    illuminated,
    illuminated,
  ) as MeshBasicMaterial;
  kit.materials.push(sideMaterial);
  const depth = 0.006;
  // Box faces: +x, -x, +y, -y, +z (front), -z.
  const cap = new Mesh(new BoxGeometry(capSize, capSize, depth), [
    sideMaterial,
    sideMaterial,
    sideMaterial,
    sideMaterial,
    capMaterial,
    sideMaterial,
  ]);
  const outZ = 0.003 + depth / 2;
  const inZ = outZ - 0.0028;
  cap.position.z = outZ;
  cap.name = `Button cap ${legend}`;
  group.add(cap);
  // The LED window rides on the cap, so it goes in when pressed.
  const ledStyle = led ? CAP[led] : null;
  const ledMaterial = ledStyle ? kitGlow(kit, ledStyle.dark) : null;
  if (ledMaterial) {
    const window = new Mesh(
      new BoxGeometry(capSize * 0.46, capSize * 0.14, 0.0008),
      ledMaterial,
    );
    window.position.set(0, capSize * 0.3, depth / 2 + 0.0002);
    cap.add(window);
  }
  const litColour = new Color(style.lit);
  const darkColour = new Color(style.dark);
  let held = 0;
  const button: EightiesButton = {
    group,
    cap,
    latching,
    lit,
    glow: null,
    press() {
      // Every press pushes the cap in; a latching one also toggles, and
      // stays in while lit. A refused press still dips, so it never feels dead.
      if (latching) button.lit = !button.lit;
      held = latching ? 0.12 : 0.18;
    },
    update(delta) {
      held = Math.max(0, held - delta);
      const on = button.glow ?? (button.lit || (!latching && held > 0));
      if (illuminated) {
        const shade = on ? litColour : darkColour;
        capMaterial.color.copy(shade);
        sideMaterial.color.copy(shade).multiplyScalar(on ? 0.75 : 0.85);
      }
      if (ledMaterial && ledStyle)
        ledMaterial.color.set(on ? ledStyle.lit : ledStyle.dark);
      const target = (latching && button.lit) || held > 0 ? inZ : outZ;
      cap.position.z += (target - cap.position.z) * Math.min(1, delta * 30);
    },
  };
  button.update(1);
  return button;
}

export interface PanelLed {
  group: Group;
  set(on: boolean): void;
}

/** A 5 mm panel LED in a chrome bezel. */
export function createPanelLed(
  kit: PanelKit,
  colour: CapColour = 'red',
  on = false,
): PanelLed {
  const group = new Group();
  const bezel = new Mesh(
    new CylinderGeometry(0.0042, 0.0046, 0.003, 12),
    paint(kit, '#b9bcbf', 0.6),
  );
  bezel.rotation.x = Math.PI / 2;
  bezel.position.z = 0.0015;
  group.add(bezel);
  const style = CAP[colour];
  const lens = createPs1Material(
    { color: style.dark },
    true,
    true,
  ) as MeshBasicMaterial;
  kit.materials.push(lens);
  const dome = new Mesh(new CylinderGeometry(0.0025, 0.0026, 0.004, 10), lens);
  dome.rotation.x = Math.PI / 2;
  dome.position.z = 0.004;
  group.add(dome);
  const led: PanelLed = {
    group,
    set(value) {
      lens.color.set(value ? style.lit : style.dark);
    },
  };
  led.set(on);
  return led;
}

/** Which of segments a–g light for each character a readout can show. */
const SEGMENTS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgedc',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
  ' ': '',
  E: 'afged',
  r: 'eg',
  H: 'fbgec',
  L: 'fed',
  P: 'abfge',
  A: 'abcefg',
  b: 'fgcde',
  C: 'afed',
  d: 'bcdeg',
  F: 'afge',
  o: 'gcde',
};

export interface SevenSegment {
  group: Group;
  show(text: string): void;
}

/**
 * A row of red seven-segment LED digits behind a smoked window, drawn on a
 * canvas each time the reading changes. `digits` sets the width.
 */
export function createSevenSegment(
  kit: PanelKit,
  digits = 4,
  { digitHeight = 0.014, colour = '#ff3b24' } = {},
): SevenSegment {
  const cellW = 40;
  const cellH = 64;
  const w = cellW * digits + 16;
  const h = cellH + 16;
  const { context, texture } = createCanvasTexture(w, h);
  kit.textures.push(texture);
  const group = new Group();
  const scale = digitHeight / (cellH - 16);
  const frame = new Mesh(
    new BoxGeometry(w * scale + 0.006, h * scale + 0.006, 0.003),
    paint(kit, '#141416'),
  );
  frame.position.z = 0.0015;
  group.add(frame);
  const material = createPs1Material(
    {
      map: texture,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    },
    true,
    true,
  );
  kit.materials.push(material);
  const window = new Mesh(new PlaneGeometry(w * scale, h * scale), material);
  window.position.z = frame.position.z + 0.003 / 2 + 0.001;
  group.add(window);
  const segment = (x: number, y: number, which: string, on: boolean) => {
    context.fillStyle = on ? colour : '#2b0e0a';
    const t = 6;
    const l = 22;
    const at: Record<string, [number, number, number, number]> = {
      a: [x + 8, y + 2, l, t],
      b: [x + 8 + l, y + 6, t, l],
      c: [x + 8 + l, y + 10 + l, t, l],
      d: [x + 8, y + 12 + 2 * l, l, t],
      e: [x + 2, y + 10 + l, t, l],
      f: [x + 2, y + 6, t, l],
      g: [x + 8, y + 7 + l, l, t],
    };
    const [sx, sy, sw, sh] = at[which];
    context.fillRect(sx, sy, sw, sh);
  };
  let last = '';
  const readout: SevenSegment = {
    group,
    show(text) {
      const value = text.padStart(digits).slice(-digits);
      if (value === last) return;
      last = value;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = '#120807';
      context.fillRect(0, 0, w, h);
      // A slight italic slant, as the period's displays had.
      context.setTransform(1, 0, -0.1, 1, 6, 0);
      for (let i = 0; i < digits; i++) {
        const lit = SEGMENTS[value[i]] ?? '';
        for (const s of 'abcdefg')
          segment(8 + i * cellW, 8, s, lit.includes(s));
      }
      texture.needsUpdate = true;
    },
  };
  readout.show('');
  return readout;
}

export interface BarGraph {
  group: Group;
  set(level: number): void;
}

/**
 * A vertical LED bar graph: green segments, then amber, then red at the top,
 * in a black moulding. `level` runs from 0 to 1.
 */
export function createBarGraph(
  kit: PanelKit,
  segments = 10,
  { pitch = 0.0035, width = 0.006 } = {},
): BarGraph {
  const group = new Group();
  const frame = new Mesh(
    new BoxGeometry(width + 0.004, segments * pitch + 0.004, 0.003),
    paint(kit, '#141416'),
  );
  frame.position.z = 0.0015;
  group.add(frame);
  const cells: { material: MeshBasicMaterial; on: string; off: string }[] = [];
  for (let i = 0; i < segments; i++) {
    const share = i / (segments - 1);
    const on = share > 0.85 ? '#ff4a2e' : share > 0.6 ? '#ffb43a' : '#7dff74';
    const off = share > 0.85 ? '#3a120c' : share > 0.6 ? '#3a2a10' : '#163a18';
    const material = createPs1Material(
      { color: off },
      true,
      true,
    ) as MeshBasicMaterial;
    kit.materials.push(material);
    const cell = new Mesh(
      new BoxGeometry(width, pitch * 0.72, 0.0012),
      material,
    );
    cell.position.set(0, (i - (segments - 1) / 2) * pitch, 0.0034);
    group.add(cell);
    cells.push({ material, on, off });
  }
  const graph: BarGraph = {
    group,
    set(level) {
      const lit = Math.round(Math.max(0, Math.min(1, level)) * segments);
      cells.forEach((cell, i) =>
        cell.material.color.set(i < lit ? cell.on : cell.off),
      );
    },
  };
  return graph;
}

export { disposeKit };
