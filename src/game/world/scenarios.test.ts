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

  it('fouls nothing on a clean cold start: no exhaust, no dose', () => {
    const { world } = play([...coldStart, { id: 'wait', setting: 120 }]);
    expect(world.read<number>('room.exhaust')).toBeLessThan(1);
    expect(world.read<number>('operator.dose')).toBeLessThan(0.01);
    expect(world.read<number>('vessel.soot')).toBe(0);
  });

  it('smokes at the seal and stains the head when the clamps are off', () => {
    const { world } = play([
      ...coldStart,
      { id: 'column.SPANNEN' },
      { id: 'wait', setting: 30 },
    ]);
    expect(world.read<number>('column.sealSmoke')).toBeGreaterThan(0.5);
    expect(world.read<number>('vessel.soot')).toBeGreaterThan(0.2);
  });
});
