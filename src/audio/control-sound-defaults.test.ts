import { expect, it } from 'vitest';
import { defaultControlRecording } from './control-sound-defaults';
it('gives push-buttons, switches and rockers distinct shared defaults', () => {
  expect(defaultControlRecording('button')).toBe('button');
  expect(defaultControlRecording('key')).toBe('key');
  expect(defaultControlRecording('toggle')).toBe('toggle-up');
  expect(defaultControlRecording('rocker')).toBe('rocker');
});
