import { describe, expect, it } from 'vitest';
import {
  blendChannel,
  createPatterns,
  defaultPatternSettings,
  patternMode,
  patternStyle,
} from './patterns';

describe('geometric hallucinations', () => {
  it('is off until it is turned up', () => {
    const p = createPatterns();
    expect(p.showing).toBe(false);
    p.settings.strength = 0.4;
    expect(p.showing).toBe(true);
  });

  it('evolves and flows by its speeds', () => {
    const p = createPatterns({
      ...defaultPatternSettings(),
      speed: 0.5,
      flow: 2,
    });
    p.step(2);
    expect(p.evolved).toBeCloseTo(1);
    expect(p.flowed).toBeCloseTo(4);
  });

  it('names its blend, clamped to the ones there are', () => {
    const s = defaultPatternSettings();
    expect(patternMode({ ...s, mode: 0 })).toBe('XOR');
    expect(patternMode({ ...s, mode: 1.2 })).toBe('AND');
    expect(patternMode({ ...s, mode: 9 })).toBe('BURN');
  });

  it('names its style, clamped to the ones there are', () => {
    const s = defaultPatternSettings();
    expect(patternStyle(s)).toBe('STARS');
    expect(patternStyle({ ...s, style: -3 })).toBe('LINES');
    expect(patternStyle({ ...s, style: 2 })).toBe('HYPERBOLIC');
    expect(patternStyle({ ...s, style: 99 })).toBe('TUNNEL');
  });

  it("exclusive-or's and and's the screen's bytes", () => {
    // 0xF0 ^ 0xFF = 0x0F; 0xF0 & 0x3C = 0x30.
    expect(blendChannel('XOR', 0xf0 / 255, 1)).toBeCloseTo(0x0f / 255);
    expect(blendChannel('AND', 0xf0 / 255, 0x3c / 255)).toBeCloseTo(0x30 / 255);
    // Black in the pattern leaves XOR's picture as it was.
    expect(blendChannel('XOR', 0.5, 0)).toBeCloseTo(128 / 255);
  });

  it('burns the picture darker where the pattern is dark', () => {
    expect(blendChannel('BURN', 0.6, 1)).toBeCloseTo(0.6);
    expect(blendChannel('BURN', 0.6, 0.5)).toBeCloseTo(0.2);
    expect(blendChannel('BURN', 0.6, 0)).toBe(0);
  });
});
