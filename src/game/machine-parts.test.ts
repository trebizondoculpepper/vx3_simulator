import { describe, expect, it } from 'vitest';
import {
  auditParts,
  designate,
  designationOf,
  markFixture,
  partInventory,
} from './machine-parts';

const object = (clickable: boolean) => ({ userData: {}, clickable });

describe('machine parts', () => {
  it('stores the designation on the object', () => {
    const knob = object(true);
    designate(knob, { machine: 'Rack', name: 'Gain', role: 'input' });
    expect(designationOf(knob)?.role).toBe('input');
  });

  it('accepts operable inputs, inert indicators and room fixtures', () => {
    const knob = object(true);
    const lamp = object(false);
    const door = object(true);
    designate(knob, { machine: 'Rack', name: 'Gain', role: 'input' });
    designate(lamp, { machine: 'Rack', name: 'Lamp', role: 'indicator' });
    markFixture(door, 'Lab door');
    expect(auditParts([knob, lamp, door])).toEqual([]);
  });

  it('reports indicators that can be operated and inputs that cannot', () => {
    const lamp = object(true);
    const knob = object(false);
    designate(lamp, { machine: 'Rack', name: 'Lamp', role: 'indicator' });
    designate(knob, { machine: 'Rack', name: 'Gain', role: 'input' });
    expect(auditParts([lamp, knob])).toEqual([
      'Rack: Lamp is an indicator but can be operated',
      'Rack: Gain is an input but cannot be operated',
    ]);
  });

  it('reports clickable things nobody has designated', () => {
    expect(auditParts([object(true)])).toEqual([
      'unnamed object can be operated but is not designated',
    ]);
  });

  it('lists each machine’s inputs and indicators once', () => {
    const parts = [object(true), object(true), object(false)];
    designate(parts[0], { machine: 'Rack', name: 'HT', role: 'input' });
    designate(parts[1], { machine: 'Rack', name: 'HT', role: 'input' });
    designate(parts[2], { machine: 'Rack', name: 'Lamp', role: 'indicator' });
    expect(partInventory(parts).get('Rack')).toEqual({
      input: ['HT'],
      indicator: ['Lamp'],
    });
  });
});
