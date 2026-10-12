import type { KnobId, ToggleId } from './rack-controls';

/**
 * Where a part sits on its faceplate grid (see rack-layout.ts): the first of
 * the 12 body columns it spans, and the whole body height or one half.
 */
interface GridCell {
  column: number;
  row?: 'top' | 'bottom';
}

export type PanelControl = GridCell &
  (
    | { kind: 'mains'; label: string }
    | { kind: 'toggle'; id: ToggleId; label: string }
    | { kind: 'knob'; id: KnobId; label: string }
    | { kind: 'selector'; id: KnobId; label: string }
    | { kind: 'button'; id: 'reset' | 'purge' | 'do-not'; label: string }
  );

export type Instrument =
  'heater' | 'spindle' | 'field' | 'stability' | 'scope' | 'nixie';

export interface RackInstrument extends GridCell {
  kind: Instrument;
}

export interface RackModule {
  id: string;
  maker: string;
  title: string;
  units: number;
  finish: string;
  controls: PanelControl[];
  instruments: RackInstrument[];
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
        { kind: 'mains', label: 'MAINS', column: 0 },
        { kind: 'toggle', id: 'ht', label: 'HT', column: 3 },
        { kind: 'toggle', id: 'lt', label: 'LT', column: 6 },
      ],
      instruments: [{ kind: 'heater', column: 10 }],
      provenance: 'invented',
    },
    {
      id: 'supply-b',
      maker: 'WONSHOU LABS',
      title: 'PLYNOST MODULATION RECTIFIER',
      units: 3,
      finish: '#574b3e',
      controls: [
        { kind: 'mains', label: 'BREAKER', column: 0 },
        { kind: 'toggle', id: 'ht', label: 'HT', column: 3 },
        { kind: 'toggle', id: 'lt', label: 'LT', column: 6 },
      ],
      instruments: [{ kind: 'heater', column: 10 }],
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
        {
          kind: 'toggle',
          id: 'aux1',
          label: 'AUX 1',
          column: 0,
          row: 'bottom',
        },
        {
          kind: 'toggle',
          id: 'aux2',
          label: 'AUX 2',
          column: 3,
          row: 'bottom',
        },
        {
          kind: 'toggle',
          id: 'xtalA',
          label: 'XTAL A',
          column: 6,
          row: 'bottom',
        },
        {
          kind: 'toggle',
          id: 'xtalB',
          label: 'XTAL B',
          column: 9,
          row: 'bottom',
        },
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
        {
          kind: 'toggle',
          id: 'chromoAux',
          label: 'AUX 1',
          column: 0,
          row: 'bottom',
        },
        {
          kind: 'toggle',
          id: 'chromoA',
          label: 'XTAL A',
          column: 3,
          row: 'bottom',
        },
        {
          kind: 'toggle',
          id: 'chromoB',
          label: 'XTAL B',
          column: 6,
          row: 'bottom',
        },
        {
          kind: 'toggle',
          id: 'xtalC',
          label: 'XTAL C',
          column: 9,
          row: 'bottom',
        },
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
        { kind: 'toggle', id: 'spin', label: 'SPIN', column: 0 },
        { kind: 'knob', id: 'spindle', label: 'SPEED', column: 2 },
        { kind: 'knob', id: 'ratio', label: 'RATIO', column: 4 },
      ],
      instruments: [
        { kind: 'spindle', column: 6 },
        { kind: 'nixie', column: 9 },
      ],
      provenance: 'invented',
    },
    {
      id: 'spindle-b',
      maker: 'VOLT XOCCULA',
      title: 'ENCABULATOR GOVERNOR',
      units: 4,
      finish: '#435451',
      controls: [
        { kind: 'toggle', id: 'governorEngage', label: 'ENGAGE', column: 0 },
        { kind: 'knob', id: 'governor', label: 'LIMIT', column: 2 },
        { kind: 'knob', id: 'governorRatio', label: 'RESPONSE', column: 4 },
      ],
      instruments: [
        { kind: 'spindle', column: 6 },
        { kind: 'nixie', column: 9 },
      ],
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
        { kind: 'toggle', id: 'hb', label: 'H–B', column: 0 },
        { kind: 'knob', id: 'field', label: 'FIELD', column: 2 },
        { kind: 'knob', id: 'trim', label: 'BLATZ TRIM', column: 4 },
        { kind: 'toggle', id: 'damp', label: 'DAMP', column: 6 },
      ],
      instruments: [
        { kind: 'field', column: 8 },
        { kind: 'stability', column: 10 },
      ],
      provenance: 'invented',
    },
    {
      id: 'field-b',
      maker: 'GORSKIY',
      title: 'META-STABLE FLUX PLASMA INDUCER',
      units: 4,
      finish: '#5a5147',
      controls: [
        { kind: 'toggle', id: 'plasmaOn', label: 'PLASMA', column: 0 },
        { kind: 'knob', id: 'plasmaExcite', label: 'EXCITE', column: 2 },
        { kind: 'knob', id: 'plasmaNull', label: 'NULL', column: 4 },
        { kind: 'toggle', id: 'gnd', label: 'GND?', column: 6 },
      ],
      instruments: [
        { kind: 'field', column: 8 },
        { kind: 'stability', column: 10 },
      ],
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
        { kind: 'knob', id: 'gain', label: 'GAIN', column: 0 },
        { kind: 'toggle', id: 'blatz', label: 'BLATZ', column: 2 },
      ],
      instruments: [
        { kind: 'scope', column: 4 },
        { kind: 'nixie', column: 9 },
      ],
      provenance: 'invented',
    },
    {
      id: 'monitor-b',
      maker: 'NEUMANN DYNAMIK',
      title: 'FROMITZ / HYPERFINE DETECTOR',
      units: 4,
      finish: '#4b4548',
      controls: [
        { kind: 'knob', id: 'detectorGain', label: 'GAIN', column: 0 },
        { kind: 'toggle', id: 'detectorBlatz', label: 'BLATZ', column: 2 },
      ],
      instruments: [
        { kind: 'scope', column: 4 },
        { kind: 'nixie', column: 9 },
      ],
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
        { kind: 'selector', id: 'busBand', label: 'BAND', column: 0 },
        { kind: 'button', id: 'reset', label: 'RESET', column: 3 },
        { kind: 'button', id: 'purge', label: 'PURGE', column: 6 },
        { kind: 'button', id: 'do-not', label: 'DO NOT', column: 9 },
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
        { kind: 'selector', id: 'insulationBand', label: 'BAND', column: 0 },
        { kind: 'button', id: 'reset', label: 'RESET', column: 3 },
        { kind: 'button', id: 'purge', label: 'PURGE', column: 6 },
        { kind: 'button', id: 'do-not', label: 'DO NOT', column: 9 },
      ],
      instruments: [],
      provenance: 'invented',
    },
  ],
};

/** Every module design, including the ones not fitted to this rack. */
export const rackModules: readonly RackModule[] =
  Object.values(catalogue).flat();

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
