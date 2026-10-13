import { describe, expect, it } from 'vitest';
import { FULL_BOTTLE, createColumnPrep, isExposed } from './column-prep';
import { atmospherePermit, feedFromLine, lineFlow } from './gen2-wiring';
import { createRig, stepRig } from './rig';
import { driveTemperature } from './cold-start';

/** A vessel lowered, clamped, purged and at working pressure. */
function readyVessel() {
  const state = createColumnPrep();
  state.lift = 0;
  state.liftTarget = 0;
  state.clamped = true;
  state.air = 0;
  state.xenon = 1.5;
  return state;
}

describe('gen2 wiring', () => {
  it('carries xenon to the machine only while the recirculator runs', () => {
    expect(lineFlow(6, true)).toBe(6);
    expect(lineFlow(6, false)).toBe(0);
  });

  it('refills the buffer from the xenon line only at working flow', () => {
    const state = createColumnPrep();
    state.supply = 10;
    feedFromLine(state, 1, 10);
    expect(state.supply).toBe(10);
    feedFromLine(state, 3, 10);
    expect(state.supply).toBeCloseTo(14.5);
    feedFromLine(state, 3, 1000);
    expect(state.supply).toBe(FULL_BOTTLE);
  });

  it('permits the drive only in a purged, pressurised, recirculating vessel', () => {
    const state = readyVessel();
    expect(atmospherePermit(state, true)).toBe(true);
    expect(atmospherePermit(state, false)).toBe(false);
    expect(atmospherePermit({ ...state, clamped: false }, true)).toBe(false);
    expect(atmospherePermit({ ...state, air: 0.5 }, true)).toBe(false);
    expect(atmospherePermit({ ...state, xenon: 0.8 }, true)).toBe(false);
    expect(atmospherePermit({ ...state, failure: 'burnout' }, true)).toBe(
      false,
    );
  });

  it('holds the heaters and drive off without the permit', () => {
    const rig = createRig();
    rig.controls.mains = true;
    rig.controls.spindle = 0.5;
    rig.controls.field = 0;
    rig.controls.permit = false;
    for (let i = 0; i < 300; i++) stepRig(rig, 0.1, () => 0.5);
    expect(rig.heater).toBe(0);
    expect(rig.spindle).toBe(0);
    rig.controls.permit = true;
    for (let i = 0; i < 300; i++) stepRig(rig, 0.1, () => 0.5);
    expect(rig.heater).toBeGreaterThan(0.9);
    expect(rig.spindle).toBeGreaterThan(0.4);
  });

  it('warns of a core warming in air before it burns', () => {
    const state = createColumnPrep();
    state.temperature = 600;
    expect(isExposed(state)).toBe(true);
    expect(isExposed(readyVessel())).toBe(false);
  });

  it('heats the core from the drive: heaters to a glow, activity beyond', () => {
    const rig = createRig();
    expect(driveTemperature(rig)).toBe(293);
    rig.heater = 1;
    expect(driveTemperature(rig)).toBeGreaterThan(800);
    rig.spindle = 1;
    rig.field = 1;
    expect(driveTemperature(rig)).toBeGreaterThan(3200);
  });
});
