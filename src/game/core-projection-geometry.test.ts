import { expect, it } from 'vitest';
import { projectionWireframe } from './core-projection-geometry';

it('rotates a connected twelve-vertex solid without moving the reference frame', () => {
  const first = projectionWireframe('irregular', 0);
  const next = projectionWireframe('irregular', 1);
  expect(first.points).toHaveLength(12);
  expect(first.edges).toHaveLength(30);
  expect(next.edges).toEqual(first.edges);
  expect(next.points).not.toEqual(first.points);
});

it('projects all sixteen vertices and thirty-two edges of a rotating tesseract', () => {
  for (let time = 0; time < 60; time += 0.5) {
    const frame = projectionWireframe('tesseract', time);
    expect(frame.points).toHaveLength(16);
    expect(frame.edges).toHaveLength(32);
    for (const point of frame.points)
      for (const value of point) expect(Number.isFinite(value)).toBe(true);
    for (const [x, y] of frame.points) {
      expect(x).toBeGreaterThan(10);
      expect(x).toBeLessThan(246);
      expect(y).toBeGreaterThan(23);
      expect(y).toBeLessThan(170);
    }
  }
});
