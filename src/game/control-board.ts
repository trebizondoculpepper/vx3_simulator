import { idealTrim, deltaScore, WARNING_LEVEL, YALGETH_LIMIT } from './rig';
import type { RigState } from './rig';
import type { RackControls, ToggleId } from './rack-controls';
import type { SafetyTelltales } from './safety-telltales';
import { xenonReady } from './xenon-supply';
import {
  FULL_BOTTLE,
  PURGE_COMPLETE_VOLTS,
  WORKING_PRESSURE,
  isExposed,
  isSealed,
  isStarved,
  lambdaVolts,
  oxygenPercent,
} from './column-prep';
import type { ColumnPrepState } from './column-prep';
import { REDLINES } from './redlines';
import { ALARM_PPM } from './exhaust';

/**
 * The east wall's 1974 process board, rewired in 1986 as a remote station
 * for the VX3: its handles work the ferrocore drive, its grid, meters and
 * readouts repeat the drive, and the row of eighteen alarm windows across
 * its top is where the whole installation's warnings are shown.
 */

export type BoardAction =
  | { kind: 'mains' }
  | { kind: 'toggle'; id: ToggleId }
  | { kind: 'emergency-stop' }
  | { kind: 'acknowledge' }
  | { kind: 'lamp-test' }
  | { kind: 'purge' }
  | { kind: 'reset' };

export interface BoardHandle {
  label: string;
  action: BoardAction;
}

/** Six handles on each bay's ledge, bay by bay; the fifth of each is red. */
export const boardHandles: readonly BoardHandle[] = [
  // Bay 1, KREISLAUF: supply and drive.
  { label: 'NETZ', action: { kind: 'mains' } },
  { label: 'HT', action: { kind: 'toggle', id: 'ht' } },
  { label: 'LT', action: { kind: 'toggle', id: 'lt' } },
  { label: 'SPIN', action: { kind: 'toggle', id: 'spin' } },
  { label: 'NOT-AUS', action: { kind: 'emergency-stop' } },
  { label: 'QUITT', action: { kind: 'acknowledge' } },
  // Bay 2, KANALÜBERSICHT: the field.
  { label: 'H-B', action: { kind: 'toggle', id: 'hb' } },
  { label: 'BLATZ', action: { kind: 'toggle', id: 'blatz' } },
  { label: 'DÄMPF.', action: { kind: 'toggle', id: 'damp' } },
  { label: 'ERDE?', action: { kind: 'toggle', id: 'gnd' } },
  { label: 'SPÜLEN', action: { kind: 'purge' } },
  { label: 'L-TEST', action: { kind: 'lamp-test' } },
  // Bay 3, MESSWERTE: auxiliaries and crystals.
  { label: 'AUX 1', action: { kind: 'toggle', id: 'aux1' } },
  { label: 'AUX 2', action: { kind: 'toggle', id: 'aux2' } },
  { label: 'XTAL A', action: { kind: 'toggle', id: 'xtalA' } },
  { label: 'XTAL B', action: { kind: 'toggle', id: 'xtalB' } },
  { label: 'RÜCKS.', action: { kind: 'reset' } },
  { label: 'XTAL C', action: { kind: 'toggle', id: 'xtalC' } },
];

/** Which bay of the board, and what each warning window is. */
export interface Annunciator {
  label: string;
  /** Red for faults and danger; amber for conditions to put right. */
  colour: 'red' | 'amber';
}

/**
 * The eighteen alarm windows across the top of the board, six to a bay.
 * KREISLAUF: supply and drive. KANALÜBERSICHT: the column's vessel.
 * MESSWERTE: the xenon plant, strain and the room.
 */
export const annunciators: readonly Annunciator[] = [
  { label: 'NETZ AUS', colour: 'amber' },
  { label: 'ABGAS', colour: 'red' },
  { label: 'SPINDEL ROT', colour: 'red' },
  { label: 'FELD ROT', colour: 'red' },
  { label: 'LAST', colour: 'red' },
  { label: 'STÖRUNG', colour: 'red' },
  { label: 'KOPF OFFEN', colour: 'amber' },
  { label: 'O2 KESSEL', colour: 'amber' },
  { label: 'XE DRUCK', colour: 'amber' },
  { label: 'XE VORRAT', colour: 'amber' },
  { label: 'KERN LUFT', colour: 'red' },
  { label: 'KERN DEFEKT', colour: 'red' },
  { label: 'XE FLUSS', colour: 'amber' },
  { label: 'UMWÄLZUNG', colour: 'amber' },
  { label: 'DEHNUNG', colour: 'amber' },
  { label: 'INSTAB', colour: 'red' },
  { label: 'RAUCH', colour: 'red' },
  { label: 'BRAND', colour: 'red' },
];
/** The drive's STÖRUNG window, which an incident latches. */
export const DRIVE_FAULT = 5;

/** The eight channels of the FERNANZEIGE grid, one per row, as bargraphs. */
export const gridChannels = [
  'heater',
  'spindle',
  'field',
  'trim match',
  'instability',
  'strain',
  'delta',
  'load',
] as const;

/** Full scale of the load channel and meters, in kW. */
export const BOARD_FULL_LOAD_KW = 8;

/**
 * Alarm windows follow the usual ring-back-free sequence: a new alarm
 * flashes until acknowledged, then burns steady until its cause clears. An
 * alarm that clears before anyone acknowledges it keeps flashing.
 */
export type AlarmPhase = 'normal' | 'unacknowledged' | 'acknowledged';

export interface BoardState {
  /** One phase per alarm window, in `annunciators` order. */
  alarms: AlarmPhase[];
  /** Seconds left on the lamp test. */
  lampTest: number;
  /** Seconds each momentary handle stays turned after a press. */
  turned: number[];
  /** Seconds since the board was created, for the flasher. */
  clock: number;
}

export function createBoard(): BoardState {
  return {
    alarms: annunciators.map((): AlarmPhase => 'normal'),
    lampTest: 0,
    turned: boardHandles.map(() => 0),
    clock: 0,
  };
}

export interface BoardInputs {
  rig: RigState;
  controls: RackControls;
  telltales: SafetyTelltales;
  /** The xenon reaching the machine, SLPM. */
  xenonFlowSlpm?: number;
  plantPowered?: boolean;
  recirculatorWorking?: boolean;
  /** The column's vessel, once the second-generation VX3 is installed. */
  gen2?: { prep: ColumnPrepState };
  /** The room's exhaust concentration, ppm (src/game/exhaust.ts). */
  exhaustPpm?: number;
  /** The machine is smoking, and the fire alarm is sounding. */
  smoking?: boolean;
  burning?: boolean;
}

/** What each alarm window is warning of, now. */
export function warningConditions(inputs: BoardInputs): boolean[] {
  const { rig, telltales, gen2 } = inputs;
  const mains = rig.controls.mains;
  const prep = gen2?.prep;
  const sealed = prep ? isSealed(prep) : true;
  const purged = prep
    ? lambdaVolts(oxygenPercent(prep)) >= PURGE_COMPLETE_VOLTS
    : true;
  const flow = inputs.xenonFlowSlpm;
  return [
    inputs.plantPowered === false,
    (inputs.exhaustPpm ?? 0) > ALARM_PPM,
    rig.spindle > REDLINES.spindle.limit,
    rig.field > REDLINES.field.limit,
    telltales.powerKw > REDLINES.load.limit,
    mains && rig.instability > WARNING_LEVEL,
    Boolean(prep) && mains && !sealed,
    Boolean(prep) && mains && sealed && !purged,
    Boolean(prep) &&
      mains &&
      sealed &&
      (prep!.xenon < WORKING_PRESSURE || isStarved(prep!)),
    Boolean(prep) && prep!.supply < FULL_BOTTLE * 0.25,
    Boolean(prep) && isExposed(prep!),
    Boolean(prep) && prep!.failure !== null,
    mains && flow !== undefined && !xenonReady(flow),
    mains && inputs.recirculatorWorking === false,
    rig.strain > 0.5,
    rig.instability > WARNING_LEVEL,
    Boolean(inputs.smoking),
    Boolean(inputs.burning),
  ];
}

export function stepBoard(
  board: BoardState,
  inputs: BoardInputs,
  seconds: number,
) {
  board.clock += seconds;
  board.lampTest = Math.max(0, board.lampTest - seconds);
  board.turned = board.turned.map((left) => Math.max(0, left - seconds));
  warningConditions(inputs).forEach((active, i) => {
    if (active && board.alarms[i] === 'normal')
      board.alarms[i] = 'unacknowledged';
    if (!active && board.alarms[i] === 'acknowledged')
      board.alarms[i] = 'normal';
  });
}

/** QUITT: acknowledge every flashing alarm. Returns whether any were. */
export function acknowledge(board: BoardState, inputs: BoardInputs) {
  const active = warningConditions(inputs);
  let any = false;
  board.alarms.forEach((phase, i) => {
    if (phase !== 'unacknowledged') return;
    board.alarms[i] = active[i] ? 'acknowledged' : 'normal';
    any = true;
  });
  return any;
}

/** An incident latches the drive's STÖRUNG whatever the drive does now. */
export function latchFault(board: BoardState) {
  board.alarms[DRIVE_FAULT] = 'unacknowledged';
}

export function startLampTest(board: BoardState) {
  board.lampTest = 3;
}

/** Turn a momentary handle briefly; it springs back by itself. */
export function pressHandle(board: BoardState, index: number) {
  board.turned[index] = 0.35;
}

/** Whether a handle sits in its turned (on) position. */
export function handleTurned(
  board: BoardState,
  index: number,
  { controls }: BoardInputs,
) {
  const { action } = boardHandles[index];
  if (action.kind === 'mains') return controls.mains;
  if (action.kind === 'toggle') return controls.toggles[action.id];
  return board.turned[index] > 0;
}

/** Normalised readings shared by the grid, the meters and the readouts. */
export function boardReadings({
  rig,
  controls,
  telltales,
}: BoardInputs): Record<(typeof gridChannels)[number], number> {
  return {
    heater: rig.heater,
    spindle: rig.spindle,
    field: rig.field,
    'trim match': rig.controls.mains
      ? Math.max(0, 1 - Math.abs(controls.knobs.trim - idealTrim(rig)) * 4)
      : 0,
    instability: rig.instability,
    strain: rig.strain,
    delta: deltaScore(rig) / YALGETH_LIMIT,
    load: Math.min(1, telltales.powerKw / BOARD_FULL_LOAD_KW),
  };
}

export interface BoardView {
  /** The eighteen alarm windows, in `annunciators` order. */
  tiles: boolean[];
  /** The 8 × 8 grid, row by row: each row is a bargraph of its channel. */
  grid: boolean[];
  /** Three status lamps under each bay: BEREIT, EIN, STÖRUNG. */
  status: boolean[];
  /** Whether each handle is turned. */
  handles: boolean[];
}

export function boardView(board: BoardState, inputs: BoardInputs): BoardView {
  const { rig } = inputs;
  const test = board.lampTest > 0;
  const flashOn = board.clock % 0.8 < 0.4;
  const alarmLit = (phase: AlarmPhase) =>
    phase === 'acknowledged' || (phase === 'unacknowledged' && flashOn);
  const tiles = board.alarms.map(alarmLit);
  const readings = boardReadings(inputs);
  const grid = gridChannels.flatMap((channel) =>
    Array.from({ length: 8 }, (_, column) => readings[channel] > column / 8),
  );
  // Under each bay: BEREIT (drive on), EIN (a switch of that bay on), and
  // STÖRUNG (any of that bay's alarm windows lit).
  const status = [0, 1, 2].flatMap((bay) => [
    rig.controls.mains,
    boardHandles
      .slice(bay * 6, bay * 6 + 6)
      .some(
        (handle, i) =>
          handle.action.kind === 'toggle' &&
          handleTurned(board, bay * 6 + i, inputs),
      ),
    tiles.slice(bay * 6, bay * 6 + 6).some(Boolean),
  ]);
  return {
    tiles: test ? tiles.map(() => true) : tiles,
    grid: test ? Array(64).fill(true) : grid,
    status: test ? Array(9).fill(true) : status,
    handles: boardHandles.map((_, i) => handleTurned(board, i, inputs)),
  };
}
