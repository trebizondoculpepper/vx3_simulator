import { describe, expect, it } from 'vitest';
import { createSpatialMix, inverseSquareGain } from './spatial-mix';

const options = { reference: 1, cutoff: 10, maxGain: 2, moveThreshold: 0.05 };

describe('inverseSquareGain', () => {
  it('halves the amplitude (a quarter of the power) at twice the distance', () => {
    expect(inverseSquareGain(2, 1, 4)).toBeCloseTo(0.5);
    expect(inverseSquareGain(4, 1, 4)).toBeCloseTo(0.25);
    expect(inverseSquareGain(4, 1, 4) ** 2).toBeCloseTo(
      inverseSquareGain(2, 1, 4) ** 2 / 4,
    );
  });

  it('caps the boost right up against the source', () => {
    expect(inverseSquareGain(0, 1, 2)).toBe(2);
    expect(inverseSquareGain(0.1, 1, 2)).toBe(2);
  });
});

describe('createSpatialMix', () => {
  it('makes nearer emitters louder', () => {
    const mix = createSpatialMix(
      [
        { id: 'near', x: 2, y: 0, z: 0 },
        { id: 'far', x: 0, y: 0, z: 6 },
      ],
      options,
    );
    mix.move(0, 0, 0);
    expect(mix.gain('near')).toBeCloseTo(0.5);
    expect(mix.gain('far')).toBeCloseTo(1 / 6);
  });

  it('silences emitters beyond the cutoff and forgets them as you walk away', () => {
    const mix = createSpatialMix([{ id: 'hum', x: 0, y: 0, z: 0 }], options);
    mix.move(5, 0, 0);
    expect(mix.gain('hum')).toBeCloseTo(0.2);
    expect(mix.audibleCount()).toBe(1);
    mix.move(25, 0, 0);
    expect(mix.gain('hum')).toBe(0);
    expect(mix.audibleCount()).toBe(0);
  });

  it('finds emitters in the neighbouring grid cell', () => {
    // The listener is just below a cell boundary, the emitter just above.
    const mix = createSpatialMix([{ id: 'x', x: 10.5, y: 0, z: 0 }], options);
    mix.move(9.5, 0, 0);
    expect(mix.gain('x')).toBeCloseTo(1);
  });

  it('skips the sums until the listener has moved far enough', () => {
    const mix = createSpatialMix([{ id: 'x', x: 3, y: 0, z: 0 }], options);
    expect(mix.move(0, 0, 0)).toBe(true);
    expect(mix.move(0.01, 0, 0)).toBe(false);
    expect(mix.gain('x')).toBeCloseTo(1 / 3);
    expect(mix.move(1, 0, 0)).toBe(true);
    expect(mix.gain('x')).toBeCloseTo(0.5);
  });

  it('only changes the pan when the listener turns on the spot', () => {
    const mix = createSpatialMix([{ id: 'x', x: 2, y: 0, z: 0 }], options);
    mix.move(0, 0, 0);
    // Facing −z, an emitter on +x is to the right.
    mix.face(0);
    expect(mix.pan('x')).toBeCloseTo(1);
    const gain = mix.gain('x');
    // Facing +x, it is straight ahead.
    expect(mix.face(Math.PI / 2)).toBe(true);
    expect(mix.pan('x')).toBeCloseTo(0);
    expect(mix.face(Math.PI / 2)).toBe(false);
    expect(mix.gain('x')).toBe(gain);
  });

  it('returns silence for an unknown emitter', () => {
    const mix = createSpatialMix([], options);
    mix.move(0, 0, 0);
    expect(mix.gain('nowhere')).toBe(0);
  });
});
