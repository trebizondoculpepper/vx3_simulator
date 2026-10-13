import { describe, expect, it } from 'vitest';
import { anomalyEffects } from './ferrocore-anomaly';
import { effectFrame, settingsForActivity } from './effect-settings';

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
});
