import { describe, expect, it } from 'vitest';
import { RATIO_NEUTRAL } from './rig';
import type { TripReport } from './rig';
import { tripClues } from './trip-report';

const report = (changes: Partial<TripReport> = {}): TripReport => ({
  fieldShare: 0,
  hazardShare: 0,
  trimError: 0,
  nullOffset: 0,
  drift: 0,
  grounded: false,
  ratio: RATIO_NEUTRAL,
  bandError: 0,
  field: 0.6,
  spindle: 0.6,
  ...changes,
});

describe('tripClues', () => {
  it('blames a dry xenon circuit when that is where the strain came from', () => {
    const lines = tripClues(report({ hazardShare: 1 }), { xenonFlowSlpm: 0.4 });
    expect(lines[0]).toMatch(/AUSGELÖST/);
    expect(lines.join(' ')).toMatch(/dry xenon circuit: 0\.4 SLPM/);
    expect(lines.join(' ')).not.toMatch(/TRIM/);
  });

  it('points at the trim, and which way it was out, for a field that wandered', () => {
    const high = tripClues(report({ fieldShare: 1, trimError: 0.2 }), {
      xenonFlowSlpm: 5,
    }).join(' ');
    expect(high).toMatch(/BLATZ TRIM sat well above/);
    const low = tripClues(report({ fieldShare: 1, trimError: -0.08 }), {
      xenonFlowSlpm: 5,
    }).join(' ');
    expect(low).toMatch(/BLATZ TRIM sat a little below/);
  });

  it('mentions NULL, an open GND? under heavy drift, RATIO and BAND when they contributed', () => {
    const text = tripClues(
      report({
        fieldShare: 1,
        nullOffset: 0.3,
        drift: 0.2,
        ratio: 0.8,
        bandError: 0.5,
      }),
      { xenonFlowSlpm: 5 },
    ).join(' ');
    expect(text).toMatch(/NULL was off centre/);
    expect(text).toMatch(/GND\? was open/);
    expect(text).toMatch(/RATIO/);
    expect(text).toMatch(/BAND/);
  });

  it('says nothing about GND? when the inducer was earthed', () => {
    const text = tripClues(
      report({ fieldShare: 1, drift: 0.2, grounded: true }),
      { xenonFlowSlpm: 5 },
    ).join(' ');
    expect(text).not.toMatch(/GND/);
  });

  it('still prints something when no setting stands out', () => {
    expect(tripClues(report(), { xenonFlowSlpm: 5 })).toHaveLength(2);
  });
});
