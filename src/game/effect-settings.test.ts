import { describe, expect, it } from 'vitest';
import { anomalyEffects } from './ferrocore-anomaly';
import {
  effectFrame,
  effectRecording,
  printRecording,
  readEffectRecording,
  recordingFileName,
  settingsForActivity,
  settingsForMachine,
  divergencePulse,
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

describe('effect recordings', () => {
  const room = {
    activity: 0.4,
    timeSpeed: 1.5,
    effectSeconds: 12.25,
    exempt: ['teapot'],
    bypassed: ['pi' as const],
  };
  const at = new Date('2026-10-13T15:20:07.123Z');

  it('round-trips through JSON exactly', () => {
    const settings = settingsForActivity(0.4);
    settings.precision.grid = 0.06;
    settings.divergence.parallax = 8;
    const made = effectRecording(settings, room, 3, at);
    const read = readEffectRecording(JSON.stringify(made));
    expect(read).toEqual(made);
  });

  it('copies the settings, so later turning does not change it', () => {
    const settings = settingsForActivity(1);
    const made = effectRecording(settings, room, 1, at);
    settings.warp.amount = 0;
    expect(made.settings.warp.amount).toBe(1);
  });

  it('fills in dials an older recording lacks, and ignores junk', () => {
    const read = readEffectRecording({
      format: 'vx3-effects',
      settings: { warp: { amount: 2, twist: 'lots' }, phaser: { hz: [1] } },
    });
    expect(read.settings.warp.amount).toBe(2);
    expect(read.settings.warp.twist).toBe(0.2);
    expect(read.settings.phaser.hz).toEqual(settingsForActivity(0).phaser.hz);
    expect(read.settings.precision).toEqual(settingsForActivity(0).precision);
    expect(read.room).toEqual({
      activity: 0,
      timeSpeed: 1,
      effectSeconds: 0,
      exempt: [],
      bypassed: [],
    });
  });

  it('refuses anything that is not a recording', () => {
    expect(() => readEffectRecording({ warp: {} })).toThrow();
  });

  it('names the file by time and number', () => {
    const made = effectRecording(settingsForActivity(0), room, 3, at);
    expect(recordingFileName(made)).toBe('vx3-effects-20261013-152007-03.json');
  });

  it('prints every section and the file name', () => {
    const made = effectRecording(settingsForActivity(0.4), room, 3, at);
    const text = printRecording(made);
    for (const word of [
      'RECORDING 03',
      'WARP',
      'FIELD',
      'PRECISION',
      'PI',
      'PHASER',
      'DIVERGE',
      'BYPASSED PI',
      'KEPT WHOLE TEAPOT',
      'vx3-effects-20261013-152007-03.json',
    ])
      expect(text).toContain(word);
  });
});

describe('the machine’s effects on the room', () => {
  const machine = (activity: number, full = 0, overheat = 0, instability = 0) =>
    settingsForMachine({
      activity,
      full,
      overheat,
      instability,
      centreX: 1,
      centreZ: 2,
    });

  it('leaves a cold machine’s room alone', () => {
    const frame = effectFrame(machine(0), 7);
    expect(frame).toMatchObject({ pi: Math.PI, warp: 0, channels: [1, 1, 1] });
    expect(frame.divergence.horizontalPx).toBe(0);
    expect(frame.precision[0]).toBe(0);
  });

  it('does nothing much until the machine is close to activation', () => {
    for (const activity of [0, 0.3, 0.55]) {
      const quiet = machine(activity);
      expect(quiet.precision.grid).toBe(0);
      expect(quiet.divergence.horizontalPx).toBe(0);
      expect(quiet.warp.amount).toBe(0);
    }
  });

  it('is mild running normally, even fully: no breathing', () => {
    const running = machine(0.9, 1);
    expect(running.precision.grid).toBeGreaterThan(0);
    expect(running.divergence.horizontalPx).toBeGreaterThan(0);
    expect(running.warp.amount).toBe(0);
    // Never more than 2 mm while running normally.
    expect(machine(1, 1).precision.grid).toBeCloseTo(0.002, 6);
  });

  it('breathes only when overheating, more as it nears critical', () => {
    const warm = machine(0.9, 1, 0.3);
    const critical = machine(0.9, 1, 1);
    expect(warm.warp.amount).toBeGreaterThan(0);
    expect(critical.warp.amount).toBeCloseTo(0.12, 6);
    expect(critical.warp.amount).toBeGreaterThan(warm.warp.amount);
    expect(critical.divergence.horizontalPx).toBeGreaterThan(
      machine(0.9, 1).divergence.horizontalPx,
    );
    expect(critical.precision.grid).toBeGreaterThan(
      machine(0.9, 1).precision.grid,
    );
    expect(critical.warp).toMatchObject({ centreX: 1, centreZ: 2 });
    // About one breath every six seconds.
    expect((Math.PI * 2) / critical.warp.swellSpeed).toBeCloseTo(6, 6);
  });

  it('breathes faster with an unstable field', () => {
    expect(machine(0.9, 1, 1, 1).warp.swellSpeed).toBeGreaterThan(
      machine(0.9, 1, 1, 0).warp.swellSpeed,
    );
  });
});

describe('the divergence pulse', () => {
  it('swells from nothing to the full amount and back over its period', () => {
    expect(divergencePulse(0)).toBeCloseTo(0, 6);
    expect(divergencePulse(3.5)).toBeCloseTo(1, 6);
    expect(divergencePulse(7)).toBeCloseTo(0, 6);
    for (let t = 0; t < 14; t += 0.37) {
      expect(divergencePulse(t)).toBeGreaterThanOrEqual(0);
      expect(divergencePulse(t)).toBeLessThanOrEqual(1);
    }
  });
});
