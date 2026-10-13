import { expect, it } from 'vitest';
import { coreProjection } from './core-projection';
it('crosses the criticality boundary into irregular and then four-dimensional geometry', () => {
  expect(
    [293, 800, 2000, 3199, 3200, 3700, 4000].map((value) =>
      coreProjection(value),
    ),
  ).toEqual([
    'basis',
    'cube',
    'polyhedron',
    'polyhedron',
    'irregular',
    'tesseract',
    'tesseract',
  ]);
  expect(coreProjection(4000, true)).toBe('fault');
  expect(coreProjection(1000)).toBe('cube');
});
