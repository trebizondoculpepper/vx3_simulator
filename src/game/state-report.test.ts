import { describe, expect, it } from 'vitest';
import { formatValue, stateReport, stateReportName } from './state-report';
import { coldStart } from './world/scenarios';
import { createWorld } from './world/world';

const extras = {
  time: new Date(2026, 9, 15, 1, 23),
  log: ['01:23  VX3 B11 SÄULE: SENKEN button.'],
  printed: ['01:22  Lab opened.'],
  room: { 'Lab lights': true, Where: 'VX3 LAB' },
};

describe('the state report', () => {
  it('describes a cold lab: plant off, NETZ AUS lit', () => {
    const report = stateReport(createWorld(), extras);
    expect(report).toMatch(/^# VX3 state report/);
    expect(report).toContain('- Fully operational: no');
    expect(report).toContain('- Alarm windows lit: NETZ AUS');
    expect(report).toContain('| `plant.master` | input | false |');
    expect(report).toContain('### vessel');
    expect(report).toContain('- 01:23  VX3 B11 SÄULE: SENKEN button.');
    expect(report).toContain('```\n01:22  Lab opened.\n```');
    expect(report).toContain('| Lab lights | true |');
  });

  it('describes a lab at full operation', () => {
    const world = createWorld();
    for (const move of coldStart) {
      if (move.id === 'wait')
        for (let t = 0; t < (move.setting ?? 0); t += 0.1)
          world.tick(0.1, () => 0.5);
      else world.work(move.id, move.setting);
    }
    const report = stateReport(world, extras);
    expect(report).toContain('- Fully operational: yes');
    expect(report).toContain('- Alarm windows lit: none');
    expect(report).toContain(
      '| Column: DREHZAHL knob | `drive.spindle` | knob | 0.8 |',
    );
  });

  it('keeps table cells on one line and pipes escaped', () => {
    expect(formatValue({ a: 'x|y' })).toBe('`{"a":"x|y"}`');
    const report = stateReport(createWorld(), {
      ...extras,
      room: { 'A | B': 'one\ntwo' },
    });
    expect(report).toContain('| A \\| B | one two |');
  });

  it('names the file by the time it was saved', () => {
    expect(stateReportName(extras.time)).toBe('vx3-state-20261015-0123.md');
  });
});
