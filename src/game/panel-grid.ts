/**
 * Reusable rack-panel controls laid out on a grid. Every panel is 12 columns
 * wide and one row tall per rack unit; each control or instrument kind has a
 * fixed footprint, so panels are assembled from the same parts and nothing
 * can overprint anything else.
 */

export const PANEL_COLUMNS = 12;
/** Reserve the outer tenth of the faceplate for rack ears, screws and handles. */
export const PANEL_SAFE_MARGIN = 0.1;

export const controlKinds = [
  'toggle',
  'toggle3',
  'guarded-toggle',
  'rocker',
  'key-switch',
  'push-button',
  'mushroom-button',
  'knob',
  'trimpot',
  'chicken-head',
  'thumbwheel',
  'plunger',
  'rotary-selector',
  'vernier-dial',
  'crank',
  'slider',
  'lever',
  'dip-bank',
] as const;
export type ControlKind = (typeof controlKinds)[number];

export const instrumentKinds = [
  'lamp',
  'flag',
  'magic-eye',
  'dekatron',
  'edge-meter',
  'vu-meter',
  'counter',
  'annunciator',
  'analogue-meter',
  'viewport',
  'bargraph',
  'thermometer',
  'oscilloscope',
  'chart-recorder',
  'nixie',
] as const;
export type InstrumentKind = (typeof instrumentKinds)[number];

/** Width and height in grid cells; a Nixie bank is as wide as its digits. */
export const footprints: Record<
  ControlKind | InstrumentKind,
  [number | 'digits', number]
> = {
  toggle: [1, 1],
  toggle3: [1, 1],
  'guarded-toggle': [1, 1],
  rocker: [1, 1],
  'key-switch': [1, 1],
  'push-button': [1, 1],
  'mushroom-button': [1, 1],
  knob: [1, 1],
  trimpot: [1, 1],
  'chicken-head': [1, 1],
  thumbwheel: [1, 1],
  plunger: [1, 1],
  'rotary-selector': [2, 2],
  'vernier-dial': [2, 2],
  crank: [2, 2],
  slider: [1, 2],
  lever: [1, 2],
  'dip-bank': [2, 1],
  lamp: [1, 1],
  flag: [1, 1],
  'magic-eye': [1, 1],
  dekatron: [1, 1],
  'edge-meter': [2, 1],
  'vu-meter': [2, 1],
  counter: [2, 1],
  annunciator: [2, 1],
  'analogue-meter': [2, 2],
  viewport: [2, 2],
  bargraph: [1, 2],
  thermometer: [1, 2],
  oscilloscope: [3, 2],
  'chart-recorder': [4, 2],
  nixie: ['digits', 1],
};

/** Momentary controls spring back to zero when released. */
export const momentaryKinds: ReadonlySet<ControlKind> = new Set([
  'push-button',
  'plunger',
]);

export interface PanelControl {
  id: string;
  kind: ControlKind;
  label: string;
  cell: [number, number];
  /** Named detents for selectors; the value is index / (count - 1). */
  positions?: string[];
}

export interface PanelInstrument {
  id: string;
  kind: InstrumentKind;
  label: string;
  cell: [number, number];
  /** Fully qualified control or variable id, e.g. `ferrocore.rpm`. */
  shows: string;
  digits?: number;
  /** Lamps, flags and annunciators light above (or, inverted, below) this. */
  threshold?: number;
  invert?: boolean;
}

export interface PanelSpec {
  units: number;
  controls: PanelControl[];
  instruments: PanelInstrument[];
}

export function spanOf(item: {
  kind: ControlKind | InstrumentKind;
  digits?: number;
}): [number, number] {
  const [width, height] = footprints[item.kind];
  return [width === 'digits' ? (item.digits ?? 1) : width, height];
}

/** Problems with a panel layout; an empty list means it is valid. */
export function validatePanel(panel: PanelSpec): string[] {
  const problems: string[] = [];
  const occupied = new Map<string, string>();
  for (const item of [...panel.controls, ...panel.instruments]) {
    const [col, row] = item.cell;
    const [width, height] = spanOf(item);
    if (
      col < 0 ||
      row < 0 ||
      col + width > PANEL_COLUMNS ||
      row + height > panel.units
    )
      problems.push(`${item.id} falls outside the panel`);
    for (let x = col; x < col + width; x++)
      for (let y = row; y < row + height; y++) {
        const key = `${x},${y}`;
        const other = occupied.get(key);
        if (other) problems.push(`${item.id} overlaps ${other} at ${key}`);
        occupied.set(key, item.id);
      }
  }
  return problems;
}

/**
 * Where an item sits on its panel, as fractions of the panel's width and
 * height measured from the top-left corner: the centre and the size.
 */
export function cellRect(
  panel: PanelSpec,
  item: PanelControl | PanelInstrument,
) {
  const [col, row] = item.cell;
  const [width, height] = spanOf(item);
  return {
    x:
      PANEL_SAFE_MARGIN +
      ((col + width / 2) / PANEL_COLUMNS) * (1 - 2 * PANEL_SAFE_MARGIN),
    y: (row + height / 2) / panel.units,
    width: (width / PANEL_COLUMNS) * (1 - 2 * PANEL_SAFE_MARGIN),
    height: height / panel.units,
  };
}
