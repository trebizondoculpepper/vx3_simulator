import { describe, expect, it } from 'vitest';
import {
  allTargets,
  coldStart,
  play,
  scenarios,
  undesigned,
} from './scenarios';

describe('designed scenarios', () => {
  it.each(scenarios.map((s) => [s.name, s] as const))('%s', (_, scenario) => {
    const { reached } = play(scenario.steps);
    for (const target of scenario.reaches)
      expect(reached.has(target), `${scenario.name} → ${target}`).toBe(true);
  });

  it('accounts for every alarm window and every bad end', () => {
    const designed = new Set(scenarios.flatMap((s) => s.reaches));
    const missing = allTargets().filter(
      (t) => !designed.has(t) && !(t in undesigned),
    );
    expect(missing).toEqual([]);
  });

  it('runs the cold start clean: no alarm once acknowledged, and it holds', () => {
    const { world, reached } = play([
      ...coldStart,
      { id: 'board.QUITT' },
      { id: 'wait', setting: 300 },
    ]);
    expect(reached.has('rig:incident')).toBe(false);
    expect(world.read('plant.fullyOperational')).toBe(true);
    expect(world.conditions.filter((c) => c.value).map((c) => c.id)).toEqual(
      [],
    );
  });

  it('holds off the flux inductance catastrophe with the permit', () => {
    // The column model's way there: leave the outlet open on a running
    // core. The permit drops first and the core cools.
    const { world, reached } = play([
      ...coldStart,
      { id: 'column.outlet' },
      { id: 'wait', setting: 15 },
    ]);
    expect(world.read('drive.permit')).toBe(false);
    expect(world.read<number>('vessel.temperature')).toBeLessThan(800);
    const later = play([
      ...coldStart,
      { id: 'column.outlet' },
      { id: 'wait', setting: 600 },
    ]);
    expect(reached.has('vessel:catastrophe:flux-inductance')).toBe(false);
    expect(later.reached.has('vessel:catastrophe:flux-inductance')).toBe(false);
  });
});
