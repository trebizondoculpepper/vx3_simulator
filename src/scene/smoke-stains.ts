import { CanvasTexture, Mesh, PlaneGeometry, SRGBColorSpace } from 'three';
import type { MeshBasicMaterial } from 'three';
import { createPs1Material } from '../rendering/ps1-material';

/**
 * Soot on a panel face: dark smudges spreading up from where the heat
 * came out, darkest just above their sources and fading as they rise and
 * spread, with streaks where the smoke ran up the face. A transparent
 * overlay, laid just in front of the face, `width` by `height` metres,
 * facing +z. Its `level` (0 to 1) sets how dark it has got.
 */
export function createSmokeStains({
  width = 0.48,
  height = 1.7,
  seed = 1,
} = {}) {
  const px = 256;
  const py = Math.round((px * height) / width);
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = py;
  const c = canvas.getContext('2d')!;
  let a = seed * 9301 + 49297;
  const random = () => {
    a = (a * 16807) % 2147483647;
    return a / 2147483647;
  };
  c.clearRect(0, 0, px, py);
  // Sources: hot spots across the face. Soot rises from each.
  for (let k = 0; k < 7; k++) {
    const sx = px * (0.15 + random() * 0.7);
    const sy = py * (0.25 + random() * 0.7);
    // The plume: overlapping soft blobs, widening and fading as it rises.
    for (let i = 0; i < 26; i++) {
      const up = (i / 26) * py * (0.15 + random() * 0.2);
      const r = 10 + i * 2.2 + random() * 8;
      const x = sx + (random() - 0.5) * (6 + i * 1.5);
      const y = sy - up;
      const alpha = 0.16 * (1 - i / 30);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(28, 22, 16, ${alpha})`);
      g.addColorStop(1, 'rgba(28, 22, 16, 0)');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Streaks where the smoke ran up the face.
    c.strokeStyle = 'rgba(30, 24, 18, 0.18)';
    for (let s = 0; s < 4; s++) {
      c.lineWidth = 1 + random() * 2.5;
      c.beginPath();
      let x = sx + (random() - 0.5) * 20;
      let y = sy;
      c.moveTo(x, y);
      const length = py * (0.08 + random() * 0.18);
      for (let t = 0; t < length; t += 6) {
        x += (random() - 0.5) * 2.5;
        y -= 6;
        c.lineTo(x, y);
      }
      c.stroke();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  const material = createPs1Material(
    {
      map: texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    },
    true,
  ) as MeshBasicMaterial;
  const mesh = new Mesh(new PlaneGeometry(width, height), material);
  mesh.name = 'SmokeStains';
  mesh.userData.noCollision = true;
  mesh.visible = false;
  return {
    mesh,
    /** How dark the soot has got, 0 (clean) to 1. */
    set(level: number) {
      const l = Math.max(0, Math.min(1, level));
      material.opacity = l;
      mesh.visible = l > 0.003;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
