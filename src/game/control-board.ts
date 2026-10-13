import { idealTrim, deltaScore, WARNING_LEVEL, YALGETH_LIMIT } from './rig';
import type { RigState } from './rig';
import type { RackControls, ToggleId } from './rack-controls';
import type { SafetyTelltales } from './safety-telltales';
import { xenonReady } from './xenon-supply';

/**
 * The east wall's 1974 process board, rewired in 1986 as a remote station
 * for the VX3: every handle works the rack, and every lamp, needle and
 * readout repeats what the rack is doing.
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

/** Annunciator tiles, repeated across the top of each bay. */
export const annunciatorLabels = [
  'NETZ',
  'PUMPE',
  'FLUSS',
  'DRUCK',
  'RESERVE',
  'STÖRUNG',
] as const;

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
type AlarmId = 'pressure' | 'fault';

export interface BoardState {
  alarms: Record<AlarmId, AlarmPhase>;
  /** Seconds left on the lamp test. */
  lampTest: number;
  /** Seconds each momentary handle stays turned after a press. */
  turned: number[];
  /** Seconds since the board was created, for the flasher. */
  clock: number;
}

export function createBoard(): BoardState {
  return {
    alarms: { pressure: 'normal', fault: 'normal' },
    lampTest: 0,
    turned: boardHandles.map(() => 0),
    clock: 0,
  };
}

export interface BoardInputs {
  rig: RigState;
  controls: RackControls;
  telltales: SafetyTelltales;
  xenonFlowSlpm?: number;
  plantPowered?: boolean;
  recirculatorWorking?: boolean;
}

const alarmConditions = ({ rig }: BoardInputs): Record<AlarmId, boolean> => ({
  pressure: rig.strain > 0.5,
  fault: rig.instability > WARNING_LEVEL,
});

export function stepBoard(
  board: BoardState,
  inputs: BoardInputs,
  seconds: number,
) {
  board.clock += seconds;
  board.lampTest = Math.max(0, board.lampTest - seconds);
  board.turned = board.turned.map((left) => Math.max(0, left - seconds));
  const active = alarmConditions(inputs);
  for (const id of ['pressure', 'fault'] as const) {
    if (active[id] && board.alarms[id] === 'normal')
      board.alarms[id] = 'unacknowledged';
    if (!active[id] && board.alarms[id] === 'acknowledged')
      board.alarms[id] = 'normal';
  }
}

/** QUITT: acknowledge every flashing alarm. Returns whether any were. */
export function acknowledge(board: BoardState, inputs: BoardInputs) {
  const active = alarmConditions(inputs);
  let any = false;
  for (const id of ['pressure', 'fault'] as const)
    if (board.alarms[id] === 'unacknowledged') {
      board.alarms[id] = active[id] ? 'acknowledged' : 'normal';
      any = true;
    }
  return any;
}

/** An incident latches STÖRUNG whatever the instability is now. */
export function latchFault(board: BoardState) {
  board.alarms.fault = 'unacknowledged';
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
export function boardReadings({ rig, controls, telltales }: BoardInputs) {
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
  } satisfies Record<(typeof gridChannels)[number], number>;
}

export interface BoardView {
  /** Annunciator tiles, six per bay, bay by bay. */
  tiles: boolean[];
  /** The 8 × 8 grid, row by row: each row is a bargraph of its channel. */
  grid: boolean[];
  /** Three status lamps under each bay: BEREIT, EIN, STÖRUNG. */
  status: boolean[];
  /** Whether each handle is turned. */
  handles: boolean[];
}

export function boardView(board: BoardState, inputs: BoardInputs): BoardView {
  const { rig, controls } = inputs;
  const test = board.lampTest > 0;
  const flashOn = board.clock % 0.8 < 0.4;
  const alarmLit = (phase: AlarmPhase) =>
    phase === 'acknowledged' || (phase === 'unacknowledged' && flashOn);
  const tileStates: boolean[] = [
    rig.controls.mains,
    rig.controls.mains && rig.spindle > 0.15,
    rig.controls.mains && rig.field > 0.1,
    alarmLit(board.alarms.pressure),
    rig.controls.mains && !controls.toggles.hb,
    alarmLit(board.alarms.fault),
  ];
  const readings = boardReadings(inputs);
  const grid = gridChannels.flatMap((channel) =>
    Array.from({ length: 8 }, (_, column) => readings[channel] > column / 8),
  );
  const anyAlarm =
    alarmLit(board.alarms.pressure) || alarmLit(board.alarms.fault);
  const status = [0, 1, 2].flatMap((bay) => [
    rig.controls.mains,
    boardHandles
      .slice(bay * 6, bay * 6 + 6)
      .some(
        (handle, i) =>
          handle.action.kind === 'toggle' &&
          handleTurned(board, bay * 6 + i, inputs),
      ),
    anyAlarm,
  ]);
  const tiles = test
    ? Array(18).fill(true)
    : [0, 1, 2].flatMap(() => tileStates);
  if (inputs.xenonFlowSlpm !== undefined)
    tiles[2] = test || (!xenonReady(inputs.xenonFlowSlpm) && flashOn);
  if (
    inputs.plantPowered !== undefined &&
    inputs.recirculatorWorking !== undefined
  )
    tiles[4] =
      test || (inputs.plantPowered && !inputs.recirculatorWorking && flashOn);
  return {
    tiles,
    grid: test ? Array(64).fill(true) : grid,
    status: test ? Array(9).fill(true) : status,
    handles: boardHandles.map((_, i) => handleTurned(board, i, inputs)),
  };
}
