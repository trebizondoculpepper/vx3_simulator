import { BoxGeometry, Group, Mesh } from 'three';
import type { Object3D } from 'three';
import {
  createEightiesButton,
  createMicroLabel,
} from '../scene/eighties-controls';
import type { CapColour, PanelKit } from '../scene/eighties-controls';
import { createKnob } from '../scene/panel-switchgear';
import { createCharacterLcd } from '../scene/panel-instruments';
import { stepKnob } from '../scene/rotary-knob';
import { createPs1Material } from './ps1-material';

/** One knob on the console: a named value swept between two limits. */
export interface ConsoleDial {
  name: string;
  min: number;
  max: number;
  get(): number;
  set(value: number): void;
  /** Decimal places on the display. */
  digits?: number;
  /** Detents across the travel; 40 by default. */
  steps?: number;
  /** What the display shows for a value, if not the number itself. */
  label?: (value: number) => string;
}

export interface ConsoleButton {
  legend: string;
  colour: CapColour;
  /** Lit while true; a button without it is momentary. */
  lit?: () => boolean;
  press(): void;
}

export interface ConsoleRow {
  title: string;
  dials: ConsoleDial[];
  buttons?: ConsoleButton[];
  /** A latching BYPASS button beside the title, lit while the row is off. */
  bypass?: { on(): boolean; toggle(): void };
}

const PITCH = 0.052;
const ROW = 0.062;
const TITLE_WIDTH = 0.085;

/**
 * The effects room's console: rows of knobs, one row per effect, with
 * buttons at the ends of some rows and a character display that names the
 * last control touched and its value. An effect's row starts with a
 * BYPASS button, lit while that effect is switched off; its knobs keep
 * their places. Like every knob in the game, a click
 * on a knob's left half turns it down a detent and on its right half up.
 * Each knob follows its value, so a preset turns them all. Built in
 * metres, facing +z, centred on the origin.
 */
export function createEffectsConsole(
  kit: PanelKit,
  rows: ConsoleRow[],
  readout: () => string[],
) {
  const group = new Group();
  const columns = Math.max(
    ...rows.map((row) => row.dials.length + (row.buttons?.length ?? 0) * 0.8),
  );
  // The bypass buttons stand in a column of their own after the titles.
  const bypassWidth = rows.some((row) => row.bypass) ? PITCH * 0.8 : 0;
  const width = TITLE_WIDTH + bypassWidth + columns * PITCH + 0.03;
  const lcdHeight = 0.05;
  const height = rows.length * ROW + lcdHeight + 0.04;
  const plate = createPs1Material({ color: '#c3c7c0' });
  const rule = createPs1Material({ color: '#7d817b' });
  kit.materials.push(plate, rule);
  const face = new Mesh(new BoxGeometry(width, height, 0.012), plate);
  face.position.z = -0.006;
  group.add(face);
  const left = -width / 2 + 0.015;
  const top = height / 2 - 0.02;

  const uses = new Map<Object3D, (direction?: number) => void>();
  const updates: ((delta: number) => void)[] = [];
  const follow: (() => void)[] = [];
  const caption = (
    text: string,
    x: number,
    y: number,
    size = 0.0045,
    plateColour: string | null = null,
  ) => {
    const label = createMicroLabel(kit, text, {
      height: size,
      ink: plateColour ? '#f1ecdc' : '#22231f',
      plate: plateColour,
    });
    label.position.set(x, y, 0.0006);
    group.add(label);
  };

  // The display: the control last touched, then the live readings.
  let touched = ['EFFECTS CONSOLE', 'TURN ANY KNOB'];
  const lcd = createCharacterLcd(kit, { columns: 24, rows: 3, cell: 0.0042 });
  lcd.group.position.set(0, top - 0.012, 0);
  group.add(lcd.group);
  follow.push(() => lcd.show([...touched, readout()[0] ?? '']));
  const shown = (dial: ConsoleDial) =>
    dial.label?.(dial.get()) ?? dial.get().toFixed(dial.digits ?? 2);

  rows.forEach((row, r) => {
    const y = top - lcdHeight - 0.012 - r * ROW;
    const divider = new Mesh(
      new BoxGeometry(width - 0.02, 0.0012, 0.001),
      rule,
    );
    divider.position.set(0, y + ROW / 2 - 0.004, 0.0005);
    group.add(divider);
    caption(row.title, left + TITLE_WIDTH / 2 - 0.004, y, 0.0055, '#2b3a35');
    if (row.bypass) {
      const { on, toggle } = row.bypass;
      const button = createEightiesButton(kit, 'BYPASS', 'amber', {
        latching: true,
        size: 0.019,
      });
      button.group.position.set(
        left + TITLE_WIDTH + bypassWidth / 2 - 0.004,
        y + 0.004,
        0,
      );
      group.add(button.group);
      uses.set(button.cap, () => {
        toggle();
        touched = [`${row.title} · BYPASS`, on() ? 'ON: EFFECT OFF' : 'OFF'];
      });
      updates.push(button.update);
      follow.push(() => {
        if (button.lit !== on()) button.press();
      });
    }
    let x = left + TITLE_WIDTH + bypassWidth + PITCH / 2;
    for (const dial of row.dials) {
      const share = () =>
        Math.min(
          1,
          Math.max(0, (dial.get() - dial.min) / (dial.max - dial.min)),
        );
      const knob = createKnob(kit, {
        radius: 0.011,
        style: 'skirted',
        scale: true,
        ink: '#2b2a25',
        value: share(),
      });
      knob.group.position.set(x, y + 0.006, 0);
      group.add(knob.group);
      uses.set(knob.group, (direction = 1) => {
        const next = stepKnob(share(), direction, dial.steps ?? 40);
        dial.set(dial.min + next * (dial.max - dial.min));
        touched = [`${row.title} · ${dial.name}`, shown(dial)];
      });
      updates.push(knob.update);
      follow.push(() => knob.set(share()));
      caption(dial.name, x, y - 0.0225, 0.0036);
      x += PITCH;
    }
    for (const spec of row.buttons ?? []) {
      const button = createEightiesButton(kit, spec.legend, spec.colour, {
        latching: Boolean(spec.lit),
        size: 0.019,
      });
      button.group.position.set(x - PITCH * 0.1, y + 0.004, 0);
      group.add(button.group);
      uses.set(button.cap, () => {
        spec.press();
        if (!spec.lit) button.press();
        touched = [`${row.title} · ${spec.legend}`, 'PRESSED'];
      });
      updates.push(button.update);
      if (spec.lit) {
        const lit = spec.lit;
        follow.push(() => {
          if (button.lit !== lit()) button.press();
        });
      }
      x += PITCH * 0.8;
    }
  });

  return {
    group,
    width,
    height,
    /** Every control and what a click on it does. */
    uses,
    update(delta: number) {
      for (const step of follow) step();
      for (const step of updates) step(delta);
    },
  };
}
