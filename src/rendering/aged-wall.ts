import { createCanvasTexture } from '../scene/screens';

/** Fixed, nonrepeating paint wear for one wall section. Dimensions are metres. */
export function createAgedWallMap({
  width,
  height,
  base,
  seed,
  dado = false,
}: {
  width: number;
  height: number;
  base: string;
  seed: number;
  dado?: boolean;
}) {
  const w = Math.max(256, Math.min(1536, Math.round(width * 260)));
  const h = Math.max(256, Math.min(1024, Math.round(height * 260)));
  const art = createCanvasTexture(w, h);
  const c = art.context;
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  c.fillStyle = base;
  c.fillRect(0, 0, w, h);

  // Several generations of paint leave a quiet, uneven colour rather than
  // a repeated noise tile. The staining gathers along the floor and ceiling.
  for (let i = 0; i < Math.round((w * h) / 2800); i++) {
    const x = random() * w;
    const y = random() * h;
    const r = 8 + random() * 55;
    const shadow = random() < 0.72;
    const stain = c.createRadialGradient(x, y, 0, x, y, r);
    stain.addColorStop(
      0,
      shadow ? 'rgba(38,37,31,0.055)' : 'rgba(228,219,190,0.045)',
    );
    stain.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = stain;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const lower = c.createLinearGradient(0, 0, 0, h);
  lower.addColorStop(0, 'rgba(34,35,29,0.1)');
  lower.addColorStop(0.16, 'rgba(34,35,29,0)');
  lower.addColorStop(0.65, 'rgba(35,36,30,0)');
  lower.addColorStop(1, 'rgba(33,34,28,0.18)');
  c.fillStyle = lower;
  c.fillRect(0, 0, w, h);
  for (const x of [0, w])
    for (const y of [0, h]) {
      const radius = Math.min(w, h) * (dado ? 0.5 : 0.72);
      const corner = c.createRadialGradient(x, y, 0, x, y, radius);
      corner.addColorStop(0, 'rgba(22,29,24,0.38)');
      corner.addColorStop(0.42, 'rgba(27,32,27,0.12)');
      corner.addColorStop(1, 'rgba(27,32,27,0)');
      c.fillStyle = corner;
      c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

  // Jagged chips reveal the older cream plaster beneath the paint. Most
  // damage is near corners or lower down, where equipment brushes the wall.
  const chips = Math.round((w * h) / (dado ? 19000 : 27000));
  for (let i = 0; i < chips; i++) {
    const edge = random() < 0.62;
    const x = edge
      ? (random() < 0.5 ? 0 : w) + (random() - 0.5) * w * 0.22
      : random() * w;
    const y = random() < 0.65 ? h * (0.55 + random() * 0.45) : random() * h;
    const r = 2 + random() * (dado ? 8 : 12);
    c.beginPath();
    for (let point = 0; point < 8; point++) {
      const angle = (point / 8) * Math.PI * 2;
      const radius = r * (0.55 + random() * 0.75);
      const px = x + Math.cos(angle) * radius * 1.5;
      const py = y + Math.sin(angle) * radius;
      if (point === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fillStyle = dado ? '#667169' : '#aaa997';
    c.fill();
    c.strokeStyle = 'rgba(34,39,33,0.38)';
    c.lineWidth = 1.5;
    c.stroke();
  }
  // Hairline cracks and the occasional thin drip stay subdued at room scale.
  for (let i = 0; i < Math.round(width * 7); i++) {
    const x = random() * w;
    const y = random() * h;
    c.strokeStyle = 'rgba(38,45,37,0.12)';
    c.lineWidth = 0.6 + random() * 0.8;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + (random() - 0.5) * 13, y + 8 + random() * 30);
    c.stroke();
  }
  art.texture.needsUpdate = true;
  return art.texture;
}
