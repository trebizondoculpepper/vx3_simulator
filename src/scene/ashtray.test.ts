import { expect, it, vi } from 'vitest';
import { createSmokeEmitter } from './smoke-emitter';
import { createAshtray } from './ashtray';
vi.mock('./smoke-emitter', async () => {
  const { Group } = await import('three');
  return {
    createSmokeEmitter: vi.fn(() => ({
      group: new Group(),
      update: vi.fn(),
      dispose: vi.fn(),
    })),
  };
});
it('puts out the cigarette when water runs and keeps it out after the sprinkler stops', () => {
  const tray = createAshtray();
  const smoke = vi.mocked(createSmokeEmitter).mock.results[0].value;
  tray.update(1, false);
  expect(smoke.update).toHaveBeenLastCalledWith(1, 1, false);
  tray.update(2, false, true);
  expect(smoke.update).toHaveBeenLastCalledWith(2, 0, false);
  tray.update(3, false, false);
  expect(smoke.update).toHaveBeenLastCalledWith(3, 0, false);
  tray.reset();
  tray.update(4, false);
  expect(smoke.update).toHaveBeenLastCalledWith(4, 1, false);
  tray.dispose();
});
