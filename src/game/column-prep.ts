/**
 * The ferrocore column's cold start, as a pure model with no DOM or Three.js.
 *
 * The machine has no purpose; the point is its preposterous cold start,
 * which the player has to work out. The core hangs from the column's head,
 * which two hydraulic rams raise and lower. Lowered and clamped, the core
 * sits sealed in the vacuum chamber. Opening the xenon inlet and the
 * outlet to the pump together purges the air out; closing the outlet then
 * lets the xenon build to working pressure. None of that lights the core:
 * the core is brought up separately, by its activation temperature (on a
 * kelvin scale, which the core follows with a lag) and its brightness.
 * Hot, it glows orange; at full power it goes blue, pulses and spins.
 *
 * Two ways it ends badly. Heat the core while the chamber is open or still
 * holds air, and the oxygen burns it out. Leave the outlet open on a hot
 * core and the chamber never reaches pressure while the bottle drains
 * through it; when the bottle is empty the starved core suffers a flux
 * inductance catastrophe.
 *
 * Gas is tracked as partial pressures in bar. The head's travel is a share
 * from 0 (lowered) to 1 (raised).
 */

export type CoreStage = 'cold' | 'glowing' | 'full' | 'failed';
export type Catastrophe = 'burnout' | 'flux-inductance';

export interface ColumnPrepState {
  /** Where the head is: 0 lowered into the chamber, 1 raised. */
  lift: number;
  /** Where the rams are driving the head. */
  liftTarget: 0 | 1;
  clamped: boolean;
  inletOpen: boolean;
  outletOpen: boolean;
  /** Partial pressures in the chamber, bar. */
  air: number;
  xenon: number;
  /** What is left in the xenon bottle, bar of chamber gas. */
  supply: number;
  /** The activation temperature the operator has set, kelvin. */
  setpoint: number;
  /** The core's own temperature, which follows the set point. */
  temperature: number;
  /** The brightness control, 0 to 1. */
  brightness: number;
  /** How the core last failed, if it has and is not yet acknowledged. */
  failure: Catastrophe | null;
  /** The core's spin, revolutions per second; it spins only at full power. */
  spinRate: number;
  /** How far round the core has turned, 0 to 1 revolution. */
  spinAngle: number;
}

export interface ColumnPrepInputs {
  /** Whether the rig has mains power. */
  powered: boolean;
}

export type ColumnPrepEvent =
  | { kind: 'lowered' }
  | { kind: 'raised' }
  | { kind: 'active' }
  | { kind: 'full-power' }
  | { kind: 'catastrophe'; cause: Catastrophe };

/** Seconds for the rams to carry the head through its whole travel. */
export const LIFT_SECONDS = 6;
export const ATMOSPHERE = 1.0;
/** The xenon regulator's set point, bar. */
export const REGULATOR = 1.8;
/** The xenon pressure a hot core needs, bar. */
export const WORKING_PRESSURE = 1.2;
/** Above this share of air in the chamber, a hot core burns. */
export const AIR_LIMIT = 0.05;
export const FULL_BOTTLE = 25;
export const AMBIENT = 293;
/** The core is active, and glowing, above this temperature, kelvin. */
export const ACTIVATION = 800;
/** At and above this temperature the core runs at full power, kelvin. */
export const FULL_POWER = 3200;
/** The core's spin at full power, revolutions per second. */
export const FULL_SPIN = 1.4;
/** The top of the activation scale, kelvin. */
export const MAXIMUM = 4000;
/** Flow coefficients through the inlet and the outlet, per second. */
const INLET = 0.15;
const OUTLET = 0.15;
/** How fast an unsealed chamber fills with room air, per second. */
const VENT = 2;
/** The core's thermal lag, seconds. */
const THERMAL_LAG = 4;

export function createColumnPrep(): ColumnPrepState {
  return {
    lift: 1,
    liftTarget: 1,
    clamped: false,
    inletOpen: false,
    outletOpen: false,
    air: ATMOSPHERE,
    xenon: 0,
    supply: FULL_BOTTLE,
    setpoint: AMBIENT,
    temperature: AMBIENT,
    brightness: 0.6,
    failure: null,
    spinRate: 0,
    spinAngle: 0,
  };
}

/** Sealed: the head is all the way down and clamped. */
export const isSealed = (state: ColumnPrepState) =>
  state.clamped && state.lift === 0;

export const chamberPressure = (state: ColumnPrepState) =>
  state.air + state.xenon;

/** The share of the chamber gas that is air; an empty chamber has none. */
export const airShare = (state: ColumnPrepState) => {
  const total = chamberPressure(state);
  return total > 1e-6 ? state.air / total : 0;
};

/** Oxygen in room air, percent by volume. */
export const AIR_OXYGEN_PERCENT = 20.9;

/** The chamber's oxygen, percent by volume; an open chamber holds room air. */
export const oxygenPercent = (state: ColumnPrepState) =>
  isSealed(state) ? airShare(state) * AIR_OXYGEN_PERCENT : AIR_OXYGEN_PERCENT;

/**
 * The chamber's oxygen sensor is a narrowband lambda probe, as in a
 * motorcycle exhaust: about 0.1 V with oxygen about, switching through
 * 0.45 V near 0.3 % and settling toward 0.85 V as the last of it goes. It
 * is the operator's proxy for a finished purge.
 */
export const lambdaVolts = (oxygen: number) =>
  0.1 + 0.75 / (1 + (Math.max(0, oxygen) / 0.3) ** 2);

/** The probe reads purge complete above this, volts. */
export const PURGE_COMPLETE_VOLTS = 0.7;

/** Whether the core is hot enough to be active. */
export const isActive = (state: ColumnPrepState) =>
  state.failure === null && state.temperature >= ACTIVATION;

/** How far the core is between activation and full power, 0 to 1. */
export const heat = (state: ColumnPrepState) =>
  Math.max(
    0,
    Math.min(1, (state.temperature - ACTIVATION) / (FULL_POWER - ACTIVATION)),
  );

/** An active core short of working pressure. */
export const isStarved = (state: ColumnPrepState) =>
  isActive(state) && state.xenon < WORKING_PRESSURE;

export function coreStage(state: ColumnPrepState): CoreStage {
  if (state.failure) return 'failed';
  if (state.temperature < ACTIVATION) return 'cold';
  return state.temperature >= FULL_POWER ? 'full' : 'glowing';
}

/** Drive the rams up or down. The clamps hold the head while closed. */
export function driveLift(state: ColumnPrepState, target: 0 | 1) {
  if (state.clamped) return false;
  state.liftTarget = target;
  return true;
}

/**
 * Close or open the clamps. They only close on a head that is fully down,
 * and once closed they hold it there, whatever the rams were doing.
 */
export function setClamped(state: ColumnPrepState, clamped: boolean) {
  if (clamped && state.lift !== 0) return false;
  state.clamped = clamped;
  if (clamped) state.liftTarget = 0;
  return true;
}

/** Set the activation temperature, clamped to the scale. */
export function setActivation(state: ColumnPrepState, kelvin: number) {
  state.setpoint = Math.max(AMBIENT, Math.min(MAXIMUM, kelvin));
}

/** Acknowledge a failure: the burnt core is changed and a fresh bottle put on. */
export function acknowledge(state: ColumnPrepState) {
  state.failure = null;
  state.supply = FULL_BOTTLE;
}

/** Advance the column by `dt` seconds, returning anything that happened. */
export function stepColumnPrep(
  state: ColumnPrepState,
  dt: number,
  inputs: ColumnPrepInputs,
): ColumnPrepEvent[] {
  const events: ColumnPrepEvent[] = [];
  const wasStage = coreStage(state);

  // The rams; closed clamps hold the head down.
  if (!state.clamped && state.lift !== state.liftTarget) {
    const step = dt / LIFT_SECONDS;
    state.lift =
      state.liftTarget > state.lift
        ? Math.min(1, state.lift + step)
        : Math.max(0, state.lift - step);
    if (state.lift === state.liftTarget)
      events.push({ kind: state.lift === 0 ? 'lowered' : 'raised' });
  }

  if (!isSealed(state)) {
    // Open to the room: the chamber fills with air and the xenon escapes.
    // An open inlet blows straight out into the room.
    const share = Math.min(1, dt * VENT);
    state.air += (ATMOSPHERE - state.air) * share;
    state.xenon -= state.xenon * share;
    if (state.inletOpen && state.supply > 0)
      state.supply = Math.max(0, state.supply - INLET * REGULATOR * dt);
  } else {
    // The inlet feeds through the regulator; the outlet runs to the pump.
    const pressure = chamberPressure(state);
    let inflow = 0;
    if (state.inletOpen && state.supply > 0)
      inflow = Math.min(
        state.supply,
        Math.max(0, INLET * (REGULATOR - pressure) * dt),
      );
    state.supply -= inflow;
    if (state.outletOpen && pressure > 0) {
      const leaving = Math.min(1, OUTLET * dt);
      state.air -= state.air * leaving;
      state.xenon -= state.xenon * leaving;
    }
    state.xenon += inflow;
  }

  // The core follows its activation temperature, with a lag; without
  // power, or burnt out, it cools to the room.
  const target =
    inputs.powered && state.failure === null ? state.setpoint : AMBIENT;
  state.temperature +=
    (target - state.temperature) * Math.min(1, dt / THERMAL_LAG);

  if (isActive(state)) {
    let cause: Catastrophe | null = null;
    if (!isSealed(state) || airShare(state) > AIR_LIMIT) cause = 'burnout';
    else if (state.supply <= 0 && state.xenon < 0.3) cause = 'flux-inductance';
    if (cause) {
      state.failure = cause;
      events.push({ kind: 'catastrophe', cause });
    }
  }

  // At full power the core spins up; otherwise it runs down.
  const spinTarget = coreStage(state) === 'full' ? FULL_SPIN : 0;
  state.spinRate += (spinTarget - state.spinRate) * Math.min(1, dt * 0.8);
  if (state.spinRate < 1e-4 && spinTarget === 0) state.spinRate = 0;
  state.spinAngle = (state.spinAngle + state.spinRate * dt) % 1;

  const stage = coreStage(state);
  if (stage !== wasStage) {
    if (stage === 'glowing' && wasStage === 'cold')
      events.push({ kind: 'active' });
    if (stage === 'full') events.push({ kind: 'full-power' });
  }
  return events;
}
