import {
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  TorusGeometry,
} from 'three';
import type {
  BufferGeometry,
  Material,
  MeshBasicMaterial,
  Object3D,
} from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { PANEL_FONT, kitGlow, kitPaint } from './eighties-controls';
import type { PanelKit } from './eighties-controls';
import { createCanvasTexture } from './screens';

/**
 * Indicators and displays for the 1980s panels: a rectangular moving-coil
 * panel meter, a round gauge in a chrome bezel, a character LCD, a
 * blue-green vacuum fluorescent display, an amber LED dot matrix and a
 * faceted jewel lamp. Real size in metres, back on the panel face, facing
 * +z. Needles ease toward their reading in `update`.
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
const printed = (
  kit: PanelKit,
  map: ReturnType<typeof createCanvasTexture>['texture'],
  glow = false,
) => {
  kit.textures.push(map);
  const material = createPs1Material({ map }, true, glow);
  kit.materials.push(material);
  return material as MeshBasicMaterial;
};

export interface Needle {
  group: Group;
  /** Set the reading, 0 to 1 across the scale. */
  set(value: number): void;
  update(delta: number): void;
}

function easedNeedle(pivot: Group, sweep: number, start: number) {
  let target = 0;
  let shown = 0;
  return {
    set(value: number) {
      target = Math.max(0, Math.min(1, value));
    },
    update(delta: number) {
      shown += (target - shown) * Math.min(1, delta * 4);
      pivot.rotation.z = -(start + shown * sweep);
    },
  };
}

/**
 * A moving-coil panel meter: a black moulded case with a clear front, a
 * cream scale with a red band, the unit printed under it, a black needle
 * pivoting below the scale and the zero-adjust screw.
 */
export function createPanelMeter(
  kit: PanelKit,
  unit: string,
  {
    width = 0.07,
    redFrom = 0.8,
    /** The value printed at full scale. */
    scaleMax = 10,
    /** A coloured band across part of the scale, 0 to 1, instead of the red one. */
    band = null as { from: number; to: number; colour: string } | null,
  } = {},
): Needle {
  const group = new Group();
  const h = width * 0.72;
  const w = 128;
  const ph = Math.round(w * 0.72);
  const art = createCanvasTexture(w, ph);
  const c = art.context;
  c.fillStyle = '#efe9d6';
  c.fillRect(0, 0, w, ph);
  const cx = w / 2;
  const cy = ph * 1.05;
  const r = ph * 0.82;
  const arc = (from: number, to: number) => {
    c.beginPath();
    c.arc(
      cx,
      cy,
      r,
      Math.PI * (1.25 + from * 0.5),
      Math.PI * (1.25 + to * 0.5),
    );
    c.stroke();
  };
  c.strokeStyle = '#2b2a24';
  c.lineWidth = 1.5;
  arc(0, 1);
  c.strokeStyle = band?.colour ?? '#b8342a';
  c.lineWidth = 4;
  arc(band?.from ?? redFrom, band?.to ?? 1);
  c.strokeStyle = '#2b2a24';
  c.fillStyle = '#2b2a24';
  c.font = `bold 9px ${PANEL_FONT}`;
  c.textAlign = 'center';
  for (let i = 0; i <= 20; i++) {
    const a = Math.PI * (1.25 + (i / 20) * 0.5);
    const long = i % 5 === 0;
    c.lineWidth = long ? 1.6 : 1;
    c.beginPath();
    c.moveTo(
      cx + Math.cos(a) * (r - (long ? 9 : 5)),
      cy + Math.sin(a) * (r - (long ? 9 : 5)),
    );
    c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    c.stroke();
    if (long)
      c.fillText(
        String(+((i / 20) * scaleMax).toFixed(2)).replace(/^0\./, '.'),
        cx + Math.cos(a) * (r - 16),
        cy + Math.sin(a) * (r - 16) + 3,
      );
  }
  c.font = `bold 13px ${PANEL_FONT}`;
  c.fillText(unit, cx, ph - 12);
  art.texture.needsUpdate = true;
  // Case, then the face set back inside it, then the clear front's rim.
  add(
    group,
    new BoxGeometry(width + 0.01, h + 0.01, 0.012),
    kitPaint(kit, '#141416'),
    0,
    0,
    0.006,
  );
  // Face, needle, shroud and hub each a millimetre clear of the one
  // behind, so they never flicker into each other.
  add(
    group,
    new PlaneGeometry(width, h),
    printed(kit, art.texture),
    0,
    0,
    0.013,
  );
  const rim = kitPaint(kit, '#2a2b2e');
  for (const s of [-1, 1]) {
    add(
      group,
      new BoxGeometry(width + 0.01, 0.003, 0.003),
      rim,
      0,
      s * (h / 2 + 0.0035),
      0.0135,
    );
    add(
      group,
      new BoxGeometry(0.003, h + 0.01, 0.003),
      rim,
      s * (width / 2 + 0.0035),
      0,
      0.0135,
    );
  }
  // The black lower shroud hiding the pivot, as on real meters.
  add(
    group,
    new BoxGeometry(width, h * 0.2, 0.002),
    kitPaint(kit, '#1b1b1d'),
    0,
    -h * 0.4,
    0.0148,
  );
  add(
    group,
    new CylinderGeometry(0.0022, 0.0022, 0.001, 10),
    kitPaint(kit, '#bfc2c2', 0.6),
    0,
    -h * 0.4,
    0.0165,
  ).rotation.x = Math.PI / 2;
  const pivot = new Group();
  pivot.position.set(0, h / 2 - cy * (h / ph), 0.014);
  group.add(pivot);
  const length = (r / ph) * h * 0.98;
  add(
    pivot,
    new BoxGeometry(0.0008, length, 0.0005),
    kitPaint(kit, '#1e1e1a'),
    0,
    length / 2,
    0,
  );
  const needle = easedNeedle(pivot, Math.PI / 2, -Math.PI / 4);
  needle.update(1);
  return { group, ...needle };
}

/**
 * A round gauge: chrome bezel ring, black case, cream dial with a 270-degree
 * scale and a red limit, a needle and a glass that catches the light.
 */
export function createRoundGauge(
  kit: PanelKit,
  {
    radius = 0.05,
    redFrom = 0.8,
    label = 'mbar',
    /** The value printed at full scale. */
    scaleMax = 5,
  } = {},
): Needle {
  const group = new Group();
  const size = 128;
  const art = createCanvasTexture(size, size);
  const c = art.context;
  const m = size / 2;
  c.fillStyle = '#ece6d2';
  c.fillRect(0, 0, size, size);
  const toCanvas = (share: number) =>
    ((-135 + share * 270 - 90) * Math.PI) / 180;
  c.strokeStyle = '#c43a22';
  c.lineWidth = 6;
  c.beginPath();
  c.arc(m, m, 50, toCanvas(redFrom), toCanvas(1));
  c.stroke();
  c.strokeStyle = '#26251f';
  c.fillStyle = '#26251f';
  c.font = `bold 11px ${PANEL_FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  for (let i = 0; i <= 50; i++) {
    const a = toCanvas(i / 50);
    const long = i % 5 === 0;
    c.lineWidth = long ? 2 : 1;
    c.beginPath();
    c.moveTo(
      m + Math.cos(a) * (long ? 44 : 48),
      m + Math.sin(a) * (long ? 44 : 48),
    );
    c.lineTo(m + Math.cos(a) * 54, m + Math.sin(a) * 54);
    c.stroke();
    if (i % 10 === 0)
      c.fillText(
        String(+((i / 50) * scaleMax).toFixed(2)).replace(/^0\./, '.'),
        m + Math.cos(a) * 35,
        m + Math.sin(a) * 35,
      );
  }
  c.font = `bold 10px ${PANEL_FONT}`;
  c.fillText(label, m, m + 26);
  art.texture.needsUpdate = true;
  // The face, needle and hub each stand clear of the layer below by at
  // least a millimetre, so small gauges do not flicker into their bodies.
  const front = radius * 0.24;
  const faceZ = front + Math.max(radius * 0.005, 0.001);
  const needleZ = faceZ + 0.001;
  const chrome = kitPaint(kit, '#d4d7d7', 0.7);
  const ring = add(
    group,
    new TorusGeometry(radius, radius * 0.09, 6, 28),
    chrome,
    0,
    0,
    radius * 0.12,
  );
  ring.name = 'bezel';
  add(
    group,
    new CylinderGeometry(radius * 1.02, radius * 1.05, radius * 0.24, 28),
    kitPaint(kit, '#1d1e20'),
    0,
    0,
    radius * 0.12,
  ).rotation.x = Math.PI / 2;
  add(
    group,
    new CircleGeometry(radius * 0.97, 28),
    printed(kit, art.texture),
    0,
    0,
    faceZ,
  );
  const pivot = new Group();
  pivot.position.z = needleZ;
  group.add(pivot);
  const black = kitPaint(kit, '#1b1b18');
  add(
    pivot,
    new BoxGeometry(radius * 0.035, radius * 0.86, 0.0006),
    black,
    0,
    radius * 0.33,
    0,
  );
  add(
    group,
    new CylinderGeometry(radius * 0.07, radius * 0.07, 0.002, 10),
    black,
    0,
    0,
    needleZ + 0.0008,
  ).rotation.x = Math.PI / 2;
  const needle = easedNeedle(pivot, (Math.PI * 3) / 2, -(Math.PI * 3) / 4);
  needle.update(1);
  return { group, ...needle };
}

export interface TextDisplay {
  group: Group;
  show(lines: string[], on?: boolean): void;
}

/**
 * A reflective character LCD of `columns` by `rows` 5x7 cells: grey-green
 * glass, dark characters, behind a black bezel. It shows nothing when off.
 */
export function createCharacterLcd(
  kit: PanelKit,
  { columns = 16, rows = 2, cell = 0.0032 } = {},
): TextDisplay {
  const group = new Group();
  const cw = 12;
  const ch = 18;
  const art = createCanvasTexture(columns * cw + 8, rows * ch + 8);
  const width = (columns * cw + 8) * (cell / cw) * 1.6;
  const height = (rows * ch + 8) * (cell / cw) * 1.6;
  add(
    group,
    new BoxGeometry(width + 0.012, height + 0.012, 0.004),
    kitPaint(kit, '#202122'),
    0,
    0,
    0.002,
  );
  const face = printed(kit, art.texture);
  add(group, new PlaneGeometry(width, height), face, 0, 0, 0.0042);
  let last = '';
  const show = (lines: string[], on = true) => {
    const key = `${on}${lines.join('|')}`;
    if (key === last) return;
    last = key;
    const c = art.context;
    c.fillStyle = on ? '#a8b874' : '#7d8566';
    c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    for (let r = 0; r < rows; r++)
      for (let k = 0; k < columns; k++) {
        const x = 4 + k * cw;
        const y = 4 + r * ch;
        // Each cell's faint dot grid shows even when blank.
        c.fillStyle = on ? 'rgba(40,52,24,0.12)' : 'rgba(40,52,24,0.06)';
        c.fillRect(x + 1, y + 1, cw - 2, ch - 2);
      }
    if (on) {
      c.fillStyle = '#1f2914';
      c.font = 'bold 15px "Courier New", monospace';
      c.textBaseline = 'middle';
      c.textAlign = 'center';
      lines.slice(0, rows).forEach((line, r) => {
        for (let k = 0; k < Math.min(columns, line.length); k++)
          c.fillText(line[k], 4 + k * cw + cw / 2, 4 + r * ch + ch / 2 + 1);
      });
    }
    art.texture.needsUpdate = true;
  };
  show([], false);
  return { group, show };
}

/**
 * A vacuum fluorescent display: blue-green glowing characters on black
 * behind a smoked window, the period's sign of a modern instrument.
 */
export function createVfd(
  kit: PanelKit,
  { columns = 10, height = 0.009 } = {},
): TextDisplay {
  const group = new Group();
  const cw = 14;
  const ph = 24;
  const art = createCanvasTexture(columns * cw + 10, ph);
  const width = ((columns * cw + 10) / ph) * height;
  add(
    group,
    new BoxGeometry(width + 0.008, height + 0.008, 0.004),
    kitPaint(kit, '#111214'),
    0,
    0,
    0.002,
  );
  add(
    group,
    new PlaneGeometry(width, height),
    printed(kit, art.texture, true),
    0,
    0,
    0.0042,
  );
  let last = '';
  const show = (lines: string[], on = true) => {
    const text = lines[0] ?? '';
    const key = `${on}${text}`;
    if (key === last) return;
    last = key;
    const c = art.context;
    c.fillStyle = '#05100e';
    c.fillRect(0, 0, c.canvas.width, ph);
    c.font = `bold 18px ${PANEL_FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let k = 0; k < columns; k++) {
      const x = 5 + k * cw + cw / 2;
      c.fillStyle = '#0d2a26';
      c.fillText('8', x, ph / 2 + 1);
      if (on && text[k]) {
        c.fillStyle = '#6ff7d8';
        c.fillText(text[k], x, ph / 2 + 1);
      }
    }
    art.texture.needsUpdate = true;
  };
  show([], false);
  return { group, show };
}

export interface LedMatrix {
  group: Group;
  /** Light the dots for which `lit(column, row)` is true. */
  draw(lit: (column: number, row: number) => boolean): void;
}

/** An amber LED dot matrix behind a tinted window. */
export function createLedMatrix(
  kit: PanelKit,
  { columns = 8, rows = 5, pitch = 0.004, colour = '#ff9a2e' } = {},
): LedMatrix {
  const group = new Group();
  const px = 10;
  const art = createCanvasTexture(columns * px, rows * px);
  const width = columns * pitch;
  const height = rows * pitch;
  add(
    group,
    new BoxGeometry(width + 0.008, height + 0.008, 0.004),
    kitPaint(kit, '#2a1a0c'),
    0,
    0,
    0.002,
  );
  add(
    group,
    new PlaneGeometry(width, height),
    printed(kit, art.texture, true),
    0,
    0,
    0.0042,
  );
  let last = '';
  return {
    group,
    draw(lit) {
      let key = '';
      for (let r = 0; r < rows; r++)
        for (let k = 0; k < columns; k++) key += lit(k, r) ? '1' : '0';
      if (key === last) return;
      last = key;
      const c = art.context;
      c.fillStyle = '#1a0d05';
      c.fillRect(0, 0, columns * px, rows * px);
      for (let r = 0; r < rows; r++)
        for (let k = 0; k < columns; k++) {
          c.fillStyle = key[r * columns + k] === '1' ? colour : '#3a1f0c';
          c.beginPath();
          c.arc(k * px + px / 2, r * px + px / 2, px * 0.36, 0, Math.PI * 2);
          c.fill();
        }
      art.texture.needsUpdate = true;
    },
  };
}

export interface JewelLamp {
  group: Group;
  set(on: boolean): void;
}

/**
 * A faceted jewel indicator lamp: a chrome bezel and a domed coloured lens
 * cut in facets, lit from a filament bulb behind.
 */
export function createJewelLamp(
  kit: PanelKit,
  colour = '#ff4a2e',
  { radius = 0.007, on = false } = {},
): JewelLamp {
  const group = new Group();
  add(
    group,
    new CylinderGeometry(radius * 1.35, radius * 1.45, 0.004, 12),
    kitPaint(kit, '#cfd2d2', 0.65),
    0,
    0,
    0.002,
  ).rotation.x = Math.PI / 2;
  const lens = kitGlow(kit, colour);
  const dark = new Color(colour).multiplyScalar(0.3);
  const lit = new Color(colour);
  add(
    group,
    new CylinderGeometry(radius * 0.55, radius, radius * 0.9, 8),
    lens,
    0,
    0,
    0.004 + radius * 0.45,
  ).rotation.x = Math.PI / 2;
  const made: JewelLamp = {
    group,
    set(value) {
      lens.color.copy(value ? lit : dark);
    },
  };
  made.set(on);
  return made;
}
