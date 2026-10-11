import type { RackControls } from '../game/rack-controls';
import type { RigState } from '../game/rig';

export interface SoundParameters {
  roomGain: number;
  humGain: number;
  heaterGain: number;
  spindleGain: number;
  spindleHz: number;
  rotorHz: number;
  fieldGain: number;
  fieldHz: number;
  fieldBeatHz: number;
  strainGain: number;
  strainHz: number;
  counterClicksPerSecond: number;
  sparkCracksPerSecond: number;
}

export function writeSoundParameters(
  state: RigState,
  controls: RackControls,
  result: SoundParameters,
): void {
  const powered = state.controls.mains;
  result.roomGain = 0.005;
  result.humGain = powered ? 0.018 + state.field * 0.008 : 0;
  result.heaterGain = state.heater * 0.014;
  result.spindleGain = state.spindle * 0.019;
  result.spindleHz = 65 + state.spindle * 125;
  result.rotorHz = 6 + state.spindle * 29;
  result.fieldGain = state.field * 0.018;
  result.fieldHz = 48 + state.field * 52;
  result.fieldBeatHz = 0.15 + state.instability * 3.8;
  result.strainGain = state.strain * 0.008;
  result.strainHz = 500 + state.strain * 850;
  result.counterClicksPerSecond = powered
    ? (38 + state.instability * 400) / 60
    : 0;
  result.sparkCracksPerSecond =
    powered && controls.toggles.aux1 ? 0.5 + state.field * 3.5 : 0;
}

/** Snapshot form of the mapping for tests and tooling; the engine reuses an output object. */
export function soundParameters(
  state: RigState,
  controls: RackControls,
): SoundParameters {
  const result: SoundParameters = {
    roomGain: 0,
    humGain: 0,
    heaterGain: 0,
    spindleGain: 0,
    spindleHz: 0,
    rotorHz: 0,
    fieldGain: 0,
    fieldHz: 0,
    fieldBeatHz: 0,
    strainGain: 0,
    strainHz: 0,
    counterClicksPerSecond: 0,
    sparkCracksPerSecond: 0,
  };
  writeSoundParameters(state, controls, result);
  return result;
}
