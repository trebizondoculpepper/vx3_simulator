import { createCanvasTexture } from './screens';

type Context = CanvasRenderingContext2D;

/** A plain gas cylinder pictogram, standing upright, centred on (x, y). */
function drawCylinder(context: Context, x: number, y: number, h: number) {
  const w = h * 0.36;
  context.beginPath();
  context.roundRect(x - w / 2, y - h / 2 + h * 0.14, w, h * 0.86, w * 0.45);
  context.fill();
  context.fillRect(x - w * 0.18, y - h / 2, w * 0.36, h * 0.16);
}

/** A diamond (a square on its point) of half-diagonal r centred on (x, y). */
function diamond(context: Context, x: number, y: number, r: number) {
  context.beginPath();
  context.moveTo(x, y - r);
  context.lineTo(x + r, y);
  context.lineTo(x, y + r);
  context.lineTo(x - r, y);
  context.closePath();
}

/**
 * The supplier's label on a modern xenon bottle: the green ADR class 2.2
 * label, the GHS04 pictogram, UN 2036 with its German shipping name and the
 * H280 statement. Bottles are refilled today, so this is current practice
 * even though the lab is not.
 */
export function createCylinderLabelTexture() {
  const width = 160;
  const height = 96;
  const { context, texture } = createCanvasTexture(width, height);
  context.fillStyle = '#f3f1e8';
  context.fillRect(0, 0, width, height);
  // ADR 2.2: green diamond, white cylinder, a 2 in the bottom corner.
  diamond(context, 26, 30, 23);
  context.fillStyle = '#2f8a3c';
  context.fill();
  context.fillStyle = '#ffffff';
  drawCylinder(context, 26, 24, 20);
  context.font = 'bold 11px monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('2', 26, 45);
  // GHS04: red-bordered white diamond with a black cylinder.
  diamond(context, 74, 30, 21);
  context.fillStyle = '#d0201a';
  context.fill();
  diamond(context, 74, 30, 16);
  context.fillStyle = '#ffffff';
  context.fill();
  context.fillStyle = '#111111';
  drawCylinder(context, 74, 31, 17);
  context.fillStyle = '#111111';
  context.textAlign = 'left';
  context.font = 'bold 20px monospace';
  context.fillText('Xe', 104, 22);
  context.font = 'bold 10px monospace';
  context.fillText('UN 2036', 102, 44);
  context.textAlign = 'center';
  context.font = 'bold 11px monospace';
  context.fillText('XENON, VERDICHTET', width / 2, 64);
  context.font = 'bold 9px monospace';
  context.fillText('ACHTUNG  H280', width / 2, 77);
  context.fillText('Druckgas · erstickend', width / 2, 88);
  texture.needsUpdate = true;
  return { texture, width, height };
}

/** Wrap text onto a sign below its symbol. */
function caption(context: Context, lines: string[], top: number, w: number) {
  context.fillStyle = '#111111';
  context.font = 'bold 11px monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (const [i, line] of lines.entries())
    context.fillText(line, w / 2, top + i * 13);
}

/** ISO 7010 W029, warning of gas cylinders, with its German caption. */
export function createGasCylinderWarningTexture() {
  const width = 128;
  const height = 150;
  const { context, texture } = createCanvasTexture(width, height);
  context.fillStyle = '#f4f2ea';
  context.fillRect(0, 0, width, height);
  context.beginPath();
  context.moveTo(64, 8);
  context.lineTo(120, 102);
  context.lineTo(8, 102);
  context.closePath();
  context.fillStyle = '#111111';
  context.fill();
  context.beginPath();
  context.moveTo(64, 22);
  context.lineTo(108, 95);
  context.lineTo(20, 95);
  context.closePath();
  context.fillStyle = '#f5c400';
  context.fill();
  context.fillStyle = '#111111';
  drawCylinder(context, 64, 70, 38);
  caption(context, ['Warnung vor', 'Gasflaschen'], 120, width);
  texture.needsUpdate = true;
  return { texture, width, height };
}

/** ISO 7010 P003, no open flame, fire or smoking, with its German caption. */
export function createNoOpenFlameTexture() {
  const width = 128;
  const height = 150;
  const { context, texture } = createCanvasTexture(width, height);
  context.fillStyle = '#f4f2ea';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.arc(64, 54, 44, 0, Math.PI * 2);
  context.fill();
  // A match flame.
  context.fillStyle = '#111111';
  context.beginPath();
  context.moveTo(64, 26);
  context.quadraticCurveTo(84, 56, 64, 70);
  context.quadraticCurveTo(44, 56, 64, 26);
  context.fill();
  context.fillRect(61, 70, 6, 16);
  // The red ring and bar over it.
  context.strokeStyle = '#d0201a';
  context.lineWidth = 9;
  context.beginPath();
  context.arc(64, 54, 40, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(64 - 28, 54 - 28);
  context.lineTo(64 + 28, 54 + 28);
  context.stroke();
  caption(
    context,
    ['Keine offene', 'Flamme · Feuer', 'Rauchen verboten'],
    110,
    width,
  );
  texture.needsUpdate = true;
  return { texture, width, height };
}
