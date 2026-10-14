import { RepeatWrapping } from 'three';
import { createCanvasTexture } from '../scene/screens';

/** Fine zinc spangle and brushed wear on exposed sheet-metal ducting. */
export function createGalvanizedZincMap(
  seed: number,
  repeatX = 1,
  repeatY = 1,
) {
  const art = createCanvasTexture(512, 512);
  const c = art.context;
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  c.fillStyle = '#aeb6b4';
  c.fillRect(0, 0, 512, 512);
  // Faceted crystallisation: adjacent tiny wedges catch light differently.
  const pitch = 32;
  for (let row = -1; row <= 16; row++)
    for (let col = -1; col <= 16; col++) {
      const x = col * pitch + (random() - 0.5) * 16;
      const y = row * pitch + (random() - 0.5) * 16;
      const radius = 20 + random() * 13;
      for (let wedge = 0; wedge < 7; wedge++) {
        const a = (wedge / 7) * Math.PI * 2;
        const b = ((wedge + 1) / 7) * Math.PI * 2;
        const tint = Math.round(159 + random() * 42);
        c.fillStyle = `rgba(${tint},${tint + 3},${tint + 2},0.27)`;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
        c.lineTo(x + Math.cos(b) * radius, y + Math.sin(b) * radius);
        c.closePath();
        c.fill();
      }
    }
  // Fine zinc flecks and faint rolling marks keep the pattern from looking
  // like a decorative mosaic at normal viewing distance.
  for (let i = 0; i < 12000; i++) {
    const x = random() * 512;
    const y = random() * 512;
    c.fillStyle =
      random() < 0.5 ? 'rgba(255,255,250,0.12)' : 'rgba(48,59,59,0.11)';
    c.fillRect(x, y, 0.5 + random() * 1.5, 0.5 + random() * 1.5);
  }
  for (let i = 0; i < 55; i++) {
    const y = random() * 512;
    c.strokeStyle = 'rgba(70,82,80,0.04)';
    c.lineWidth = 0.5 + random();
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(512, y + (random() - 0.5) * 5);
    c.stroke();
  }
  art.texture.wrapS = RepeatWrapping;
  art.texture.wrapT = RepeatWrapping;
  art.texture.repeat.set(repeatX, repeatY);
  art.texture.needsUpdate = true;
  return art.texture;
}
