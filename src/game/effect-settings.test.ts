import { describe, expect, it } from 'vitest';
import { anomalyEffects } from './ferrocore-anomaly';
import {
  effectFrame,
  settingsForActivity,
  withBypass,
} from './effect-settings';

describe('effect settings', () => {
  it('reproduces the lab at every activity', () => {
    for (const activity of [0, 0.2, 0.5, 0.9, 1])
      for (const seconds of [0, 1.7, 13, 240]) {
        const lab = anomalyEffects(activity, seconds, false);
        const frame = effectFrame(settingsForActivity(activity), seconds);
        expect(frame.pi).toBeCloseTo(lab.pi, 12);
        expect(frame.warp).toBeCloseTo(lab.warp, 12);
        frame.channels.forEach((value, i) =>
          expect(value).toBeCloseTo(lab.channels[i], 12),
        );
      }
  });

  it('leaves the room alone when everything is off', () => {
    const frame = effectFrame(settingsForActivity(0), 99);
    expect(frame).toMatchObject({ pi: Math.PI, warp: 0, channels: [1, 1, 1] });
  });

  it('adds a fixed π error on top of the wander', () => {
    const settings = settingsForActivity(0);
    settings.pi.offset = 0.1;
    expect(effectFrame(settings, 5).pi).toBeCloseTo(Math.PI + 0.1, 12);
  });

  it('splits red and blue sideways and up and down, off by default', () => {
    const settings = settingsForActivity(1);
    expect(settings.divergence).toMatchObject({
      horizontalPx: 0,
      verticalPx: 0,
      parallax: 0,
    });
    settings.divergence.horizontalPx = 4;
    settings.divergence.verticalHz = 0.5;
    expect(effectFrame(settings, 2).divergence).toMatchObject({
      horizontalPx: 4,
      verticalPx: 0,
      verticalHz: 0.5,
    });
  });

  it('bypasses an effect without touching its settings or the others', () => {
    const settings = settingsForActivity(1);
    settings.divergence.horizontalPx = 6;
    settings.precision.grid = 0.1;
    settings.pi.offset = 0.2;
    const frame = effectFrame(
      withBypass(settings, new Set(['divergence', 'pi', 'phaser'])),
      3,
    );
    expect(frame.divergence.horizontalPx).toBe(0);
    expect(frame.pi).toBe(Math.PI);
    expect(frame.channels).toEqual([1, 1, 1]);
    expect(frame.precision[0]).toBe(0.1);
    expect(frame.warp).toBe(1);
    expect(settings.divergence.horizontalPx).toBe(6);
    expect(settings.pi.offset).toBe(0.2);
  });

  it('changes nothing when nothing is bypassed', () => {
    const settings = settingsForActivity(0.7);
    expect(effectFrame(withBypass(settings, new Set()), 9)).toEqual(
      effectFrame(settings, 9),
    );
  });
});
