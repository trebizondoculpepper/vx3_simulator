import { describe, expect, it } from 'vitest';
import { assembleRack, rackModules } from './rack-catalogue';
import {
  applyRack,
  createRackControls,
  knobIds,
  knobLine,
  toggleIds,
  toggleLine,
} from './rack-controls';
import { createRig, stepRig } from './rig';

const rotaryIds = (modules: typeof rackModules) =>
  modules.flatMap((module) =>
    module.controls.flatMap((control) =>
      control.kind === 'knob' || control.kind === 'selector'
        ? [control.id]
        : [],
    ),
  );

describe('independent rotary inputs', () => {
  it('gives every knob and selector its own setting, including alternate panels and the side cabinet', () => {
    for (const modules of [rackModules, assembleRack()]) {
      const ids = [...rotaryIds(modules), 'ampGain'];
      expect(new Set(ids).size).toBe(ids.length);
    }
    const ids = [...rotaryIds(rackModules), 'ampGain'].sort();
    expect(ids).toEqual([...knobIds].sort());
  });

  it('changing each rotary input leaves all the others untouched through simulation', () => {
    for (const id of knobIds) {
      const controls = createRackControls();
      const before = { ...controls.knobs };
      controls.knobs[id] = before[id] === 0.7 ? 0.2 : 0.7;
      const rig = createRig();
      applyRack(controls, rig.controls);
      stepRig(rig, 0.1, () => 0.5);
      for (const other of knobIds.filter((other) => other !== id))
        expect(controls.knobs[other], `${id} changed ${other}`).toBe(
          before[other],
        );
    }
  });

  it('plasma excitation limits the resulting field without moving the coil input', () => {
    const controls = createRackControls();
    controls.knobs.field = 0.8;
    controls.knobs.plasmaExcite = 0.3;
    controls.knobs.trim = 0.5;
    const rig = createRig();
    rig.controls.mains = true;
    rig.heater = 1;
    rig.spindle = 0.5;
    controls.knobs.spindle = 0.5;
    applyRack(controls, rig.controls);
    for (let frame = 0; frame < 120; frame++) stepRig(rig, 1 / 60, () => 0.5);
    expect(rig.field).toBeCloseTo(0.3);
    expect(controls.knobs.field).toBe(0.8);
    expect(controls.knobs.plasmaExcite).toBe(0.3);
  });
});

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

describe('independent switches', () => {
  it('gives every switch fitted to the rack its own setting', () => {
    const ids = assembleRack().flatMap((module) =>
      module.controls.flatMap((control) =>
        control.kind === 'toggle' ? [control.id] : [],
      ),
    );
    expect(new Set(ids).size, ids.join(', ')).toBe(ids.length);
  });

  it('flipping one switch leaves every other switch alone', () => {
    for (const id of toggleIds) {
      const controls = createRackControls();
      const before = { ...controls.toggles };
      controls.toggles[id] = !before[id];
      applyRack(controls, createRig().controls);
      for (const other of toggleIds.filter((other) => other !== id))
        expect(controls.toggles[other], `${id} moved ${other}`).toBe(
          before[other],
        );
    }
  });

  it('lets the governor limit the spindle only while engaged', () => {
    const controls = createRackControls();
    controls.knobs.spindle = 0.9;
    controls.knobs.governor = 0.3;
    const rig = createRig();
    applyRack(controls, rig.controls);
    expect(rig.controls.governor).toBe(0.3);
    controls.toggles.governorEngage = false;
    applyRack(controls, rig.controls);
    expect(rig.controls.governor).toBe(1);
  });

  it('takes the plasma excitation away when the plasma switch is off', () => {
    const controls = createRackControls();
    controls.toggles.plasmaOn = false;
    const rig = createRig();
    applyRack(controls, rig.controls);
    expect(rig.controls.plasmaExcitation).toBe(0);
  });
});

describe('secondary controls reach the rig', () => {
  it('passes RATIO, GND? and the insulation BAND through', () => {
    const controls = createRackControls();
    controls.knobs.ratio = 0.8;
    controls.toggles.gnd = true;
    controls.knobs.insulationBand = 0.2;
    const rig = createRig();
    applyRack(controls, rig.controls);
    expect(rig.controls.ratio).toBe(0.8);
    expect(rig.controls.grounded).toBe(true);
    expect(rig.controls.band).toBe(0.2);
  });
});
