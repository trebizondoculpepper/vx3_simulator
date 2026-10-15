import { RepeatWrapping } from 'three';
import { createCanvasTexture } from './screens';

/** Small repeatable physical finishes; colour comes from the painted material. */
export function createMuseumFinishes() {
  let seed = 1971;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const make = (kind: 'plaster' | 'terrazzo' | 'timber' | 'metal') => {
    const { context: c, texture } = createCanvasTexture(256, 256);
    c.fillStyle = kind === 'timber' ? '#e2d7c1' : '#e7e5db';
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) {
      const x = random() * 256;
      const y = random() * 256;
      const grey = Math.floor(110 + random() * 140);
      c.fillStyle = `rgba(${grey},${grey},${grey},${kind === 'terrazzo' ? 0.7 : 0.16})`;
      if (kind === 'terrazzo') {
        const r = 0.5 + random() * 2.5;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + r * 2, y + r);
        c.lineTo(x + r, y + r * 2.2);
        c.closePath();
        c.fill();
      } else if (kind === 'timber') c.fillRect(x, y, 0.4, 12 + random() * 60);
      else c.fillRect(x, y, kind === 'metal' ? 3 : 1, 1);
    }
    if (kind === 'plaster') {
      c.strokeStyle = 'rgba(62,62,55,0.1)';
      c.lineWidth = 0.6;
      c.beginPath();
      c.moveTo(42, 0);
      c.lineTo(49, 28);
      c.lineTo(45, 45);
      c.lineTo(57, 63);
      c.stroke();
    }
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  };
  return {
    plaster: make('plaster'),
    terrazzo: make('terrazzo'),
    timber: make('timber'),
    metal: make('metal'),
  };
}
