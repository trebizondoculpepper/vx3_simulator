import type { Instrument, RackModule } from './rack-catalogue';

/**
 * The faceplate grid for the rack's modules. Every faceplate has three
 * bands: a title plate at the top, a footer for the module stamp and vents
 * at the bottom, and a body between them. The body is 12 columns wide and
 * either one row tall or split into a top and a bottom half. Each part has
 * a natural size and is scaled down to fit its cell, so nothing on a panel
 * can overprint its title or its neighbours. Units are scene units, with
 * the faceplate centred on the origin.
 */

/** Width of a 19-inch faceplate in scene units; it sets the room's scale. */
export const PANEL_WIDTH = 4.35;
/** Height of one rack unit (1.75 in) at that scale. */
export const RACK_UNIT = (PANEL_WIDTH * 1.75) / 19;

export const RACK_GRID = {
  columns: 12,
  /** Half the usable width, inside the rack ears, screws and handles. */
  halfWidth: 1.9,
  /** From the top edge to the title plate, clearing the trim rule. */
  titleInset: 0.12,
  titleWidth: 3.04,
  titleHeight: 0.225,
  /** Clear space between the title plate and the body. */
  titleGap: 0.04,
  footerHeight: 0.17,
  /** Clear margin kept inside every cell. */
  padding: 0.025,
} as const;

export interface Rect {
  /** Centre. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PartKind =
  'toggle' | 'knob' | 'button' | 'gauge' | 'scope' | 'nixie' | 'valve';

/** The natural size of each part, before it is scaled to fit its cell. */
export const partSizes: Record<PartKind, { width: number; height: number }> = {
  // Indicator lamp, bat-handle switch and its label.
  toggle: { width: 0.44, height: 0.8 },
  // Bezel and knob, with its label.
  knob: { width: 0.54, height: 0.76 },
  button: { width: 0.5, height: 0.74 },
  // Dial face and caption.
  gauge: { width: 0.69, height: 0.92 },
  scope: { width: 1.15, height: 0.77 },
  nixie: { width: 1.15, height: 0.3 },
  // A valve standing proud of its socket.
  valve: { width: 0.28, height: 0.4 },
};

/** Columns each part spans. */
const partColumns: Record<PartKind, number> = {
  toggle: 2,
  knob: 2,
  button: 2,
  gauge: 2,
  scope: 5,
  nixie: 3,
  valve: 2,
};

/** Size of a label drawn by createLabelTexture and shown at 85 px per unit. */
export function labelSize(text: string, size: number) {
  return {
    width: Math.max(32, Math.ceil(text.length * size * 0.62) + 12) / 85,
    height: (size + 8) / 85,
  };
}

/** Label size used under every control and gauge. */
export const PART_LABEL_SIZE = 9;

export interface PlacedPart {
  kind: PartKind;
  /** The control or instrument it belongs to, by index in the module. */
  source: { list: 'controls' | 'instruments'; index: number };
  /** The grid cell. */
  cell: Rect;
  /** Where the part is drawn, centred in its cell. */
  rect: Rect;
  /** How much the part is scaled down to fit. */
  scale: number;
}

const controlPart = (kind: RackModule['controls'][number]['kind']): PartKind =>
  kind === 'mains' || kind === 'toggle'
    ? 'toggle'
    : kind === 'button'
      ? 'button'
      : 'knob';

const instrumentPart = (kind: Instrument): PartKind =>
  kind === 'scope' ? 'scope' : kind === 'nixie' ? 'nixie' : 'gauge';

export function moduleBands(units: number, unitHeight: number) {
  const height = units * unitHeight;
  const g = RACK_GRID;
  const titleTop = height / 2 - g.titleInset;
  const bodyTop = titleTop - g.titleHeight - g.titleGap;
  const bodyBottom = -height / 2 + g.footerHeight;
  return {
    height,
    title: {
      x: 0,
      y: titleTop - g.titleHeight / 2,
      width: g.titleWidth,
      height: g.titleHeight,
    },
    body: {
      x: 0,
      y: (bodyTop + bodyBottom) / 2,
      width: g.halfWidth * 2,
      height: bodyTop - bodyBottom,
    },
    footer: {
      x: 0,
      y: -height / 2 + g.footerHeight / 2,
      width: g.halfWidth * 2,
      height: g.footerHeight,
    },
  };
}

/** Lay out every part of a module on its faceplate grid. */
export function layoutModule(module: RackModule, unitHeight: number) {
  const bands = moduleBands(module.units, unitHeight);
  const { body } = bands;
  const columnWidth = body.width / RACK_GRID.columns;
  const parts: PlacedPart[] = [];
  const place = (
    kind: PartKind,
    source: PlacedPart['source'],
    column: number,
    row: 'full' | 'top' | 'bottom',
    label?: string,
  ) => {
    const columns = partColumns[kind];
    const cell: Rect = {
      x: -body.width / 2 + (column + columns / 2) * columnWidth,
      y:
        row === 'full'
          ? body.y
          : body.y + (row === 'top' ? 1 : -1) * (body.height / 4),
      width: columns * columnWidth,
      height: row === 'full' ? body.height : body.height / 2,
    };
    const natural = partSizes[kind];
    const width = label
      ? Math.max(natural.width, labelSize(label, PART_LABEL_SIZE).width)
      : natural.width;
    const room = 2 * RACK_GRID.padding;
    const scale = Math.min(
      1,
      (cell.width - room) / width,
      (cell.height - room) / natural.height,
    );
    parts.push({
      kind,
      source,
      cell,
      rect: {
        x: cell.x,
        y: cell.y,
        width: width * scale,
        height: natural.height * scale,
      },
      scale,
    });
  };
  module.controls.forEach((control, index) => {
    place(
      controlPart(control.kind),
      { list: 'controls', index },
      control.column,
      control.row ?? 'full',
      control.label,
    );
    // Valve modules stand a valve above each of their tube switches.
    if (module.id.startsWith('valves') && control.row === 'bottom')
      place('valve', { list: 'controls', index }, control.column, 'top');
  });
  module.instruments.forEach((instrument, index) => {
    const kind = instrumentPart(instrument.kind);
    place(
      kind,
      { list: 'instruments', index },
      instrument.column,
      instrument.row ?? 'full',
      kind === 'gauge' ? instrument.kind.toUpperCase() : undefined,
    );
  });
  return { ...bands, parts };
}

const overlaps = (a: Rect, b: Rect) =>
  Math.abs(a.x - b.x) * 2 < a.width + b.width - 1e-9 &&
  Math.abs(a.y - b.y) * 2 < a.height + b.height - 1e-9;

const inside = (inner: Rect, outer: Rect) =>
  inner.x - inner.width / 2 >= outer.x - outer.width / 2 - 1e-9 &&
  inner.x + inner.width / 2 <= outer.x + outer.width / 2 + 1e-9 &&
  inner.y - inner.height / 2 >= outer.y - outer.height / 2 - 1e-9 &&
  inner.y + inner.height / 2 <= outer.y + outer.height / 2 + 1e-9;

/** Problems with a module's layout; an empty list means it is valid. */
export function validateModuleLayout(
  module: RackModule,
  unitHeight: number,
): string[] {
  const layout = layoutModule(module, unitHeight);
  const problems: string[] = [];
  const name = (part: PlacedPart) =>
    `${part.kind} ${part.source.list}[${part.source.index}]`;
  layout.parts.forEach((part, i) => {
    if (!inside(part.cell, layout.body))
      problems.push(`${name(part)} falls outside the body`);
    if (!inside(part.rect, part.cell))
      problems.push(`${name(part)} spills out of its cell`);
    for (const band of ['title', 'footer'] as const)
      if (overlaps(part.rect, layout[band]))
        problems.push(`${name(part)} overprints the ${band}`);
    for (const other of layout.parts.slice(i + 1))
      if (overlaps(part.cell, other.cell))
        problems.push(`${name(part)} overlaps ${name(other)}`);
  });
  return problems;
}
