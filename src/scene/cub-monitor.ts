import { designate } from '../game/machine-parts';
import {
  BoxGeometry,
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
import { bbcPageIds } from '../game/bench-monitor';
import type { BbcPageId, ScreenLine } from '../game/bench-monitor';
import { createCanvasTexture, createLabelTexture } from './screens';

/** Mode 7 text as the BBC Micro's calibration program draws it. */
function createScreen() {
  const width = 320;
  const height = 240;
  const { context, texture } = createCanvasTexture(width, height);
  let shown: string | undefined;
  const frames = new Map<BbcPageId, HTMLImageElement>();
  for (const id of bbcPageIds) {
    const image = new Image();
    image.onload = () => {
      frames.set(id, image);
      shown = undefined;
    };
    image.src = `${import.meta.env.BASE_URL}screens/bbc/${id}.svg`;
  }
  const draw = (lines: readonly ScreenLine[], page?: BbcPageId) => {
    const key = JSON.stringify([lines, page]);
    if (key === shown) return;
    shown = key;
    // The tube's rounded face, set in its black surround.
    context.fillStyle = '#0c0b0a';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#060807';
    context.beginPath();
    context.roundRect(4, 4, width - 8, height - 8, 22);
    context.fill();
    context.save();
    context.clip();
    const frame = page && frames.get(page);
    if (frame) context.drawImage(frame, 0, 0, width, height);
    context.font = 'bold 11px monospace';
    context.textBaseline = 'top';
    for (const [i, [text, ink]] of lines.entries()) {
      if (frame && i < 12 && i !== 3) continue;
      context.fillStyle = ink;
      context.fillText(text, 18, 12 + i * 12, width - 30);
    }
    // A faint reflection across the top left of the glass.
    const sheen = context.createLinearGradient(0, 0, width * 0.6, height * 0.6);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = sheen;
    context.fillRect(0, 0, width, height);
    context.restore();
    texture.needsUpdate = true;
  };
  return { texture, draw };
}

/**
 * A Microvitec Cub 14-inch colour monitor, the BBC Micro's usual companion:
 * a plain cream steel box with louvred sides, a brown bezel round a black
 * surround and a round-cornered tube, the maker's badge on a black tab at
 * the bottom left and a red power indicator at the bottom right.
 * The screen shows the calibration program's Mode 7 text, including any
 * warnings, with a blinking cursor, and keeps glowing
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

  // Science Museum dimensions in H × W × D order, not W × H × D.
  const width = 0.352;
  const height = 0.3;
  const depth = 0.415;
  const front = depth / 2 - 0.02;
  const CASE = '#dcd2a9';
  const BEZEL = '#242724';
  const SLOT = '#5d5747';

  // Plain steel cabinet, its sides louvred near the front and split by a
  // seam a third of the way up.
  box(width, height, depth - 0.04, CASE, 0, height / 2, -0.02);
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
  box(width, height, 0.03, BEZEL, 0, height / 2, front - 0.005);
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
  const screen = createScreen();
  textures.push(screen.texture);
  const glass = createPs1Material(
    {
      map: screen.texture,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    },
    true,
    true,
  );
  materials.push(glass);
  // A 4:3 picture within the 14-inch tube's bezel.
  const screenW = 0.276;
  const screenH = screenW * 0.75;
  const face = new Mesh(new PlaneGeometry(screenW * m, screenH * m), glass);
  const screenFaceZ = front + 0.012 + 0.006 / 2 + 0.001;
  face.position.set(0.004 * m, screenY * m, screenFaceZ * m);
  group.add(face);
  designate(face, {
    machine: 'Bench computer',
    name: 'Monitor screen',
    role: 'indicator',
  });
  // The cursor after the last line of text.
  const cursor = box(
    0.009,
    0.0035,
    0.001,
    '#f2f2ee',
    0.004 - screenW / 2 + screenW * (18 / 320),
    0,
    screenFaceZ + 0.001 + 0.001 / 2,
    true,
  );
  designate(cursor, {
    machine: 'Bench computer',
    name: 'Cursor',
    role: 'indicator',
  });
  const placeCursor = (lineCount: number) => {
    cursor.position.y =
      (screenY + screenH / 2 - screenH * ((12 + lineCount * 12 + 9) / 240)) * m;
  };

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

  const lampColour = (lamp.material as MeshBasicMaterial).color;
  return {
    group,
    /** The picture on the tube, for looking straight at it. */
    screen: face,
    /**
     * Switch the monitor on or off with the computer: off, its red power
     * lamp is dark and the tube shows nothing.
     */
    power(on: boolean) {
      lampColour.set(on ? '#ff2a1e' : '#3a1512');
    },
    /** Redraw the text if it has changed, and blink the cursor about once a second. */
    update(
      seconds: number,
      lines: readonly ScreenLine[],
      showCursor = true,
      page?: BbcPageId,
    ) {
      screen.draw(lines, page);
      placeCursor(lines.length);
      cursor.visible = showCursor && lines.length > 0 && seconds % 1.1 < 0.6;
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
