import type { Camera, Scene, WebGLRenderer } from 'three';

export const HALLWAY_LAYER = 2;

/** Draw the hallway with its own lights, keeping the rooms' shared depth buffer. */
export function renderWithHallwayLighting(
  renderer: Pick<WebGLRenderer, 'autoClear' | 'render'>,
  scene: Scene,
  camera: Camera,
) {
  const mask = camera.layers.mask;
  const autoClear = renderer.autoClear;
  const background = scene.background;
  try {
    // Three.js gathers lights by camera layer, rather than by each mesh's
    // layer. Draw the lab, plant room and hallway separately to isolate them.
    const layers = Array.from({ length: 32 }, (_, index) => 1 << index).filter(
      (layer) => mask & layer,
    );
    for (const [index, layer] of layers.entries()) {
      camera.layers.mask = layer;
      if (index > 0) {
        renderer.autoClear = false;
        // A colour background forces a clear even with autoClear disabled.
        scene.background = null;
      }
      renderer.render(scene, camera);
    }
  } finally {
    camera.layers.mask = mask;
    renderer.autoClear = autoClear;
    scene.background = background;
  }
}
