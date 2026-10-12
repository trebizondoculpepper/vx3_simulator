import { describe, expect, it } from 'vitest';
import { createRackControls } from './rack-controls';
import { createRig } from './rig';
import {
  createSafetyTelltales,
  networkOutputs,
  stepSafetyTelltales,
} from './safety-telltales';

describe('wall safety tell-tales', () => {
  it('accumulates kWh while powered and holds the register after shutdown', () => {
    const rig = createRig();
    const controls = createRackControls();
    const telltales = createSafetyTelltales();
    rig.controls.mains = true;
    stepSafetyTelltales(telltales, rig, controls, 60);
    expect(telltales.powerKw).toBeGreaterThan(2);
    expect(telltales.energyKwh).toBeGreaterThan(0);
    const reading = telltales.energyKwh;
    rig.controls.mains = false;
    stepSafetyTelltales(telltales, rig, controls, 60);
    expect(telltales.powerKw).toBe(0);
    expect(telltales.energyKwh).toBe(reading);
  });

  it('responds to operator controls, and dilates time only with the ferrocores operational', () => {
    const rig = createRig();
    const controls = createRackControls();
    rig.controls.mains = true;
    const coldLoad = networkOutputs(rig, controls, 3).powerKw;
    rig.heater = 1;
    rig.controls.spindle = 0.8;
    rig.spindle = 0.8;
    rig.controls.spindle = 0.8;
    rig.field = 0.7;
    rig.strain = 0.4;
    const active = networkOutputs(rig, controls, 3);
    expect(active.powerKw).toBeGreaterThan(coldLoad);
    expect(active.dilationActivity).toBeGreaterThan(0.4);
    // Without xenon the cores are not operational, so time runs normally.
    expect(networkOutputs(rig, controls, 0).dilationActivity).toBe(0);
    controls.toggles.damp = true;
    expect(networkOutputs(rig, controls, 3).dilationActivity).toBeLessThan(
      active.dilationActivity,
    );
  });

  it('pulses the crystal only while the ferrocores are operational', () => {
    const rig = createRig();
    const controls = createRackControls();
    const telltales = createSafetyTelltales();
    stepSafetyTelltales(telltales, rig, controls, 10, 3);
    expect(telltales.crystalPulse).toBe(0);
    rig.controls.mains = true;
    rig.heater = 1;
    rig.controls.spindle = 0.8;
    rig.spindle = 0.8;
    rig.controls.spindle = 0.8;
    rig.field = 0.8;
    stepSafetyTelltales(telltales, rig, controls, 1, 3);
    expect(telltales.crystalPulse).toBeGreaterThan(0);
    expect(telltales.dilationActivity).toBeGreaterThan(0);
    stepSafetyTelltales(telltales, rig, controls, 0.1, 0);
    expect(telltales.crystalPulse).toBe(0);
    expect(telltales.dilationActivity).toBe(0);
    // The xenon runs out: the cores drop out of operation and the crystal goes dark.
    stepSafetyTelltales(telltales, rig, controls, 0.1, 0);
    expect(telltales.crystalPulse).toBe(0);
  });

  it('loads the supply more as betaform stages are switched in', () => {
    const rig = createRig();
    const controls = createRackControls();
    rig.controls.mains = true;
    rig.heater = 1;
    controls.knobs.ampGain = 0;
    const idle = networkOutputs(rig, controls).powerKw;
    controls.knobs.ampGain = 1;
    expect(networkOutputs(rig, controls).powerKw).toBeCloseTo(idle + 0.35);
  });
});
