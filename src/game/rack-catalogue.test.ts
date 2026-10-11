import { describe, expect, it } from 'vitest';
import { assembleRack } from './rack-catalogue';

describe('rack assembly', () => {
  it('keeps every required rig role while varying the standard cabinet', () => {
    const first = assembleRack(() => 0);
    const second = assembleRack(() => 0.99);
    for (const rack of [first, second]) {
      expect(rack).toHaveLength(5);
      expect(rack.map((panel) => panel.id.split('-')[0]).sort()).toEqual([
        'field',
        'monitor',
        'spindle',
        'supply',
        'valves',
      ]);
      expect(
        rack.every(
          (panel) => panel.units > 0 && panel.provenance === 'invented',
        ),
      ).toBe(true);
    }
    expect(first.map((panel) => panel.id)).not.toEqual(
      second.map((panel) => panel.id),
    );
  });
});
