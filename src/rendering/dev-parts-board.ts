import { createLightSwitch } from '../scene/light-switch';
import {
  createKeyLockedSelector,
  createLedPushbutton,
  createMomentary,
  createSelector,
  createSwitch,
} from '../game/world/components';
import { createPartSoundHub } from './part-sound-hub';
import { BoxGeometry, Group, Mesh } from 'three';
import type { Object3D } from 'three';
import { createPs1Material } from './ps1-material';
import {
  createBarGraph,
  createEightiesButton,
  createMicroLabel,
  createPanelLed,
  createSevenSegment,
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
 *
 * Every control is a component (`src/game/world/components.ts`), and the
 * board shows the components' rules at work. The WIPPSCHALTER rocker is
 * the panel's supply: off, every lamp, LED and display goes dark and the
 * illuminated buttons do nothing, though they still click. The
 * SCHLÜSSELSCHALTER key switch is an interlock that latches the
 * illuminated buttons where they are. The isolator hums while it is on and
 * the rocker's neon buzzes while lit: state sounds, held by the parts.
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
  caption('BEDIENPRÜFUNG', 0, 0.126, 0.006);
  const wave = (seconds: number, seed: number) =>
    0.5 + 0.4 * Math.sin(seconds * 0.8 + seed);

  // The components' sounds, for the room to play.
  const hub = createPartSoundHub();

  // The supply and the interlock, which the other parts depend on.
  const supply = createSwitch({
    initial: true,
    sounds: { state: (p) => (p.on ? 'neon buzz' : null) },
  });
  const interlock = createSwitch();
  const power = supply.state;
  const latch = interlock.state;

  // Row 1: push buttons.
  const colours: CapColour[] = [
    'red',
    'amber',
    'green',
    'blue',
    'white',
    'grey',
  ];
  const buttonLegends = ['STOP', 'QUITT', 'FREI', 'SPÜL', 'PRÜF', 'RÜCKS.'];
  const lampLegends = ['NETZ', 'BEREIT', 'STÖR', 'PRÜF'];
  colours.forEach((colour, i) => {
    // Alternately push-on push-off and momentary.
    const latching = i % 2 === 0;
    const made = createEightiesButton(kit, buttonLegends[i], colour, {
      latching,
      lit: latching,
    });
    made.cap.name = `${buttonLegends[i]} illuminated button`;
    at(made.group, -0.19 + i * 0.026, 0.104);
    if (latching) {
      const part = createLedPushbutton({ power, latch, initial: true });
      hub.add(part, made.group, 'button', () => made.press());
      uses.set(made.cap, () => part.press());
      updates.push(() => {
        made.lit = part.state.value;
        made.glow = part.lit.value;
      });
    } else {
      const part = createMomentary({ power, latch });
      hub.add(part, made.group, 'button', () => made.press());
      uses.set(made.cap, () => part.press());
      // Lit while held in, if it is powered.
      updates.push(() => (made.glow = power.value ? null : false));
    }
    updates.push(made.update);
  });
  caption('LEUCHTTASTEN · RASTEND / MOMENTAN', -0.125, 0.085);
  (['green', 'amber', 'red', 'blue'] as const).forEach((led, i) => {
    const made = createEightiesButton(
      kit,
      lampLegends[i],
      i === 3 ? 'white' : 'grey',
      { led, lit: true },
    );
    made.cap.name = `${lampLegends[i]} LED-window button`;
    at(made.group, 0.0 + i * 0.026, 0.104);
    const part = createLedPushbutton({ power, latch, initial: true });
    hub.add(part, made.group, 'button', () => made.press());
    uses.set(made.cap, () => part.press());
    updates.push(() => {
      made.lit = part.state.value;
      made.glow = part.lit.value;
    });
    updates.push(made.update);
  });
  caption('MELDETASTEN', 0.04, 0.085);
  const pad = createKeypad(kit, [
    ['7', '8', '9'],
    ['4', '5', '6'],
  ]);
  at(pad.group, 0.16, 0.104);
  for (const k of pad.keys) {
    const part = createMomentary({ power });
    hub.add(part, k.group, 'key', () => k.press());
    uses.set(k.cap, () => part.press());
    updates.push(k.update);
  }
  caption('TASTENFELD', 0.16, 0.085);

  // Row 2: knobs and switches.
  const knobs: [string, Parameters<typeof createKnob>[1]][] = [
    ['SPANNZANGE', { style: 'collet' }],
    ['SKALENKNOPF', { style: 'skirted', scale: true, ink: '#2b2a25' }],
    [
      'FEINREGLER',
      { style: 'instrument', radius: 0.015, scale: true, ink: '#2b2a25' },
    ],
    [
      'BEREICHSWAHL',
      { style: 'pointer', radius: 0.012, scale: true, ink: '#2b2a25' },
    ],
  ];
  knobs.forEach(([name, options], i) => {
    const pointer = options?.style === 'pointer';
    // Pointer selectors click between six positions; knobs have ten steps.
    const part = createSelector({
      positions: pointer ? 6 : 11,
      initial: pointer ? 1 : 3,
    });
    const made = createKnob(kit, { ...options, value: part.share.value });
    const x = -0.18 + i * 0.045;
    made.group.name = `${name} knob`;
    at(made.group, x, 0.045);
    hub.add(part, made.group, pointer ? 'selector' : 'knob');
    uses.set(made.group, (direction = 1) => part.turn(direction));
    updates.push(() => made.set(part.share.value));
    updates.push(made.update);
    caption(name, x, 0.016);
  });
  const toggle = createToggle(kit, true);
  const toggled = createSwitch({ initial: true });
  toggle.group.name = 'KIPPSCHALTER';
  at(toggle.group, 0.02, 0.045);
  hub.add(toggled, toggle.group, 'toggle');
  uses.set(toggle.group, () => toggled.flip());
  updates.push(() => toggle.set(toggled.state.value));
  updates.push(toggle.update);
  caption('KIPPSCHALTER', 0.02, 0.016);
  const rocker = createRocker(kit, supply.state.value);
  rocker.group.name = 'WIPPSCHALTER · SPEISUNG';
  at(rocker.group, 0.065, 0.045);
  hub.add(supply, rocker.group, 'rocker');
  uses.set(rocker.group, () => supply.flip());
  updates.push(() => rocker.set(supply.state.value));
  updates.push(rocker.update);
  caption('WIPPSCHALTER · SPEISUNG', 0.065, 0.016);
  const lock = createKeySwitch(kit, interlock.state.value);
  lock.group.name = 'SCHLÜSSELSCHALTER · SPERRE';
  at(lock.group, 0.11, 0.045);
  hub.add(interlock, lock.group, 'key-switch');
  uses.set(lock.group, () => interlock.flip());
  updates.push(() => lock.set(interlock.state.value));
  updates.push(lock.update);
  caption('SCHLÜSSEL · SPERRE', 0.11, 0.016);
  const slid = createSelector({ positions: 3 });
  const slide = createSlideSwitch(kit, 3, slid.position.value);
  slide.group.name = 'SCHIEBESCHALTER';
  at(slide.group, 0.15, 0.045);
  hub.add(slid, slide.group, 'slide');
  uses.set(slide.group, (direction = 1) => slid.turn(direction));
  updates.push(() => slide.set(slid.position.value));
  updates.push(slide.update);
  caption('SCHIEBESCHALTER', 0.15, 0.016);
  at(createBnc(kit).group, 0.18, 0.05);
  at(createBananaJack(kit).group, 0.2, 0.05);
  caption('BNC · 4 mm', 0.19, 0.016);

  // Row 3: lamps and indicators.
  colours.forEach((colour, i) => {
    const made = createPanelLed(kit, colour, true);
    at(made.group, -0.19 + i * 0.012, -0.012);
    ticks.push((s) => made.set(power.value && Math.sin(s * 2 + i) > -0.3));
  });
  caption('MELDELEUCHTEN', -0.16, -0.03);
  ['#ff4a2e', '#ffb43a', '#7dff74', '#7fc8ff'].forEach((colour, i) => {
    const made = createJewelLamp(kit, colour);
    at(made.group, -0.1 + i * 0.022, -0.012);
    ticks.push((s) => made.set(power.value && Math.sin(s * 1.5 + i * 1.3) > 0));
  });
  caption('NETZ · WARN. · FREI · PRÜF', -0.067, -0.03);
  const bars = createBarGraph(kit, 10);
  at(bars.group, -0.01, -0.012);
  ticks.push((s) => bars.set(power.value ? wave(s * 2, 1) : 0));
  caption('FLUSS', -0.01, -0.04);
  const meter = createPanelMeter(kit, 'mA', { width: 0.05 });
  at(meter.group, 0.05, -0.022);
  ticks.push((s) => meter.set(power.value ? wave(s, 2) : 0));
  updates.push(meter.update);
  caption('KATODENSTROM', 0.05, -0.05);
  const gauge = createRoundGauge(kit, { radius: 0.022 });
  at(gauge.group, 0.14, -0.024);
  ticks.push((s) => gauge.set(power.value ? wave(s * 0.7, 3) : 0));
  updates.push(gauge.update);
  caption('VORVAKUUM', 0.14, -0.054);

  // Row 4: displays.
  const seg = createSevenSegment(kit, 5);
  at(seg.group, -0.16, -0.085);
  ticks.push((s) =>
    seg.show(power.value ? String(Math.round(12000 + s * 7) % 100000) : ''),
  );
  caption('IMPULSZÄHLER', -0.16, -0.103);
  const lcd = createCharacterLcd(kit, { columns: 16, rows: 2 });
  at(lcd.group, -0.065, -0.085);
  ticks.push((s) =>
    lcd.show(['FC-PRÜFSTAND', `LAUF ${s.toFixed(1)} s`], power.value),
  );
  caption('STATUSANZEIGE', -0.065, -0.109);
  const vfd = createVfd(kit, { columns: 8 });
  at(vfd.group, 0.04, -0.085);
  ticks.push((s) =>
    vfd.show([`${(35 + (s % 1) * 0.01).toFixed(3)}kH`], power.value),
  );
  caption('SCHWEBUNG · kHz', 0.04, -0.103);
  const matrix = createLedMatrix(kit, { columns: 10, rows: 5 });
  at(matrix.group, 0.13, -0.085);
  ticks.push((s) => {
    const step = Math.floor(s * 5);
    matrix.draw((c, r) => power.value && (c + r + step) % 6 < 2);
  });
  caption('KANALMELDUNG', 0.13, -0.103);

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
  heavyCaption('SCHALTGERÄTE · MASSSTAB 2:1', 0, 0.135);
  const locked = createKeyLockedSelector({ positions: 3 });
  const selector = createKeyLockedKnob(kit, {
    radius: 0.022,
    positions: 3,
    ink: '#2b2a25',
  });
  selector.group.position.set(-0.11, 0.02, 0);
  heavy.add(selector.group);
  selector.key.name = 'SCHWEBUNG key';
  selector.handle.name = 'SCHWEBUNG · BEREICH';
  hub.add(locked.key, selector.key, 'key-switch');
  // A refused turn shows as the handle giving a little and springing back.
  hub.add(locked.selector, selector.handle, 'selector', (event) => {
    if (event === 'refused') selector.turn(1);
  });
  uses.set(selector.key, () => locked.key.flip());
  uses.set(selector.handle, (direction = 1) => locked.selector.turn(direction));
  // The view keeps its own lock and position: bring them to the component's.
  updates.push(() => {
    if (selector.unlocked !== locked.key.state.value) selector.toggleLock();
    const behind = locked.selector.position.value - selector.position;
    if (behind !== 0) selector.turn(Math.sign(behind));
  });
  updates.push(selector.update);
  heavyCaption('SCHWEBUNG · BEREICH', -0.11, -0.07);
  heavyCaption('SCHLÜSSEL-FREIGABE', -0.11, -0.085);
  const isolated = createSwitch({
    sounds: { state: (p) => (p.on ? 'mains hum' : null) },
  });
  const isolator = createPowerIsolator(kit);
  isolator.group.name = 'HAUPTSCHALTER';
  isolator.group.position.set(0.09, 0.0, 0);
  heavy.add(isolator.group);
  hub.add(isolated, isolator.group, 'isolator');
  uses.set(isolator.group, () => isolated.flip());
  updates.push(() => isolator.set(isolated.state.value));
  updates.push(isolator.update);
  heavyCaption('HAUPTSCHALTER', 0.09, -0.1);
  // The same Bakelite wall switch as the lab, at twice life size.
  const light = createSwitch();
  const lightSwitch = createLightSwitch(1);
  lightSwitch.group.name = 'LABORLICHT';
  lightSwitch.group.position.set(0.29, -0.01, 0.02);
  heavy.add(lightSwitch.group);
  lightSwitch.update(light.state.value);
  hub.add(light, lightSwitch.group, 'rocker');
  uses.set(lightSwitch.group, () => light.flip());
  updates.push(() => lightSwitch.update(light.state.value));
  heavyCaption('LABORLICHT', 0.29, -0.12);

  return {
    group,
    uses,
    /** Hear the transition sounds of the board's parts. */
    onSound: hub.onSound,
    /** Hear the state sounds the board's parts hold. */
    onHeld: hub.onHeld,
    dispose() {
      hub.dispose();
      lightSwitch.dispose();
    },
    update(seconds: number, delta: number) {
      for (const tick of ticks) tick(seconds);
      for (const step of updates) step(delta);
    },
  };
}
