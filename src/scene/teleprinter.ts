import {
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  RepeatWrapping,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
} from 'three';
import type { Material, Texture } from 'three';
import { createPrinterLog } from '../game/printer-log';
import { designate } from '../game/machine-parts';
import { createPs1Material } from '../rendering/ps1-material';
import { createCanvasTexture, createLabelTexture } from './screens';

function paperFace() {
  const { context, texture } = createCanvasTexture(512, 1024);
  texture.wrapT = RepeatWrapping;
  const draw = (rows: readonly string[]) => {
    context.fillStyle = '#ded7b6';
    context.fillRect(0, 0, 512, 1024);
    context.fillStyle = '#afa78d';
    for (let y = 8; y < 1024; y += 24) {
      context.fillRect(9, y, 5, 5);
      context.fillRect(498, y, 5, 5);
    }
    for (let y = 0; y < 1024; y += 256) {
      context.fillStyle = '#c1b99d';
      context.fillRect(22, y, 468, 1);
    }
    context.fillStyle = '#3f463e';
    context.font = 'bold 14px monospace';
    context.fillText('VX3 / OPERATOR ACTION LOG', 30, 25);
    context.font = '14px monospace';
    rows
      .slice(-58)
      .forEach((line, i) => context.fillText(line, 30, 52 + i * 16, 452));
    texture.needsUpdate = true;
  };
  draw([]);
  return { texture, draw };
}

/** Continuous action logger with endless fanfold stock and a recycled collapsed pile. */
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
  designate(roller, {
    machine: 'Line printer',
    name: 'Paper feed roller',
    role: 'indicator',
  });
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
  designate(feed, {
    machine: 'Line printer',
    name: 'Paper supply',
    role: 'indicator',
  });

  const log = createPrinterLog();
  const printed = paperFace();
  textures.push(printed.texture);
  const paperMaterial = createPs1Material(
    { map: printed.texture, side: DoubleSide },
    true,
  );
  materials.push(paperMaterial);
  const segments = 32;
  const columns = 8;
  const positions = new Float32Array((segments + 1) * (columns + 1) * 3);
  const uvs = new Float32Array((segments + 1) * (columns + 1) * 2);
  const indices: number[] = [];
  for (let row = 0; row <= segments; row++)
    for (let col = 0; col <= columns; col++) {
      const index = row * (columns + 1) + col;
      uvs[index * 2] = col / columns;
      uvs[index * 2 + 1] = 1 - row / segments;
      if (row < segments && col < columns) {
        const below = index + columns + 1;
        indices.push(index, below, index + 1, index + 1, below, below + 1);
      }
    }
  const ribbonGeometry = new BufferGeometry();
  ribbonGeometry.setAttribute(
    'position',
    new Float32BufferAttribute(positions, 3),
  );
  ribbonGeometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  ribbonGeometry.setIndex(indices);
  const ribbon = new Mesh(ribbonGeometry, paperMaterial);
  group.add(ribbon);
  designate(ribbon, {
    machine: 'Line printer',
    name: 'Printed action log',
    role: 'indicator',
  });
  const outputPile = new Group();
  group.add(outputPile);
  for (let sheet = 0; sheet < 18; sheet++) {
    const page = part(
      new BoxGeometry(1.68, 0.017, 0.78),
      sheet % 3 ? '#ded6b6' : '#c8c0a2',
      Math.sin(sheet * 1.7) * 0.15,
      sheet * 0.018,
      1.17 + Math.cos(sheet * 1.2) * 0.12,
      outputPile,
    );
    page.rotation.set(
      Math.sin(sheet) * 0.045,
      Math.sin(sheet * 2.7) * 0.16,
      Math.cos(sheet) * 0.045,
    );
  }
  const folds: Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const geometry = new PlaneGeometry(1.68, 0.78, 8, 4);
    const vertices = geometry.getAttribute('position');
    for (let vertex = 0; vertex < vertices.count; vertex++)
      vertices.setZ(
        vertex,
        0.08 *
          Math.sin(vertices.getX(vertex) * 4 + vertices.getY(vertex) * 9 + i),
      );
    geometry.computeVertexNormals();
    const fold = new Mesh(geometry, paperMaterial);
    fold.rotation.set(
      -Math.PI / 2 + i * 0.035,
      (i - 2) * 0.1,
      0.04 * Math.sin(i),
    );
    fold.position.set(Math.sin(i * 2) * 0.1, 0.32 + i * 0.035, 1.23 + i * 0.03);
    designate(fold, {
      machine: 'Line printer',
      name: 'Settling paper',
      role: 'indicator',
    });
    outputPile.add(fold);
    folds.push(fold);
  }
  const shapeRibbon = (phase: number) => {
    const lower = outputPile.position.y + 0.48;
    const vertices = ribbonGeometry.getAttribute('position');
    for (let row = 0; row <= segments; row++) {
      const t = row / segments;
      const settling = t ** 4;
      const ripple = Math.sin(t * 14 - phase * Math.PI * 8);
      for (let col = 0; col <= columns; col++) {
        const x = (col / columns - 0.5) * 1.72;
        vertices.setXYZ(
          row * (columns + 1) + col,
          x + settling * Math.sin(phase * Math.PI * 2) * 0.05,
          0.28 + (lower - 0.28) * t + settling * ripple * 0.08,
          0.88 +
            Math.sin((t * Math.PI) / 2) * 0.46 +
            settling * ripple * 0.18 +
            Math.sin(x * 5 + t * 12) * 0.018 * t,
        );
      }
    }
    vertices.needsUpdate = true;
    ribbonGeometry.computeVertexNormals();
    ribbonGeometry.computeBoundingSphere();
  };
  shapeRibbon(0);

  return {
    group,
    outputPile,
    record(message: string) {
      log.append(message);
      printed.draw(log.rows);
      ribbon.userData.lastLogEntry = message;
    },
    update(delta: number, reducedMotion: boolean) {
      log.step(delta);
      const phase = reducedMotion ? 0 : log.phase;
      shapeRibbon(phase);
      printed.texture.offset.y = reducedMotion ? 0 : log.phase;
      roller.rotation.x = phase * Math.PI * 12;
      feed.position.y =
        -0.34 + (reducedMotion ? 0 : Math.sin(phase * Math.PI * 8) * 0.008);
      folds.forEach((fold, i) => {
        fold.position.y =
          0.32 +
          i * 0.035 +
          (reducedMotion
            ? 0
            : Math.max(0, Math.sin(phase * Math.PI * 2 - i * 0.8)) * 0.075);
      });
      return log.linesStarted > 0;
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
