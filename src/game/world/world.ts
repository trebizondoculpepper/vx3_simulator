import { createGraph } from './graph';
import type { Node, Writable } from './graph';
import {
  WARNING_LEVEL,
  YALGETH_LIMIT,
  deltaScore,
  idealTrim,
  stepRig,
} from '../rig';
import type { RigControls, RigEvent, RigState } from '../rig';
import {
  AIR_OXYGEN_PERCENT,
  FULL_BOTTLE,
  PURGE_COMPLETE_VOLTS,
  WORKING_PRESSURE,
  acknowledge as acknowledgeCore,
  airShare,
  coreStage,
  createColumnPrep,
  driveLift,
  isExposed,
  isStarved,
  lambdaVolts,
  setActivation,
  setClamped,
  stepColumnPrep,
} from '../column-prep';
import type {
  Catastrophe,
  ColumnPrepEvent,
  ColumnPrepState,
} from '../column-prep';
import {
  OXYGEN_ZERO_PERCENT,
  driveBrightness,
  driveTemperature,
} from '../cold-start';
import { atmospherePermit, feedFromLine, lineFlow } from '../gen2-wiring';
import {
  XENON_HAZARD_STRAIN_PER_SECOND,
  xenonHazard,
  xenonReady,
  xenonSourcePressure,
} from '../xenon-supply';
import {
  createSafetyTelltales,
  networkOutputs,
  stepTelltaleOutputs,
} from '../safety-telltales';
import { createRackControls } from '../rack-controls';
import type { RackControls } from '../rack-controls';
import { createOverheatState, stepOverheat } from '../overheat';
import type { OverheatState } from '../overheat';
import {
  createFireIncident,
  pressFireCall,
  resetFirePanel,
  stepFireIncident,
} from '../fire-incident';
import type { FireEvent, FireIncident } from '../fire-incident';
import {
  BOARD_FULL_LOAD_KW,
  DRIVE_FAULT,
  annunciators,
  boardHandles,
  gridChannels,
} from '../control-board';
import type { AlarmPhase } from '../control-board';
import { REDLINES } from '../redlines';
import {
  FERROCORE_MAX_ANGULAR_VELOCITY,
  anomalyStage,
  ferrocoreActivity,
  ferrocoreAngularVelocity,
  ferrocoresOperational,
} from '../ferrocore-anomaly';
import { coreProjection } from '../core-projection';

/**
 * The laboratory as one directed graph (see `graph.ts`): the plant room's
 * supply, the xenon bank and recirculator, the column's vessel and its
 * ferrocore drive, the wall meters, overheating and fire, and the east
 * board, wired as the lab wires them in `start-scene.ts`. The physics is
 * the existing models' (`stepRig`, `stepColumnPrep`, `stepOverheat` and so
 * on); what is new is that every link between them is a declared edge, and
 * every lamp, needle and readout in the room is an output vertex that is
 * recomputed only when something it shows has changed.
 *
 * Pure logic, no DOM or Three.js. Not yet wired into the scene.
 */

/** The core's critical temperature: reached, it catches fire, kelvin. */
export const CRITICAL_KELVIN = 5500;
/** How far past its set point an overheating drive takes the core, kelvin. */
const OVERHEAT_KELVIN = 2600;

/**
 * How far the drive has overheated, 0 to 1: from when it starts to smoke
 * to when it would ignite by its own heat.
 */
export function overheatShare(state: OverheatState) {
  const hottest = Math.max(...Object.values(state.heat));
  return Math.max(0, Math.min(1, (hottest - 0.35) / (0.9 - 0.35)));
}

/** How long the lamp test flashes every lamp, seconds. */
export const LAMP_TEST_SECONDS = 10;

export type WorldEvent =
  | { source: 'vessel'; event: ColumnPrepEvent }
  | { source: 'rig'; event: RigEvent }
  | { source: 'fire'; event: FireEvent }
  | { source: 'breaker'; event: { kind: 'dropped'; cause: 'plant' | 'column' } }
  | { source: 'plant'; event: { kind: 'fully-operational' } };

/** One thing an operator can work, for scripts and the explorer. */
export interface Control {
  id: string;
  /** Where it is in the lab, and what it is called there. */
  where: string;
  kind: 'switch' | 'knob' | 'button';
  /** The settings a knob clicks between. */
  detents?: readonly number[];
}

const detents = (steps: number) =>
  Array.from({ length: steps + 1 }, (_, i) => i / steps);
/** The drive's dials have twenty detents; the plant's knobs ten. */
const DIAL = detents(20);
const KNOB = detents(10);
/** A needle's travel, in the steps the eye can tell apart. */
const NEEDLE_STEPS = 500;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const needle = (share: number) => Math.round(clamp01(share) * NEEDLE_STEPS);

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) =>
    deepEqual(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k],
    ),
  );
}

export function createWorld() {
  const g = createGraph();
  const events: WorldEvent[] = [];
  const factory = createRackControls();
  const fresh = createColumnPrep();

  // ---- Supplies ------------------------------------------------------------

  const master = g.input('plant.master', false, {
    where: 'Plant room: HAUPTSCHALTER',
  });
  const isolator = g.input('column.isolator', false, {
    where: 'West wall: column supply isolator',
  });
  const columnNetz = g.input('column.netz', false, {
    where: 'Column A11 VERSORGUNG: NETZ button',
  });
  const rocker = g.input('column.rocker', false, {
    where: 'Column B13 VERSORGUNG: mains rocker',
  });
  const recirculatorSwitch = g.input('recirculator.switch', false, {
    where: 'Plant room: recirculator KREISLAUF switch',
  });
  const regulator = g.input('xenon.regulator', 0, {
    where: 'Plant room: cylinder regulator knob; column A7: XE-REGLER − and +',
  });

  // The column's equipment runs on the rectifier, fed through HAUPTSCHALTER.
  const plantPowered = g.derive('plant.powered', [master], (on) => on);
  const columnRunning = g.derive(
    'column.running',
    [plantPowered, isolator, columnNetz, rocker],
    (plant, iso, netz, rock) => plant && iso && netz && rock,
  );
  // The recirculator's pump is on the mains, which is always live.
  const recirculatorWorking = g.derive(
    'recirculator.working',
    [recirculatorSwitch],
    (on) => on,
  );

  // ---- Xenon bank: the catalogue's xenon-supply and flow-gauge lags --------

  const xenonPressure = g.state('xenon.pressure', 0, {
    note: 'delivered pressure, share of 4 bar',
  });
  const xenonFlow = g.state('xenon.flow', 0, {
    note: 'flow at the gauge, share of 10 SLPM',
  });
  const bank = g.state('xenon.contents', 0.92, {
    note: 'share of the bank left',
  });
  const regulatorSlpm = g.derive('xenon.flowSlpm', [xenonFlow], (f) => f * 10);
  const flow = g.derive(
    'line.flowSlpm',
    [regulatorSlpm, recirculatorWorking],
    lineFlow,
  );

  // ---- The vessel ------------------------------------------------------------

  const lift = g.state('vessel.lift', fresh.lift);
  const liftTarget = g.state<0 | 1>('vessel.liftTarget', fresh.liftTarget);
  const clamped = g.state('vessel.clamped', fresh.clamped);
  const inletOpen = g.state('vessel.inletOpen', fresh.inletOpen);
  const outletOpen = g.state('vessel.outletOpen', fresh.outletOpen);
  const air = g.state('vessel.air', fresh.air);
  const xenon = g.state('vessel.xenon', fresh.xenon);
  const supply = g.state('vessel.supply', fresh.supply, {
    note: 'the column buffer, bar of chamber gas',
  });
  const temperature = g.state('vessel.temperature', fresh.temperature);
  const failure = g.state<Catastrophe | null>('vessel.failure', null);
  const spinRate = g.state('vessel.spinRate', fresh.spinRate);
  const spinAngle = g.state('vessel.spinAngle', fresh.spinAngle);

  const prep = (parts: Partial<ColumnPrepState>): ColumnPrepState => ({
    ...fresh,
    ...parts,
  });
  const sealed = g.derive(
    'vessel.sealed',
    [clamped, lift],
    (c, l) => c && l === 0,
  );
  const chamber = g.derive('vessel.pressure', [air, xenon], (a, x) => a + x);
  const airFraction = g.derive('vessel.airShare', [air, xenon], (a, x) =>
    airShare(prep({ air: a, xenon: x })),
  );
  const oxygen = g.derive('vessel.oxygen', [sealed, airFraction], (s, share) =>
    s ? share * AIR_OXYGEN_PERCENT : AIR_OXYGEN_PERCENT,
  );
  const lambda = g.derive('vessel.lambdaVolts', [oxygen], lambdaVolts);
  const purged = g.derive(
    'vessel.purged',
    [lambda],
    (v) => v >= PURGE_COMPLETE_VOLTS,
  );
  const stage = g.derive('vessel.stage', [failure, temperature], (f, t) =>
    coreStage(prep({ failure: f, temperature: t })),
  );
  const exposed = g.derive(
    'vessel.exposed',
    [failure, temperature, clamped, lift, air, xenon],
    (f, t, c, l, a, x) =>
      isExposed(
        prep({
          failure: f,
          temperature: t,
          clamped: c,
          lift: l,
          air: a,
          xenon: x,
        }),
      ),
  );
  const starved = g.derive(
    'vessel.starved',
    [failure, temperature, xenon],
    (f, t, x) => isStarved(prep({ failure: f, temperature: t, xenon: x })),
  );
  const permit = g.derive(
    'drive.permit',
    [failure, clamped, lift, air, xenon, recirculatorWorking],
    (f, c, l, a, x, r) =>
      atmospherePermit(
        prep({ failure: f, clamped: c, lift: l, air: a, xenon: x }),
        r,
      ),
  );

  // ---- The drive's controls ------------------------------------------------

  const toggle = (id: string, label: string, where: string) =>
    g.input(
      `drive.${id}`,
      factory.toggles[id as keyof RackControls['toggles']],
      {
        where: `${where}: ${label}`,
      },
    );
  const ht = toggle('ht', 'HT', 'Column HV FIL and east board bay 1');
  const lt = toggle('lt', 'LT', 'Column HV FIL and east board bay 1');
  const spin = toggle('spin', 'SPIN handle', 'East board bay 1');
  const hb = toggle('hb', 'H-B handle', 'East board bay 2');
  const blatz = toggle('blatz', 'BLATZ handle', 'East board bay 2');
  const damp = toggle('damp', 'DÄMPF. handle', 'East board bay 2');
  const gnd = toggle('gnd', 'ERDE? handle', 'East board bay 2');
  const aux1 = toggle('aux1', 'AUX 1 handle', 'East board bay 3');
  const aux2 = toggle('aux2', 'AUX 2 handle', 'East board bay 3');
  const xtalA = toggle('xtalA', 'XTAL A handle', 'East board bay 3');
  const xtalB = toggle('xtalB', 'XTAL B handle', 'East board bay 3');
  const xtalC = toggle('xtalC', 'XTAL C handle', 'East board bay 3');
  const knob = (id: keyof RackControls['knobs'], where: string) =>
    g.input(`drive.${id}`, factory.knobs[id], { where });
  const spindleKnob = knob('spindle', 'Column: DREHZAHL knob');
  const fieldKnob = knob('field', 'Column: FELD knob');
  const trim = knob('trim', 'Column: TRIMM knob');
  const ratio = knob('ratio', 'Column: UNTERSETZUNG knob');
  const band = knob('insulationBand', 'Column B9: SCHWEBUNG band selector');
  // The first rig's rack set these; nothing in the lab does now.
  const engage = g.fixed(
    'drive.governorEngage',
    factory.toggles.governorEngage,
  );
  const governor = g.fixed('drive.governor', factory.knobs.governor);
  const response = g.fixed('drive.governorRatio', factory.knobs.governorRatio);
  const plasmaOn = g.fixed('drive.plasmaOn', factory.toggles.plasmaOn);
  const excite = g.fixed('drive.plasmaExcite', factory.knobs.plasmaExcite);
  const plasmaNull = g.fixed('drive.plasmaNull', factory.knobs.plasmaNull);
  const ampGain = g.fixed('drive.ampGain', factory.knobs.ampGain);
  const chromoAux = g.fixed('drive.chromoAux', factory.toggles.chromoAux);

  const mains = g.state('drive.mains', false, {
    note: 'the drive breaker, closed by NETZ',
  });
  const rigControls = g.derive(
    'drive.controls',
    [
      mains,
      permit,
      spin,
      spindleKnob,
      hb,
      fieldKnob,
      trim,
      engage,
      governor,
      response,
      plasmaOn,
      excite,
      plasmaNull,
      ratio,
      gnd,
      band,
    ],
    (
      m,
      p,
      sp,
      s,
      h,
      f,
      t,
      e,
      gov,
      r,
      po,
      ex,
      nul,
      rat,
      gr,
      b,
    ): RigControls => ({
      mains: m,
      permit: p,
      // applyRack: SPIN and H-B gate their dials, and so on.
      spindle: sp ? s : 0,
      field: h ? f : 0,
      trim: t,
      governor: e ? gov : 1,
      governorResponse: r,
      plasmaExcitation: po ? ex : 0,
      plasmaNull: nul,
      ratio: rat,
      grounded: gr,
      band: b,
    }),
    { equals: deepEqual },
  );

  const heater = g.state('rig.heater', 0);
  const spindle = g.state('rig.spindle', 0);
  const field = g.state('rig.field', 0);
  const drift = g.state('rig.drift', 0);
  const instability = g.state('rig.instability', 0);
  const strain = g.state('rig.strain', 0);
  const strainFrom = g.state(
    'rig.strainFrom',
    { field: 0, hazard: 0 },
    { equals: deepEqual },
  );
  const incidents = g.state('rig.incidents', 0);

  const rigOf = (parts: Partial<RigState>): RigState => ({
    controls: rigControls.peek(),
    heater: 0,
    spindle: 0,
    field: 0,
    drift: 0,
    instability: 0,
    strain: 0,
    strainFrom: { field: 0, hazard: 0 },
    incidents: 0,
    ...parts,
  });
  const activity = g.derive('ferrocore.activity', [spindle, field], (s, f) =>
    ferrocoreActivity(rigOf({ spindle: s, field: f })),
  );
  const ideal = g.derive(
    'drive.idealTrim',
    [rigControls, spindle, field, drift],
    (c, s, f, d) =>
      idealTrim(rigOf({ controls: c, spindle: s, field: f, drift: d })),
  );
  const delta = g.derive('drive.delta', [field, instability], (f, i) =>
    deltaScore(rigOf({ field: f, instability: i })),
  );
  const hazard = g.derive(
    'drive.xenonHazard',
    [mains, spindle, flow],
    (m, s, f) => m && xenonHazard(s, f),
  );
  const operational = g.derive(
    'ferrocore.operational',
    [rigControls, heater, spindle, flow],
    (c, h, s, f) =>
      ferrocoresOperational(rigOf({ controls: c, heater: h, spindle: s }), f),
  );
  const omega = g.derive('ferrocore.omega', [spindle], (s) =>
    ferrocoreAngularVelocity(rigOf({ spindle: s })),
  );

  // ---- Wall meters: load, energy and the dilation crystal ------------------

  const desk = (parts: Partial<RackControls['toggles']>, gain: number) => ({
    ...factory,
    toggles: { ...factory.toggles, ...parts },
    knobs: { ...factory.knobs, ampGain: gain },
  });
  const powerKw = g.derive(
    'telltales.powerKw',
    [mains, ht, heater, lt, spindle, field, aux1, chromoAux, aux2, ampGain],
    (m, h, heat, l, s, f, a1, ca, a2, gain) =>
      networkOutputs(
        rigOf({
          controls: { ...rigControls.peek(), mains: m },
          heater: heat,
          spindle: s,
          field: f,
        }),
        desk({ ht: h, lt: l, aux1: a1, chromoAux: ca, aux2: a2 }, gain),
      ).powerKw,
  );
  const dilation = g.derive(
    'telltales.dilation',
    [rigControls, heater, spindle, field, strain, flow, damp],
    (c, h, s, f, st, fl, d) =>
      networkOutputs(
        rigOf({ controls: c, heater: h, spindle: s, field: f, strain: st }),
        desk({ damp: d }, factory.knobs.ampGain),
        fl,
      ).dilationActivity,
  );
  const blank = createSafetyTelltales();
  const energyKwh = g.state('telltales.energyKwh', blank.energyKwh);
  const crystalPulse = g.state('telltales.crystalPulse', blank.crystalPulse);
  const pulsePhase = g.state('telltales.pulsePhase', blank.pulsePhase);

  // ---- Overheating and fire ----------------------------------------------

  const overheat = g.state<OverheatState>('overheat', createOverheatState(), {
    equals: deepEqual,
  });
  const fire = g.state<FireIncident>('fire', createFireIncident(), {
    equals: deepEqual,
  });
  const roomSmoke = g.derive('room.smokeLevel', [overheat], (o) => o.roomSmoke);
  const fireAlarm = g.derive('fire.alarm', [fire], (f) => f.alarm);
  const ruined = g.derive('fire.ruined', [fire], (f) => f.ruinCause);
  g.output(
    'fire.phase',
    [fire],
    (f) =>
      f.extinguished
        ? 'extinguished'
        : Object.values(f.burning).some(Boolean)
          ? 'burning'
          : 'normal',
    { where: 'Developer room: fire condition and aftermath' },
  );

  // ---- The east board's alarm windows ------------------------------------

  const condition = (
    label: string,
    deps: readonly Node<unknown>[],
    fn: () => boolean,
  ) => g.derive(`alarm.${label}`, deps, fn);
  const conditions: Node<boolean>[] = [
    condition('NETZ AUS', [plantPowered], () => !plantPowered.value),
    condition(
      'HEIZ. GESP.',
      [mains, permit],
      () => mains.value && !permit.value,
    ),
    condition(
      'SPINDEL ROT',
      [spindle],
      () => spindle.value > REDLINES.spindle.limit,
    ),
    condition('FELD ROT', [field], () => field.value > REDLINES.field.limit),
    condition('LAST', [powerKw], () => powerKw.value > REDLINES.load.limit),
    condition(
      'STÖRUNG',
      [mains, instability],
      () => mains.value && instability.value > WARNING_LEVEL,
    ),
    condition(
      'KOPF OFFEN',
      [mains, sealed],
      () => mains.value && !sealed.value,
    ),
    condition(
      'O2 KESSEL',
      [mains, sealed, purged],
      () => mains.value && sealed.value && !purged.value,
    ),
    condition(
      'XE DRUCK',
      [mains, sealed, xenon, starved],
      () =>
        mains.value &&
        sealed.value &&
        (xenon.value < WORKING_PRESSURE || starved.value),
    ),
    condition('XE VORRAT', [supply], () => supply.value < FULL_BOTTLE * 0.25),
    condition('KERN LUFT', [exposed], () => exposed.value),
    condition('KERN DEFEKT', [failure], () => failure.value !== null),
    condition(
      'XE FLUSS',
      [mains, flow],
      () => mains.value && !xenonReady(flow.value),
    ),
    condition(
      'UMWÄLZUNG',
      [mains, recirculatorWorking],
      () => mains.value && !recirculatorWorking.value,
    ),
    condition('DEHNUNG', [strain], () => strain.value > 0.5),
    condition('INSTAB', [instability], () => instability.value > WARNING_LEVEL),
    condition('RAUCH', [roomSmoke], () => roomSmoke.value > 0.05),
    condition('BRAND', [fireAlarm], () => fireAlarm.value),
  ];

  const alarms = g.state<AlarmPhase[]>(
    'board.alarms',
    annunciators.map((): AlarmPhase => 'normal'),
    { equals: deepEqual },
  );
  const lampTest = g.state('board.lampTest', 0);
  const clock = g.state('board.clock', 0);
  const turned = g.state(
    'board.turned',
    boardHandles.map(() => 0),
    { equals: deepEqual },
  );
  const latchFault = () => {
    const next = [...alarms.peek()];
    next[DRIVE_FAULT] = 'unacknowledged';
    alarms.set(next);
  };

  const fullyOperational = g.derive(
    'plant.fullyOperational',
    [operational, sealed, outletOpen, oxygen, stage, activity],
    (op, s, out, o2, st, act) =>
      op &&
      s &&
      !out &&
      o2 < OXYGEN_ZERO_PERCENT &&
      st === 'full' &&
      anomalyStage(act) === 2,
  );

  // ---- Processes, in the order the lab's frame runs them ------------------

  g.process('breaker', [mains, plantPowered, columnRunning], [mains], () => {
    if (!mains.peek()) return;
    if (plantPowered.peek() && columnRunning.peek()) return;
    mains.set(false);
    events.push({
      source: 'breaker',
      event: {
        kind: 'dropped',
        cause: plantPowered.peek() ? 'column' : 'plant',
      },
    });
  });

  const lag = (value: number, target: number, dt: number, seconds: number) =>
    value + (clamp01(target) - value) * (1 - Math.exp(-dt / seconds));
  g.process(
    'xenon bank',
    [regulator, xenonPressure, xenonFlow, bank],
    [xenonPressure, xenonFlow, bank],
    (dt) => {
      // Both targets come from the previous step's values, as in rig-model.
      const pressure = xenonPressure.peek();
      const nextFlow = lag(xenonFlow.peek(), pressure, dt, 0.6);
      xenonPressure.set(lag(pressure, regulator.peek(), dt, 0.6));
      xenonFlow.set(nextFlow);
      bank.set(Math.max(0, bank.peek() - (nextFlow * 10 * dt) / 60 / 3000));
    },
  );

  g.process('xenon line', [flow, supply], [supply], (dt) => {
    const state = prep({ supply: supply.peek() });
    feedFromLine(state, flow.peek(), dt);
    supply.set(state.supply);
  });

  const vesselStates = [
    lift,
    liftTarget,
    clamped,
    air,
    xenon,
    supply,
    temperature,
    failure,
    spinRate,
    spinAngle,
  ] as const;
  const readVessel = (): ColumnPrepState =>
    prep({
      lift: lift.peek(),
      liftTarget: liftTarget.peek(),
      clamped: clamped.peek(),
      inletOpen: inletOpen.peek(),
      outletOpen: outletOpen.peek(),
      air: air.peek(),
      xenon: xenon.peek(),
      supply: supply.peek(),
      temperature: temperature.peek(),
      failure: failure.peek(),
      spinRate: spinRate.peek(),
      spinAngle: spinAngle.peek(),
    });
  const writeVessel = (state: ColumnPrepState) => {
    lift.set(state.lift);
    liftTarget.set(state.liftTarget);
    clamped.set(state.clamped);
    air.set(state.air);
    xenon.set(state.xenon);
    supply.set(state.supply);
    temperature.set(state.temperature);
    failure.set(state.failure);
    spinRate.set(state.spinRate);
    spinAngle.set(state.spinAngle);
  };
  g.process(
    'vessel',
    [
      ...vesselStates,
      inletOpen,
      outletOpen,
      mains,
      columnRunning,
      heater,
      activity,
      field,
      overheat,
    ],
    [...vesselStates, mains],
    (dt) => {
      const state = readVessel();
      // The drive heats the core: warm heaters to a glow, activity beyond.
      const rig = rigOf({
        heater: heater.peek(),
        spindle: spindle.peek(),
        field: field.peek(),
      });
      setActivation(state, driveTemperature(rig));
      // Overheating drives the core past full power towards critical.
      state.setpoint += OVERHEAT_KELVIN * overheatShare(overheat.peek());
      state.brightness = driveBrightness(rig);
      for (const event of stepColumnPrep(state, dt, {
        powered: mains.peek(),
        ramsPowered: columnRunning.peek(),
      })) {
        events.push({ source: 'vessel', event });
        // A ruined core takes the drive's breaker with it.
        if (event.kind === 'catastrophe') mains.set(false);
      }
      writeVessel(state);
    },
  );

  const rigStates = [
    heater,
    spindle,
    field,
    drift,
    instability,
    strain,
    strainFrom,
    incidents,
  ] as const;
  g.process(
    'drive',
    [rigControls, ...rigStates, hazard],
    [...rigStates, mains, alarms],
    (dt, random) => {
      const rig = rigOf({
        controls: { ...rigControls.peek() },
        heater: heater.peek(),
        spindle: spindle.peek(),
        field: field.peek(),
        drift: drift.peek(),
        instability: instability.peek(),
        strain: strain.peek(),
        strainFrom: { ...strainFrom.peek() },
        incidents: incidents.peek(),
      });
      const happened = stepRig(
        rig,
        dt,
        random,
        hazard.peek() ? XENON_HAZARD_STRAIN_PER_SECOND : 0,
      );
      heater.set(rig.heater);
      spindle.set(rig.spindle);
      field.set(rig.field);
      drift.set(rig.drift);
      instability.set(rig.instability);
      strain.set(rig.strain);
      strainFrom.set(rig.strainFrom);
      incidents.set(rig.incidents);
      if (!rig.controls.mains) mains.set(false);
      for (const event of happened) {
        events.push({ source: 'rig', event });
        if (event.kind === 'incident') latchFault();
      }
    },
    { spontaneous: true },
  );

  g.process(
    'wall meters',
    [powerKw, dilation, energyKwh, crystalPulse, pulsePhase],
    [energyKwh, crystalPulse, pulsePhase],
    (dt) => {
      const state = {
        ...blank,
        energyKwh: energyKwh.peek(),
        crystalPulse: crystalPulse.peek(),
        pulsePhase: pulsePhase.peek(),
      };
      stepTelltaleOutputs(
        state,
        { powerKw: powerKw.peek(), dilationActivity: dilation.peek() },
        dt,
      );
      energyKwh.set(state.energyKwh);
      crystalPulse.set(state.crystalPulse);
      pulsePhase.set(state.pulsePhase);
    },
  );

  g.process(
    'overheating',
    [overheat, spindle, field, powerKw],
    [overheat],
    (dt) => {
      const state = structuredClone(overheat.peek());
      stepOverheat(
        state,
        { spindle: spindle.peek(), field: field.peek(), load: powerKw.peek() },
        dt,
      );
      overheat.set(state);
    },
  );

  /** Fire is terminal: the breaker drops, the alarm sounds, it is ruined. */
  const igniteRuin = (state: FireIncident) => {
    if (state.ruinCause !== null) return;
    if (!state.alarm) {
      state.alarm = true;
      events.push({ source: 'fire', event: 'alarm' });
      latchFault();
    }
    state.ruinCause = 'fire';
    if (!state.water && !state.sprinklerSpent) {
      state.water = true;
      state.waterAge = 0;
      events.push({ source: 'fire', event: 'water' });
    }
    events.push({ source: 'fire', event: 'ruined-fire' });
    mains.set(false);
  };
  // Overheating is recoverable; fire is not. The moment the machine
  // catches fire its breaker drops, the fire alarm sounds and the lab is
  // ruined: it smoulders on, and nothing can be worked again.
  g.process(
    'fire',
    [fire, overheat, mains, temperature],
    [fire, mains, alarms, master, isolator, columnNetz, rocker, ht, lt],
    (dt) => {
      const state = structuredClone(fire.peek());
      // A core driven to its critical temperature catches fire, whatever
      // the drive's own heat says.
      if (
        state.ruinCause === null &&
        temperature.peek() >= CRITICAL_KELVIN &&
        !Object.values(state.burning).some(Boolean)
      ) {
        state.burning.spindle = true;
        events.push({ source: 'fire', event: 'fire' });
        igniteRuin(state);
      }
      for (const event of stepFireIncident(
        state,
        overheat.peek(),
        mains.peek(),
        dt,
      )) {
        events.push({ source: 'fire', event });
        if (event === 'alarm') latchFault();
        if (event === 'ruined-fire' || event === 'ruined-short')
          mains.set(false);
        if (event === 'fire') igniteRuin(state);
      }
      if (
        state.ruinCause !== null &&
        !state.extinguished &&
        state.ruinAge >= 8
      ) {
        state.extinguished = true;
        state.burning.spindle = false;
        state.burning.field = false;
        state.burning.load = false;
        master.set(false);
        isolator.set(false);
        columnNetz.set(false);
        rocker.set(false);
        ht.set(false);
        lt.set(false);
        events.push({ source: 'fire', event: 'extinguished' });
      }
      fire.set(state);
    },
  );

  g.process(
    'board',
    [...conditions, alarms, lampTest, clock, turned],
    [alarms, lampTest, clock, turned],
    (dt) => {
      clock.set(clock.peek() + dt);
      lampTest.set(Math.max(0, lampTest.peek() - dt));
      turned.set(turned.peek().map((left) => Math.max(0, left - dt)));
      // A new alarm flashes until acknowledged, then burns steady until its
      // cause clears.
      alarms.set(
        alarms.peek().map((phase, i) => {
          const active = conditions[i].peek();
          if (active && phase === 'normal') return 'unacknowledged';
          if (!active && phase === 'acknowledged') return 'normal';
          return phase;
        }),
      );
    },
    { spontaneous: true },
  );

  // ---- Operator actions ----------------------------------------------------

  const refused = () => ruined.peek() !== null;
  const handle = (label: string) =>
    boardHandles.findIndex((h) => h.label === label);
  const press = (label: string) => {
    const next = [...turned.peek()];
    next[handle(label)] = 0.35;
    turned.set(next);
  };
  const lower = g.action(
    'column.SENKEN',
    [columnRunning, clamped],
    [liftTarget],
    () => {
      if (refused() || !columnRunning.peek()) return false;
      const state = readVessel();
      if (!driveLift(state, 0)) return false;
      liftTarget.set(state.liftTarget);
      return true;
    },
    'Column B11 SÄULE: SENKEN button',
  );
  const raise = g.action(
    'column.HEBEN',
    [columnRunning, clamped],
    [liftTarget],
    () => {
      if (refused() || !columnRunning.peek()) return false;
      const state = readVessel();
      if (!driveLift(state, 1)) return false;
      liftTarget.set(state.liftTarget);
      return true;
    },
    'Column B11 SÄULE: HEBEN button',
  );
  const clamps = g.action(
    'column.SPANNEN',
    [columnRunning, lift, clamped],
    [clamped, liftTarget],
    () => {
      if (refused() || !columnRunning.peek()) return false;
      const state = readVessel();
      if (!setClamped(state, !state.clamped)) return false;
      clamped.set(state.clamped);
      liftTarget.set(state.liftTarget);
      return true;
    },
    'Column B11 SÄULE: SPANNEN button',
  );
  const inlet = g.action(
    'column.XE EIN',
    [columnRunning],
    [inletOpen],
    () => {
      // The inlet is a solenoid valve: it needs the supply to move.
      if (refused() || !columnRunning.peek()) return false;
      inletOpen.set(!inletOpen.peek());
      return true;
    },
    'Column B11 SÄULE: XE EIN button',
  );
  const flipOutlet = () => outletOpen.set(!outletOpen.peek());
  const outletWheel = g.action(
    'column.outlet',
    [],
    [outletOpen],
    () => {
      if (refused()) return false;
      flipOutlet();
      return true;
    },
    'Column beam tube: outlet valve handwheel',
  );
  const purge = g.action(
    'board.SPÜLEN',
    [],
    [outletOpen, turned],
    () => {
      if (refused()) return false;
      press('SPÜLEN');
      flipOutlet();
      return true;
    },
    'East board bay 2: SPÜLEN handle',
  );
  const freshCore = () => {
    const state = readVessel();
    acknowledgeCore(state);
    failure.set(state.failure);
    temperature.set(state.temperature);
    supply.set(state.supply);
  };
  const columnQuitt = g.action(
    'column.QUITT',
    [failure],
    [failure, temperature, supply],
    () => {
      if (refused()) return false;
      freshCore();
      return true;
    },
    'Column B11 SÄULE: QUITT button',
  );
  const reset = g.action(
    'board.RÜCKS.',
    [failure],
    [failure, temperature, supply, turned],
    () => {
      if (refused()) return false;
      press('RÜCKS.');
      freshCore();
      return true;
    },
    'East board bay 3: RÜCKS. handle',
  );
  const netz = g.action(
    'board.NETZ',
    [mains, plantPowered, columnRunning],
    [mains],
    () => {
      if (refused()) return false;
      if (mains.peek()) {
        mains.set(false);
        return true;
      }
      // The lever springs back open unless the plant and the column are on.
      if (!plantPowered.peek() || !columnRunning.peek()) return false;
      mains.set(true);
      return true;
    },
    'East board bay 1: NETZ handle',
  );
  const trip = (id: string, where: string, label?: string) =>
    g.action(
      id,
      [],
      label ? [mains, turned] : [mains],
      () => {
        if (refused()) return false;
        if (label) press(label);
        mains.set(false);
        return true;
      },
      where,
    );
  const notAus = trip(
    'board.NOT-AUS',
    'East board bay 1: NOT-AUS handle',
    'NOT-AUS',
  );
  const columnAus = trip('column.AUS', 'Column: AUS button');
  const strahlStop = trip(
    'column.STRAHL STOP',
    'Column A9 STRAHL: STRAHL STOP button',
  );
  const quitt = g.action(
    'board.QUITT',
    conditions,
    [alarms, turned],
    () => {
      if (refused()) return false;
      press('QUITT');
      let any = false;
      alarms.set(
        alarms.peek().map((phase, i) => {
          if (phase !== 'unacknowledged') return phase;
          any = true;
          return conditions[i].peek() ? 'acknowledged' : 'normal';
        }),
      );
      return any;
    },
    'East board bay 1: QUITT handle',
  );
  const lampCheck = g.action(
    'board.L-TEST',
    [],
    [lampTest, turned],
    () => {
      if (refused()) return false;
      press('L-TEST');
      lampTest.set(LAMP_TEST_SECONDS);
      return true;
    },
    'East board bay 2: L-TEST handle',
  );
  const ignite = g.action(
    'column.ZÜND',
    [],
    [ht, lt],
    () => {
      if (refused()) return false;
      ht.set(true);
      lt.set(true);
      return true;
    },
    'Column HV FIL: ZÜND button',
  );
  const fireCall = g.action(
    'fire.Handfeuermelder',
    [fire],
    [fire, alarms],
    () => {
      if (refused()) return false;
      const state = structuredClone(fire.peek());
      if (!pressFireCall(state)) return false;
      fire.set(state);
      latchFault();
      return true;
    },
    'Corridor: Handfeuermelder (fire call point)',
  );
  const fireReset = g.action(
    'fire.RÜCKSTELLEN',
    [fire, roomSmoke],
    [fire],
    () => {
      if (refused()) return false;
      const state = structuredClone(fire.peek());
      if (!resetFirePanel(state, roomSmoke.peek())) return false;
      fire.set(state);
      return true;
    },
    'Corridor: fire panel RÜCKSTELLEN',
  );

  const buttons: Record<string, () => boolean> = {
    'column.SENKEN': lower,
    'column.HEBEN': raise,
    'column.SPANNEN': clamps,
    'column.XE EIN': inlet,
    'column.outlet': outletWheel,
    'board.SPÜLEN': purge,
    'column.QUITT': columnQuitt,
    'board.RÜCKS.': reset,
    'board.NETZ': netz,
    'board.NOT-AUS': notAus,
    'column.AUS': columnAus,
    'column.STRAHL STOP': strahlStop,
    'board.QUITT': quitt,
    'board.L-TEST': lampCheck,
    'column.ZÜND': ignite,
    'fire.Handfeuermelder': fireCall,
    'fire.RÜCKSTELLEN': fireReset,
  };
  const switches: Writable<boolean>[] = [
    master,
    isolator,
    columnNetz,
    rocker,
    recirculatorSwitch,
    ht,
    lt,
    spin,
    hb,
    blatz,
    damp,
    gnd,
    aux1,
    aux2,
    xtalA,
    xtalB,
    xtalC,
  ];
  const knobs: [Writable<number>, readonly number[]][] = [
    [regulator, KNOB],
    [spindleKnob, DIAL],
    [fieldKnob, DIAL],
    [trim, DIAL],
    [ratio, DIAL],
    [band, [0, 0.5, 1]],
  ];

  // ---- What the room shows -------------------------------------------------

  const on = columnRunning;
  const testing = g.derive('board.testing', [lampTest], (t) => t > 0);
  const flashOn = g.derive('board.flashOn', [clock], (c) => c % 0.8 < 0.4);
  // During the lamp test every lamp flashes together, on and off.
  const testFlash = g.output(
    'board.testFlash',
    [testing, flashOn],
    (t, f) => t && f,
    { where: 'Every lamp on the boards, during the lamp test' },
  );
  const windows = annunciators.map((a, i) =>
    g.output(
      `board.window.${a.label}`,
      [alarms, flashOn, testing, fire],
      (phases, flash, test, incident) =>
        !incident.extinguished &&
        (test
          ? flash
          : phases[i] === 'acknowledged' ||
            (phases[i] === 'unacknowledged' && flash)),
      { where: `East board bay ${Math.floor(i / 6) + 1}: ${a.label} window` },
    ),
  );
  const trimMatch = g.derive(
    'board.trimMatch',
    [mains, trim, ideal],
    (m, t, i) => (m ? Math.max(0, 1 - Math.abs(t - i) * 4) : 0),
  );
  const loadShare = g.derive('board.loadShare', [powerKw], (kw) =>
    Math.min(1, kw / BOARD_FULL_LOAD_KW),
  );
  const deltaShare = g.derive(
    'board.deltaShare',
    [delta],
    (d) => d / YALGETH_LIMIT,
  );
  const readings: Record<(typeof gridChannels)[number], Node<number>> = {
    heater,
    spindle,
    field,
    'trim match': trimMatch,
    instability,
    strain,
    delta: deltaShare,
    load: loadShare,
  };
  for (const channel of gridChannels) {
    const reading = readings[channel];
    g.output(
      `board.grid.${channel}`,
      [reading, testing, testFlash, fire],
      // How many of the row's eight lamps are lit.
      (r, test, flash, incident) =>
        incident.extinguished
          ? 0
          : test
            ? flash
              ? 8
              : 0
            : Array.from({ length: 8 }, (_, c) => r > c / 8).filter(Boolean)
                .length,
      { where: `East board bay 2: grid row ${channel}` },
    );
    g.output(
      `board.needle.${channel}`,
      [reading, fire],
      (r, incident) => (incident.extinguished ? 0 : needle(r)),
      {
        where: `East board: ${channel} meter`,
      },
    );
  }
  for (const bay of [0, 1, 2]) {
    const where = `East board under bay ${bay + 1}`;
    g.output(
      `board.status.${bay + 1}.BEREIT`,
      [mains, testing, testFlash, fire],
      (m, t, flash, incident) => !incident.extinguished && (t ? flash : m),
      {
        where: `${where}: BEREIT lamp`,
      },
    );
    const bayToggles = boardHandles
      .slice(bay * 6, bay * 6 + 6)
      .flatMap((h) =>
        h.action.kind === 'toggle'
          ? [g.get(`drive.${h.action.id}`) as Node<boolean>]
          : [],
      );
    g.output(
      `board.status.${bay + 1}.EIN`,
      [...bayToggles, testing, fire],
      (...v) => !fire.value.extinguished && v.slice(0, -1).some(Boolean),
      { where: `${where}: EIN lamp` },
    );
    g.output(
      `board.status.${bay + 1}.STÖRUNG`,
      windows.slice(bay * 6, bay * 6 + 6),
      (...lit) => lit.some(Boolean),
      { where: `${where}: STÖRUNG lamp` },
    );
  }
  boardHandles.forEach((h, i) => {
    const deps: Node<unknown>[] =
      h.action.kind === 'toggle'
        ? [g.get(`drive.${h.action.id}`)!]
        : h.action.kind === 'mains'
          ? [mains]
          : [turned];
    g.output(
      `board.handle.${h.label}`,
      deps,
      (v) => (Array.isArray(v) ? v[i] > 0 : Boolean(v)),
      { where: `East board: ${h.label} handle position` },
    );
  });
  g.output(
    'board.pointer.IST',
    [trim, fire],
    (value, incident) => (incident.extinguished ? 0 : needle(value)),
    {
      where: 'East board bay 1: trim IST pointer',
    },
  );
  g.output(
    'board.pointer.SOLL',
    [ideal, fire],
    (value, incident) => (incident.extinguished ? 0 : needle(value)),
    {
      where: 'East board bay 1: trim SOLL pointer',
    },
  );
  g.output('board.readout.kW', [powerKw], (kw) => kw.toFixed(1), {
    where: 'East board bay 3: LEISTUNG kW readout',
  });
  g.output('board.readout.kWh', [energyKwh], (e) => e.toFixed(1), {
    where: 'East board bay 3: ENERGIE kWh readout',
  });
  g.output('board.readout.delta', [delta], (d) => d.toFixed(2), {
    where: 'East board bay 3: DELTA readout',
  });
  g.output(
    'board.crt',
    [temperature, failure],
    (t, f) => coreProjection(t, f !== null),
    {
      where: 'East board bay 3: FC · RAUMPROJEKTION screen',
    },
  );
  g.output(
    'board.chart.pen',
    [omega],
    (w) =>
      Math.round(
        (Math.min(FERROCORE_MAX_ANGULAR_VELOCITY, w) /
          FERROCORE_MAX_ANGULAR_VELOCITY) *
          78,
      ),
    { where: 'East board bay 1: FERROCORE ω strip chart pen' },
  );

  g.output(
    'wall.needle.kW',
    [powerKw],
    (kw) => needle(kw / BOARD_FULL_LOAD_KW),
    {
      where: 'Wall load meter: kW needle',
    },
  );
  g.output('wall.register.kWh', [energyKwh], (e) => e.toFixed(2), {
    where: 'Wall load meter: kWh register',
  });
  g.output('wall.crystal', [crystalPulse], (p) => Math.round(p * 64), {
    where: 'Time-dilation tell-tale: crystal glow',
  });

  g.output('plant.recirculator.lamp', [recirculatorWorking], (w) => w, {
    where: 'Plant room: recirculator BETRIEB lamp',
  });
  g.output('plant.xenon.flow', [regulatorSlpm], (f) => needle(f / 10), {
    where: 'Plant room: xenon flow gauge',
  });
  g.output('plant.xenon.pressure', [xenonPressure], needle, {
    where: 'Plant room: xenon delivery pressure gauge',
  });
  g.output(
    'plant.xenon.contents',
    [bank, xenonFlow],
    (c, f) => needle(xenonSourcePressure(c, f)),
    { where: 'Plant room: cylinder contents gauge' },
  );

  const column = (id: string, where: string) => ({
    id: `column.lamp.${id}`,
    where: `Column B11 SÄULE: ${where}`,
  });
  const lamp = (
    id: string,
    where: string,
    deps: readonly Node<unknown>[],
    fn: () => boolean,
  ) => {
    const c = column(id, where);
    g.output(c.id, [on, ...deps], () => on.value && fn(), { where: c.where });
  };
  lamp(
    'OBEN',
    'OBEN lamp',
    [lift, liftTarget],
    () => lift.value === 1 || liftTarget.value === 1,
  );
  lamp(
    'UNTEN',
    'UNTEN lamp',
    [lift, liftTarget],
    () => lift.value === 0 || liftTarget.value === 0,
  );
  lamp('SPANNEN', 'SPANNEN lamp', [clamped], () => clamped.value);
  lamp('XE EIN', 'XE EIN lamp', [inletOpen], () => inletOpen.value);
  lamp('AUSLASS', 'AUSLASS lamp', [outletOpen], () => outletOpen.value);
  lamp('O2 = 0', 'O2 = 0 lamp', [purged], () => purged.value);
  lamp('DICHT', 'DICHT lamp', [sealed], () => sealed.value);
  lamp('DRUCK', 'DRUCK lamp', [starved], () => starved.value);
  lamp(
    'STÖRUNG',
    'STÖRUNG lamp',
    [failure, exposed],
    () => failure.value !== null || exposed.value,
  );
  // The chamber gauge is mechanical: it reads with the power off.
  g.output(
    'column.KAMMERDRUCK',
    [chamber, fire],
    (p, incident) => (incident.extinguished ? 0 : needle(p / 2.5)),
    {
      where: 'Column B11 SÄULE: KAMMERDRUCK gauge',
    },
  );
  g.output('column.LAMBDA', [on, lambda], (o, v) => needle(o ? v : 0), {
    where: 'Column B11 SÄULE: LAMBDA-SONDE meter',
  });
  g.output(
    'column.XE VORRAT',
    [on, supply],
    (o, s) => (o ? String(Math.round((s / FULL_BOTTLE) * 100)) : ''),
    { where: 'Column B11 SÄULE: XE VORRAT % readout' },
  );
  g.output(
    'column.IST K',
    [on, temperature],
    (o, t) => (o ? String(Math.round(t)) : ''),
    {
      where: 'Column B12 KERN: IST K readout',
    },
  );
  g.output('column.heaterLamp', [ht, lt], (h, l) => h || l, {
    where: 'Column HV FIL: heater lamp',
  });
  g.output('column.core.stage', [stage], (s) => s, {
    where: 'Column: the core’s colour',
  });
  g.output('column.core.spin', [spinAngle], (a) => Math.round(a * 256), {
    where: 'Column: the core’s turning',
  });

  g.output('room.anomaly', [activity], anomalyStage, {
    where: 'The room: colour, π, warp and sparks (their stage)',
  });
  for (const channel of ['spindle', 'field', 'load'] as const) {
    g.output(
      `room.smoke.${channel}`,
      [overheat],
      (o) => Math.round(o.smoke[channel] * 100),
      {
        where: `The room: ${channel} smoke`,
      },
    );
    g.output(`room.flames.${channel}`, [fire], (f) => f.burning[channel], {
      where: `The room: ${channel} flames`,
    });
  }
  g.output('room.sprinklers', [fire], (f) => f.water, {
    where: 'The room: sprinklers',
  });
  g.output('room.fireAlarm', [fireAlarm], (a) => a, {
    where: 'The room: fire beacons and bell',
  });
  g.output('room.ruined', [ruined], (r) => r, {
    where: 'The room: final report',
  });

  // ---- The world's face ------------------------------------------------------

  const controls: Control[] = [
    ...switches.map((s) => ({
      id: s.id,
      where: g.info(s.id)!.where!,
      kind: 'switch' as const,
    })),
    ...knobs.map(([k, d]) => ({
      id: k.id,
      where: g.info(k.id)!.where!,
      kind: 'knob' as const,
      detents: d,
    })),
    ...Object.keys(buttons).map((id) => ({
      id,
      where: g.info(id)!.where!,
      kind: 'button' as const,
    })),
  ];

  return {
    graph: g,
    controls,
    /** The east board's eighteen alarm conditions, in window order. */
    conditions,
    /** Read any vertex by id. */
    read<T = unknown>(id: string): T {
      const node = g.get(id);
      if (!node) throw new Error(`No vertex ${id}.`);
      return node.value as T;
    },
    /**
     * Work a control: flip a switch, turn a knob to a detent, or press a
     * button. Returns whether it did anything; a ruined lab refuses all.
     */
    work(id: string, setting?: number): boolean {
      if (id in buttons) return buttons[id]();
      if (refused()) return false;
      const node = g.get(id) as Writable<unknown> | undefined;
      if (!node || g.info(id)?.kind !== 'input')
        throw new Error(`No control ${id}.`);
      if (typeof node.peek() === 'boolean') node.set(!node.peek());
      else node.set(setting ?? 0);
      return true;
    },
    /** Advance the lab by `dt` seconds; returns what happened. */
    tick(dt: number, random: () => number = Math.random): WorldEvent[] {
      const wasOperational = fullyOperational.peek();
      events.length = 0;
      g.tick(dt, random);
      if (!wasOperational && fullyOperational.peek())
        events.push({ source: 'plant', event: { kind: 'fully-operational' } });
      return [...events];
    },
    snapshot: () => g.snapshot(),
    restore: (snapshot: Record<string, unknown>) => g.restore(snapshot),
  };
}

export type World = ReturnType<typeof createWorld>;
