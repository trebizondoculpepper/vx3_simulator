import type { RackControls } from './rack-controls';
import type { RigState } from './rig';

/** Outputs of the connected VX3 apparatus, presented by the wall tell-tales. */
export interface SafetyTelltales {
  powerKw: number;
  energyKwh: number;
  dilationActivity: number;
  crystalPulse: number;
  pulsePhase: number;
}

export function createSafetyTelltales(): SafetyTelltales {
  return {
    powerKw: 0,
    energyKwh: 0,
    dilationActivity: 0,
    crystalPulse: 0,
    pulsePhase: 0,
  };
}

/** A deliberately approximate supply-load and time-dilation model. */
export function networkOutputs(rig: RigState, controls: RackControls) {
  if (!rig.controls.mains) return { powerKw: 0, dilationActivity: 0 };
  const heaterKw = controls.toggles.ht ? 2.1 - rig.heater * 1.15 : 0.08;
  const powerKw =
    0.36 +
    heaterKw +
    (controls.toggles.lt ? 0.28 : 0) +
    rig.spindle * 1.65 +
    rig.field * 2.8 +
    (controls.toggles.aux1 ? 0.42 : 0) +
    (controls.toggles.chromoAux ? 0.42 : 0) +
    (controls.toggles.aux2 ? 0.16 : 0);
  const dilationActivity = Math.min(
    1,
    rig.field *
      (0.25 + rig.instability * 0.85 + rig.strain * 0.45) *
      (controls.toggles.damp ? 0.7 : 1),
  );
  return { powerKw, dilationActivity };
}

/** Advance the mechanical kWh register and the crystal's pulse envelope. */
export function stepSafetyTelltales(
  state: SafetyTelltales,
  rig: RigState,
  controls: RackControls,
  seconds: number,
): void {
  const output = networkOutputs(rig, controls);
  state.powerKw = output.powerKw;
  state.dilationActivity = output.dilationActivity;
  state.energyKwh += (output.powerKw * seconds) / 3600;
  state.crystalPulse = Math.max(0, state.crystalPulse - seconds * 2.2);
  if (output.dilationActivity > 0.01) {
    state.pulsePhase += seconds * (0.1 + output.dilationActivity * 1.6);
    if (state.pulsePhase >= 1) {
      state.pulsePhase %= 1;
      state.crystalPulse = Math.max(0.2, output.dilationActivity);
    }
  } else {
    state.pulsePhase = 0;
  }
}
