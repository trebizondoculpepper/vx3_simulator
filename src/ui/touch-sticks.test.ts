import { describe, expect, it } from 'vitest';
import { stickVector } from './touch-sticks';

describe('stickVector', () => {
  it('reads a resting thumb as centred', () => {
    expect(stickVector(3, 2, 60)).toEqual({ x: 0, y: 0 });
    expect(stickVector(0, 0, 60)).toEqual({ x: 0, y: 0 });
  });

  it('reaches full deflection at the rim and no further', () => {
    const rim = stickVector(60, 0, 60);
    const beyond = stickVector(0, -200, 60);
    expect(rim.x).toBeCloseTo(1);
    expect(beyond.y).toBeCloseTo(-1);
    expect(beyond.x).toBeCloseTo(0);
  });

  it('keeps the direction of a diagonal push', () => {
    const { x, y } = stickVector(30, 30, 60);
    expect(x).toBeCloseTo(y);
    expect(Math.hypot(x, y)).toBeGreaterThan(0.5);
    expect(Math.hypot(x, y)).toBeLessThan(1);
  });
});
