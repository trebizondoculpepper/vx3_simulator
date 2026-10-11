import { describe, expect, it } from 'vitest';
import { assembleRack } from './rack-catalogue';

describe('rack assembly', () => {
  it('uses the same ordered modules on every run', () => {
    const rack = assembleRack();
    expect(rack.map((panel) => panel.id)).toEqual([
      'supply-b',
      'valves-a',
      'valves-b',
      'spindle-a',
      'spindle-b',
      'field-a',
      'field-b',
      'monitor-a',
      'monitor-b',
      'service-b',
    ]);
    expect(rack.every((panel) => panel.units > 0)).toBe(true);
    expect(rack.every((panel) => panel.provenance === 'invented')).toBe(true);
    expect(assembleRack().map((panel) => panel.id)).toEqual(
      rack.map((panel) => panel.id),
    );
  });
});
