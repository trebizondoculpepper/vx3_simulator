import type { KnobId, ToggleId } from './rack-controls';

export type PanelControl =
  | { kind: 'mains'; label: string; x: number }
  | { kind: 'toggle'; id: ToggleId; label: string; x: number }
  | { kind: 'knob'; id: KnobId; label: string; x: number };

export type Instrument =
  'heater' | 'spindle' | 'field' | 'stability' | 'scope' | 'nixie';

export interface RackModule {
  id: string;
  maker: string;
  title: string;
  units: number;
  finish: string;
  controls: PanelControl[];
  instruments: Instrument[];
  provenance: 'invented';
}

const catalogue: Record<string, RackModule[]> = {
  supply: [
    {
      id: 'supply-a',
      maker: 'CROWTHER',
      title: 'MAINS & HEATER SUPPLY',
      units: 3,
      finish: '#4d534b',
      controls: [
        { kind: 'mains', label: 'MAINS', x: -1.5 },
        { kind: 'toggle', id: 'ht', label: 'HT', x: -0.65 },
        { kind: 'toggle', id: 'lt', label: 'LT', x: 0.05 },
      ],
      instruments: ['heater'],
      provenance: 'invented',
    },
    {
      id: 'supply-b',
      maker: 'BELLWETHER',
      title: 'PRIMARY DISTRIBUTION',
      units: 3,
      finish: '#574b3e',
      controls: [
        { kind: 'mains', label: 'BREAKER', x: -1.5 },
        { kind: 'toggle', id: 'ht', label: 'HT', x: -0.65 },
        { kind: 'toggle', id: 'lt', label: 'LT', x: 0.05 },
      ],
      instruments: ['heater'],
      provenance: 'invented',
    },
  ],
  valves: [
    {
      id: 'valves-a',
      maker: 'MERRITT',
      title: 'VALVE & AUXILIARY BANK',
      units: 4,
      finish: '#354842',
      controls: [
        { kind: 'toggle', id: 'aux1', label: 'AUX 1', x: -1.45 },
        { kind: 'toggle', id: 'aux2', label: 'AUX 2', x: -0.7 },
        { kind: 'toggle', id: 'xtalA', label: 'XTAL A', x: 0.15 },
        { kind: 'toggle', id: 'xtalB', label: 'XTAL B', x: 0.85 },
      ],
      instruments: [],
      provenance: 'invented',
    },
    {
      id: 'valves-b',
      maker: 'NORTH ARC',
      title: 'CRYSTAL SELECTION BANK',
      units: 4,
      finish: '#48505a',
      controls: [
        { kind: 'toggle', id: 'aux1', label: 'AUX 1', x: -1.45 },
        { kind: 'toggle', id: 'xtalA', label: 'XTAL A', x: -0.7 },
        { kind: 'toggle', id: 'xtalB', label: 'XTAL B', x: 0.15 },
        { kind: 'toggle', id: 'xtalC', label: 'XTAL C', x: 0.85 },
      ],
      instruments: [],
      provenance: 'invented',
    },
  ],
  spindle: [
    {
      id: 'spindle-a',
      maker: 'BELLWETHER',
      title: 'PHASE SPINDLE DRIVE',
      units: 4,
      finish: '#555048',
      controls: [
        { kind: 'toggle', id: 'spin', label: 'SPIN', x: -1.6 },
        { kind: 'knob', id: 'spindle', label: 'SPEED', x: -0.65 },
        { kind: 'knob', id: 'ratio', label: 'RATIO', x: 0.25 },
      ],
      instruments: ['spindle', 'nixie'],
      provenance: 'invented',
    },
    {
      id: 'spindle-b',
      maker: 'MERRITT',
      title: 'SPINDLE GOVERNOR',
      units: 4,
      finish: '#435451',
      controls: [
        { kind: 'toggle', id: 'spin', label: 'SPIN', x: -1.6 },
        { kind: 'knob', id: 'spindle', label: 'DRIVE', x: -0.65 },
        { kind: 'knob', id: 'ratio', label: 'RATIO', x: 0.25 },
      ],
      instruments: ['spindle', 'nixie'],
      provenance: 'invented',
    },
  ],
  field: [
    {
      id: 'field-a',
      maker: 'CROWTHER',
      title: 'HELMHOLTZ–BLATZ REGULATOR',
      units: 4,
      finish: '#3e4d58',
      controls: [
        { kind: 'toggle', id: 'hb', label: 'H–B', x: -1.65 },
        { kind: 'knob', id: 'field', label: 'FIELD', x: -0.8 },
        { kind: 'knob', id: 'trim', label: 'BLATZ TRIM', x: 0.15 },
        { kind: 'toggle', id: 'damp', label: 'DAMP', x: 1.1 },
      ],
      instruments: ['field', 'stability'],
      provenance: 'invented',
    },
    {
      id: 'field-b',
      maker: 'NORTH ARC',
      title: 'H–B FIELD CORRECTOR',
      units: 4,
      finish: '#5a5147',
      controls: [
        { kind: 'toggle', id: 'hb', label: 'H–B', x: -1.65 },
        { kind: 'knob', id: 'field', label: 'EXCITE', x: -0.8 },
        { kind: 'knob', id: 'trim', label: 'NULL', x: 0.15 },
        { kind: 'toggle', id: 'gnd', label: 'GND?', x: 1.1 },
      ],
      instruments: ['field', 'stability'],
      provenance: 'invented',
    },
  ],
  monitor: [
    {
      id: 'monitor-a',
      maker: 'MERRITT',
      title: 'FIELD MONITOR & COUNTER',
      units: 4,
      finish: '#36433f',
      controls: [
        { kind: 'knob', id: 'gain', label: 'GAIN', x: -1.6 },
        { kind: 'toggle', id: 'blatz', label: 'BLATZ', x: -0.75 },
      ],
      instruments: ['scope', 'nixie'],
      provenance: 'invented',
    },
    {
      id: 'monitor-b',
      maker: 'BELLWETHER',
      title: 'RESONANCE INDICATOR',
      units: 4,
      finish: '#4b4548',
      controls: [
        { kind: 'knob', id: 'gain', label: 'GAIN', x: -1.6 },
        { kind: 'toggle', id: 'blatz', label: 'BLATZ', x: -0.75 },
      ],
      instruments: ['scope', 'nixie'],
      provenance: 'invented',
    },
  ],
};

/** One recognisable panel from each role, with variable makers and middle order. */
export function assembleRack(random: () => number = Math.random): RackModule[] {
  const select = (role: string) => {
    const choices = catalogue[role];
    return choices[
      Math.min(choices.length - 1, Math.floor(random() * choices.length))
    ];
  };
  const middle = [select('valves'), select('spindle'), select('field')];
  if (random() < 0.5) [middle[0], middle[1]] = [middle[1], middle[0]];
  return [select('supply'), ...middle, select('monitor')];
}
