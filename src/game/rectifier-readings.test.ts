import { describe, expect, it } from 'vitest';
import { rectifierReadings } from './rectifier-readings';

describe('mercury-arc rectifier instruments', () => {
  it('falls to zero when the plant switch is open', () => {
    expect(rectifierReadings(false, 5)).toEqual({
      inputVac: 0,
      outputVdc: 0,
      outputAdc: 0,
    });
  });

  it('shows AC supply, DC output and current that rises with load', () => {
    const idle = rectifierReadings(true, 0);
    const loaded = rectifierReadings(true, 5);
    expect(idle.inputVac).toBe(240);
    expect(idle.outputVdc).toBe(180);
    expect(idle.outputAdc).toBe(2);
    expect(loaded.inputVac).toBe(240);
    expect(loaded.outputVdc).toBeLessThan(idle.outputVdc);
    expect(loaded.outputAdc).toBeGreaterThan(idle.outputAdc);
    expect(loaded.outputAdc).toBeLessThan(50);
  });
});
