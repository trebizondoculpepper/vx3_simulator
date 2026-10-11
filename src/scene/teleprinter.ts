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

function paperFace() {
  const { context, texture } = createCanvasTexture(256, 160);
  context.fillStyle = '#ded7b6';
  context.fillRect(0, 0, 256, 160);
  context.fillStyle = '#bcb497';
  for (let y = 8; y < 160; y += 20) {
    context.fillRect(7, y, 4, 4);
    context.fillRect(245, y, 4, 4);
  }
  context.fillStyle = '#3f463e';
  context.font = 'bold 11px monospace';
  context.fillText('VX3 / EVENT TELEMETRY', 22, 24);
  context.font = '10px monospace';
  context.fillText('TIME    SPINDLE   FIELD   DELTA', 22, 49);
  context.fillText('07:42   0000      0.00    0.000', 22, 72);
  context.fillText('07:43   0000      0.00    0.000', 22, 92);
  context.fillText('07:44   0000      0.00    0.000', 22, 112);
  texture.needsUpdate = true;
  return texture;
}

/** Static wall teleprinter, with fanfold stock below and output accumulating in front. */
export function createTeleprinter() {
  const group = new Group();
  group.name = 'WallTeleprinter';
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const part = (
    geometry: BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    parent = group,
  ) => {
    const finish = createPs1Material({ color });
    materials.push(finish);
    const item = new Mesh(geometry, finish);
    item.position.set(x, y, z);
    parent.add(item);
    return item;
  };
  const face = (
    texture: Texture,
    width: number,
    height: number,
    x: number,
    y: number,
    z: number,
    parent = group,
  ) => {
    textures.push(texture);
    const finish = createPs1Material({ map: texture }, true);
    materials.push(finish);
    const item = new Mesh(new PlaneGeometry(width, height), finish);
    item.position.set(x, y, z);
    parent.add(item);
    return item;
  };

  // Angle-iron brackets carry the heavy machine off the masonry.
  for (const x of [-0.87, 0.87]) {
    part(new BoxGeometry(0.14, 1.35, 0.13), '#515b56', x, -0.1, -0.14);
    part(new BoxGeometry(0.14, 0.12, 0.84), '#79817a', x, -0.62, 0.29);
    for (const y of [-0.52, 0.36])
      part(new BoxGeometry(0.07, 0.07, 0.025), '#bdaf87', x, y, -0.055);
  }
  part(new BoxGeometry(2.28, 0.91, 0.73), '#737c72', 0, 0.06, 0.34);
  part(new BoxGeometry(2.34, 0.12, 0.81), '#9a9d86', 0, 0.52, 0.34);
  part(new BoxGeometry(2.04, 0.47, 0.06), '#333c37', 0, 0.1, 0.73);
  part(new BoxGeometry(1.76, 0.12, 0.04), '#171d1b', 0, 0.22, 0.77);
  const roller = part(
    new CylinderGeometry(0.075, 0.075, 1.72, 8),
    '#272e2b',
    0,
    0.3,
    0.8,
  );
  roller.rotation.z = Math.PI / 2;
  for (const x of [-1.03, 1.03])
    part(new BoxGeometry(0.08, 0.28, 0.16), '#c5b282', x, 0.2, 0.8);
  part(new BoxGeometry(1.85, 0.055, 0.2), '#b6b49b', 0, -0.2, 0.76);
  part(new BoxGeometry(0.14, 0.14, 0.045), '#ad503a', 0.91, -0.24, 0.77);
  face(
    createLabelTexture('NEUMANN DYNAMIK / VX3 LINE PRINTER', {
      ink: '#e6debd',
      plate: '#34423e',
      size: 11,
    }).texture,
    2.03,
    0.18,
    0,
    0.61,
    0.78,
  );

  // A continuous zigzag of blank stock sits on its own wall tray below.
  part(new BoxGeometry(2.13, 0.1, 0.99), '#657169', 0, -1.13, 0.44);
  part(new BoxGeometry(1.75, 0.28, 0.69), '#b8b097', 0, -0.91, 0.49);
  for (let row = 0; row < 7; row++)
    part(
      new BoxGeometry(1.68, 0.025, 0.61),
      row % 2 ? '#c9c2a4' : '#e1d9b8',
      0,
      -0.76 + row * 0.028,
      0.49,
    );
  face(
    createLabelTexture('CONTINUOUS FEED', {
      ink: '#514c3d',
      plate: '#d8cfaf',
      size: 10,
    }).texture,
    1.28,
    0.16,
    0,
    -0.97,
    0.85,
  );
  const feed = part(
    new BoxGeometry(1.66, 0.72, 0.02),
    '#e0d8b8',
    0,
    -0.34,
    0.81,
  );
  feed.rotation.x = -0.16;

  // The last printed section hangs over the front lip; old output forms a
  // slightly askew pile on the floor in front of the wall-mounted machine.
  const printed = paperFace();
  face(printed, 1.72, 1.08, 0, -0.52, 0.91).rotation.x = -0.18;
  const outputPile = new Group();
  group.add(outputPile);
  for (let sheet = 0; sheet < 12; sheet++) {
    const page = part(
      new BoxGeometry(1.68, 0.017, 0.78),
      sheet % 3 ? '#ded6b6' : '#c8c0a2',
      (sheet % 4) * 0.025 - 0.04,
      sheet * 0.018,
      1.17 + (sheet % 3) * 0.04,
      outputPile,
    );
    page.rotation.y = ((sheet % 5) - 2) * 0.018;
  }

  return {
    group,
    outputPile,
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const item of materials) item.dispose();
      for (const item of textures) item.dispose();
    },
  };
}
