import { CanvasTexture, SRGBColorSpace } from 'three';

/**
 * A stand-in for the apparition until the owner supplies the real image:
 * a tall, gaunt figure, darker than the room, its edges smoky, its arms
 * too long, its head tipped, two pale points where its eyes should be.
 * Drawn on a transparent canvas twice as tall as it is wide, its feet at
 * the bottom edge, so it stands on the floor.
 */
export function createApparitionImage(seed = 11) {
  const w = 256;
  const h = 640;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d')!;
  let a = seed * 7919 + 13;
  const random = () => {
    a = (a * 16807) % 2147483647;
    return a / 2147483647;
  };
  const cx = w / 2;
  // The body, in one dark silhouette: head, narrow shoulders, long arms
  // hanging past the knees, thin legs.
  const figure = new Path2D();
  figure.ellipse(cx + 6, 88, 30, 40, 0.18, 0, Math.PI * 2);
  figure.moveTo(cx - 14, 120);
  figure.quadraticCurveTo(cx - 52, 150, cx - 58, 210);
  figure.lineTo(cx - 74, 430); // left arm, hanging long
  figure.lineTo(cx - 62, 436);
  figure.lineTo(cx - 40, 250);
  figure.lineTo(cx - 34, 360);
  figure.lineTo(cx - 30, 630); // left leg
  figure.lineTo(cx - 12, 630);
  figure.lineTo(cx, 400);
  figure.lineTo(cx + 12, 630); // right leg
  figure.lineTo(cx + 30, 630);
  figure.lineTo(cx + 36, 360);
  figure.lineTo(cx + 42, 250);
  figure.lineTo(cx + 66, 446);
  figure.lineTo(cx + 78, 440); // right arm
  figure.lineTo(cx + 60, 210);
  figure.quadraticCurveTo(cx + 54, 150, cx + 18, 120);
  figure.closePath();
  // Smoky edges: the silhouette blurred and laid down several times.
  for (const [blur, alpha] of [
    [26, 0.35],
    [12, 0.55],
    [4, 0.8],
    [0, 0.9],
  ] as const) {
    c.save();
    c.filter = blur ? `blur(${blur}px)` : 'none';
    c.fillStyle = `rgba(10, 9, 12, ${alpha})`;
    c.fill(figure);
    c.restore();
  }
  // Wisps trailing off it, as if it were not quite solid.
  c.save();
  c.filter = 'blur(6px)';
  for (let k = 0; k < 40; k++) {
    const y = 140 + random() * 480;
    const x = cx + (random() - 0.5) * 120;
    c.fillStyle = `rgba(14, 12, 16, ${0.15 + random() * 0.25})`;
    c.beginPath();
    c.ellipse(x, y, 4 + random() * 14, 10 + random() * 30, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
  // The eyes: two pale points, a little uneven.
  for (const [x, y] of [
    [cx - 6, 84],
    [cx + 16, 88],
  ]) {
    const glow = c.createRadialGradient(x, y, 0, x, y, 9);
    glow.addColorStop(0, 'rgba(235, 238, 225, 0.95)');
    glow.addColorStop(0.35, 'rgba(200, 210, 200, 0.5)');
    glow.addColorStop(1, 'rgba(200, 210, 200, 0)');
    c.fillStyle = glow;
    c.fillRect(x - 10, y - 10, 20, 20);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
