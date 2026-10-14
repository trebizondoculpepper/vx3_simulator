import { describe, expect, it } from 'vitest';
import {
  ALARM_CYCLE,
  ALARM_LOOP,
  PIEZO_HZ,
  SWEEP_FROM_HZ,
  SWEEP_PERIOD,
  SWEEP_TO_HZ,
  alarmAt,
  renderFireAlarm,
} from './fire-alarm';

describe('the fire alarm', () => {
  it('pulses the piezo half a second in every second', () => {
    expect(alarmAt(0.2).piezo).toBe(1);
    expect(alarmAt(0.6).piezo).toBe(0);
    expect(alarmAt(1.2).piezo).toBe(1);
  });

  it('sounds the buzzer’s two notes, in turn, in the piezo’s gap', () => {
    expect(alarmAt(0.2).buzzer).toEqual([0, 0]);
    expect(alarmAt(0.6).buzzer).toEqual([1, 0]);
    expect(alarmAt(0.85).buzzer).toEqual([0, 1]);
  });

  it('sweeps the far sounder downwards', () => {
    expect(alarmAt(0.001).sweepHz).toBeCloseTo(SWEEP_FROM_HZ, -1);
    expect(alarmAt(0.3).sweepHz).toBeLessThan(alarmAt(0.1).sweepHz);
    expect(alarmAt(0.3).sweepHz).toBeGreaterThan(SWEEP_TO_HZ);
  });

  it('loops on whole cycles and whole sweeps', () => {
    expect((ALARM_LOOP / ALARM_CYCLE) % 1).toBe(0);
    const sweeps = ALARM_LOOP / SWEEP_PERIOD;
    expect(sweeps).toBeCloseTo(Math.round(sweeps));
  });

  it('renders a loop that joins without a click, loudest at the piezo', () => {
    const rate = 8000;
    const samples = renderFireAlarm(rate);
    expect(samples.length).toBe(ALARM_LOOP * rate);
    let peak = 0;
    for (const v of samples) {
      expect(Number.isFinite(v)).toBe(true);
      peak = Math.max(peak, Math.abs(v));
    }
    expect(peak).toBeCloseTo(0.9);
    // Where the loop joins, every note is silent: only quiet reflections.
    expect(Math.abs(samples[0] - samples.at(-1)!)).toBeLessThan(0.2);
    // The piezo's pitch: count zero crossings over a stretch of it.
    let crossings = 0;
    const from = Math.round(0.1 * rate);
    const to = Math.round(0.4 * rate);
    for (let i = from + 1; i < to; i++)
      if (samples[i - 1] < 0 !== samples[i] < 0) crossings++;
    expect(crossings / 2 / 0.3).toBeGreaterThan(PIEZO_HZ * 0.6);
  });
});
