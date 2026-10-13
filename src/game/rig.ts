import { pickConsequence } from './consequences';

/** Operator settings on the VX3 front panel. Dials run from 0 to 1. */
export interface RigControls {
  mains: boolean;
  spindle: number;
  governor?: number;
  governorResponse?: number;
  field: number;
  plasmaExcitation?: number;
  plasmaNull?: number;
  trim: number;
  /** Gearing between the Encabulator and the phase spindle (RATIO). */
  ratio?: number;
  /** The plasma inducer is earthed (GND?), which steadies the drift. */
  grounded?: boolean;
  /** Ion-insulation check band (BAND), 0 (A) to 1 (Ω). */
  band?: number;
}

/** RATIO's factory setting, at which the trim point is where it always was. */
export const RATIO_NEUTRAL = 0.3;

/** Physical state of the rig, advanced by `stepRig`. */
export interface RigState {
  controls: RigControls;
  /** Valve heater temperature, 0 (cold) to 1 (operating). */
  heater: number;
  /** Phase spindle speed, 0 to 1. */
  spindle: number;
  /** Helmholtz-Blatz field strength, 0 to 1. */
  field: number;
  /** Slow random wander of the ideal trim point. */
  drift: number;
  /** How far the field is from equilibrium, 0 (locked) to 1 (gone). */
  instability: number;
  /** Accumulated over-stability stress; an incident fires at 1. */
  strain: number;
  /** How much of the current strain came from each source, for trip reports. */
  strainFrom: { field: number; hazard: number };
  incidents: number;
}

/** The rig's state at the moment the breaker tripped, for the fault printout. */
export interface TripReport {
  /** Share of the strain that came from the field off equilibrium, 0 to 1. */
  fieldShare: number;
  /** Share that came from hazards elsewhere, such as dry xenon, 0 to 1. */
  hazardShare: number;
  /** BLATZ TRIM minus the trim the field wanted; positive means set high. */
  trimError: number;
  /** NULL's distance from centre, -0.5 to 0.5. */
  nullOffset: number;
  drift: number;
  grounded: boolean;
  ratio: number;
  /** BAND minus field strength; far from zero, strain bleeds slowly. */
  bandError: number;
  field: number;
  spindle: number;
}

export type RigEvent =
  | { kind: 'warmed' }
  | { kind: 'field-locked' }
  | { kind: 'warning' }
  | { kind: 'incident'; text: string; report: TripReport };

export const WARNING_LEVEL = 0.55;
export const YALGETH_LIMIT = 0.88;
const HEATER_SECONDS = 6;
const SPINDLE_SECONDS = 2.5;
const FIELD_SECONDS = 3;

export function createRig(): RigState {
  return {
    controls: { mains: false, spindle: 0, field: 0, trim: 0.5 },
    heater: 0,
    spindle: 0,
    field: 0,
    drift: 0,
    instability: 0,
    strain: 0,
    strainFrom: { field: 0, hazard: 0 },
    incidents: 0,
  };
}

/** Trim setting at which the field sits in equilibrium. */
export function idealTrim(state: RigState): number {
  // Changing gear moves the point at which the field balances.
  const gearing =
    ((state.controls.ratio ?? RATIO_NEUTRAL) - RATIO_NEUTRAL) * 0.25;
  return clamp(
    0.2 + state.spindle * 0.35 + state.field * 0.3 + state.drift + gearing,
  );
}

/** Workstation estimate of Delta, bounded by Yalgeth's reported four-dimensional limit. */
export function deltaScore(state: RigState): number {
  return Math.min(
    YALGETH_LIMIT,
    state.field * (1 - state.instability * 0.8) * YALGETH_LIMIT,
  );
}

/**
 * Advance the rig by `delta` seconds. Pure apart from mutating `state`;
 * randomness comes from `random` so tests can be deterministic.
 * `hazardStrain` is strain per second from unsafe running elsewhere in the
 * installation, such as an unpressurised xenon circuit; while it lasts,
 * strain builds instead of bleeding away.
 */
export function stepRig(
  state: RigState,
  delta: number,
  random: () => number = Math.random,
  hazardStrain = 0,
): RigEvent[] {
  const events: RigEvent[] = [];
  const { controls } = state;
  const wasWarm = state.heater >= 0.95;
  const wasLocked = state.field > 0.2 && state.instability < 0.1;
  const wasWarning = state.instability >= WARNING_LEVEL;

  state.heater = approach(
    state.heater,
    controls.mains ? 1 : 0,
    delta / HEATER_SECONDS,
  );
  // The spindle will not turn until the valves are warm enough to drive it.
  const spindleTarget =
    controls.mains && state.heater > 0.5
      ? Math.min(controls.spindle, controls.governor ?? 1)
      : 0;
  state.spindle = approach(
    state.spindle,
    spindleTarget,
    (delta / SPINDLE_SECONDS) *
      (0.4 + (controls.governorResponse ?? 0.5) * 1.2),
  );
  // The Helmholtz-Blatz field needs a turning spindle to sustain itself.
  const fieldTarget =
    controls.mains && state.spindle > 0.2
      ? Math.min(controls.field, controls.plasmaExcitation ?? 1)
      : 0;
  state.field = approach(state.field, fieldTarget, delta / FIELD_SECONDS);

  // Drift wanders faster as the field strengthens, so a hot rig needs tending.
  // An earthed plasma inducer bleeds field noise away, so drift slows.
  const wander =
    (random() - 0.5) *
    delta *
    (0.04 + state.field * 0.25) *
    (controls.grounded ? 0.4 : 1);
  state.drift = Math.max(
    -0.25,
    Math.min(0.25, state.drift * (1 - delta * 0.05) + wander),
  );

  const error =
    Math.abs(controls.trim - idealTrim(state)) +
    Math.abs((controls.plasmaNull ?? 0.5) - 0.5) * 0.2;
  state.instability = clamp(error * 3.5 * state.field);

  const fromField =
    state.instability > WARNING_LEVEL
      ? delta * (state.instability - WARNING_LEVEL) * 1.2
      : 0;
  const fromHazard = delta * hazardStrain;
  if (fromField > 0 || fromHazard > 0) {
    state.strain += fromField + fromHazard;
    state.strainFrom.field += fromField;
    state.strainFrom.hazard += fromHazard;
  } else {
    const before = state.strain;
    state.strain = Math.max(
      0,
      state.strain - delta * 0.15 * insulationBleed(state.field, controls.band),
    );
    // Strain bleeds away from every source alike.
    const kept = before > 0 ? state.strain / before : 0;
    state.strainFrom.field *= kept;
    state.strainFrom.hazard *= kept;
  }

  if (!wasWarm && state.heater >= 0.95) events.push({ kind: 'warmed' });
  if (!wasLocked && state.field > 0.2 && state.instability < 0.1)
    events.push({ kind: 'field-locked' });
  if (!wasWarning && state.instability >= WARNING_LEVEL)
    events.push({ kind: 'warning' });

  if (state.strain >= 1) {
    state.incidents += 1;
    events.push({
      kind: 'incident',
      text: pickConsequence(random),
      report: tripReport(state),
    });
    // The breaker trips and the field collapses.
    controls.mains = false;
    state.field = 0;
    state.spindle *= 0.5;
    state.strain = 0;
    state.strainFrom = { field: 0, hazard: 0 };
    state.instability = 0;
    state.drift = 0;
  }
  return events;
}

function tripReport(state: RigState): TripReport {
  const { controls, strainFrom } = state;
  const total = strainFrom.field + strainFrom.hazard;
  return {
    fieldShare: total > 0 ? strainFrom.field / total : 0,
    hazardShare: total > 0 ? strainFrom.hazard / total : 0,
    trimError: controls.trim - idealTrim(state),
    nullOffset: (controls.plasmaNull ?? 0.5) - 0.5,
    drift: state.drift,
    grounded: controls.grounded ?? false,
    ratio: controls.ratio ?? RATIO_NEUTRAL,
    bandError: (controls.band ?? 0.4) - state.field,
    field: state.field,
    spindle: state.spindle,
  };
}

function approach(value: number, target: number, step: number) {
  return value < target
    ? Math.min(target, value + step)
    : Math.max(target, value - step);
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

/**
 * How fast strain bleeds away, relative to normal, for the insulation check
 * band: one and a half times as fast when the band matches the field
 * strength, half as fast when it is far off.
 */
export function insulationBleed(field: number, band = 0.4) {
  return 0.5 + (1 - Math.min(1, Math.abs(band - field) * 2));
}
