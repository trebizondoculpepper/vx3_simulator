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

/** The board's face: a title and one caption per row. */
function boardFace(rows: readonly string[]) {
  const width = 256;
  const height = 64 + rows.length * 56;
  const { context, texture } = createCanvasTexture(width, height);
  context.fillStyle = '#e9e7df';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#b8241c';
  context.fillRect(0, 0, width, 44);
  context.fillStyle = '#ffffff';
  context.font = 'bold 22px monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('CHEAT CODES', width / 2, 23);
  context.fillStyle = '#1a1a18';
  context.font = 'bold 16px monospace';
  context.textAlign = 'left';
  for (const [i, text] of rows.entries())
    for (const [j, line] of text.split('\n').entries())
      context.fillText(
        line,
        64,
        72 + i * 56 + j * 17 - (text.includes('\n') ? 8 : 0),
      );
  context.fillStyle = '#6b6a63';
  context.font = 'bold 9px monospace';
  context.textAlign = 'center';
  context.fillText('TESTING ONLY · SETS GAME STATE', width / 2, height - 9);
  texture.needsUpdate = true;
  return { texture, width, height, rowY: (i: number) => 72 + i * 56 };
}

/**
 * A plain testing board, not part of the fiction: one push button per
 * shortcut with a lamp beside it that shows whether that state is set.
 * Sizes are in metres; the origin is the board's centre and it faces +z.
 */
export function createCheatBoard(worldUnitsPerMetre: number) {
  const m = worldUnitsPerMetre;
  const group = new Group();
  group.name = 'CheatBoard';
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const part = (geometry: BufferGeometry, material: Material) => {
    materials.push(material);
    const mesh = new Mesh(geometry, material);
    group.add(mesh);
    return mesh;
  };

  const face = boardFace(['XENON ON', 'MERCURY ARC\nRECTIFIER ON']);
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
      createPs1Material({ color: '#2a6fb0' }),
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
  const xenon = row(0);
  const rectifier = row(1);

  return {
    group,
    /** Opens the cage and sets the xenon regulator flowing. */
    xenonButton: xenon.button,
    /** Closes the plant-room master supply, striking the rectifier. */
    rectifierButton: rectifier.button,
    /** Light each row's lamp when its state is already set. */
    update(state: { xenon: boolean; rectifier: boolean }) {
      xenon.show(state.xenon);
      rectifier.show(state.rectifier);
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
