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

  it('responds to operator controls and field instability', () => {
    const rig = createRig();
    const controls = createRackControls();
    rig.controls.mains = true;
    const coldLoad = networkOutputs(rig, controls).powerKw;
    rig.heater = 1;
    rig.spindle = 0.8;
    rig.field = 0.7;
    rig.instability = 0.65;
    rig.strain = 0.4;
    const active = networkOutputs(rig, controls);
    expect(active.powerKw).toBeGreaterThan(coldLoad);
    expect(active.dilationActivity).toBeGreaterThan(0.4);
    controls.toggles.damp = true;
    expect(networkOutputs(rig, controls).dilationActivity).toBeLessThan(
      active.dilationActivity,
    );
  });

  it('pulses the crystal only while the field is active', () => {
    const rig = createRig();
    const controls = createRackControls();
    const telltales = createSafetyTelltales();
    stepSafetyTelltales(telltales, rig, controls, 10);
    expect(telltales.crystalPulse).toBe(0);
    rig.controls.mains = true;
    rig.field = 0.8;
    rig.instability = 0.8;
    stepSafetyTelltales(telltales, rig, controls, 1);
    expect(telltales.crystalPulse).toBeGreaterThan(0);
  });
});
