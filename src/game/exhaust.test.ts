import { describe, expect, it } from 'vitest';
import {
  FULL_EMISSION_PPM,
  createExhaust,
  doseEffects,
  emission,
  fouling,
  glow,
  stepExhaust,
} from './exhaust';

const run = (emitting: number, seconds: number, state = createExhaust()) => {
  for (let t = 0; t < seconds; t += 0.1) stepExhaust(state, emitting, 0.1);
  return state;
};

describe('the column exhaust', () => {
  it('is clean in a finished purge at working pressure', () => {
    expect(fouling(true, 0.2, 1.4)).toBe(0);
  });

  it('fouls by degree with oxygen left in, and wholly unsealed', () => {
    const slight = fouling(true, 1, 1.4);
    const gross = fouling(true, 10, 1.4);
    expect(slight).toBeGreaterThan(0);
    expect(slight).toBeLessThan(0.5);
    expect(gross).toBe(1);
    expect(fouling(false, 0, 1.4)).toBe(1);
  });

  it('fouls when the xenon is short', () => {
    expect(fouling(true, 0, 0.6)).toBeCloseTo(0.5);
  });

  it('comes only from a running core', () => {
    expect(glow(400)).toBe(0);
    expect(glow(800)).toBeCloseTo(0.25);
    expect(glow(3200)).toBe(1);
    const sources = { glow: 0, fouling: 1, outletOpen: true, unsealed: true };
    expect(emission(sources)).toBe(0);
  });

  it('escapes by the worst route: fouling, the outlet or the seal', () => {
    const clean = { glow: 1, fouling: 0, outletOpen: false, unsealed: false };
    expect(emission(clean)).toBe(0);
    expect(emission({ ...clean, fouling: 0.3 })).toBeCloseTo(0.3);
    expect(emission({ ...clean, outletOpen: true })).toBe(1);
    expect(emission({ ...clean, unsealed: true })).toBe(1);
  });

  it('fills the room, which clears slowly, and the dose lingers longer', () => {
    const state = run(1, 300);
    expect(state.room).toBeGreaterThan(FULL_EMISSION_PPM * 0.95);
    expect(state.dose).toBeGreaterThan(0.95);
    run(0, 60, state);
    // The room has cleared by more than half; the dose has not.
    expect(state.room).toBeLessThan(FULL_EMISSION_PPM * 0.4);
    expect(state.dose).toBeGreaterThan(0.6);
    run(0, 900, state);
    expect(state.dose).toBeLessThan(0.05);
  });

  it('climbs a ladder: ghosting, apparitions, then patterns', () => {
    expect(doseEffects(0)).toEqual({
      ghosting: 0,
      apparitions: 0,
      patterns: 0,
    });
    const low = doseEffects(0.25);
    expect(low.ghosting).toBeGreaterThan(0.5);
    expect(low.apparitions).toBe(0);
    const mid = doseEffects(0.5);
    expect(mid.ghosting).toBe(1);
    expect(mid.apparitions).toBeGreaterThan(0.5);
    expect(mid.patterns).toBe(0);
    expect(doseEffects(1)).toEqual({
      ghosting: 1,
      apparitions: 1,
      patterns: 1,
    });
  });
});
