import { describe, expect, it } from 'vitest';
import { validatePanel } from './panel-grid';
import { componentCatalogue, createRigModel } from './rig-model';
import type { RigModel } from './rig-model';

const still = () => 0.5;

function run(model: RigModel, seconds: number) {
  for (let t = 0; t < seconds; t += 0.1) model.step(0.1, still);
}

/** Mains on, variac up, oven hot, encabulator driving: a running rig. */
function runningRig() {
  const model = createRigModel(componentCatalogue);
  model.setControl('varistance-isolator.mains', 1);
  model.setControl('ballast-variac.tap', 1);
  model.setControl('ferrocore-warming-oven.power', 1);
  model.setControl('ferrocore-warming-oven.thermostat', 1);
  model.setControl('encabulator.drive-set', 0.8);
  run(model, 120);
  return model;
}

describe('component catalogue', () => {
  it('lays out every panel on its grid without overprinting', () => {
    for (const component of componentCatalogue)
      expect(validatePanel(component.panel), component.id).toEqual([]);
  });

  it('only refers to controls and variables that exist', () => {
    const model = createRigModel(componentCatalogue);
    for (const component of componentCatalogue) {
      for (const instrument of component.panel.instruments)
        expect(model.has(instrument.shows), instrument.shows).toBe(true);
      for (const variable of component.model.variables) {
        for (const influence of variable.influences) {
          const sources =
            influence.kind === 'linear'
              ? [influence.source]
              : [influence.a, influence.b];
          for (const source of sources)
            expect(model.has(source), source).toBe(true);
        }
        for (const gate of variable.gates ?? [])
          expect(model.has(gate.source), gate.source).toBe(true);
      }
    }
  });

  it('gives every component a manufacturer and a visual description', () => {
    for (const component of componentCatalogue) {
      expect(component.manufacturer.name, component.id).not.toBe('');
      expect(component.visual_description.length).toBeGreaterThan(40);
    }
  });
});

describe('ferrocore rotational speed', () => {
  it('stays still until the warming oven is hot', () => {
    const model = createRigModel(componentCatalogue);
    model.setControl('varistance-isolator.mains', 1);
    model.setControl('ballast-variac.tap', 1);
    model.setControl('encabulator.drive-set', 1);
    run(model, 60);
    expect(model.get('ferrocore.rpm')).toBe(0);
  });

  it('is pushed up and down by controls across the rack', () => {
    const model = runningRig();
    const baseline = model.get('ferrocore.rpm');
    expect(baseline).toBeGreaterThan(0.2);

    model.setControl('ferrocore.overclock', 1);
    run(model, 30);
    const overclocked = model.get('ferrocore.rpm');
    expect(overclocked).toBeGreaterThan(baseline);

    model.setControl('governor-flyweights.setpoint', 1);
    run(model, 30);
    const governed = model.get('ferrocore.rpm');
    expect(governed).toBeLessThan(overclocked);

    model.setControl('encabulator.brake', 1);
    run(model, 30);
    expect(model.get('ferrocore.rpm')).toBeLessThan(governed);
  });
});

describe('createRigModel', () => {
  it('runs a rack with only some components present', () => {
    const subset = componentCatalogue.filter((component) =>
      ['ferrocore', 'encabulator', 'ballast-variac'].includes(component.id),
    );
    const model = createRigModel(subset);
    model.setControl('ballast-variac.tap', 1);
    model.setControl('encabulator.drive-set', 1);
    run(model, 60);
    // No mains isolator or oven in this rack, so their gates stay open.
    expect(model.get('ferrocore.rpm')).toBeGreaterThan(0.3);
    expect(model.has('helmholtz-blatz-coil.field')).toBe(false);
  });

  it('peaks Holtzmann resonance when the tuning matches the core speed', () => {
    const model = runningRig();
    const rpm = model.get('ferrocore.rpm');
    model.setControl('holtzmann-resonance-coil.tune', rpm);
    run(model, 10);
    const matched = model.get('holtzmann-resonance-coil.resonance');
    model.setControl('holtzmann-resonance-coil.tune', rpm > 0.5 ? 0 : 1);
    run(model, 10);
    expect(model.get('holtzmann-resonance-coil.resonance')).toBeLessThan(
      matched,
    );
  });

  it('builds strain while the field is unstable and bleeds it off after', () => {
    const model = runningRig();
    model.setControl('helmholtz-blatz-coil.trim', 1);
    run(model, 20);
    const strained = model.get('main-bus-controller.strain');
    expect(strained).toBeGreaterThan(0);
    model.setControl(
      'helmholtz-blatz-coil.trim',
      model.get('hyperflux-inductor.flux'),
    );
    run(model, 20);
    expect(model.get('main-bus-controller.strain')).toBeLessThan(strained);
  });

  it('springs push buttons back after one step', () => {
    const model = createRigModel(componentCatalogue);
    model.setControl('baltovsky-chamber.lamp-test', 1);
    model.setControl('baltovsky-chamber.purge', 1);
    model.step(0.1, still);
    expect(model.get('baltovsky-chamber.lamp-test')).toBe(0);
    // The mushroom PURGE button latches until it is pulled back out.
    expect(model.get('baltovsky-chamber.purge')).toBe(1);
  });

  it('caps Delta at Yalgeth’s limit', () => {
    const model = runningRig();
    model.setControl('helmholtz-blatz-coil.energise', 1);
    model.setControl('helmholtz-blatz-coil.field-set', 1);
    model.setControl('phase-spindle.spin', 1);
    model.setControl('phase-spindle.ratio', 1);
    model.setControl('oblidisk.clutch', 1);
    run(model, 120);
    expect(model.get('main-bus-controller.delta')).toBeLessThanOrEqual(0.88);
  });
});
