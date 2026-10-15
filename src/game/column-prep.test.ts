import { describe, expect, it } from 'vitest';
import {
  AIR_LIMIT,
  AIR_OXYGEN_PERCENT,
  AMBIENT,
  FULL_POWER,
  FULL_SPIN,
  LIFT_SECONDS,
  MAXIMUM,
  WORKING_PRESSURE,
  acknowledge,
  airShare,
  coreStage,
  createColumnPrep,
  driveLift,
  heat,
  isExposed,
  isSealed,
  isStarved,
  lambdaVolts,
  oxygenPercent,
  PURGE_COMPLETE_PERCENT,
  PURGE_COMPLETE_VOLTS,
  setActivation,
  setClamped,
  stepColumnPrep,
  stepLift,
} from './column-prep';
import type { ColumnPrepEvent, ColumnPrepState } from './column-prep';

const powered = { powered: true };

/** Run the column for `seconds` in tenth-second steps, collecting events. */
function run(state: ColumnPrepState, seconds: number, inputs = powered) {
  const events: ColumnPrepEvent[] = [];
  for (let t = 0; t < seconds; t += 0.1)
    events.push(...stepColumnPrep(state, 0.1, inputs));
  return events;
}

/** Lower and clamp: the chamber sealed, still full of air. */
function sealed() {
  const state = createColumnPrep();
  driveLift(state, 0);
  run(state, LIFT_SECONDS + 0.5);
  setClamped(state, true);
  return state;
}

/** Sealed, purged and charged to working pressure, the core still cold. */
function charged() {
  const state = sealed();
  state.inletOpen = true;
  state.outletOpen = true;
  run(state, 40);
  state.outletOpen = false;
  run(state, 30);
  state.inletOpen = false;
  return state;
}

describe('column cold start', () => {
  it('starts with the head raised, the chamber open and full of air, the core cold', () => {
    const state = createColumnPrep();
    expect(state.lift).toBe(1);
    expect(isSealed(state)).toBe(false);
    expect(airShare(state)).toBe(1);
    expect(coreStage(state)).toBe('cold');
  });

  it('takes the rams their travel time to lower the head', () => {
    const state = createColumnPrep();
    driveLift(state, 0);
    run(state, LIFT_SECONDS / 2);
    expect(state.lift).toBeGreaterThan(0.4);
    expect(state.lift).toBeLessThan(0.6);
    expect(run(state, LIFT_SECONDS)).toContainEqual({ kind: 'lowered' });
    expect(state.lift).toBe(0);
  });

  it('will not clamp a raised head, nor raise a clamped one', () => {
    expect(setClamped(createColumnPrep(), true)).toBe(false);
    const state = sealed();
    expect(isSealed(state)).toBe(true);
    expect(driveLift(state, 1)).toBe(false);
    run(state, 2);
    expect(state.lift).toBe(0);
  });

  it('holds the head down if the clamps close as the rams start to lift', () => {
    const state = createColumnPrep();
    driveLift(state, 0);
    run(state, LIFT_SECONDS + 0.5);
    driveLift(state, 1);
    expect(setClamped(state, true)).toBe(true);
    run(state, LIFT_SECONDS);
    expect(state.lift).toBe(0);
    expect(isSealed(state)).toBe(true);
  });

  it('reads its lambda probe low in air and high once the purge is done', () => {
    const state = sealed();
    expect(oxygenPercent(state)).toBeCloseTo(20.9);
    expect(lambdaVolts(oxygenPercent(state))).toBeLessThan(0.15);
    state.inletOpen = true;
    state.outletOpen = true;
    run(state, 60);
    expect(oxygenPercent(state)).toBeLessThan(0.1);
    expect(lambdaVolts(oxygenPercent(state))).toBeGreaterThan(
      PURGE_COMPLETE_VOLTS,
    );
    // The probe switches through about 0.45 V near 1 % oxygen, and reads
    // purge complete at 0.5 %.
    expect(lambdaVolts(1)).toBeCloseTo(0.475, 2);
    expect(lambdaVolts(PURGE_COMPLETE_PERCENT)).toBeCloseTo(
      PURGE_COMPLETE_VOLTS,
      6,
    );
  });

  it('purges in about 20 s, the oxygen falling exponentially', () => {
    const state = sealed();
    state.inletOpen = true;
    state.outletOpen = true;
    const at: number[] = [];
    let t = 0;
    while (oxygenPercent(state) >= PURGE_COMPLETE_PERCENT) {
      if (Math.abs(t - Math.round(t / 5) * 5) < 1e-9)
        at.push(oxygenPercent(state));
      run(state, 0.1);
      t = Math.round((t + 0.1) * 10) / 10;
    }
    expect(t).toBeGreaterThan(18);
    expect(t).toBeLessThan(22);
    // Each five seconds takes away a like share of what is left.
    const ratios = at.slice(1).map((o, i) => o / at[i]);
    for (const r of ratios.slice(1)) expect(r).toBeCloseTo(ratios[1], 1);
  });

  it('lets the room air back in when the clamps open and the head rises', () => {
    const state = sealed();
    state.inletOpen = true;
    state.outletOpen = true;
    run(state, 30);
    expect(oxygenPercent(state)).toBeLessThan(PURGE_COMPLETE_PERCENT);
    state.inletOpen = false;
    state.outletOpen = false;
    expect(setClamped(state, false)).toBe(true);
    driveLift(state, 1);
    run(state, 2);
    expect(oxygenPercent(state)).toBeCloseTo(AIR_OXYGEN_PERCENT, 1);
    // Lowered and clamped again, the chamber is full of air: purge again.
    run(state, LIFT_SECONDS);
    driveLift(state, 0);
    run(state, LIFT_SECONDS + 0.5);
    setClamped(state, true);
    expect(oxygenPercent(state)).toBeCloseTo(AIR_OXYGEN_PERCENT, 1);
    expect(state.air).toBeCloseTo(1, 2);
  });

  it('purges the air without lighting the core', () => {
    const state = sealed();
    state.inletOpen = true;
    state.outletOpen = true;
    run(state, 40);
    expect(airShare(state)).toBeLessThan(AIR_LIMIT);
    expect(coreStage(state)).toBe('cold');
  });

  it('holds its charge once the outlet and inlet are closed', () => {
    const state = charged();
    expect(state.xenon).toBeGreaterThan(WORKING_PRESSURE);
    const supply = state.supply;
    run(state, 60);
    expect(state.supply).toBe(supply);
    expect(state.xenon).toBeGreaterThan(WORKING_PRESSURE);
  });

  it('follows its activation temperature up through glowing to full power', () => {
    const state = charged();
    setActivation(state, MAXIMUM);
    const events = run(state, 20);
    expect(events).toContainEqual({ kind: 'active' });
    expect(events).toContainEqual({ kind: 'full-power' });
    expect(state.temperature).toBeGreaterThan(FULL_POWER);
    expect(heat(state)).toBe(1);
    expect(coreStage(state)).toBe('full');
    // At full power it spins up toward its full rate.
    expect(state.spinRate).toBeGreaterThan(0.5 * FULL_SPIN);
    setActivation(state, 1500);
    run(state, 20);
    expect(coreStage(state)).toBe('glowing');
    expect(state.spinRate).toBeLessThan(0.01);
  });

  it('runs, fouled, if activated in air: no interlock, no burnout', () => {
    const state = createColumnPrep();
    setActivation(state, 2000);
    const events = run(state, 10);
    expect(events).toContainEqual({ kind: 'active' });
    expect(events.some((e) => e.kind === 'catastrophe')).toBe(false);
    expect(coreStage(state)).toBe('glowing');
  });

  it('runs on if the clamps are opened on a hot core', () => {
    const state = charged();
    setActivation(state, 2000);
    run(state, 10);
    setClamped(state, false);
    expect(run(state, 5).some((e) => e.kind === 'catastrophe')).toBe(false);
    expect(isExposed(state)).toBe(true);
  });

  it('suffers a flux inductance catastrophe when the outlet is left open on a hot core', () => {
    const state = sealed();
    state.inletOpen = true;
    state.outletOpen = true;
    run(state, 40);
    setActivation(state, 2000);
    run(state, 10);
    expect(isStarved(state)).toBe(true);
    const events = run(state, 600);
    expect(state.supply).toBe(0);
    expect(events).toContainEqual({
      kind: 'catastrophe',
      cause: 'flux-inductance',
    });
    acknowledge(state);
    expect(state.failure).toBeNull();
    expect(state.supply).toBeGreaterThan(0);
    // The burnt core is changed for a cold one.
    expect(state.temperature).toBe(AMBIENT);
  });

  it('stays cold without power, whatever the activation temperature', () => {
    const state = charged();
    setActivation(state, MAXIMUM);
    run(state, 20, { powered: false });
    expect(coreStage(state)).toBe('cold');
  });

  it('moves the rams to their target on their own, and only while unclamped', () => {
    const state = createColumnPrep();
    driveLift(state, 0);
    expect(state.lift).toBe(1);
    expect(stepLift(state, LIFT_SECONDS / 2)).toEqual([]);
    expect(state.lift).toBeCloseTo(0.5);
    expect(stepLift(state, LIFT_SECONDS)).toEqual([{ kind: 'lowered' }]);
    expect(state.lift).toBe(0);
    setClamped(state, true);
    state.liftTarget = 1;
    expect(stepLift(state, LIFT_SECONDS)).toEqual([]);
    expect(state.lift).toBe(0);
  });

  it('holds the head where it is while the rams have no supply', () => {
    const state = createColumnPrep();
    driveLift(state, 0);
    stepColumnPrep(state, LIFT_SECONDS / 2, {
      powered: false,
      ramsPowered: false,
    });
    expect(state.lift).toBe(1);
    stepColumnPrep(state, LIFT_SECONDS / 2, { powered: false });
    expect(state.lift).toBeCloseTo(0.5);
  });
});
