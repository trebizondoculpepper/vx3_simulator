import { BoxGeometry, Group, Mesh } from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { createCanvasTexture } from './screens';

interface CardboardBoxOptions {
  width: number;
  height: number;
  depth: number;
  shade: string;
  label: string;
  code: string;
  seed: number;
}

/** Worn corrugated cartons with distinct front labels and taped tops. */
export function createCardboardBox(options: CardboardBoxOptions) {
  const { width, height, depth, shade, label, code, seed } = options;
  const textures = [] as ReturnType<typeof createCanvasTexture>['texture'][];
  const random = (() => {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  })();
  const face = (kind: 'plain' | 'front' | 'top') => {
    const art = createCanvasTexture(256, 256);
    textures.push(art.texture);
    const c = art.context;
    c.fillStyle = shade;
    c.fillRect(0, 0, 256, 256);
    // Paper fibres and shallow corrugation show up without a repeating tile.
    for (let x = 0; x < 256; x += 7) {
      c.fillStyle = 'rgba(74,49,26,0.035)';
      c.fillRect(x, 0, 1, 256);
    }
    for (let i = 0; i < 7000; i++) {
      const x = random() * 256;
      const y = random() * 256;
      c.fillStyle =
        random() < 0.5 ? 'rgba(55,34,17,0.09)' : 'rgba(255,239,195,0.15)';
      c.fillRect(x, y, 1 + random() * 2, 0.5 + random() * 2);
    }
    for (let i = 0; i < 45; i++) {
      const x = random() * 256;
      const y = random() * 256;
      c.strokeStyle = 'rgba(62,44,28,0.09)';
      c.lineWidth = 0.5 + random();
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 2 + random() * 18, y - 2 + random() * 4);
      c.stroke();
    }
    const edge = c.createLinearGradient(0, 0, 256, 256);
    edge.addColorStop(0, 'rgba(42,25,13,0.22)');
    edge.addColorStop(0.12, 'rgba(42,25,13,0)');
    edge.addColorStop(0.86, 'rgba(42,25,13,0)');
    edge.addColorStop(1, 'rgba(42,25,13,0.25)');
    c.fillStyle = edge;
    c.fillRect(0, 0, 256, 256);
    c.strokeStyle = 'rgba(66,44,24,0.35)';
    c.lineWidth = 4;
    c.strokeRect(2, 2, 252, 252);
    if (kind === 'top') {
      c.fillStyle = 'rgba(224,191,127,0.56)';
      c.fillRect(105, 0, 46, 256);
      c.fillStyle = 'rgba(91,64,33,0.2)';
      c.fillRect(105, 0, 2, 256);
      c.fillRect(149, 0, 2, 256);
      c.fillRect(127, 0, 2, 256);
      c.strokeStyle = 'rgba(68,48,27,0.35)';
      c.beginPath();
      c.moveTo(0, 128);
      c.lineTo(256, 128);
      c.stroke();
    }
    if (kind === 'front') {
      c.save();
      c.translate(128, 136);
      c.rotate((random() - 0.5) * 0.06);
      c.fillStyle = 'rgba(228,217,181,0.83)';
      c.fillRect(-100, -57, 200, 114);
      c.strokeStyle = 'rgba(75,55,32,0.45)';
      c.lineWidth = 2;
      c.strokeRect(-100, -57, 200, 114);
      c.fillStyle = '#423728';
      c.textAlign = 'center';
      c.font = 'bold 16px Arial, sans-serif';
      c.fillText('VX3 · LABORBESTAND', 0, -29, 186);
      c.fillRect(-82, -20, 164, 1);
      c.font = 'bold 19px Arial, sans-serif';
      c.fillText(label, 0, 13, 185);
      c.font = '14px monospace';
      c.fillText(code, 0, 39, 185);
      c.restore();
      c.strokeStyle = 'rgba(70,46,25,0.52)';
      c.lineWidth = 4;
      c.strokeRect(16, 16, 224, 224);
    }
    art.texture.needsUpdate = true;
    return art.texture;
  };
  const plain = face('plain');
  const front = face('front');
  const top = face('top');
  const materials = [front, plain, top, plain, plain, plain].map((map) =>
    createPs1Material({ color: '#ffffff', map, roughness: 0.98 }),
  );
  const group = new Group();
  group.name = `Cardboard carton: ${label}`;
  const carton = new Mesh(new BoxGeometry(width, height, depth), materials);
  carton.name = label;
  group.add(carton);
  return {
    group,
    dispose() {
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
