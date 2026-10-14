import { createWorld } from './world';
import type { World, WorldEvent } from './world';

/**
 * The lab's failures, each designed: a cause an operator could deduce from
 * the procedure and the panels, and the steps that bring it about. Every
 * alarm window and every bad end has at least one scenario here, and
 * `scenarios.test.ts` replays them all on a fresh lab.
 */

export interface Move {
  /** A control's id, `wait`, or `trim to SOLL`. */
  id: string;
  /** The knob's detent, or the seconds waited. */
  setting?: number;
}

/** An alarm window's condition (`alarm.…`), or an event. */
export type Target = string;

export interface Scenario {
  name: string;
  /** Why it happens, as the operator could work it out. */
  cause: string;
  steps: Move[];
  /** What it reaches, at some point along the way. */
  reaches: Target[];
}

const STEP = 0.1;
/** The drive's randomness held still, so a scenario always plays the same. */
const STILL = () => 0.5;

const wait = (seconds: number): Move => ({ id: 'wait', setting: seconds });
const work = (id: string, setting?: number): Move => ({ id, setting });

/** Plant and column supplies on. */
const switchOn = [
  'plant.master',
  'column.isolator',
  'column.netz',
  'column.rocker',
].map((id) => work(id));

/** Group 1 of the cold start: seal, purge and charge the vessel. */
const prepareVessel: Move[] = [
  ...switchOn,
  work('column.SENKEN'),
  wait(6.5),
  work('column.SPANNEN'),
  work('column.XE EIN'),
  work('column.outlet'),
  wait(60),
  work('column.outlet'),
  wait(20),
  work('xenon.regulator', 0.5),
  work('recirculator.switch'),
  wait(2),
];

/**
 * Group 2: light the ferrocore. TRIMM goes first to where SOLL will be at
 * eight on both dials (0.2 + 0.35 × 0.8 + 0.3 × 0.8 = 0.72; the nearest
 * detent is 0.70), so the field never runs far from equilibrium.
 */
const lightFerrocore: Move[] = [
  work('board.NETZ'),
  wait(8),
  work('drive.trim', 0.7),
  work('drive.spindle', 0.8),
  work('drive.field', 0.8),
  wait(30),
];

export const coldStart: Move[] = [...prepareVessel, ...lightFerrocore];

/** Both dials to ten, past their redlines, TRIMM to SOLL, and AUX 1 in. */
const overdrive: Move[] = [
  work('drive.aux1'),
  work('drive.trim', 0.85),
  work('drive.spindle', 1),
  work('drive.field', 1),
];

export const scenarios: Scenario[] = [
  {
    name: 'Cold start',
    cause: 'The procedure, done in order, within the redlines.',
    steps: coldStart,
    reaches: ['plant:fully-operational'],
  },
  {
    name: 'Plant supply off',
    cause: 'HAUPTSCHALTER is open: the lab starts like this.',
    steps: [],
    reaches: ['alarm.NETZ AUS'],
  },
  {
    name: 'NETZ before the vessel',
    cause:
      'The drive breaker is closed with the head up, nothing purged and the recirculator off: the permit holds the heaters, and the vessel, flow and recirculator windows say why.',
    steps: [...switchOn, work('board.NETZ'), wait(1)],
    reaches: [
      'alarm.HEIZ. GESP.',
      'alarm.KOPF OFFEN',
      'alarm.XE FLUSS',
      'alarm.UMWÄLZUNG',
    ],
  },
  {
    name: 'NETZ before the purge',
    cause:
      'The vessel is sealed but still full of air, and has no xenon in it.',
    steps: [
      ...switchOn,
      work('column.SENKEN'),
      wait(6.5),
      work('column.SPANNEN'),
      work('board.NETZ'),
      wait(1),
    ],
    reaches: ['alarm.O2 KESSEL', 'alarm.XE DRUCK'],
  },
  {
    name: 'Inlet open to the room',
    cause:
      'XE EIN with the head up blows the column’s buffer straight out into the room.',
    steps: [...switchOn, work('column.XE EIN'), wait(80)],
    reaches: ['alarm.XE VORRAT'],
  },
  {
    name: 'Clamps released at full power',
    cause:
      'SPANNEN pressed again on a running core: the chamber opens to air, KERN LUFT warns, and the core burns out.',
    steps: [...coldStart, work('column.SPANNEN'), wait(5)],
    reaches: [
      'alarm.KERN LUFT',
      'alarm.KERN DEFEKT',
      'vessel:catastrophe:burnout',
    ],
  },
  {
    name: 'Field mistrimmed',
    cause:
      'TRIMM far from SOLL on a strong field: the field goes unstable, strain builds past half, and the breaker trips.',
    steps: [...coldStart, work('drive.trim', 0.2), wait(60)],
    reaches: ['alarm.INSTAB', 'alarm.STÖRUNG', 'alarm.DEHNUNG', 'rig:incident'],
  },
  {
    name: 'Overdriven',
    cause:
      'DREHZAHL and FELD at ten, past their redlines, with AUX 1 in: the load passes 6.5 kW, the drive and coils overheat, smoke and catch fire, the smoke sets off the fire alarm, and the sprinklers then soak the live drive, which shorts and wrecks the lab.',
    steps: [...coldStart, ...overdrive, wait(60)],
    reaches: [
      'alarm.SPINDEL ROT',
      'alarm.FELD ROT',
      'alarm.LAST',
      'alarm.RAUCH',
      'alarm.BRAND',
      'fire:fire',
      'fire:alarm',
      'fire:water',
      'fire:ruined-short',
    ],
  },
  {
    name: 'Burnt down',
    cause:
      'The sprinklers have already been spent (the call point was pressed with the drive off and the alarm never reset), so when the overdriven machine catches fire nothing puts it out, and after 45 s of fire the lab is lost.',
    steps: [
      ...prepareVessel,
      work('fire.Handfeuermelder'),
      wait(50),
      ...lightFerrocore,
      ...overdrive,
      wait(120),
    ],
    reaches: ['fire:ruined-fire'],
  },
  {
    name: 'Sprinklers on a live drive',
    cause:
      'The fire call point pressed with the drive breaker closed: the sprinklers soak live equipment and it shorts.',
    steps: [
      ...switchOn,
      work('board.NETZ'),
      work('fire.Handfeuermelder'),
      wait(10),
    ],
    reaches: ['alarm.BRAND', 'fire:ruined-short'],
  },
];

/**
 * Targets no scenario reaches, with the reason. Each is a design question
 * for the owner, not something to search for.
 */
export const undesigned: Record<Target, string> = {
  'vessel:catastrophe:flux-inductance':
    'The column model’s second failure needs a hot core on an empty buffer. In the lab the atmosphere permit drops the heaters as soon as the chamber falls below working pressure, so the core cools before the buffer can run dry.',
};

/** Every target the world has: its alarm windows and its bad ends. */
export const allTargets = (world: World = createWorld()): Target[] => [
  ...world.conditions.map((c) => c.id),
  'plant:fully-operational',
  'vessel:catastrophe:burnout',
  'vessel:catastrophe:flux-inductance',
  'rig:incident',
  'fire:alarm',
  'fire:water',
  'fire:fire',
  'fire:ruined-fire',
  'fire:ruined-short',
];

function targetsOf(world: World, events: WorldEvent[]): Target[] {
  const reached = world.conditions.filter((c) => c.value).map((c) => c.id);
  for (const e of events) {
    if (e.source === 'fire') reached.push(`fire:${e.event}`);
    else if (e.event.kind === 'catastrophe')
      reached.push(`vessel:catastrophe:${e.event.cause}`);
    else if (e.event.kind === 'incident') reached.push('rig:incident');
    else if (e.event.kind === 'fully-operational')
      reached.push('plant:fully-operational');
  }
  return reached;
}

/** Make a move; returns every target reached while it was made. */
export function makeMove(world: World, move: Move): Set<Target> {
  const reached = new Set<Target>();
  if (move.id === 'wait') {
    for (let t = 0; t < move.setting! - 1e-9; t += STEP)
      for (const target of targetsOf(world, world.tick(STEP, STILL)))
        reached.add(target);
    return reached;
  }
  if (move.id === 'trim to SOLL')
    world.work(
      'drive.trim',
      Math.round(world.read<number>('drive.idealTrim') * 20) / 20,
    );
  else world.work(move.id, move.setting);
  for (const target of targetsOf(world, [])) reached.add(target);
  return reached;
}

/** Play steps on a fresh lab; returns the lab and everything reached. */
export function play(steps: Move[]) {
  const world = createWorld();
  const reached = new Set<Target>(targetsOf(world, []));
  for (const move of steps)
    for (const t of makeMove(world, move)) reached.add(t);
  return { world, reached };
}
