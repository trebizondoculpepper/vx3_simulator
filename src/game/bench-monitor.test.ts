import { describe, expect, it } from 'vitest';
import { benchScreen, benchWarnings } from './bench-monitor';
import { createRig } from './rig';
import { XENON_SPINDLE_LIMIT } from './xenon-supply';

function running(spindle: number, xenonFlowSlpm: number) {
  const rig = createRig();
  rig.controls.mains = true;
  rig.spindle = spindle;
  return { rig, xenonFlowSlpm };
}

describe('bench monitor', () => {
  it('stays quiet while the spindle is slow, even without xenon', () => {
    expect(benchWarnings(running(XENON_SPINDLE_LIMIT - 0.05, 0))).toEqual([]);
  });

  it('warns once the spindle passes its limit on an unpressurised circuit', () => {
    const warnings = benchWarnings(running(0.6, 0.5));
    expect(warnings[0]).toBe('XENON CIRCUIT NOT PRESSURISED');
    expect(warnings[1]).toContain('0.5 SLPM');
    expect(benchWarnings(running(0.6, 3))).toEqual([]);
  });

  it('flashes warnings in red and drops the sampling prompt', () => {
    const on = benchScreen(running(0.6, 0), true).lines;
    const off = benchScreen(running(0.6, 0), false).lines;
    expect(on.at(-2)?.[0]).toBe('** XENON CIRCUIT NOT PRESSURISED **');
    expect(off.at(-2)?.[0]).toBe('');
    expect(on.map(([text]) => text)).not.toContain('PRESS SPACE TO SAMPLE');
  });

  it('shows live spindle speed', () => {
    const { lines } = benchScreen(running(0.5, 3), true);
    expect(lines.map(([text]) => text)).toContain('SPINDLE  1800 RPM');
  });
});
