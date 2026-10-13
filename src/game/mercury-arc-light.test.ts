import { expect, it } from 'vitest';
import { mercuryArcLight } from './mercury-arc-light';
it('pulses the running rectifier eight times per second with deep dark intervals', () => {
  expect(mercuryArcLight(true, 1 / 32, false)).toBeCloseTo(1);
  expect(mercuryArcLight(true, 3 / 32, false)).toBeCloseTo(0.04);
  expect(mercuryArcLight(true, 1 / 32 + 1 / 8, false)).toBeCloseTo(1);
});
it('is dark without power and steady for reduced motion', () => {
  expect(mercuryArcLight(false, 1 / 32, false)).toBe(0);
  expect(mercuryArcLight(false, 1 / 32, true)).toBe(0);
  expect(mercuryArcLight(true, 3 / 32, true)).toBe(1);
});
