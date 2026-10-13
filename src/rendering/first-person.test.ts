import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, MIN_ZOOM, wheelZoom } from './first-person';

describe('wheel zoom', () => {
  it('zooms in when scrolling up and out when scrolling down', () => {
    expect(wheelZoom(1, -100, 0)).toBeGreaterThan(1);
    expect(wheelZoom(1, 100, 0)).toBeLessThan(1);
  });

  it('treats a line-mode notch like its pixel equivalent', () => {
    expect(wheelZoom(1, -3, 1)).toBeCloseTo(wheelZoom(1, -48, 0));
  });

  it('caps a hard flick instead of jumping to a limit', () => {
    expect(wheelZoom(1, -100000, 0)).toBeCloseTo(wheelZoom(1, -200, 0));
    expect(wheelZoom(1, -100000, 0)).toBeLessThan(MAX_ZOOM);
  });

  it('feels the same at every magnification', () => {
    expect(wheelZoom(2, -50, 0) / 2).toBeCloseTo(wheelZoom(1, -50, 0));
  });

  it('stays within its limits under a long smooth swipe', () => {
    let zoom = 1;
    for (let i = 0; i < 500; i++) zoom = wheelZoom(zoom, -4, 0);
    expect(zoom).toBe(MAX_ZOOM);
    for (let i = 0; i < 2000; i++) zoom = wheelZoom(zoom, 4, 0);
    expect(zoom).toBe(MIN_ZOOM);
  });
});
