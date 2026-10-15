import { describe, expect, it } from 'vitest';
import {
  angleFromSight,
  createHallucinations,
  defaultHallucinationSettings,
  seenWithin,
} from './hallucination';
import type { Viewer } from './hallucination';

/** At the origin, looking down −z, a 90° wide view. */
const viewer: Viewer = { x: 0, z: 0, yaw: 0, halfWidth: Math.PI / 4 };
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('the peripheral vision hallucination', () => {
  it('measures angles from the line of sight, positive to the right', () => {
    expect(angleFromSight(viewer, 0, -3)).toBeCloseTo(0);
    expect(angleFromSight(viewer, 3, -3)).toBeCloseTo(Math.PI / 4);
    expect(angleFromSight(viewer, -3, -3)).toBeCloseTo(-Math.PI / 4);
    // The walker's own convention: facing +x is a quarter turn right.
    const east = { ...viewer, yaw: Math.PI / 2 };
    expect(angleFromSight(east, 3, 0)).toBeCloseTo(0);
  });

  it('appears just beyond the edge of the view, never in it', () => {
    const h = createHallucinations();
    for (let k = 0; k < 40; k++) {
      h.clear();
      const made = h.summon(viewer, Math.random)!;
      const angle = Math.abs(angleFromSight(viewer, made.x, made.z));
      expect(angle).toBeGreaterThan(viewer.halfWidth);
      expect(angle).toBeLessThan(viewer.halfWidth + 0.6);
      expect(Math.hypot(made.x, made.z)).toBeGreaterThan(2);
    }
  });

  it('waits, solid, while out of sight', () => {
    const h = createHallucinations();
    h.summon(viewer, Math.random);
    for (let k = 0; k < 50; k++) h.step(0.1, viewer, () => 1);
    expect(h.apparitions[0].opacity).toBe(1);
    expect(h.apparitions[0].seen).toBe(false);
  });

  it('fades while looked at, over the fade time, then is gone', () => {
    const settings = { ...defaultHallucinationSettings(), fadeSeconds: 2 };
    const h = createHallucinations(settings);
    const made = h.summon(viewer, Math.random)!;
    // Turn to face it.
    const facing = {
      ...viewer,
      yaw: viewer.yaw + angleFromSight(viewer, made.x, made.z),
    };
    h.step(1, facing, () => 1);
    expect(h.apparitions[0].opacity).toBeCloseTo(0.5);
    expect(h.apparitions[0].seen).toBe(true);
    // Looking away does not bring it back.
    h.step(1, viewer, () => 1);
    expect(h.apparitions[0].opacity).toBeCloseTo(0.5);
    h.step(1.01, facing, () => 1);
    expect(h.apparitions).toHaveLength(0);
  });

  it('must be looked at more directly as NOTICE rises', () => {
    const loose = { ...defaultHallucinationSettings(), notice: 0 };
    const strict = { ...defaultHallucinationSettings(), notice: 1 };
    expect(seenWithin(loose, viewer)).toBeCloseTo(viewer.halfWidth);
    expect(seenWithin(strict, viewer)).toBeLessThan(0.1);
  });

  it('appears about as often as RATE says', () => {
    const settings = { ...defaultHallucinationSettings(), perMinute: 12 };
    const h = createHallucinations({ ...settings, most: 1000 });
    let made = 0;
    let state = 7;
    const random = () => {
      state = (state * 16807) % 2147483647;
      return state / 2147483647;
    };
    for (let t = 0; t < 600; t += 0.1)
      made += h.step(0.1, viewer, random).length;
    // Ten minutes at twelve a minute.
    expect(made).toBeGreaterThan(90);
    expect(made).toBeLessThan(150);
  });

  it('never makes more than MOST at once, nor where it cannot stand', () => {
    const h = createHallucinations({
      ...defaultHallucinationSettings(),
      most: 2,
    });
    h.summon(viewer, Math.random);
    h.summon(viewer, Math.random);
    expect(h.summon(viewer, Math.random)).toBeNull();
    h.clear();
    expect(h.summon(viewer, sequence(0.3, 0.5, 0.5), () => false)).toBeNull();
  });
});
