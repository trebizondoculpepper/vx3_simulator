import { describe, expect, it } from 'vitest';
import { componentCatalogue, createRigModel } from './rig-model';
import {
  XENON_SPINDLE_LIMIT,
  xenonHazard,
  xenonReady,
  xenonSourcePressure,
} from './xenon-supply';
import {
  acknowledge,
  annunciators,
  boardView,
  createBoard,
  stepBoard,
} from './control-board';
import { createRig } from './rig';
import { createRackControls } from './rack-controls';
import { createSafetyTelltales } from './safety-telltales';

describe('xenon commissioning', () => {
  it('requires a finite measured flow of at least 2 SLPM', () => {
    for (const flow of [0, 1.99, NaN, Infinity])
      expect(xenonReady(flow)).toBe(false);
    expect(xenonReady(2)).toBe(true);
  });
  it('warns only once the spindle is past its limit on an unpressurised circuit', () => {
    expect(xenonHazard(0, 0)).toBe(false);
    expect(xenonHazard(XENON_SPINDLE_LIMIT, 0)).toBe(false);
    expect(xenonHazard(XENON_SPINDLE_LIMIT + 0.01, 0)).toBe(true);
    expect(xenonHazard(1, 1.5)).toBe(true);
    expect(xenonHazard(1, 2)).toBe(false);
  });
  it('starts shut and raises pressure and flow only when the valve opens', () => {
    const model = createRigModel(
      componentCatalogue.filter((c) => c.id.startsWith('xenon-')),
    );
    for (let i = 0; i < 30; i++) model.step(0.1);
    expect(model.display('xenon-flow-gauge.flow')).toBe(0);
    expect(model.display('xenon-pressure-indicator.pressure')).toBe(0);
    model.setControl('xenon-supply.flow-valve', 0.5);
    for (let i = 0; i < 60; i++) model.step(0.1);
    expect(model.display('xenon-pressure-indicator.pressure')).toBeCloseTo(
      2,
      2,
    );
    expect(model.display('xenon-flow-gauge.flow')).toBeCloseTo(5, 2);
    model.setControl('xenon-supply.flow-valve', 0);
    for (let i = 0; i < 60; i++) model.step(0.1);
    expect(model.display('xenon-flow-gauge.flow')).toBeLessThan(0.02);
    expect(model.display('xenon-pressure-indicator.pressure')).toBeLessThan(
      0.02,
    );
  });
  it('keeps flow proportional to valve opening and lets source pressure dip under load', () => {
    const model = createRigModel(
      componentCatalogue.filter((c) => c.id.startsWith('xenon-')),
    );
    const contents = 0.92;
    expect(xenonSourcePressure(contents, 0)).toBe(contents);
    for (const opening of [0.2, 0.5, 0.8, 1]) {
      model.setControl('xenon-supply.flow-valve', opening);
      for (let i = 0; i < 90; i++) model.step(0.1);
      const flowFraction = model.get('xenon-flow-gauge.flow');
      expect(model.display('xenon-flow-gauge.flow')).toBeCloseTo(
        opening * 10,
        2,
      );
      expect(model.display('xenon-pressure-indicator.pressure')).toBeCloseTo(
        opening * 4,
        2,
      );
      expect(xenonSourcePressure(contents, flowFraction)).toBeLessThan(
        contents,
      );
    }
    const loaded = xenonSourcePressure(
      contents,
      model.get('xenon-flow-gauge.flow'),
    );
    model.setControl('xenon-supply.flow-valve', 0);
    for (let i = 0; i < 90; i++) model.step(0.1);
    expect(
      xenonSourcePressure(contents, model.get('xenon-flow-gauge.flow')),
    ).toBeGreaterThan(loaded);
    expect(xenonSourcePressure(contents, 0)).toBe(contents);
  });
  it('flashes XE FLUSS while the drive is on and the flow is insufficient', () => {
    const board = createBoard();
    const inputs = {
      rig: createRig(),
      controls: createRackControls(),
      telltales: createSafetyTelltales(),
      xenonFlowSlpm: 0,
    };
    const flow = annunciators.findIndex((w) => w.label === 'XE FLUSS');
    stepBoard(board, inputs, 0.1);
    expect(boardView(board, inputs).tiles[flow]).toBe(false);
    inputs.rig.controls.mains = true;
    stepBoard(board, inputs, 0.1);
    expect(boardView(board, inputs).tiles[flow]).toBe(true);
    stepBoard(board, inputs, 0.45);
    expect(boardView(board, inputs).tiles[flow]).toBe(false);
    inputs.xenonFlowSlpm = 3;
    acknowledge(board, inputs);
    stepBoard(board, inputs, 0.45);
    expect(boardView(board, inputs).tiles[flow]).toBe(false);
  });
});
