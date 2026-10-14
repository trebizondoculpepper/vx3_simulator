import { BoxGeometry, Group, Mesh } from 'three';
import type { Object3D } from 'three';
import { createPs1Material } from './ps1-material';
import {
  createEightiesButton,
  createMicroLabel,
  createPanelLed,
} from '../scene/eighties-controls';
import type { CapColour, PanelKit } from '../scene/eighties-controls';
import { createKnob, createToggle } from '../scene/panel-switchgear';
import { createCharacterLcd } from '../scene/panel-instruments';
import { signal } from '@preact/signals-core';
import { createPartSoundHub } from './part-sound-hub';
import { annunciators } from '../game/control-board';
import {
  createLedPushbutton,
  createMomentary,
  createSelector,
  createSwitch,
} from '../game/world/components';
import type { LedPushbutton, PartSounds } from '../game/world/components';
import type { World } from '../game/world/world';

/**
 * The developer room's cold-start board: a remote for the graph-based
 * world model (`src/game/world/world.ts`), laid out as the procedure. The
 * top row seals, purges and charges the vessel; the bottom row lights the
 * ferrocore. Work each row from left to right; a step's lamp lights when
 * its goal is reached. Every control here only works a control of the
 * world model, so anything the board can do, the lab's own panels can.
 *
 * Below the steps are tools for the failures (NOT-AUS, QUITT, a fresh
 * core, the fire circuit), a TEMPO knob that runs the world faster, a
 * NACHFÜHREN switch that keeps TRIMM on SOLL by itself, and the east
 * board's eighteen alarm windows as lamps.
 */

interface Step {
  legend: string;
  /** What to do, or what to wait for, printed under the control. */
  hint: string;
  control:
    | { kind: 'button'; colour: CapColour; press(): void }
    | {
        kind: 'switch';
        get(): boolean;
        flip(): void;
        sounds?: PartSounds;
      }
    | { kind: 'led toggle'; colour: CapColour; part: LedPushbutton }
    | { kind: 'knob'; get(): number; set(value: number): void; steps: number };
  /** Lit once the step's goal holds. */
  done(): boolean;
}

const PITCH = 0.07;
const ROW = 0.095;

export function createColdStartBoard(
  kit: PanelKit,
  world: () => World,
  log: (text: string) => void = () => {},
  restart: () => void = () => {},
  /** Stand it on its own post; leave out for a desk to carry it. */
  { post: standing = true } = {},
) {
  const w = () => world();
  const read = <T>(id: string) => w().read<T>(id);
  const work = (id: string, setting?: number) => w().work(id, setting);
  const columnSwitches = ['column.isolator', 'column.netz', 'column.rocker'];

  // Test conveniences, not part of the world.
  const tempo = signal(1);
  // Bumped when the world is replaced, so components bound to it re-read.
  const generation = signal(0);
  /** A world value, read so that a component tracks it. */
  const live = <T>(id: string) => ({
    get value() {
      void generation.value;
      return read<T>(id);
    },
  });
  /** A world value a button shows, set through the action that flips it. */
  const flippedBy = (id: string, action: string) => ({
    get value() {
      void generation.value;
      return read<boolean>(id);
    },
    set(on: boolean) {
      if (on !== read(id) && !work(action))
        log(`${action}: refused; the column has no supply.`);
    },
  });
  // Powered by the column's supply, as on the column itself.
  const clamps = createLedPushbutton({
    power: live('column.running'),
    bound: flippedBy('vessel.clamped', 'column.SPANNEN'),
  });
  const inlet = createLedPushbutton({
    power: live('column.running'),
    bound: flippedBy('vessel.inletOpen', 'column.XE EIN'),
  });
  // The outlet to the pump: a hand valve, so it needs no supply.
  const purge = createLedPushbutton({
    bound: flippedBy('vessel.outletOpen', 'column.outlet'),
  });
  // Bound to nothing: it keeps its own state, and the board reads it.
  const tracker = createLedPushbutton();

  const vessel: Step[] = [
    {
      legend: 'HAUPTSCHALTER',
      hint: 'PLANT SUPPLY',
      control: {
        kind: 'switch',
        get: () => read('plant.master'),
        flip: () => work('plant.master'),
        // A heavy main switch: it sounds like the breaker it is.
        sounds: { transitions: { on: 'breaker-on', off: 'breaker-off' } },
      },
      done: () => read('plant.powered'),
    },
    {
      legend: 'SÄULE EIN',
      hint: 'COLUMN SUPPLY',
      control: {
        kind: 'switch',
        get: () => columnSwitches.every((id) => read(id)),
        flip: () => {
          const on = !columnSwitches.every((id) => read(id));
          for (const id of columnSwitches) if (read(id) !== on) work(id);
        },
      },
      done: () => read('column.running'),
    },
    {
      legend: 'SENKEN',
      hint: 'HEAD DOWN · 6 S',
      control: {
        kind: 'button',
        colour: 'grey',
        press: () => work('column.SENKEN'),
      },
      done: () => read<number>('vessel.lift') === 0,
    },
    {
      legend: 'SPANNEN',
      hint: 'CLAMP · AGAIN: RELEASE',
      control: { kind: 'led toggle', colour: 'grey', part: clamps },
      done: () => read('vessel.sealed'),
    },
    {
      legend: 'XE EIN',
      hint: 'INLET · AGAIN: SHUT',
      control: { kind: 'led toggle', colour: 'white', part: inlet },
      done: () => read('vessel.inletOpen'),
    },
    {
      legend: 'SPÜLEN',
      hint: 'PURGE · AT O2 = 0 SHUT',
      control: { kind: 'led toggle', colour: 'amber', part: purge },
      done: () => read('vessel.purged'),
    },
    {
      legend: 'XE-REGLER',
      hint: 'XENON FLOW ≥ 2 SLPM',
      control: {
        kind: 'knob',
        get: () => read('xenon.regulator'),
        set: (value) => work('xenon.regulator', value),
        steps: 10,
      },
      done: () => read<number>('xenon.flowSlpm') >= 2,
    },
    {
      legend: 'KREISLAUF',
      hint: 'RECIRCULATOR · PERMIT',
      control: {
        kind: 'switch',
        get: () => read('recirculator.switch'),
        flip: () => work('recirculator.switch'),
      },
      done: () => read('drive.permit'),
    },
  ];

  const drive: Step[] = [
    {
      legend: 'NETZ',
      hint: 'DRIVE BREAKER',
      control: {
        kind: 'button',
        colour: 'red',
        press: () => {
          if (!read('drive.mains') && !work('board.NETZ'))
            log('NETZ refused: the plant or the column is switched off.');
        },
      },
      done: () => read('drive.mains'),
    },
    {
      legend: 'ZÜND',
      hint: 'HEATERS · WAIT WARM',
      control: {
        kind: 'button',
        colour: 'amber',
        press: () => work('column.ZÜND'),
      },
      done: () => read<number>('rig.heater') >= 0.95,
    },
    {
      legend: 'DREHZAHL',
      hint: 'SPINDLE · 8 IS SAFE',
      control: {
        kind: 'knob',
        get: () => read('drive.spindle'),
        set: (value) => work('drive.spindle', value),
        steps: 20,
      },
      done: () => {
        const set = read<number>('drive.spindle');
        return set > 0.1 && Math.abs(read<number>('rig.spindle') - set) < 0.03;
      },
    },
    {
      legend: 'FELD',
      hint: 'FIELD · 8 IS SAFE',
      control: {
        kind: 'knob',
        get: () => read('drive.field'),
        set: (value) => work('drive.field', value),
        steps: 20,
      },
      done: () => read<number>('rig.field') > 0.2,
    },
    {
      legend: 'TRIMM',
      hint: 'TURN TO SOLL · LOCK',
      control: {
        kind: 'knob',
        get: () => read('drive.trim'),
        set: (value) => work('drive.trim', value),
        steps: 20,
      },
      done: () =>
        read<number>('rig.field') > 0.2 &&
        read<number>('rig.instability') < 0.1,
    },
  ];

  const tools: Step[] = [
    {
      legend: 'NOT-AUS',
      hint: 'TRIP THE DRIVE',
      control: {
        kind: 'button',
        colour: 'red',
        press: () => work('board.NOT-AUS'),
      },
      done: () => false,
    },
    {
      legend: 'QUITT',
      hint: 'ACKNOWLEDGE ALARMS',
      control: {
        kind: 'button',
        colour: 'white',
        press: () => work('board.QUITT'),
      },
      done: () => false,
    },
    {
      legend: 'RÜCKS.',
      hint: 'FRESH CORE',
      control: {
        kind: 'button',
        colour: 'grey',
        press: () => work('board.RÜCKS.'),
      },
      done: () => read('vessel.failure') !== null,
    },
    {
      legend: 'FEUER',
      hint: 'FIRE CALL POINT',
      control: {
        kind: 'button',
        colour: 'red',
        press: () => work('fire.Handfeuermelder'),
      },
      done: () => read('fire.alarm'),
    },
    {
      legend: 'BMZ RÜCKS.',
      hint: 'RESET FIRE PANEL',
      control: {
        kind: 'button',
        colour: 'grey',
        press: () => {
          if (!work('fire.RÜCKSTELLEN'))
            log('Fire panel reset refused: smoke or fire present.');
        },
      },
      done: () => false,
    },
    {
      legend: 'NACHFÜHREN',
      hint: 'TRIMM FOLLOWS SOLL',
      control: { kind: 'led toggle', colour: 'green', part: tracker },
      done: () => tracker.state.value,
    },
    {
      legend: 'NEUSTART',
      hint: 'NEW, COLD WORLD',
      control: {
        kind: 'button',
        colour: 'red',
        press: () => {
          restart();
          generation.value++;
        },
      },
      done: () => false,
    },
    {
      legend: 'TEMPO',
      hint: 'TIME × 1 2 4 8 16',
      control: {
        kind: 'knob',
        get: () => Math.log2(tempo.value) / 4,
        set: (value) => {
          tempo.value = 2 ** Math.round(value * 4);
          log(`Tempo × ${tempo.value}.`);
        },
        steps: 4,
      },
      done: () => tempo.value > 1,
    },
  ];

  // ---- The board -------------------------------------------------------------

  const group = new Group();
  const parts = new Group();
  parts.scale.setScalar(4);
  group.add(parts);
  const columns = Math.max(vessel.length, drive.length + 1, tools.length);
  const width = columns * PITCH + 0.06;
  const height = 0.44;
  const backing = createPs1Material({ color: '#c6ccc4' });
  const band = createPs1Material({ color: '#2b3a35' });
  const stand = createPs1Material({ color: '#4a4d48' });
  kit.materials.push(backing, band, stand);
  const plate = new Mesh(new BoxGeometry(width, height, 0.006), backing);
  plate.position.set(0, 0, -0.003);
  parts.add(plate);
  if (standing) {
    const post = new Mesh(new BoxGeometry(0.05, 1.2, 0.05), stand);
    post.position.set(0, -1.15, -0.05);
    group.add(post);
  }

  const uses = new Map<Object3D, (direction?: number) => void>();
  // The components' sounds, for the room to play.
  const hub = createPartSoundHub();
  const heard = hub.add;
  const updates: ((delta: number) => void)[] = [];
  const follow: (() => void)[] = [];
  const left = -width / 2 + 0.03 + PITCH / 2;
  const top = height / 2 - 0.035;
  const caption = (
    text: string,
    x: number,
    y: number,
    size = 0.0042,
    plateColour: string | null = null,
  ) => {
    const label = createMicroLabel(kit, text, {
      height: size,
      ink: plateColour ? '#f1ecdc' : '#22231f',
      plate: plateColour,
    });
    // A title rides in front of its bar.
    label.position.set(x, y, plateColour ? 0.0012 : 0.0006);
    parts.add(label);
  };

  caption('KALTSTART · COLD START · GRAPH WORLD MODEL', 0, top + 0.012, 0.007);
  caption(
    'WORK EACH ROW LEFT TO RIGHT · A LAMP LIGHTS WHEN ITS STEP IS DONE',
    0,
    top - 0.004,
    0.0042,
  );

  const placeRow = (steps: Step[], title: string, y: number) => {
    const bar = new Mesh(new BoxGeometry(width - 0.02, 0.012, 0.001), band);
    bar.position.set(0, y + 0.043, 0.0004);
    parts.add(bar);
    caption(title, 0, y + 0.043, 0.0058, '#2b3a35');
    steps.forEach((step, i) => {
      const x = left + i * PITCH;
      const number = title.startsWith('WERKZEUG') ? '' : `${i + 1} `;
      // Above the control, clear of a knob's printed scale.
      caption(
        `${number}${step.legend}`,
        x,
        y + (step.control.kind === 'knob' ? 0.025 : 0.019),
        0.0045,
      );
      caption(step.hint, x, y - 0.034, 0.0033);
      const lamp = createPanelLed(kit, 'green');
      lamp.group.scale.setScalar(1.4);
      lamp.group.position.set(x + 0.024, y + 0.004, 0);
      parts.add(lamp.group);
      follow.push(() => lamp.set(step.done()));
      const { control } = step;
      // A world value, read so that a component tracks it, and set
      // through the step's own control.
      const tracked = <T>(get: () => T) => {
        void generation.value;
        return get();
      };
      if (control.kind === 'button') {
        const part = createMomentary({ action: control.press });
        const made = createEightiesButton(
          kit,
          step.legend.slice(0, 6),
          control.colour,
          { latching: false, size: 0.026 },
        );
        made.group.position.set(x, y, 0);
        parts.add(made.group);
        made.cap.name = step.legend;
        heard(part, made.group, 'button', () => made.press());
        uses.set(made.cap, () => part.press());
        updates.push(made.update);
      } else if (control.kind === 'led toggle') {
        // In while its state is on; lit only while powered as well.
        const made = createEightiesButton(
          kit,
          step.legend.slice(0, 6),
          control.colour,
          {
            latching: true,
            size: 0.026,
            led: control.colour === 'grey' ? 'green' : null,
          },
        );
        made.group.position.set(x, y, 0);
        parts.add(made.group);
        made.cap.name = step.legend;
        heard(control.part, made.group, 'button', () => made.press());
        uses.set(made.cap, () => {
          if (!control.part.press()) log(`${step.legend}: no change.`);
        });
        updates.push(made.update);
        follow.push(() => {
          made.lit = control.part.state.value;
          made.glow = control.part.lit.value;
        });
      } else if (control.kind === 'switch') {
        const part = createSwitch({
          sounds: control.sounds,
          bound: {
            get value() {
              return tracked(control.get);
            },
            set: (on) => {
              if (on !== control.get()) control.flip();
            },
          },
        });
        const made = createToggle(kit, part.state.value);
        made.group.scale.setScalar(1.8);
        made.group.position.set(x, y, 0);
        made.group.name = step.legend;
        parts.add(made.group);
        heard(part, made.group, 'toggle');
        uses.set(made.group, () => part.flip());
        updates.push(made.update);
        follow.push(() => made.set(part.state.value));
      } else {
        const part = createSelector({
          positions: control.steps + 1,
          bound: {
            get value() {
              return tracked(control.get);
            },
            set: control.set,
          },
        });
        const made = createKnob(kit, {
          radius: 0.014,
          style: 'skirted',
          scale: true,
          ink: '#2b2a25',
          value: part.share.value,
        });
        made.group.position.set(x, y, 0);
        made.group.name = step.legend;
        parts.add(made.group);
        heard(part, made.group, 'knob');
        // As everywhere in the game: left half down a detent, right half up.
        uses.set(made.group, (direction = 1) => part.turn(direction));
        updates.push(made.update);
        follow.push(() => made.set(part.share.value));
      }
    });
  };

  const row1 = top - 0.08;
  placeRow(
    vessel,
    'GRUPPE 1 · KESSEL · SEAL, PURGE AND CHARGE THE VESSEL',
    row1,
  );
  placeRow(drive, 'GRUPPE 2 · ANTRIEB · LIGHT THE FERROCORE', row1 - ROW);
  // The procedure's end, beside the drive's row.
  {
    const x = left + drive.length * PITCH;
    const y = row1 - ROW;
    const lamp = createPanelLed(kit, 'blue');
    lamp.group.scale.setScalar(3);
    lamp.group.position.set(x, y, 0);
    parts.add(lamp.group);
    follow.push(() => lamp.set(read('plant.fullyOperational')));
    caption('VOLLBETRIEB', x, y + 0.019, 0.0045);
    caption('FULLY OPERATIONAL', x, y - 0.034, 0.0033);
  }
  // The trim display: what TRIMM is set to and where SOLL is.
  {
    const lcd = createCharacterLcd(kit, { columns: 20, rows: 3, cell: 0.0042 });
    lcd.group.position.set(left + (drive.length + 1.7) * PITCH, row1 - ROW, 0);
    parts.add(lcd.group);
    follow.push(() => {
      const oxygen = read<number>('vessel.oxygen');
      lcd.show([
        `TRIMM ${read<number>('drive.trim').toFixed(2)} SOLL ${read<number>('drive.idealTrim').toFixed(2)}`,
        `O2 ${oxygen.toFixed(oxygen < 1 ? 2 : 1)}% XE ${read<number>('vessel.xenon').toFixed(2)} BAR`,
        `KERN ${Math.round(read<number>('vessel.temperature'))} K ${String(read('vessel.stage')).toUpperCase()}`,
      ]);
    });
  }
  placeRow(tools, 'WERKZEUG · TOOLS AND FAILURES', row1 - 2 * ROW);

  // The east board's alarm windows, as a row of lamps.
  const alarmY = row1 - 3 * ROW + 0.012;
  caption(
    'ALARME · THE EAST BOARD’S WINDOWS',
    0,
    alarmY + 0.03,
    0.0058,
    '#2b3a35',
  );
  const alarmPitch = (width - 0.04) / annunciators.length;
  annunciators.forEach((a, i) => {
    const x = -width / 2 + 0.02 + alarmPitch * (i + 0.5);
    const lamp = createPanelLed(kit, a.colour === 'red' ? 'red' : 'amber');
    lamp.group.scale.setScalar(1.3);
    lamp.group.position.set(x, alarmY + 0.008, 0);
    parts.add(lamp.group);
    follow.push(() => lamp.set(read(`board.window.${a.label}`)));
    caption(a.label, x, alarmY - 0.012, 0.0028);
  });
  caption(
    'FAILURES: AT FULL POWER PRESS SPANNEN (BURNOUT) · NACHFÜHREN OFF, TRIMM AWAY (TRIP) · DREHZAHL AND FELD TO 10 (SMOKE, FIRE) · KREISLAUF OFF',
    0,
    -height / 2 + 0.012,
    0.0032,
  );

  return {
    group,
    uses,
    /** The face's size, metres. */
    width: width * 4,
    height: height * 4,
    /** How fast world time runs here. */
    get tempo() {
      return tempo.value;
    },
    /** Whether TRIMM is kept on SOLL by the board. */
    get tracking() {
      return tracker.state.value;
    },
    /** Hear the sounds the board's components make, and where. */
    /** Hear the transition sounds of the board's parts. */
    onSound: hub.onSound,
    /** Hear the state sounds the board's parts hold. */
    onHeld: hub.onHeld,
    dispose: hub.dispose,
    /** Press, flip or turn a step by its legend, as a click would. */
    work(legend: string, direction = 1) {
      for (const [object, use] of uses)
        if (object.name === legend) {
          use(direction);
          return true;
        }
      return false;
    },
    update(delta: number) {
      for (const sync of follow) sync();
      for (const step of updates) step(delta);
    },
  };
}
