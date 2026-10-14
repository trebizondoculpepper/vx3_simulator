import { RepeatWrapping } from 'three';
import { createCanvasTexture } from '../scene/screens';

/** Subtle old composition tile and poured-concrete ceiling finishes. */
export function createLabSurfaceMap(
  kind: 'floor' | 'ceiling',
  seed: number,
  repeatX: number,
  repeatY: number,
) {
  const art = createCanvasTexture(256, 256);
  const c = art.context;
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const floor = kind === 'floor';
  c.fillStyle = floor ? '#898982' : '#5c625d';
  c.fillRect(0, 0, 256, 256);
  // Cloudy mineral colour sits below small aggregate and years of scuffs.
  for (let i = 0; i < 230; i++) {
    const x = random() * 256;
    const y = random() * 256;
    const r = 6 + random() * 35;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(
      0,
      random() < 0.5 ? 'rgba(24,28,25,.045)' : 'rgba(238,229,206,.045)',
    );
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 8000; i++) {
    const x = random() * 256;
    const y = random() * 256;
    c.fillStyle =
      random() < 0.53 ? 'rgba(238,231,215,.12)' : 'rgba(35,41,37,.12)';
    const radius = random() * (floor ? 1.4 : 1.1) + 0.35;
    c.fillRect(x, y, radius, radius);
  }
  for (let i = 0; i < (floor ? 32 : 10); i++) {
    const x = random() * 256;
    const y = random() * 256;
    c.strokeStyle = floor ? 'rgba(46,48,44,.12)' : 'rgba(32,37,34,.08)';
    c.lineWidth = 0.5 + random() * 1.2;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + 5 + random() * 28, y + (random() - 0.5) * 8);
    c.stroke();
  }
  art.texture.wrapS = RepeatWrapping;
  art.texture.wrapT = RepeatWrapping;
  art.texture.repeat.set(repeatX, repeatY);
  art.texture.needsUpdate = true;
  return art.texture;
}
