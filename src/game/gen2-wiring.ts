import {
  AMBIENT,
  FULL_BOTTLE,
  FULL_SPIN,
  MAXIMUM,
  REGULATOR,
  airShare,
  chamberPressure,
  heat,
  isSealed,
  isStarved,
} from './column-prep';
import type { ColumnPrepState } from './column-prep';
import { xenonReady } from './xenon-supply';

/**
 * How the second-generation VX3, the ferrocore column, is wired into the
 * lab: its supply comes through the plant room, its xenon from the plant
 * room's cylinder bank, its remote switching from the east board, and its
 * readings out to the board, the wall meter, the crystal and the room.
 * Pure functions, no DOM or Three.js.
 */

/** What feeds and switches the column, from the rest of the lab. */
export interface Gen2Supply {
  /** The plant room's HAUPTSCHALTER is closed. */
  plantPowered: boolean;
  /** The rig's own NETZ button and side isolator are both on. */
  rigOn: boolean;
  /** The east board's NETZ contactor is closed (and NOT-AUS not hit). */
  remoteMains: boolean;
}

/** The column has power only when every switch in its supply is closed. */
export const gen2Powered = (supply: Gen2Supply) =>
  supply.plantPowered && supply.rigOn && supply.remoteMains;

/**
 * Bar of chamber gas the plant room's xenon line puts back into the
 * column's buffer each second, per SLPM of flow.
 */
export const LINE_REFILL_PER_SLPM = 0.15;

/**
 * The plant room's xenon line feeds the column's buffer (what the model
 * calls its bottle). With the cage's regulator giving at least the minimum
 * flow the buffer refills, faster with more flow; with the line shut it
 * only drains, and an open outlet on a hot core will starve it.
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

/** The column's spin as a share of full power's, 0 to 1. */
export const spinShare = (state: ColumnPrepState) =>
  Math.min(1, state.spinRate / FULL_SPIN);

/**
 * What the column draws, kW: its controls and pump while powered, and its
 * core heater, which draws more the hotter the core is held. At full
 * power it sits just under the supply's 6.5 kW limit.
 */
export function gen2PowerKw(state: ColumnPrepState, powered: boolean) {
  if (!powered) return 0;
  const held = (state.temperature - AMBIENT) / (MAXIMUM - AMBIENT);
  return 0.45 + Math.max(0, held) * 5.6 + (state.outletOpen ? 0.3 : 0);
}

/**
 * How active the ferrocore is, 0 to 1, for the room's effects and the
 * time-dilation crystal: it wakes as the core heats past activation and is
 * strongest spinning at full power.
 */
export const gen2Activity = (state: ColumnPrepState) =>
  state.failure ? 0 : Math.min(1, heat(state) * 0.55 + spinShare(state) * 0.45);

/** The column's alarm conditions, for the board's DRUCK and STÖRUNG windows. */
export const gen2Alarms = (state: ColumnPrepState) => ({
  pressure: isStarved(state) || chamberPressure(state) > REGULATOR + 0.2,
  fault: state.failure !== null,
});

/**
 * The board's eight channels, read from the column. The 1986 retrofit's
 * channel names are kept and given the column's nearest quantities:
 * HEIZUNG the core's temperature, SPINDEL its spin, FELD how far it is
 * between activation and full power, TRIMM how close the core is to its
 * set point, INSTAB the air left in a sealed chamber, DEHNUNG how much of
 * the buffer is spent, DELTA the xenon against the regulator's pressure,
 * LAST the load.
 */
export function gen2BoardReadings(
  state: ColumnPrepState,
  powered: boolean,
  /** The load as a share of the board's full scale, 0 to 1. */
  load: number,
) {
  return {
    heater: (state.temperature - AMBIENT) / (MAXIMUM - AMBIENT),
    spindle: spinShare(state),
    field: heat(state),
    'trim match': powered
      ? Math.max(0, 1 - Math.abs(state.setpoint - state.temperature) / 800)
      : 0,
    instability: isSealed(state) ? airShare(state) : 1,
    strain: 1 - state.supply / FULL_BOTTLE,
    delta: state.xenon / REGULATOR,
    load: Math.min(1, load),
  };
}
