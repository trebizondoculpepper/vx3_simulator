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
] as const;
export type ToggleId = (typeof toggleIds)[number];

export const knobIds = ['spindle', 'ratio', 'field', 'trim', 'gain'] as const;
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
};

export const knobLabels: Record<KnobId, string> = {
  spindle: 'SPINDLE',
  ratio: 'RATIO',
  field: 'H-B FIELD',
  trim: 'BLATZ TRIM',
  gain: 'GAIN',
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
  toggles: Record<ToggleId, boolean>;
  knobs: Record<KnobId, number>;
}

export function createRackControls(): RackControls {
  return {
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
    },
    knobs: { spindle: 0, ratio: 0.3, field: 0, trim: 0.5, gain: 0.6 },
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
}
