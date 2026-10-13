import { describe, expect, it } from 'vitest';
import {
  OXYGEN_ZERO_PERCENT,
  chamberPressure,
  clampVessel,
  coreStage,
  createColdStart,
  deliveryBar,
  driveHead,
  effects,
  fullyOperational,
  isSealed,
  isStarved,
  oxygenPercent,
  oxygenSensorVolts,
  recirculating,
  recirculatorWorking,
  setPurgeValve,
  setRecirculator,
  setRectifier,
  setXenonRegulator,
  stepColdStart,
} from './cold-start';
import type { ColdStartEvent, ColdStartState } from './cold-start';
import {
  LIFT_SECONDS,
  PURGE_COMPLETE_VOLTS,
  WORKING_PRESSURE,
} from './column-prep';
import { idealTrim } from './rig';

/** No drift: the field's ideal trim point stays put. */
const still = () => 0.5;

interface Operator {
  /** Keep BLATZ TRIM on the field's ideal point, as an attentive operator does. */
  tracksTrim?: boolean;
}

/** Run the plant in tenth-second steps, collecting what happened. */
function run(
  state: ColdStartState,
  seconds: number,
  { tracksTrim = false }: Operator = {},
) {
  const events: ColdStartEvent[] = [];
  for (let t = 0; t < seconds; t += 0.1) {
    if (tracksTrim) state.rig.controls.trim = idealTrim(state.rig);
    events.push(...stepColdStart(state, 0.1, still));
  }
  return events;
}

/** Run until `done` holds, failing the test if it takes longer than `limit` seconds. */
function runUntil(
  state: ColdStartState,
  done: (state: ColdStartState) => boolean,
  limit: number,
  operator: Operator = {},
) {
  const events: ColdStartEvent[] = [];
  let waited = 0;
  while (!done(state)) {
    if (waited >= limit)
      throw new Error(`condition not reached within ${limit} s`);
    events.push(...run(state, 0.1, operator));
    waited += 0.1;
  }
  return { events, waited };
}

const kinds = (events: ColdStartEvent[]) =>
  events.map((e) =>
    e.event.kind === 'catastrophe'
      ? `${e.source}:catastrophe:${e.event.cause}`
      : `${e.source}:${e.event.kind}`,
  );

/** Steps 1 to 6 of the procedure: sealed, purged, charged, recirculating. */
function prepareVessel(state = createColdStart()) {
  driveHead(state, 0);
  run(state, LIFT_SECONDS + 0.5);
  clampVessel(state, true);
  setPurgeValve(state, true);
  setXenonRegulator(state, 0.5);
  setRectifier(state, true);
  setRecirculator(state, true);
  runUntil(state, (s) => oxygenPercent(s) < OXYGEN_ZERO_PERCENT, 120);
  setPurgeValve(state, false);
  runUntil(state, (s) => s.vessel.xenon >= WORKING_PRESSURE, 60);
  return state;
}

/** Step 7: light the ferrocore, trimming the field as it comes up. */
function lightFerrocore(state: ColdStartState, operator: Operator) {
  state.rig.controls.mains = true;
  run(state, 7, operator);
  state.rig.controls.spindle = 1;
  state.rig.controls.field = 1;
  return run(state, 30, operator);
}

describe('cold start', () => {
  it('goes through every transition of the procedure to full operation', () => {
    const state = createColdStart();
    expect(oxygenPercent(state)).toBeCloseTo(20.9);
    expect(oxygenSensorVolts(state)).toBeLessThan(0.15);
    expect(fullyOperational(state)).toBe(false);

    // 1. Close and clamp the containment vessel.
    expect(clampVessel(state, true)).toBe(false);
    driveHead(state, 0);
    const lowering = run(state, LIFT_SECONDS + 0.5);
    expect(kinds(lowering)).toContain('vessel:lowered');
    expect(clampVessel(state, true)).toBe(true);
    expect(isSealed(state.vessel)).toBe(true);
    expect(driveHead(state, 1)).toBe(false);

    // 2. Open the purge valve.
    setPurgeValve(state, true);

    // 3. Start the xenon supply.
    setXenonRegulator(state, 0.5);
    run(state, 3);
    expect(deliveryBar(state)).toBeCloseTo(2, 1);
    expect(state.vessel.inletOpen).toBe(true);
    expect(state.flowSlpm).toBeGreaterThan(4);

    // 4. Start the recirculator: plant power, then its switch. While the
    // purge is open it runs but moves nothing round the loop.
    setRectifier(state, true);
    setRecirculator(state, true);
    run(state, 1);
    expect(recirculatorWorking(state)).toBe(true);
    expect(recirculating(state)).toBe(false);

    // 5. Wait for the oxygen sensor to read zero.
    const purge = runUntil(
      state,
      (s) => oxygenPercent(s) < OXYGEN_ZERO_PERCENT,
      120,
    );
    expect(purge.waited).toBeGreaterThan(20);
    // The lambda probe is the operator's proxy: it has swung into its band.
    expect(oxygenSensorVolts(state)).toBeGreaterThan(PURGE_COMPLETE_VOLTS);
    expect(coreStage(state.vessel)).toBe('cold');

    // 6. Shut the purge valve: the xenon builds and the loop starts.
    setPurgeValve(state, false);
    runUntil(state, (s) => s.vessel.xenon >= WORKING_PRESSURE, 60);
    run(state, 3);
    expect(recirculating(state)).toBe(true);
    expect(state.flowSlpm).toBeGreaterThan(5);
    expect(chamberPressure(state.vessel)).toBeGreaterThan(WORKING_PRESSURE);

    // 7. Light the ferrocore. Mains first: the heaters warm and the core
    // glows.
    state.rig.controls.mains = true;
    const warming = run(state, 7, { tracksTrim: true });
    expect(kinds(warming)).toContain('rig:warmed');
    expect(kinds(warming)).toContain('vessel:active');
    expect(coreStage(state.vessel)).toBe('glowing');
    expect(fullyOperational(state)).toBe(false);

    // Then spindle and field, trimming the field to lock.
    state.rig.controls.spindle = 1;
    state.rig.controls.field = 1;
    const lighting = run(state, 30, { tracksTrim: true });
    expect(kinds(lighting)).toContain('rig:field-locked');
    expect(kinds(lighting)).toContain('vessel:full-power');
    expect(kinds(lighting)).toContain('plant:fully-operational');
    expect(kinds(lighting).some((k) => k.includes('incident'))).toBe(false);

    // The fully operational state, and its weird effects.
    expect(fullyOperational(state)).toBe(true);
    expect(coreStage(state.vessel)).toBe('full');
    const now = effects(state);
    expect(now.warp).toBeGreaterThan(0.5);
    expect(now.sparkleRate).toBeGreaterThan(30);
    expect(now.channels.some((c) => Math.abs(c - 1) > 0.01)).toBe(true);
    expect(now.pi).not.toBe(Math.PI);

    // It stays there: the loop holds the charge and the bottle lasts.
    run(state, 60, { tracksTrim: true });
    expect(fullyOperational(state)).toBe(true);
    expect(state.vessel.failure).toBeNull();
  });

  describe('failure states', () => {
    it('burns the core out if the ferrocore is lit before the vessel is purged', () => {
      const state = createColdStart();
      driveHead(state, 0);
      run(state, LIFT_SECONDS + 0.5);
      clampVessel(state, true);
      state.rig.controls.mains = true;
      const events = run(state, 10);
      expect(kinds(events)).toContain('vessel:catastrophe:burnout');
      expect(coreStage(state.vessel)).toBe('failed');
      expect(state.rig.controls.mains).toBe(false);
    });

    it('suffers a flux inductance catastrophe if the purge valve is left open on a running core', () => {
      const state = createColdStart();
      driveHead(state, 0);
      run(state, LIFT_SECONDS + 0.5);
      clampVessel(state, true);
      setPurgeValve(state, true);
      setXenonRegulator(state, 0.5);
      setRectifier(state, true);
      setRecirculator(state, true);
      runUntil(state, (s) => oxygenPercent(s) < OXYGEN_ZERO_PERCENT, 120);
      // The purge valve stays open: the core lights on a starved chamber.
      const lighting = lightFerrocore(state, { tracksTrim: true });
      expect(isStarved(state.vessel)).toBe(true);
      expect(fullyOperational(state)).toBe(false);
      expect(kinds(lighting)).not.toContain('plant:fully-operational');
      const { events } = runUntil(
        state,
        (s) => s.vessel.failure !== null,
        900,
        { tracksTrim: true },
      );
      expect(kinds(events)).toContain('vessel:catastrophe:flux-inductance');
      expect(state.vessel.supply).toBe(0);
    });

    it('trips the breaker when the field is not trimmed', () => {
      const state = prepareVessel();
      const events = lightFerrocore(state, { tracksTrim: false });
      const trip = events.find((e) => e.event.kind === 'incident');
      expect(trip).toBeDefined();
      if (trip?.event.kind === 'incident')
        expect(trip.event.report.fieldShare).toBeGreaterThan(0.5);
      expect(state.rig.controls.mains).toBe(false);
    });

    it('trips the breaker on a dry circuit when the recirculator is stopped', () => {
      const state = prepareVessel();
      setRecirculator(state, false);
      run(state, 3);
      expect(state.flowSlpm).toBeLessThan(1);
      const events = lightFerrocore(state, { tracksTrim: true });
      const later = runUntil(state, (s) => s.rig.incidents > 0, 120, {
        tracksTrim: true,
      }).events;
      const trip = [...events, ...later].find(
        (e) => e.event.kind === 'incident',
      );
      expect(trip).toBeDefined();
      if (trip?.event.kind === 'incident')
        expect(trip.event.report.hazardShare).toBeGreaterThan(0.5);
    });

    it('burns the core out if the clamps are opened while it runs', () => {
      const state = prepareVessel();
      lightFerrocore(state, { tracksTrim: true });
      expect(fullyOperational(state)).toBe(true);
      clampVessel(state, false);
      const events = run(state, 2, { tracksTrim: true });
      expect(kinds(events)).toContain('vessel:catastrophe:burnout');
      expect(fullyOperational(state)).toBe(false);
    });
  });
});
