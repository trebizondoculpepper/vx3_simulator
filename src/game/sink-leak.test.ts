import { expect, it } from 'vitest';
import { createSinkLeak } from './sink-leak';
it('drips after ten seconds and splashes once when the drop lands', () => {
  const sink = createSinkLeak();
  expect(sink.step(9.9)).toEqual({ drop: null, impact: false });
  expect(sink.step(0.15).drop).not.toBeNull();
  expect(sink.step(0.35).impact).toBe(true);
  expect(sink.step(0.1).impact).toBe(false);
});
it('reseats the washer after switching on and off, stopping further drips', () => {
  const sink = createSinkLeak();
  expect(sink.toggle()).toBe(true);
  expect(sink.step(20).impact).toBe(false);
  expect(sink.toggle()).toBe(false);
  expect(sink.leaking).toBe(false);
  expect(sink.step(40)).toEqual({ drop: null, impact: false });
});
