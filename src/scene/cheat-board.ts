import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
} from 'three';
import type { BufferGeometry, Material, Texture } from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { createCanvasTexture } from './screens';

interface FaceOptions {
  title: string;
  titleColour: string;
  footer: string;
  rowHeight: number;
}

/** The board's face: a title and one caption per row. */
function boardFace(rows: readonly string[], options: FaceOptions) {
  const width = 256;
  const pitch = options.rowHeight;
  const height = 64 + rows.length * pitch;
  const { context, texture } = createCanvasTexture(width, height);
  context.fillStyle = '#e9e7df';
  context.fillRect(0, 0, width, height);
  context.fillStyle = options.titleColour;
  context.fillRect(0, 0, width, 44);
  context.fillStyle = '#ffffff';
  context.font = 'bold 22px monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(options.title, width / 2, 23);
  context.fillStyle = '#1a1a18';
  context.font = 'bold 16px monospace';
  context.textAlign = 'left';
  const rowY = (i: number) => 44 + pitch / 2 + i * pitch;
  for (const [i, text] of rows.entries())
    for (const [j, line] of text.split('\n').entries())
      context.fillText(
        line,
        64,
        rowY(i) + j * 17 - (text.includes('\n') ? 8 : 0),
      );
  context.fillStyle = '#6b6a63';
  context.font = 'bold 9px monospace';
  context.textAlign = 'center';
  context.fillText(options.footer, width / 2, height - 9);
  texture.needsUpdate = true;
  return { texture, width, height, rowY };
}

/**
 * A plain testing board, not part of the fiction: a titled face with one
 * push button per row and a lamp beside each. Sizes are in metres; the
 * origin is the board's centre and it faces +z.
 */
export function createTestingBoard(
  worldUnitsPerMetre: number,
  rows: readonly string[],
  {
    title = 'CHEAT CODES',
    titleColour = '#b8241c',
    footer = 'TESTING ONLY · SETS GAME STATE',
    rowHeight = 56,
    buttonColour = '#2a6fb0',
  } = {},
) {
  const m = worldUnitsPerMetre;
  const group = new Group();
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const part = (geometry: BufferGeometry, material: Material) => {
    materials.push(material);
    const mesh = new Mesh(geometry, material);
    group.add(mesh);
    return mesh;
  };

  const face = boardFace(rows, { title, titleColour, footer, rowHeight });
  textures.push(face.texture);
  const width = 0.42;
  const height = (width * face.height) / face.width;
  const pixel = width / face.width;
  part(
    new BoxGeometry(width * m, height * m, 0.015 * m),
    createPs1Material({ color: '#4a4a44' }),
  );
  const panel = part(
    new PlaneGeometry(width * m, height * m),
    createPs1Material({ map: face.texture }, true, true),
  );
  panel.position.z = 0.008 * m;

  const row = (i: number) => {
    const y = (face.height / 2 - face.rowY(i)) * pixel;
    const button = part(
      new CylinderGeometry(0.022 * m, 0.024 * m, 0.02 * m, 12),
      createPs1Material({ color: buttonColour }),
    );
    button.rotation.x = Math.PI / 2;
    button.position.set((32 - face.width / 2) * pixel * m, y * m, 0.018 * m);
    const lampOn = createPs1Material({ color: '#4cff4c' }, true, true);
    const lampOff = createPs1Material({ color: '#1d3a1d' }, true);
    materials.push(lampOff);
    const lamp = part(
      new CylinderGeometry(0.009 * m, 0.009 * m, 0.008 * m, 8),
      lampOn,
    );
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set((width / 2 - 0.035) * m, y * m, 0.012 * m);
    return {
      button,
      show(on: boolean) {
        lamp.material = on ? lampOn : lampOff;
      },
    };
  };
  const made = rows.map((_, i) => row(i));

  return {
    group,
    /** The push button for each row, in order. */
    buttons: made.map((r) => r.button),
    /** Light or darken the lamp beside a row. */
    show(index: number, on: boolean) {
      made[index]?.show(on);
    },
    /** The board's height, metres. */
    height,
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const item of materials) item.dispose();
      for (const item of textures) item.dispose();
    },
  };
}

/**
 * The cheat board: one push button per shortcut with a lamp beside it that
 * shows whether that state is set.
 */
export function createCheatBoard(worldUnitsPerMetre: number) {
  const board = createTestingBoard(worldUnitsPerMetre, [
    'XENON ON',
    'MERCURY ARC\nRECTIFIER ON',
    'STAGE 3 COMPLETE',
    'LIGHTS ON',
  ]);
  board.group.name = 'CheatBoard';
  return {
    group: board.group,
    /** Opens the cage and sets the xenon regulator flowing. */
    xenonButton: board.buttons[0],
    /** Closes the plant-room master supply, striking the rectifier. */
    rectifierButton: board.buttons[1],
    stageThreeButton: board.buttons[2],
    lightsButton: board.buttons[3],
    /** Light each row's lamp when its state is already set. */
    update(state: {
      xenon: boolean;
      rectifier: boolean;
      stageThree: boolean;
      lights: boolean;
    }) {
      board.show(0, state.xenon);
      board.show(1, state.rectifier);
      board.show(2, state.stageThree);
      board.show(3, state.lights);
    },
    dispose: board.dispose,
  };
}
