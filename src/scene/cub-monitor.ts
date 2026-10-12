import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
} from 'three';
import type { BufferGeometry, Material, Texture } from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { createCanvasTexture, createLabelTexture } from './screens';

/** The screen as a BBC Micro left it: Mode 7 text after chaining the calibration program. */
function bootScreen() {
  const width = 320;
  const height = 240;
  const { context, texture } = createCanvasTexture(width, height);
  // The tube's rounded face, set in its black surround.
  context.fillStyle = '#0c0b0a';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#060807';
  context.beginPath();
  context.roundRect(4, 4, width - 8, height - 8, 22);
  context.fill();
  context.save();
  context.clip();
  context.font = 'bold 13px monospace';
  context.textBaseline = 'top';
  const lines: [string, string][] = [
    ['BBC Computer 32K', '#f2f2ee'],
    ['', ''],
    ['Acorn DFS', '#f2f2ee'],
    ['', ''],
    ['BASIC', '#f2f2ee'],
    ['', ''],
    ['>CHAIN "VX3CAL"', '#f2f2ee'],
    ['', ''],
    ['VX3 FIELD CALIBRATION  1.4', '#f4e04a'],
    ['UNIV. LEIPZIG  RAUM -02 17', '#5fe0e8'],
    ['', ''],
    ['SPINDLE  0000 RPM', '#6ef06e'],
    ['DELTA    0.000 / 0.880', '#6ef06e'],
    ['', ''],
    ['PRESS SPACE TO SAMPLE', '#f2f2ee'],
  ];
  for (const [i, [text, ink]] of lines.entries()) {
    context.fillStyle = ink;
    context.fillText(text, 18, 12 + i * 14.5);
  }
  // A faint reflection across the top left of the glass.
  const sheen = context.createLinearGradient(0, 0, width * 0.6, height * 0.6);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = sheen;
  context.fillRect(0, 0, width, height);
  context.restore();
  texture.needsUpdate = true;
  return { texture, width, height };
}

/**
 * A Microvitec Cub 14-inch colour monitor, the BBC Micro's usual companion:
 * a plain cream steel box with louvred sides, a brown bezel round a black
 * surround and a round-cornered tube, the maker's badge on a black tab at
 * the bottom left and a red power indicator at the bottom right.
 * The screen shows Mode 7 text with a blinking cursor and keeps glowing
 * when the room lights are off. Sizes are in metres; the group's origin is
 * the middle of its base and the screen faces +z.
 */
export function createCubMonitor(worldUnitsPerMetre: number) {
  const m = worldUnitsPerMetre;
  const group = new Group();
  group.name = 'MicrovitecCub';
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const part = (
    geometry: BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    glow = false,
  ) => {
    const material = createPs1Material({ color }, glow, glow);
    materials.push(material);
    const result = new Mesh(geometry, material);
    result.position.set(x * m, y * m, z * m);
    group.add(result);
    return result;
  };
  const box = (
    w: number,
    h: number,
    d: number,
    color: string,
    x: number,
    y: number,
    z: number,
    glow = false,
  ) => part(new BoxGeometry(w * m, h * m, d * m), color, x, y, z, glow);

  // The Science Museum's Cub measures 300 x 352 x 415 mm.
  const width = 0.415;
  const height = 0.352;
  const depth = 0.3;
  const front = depth / 2;
  const CASE = '#dcd2a9';
  const BEZEL = '#4a3b31';
  const SLOT = '#5d5747';

  // Plain steel cabinet, its sides louvred near the front and split by a
  // seam a third of the way up.
  box(width, height, depth - 0.02, CASE, 0, height / 2, -0.01);
  for (const side of [-1, 1]) {
    const x = side * (width / 2 + 0.001);
    for (const y of [height * 0.86, height * 0.81])
      for (let k = 0; k < 4; k++)
        box(0.002, 0.005, 0.026, SLOT, x, y, front - 0.05 - k * 0.036);
    for (let row = 0; row < 4; row++)
      for (let k = 0; k < 2; k++)
        box(
          0.002,
          0.005,
          0.026,
          SLOT,
          x,
          height * 0.12 + row * 0.014,
          front - 0.05 - k * 0.036,
        );
    box(0.002, 0.003, depth - 0.04, '#b8ae88', x, height * 0.33, -0.02);
  }

  // Brown bezel, a little proud of the case, round a black surround that
  // holds the tube. The tube sits high, leaving a deeper lower rail.
  box(width + 0.012, height + 0.012, 0.03, BEZEL, 0, height / 2, front - 0.005);
  const screenY = height * 0.55;
  box(
    width * 0.88,
    height * 0.8,
    0.006,
    '#0c0b0a',
    0.004,
    screenY,
    front + 0.012,
  );
  const screen = bootScreen();
  textures.push(screen.texture);
  const glass = createPs1Material({ map: screen.texture }, true, true);
  materials.push(glass);
  const screenW = width * 0.84;
  const screenH = height * 0.76;
  const face = new Mesh(new PlaneGeometry(screenW * m, screenH * m), glass);
  face.position.set(0.004 * m, screenY * m, (front + 0.0155) * m);
  group.add(face);
  // The cursor after the last line of text.
  const cursor = box(
    0.009,
    0.0035,
    0.001,
    '#f2f2ee',
    0.004 - screenW / 2 + screenW * (18 / 320),
    screenY + screenH / 2 - screenH * ((12 + 15 * 14.5 + 9) / 240),
    front + 0.0165,
    true,
  );

  // The badge on a black tab at the bottom left, and the bare red power
  // indicator at the bottom right, just under the tube.
  const badge = createLabelTexture('MICROVITEC', {
    ink: '#cfcabb',
    plate: '#151412',
    size: 12,
  });
  textures.push(badge.texture);
  const badgeMaterial = createPs1Material({ map: badge.texture }, true);
  materials.push(badgeMaterial);
  const tabW = 0.06;
  const tabX = -width / 2 + 0.03 + tabW / 2;
  box(tabW, 0.022, 0.014, '#151412', tabX, 0.012, front + 0.012);
  const badgeH = Math.min(0.012, (tabW - 0.008) * (badge.height / badge.width));
  const badgeMesh = new Mesh(
    new PlaneGeometry(badgeH * (badge.width / badge.height) * m, badgeH * m),
    badgeMaterial,
  );
  badgeMesh.position.set(tabX * m, 0.012 * m, (front + 0.0195) * m);
  group.add(badgeMesh);
  const lamp = part(
    new CylinderGeometry(0.004 * m, 0.004 * m, 0.004 * m, 8),
    '#ff2a1e',
    width / 2 - 0.045,
    screenY - height * 0.4 - 0.012,
    front + 0.012,
    true,
  );
  lamp.rotation.x = Math.PI / 2;

  return {
    group,
    /** Blink the cursor, about once a second. */
    update(seconds: number) {
      cursor.visible = seconds % 1.1 < 0.6;
    },
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const item of materials) item.dispose();
      for (const item of textures) item.dispose();
    },
  };
}
