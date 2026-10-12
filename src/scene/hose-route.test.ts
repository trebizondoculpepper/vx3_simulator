import { expect, it } from 'vitest';
import { TubeGeometry, Vector3 } from 'three';
import { floorSafeHose } from './hose-route';

it('keeps the outside of a thick sagging hose above the floor', () => {
  const floorY = -12;
  const radius = 0.09;
  const points = [
    new Vector3(0, -10, 0),
    new Vector3(1, floorY + 0.01, 1),
    new Vector3(2, floorY + 0.01, 1),
    new Vector3(3, -10, 0),
  ];
  const curve = floorSafeHose(points, floorY, radius);
  const geometry = new TubeGeometry(curve, 80, radius, 8, false);
  geometry.computeBoundingBox();
  expect(geometry.boundingBox!.min.y).toBeGreaterThan(floorY);
  expect(curve.getPoint(0).distanceTo(points[0])).toBeCloseTo(0);
  expect(curve.getPoint(1).distanceTo(points[3])).toBeCloseTo(0);
  geometry.dispose();
});
