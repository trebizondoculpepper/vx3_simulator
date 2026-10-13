import { BoxGeometry, Group, Mesh } from 'three';
import type { Object3D } from 'three';
import { createPs1Material } from './ps1-material';
import {
  acknowledge,
  AMBIENT,
  createColumnPrep,
  FULL_BOTTLE,
  MAXIMUM,
  coreStage,
  driveLift,
  setActivation,
  setClamped,
} from '../game/column-prep';
import type { FerrocoreColumnRig } from '../scene/ferrocore-column-rig';
import {
  createEightiesButton,
  createMicroLabel,
  createPanelLed,
  createSevenSegment,
} from '../scene/eighties-controls';
import type { PanelKit } from '../scene/eighties-controls';
import { createKnob, createToggle } from '../scene/panel-switchgear';
import { stepKnob } from '../scene/rotary-knob';

/** The full scale of the AIR and XENON knobs, in bar. */
const AIR_FULL_BAR = 1;
const XENON_FULL_BAR = 2;
/** Detents across each knob's travel. */
const KNOB_STEPS = 20;

/**
 * The developer room's model drive: a stand whose controls write straight
 * into the concept rig's column model, so the rig can be driven to any
 * state without playing the cold start. Every control follows the model,
 * so its position always shows the live value. HOLD freezes the model's
 * physics, so values set by hand stay where they are put; the rams still
 * run, so HEAD UP always gets the head where it was sent.
 */
export function createModelDriveBoard(
  kit: PanelKit,
  rig: FerrocoreColumnRig,
  log: (text: string) => void = () => {},
) {
  const { prep, drive } = rig;
  const group = new Group();
  const backing = createPs1Material({ color: '#b9c3bd' });
  const stand = createPs1Material({ color: '#4a4d48' });
  kit.materials.push(backing, stand);
  const plate = new Mesh(new BoxGeometry(1.6, 1.1, 0.02), backing);
  plate.position.z = -0.01;
  group.add(plate);
  const post = new Mesh(new BoxGeometry(0.05, 1.2, 0.05), stand);
  post.position.set(0, -1.1, -0.05);
  group.add(post);
  const parts = new Group();
  parts.scale.setScalar(4);
  group.add(parts);

  const uses = new Map<Object3D, (direction?: number) => void>();
  const updates: ((delta: number) => void)[] = [];
  const follow: (() => void)[] = [];
  const at = (part: Object3D, x: number, y: number) => {
    part.position.set(x, y, 0);
    parts.add(part);
  };
  const caption = (text: string, x: number, y: number, height = 0.0028) => {
    const label = createMicroLabel(kit, text, { height, ink: '#2b2a25' });
    label.position.set(x, y, 0.0005);
    parts.add(label);
  };

  caption('MODELLSTEUERUNG · DIREKT', 0, 0.118, 0.006);
  caption(
    'DRIVES THE COLUMN MODEL DIRECTLY · BYPASSES THE PROCEDURE',
    0,
    0.104,
  );

  // Switches. Each shows the live state and sets it outright when thrown.
  const power = () => drive.power ?? rig.running;
  const switches: Array<[string, () => boolean, () => void]> = [
    [
      'POWER',
      power,
      () => {
        drive.power = !power();
        log(`Model drive: power ${drive.power ? 'on' : 'off'}.`);
      },
    ],
    [
      'HOLD',
      () => drive.hold,
      () => {
        drive.hold = !drive.hold;
        log(
          drive.hold
            ? 'Model drive: physics held. Set values stay put.'
            : 'Model drive: physics running.',
        );
      },
    ],
    [
      // Sets where the rams are going, not where the head is: the
      // mechanism takes it there at its own pace, held or not.
      'HEAD UP',
      () => prep.liftTarget === 1,
      () => {
        const up = prep.liftTarget !== 1;
        if (up && prep.clamped) {
          setClamped(prep, false);
          log('Model drive: clamps released to raise the head.');
        }
        driveLift(prep, up ? 1 : 0);
      },
    ],
    [
      'CLAMP',
      () => prep.clamped,
      () => {
        if (!setClamped(prep, !prep.clamped))
          log('Model drive: the clamps only close on a head that is down.');
      },
    ],
    ['INLET', () => prep.inletOpen, () => (prep.inletOpen = !prep.inletOpen)],
    [
      'OUTLET',
      () => prep.outletOpen,
      () => (prep.outletOpen = !prep.outletOpen),
    ],
  ];
  switches.forEach(([name, state, flip], i) => {
    const x = -0.16 + i * 0.064;
    const made = createToggle(kit, state());
    made.group.scale.setScalar(1.6);
    at(made.group, x, 0.075);
    uses.set(made.group, flip);
    updates.push(made.update);
    follow.push(() => made.set(state()));
    caption(name, x, 0.054);
  });

  // Knobs. A click steps the model's own value, so they never disagree.
  const knobs: Array<[string, () => number, (share: number) => void]> = [
    [
      'SET POINT',
      () => (prep.setpoint - AMBIENT) / (MAXIMUM - AMBIENT),
      (share) => setActivation(prep, AMBIENT + share * (MAXIMUM - AMBIENT)),
    ],
    [
      'AIR',
      () => prep.air / AIR_FULL_BAR,
      (share) => (prep.air = share * AIR_FULL_BAR),
    ],
    [
      'XENON',
      () => prep.xenon / XENON_FULL_BAR,
      (share) => (prep.xenon = share * XENON_FULL_BAR),
    ],
    [
      'BOTTLE',
      () => prep.supply / FULL_BOTTLE,
      (share) => (prep.supply = share * FULL_BOTTLE),
    ],
    ['BRIGHTNESS', () => prep.brightness, (share) => (prep.brightness = share)],
  ];
  knobs.forEach(([name, read, write], i) => {
    const x = -0.152 + i * 0.076;
    const made = createKnob(kit, {
      radius: 0.012,
      style: 'skirted',
      scale: true,
      ink: '#2b2a25',
      value: read(),
    });
    at(made.group, x, 0.018);
    uses.set(made.group, (direction = 1) => {
      write(stepKnob(Math.min(1, Math.max(0, read())), direction, KNOB_STEPS));
    });
    updates.push(made.update);
    follow.push(() => made.set(Math.min(1, Math.max(0, read()))));
    caption(name, x, -0.006);
  });

  // Readouts.
  const readouts: Array<[string, number, () => string]> = [
    ['CORE K', 4, () => String(Math.round(prep.temperature))],
    ['XE MBAR', 4, () => String(Math.round(prep.xenon * 1000))],
    ['AIR MBAR', 4, () => String(Math.round(prep.air * 1000))],
    [
      'BOTTLE %',
      3,
      () => String(Math.round((prep.supply / FULL_BOTTLE) * 100)),
    ],
  ];
  readouts.forEach(([name, digits, value], i) => {
    const x = -0.14 + i * 0.09;
    const made = createSevenSegment(kit, digits);
    at(made.group, x, -0.042);
    follow.push(() => made.show(value()));
    caption(name, x, -0.062);
  });

  // Buttons and the core's stage.
  const buttons: Array<[string, () => void]> = [
    [
      'SNAP',
      () => {
        prep.temperature = prep.setpoint;
        log(`Model drive: core snapped to ${Math.round(prep.setpoint)} K.`);
      },
    ],
    [
      'ACK',
      () => {
        acknowledge(prep);
        log('Model drive: failure acknowledged, fresh bottle fitted.');
      },
    ],
    [
      'RESET',
      () => {
        Object.assign(prep, createColumnPrep());
        drive.hold = false;
        drive.power = null;
        log('Model drive: model reset; power follows the rig again.');
      },
    ],
  ];
  buttons.forEach(([name, press], i) => {
    const x = -0.15 + i * 0.045;
    const made = createEightiesButton(kit, name, i === 2 ? 'red' : 'grey', {
      size: 0.02,
    });
    at(made.group, x, -0.1);
    uses.set(made.cap, () => {
      made.press();
      press();
    });
    updates.push(made.update);
  });
  const stages = [
    ['COLD', 'blue', 'cold'],
    ['GLOW', 'amber', 'glowing'],
    ['FULL', 'green', 'full'],
    ['FAIL', 'red', 'failed'],
  ] as const;
  stages.forEach(([name, colour, stage], i) => {
    const x = 0.03 + i * 0.04;
    const made = createPanelLed(kit, colour);
    made.group.scale.setScalar(1.6);
    at(made.group, x, -0.096);
    follow.push(() => made.set(coreStage(prep) === stage));
    caption(name, x, -0.112);
  });

  return {
    group,
    uses,
    update(delta: number) {
      for (const sync of follow) sync();
      for (const step of updates) step(delta);
    },
  };
}
