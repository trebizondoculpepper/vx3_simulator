import { describe, expect, it } from 'vitest';
import { componentCatalogue, createRigModel } from './rig-model';
import { XENON_SPINDLE_LIMIT, xenonHazard, xenonReady } from './xenon-supply';
import { boardView, createBoard, stepBoard } from './control-board';
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
  it('flashes the flow tile while supply is insufficient, including before mains', () => {
    const board = createBoard();
    const inputs = {
      rig: createRig(),
      controls: createRackControls(),
      telltales: createSafetyTelltales(),
      xenonFlowSlpm: 0,
    };
    expect(boardView(board, inputs).tiles[2]).toBe(true);
    stepBoard(board, inputs, 0.45);
    expect(boardView(board, inputs).tiles[2]).toBe(false);
    inputs.xenonFlowSlpm = 3;
    stepBoard(board, inputs, 0.45);
    expect(boardView(board, inputs).tiles[2]).toBe(false);
  });
});
