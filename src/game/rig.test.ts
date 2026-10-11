import { describe, expect, it } from 'vitest';
import {
  createRig,
  deltaScore,
  idealTrim,
  stepRig,
  YALGETH_LIMIT,
} from './rig';
import type { RigEvent, RigState } from './rig';

const still = () => 0.5;

function run(state: RigState, seconds: number, random = still) {
  const events: RigEvent[] = [];
  for (let t = 0; t < seconds; t += 0.1)
    events.push(...stepRig(state, 0.1, random));
  return events;
}

describe('stepRig', () => {
  it('keeps Delta below Yalgeth’s limit and discounts an unstable field', () => {
    const rig = createRig();
    rig.field = 1;
    expect(deltaScore(rig)).toBe(YALGETH_LIMIT);
    rig.instability = 0.75;
    expect(deltaScore(rig)).toBeLessThan(YALGETH_LIMIT);
  });
  it('stays cold and dark with the mains off', () => {
    const rig = createRig();
    rig.controls.spindle = 1;
    rig.controls.field = 1;
    run(rig, 10);
    expect(rig.heater).toBe(0);
    expect(rig.spindle).toBe(0);
    expect(rig.field).toBe(0);
  });

  it('warms the valves before the spindle will turn', () => {
    const rig = createRig();
    rig.controls.mains = true;
    rig.controls.spindle = 1;
    run(rig, 2);
    expect(rig.spindle).toBe(0);
    const events = run(rig, 8);
    expect(events).toContainEqual({ kind: 'warmed' });
    expect(rig.spindle).toBeGreaterThan(0.5);
  });

  it('holds a stable field when the trim tracks the ideal point', () => {
    const rig = createRig();
    Object.assign(rig.controls, { mains: true, spindle: 0.6, field: 0.8 });
    const events: RigEvent[] = [];
    for (let t = 0; t < 30; t += 0.1) {
      rig.controls.trim = idealTrim(rig);
      events.push(...stepRig(rig, 0.1, still));
    }
    expect(rig.field).toBeCloseTo(0.8);
    expect(rig.instability).toBeLessThan(0.05);
    expect(events).toContainEqual({ kind: 'field-locked' });
    expect(events.some((event) => event.kind === 'incident')).toBe(false);
  });

  it('trips the breaker with an incident when the field is neglected', () => {
    const rig = createRig();
    Object.assign(rig.controls, {
      mains: true,
      spindle: 1,
      field: 1,
      trim: 0,
    });
    const events = run(rig, 40);
    const incident = events.find((event) => event.kind === 'incident');
    expect(incident).toBeDefined();
    expect(rig.incidents).toBeGreaterThan(0);
    expect(rig.controls.mains).toBe(false);
  });
});
