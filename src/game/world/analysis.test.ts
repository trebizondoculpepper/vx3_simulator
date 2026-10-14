import { describe, expect, it } from 'vitest';
import { createWorld } from './world';

/**
 * The graph's own record of what is wired to what. These lists are the
 * lab's loose ends as of October 2026; when one is wired up or removed,
 * update the list here (and `doc/design/control-graph.md`).
 */
describe('loose ends in the lab', () => {
  const analysis = createWorld().graph.analyse();

  it('finds the board handles that change nothing in the machine', () => {
    // They light their own handle position and their bay's EIN lamp.
    expect(analysis.deadControls.sort()).toEqual(
      ['drive.blatz', 'drive.xtalA', 'drive.xtalB', 'drive.xtalC'].sort(),
    );
    expect(analysis.unseenControls).toEqual([]);
  });

  it('lists the drive parameters no control in the lab sets', () => {
    expect(analysis.fixedParameters.sort()).toEqual(
      [
        'drive.ampGain',
        'drive.chromoAux',
        'drive.governor',
        'drive.governorEngage',
        'drive.governorRatio',
        'drive.plasmaExcite',
        'drive.plasmaNull',
        'drive.plasmaOn',
      ].sort(),
    );
    expect(analysis.unusedParameters).toEqual([]);
  });

  it('finds what the room never shows', () => {
    // Nothing in the room says the plant is fully operational.
    expect(analysis.invisible.sort()).toEqual(
      ['ferrocore.operational', 'plant.fullyOperational'].sort(),
    );
  });

  it('has every output reachable and every state written', () => {
    expect(analysis.constantOutputs).toEqual([]);
    expect(analysis.unwrittenStates).toEqual([]);
  });

  it('refuses a vertex that reads one that does not exist', async () => {
    const { createGraph } = await import('./graph');
    const g = createGraph();
    const a = g.input('a', 1);
    expect(() =>
      g.derive(
        'b',
        [{ id: 'ghost', value: 0, peek: () => 0 }, a],
        (x, y) => x + y,
      ),
    ).toThrow(/unknown ghost/);
  });
});
