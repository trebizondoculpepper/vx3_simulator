import { beforeEach, expect, it, vi } from 'vitest';
import { createPrintedImageTexture } from './printed-image';

const fixture = vi.hoisted(() => ({
  canvas: { width: 1, height: 1 },
  context: { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() },
  loaded: null as
    null | ((value: { image: unknown; dispose: () => void }) => void),
  dispose: null as null | (() => void),
  imageDispose: vi.fn(),
}));
vi.mock('three', () => ({
  TextureLoader: class {
    load(_url: string, loaded: typeof fixture.loaded) {
      fixture.loaded = loaded;
      return { dispose: fixture.imageDispose };
    }
  },
}));
vi.mock('./screens', () => ({
  createCanvasTexture: (width: number, height: number) => {
    fixture.canvas.width = width;
    fixture.canvas.height = height;
    return {
      canvas: fixture.canvas,
      context: fixture.context,
      texture: {
        needsUpdate: false,
        addEventListener: (_event: string, dispose: () => void) => {
          fixture.dispose = dispose;
        },
      },
    };
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  fixture.loaded = fixture.dispose = null;
});
it('uploads decoded artwork into the existing canvas texture and preserves its aspect ratio', () => {
  const texture = createPrintedImageTexture('/poster.webp');
  expect(texture.needsUpdate).toBe(true);
  expect(fixture.context.drawImage).not.toHaveBeenCalled();
  const image = { naturalWidth: 768, naturalHeight: 1152 };
  fixture.loaded!({ image, dispose: fixture.imageDispose });
  expect(fixture.context.drawImage).toHaveBeenCalledWith(
    image,
    0,
    0,
    768,
    1152,
  );
  expect(fixture.canvas).toEqual({ width: 768, height: 1152 });
});
it('does not upload a late image after the scene has disposed its texture', () => {
  createPrintedImageTexture('/poster.webp');
  fixture.dispose!();
  fixture.loaded!({
    image: { naturalWidth: 768, naturalHeight: 1152 },
    dispose: fixture.imageDispose,
  });
  expect(fixture.context.drawImage).not.toHaveBeenCalled();
  expect(fixture.imageDispose).toHaveBeenCalled();
});
