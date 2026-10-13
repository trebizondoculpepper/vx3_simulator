/**
 * The whole installation's cold start, as one pure model with no DOM or
 * Three.js. It composes the models that already exist rather than adding
 * new physics:
 *
 * - the containment vessel (`column-prep.ts`): the head the rams lower, the
 *   clamps that seal it, the purge valve to the pump, the chamber's gas and
 *   the core's temperature;
 * - the xenon supply (the catalogue's `xenon-*` components run by
 *   `rig-model.ts`): the regulator and its delivery pressure;
 * - the plant: the mercury arc rectifier, which feeds the direct-current
 *   equipment, and the xenon recirculator, whose pump runs on the mains
 *   and works whenever its KREISLAUF switch is on;
 * - the ferrocore drive (`rig.ts`): mains, valve heaters, phase spindle,
 *   Helmholtz-Blatz field and trim;
 * - the anomalies (`ferrocore-anomaly.ts`) that follow from running cores.
 *
 * The procedure, which the player has to discover: lower and clamp the
 * vessel; open the purge valve; open the xenon regulator; power the plant
 * and start the recirculator; wait for the oxygen sensor to read zero;
 * shut the purge valve; then light the ferrocore (mains, wait for the
 * heaters, bring up the spindle and field, trim the field to lock). The
 * core's temperature is not an operator control: the heaters bring it to
 * an orange glow and the cores' activity takes it to full power.
 *
 * The flow gauge reads the gas actually moving: the purge stream while the
 * purge valve is open, and the recirculator's loop once it is shut. The
 * drive's existing xenon check (`xenonReady`) needs that flow, so a
 * stopped recirculator starves a running spindle and trips the breaker.
 */

import {
  AIR_OXYGEN_PERCENT,
  AMBIENT,
  acknowledge as acknowledgeVessel,
  chamberPressure,
  coreStage,
  createColumnPrep,
  driveLift,
  isSealed,
  isStarved,
  lambdaVolts,
  oxygenPercent as vesselOxygen,
  setActivation,
  setClamped,
  stepColumnPrep,
} from './column-prep';
import type { ColumnPrepEvent, ColumnPrepState } from './column-prep';
import {
  anomalyEffects,
  anomalyStage,
  ferrocoreActivity,
  ferrocoresOperational,
} from './ferrocore-anomaly';
import type { AnomalyEffects } from './ferrocore-anomaly';
import { createRig, stepRig } from './rig';
import type { RigEvent, RigState } from './rig';
import { componentCatalogue, createRigModel } from './rig-model';
import type { RigModel } from './rig-model';
import { XENON_HAZARD_STRAIN_PER_SECOND, xenonHazard } from './xenon-supply';

/** The oxygen sensor reads zero below this, percent. */
export const OXYGEN_ZERO_PERCENT = 0.1;
/** Flow through the gauge while purging, SLPM. */
export const PURGE_FLOW_SLPM = 5;
/** Flow round the recirculator's loop, SLPM. */
export const RECIRCULATION_FLOW_SLPM = 6;
/** Delivery pressure above which the regulator is feeding the vessel, bar. */
const FEEDING_BAR = 0.2;
/** Core temperature added by warm valve heaters and by full activity, kelvin. */
const HEATER_KELVIN = 1300;
const ACTIVITY_KELVIN = 2700;
const FLOW_LAG_SECONDS = 1;

/**
 * The core's activation temperature as the drive sets it: the warm valve
 * heaters bring it to a glow, the cores' activity to full power. The core
 * itself follows with its thermal lag.
 */
export const driveTemperature = (rig: RigState) =>
  AMBIENT +
  rig.heater * HEATER_KELVIN +
  ferrocoreActivity(rig) * ACTIVITY_KELVIN;
/** The core's brightness as the drive sets it, from its field. */
export const driveBrightness = (rig: RigState) => 0.4 + 0.6 * rig.field;

export interface ColdStartState {
  rig: RigState;
  vessel: ColumnPrepState;
  xenon: RigModel;
  /** The mercury arc rectifier, which powers the plant room. */
  rectifier: boolean;
  /** The recirculator's KREISLAUF switch. */
  recirculatorSwitch: boolean;
  /** What the xenon flow gauge reads, SLPM. */
  flowSlpm: number;
  seconds: number;
}

export type ColdStartEvent =
  | { source: 'vessel'; event: ColumnPrepEvent }
  | { source: 'rig'; event: RigEvent }
  | { source: 'plant'; event: { kind: 'fully-operational' } };

export function createColdStart(): ColdStartState {
  return {
    rig: createRig(),
    vessel: createColumnPrep(),
    xenon: createRigModel(
      componentCatalogue.filter((c) => c.id.startsWith('xenon-')),
    ),
    rectifier: false,
    recirculatorSwitch: false,
    flowSlpm: 0,
    seconds: 0,
  };
}

// ---- Operator inputs --------------------------------------------------------

/** Drive the vessel's head down (0) or up (1); refused while clamped. */
export const driveHead = (state: ColdStartState, target: 0 | 1) =>
  driveLift(state.vessel, target);
/** Close or open the clamps; they close only on a fully lowered head. */
export const clampVessel = (state: ColdStartState, clamped: boolean) =>
  setClamped(state.vessel, clamped);
/** Open or shut the purge valve to the pump. */
export function setPurgeValve(state: ColdStartState, open: boolean) {
  state.vessel.outletOpen = open;
}
/** Set the xenon regulator, 0 (shut) to 1. */
export function setXenonRegulator(state: ColdStartState, setting: number) {
  state.xenon.setControl('xenon-supply.flow-valve', setting);
}
export function setRectifier(state: ColdStartState, on: boolean) {
  state.rectifier = on;
}
export function setRecirculator(state: ColdStartState, on: boolean) {
  state.recirculatorSwitch = on;
}
/** Acknowledge a vessel failure: a new core and a fresh bottle. */
export function acknowledgeVesselFault(state: ColdStartState) {
  acknowledgeVessel(state.vessel);
}

// ---- Readings ----------------------------------------------------------------

/** Delivered xenon pressure from the regulator, bar. */
export const deliveryBar = (state: ColdStartState) =>
  state.xenon.display('xenon-supply.pressure');

/** The vessel's oxygen, percent by volume. */
export const oxygenPercent = (state: ColdStartState) =>
  vesselOxygen(state.vessel);

/** What the vessel's lambda probe reads, volts. */
export const oxygenSensorVolts = (state: ColdStartState) =>
  lambdaVolts(oxygenPercent(state));

export const plantPowered = (state: ColdStartState) => state.rectifier;

/** The recirculator is running: its pump is on the mains, so its switch. */
export const recirculatorWorking = (state: ColdStartState) =>
  state.recirculatorSwitch;

/** Gas is going round the loop: running, sealed, purge shut, xenon in it. */
export const recirculating = (state: ColdStartState) =>
  recirculatorWorking(state) &&
  isSealed(state.vessel) &&
  !state.vessel.outletOpen &&
  state.vessel.xenon > 0.5;

export const activity = (state: ColdStartState) => ferrocoreActivity(state.rig);

/**
 * Fully operational: the ferrocores are running and settled on a good
 * xenon flow, in a sealed, oxygen-free vessel with the purge shut, the core
 * at full power and the anomalies strong.
 */
export function fullyOperational(state: ColdStartState) {
  return (
    ferrocoresOperational(state.rig, state.flowSlpm) &&
    isSealed(state.vessel) &&
    !state.vessel.outletOpen &&
    oxygenPercent(state) < OXYGEN_ZERO_PERCENT &&
    coreStage(state.vessel) === 'full' &&
    anomalyStage(activity(state)) === 2
  );
}

/** The room's anomalies at this moment. */
export const effects = (
  state: ColdStartState,
  reducedMotion = false,
): AnomalyEffects =>
  anomalyEffects(activity(state), state.seconds, reducedMotion);

export { AIR_OXYGEN_PERCENT, chamberPressure, coreStage, isSealed, isStarved };

// ---- Advancing -----------------------------------------------------------

export function stepColdStart(
  state: ColdStartState,
  dt: number,
  random: () => number = Math.random,
): ColdStartEvent[] {
  const events: ColdStartEvent[] = [];
  const wasOperational = fullyOperational(state);
  state.seconds += dt;

  // The regulator feeds the vessel whenever it delivers pressure.
  state.xenon.step(dt, random);
  state.vessel.inletOpen = deliveryBar(state) > FEEDING_BAR;

  // The core's temperature is the model's, not the operator's: the warm
  // valve heaters bring it to a glow, the cores' activity to full power.
  setActivation(state.vessel, driveTemperature(state.rig));
  state.vessel.brightness = driveBrightness(state.rig);
  for (const event of stepColumnPrep(state.vessel, dt, {
    powered: state.rig.controls.mains,
  })) {
    events.push({ source: 'vessel', event });
    // A ruined core takes the drive's breaker with it.
    if (event.kind === 'catastrophe') state.rig.controls.mains = false;
  }

  // The flow gauge.
  const purging =
    isSealed(state.vessel) && state.vessel.outletOpen && state.vessel.inletOpen;
  const flowTarget =
    (purging ? PURGE_FLOW_SLPM : 0) +
    (recirculating(state) ? RECIRCULATION_FLOW_SLPM : 0);
  state.flowSlpm +=
    (flowTarget - state.flowSlpm) * Math.min(1, dt / FLOW_LAG_SECONDS);

  // The drive, with its existing hazard from an unpressurised circuit.
  const hazard = xenonHazard(state.rig.spindle, state.flowSlpm)
    ? XENON_HAZARD_STRAIN_PER_SECOND
    : 0;
  for (const event of stepRig(state.rig, dt, random, hazard))
    events.push({ source: 'rig', event });

  if (!wasOperational && fullyOperational(state))
    events.push({ source: 'plant', event: { kind: 'fully-operational' } });
  return events;
}
