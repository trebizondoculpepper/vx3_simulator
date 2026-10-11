import { describe, expect, it } from 'vitest';
import {
  applyRack,
  createRackControls,
  knobLine,
  toggleLine,
} from './rack-controls';
import { createRig } from './rig';

describe('applyRack', () => {
  it('passes the dials through when their switches are up', () => {
    const rackSettings = createRackControls();
    const rig = createRig();
    Object.assign(rackSettings.knobs, { spindle: 0.6, field: 0.7, trim: 0.4 });
    applyRack(rackSettings, rig.controls);
    expect(rig.controls).toMatchObject({ spindle: 0.6, field: 0.7, trim: 0.4 });
  });

  it('cuts the spindle and field when their switches are down', () => {
    const rackSettings = createRackControls();
    const rig = createRig();
    Object.assign(rackSettings.knobs, { spindle: 0.6, field: 0.7 });
    rackSettings.toggles.spin = false;
    rackSettings.toggles.hb = false;
    applyRack(rackSettings, rig.controls);
    expect(rig.controls.spindle).toBe(0);
    expect(rig.controls.field).toBe(0);
  });
});

describe('logbook lines', () => {
  it('uses a quip where a switch has one', () => {
    expect(toggleLine('gnd', true)).toMatch(/not sure what it grounds/);
  });

  it('falls back to a plain line', () => {
    expect(toggleLine('ht', false)).toBe('HT down.');
    expect(knobLine('trim', 0.64)).toBe('BLATZ TRIM to 6.4.');
  });
});
