import { describe, expect, it } from 'vitest';
import {
  TIE_BARS,
  VOICE_HIGH_HZ,
  VOICE_LOW_HZ,
  coreVoiceParameters,
} from './core-voice-parameters';
import type { CoreVoiceInput } from './core-voice-parameters';

const at = (input: Partial<CoreVoiceInput>) =>
  coreVoiceParameters({
    kelvin: 293,
    brightness: 0.6,
    spinRate: 0,
    sealed: true,
    failed: false,
    ...input,
  });

describe('core voice', () => {
  it('is silent while the core is cold', () => {
    expect(at({ kelvin: 293 }).gain).toBe(0);
    expect(at({ kelvin: 600 }).gain).toBe(0);
  });

  it('fades in just before activation rather than clicking on', () => {
    const before = at({ kelvin: 720 }).gain;
    const after = at({ kelvin: 800 }).gain;
    expect(before).toBeGreaterThan(0);
    expect(before).toBeLessThan(after);
  });

  it('climbs in pitch and brightens with temperature', () => {
    const warm = at({ kelvin: 800 });
    const hot = at({ kelvin: 2000 });
    const full = at({ kelvin: 3200 });
    expect(warm.pitchHz).toBeCloseTo(VOICE_LOW_HZ);
    expect(full.pitchHz).toBeCloseTo(VOICE_HIGH_HZ);
    expect(hot.pitchHz).toBeGreaterThan(warm.pitchHz);
    expect(hot.pitchHz).toBeLessThan(full.pitchHz);
    expect(full.filterHz).toBeGreaterThan(warm.filterHz);
    expect(full.fmIndex).toBeGreaterThan(warm.fmIndex);
    // The modulator never sits on a whole-number ratio: the partials stay strange.
    for (const p of [warm, hot, full])
      expect(p.fmRatio % 1).not.toBeCloseTo(0, 2);
  });

  it('shimmers and pulses only near and at full power', () => {
    expect(at({ kelvin: 1500 }).shimmer).toBe(0);
    expect(at({ kelvin: 1500 }).pulseDepth).toBe(0);
    expect(at({ kelvin: 3200 }).shimmer).toBe(1);
    expect(at({ kelvin: 3200 }).pulseDepth).toBeGreaterThan(0);
  });

  it('sweeps once per revolution and ticks once per tie bar', () => {
    const still = at({ kelvin: 3200, spinRate: 0 });
    expect(still.whooshDepth).toBe(0);
    expect(still.ticksPerSecond).toBe(0);
    const spinning = at({ kelvin: 3200, spinRate: 1.4 });
    expect(spinning.whooshHz).toBeCloseTo(1.4);
    expect(spinning.ticksPerSecond).toBeCloseTo(1.4 * TIE_BARS);
    expect(spinning.whooshDepth).toBeGreaterThan(0.5);
  });

  it('follows the brightness control, falls silent when failed, and is muffled when sealed', () => {
    expect(at({ kelvin: 2000, brightness: 0 }).gain).toBe(0);
    expect(at({ kelvin: 2000, brightness: 1 }).gain).toBeGreaterThan(
      at({ kelvin: 2000, brightness: 0.5 }).gain,
    );
    expect(at({ kelvin: 2000, failed: true }).gain).toBe(0);
    expect(at({ sealed: true }).muffleHz).toBeLessThan(
      at({ sealed: false }).muffleHz,
    );
  });
});
