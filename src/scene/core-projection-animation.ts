import { projectionWireframe } from '../game/core-projection-geometry';
import type { CoreProjection } from '../game/core-projection';
import { createCanvasTexture } from './screens';

/** A fixed-size phosphor framebuffer, updated at ten frames per second. */
export function createCoreProjectionAnimation() {
  const { context: c, texture } = createCanvasTexture(256, 192);
  const draw = (kind: CoreProjection, seconds: number) => {
    c.fillStyle = '#021008';
    c.fillRect(0, 0, 256, 192);
    c.strokeStyle = '#0c2c19';
    c.lineWidth = 0.5;
    c.beginPath();
    for (let x = 16; x < 256; x += 16) {
      c.moveTo(x, 25);
      c.lineTo(x, 167);
    }
    for (let y = 32; y < 170; y += 16) {
      c.moveTo(10, y);
      c.lineTo(246, y);
    }
    c.stroke();
    const { points, edges } = projectionWireframe(kind, seconds);
    c.beginPath();
    for (const [a, b] of edges) {
      c.moveTo(...points[a]);
      c.lineTo(...points[b]);
    }
    c.lineWidth = 3;
    c.strokeStyle = '#114a29';
    c.stroke();
    c.lineWidth = 0.85;
    c.strokeStyle = '#8bffad';
    c.stroke();
    c.fillStyle = '#85ffa5';
    c.font = '10px monospace';
    c.fillText(
      kind === 'tesseract' ? 'FC / HYPERPROJEKTION' : 'FC / RAUMPROJEKTION',
      12,
      17,
    );
    c.fillText('VOLLBETRIEB', 12, 181);
    c.strokeStyle = '#2b7e47';
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(10, 23);
    c.lineTo(246, 23);
    c.moveTo(10, 170);
    c.lineTo(246, 170);
    c.stroke();
    c.fillStyle = 'rgba(0,0,0,.16)';
    for (let y = 0; y < 192; y += 3) c.fillRect(0, y, 256, 1);
    texture.needsUpdate = true;
  };
  draw('irregular', 0);
  return { texture, draw };
}
