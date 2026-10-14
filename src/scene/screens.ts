import { realistic } from '../rendering/render-style';
import { CanvasTexture, NearestFilter, SRGBColorSpace } from 'three';

/** A small canvas texture, sampled without smoothing for the PS1 look. */
export function createCanvasTexture(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  const texture = new CanvasTexture(canvas);
  if (realistic) {
    // Smooth, sharp lettering at any distance and angle.
    texture.anisotropy = 8;
  } else {
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.generateMipmaps = false;
  }
  texture.colorSpace = SRGBColorSpace;
  return { canvas, context, texture };
}

/** Engraved label plate text. */
export function createLabelTexture(
  text: string,
  { ink = '#e9e1c8', plate = '#2a3128', size = 14 } = {},
) {
  const width = Math.max(32, Math.ceil(text.length * size * 0.62) + 12);
  const height = size + 8;
  const { context, texture } = createCanvasTexture(width, height);
  context.fillStyle = plate;
  context.fillRect(0, 0, width, height);
  context.fillStyle = ink;
  context.font = `bold ${size}px monospace`;
  context.textBaseline = 'middle';
  context.textAlign = 'center';
  context.fillText(text, width / 2, height / 2 + 1);
  texture.needsUpdate = true;
  return { texture, width, height };
}

/** Cream meter face with an optional operating limit on its 270-degree scale. */
export function createDialTexture(redline: number | null = null) {
  const size = 64;
  const { context, texture } = createCanvasTexture(size, size);
  const c = size / 2;
  context.fillStyle = '#2a2a22';
  context.fillRect(0, 0, size, size);
  context.fillStyle = '#e6dfc6';
  context.beginPath();
  context.arc(c, c, 30, 0, Math.PI * 2);
  context.fill();
  const toCanvas = (degrees: number) => ((degrees - 90) * Math.PI) / 180;
  if (redline !== null) {
    context.strokeStyle = '#c43a22';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(c, c, 24, toCanvas(-135 + redline * 270), toCanvas(135));
    context.stroke();
  }
  context.strokeStyle = '#2a2a22';
  context.lineWidth = 2;
  for (let i = 0; i <= 10; i++) {
    const angle = toCanvas(-135 + i * 27);
    const inner = i % 5 === 0 ? 19 : 22;
    context.beginPath();
    context.moveTo(c + Math.cos(angle) * inner, c + Math.sin(angle) * inner);
    context.lineTo(c + Math.cos(angle) * 27, c + Math.sin(angle) * 27);
    context.stroke();
  }
  texture.needsUpdate = true;
  return texture;
}

/** A phosphor oscilloscope screen redrawn every frame from a sampler. */
export function createScopeScreen(width = 128, height = 96) {
  const { context, texture } = createCanvasTexture(width, height);
  const draw = (points: [number, number][], on: boolean) => {
    context.fillStyle = '#0b1a0f';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = '#1f4a28';
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 16; x < width; x += 16) {
      context.moveTo(x + 0.5, 0);
      context.lineTo(x + 0.5, height);
    }
    for (let y = 16; y < height; y += 16) {
      context.moveTo(0, y + 0.5);
      context.lineTo(width, y + 0.5);
    }
    context.stroke();
    if (on && points.length > 1) {
      context.strokeStyle = '#7dff8a';
      context.lineWidth = 2;
      context.beginPath();
      points.forEach(([x, y], i) => {
        const px = x * width;
        const py = y * height;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      });
      context.stroke();
    }
    texture.needsUpdate = true;
  };
  return { texture, draw };
}

/** Six-digit Nixie readout. */
export function createNixieScreen() {
  const width = 192;
  const height = 48;
  const { context, texture } = createCanvasTexture(width, height);
  let last = '';
  const draw = (digits: string, on: boolean) => {
    const key = `${digits}${on}`;
    if (key === last) return;
    last = key;
    context.fillStyle = '#120c08';
    context.fillRect(0, 0, width, height);
    context.font = 'bold 36px monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (let i = 0; i < digits.length; i++) {
      const x = 16 + i * 32;
      context.fillStyle = '#2a1e14';
      context.fillRect(x - 13, 4, 26, 40);
      context.fillStyle = on ? '#ff9a3c' : '#3a2a1c';
      context.fillText(digits[i], x, height / 2 + 2);
    }
    texture.needsUpdate = true;
  };
  return { texture, draw };
}
