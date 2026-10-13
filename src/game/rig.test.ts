import { describe, expect, it } from 'vitest';
import {
  createRig,
  deltaScore,
  idealTrim,
  insulationBleed,
  RATIO_NEUTRAL,
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
  it('builds strain from an outside hazard even while the field is steady', () => {
    const rig = createRig();
    rig.controls.mains = true;
    let incident = false;
    for (let t = 0; t < 60 && !incident; t += 0.1)
      incident = stepRig(rig, 0.1, still, 0.02).some(
        (event) => event.kind === 'incident',
      );
    expect(incident).toBe(true);
    expect(rig.controls.mains).toBe(false);
    const safe = createRig();
    safe.controls.mains = true;
    run(safe, 60);
    expect(safe.strain).toBe(0);
  });
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

describe('secondary controls', () => {
  it('moves the balance point when RATIO changes gear', () => {
    const rig = createRig();
    rig.spindle = 0.5;
    rig.controls.ratio = RATIO_NEUTRAL;
    const neutral = idealTrim(rig);
    rig.controls.ratio = 0.9;
    expect(idealTrim(rig)).toBeGreaterThan(neutral);
    rig.controls.ratio = 0;
    expect(idealTrim(rig)).toBeLessThan(neutral);
  });

  it('slows the drift when GND? earths the plasma inducer', () => {
    const wandered = (grounded: boolean) => {
      const rig = createRig();
      rig.field = 1;
      rig.controls.grounded = grounded;
      let total = 0;
      let flip = false;
      for (let i = 0; i < 50; i++) {
        flip = !flip;
        const before = rig.drift;
        stepRig(rig, 0.1, () => (flip ? 0.9 : 0.15));
        total += Math.abs(rig.drift - before);
      }
      return total;
    };
    expect(wandered(true)).toBeLessThan(wandered(false) * 0.5);
  });

  it('bleeds strain fastest when BAND matches the field', () => {
    expect(insulationBleed(0.6, 0.6)).toBe(1.5);
    expect(insulationBleed(0.6, 0)).toBe(0.5);
    const bleed = (band: number) => {
      const rig = createRig();
      rig.field = 0.6;
      rig.strain = 0.5;
      rig.controls.band = band;
      // A short step, so the field has no time to decay away from the band.
      stepRig(rig, 0.1, () => 0.5);
      return 0.5 - rig.strain;
    };
    expect(bleed(0.6)).toBeGreaterThan(bleed(0) * 2);
  });

  it('reports where the strain came from when the breaker trips', () => {
    const dry = createRig();
    dry.controls.mains = true;
    let report;
    for (let t = 0; t < 80 && !report; t += 0.1)
      report = stepRig(dry, 0.1, still, 0.02).find(
        (event) => event.kind === 'incident',
      )?.report;
    expect(report?.hazardShare).toBeCloseTo(1);
    expect(dry.strainFrom).toEqual({ field: 0, hazard: 0 });

    const wild = createRig();
    Object.assign(wild.controls, {
      mains: true,
      spindle: 1,
      field: 1,
      trim: 0,
    });
    report = undefined;
    for (let t = 0; t < 120 && !report; t += 0.1)
      report = stepRig(wild, 0.1, still).find(
        (event) => event.kind === 'incident',
      )?.report;
    expect(report?.fieldShare).toBeCloseTo(1);
    expect(report?.trimError).toBeLessThan(0);
  });
});
