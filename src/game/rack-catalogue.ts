import type { KnobId, ToggleId } from './rack-controls';

export type PanelControl =
  | { kind: 'mains'; label: string; x: number }
  | { kind: 'toggle'; id: ToggleId; label: string; x: number }
  | { kind: 'knob'; id: KnobId; label: string; x: number }
  | { kind: 'selector'; label: string; x: number }
  | {
      kind: 'button';
      id: 'reset' | 'purge' | 'do-not';
      label: string;
      x: number;
    };

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

/** Panel designs and maker-to-part pairings are invented; sourced names are indexed in doc/lore/. */
const catalogue: Record<string, RackModule[]> = {
  supply: [
    {
      id: 'supply-a',
      maker: 'VOLT XOCCULA',
      title: 'VARISTANCE ISOLATOR / HEATERS',
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
      maker: 'WONSHOU LABS',
      title: 'PLYNOST MODULATION RECTIFIER',
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
      maker: 'NEUMANN DYNAMIK',
      title: 'FERROCORE / PHOTON TUBE BANK',
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
      maker: 'SYNCLEX',
      title: 'CHROMOCORE SELECTION BANK',
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
      maker: 'BONK INDUSTRIES',
      title: 'ENCABULATOR DRIVE',
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
      maker: 'VOLT XOCCULA',
      title: 'ENCABULATOR GOVERNOR',
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
      maker: 'VOLT XOCCULA',
      title: 'HOLTZMANN RESONANCE COIL',
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
      maker: 'GORSKIY',
      title: 'META-STABLE FLUX PLASMA INDUCER',
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
      maker: 'VOLT XOCCULA',
      title: 'BALTOVSKY CHAMBER MONITOR',
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
      maker: 'NEUMANN DYNAMIK',
      title: 'FROMITZ / HYPERFINE DETECTOR',
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
  service: [
    {
      id: 'service-a',
      maker: 'VOLT XOCCULA',
      title: 'MAIN BUS CONTROLLER',
      units: 3,
      finish: '#565247',
      controls: [
        { kind: 'selector', label: 'BAND', x: -1.55 },
        { kind: 'button', id: 'reset', label: 'RESET', x: -0.55 },
        { kind: 'button', id: 'purge', label: 'PURGE', x: 0.45 },
        { kind: 'button', id: 'do-not', label: 'DO NOT', x: 1.42 },
      ],
      instruments: [],
      provenance: 'invented',
    },
    {
      id: 'service-b',
      maker: 'GORSKIY',
      title: 'ION INSULATION PLATE CHECK',
      units: 3,
      finish: '#4b5551',
      controls: [
        { kind: 'selector', label: 'BAND', x: -1.55 },
        { kind: 'button', id: 'reset', label: 'RESET', x: -0.55 },
        { kind: 'button', id: 'purge', label: 'PURGE', x: 0.45 },
        { kind: 'button', id: 'do-not', label: 'DO NOT', x: 1.42 },
      ],
      instruments: [],
      provenance: 'invented',
    },
  ],
};

/** Fixed power-to-measurement path; later behaviour can depend on exact neighbours. */
export function assembleRack(): RackModule[] {
  return [
    catalogue.supply[1],
    catalogue.valves[0],
    catalogue.valves[1],
    catalogue.spindle[0],
    catalogue.spindle[1],
    catalogue.field[0],
    catalogue.field[1],
    catalogue.monitor[0],
    catalogue.monitor[1],
    catalogue.service[1],
  ];
}
