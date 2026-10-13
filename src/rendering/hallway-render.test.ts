import { AmbientLight, Color, PerspectiveCamera, Scene } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { HALLWAY_LAYER, renderWithHallwayLighting } from './hallway-render';

describe('hallway lighting isolation', () => {
  it('isolates the plant room and hallway lights from the lab pass and retains depth for the hallway', () => {
    const scene = new Scene();
    const background = new Color('#123456');
    scene.background = background;
    const camera = new PerspectiveCamera();
    camera.layers.enable(1);
    camera.layers.enable(HALLWAY_LAYER);
    const labLight = new AmbientLight();
    const hallLight = new AmbientLight();
    hallLight.layers.set(HALLWAY_LAYER);
    const passes: unknown[] = [];
    const renderer = {
      autoClear: true,
      render: vi.fn(() => {
        passes.push({
          labLight: camera.layers.test(labLight.layers),
          hallLight: camera.layers.test(hallLight.layers),
          autoClear: renderer.autoClear,
          background: scene.background,
        });
      }),
    };
    renderWithHallwayLighting(renderer, scene, camera);
    expect(passes).toEqual([
      { labLight: true, hallLight: false, autoClear: true, background },
      { labLight: false, hallLight: false, autoClear: false, background: null },
      { labLight: false, hallLight: true, autoClear: false, background: null },
    ]);
    expect(camera.layers.mask).toBe(7);
    expect(renderer.autoClear).toBe(true);
    expect(scene.background).toBe(background);
  });

  it('keeps views without the hallway on one pass', () => {
    const camera = new PerspectiveCamera();
    const renderer = { autoClear: true, render: vi.fn() };
    renderWithHallwayLighting(renderer, new Scene(), camera);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(camera.layers.mask).toBe(1);
  });

  it('restores render state if the hallway pass fails', () => {
    const scene = new Scene();
    const background = new Color('#123456');
    scene.background = background;
    const camera = new PerspectiveCamera();
    camera.layers.enable(HALLWAY_LAYER);
    const renderer = {
      autoClear: true,
      render: vi
        .fn()
        .mockImplementationOnce(() => {})
        .mockImplementationOnce(() => {
          throw new Error('render failure');
        }),
    };
    expect(() => renderWithHallwayLighting(renderer, scene, camera)).toThrow(
      'render failure',
    );
    expect(camera.layers.mask).toBe(5);
    expect(renderer.autoClear).toBe(true);
    expect(scene.background).toBe(background);
  });
});
