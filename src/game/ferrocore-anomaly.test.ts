import { describe, expect, it } from 'vitest';
import {
  anomalyEffects,
  anomalyStage,
  CHANNEL_HZ,
  ferrocoreActivity,
} from './ferrocore-anomaly';
import { createRig } from './rig';

const rigAt = (spindle: number, field = 0) => {
  const rig = createRig();
  rig.spindle = spindle;
  rig.field = field;
  return rig;
};

describe('ferrocore anomaly', () => {
  it('stays dormant until the drum is turning, then grows with the field', () => {
    expect(ferrocoreActivity(rigAt(0.1))).toBe(0);
    const spinning = ferrocoreActivity(rigAt(0.9));
    expect(spinning).toBeGreaterThan(0.6);
    expect(ferrocoreActivity(rigAt(0.9, 1))).toBeGreaterThan(spinning);
    expect(ferrocoreActivity(rigAt(1, 1))).toBeLessThanOrEqual(1);
  });

  it('leaves the room untouched while the cores are dormant', () => {
    for (const seconds of [0, 3.7, 120]) {
      const effects = anomalyEffects(0, seconds, false);
      expect(effects.channels).toEqual([1, 1, 1]);
      expect(effects.pi).toBe(Math.PI);
      expect(effects.warp).toBe(0);
      expect(effects.sparkleRate).toBe(0);
    }
  });

  it('bends π, space and colour when the cores run hard', () => {
    let largest = 0;
    for (let t = 0; t < 120; t += 0.5) {
      const effects = anomalyEffects(1, t, false);
      largest = Math.max(largest, Math.abs(effects.pi - Math.PI));
      expect(effects.pi).toBeGreaterThan(3);
      expect(effects.pi).toBeLessThan(3.3);
      for (const channel of effects.channels) {
        expect(channel).toBeGreaterThanOrEqual(0.7);
        expect(channel).toBeLessThanOrEqual(1.3);
      }
    }
    expect(largest).toBeGreaterThan(0.02);
    expect(anomalyEffects(1, 0, false).warp).toBe(1);
    expect(anomalyEffects(1, 0, false).sparkleRate).toBeGreaterThan(30);
  });

  it('pulses colour far below photosensitive flash rates', () => {
    for (const hz of CHANNEL_HZ) expect(hz).toBeLessThan(1);
  });

  it('holds colour and space still for players who prefer reduced motion', () => {
    const effects = anomalyEffects(1, 2.5, true);
    expect(effects.channels).toEqual([1, 1, 1]);
    expect(effects.warp).toBe(0);
    expect(effects.pi).not.toBe(Math.PI);
  });

  it('names stages for the log', () => {
    expect([0, 0.3, 0.8].map(anomalyStage)).toEqual([0, 1, 2]);
  });
});
