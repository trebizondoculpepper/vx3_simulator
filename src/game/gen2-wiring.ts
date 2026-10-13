import {
  FULL_BOTTLE,
  PURGE_COMPLETE_VOLTS,
  WORKING_PRESSURE,
  isSealed,
  lambdaVolts,
  oxygenPercent,
} from './column-prep';
import type { ColumnPrepState } from './column-prep';
import { xenonReady } from './xenon-supply';

/**
 * How the second-generation VX3 is wired into the lab. Its ferrocore drive
 * is the drive model (`rig.ts`), worked from the column's panels and the
 * east board, and it heats the core (`driveTemperature` in cold-start.ts);
 * the containment vessel is the column model (`column-prep.ts`). This file
 * holds what joins them to the plant room and the alarms. Pure functions,
 * no DOM or Three.js.
 */

/**
 * The xenon that reaches the machine, SLPM. The cylinder bank's regulator
 * sets the flow, but the recirculator is the pump that carries it round
 * the loop to the column: with the recirculator stopped, nothing arrives.
 */
export const lineFlow = (
  regulatorSlpm: number,
  recirculatorWorking: boolean,
) => (recirculatorWorking ? regulatorSlpm : 0);

/**
 * Bar of chamber gas the line puts back into the column's buffer each
 * second, per SLPM of flow.
 */
export const LINE_REFILL_PER_SLPM = 0.15;

/**
 * The xenon line feeds the column's buffer (what the model calls its
 * bottle). At working flow it refills, faster with more flow; with the
 * line dry it only drains, and an open outlet on a hot core will starve it.
 */
export function feedFromLine(
  state: ColumnPrepState,
  flowSlpm: number,
  dt: number,
) {
  if (!xenonReady(flowSlpm)) return;
  state.supply = Math.min(
    FULL_BOTTLE,
    state.supply + flowSlpm * LINE_REFILL_PER_SLPM * dt,
  );
}

/**
 * The drive's atmosphere permit. The valve heaters and the ferrocore only
 * run in a purged xenon atmosphere: the vessel sealed, its oxygen gone (the
 * lambda probe reading purge complete), the xenon at working pressure, and
 * the recirculator running. Without it the drive is held off whatever its
 * switches say.
 */
export const atmospherePermit = (
  state: ColumnPrepState,
  recirculatorWorking: boolean,
) =>
  state.failure === null &&
  isSealed(state) &&
  lambdaVolts(oxygenPercent(state)) >= PURGE_COMPLETE_VOLTS &&
  state.xenon >= WORKING_PRESSURE &&
  recirculatorWorking;
