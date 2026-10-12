import { describe, expect, it } from 'vitest';
import { slide } from './walk-collision';

const wall = { minX: -10, maxX: 10, minZ: 4, maxZ: 5 };

describe('slide', () => {
  it('moves freely through open floor', () => {
    const { x, z } = slide([wall], 0, 0, 1, 1, 0.5);
    expect(x).toBeCloseTo(1);
    expect(z).toBeCloseTo(1);
  });

  it('stops at a wall, keeping the walker a radius away', () => {
    const { z } = slide([wall], 0, 0, 0, 10, 0.5);
    expect(z).toBeLessThanOrEqual(3.5);
    expect(z).toBeGreaterThan(3);
  });

  it('slides along a wall when walking into it at an angle', () => {
    const { x, z } = slide([wall], 0, 3, 2, 2, 0.5);
    expect(x).toBeCloseTo(2);
    expect(z).toBeLessThanOrEqual(3.5);
  });

  it('cannot tunnel through a thin wall in one long step', () => {
    const thin = { minX: -10, maxX: 10, minZ: 4, maxZ: 4.05 };
    expect(slide([thin], 0, 0, 0, 40, 0.5).z).toBeLessThan(4);
  });

  it('passes through a doorway between two wall sections', () => {
    const left = { minX: -10, maxX: -1, minZ: 4, maxZ: 5 };
    const right = { minX: 1, maxX: 10, minZ: 4, maxZ: 5 };
    expect(slide([left, right], 0, 0, 0, 8, 0.5).z).toBeCloseTo(8);
  });

  it('lets a walker caught inside something step back out', () => {
    expect(slide([wall], 0, 4.5, 0, -3, 0.5).z).toBeCloseTo(1.5);
  });
});
