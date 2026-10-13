import { TextureLoader } from 'three';
import { createCanvasTexture } from './screens';

/** Keep a valid printable texture while the image loads, then upload decoded canvas pixels. */
export function createPrintedImageTexture(url: string, aspect = 1.5) {
  // WebGL texture storage cannot be resized after its first upload.
  const { canvas, context, texture } = createCanvasTexture(
    768,
    Math.round(768 * aspect),
  );
  context.fillStyle = '#ddd1b2';
  context.fillRect(0, 0, canvas.width, canvas.height);
  texture.needsUpdate = true;
  let disposed = false;
  const image = new TextureLoader().load(
    url,
    (loaded) => {
      if (!disposed) {
        const source = loaded.image as HTMLImageElement;
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        texture.needsUpdate = true;
      }
      loaded.dispose();
    },
    undefined,
    (error) => {
      console.warn(`Printed artwork unavailable: ${url}`, error);
    },
  );
  texture.addEventListener('dispose', () => {
    disposed = true;
    image.dispose();
  });
  return texture;
}
