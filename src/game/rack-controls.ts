import type { RigControls } from './rig';

export const toggleIds = [
  'ht',
  'lt',
  'aux1',
  'aux2',
  'spin',
  'hb',
  'blatz',
  'xtalA',
  'xtalB',
  'xtalC',
  'damp',
  'gnd',
  // The second panel of each pair has switches of its own.
  'chromoAux',
  'chromoA',
  'chromoB',
  'governorEngage',
  'plasmaOn',
  'detectorBlatz',
] as const;
export type ToggleId = (typeof toggleIds)[number];

export const knobIds = [
  'spindle',
  'ratio',
  'governor',
  'governorRatio',
  'field',
  'trim',
  'gain',
  'detectorGain',
  'ampGain',
  'plasmaExcite',
  'plasmaNull',
  'busBand',
  'insulationBand',
] as const;
export type KnobId = (typeof knobIds)[number];

export const toggleLabels: Record<ToggleId, string> = {
  ht: 'HT',
  lt: 'LT',
  aux1: 'AUX 1',
  aux2: 'AUX 2',
  spin: 'SPIN',
  hb: 'H-B',
  blatz: 'BLATZ',
  xtalA: 'XTAL A',
  xtalB: 'XTAL B',
  xtalC: 'XTAL C',
  damp: 'DAMP',
  gnd: 'GND?',
  chromoAux: 'CHROMOCORE AUX 1',
  chromoA: 'CHROMOCORE XTAL A',
  chromoB: 'CHROMOCORE XTAL B',
  governorEngage: 'GOVERNOR ENGAGE',
  plasmaOn: 'PLASMA',
  detectorBlatz: 'DETECTOR BLATZ',
};

export const knobLabels: Record<KnobId, string> = {
  spindle: 'SPINDLE',
  ratio: 'RATIO',
  governor: 'SPEED LIMIT',
  governorRatio: 'RESPONSE',
  field: 'H-B FIELD',
  trim: 'BLATZ TRIM',
  gain: 'CHAMBER GAIN',
  detectorGain: 'DETECTOR GAIN',
  ampGain: 'BETAFORM GAIN',
  plasmaExcite: 'PLASMA EXCITATION',
  plasmaNull: 'PLASMA NULL',
  busBand: 'BUS BAND',
  insulationBand: 'INSULATION BAND',
};

/** Logbook lines for switches with opinions; others log plainly. */
const quips: Partial<Record<ToggleId, [up: string, down: string]>> = {
  aux2: [
    'AUX 2 up. Nothing happened. Suspicious.',
    'AUX 2 down. Something un-happened.',
  ],
  xtalA: ['Crystal A in circuit. Faint smell of pine.', 'Crystal A out.'],
  xtalB: [
    'Crystal B in circuit. Humming in a minor key.',
    'Crystal B out. Relief, somehow.',
  ],
  gnd: [
    'GND? up. Still not sure what it grounds.',
    'GND? down. The fridge stopped humming.',
  ],
  damp: ['DAMP up. Room feels slightly moist.', 'DAMP down.'],
};

/** Everything on the rack the operator can touch, apart from the mains lever. */
export interface RackControls {
  /** Physical mains switch position. Trips change power, not this input. */
  mains: boolean;
  toggles: Record<ToggleId, boolean>;
  knobs: Record<KnobId, number>;
}

export function createRackControls(): RackControls {
  return {
    mains: false,
    toggles: {
      ht: true,
      lt: true,
      aux1: false,
      aux2: false,
      spin: true,
      hb: true,
      blatz: true,
      xtalA: true,
      xtalB: false,
      xtalC: true,
      damp: false,
      gnd: false,
      chromoAux: false,
      chromoA: true,
      chromoB: false,
      governorEngage: true,
      plasmaOn: true,
      detectorBlatz: true,
    },
    knobs: {
      spindle: 0,
      ratio: 0.3,
      governor: 1,
      governorRatio: 0.5,
      field: 0,
      trim: 0.5,
      gain: 0.6,
      detectorGain: 0.6,
      ampGain: 0.6,
      plasmaExcite: 1,
      plasmaNull: 0.5,
      busBand: 0.4,
      insulationBand: 0.4,
    },
  };
}

export function toggleLine(id: ToggleId, up: boolean): string {
  const quip = quips[id];
  if (quip) return up ? quip[0] : quip[1];
  return `${toggleLabels[id]} ${up ? 'up' : 'down'}.`;
}

export function knobLine(id: KnobId, value: number): string {
  return `${knobLabels[id]} to ${(value * 10).toFixed(1)}.`;
}

/** Feed the rack into the rig: SPIN and H-B switches gate their dials. */
export function applyRack(desk: RackControls, controls: RigControls) {
  controls.spindle = desk.toggles.spin ? desk.knobs.spindle : 0;
  controls.field = desk.toggles.hb ? desk.knobs.field : 0;
  controls.trim = desk.knobs.trim;
  // The governor only limits the spindle while it is engaged, and the plasma
  // inducer only excites the field while it is switched on.
  controls.governor = desk.toggles.governorEngage ? desk.knobs.governor : 1;
  controls.governorResponse = desk.knobs.governorRatio;
  controls.plasmaExcitation = desk.toggles.plasmaOn
    ? desk.knobs.plasmaExcite
    : 0;
  controls.plasmaNull = desk.knobs.plasmaNull;
}
