import { describe, expect, it } from 'vitest';
import { signal } from '@preact/signals-core';
import {
  createKeyLockedSelector,
  createLedPushbutton,
  createMomentary,
  createSelector,
  createSwitch,
} from './components';
import type { PartEvent } from './components';
import { createWorld } from './world';

/** Record every event a component makes. */
function heard(part: { onEvent(l: (e: PartEvent) => void): unknown }) {
  const events: PartEvent[] = [];
  part.onEvent((e) => events.push(e));
  return events;
}

describe('an LED pushbutton', () => {
  it('toggles its state when powered and unlatched, bound to nothing', () => {
    const b = createLedPushbutton({ power: signal(true) });
    expect(b.press()).toBe(true);
    expect(b.state.value).toBe(true);
    expect(b.lit.value).toBe(true);
    b.press();
    expect(b.state.value).toBe(false);
    expect(b.lit.value).toBe(false);
  });

  it('keeps its LED off and its state unchanged without power', () => {
    const power = signal(false);
    const b = createLedPushbutton({ power });
    expect(b.press()).toBe(false);
    expect(b.state.value).toBe(false);
    power.value = true;
    b.press();
    expect(b.lit.value).toBe(true);
    // An on button loses its light, not its state, when the power goes.
    power.value = false;
    expect(b.state.value).toBe(true);
    expect(b.lit.value).toBe(false);
  });

  it('does not change state while latched', () => {
    const latch = signal(true);
    const b = createLedPushbutton({ latch, initial: true });
    expect(b.press()).toBe(false);
    expect(b.state.value).toBe(true);
    latch.value = false;
    expect(b.press()).toBe(true);
    expect(b.state.value).toBe(false);
  });

  it('clicks on every press, whatever its power and latch', () => {
    const power = signal(false);
    const latch = signal(false);
    const b = createLedPushbutton({ power, latch });
    const events = heard(b);
    b.press();
    power.value = true;
    latch.value = true;
    b.press();
    latch.value = false;
    b.press();
    expect(events).toEqual(['press', 'press', 'press']);
  });

  it('shows and sets a world value it is bound to', () => {
    const world = createWorld();
    const recirculator = world.graph.get('recirculator.switch')!;
    const b = createLedPushbutton({
      bound: {
        get value() {
          return recirculator.value as boolean;
        },
        set: (on) => {
          if (on !== recirculator.value) world.work('recirculator.switch');
        },
      },
    });
    b.press();
    expect(world.read('recirculator.working')).toBe(true);
    // The world moved it some other way: the button follows.
    world.work('recirculator.switch');
    expect(b.lit.value).toBe(false);
  });
});

describe('a momentary pushbutton', () => {
  it('acts while powered and unlatched, and always clicks', () => {
    let count = 0;
    const power = signal(true);
    const latch = signal(false);
    const b = createMomentary({ power, latch, action: () => count++ });
    const events = heard(b);
    expect(b.press()).toBe(true);
    power.value = false;
    expect(b.press()).toBe(false);
    power.value = true;
    latch.value = true;
    expect(b.press()).toBe(false);
    expect(count).toBe(1);
    expect(events).toEqual(['press', 'press', 'press']);
  });

  it('lights its lamp only while powered', () => {
    const power = signal(false);
    const lamp = signal(true);
    const b = createMomentary({ power, lamp });
    expect(b.lit.value).toBe(false);
    power.value = true;
    expect(b.lit.value).toBe(true);
  });
});

describe('a two-position switch', () => {
  it('throws whether or not it is powered, and sounds which way', () => {
    const power = signal(false);
    const s = createSwitch({ power });
    const events = heard(s);
    expect(s.flip()).toBe(true);
    expect(s.state.value).toBe(true);
    expect(s.lit.value).toBe(false);
    power.value = true;
    expect(s.lit.value).toBe(true);
    s.flip();
    expect(events).toEqual(['on', 'off']);
  });

  it('will not move while latched, and says so', () => {
    const latch = signal(true);
    const s = createSwitch({ latch, initial: true });
    const events = heard(s);
    expect(s.flip()).toBe(false);
    expect(s.state.value).toBe(true);
    expect(events).toEqual(['refused']);
  });

  it('is moved silently by the model', () => {
    const s = createSwitch();
    const events = heard(s);
    s.set(true);
    expect(s.state.value).toBe(true);
    expect(events).toEqual([]);
  });
});

describe('a detented selector', () => {
  it('turns one detent at a time and stops at its ends', () => {
    const k = createSelector({ positions: 3 });
    const events = heard(k);
    expect(k.turn(-1)).toBe(false);
    expect(k.turn(1)).toBe(true);
    expect(k.turn(1)).toBe(true);
    expect(k.turn(1)).toBe(false);
    expect(k.position.value).toBe(2);
    expect(k.share.value).toBe(1);
    expect(events).toEqual(['end-stop', 'detent', 'detent', 'end-stop']);
  });

  it('shows a bound world value at its nearest detent and sets it', () => {
    const value = signal(0.52);
    const k = createSelector({
      positions: 21,
      bound: {
        get value() {
          return value.value;
        },
        set: (v) => (value.value = v),
      },
    });
    expect(k.position.value).toBe(10);
    k.turn(1);
    expect(value.value).toBeCloseTo(0.55);
  });

  it('will not turn while latched', () => {
    const k = createSelector({ positions: 3, latch: signal(true) });
    const events = heard(k);
    expect(k.turn(1)).toBe(false);
    expect(events).toEqual(['refused']);
  });
});

describe('a key-locked selector', () => {
  it('turns only once its key has unlocked it', () => {
    const lock = createKeyLockedSelector({ positions: 3 });
    expect(lock.selector.turn(1)).toBe(false);
    lock.key.flip();
    expect(lock.selector.turn(1)).toBe(true);
    lock.key.flip();
    expect(lock.selector.turn(1)).toBe(false);
    expect(lock.selector.position.value).toBe(1);
  });
});

describe('every component', () => {
  it('goes silent once disposed', () => {
    const b = createLedPushbutton();
    const events = heard(b);
    b.dispose();
    b.press();
    expect(events).toEqual([]);
  });
});

describe('component sounds', () => {
  it('names a sound for a transition, silences one, and leaves the rest to the room', () => {
    const s = createSwitch({
      sounds: { transitions: { on: 'clunk', off: null } },
    });
    const sounds: [PartEvent, string | null | undefined][] = [];
    s.onEvent((event, sound) => sounds.push([event, sound]));
    s.flip();
    s.flip();
    const latched = createSwitch({ latch: signal(true) });
    latched.onEvent((event, sound) => sounds.push([event, sound]));
    latched.flip();
    expect(sounds).toEqual([
      ['on', 'clunk'],
      ['off', null],
      ['refused', undefined],
    ]);
  });

  it('holds a state sound for as long as its state calls for it', () => {
    const power = signal(false);
    const rocker = createSwitch({
      power,
      sounds: { state: (s) => (s.on && s.powered ? 'mains hum' : null) },
    });
    expect(rocker.held.value).toBeNull();
    rocker.flip();
    expect(rocker.held.value).toBeNull();
    power.value = true;
    expect(rocker.held.value).toBe('mains hum');
    rocker.flip();
    expect(rocker.held.value).toBeNull();
  });

  it('can hold a different sound at each position of a selector', () => {
    const k = createSelector({
      positions: 3,
      sounds: { state: (s) => ['', 'low', 'high'][s.position] || null },
    });
    expect(k.held.value).toBeNull();
    k.turn(1);
    expect(k.held.value).toBe('low');
    k.turn(1);
    expect(k.held.value).toBe('high');
  });
});
