import { createLightSwitch } from '../scene/light-switch';
import { stepKnob } from '../scene/rotary-knob';
import { BoxGeometry, Group, Mesh } from 'three';
import type { Object3D } from 'three';
import { createPs1Material } from './ps1-material';
import {
  createBarGraph,
  createEightiesButton,
  createMicroLabel,
  createPanelLed,
  createSevenSegment,
  GERMAN_COUNT,
} from '../scene/eighties-controls';
import type { CapColour, PanelKit } from '../scene/eighties-controls';
import {
  createBananaJack,
  createBnc,
  createKeyLockedKnob,
  createKeySwitch,
  createPowerIsolator,
  createKeypad,
  createKnob,
  createRocker,
  createSlideSwitch,
  createToggle,
} from '../scene/panel-switchgear';
import {
  createCharacterLcd,
  createJewelLamp,
  createLedMatrix,
  createPanelMeter,
  createRoundGauge,
  createVfd,
} from '../scene/panel-instruments';

/**
 * The developer room's CONTROL TEST board: one of every 1980s panel part,
 * four times life size on a stand, each captioned, every control working
 * and every display running, so a part can be checked on its own before
 * it goes onto a panel. Below them, at twice life size, the heavier
 * switchgear: a key-locked selector and a rotary power isolator.
 */
export function createPartsBoard(kit: PanelKit) {
  const group = new Group();
  const backing = createPs1Material({ color: '#c9c7bb' });
  const stand = createPs1Material({ color: '#4a4d48' });
  kit.materials.push(backing, stand);
  // The plate runs from the parts rows down past the heavy switchgear.
  const plate = new Mesh(new BoxGeometry(1.7, 1.78, 0.02), backing);
  plate.position.set(0, -0.35, -0.01);
  group.add(plate);
  const post = new Mesh(new BoxGeometry(0.05, 1.6, 0.05), stand);
  post.position.set(0, -1.9, -0.05);
  group.add(post);
  const parts = new Group();
  parts.scale.setScalar(4);
  group.add(parts);

  const uses = new Map<Object3D, (direction?: number) => void>();
  const updates: ((delta: number) => void)[] = [];
  const ticks: ((seconds: number) => void)[] = [];
  const at = (part: Object3D, x: number, y: number) => {
    part.position.set(x, y, 0);
    parts.add(part);
  };
  const caption = (text: string, x: number, y: number, height = 0.0026) => {
    const label = createMicroLabel(kit, text, {
      height,
      ink: '#2b2a25',
    });
    label.position.set(x, y, 0.0005);
    parts.add(label);
  };
  caption('CONTROL TEST', 0, 0.126, 0.006);
  const wave = (seconds: number, seed: number) =>
    0.5 + 0.4 * Math.sin(seconds * 0.8 + seed);

  // Row 1: push buttons.
  const colours: CapColour[] = [
    'red',
    'amber',
    'green',
    'blue',
    'white',
    'grey',
  ];
  colours.forEach((colour, i) => {
    const made = createEightiesButton(kit, colour.toUpperCase(), colour, {
      latching: i % 2 === 0,
      lit: i % 2 === 0,
    });
    made.cap.name = `${colour.toUpperCase()} illuminated button`;
    at(made.group, -0.19 + i * 0.026, 0.104);
    uses.set(made.cap, made.press);
    updates.push(made.update);
  });
  caption('ILLUMINATED CAP · EVEN LATCHING, ODD MOMENTARY', -0.125, 0.085);
  (['green', 'amber', 'red', 'blue'] as const).forEach((led, i) => {
    const made = createEightiesButton(
      kit,
      GERMAN_COUNT[i],
      i === 3 ? 'white' : 'grey',
      {
        led,
        lit: true,
      },
    );
    made.cap.name = `${GERMAN_COUNT[i]} LED-window button`;
    at(made.group, 0.0 + i * 0.026, 0.104);
    uses.set(made.cap, made.press);
    updates.push(made.update);
  });
  caption('LED-WINDOW CAP · ANY LED COLOUR', 0.04, 0.085);
  const pad = createKeypad(kit, [
    ['7', '8', '9'],
    ['4', '5', '6'],
  ]);
  at(pad.group, 0.16, 0.104);
  for (const k of pad.keys) {
    uses.set(k.cap, k.press);
    updates.push(k.update);
  }
  caption('KEYCAPS', 0.16, 0.085);

  // Row 2: knobs and switches.
  const knobs: [string, Parameters<typeof createKnob>[1]][] = [
    ['COLLET', { style: 'collet' }],
    ['SKIRTED', { style: 'skirted', scale: true, ink: '#2b2a25' }],
    [
      'INSTRUMENT',
      { style: 'instrument', radius: 0.015, scale: true, ink: '#2b2a25' },
    ],
    [
      'POINTER',
      { style: 'pointer', radius: 0.012, scale: true, ink: '#2b2a25' },
    ],
  ];
  knobs.forEach(([name, options], i) => {
    let value = 0.3;
    const made = createKnob(kit, { ...options, value });
    const x = -0.18 + i * 0.045;
    made.group.name = `${name} knob`;
    at(made.group, x, 0.045);
    uses.set(made.group, (direction = 1) => {
      value = stepKnob(value, direction);
      made.set(value);
    });
    updates.push(made.update);
    caption(name, x, 0.016);
  });
  let up = true;
  const toggle = createToggle(kit, up);
  toggle.group.name = 'TOGGLE';
  at(toggle.group, 0.02, 0.045);
  uses.set(toggle.group, () => toggle.set((up = !up)));
  updates.push(toggle.update);
  caption('TOGGLE', 0.02, 0.016);
  let mains = true;
  const rocker = createRocker(kit, mains);
  rocker.group.name = 'ROCKER';
  at(rocker.group, 0.065, 0.045);
  uses.set(rocker.group, () => rocker.set((mains = !mains)));
  updates.push(rocker.update);
  caption('ROCKER', 0.065, 0.016);
  let turned = false;
  const lock = createKeySwitch(kit, turned);
  lock.group.name = 'KEY SWITCH';
  at(lock.group, 0.11, 0.045);
  uses.set(lock.group, () => lock.set((turned = !turned)));
  updates.push(lock.update);
  caption('KEY SWITCH', 0.11, 0.016);
  let position = 0;
  const slide = createSlideSwitch(kit, 3, position);
  slide.group.name = 'SLIDE';
  at(slide.group, 0.15, 0.045);
  uses.set(slide.group, () => slide.set((position = (position + 1) % 3)));
  updates.push(slide.update);
  caption('SLIDE', 0.15, 0.016);
  at(createBnc(kit).group, 0.18, 0.05);
  at(createBananaJack(kit).group, 0.2, 0.05);
  caption('BNC · 4 mm', 0.19, 0.016);

  // Row 3: lamps and indicators.
  colours.forEach((colour, i) => {
    const made = createPanelLed(kit, colour, true);
    at(made.group, -0.19 + i * 0.012, -0.012);
    ticks.push((s) => made.set(Math.sin(s * 2 + i) > -0.3));
  });
  caption('5 mm LEDS', -0.16, -0.03);
  ['#ff4a2e', '#ffb43a', '#7dff74', '#7fc8ff'].forEach((colour, i) => {
    const made = createJewelLamp(kit, colour);
    at(made.group, -0.1 + i * 0.022, -0.012);
    ticks.push((s) => made.set(Math.sin(s * 1.5 + i * 1.3) > 0));
  });
  caption('JEWEL LAMPS', -0.067, -0.03);
  const bars = createBarGraph(kit, 10);
  at(bars.group, -0.01, -0.012);
  ticks.push((s) => bars.set(wave(s * 2, 1)));
  caption('BAR GRAPH', -0.01, -0.04);
  const meter = createPanelMeter(kit, 'mA', { width: 0.05 });
  at(meter.group, 0.05, -0.022);
  ticks.push((s) => meter.set(wave(s, 2)));
  updates.push(meter.update);
  caption('PANEL METER', 0.05, -0.05);
  const gauge = createRoundGauge(kit, { radius: 0.022 });
  at(gauge.group, 0.14, -0.024);
  ticks.push((s) => gauge.set(wave(s * 0.7, 3)));
  updates.push(gauge.update);
  caption('ROUND GAUGE', 0.14, -0.054);

  // Row 4: displays.
  const seg = createSevenSegment(kit, 5);
  at(seg.group, -0.16, -0.085);
  ticks.push((s) => seg.show(String(Math.round(12000 + s * 7) % 100000)));
  caption('SEVEN-SEGMENT', -0.16, -0.103);
  const lcd = createCharacterLcd(kit, { columns: 16, rows: 2 });
  at(lcd.group, -0.065, -0.085);
  ticks.push((s) => lcd.show(['CHARACTER LCD', `T+ ${s.toFixed(1)} S`]));
  caption('CHARACTER LCD', -0.065, -0.109);
  const vfd = createVfd(kit, { columns: 8 });
  at(vfd.group, 0.04, -0.085);
  ticks.push((s) => vfd.show([`VFD ${(s % 100).toFixed(1)}`]));
  caption('VFD', 0.04, -0.103);
  const matrix = createLedMatrix(kit, { columns: 10, rows: 5 });
  at(matrix.group, 0.13, -0.085);
  ticks.push((s) => {
    const step = Math.floor(s * 5);
    matrix.draw((c, r) => (c + r + step) % 6 < 2);
  });
  caption('LED MATRIX', 0.13, -0.103);

  // Row 5: the heavier switchgear, at twice life size.
  const heavy = new Group();
  heavy.scale.setScalar(2);
  heavy.position.set(0, -0.82, 0);
  group.add(heavy);
  const heavyCaption = (text: string, x: number, y: number) => {
    const label = createMicroLabel(kit, text, {
      height: 0.005,
      ink: '#2b2a25',
    });
    label.position.set(x, y, 0.0005);
    heavy.add(label);
  };
  heavyCaption('HEAVY SWITCHGEAR · TWICE LIFE SIZE', 0, 0.135);
  const selector = createKeyLockedKnob(kit, {
    radius: 0.022,
    positions: 3,
    ink: '#2b2a25',
  });
  selector.group.position.set(-0.11, 0.02, 0);
  heavy.add(selector.group);
  uses.set(selector.key, selector.toggleLock);
  uses.set(selector.handle, (direction = 1) => {
    selector.turn(direction);
  });
  updates.push(selector.update);
  heavyCaption('KEY-LOCKED SELECTOR', -0.11, -0.07);
  heavyCaption('TURN THE KEY TO UNLOCK', -0.11, -0.085);
  const isolator = createPowerIsolator(kit);
  isolator.group.position.set(0.09, 0.0, 0);
  heavy.add(isolator.group);
  uses.set(isolator.group, isolator.toggle);
  updates.push(isolator.update);
  heavyCaption('POWER ISOLATOR', 0.09, -0.1);
  // The same Bakelite wall switch as the lab, at twice life size.
  const lightSwitch = createLightSwitch(1);
  lightSwitch.group.name = 'LAB LIGHT SWITCH';
  lightSwitch.group.position.set(0.29, -0.01, 0.02);
  heavy.add(lightSwitch.group);
  let lightOn = false;
  lightSwitch.update(lightOn);
  uses.set(lightSwitch.group, () => {
    lightOn = !lightOn;
    lightSwitch.update(lightOn);
  });
  heavyCaption('LAB LIGHT SWITCH', 0.29, -0.12);

  return {
    group,
    uses,
    dispose() {
      lightSwitch.dispose();
    },
    update(seconds: number, delta: number) {
      for (const tick of ticks) tick(seconds);
      for (const step of updates) step(delta);
    },
  };
}
