import { computed, signal } from '@preact/signals-core';
import type { ReadonlySignal } from '@preact/signals-core';

/**
 * The component model: each panel part's own behaviour, apart from the
 * world model. The world model says what is true of the installation (the
 * plant is powered); a component has inputs, a state, how it looks, and
 * the sounds it makes, and it behaves properly whether or not anything in
 * the world is wired to it. Pure logic: a view draws a component from its
 * outputs, and the room plays its sounds where the part is.
 *
 * Every component keeps to the same rules:
 *
 * - **Inputs** are Power (whether its circuit is live) and Latch (whether
 *   it is locked where it is), each a plain on or off.
 * - **State** has one source of truth: a world value it is bound to, or,
 *   unbound, a state of its own.
 * - **Operating** it is the operator's action. It always makes its sound;
 *   the guards (power, latch, end stops) decide whether the state changes;
 *   only an operation writes to the world.
 * - **Setting** it from the model moves it silently: no sound, no write
 *   back, so the world and the part cannot drive each other in circles.
 * - **Sounds** come in two kinds. A *transition* sound plays once when the
 *   part does something (`press`, `on`, `off`, `detent`, `end-stop`,
 *   `refused`); a *state* sound is held for as long as the part's state
 *   calls for it (a hum while on, a buzz while lit). A part may name its
 *   own sound for either; otherwise the room uses its default for that
 *   kind of part, and plays it where the part is.
 * - **dispose** drops its listeners, so a part in a hidden room is silent.
 */

/** Anything with a value that can be read, tracked: a signal or a vertex. */
export interface Readable<T> {
  readonly value: T;
}

/** Something in the world a component can show and set. */
export interface Binding<T> extends Readable<T> {
  set(value: T): void;
}

/** What a component did, for the room to make a sound of. */
export type PartEvent =
  /** A button or key pushed in. */
  | 'press'
  /** A two-position switch thrown on, or off. */
  | 'on'
  | 'off'
  /** A knob or selector clicked into its next detent. */
  | 'detent'
  /** A knob or selector turned against its end stop. */
  | 'end-stop'
  /** A part that would not move: latched, or locked by its key. */
  | 'refused';

/** What a part's state sound can depend on. */
export interface PartState {
  /** On, pressed in, or past its first position. */
  on: boolean;
  powered: boolean;
  latched: boolean;
  /** A selector's detent, from 0; a switch's 0 or 1. */
  position: number;
}

/** The sounds a part makes, by name, for the room to play. */
export interface PartSounds {
  /**
   * The sound for each transition. Left out, the room's default for the
   * kind of part plays; `null` makes the transition silent.
   */
  transitions?: Partial<Record<PartEvent, string | null>>;
  /** The sound held while the part's state calls for it, or none. */
  state?: (state: PartState) => string | null;
}

/** A transition, with the sound the part names for it, if any. */
export type PartListener = (
  event: PartEvent,
  sound: string | null | undefined,
) => void;

interface Common {
  power?: Readable<boolean>;
  latch?: Readable<boolean>;
  sounds?: PartSounds;
}

/** The listeners and sounds every component has. */
function events(sounds: PartSounds | undefined, state: () => PartState) {
  const listeners = new Set<PartListener>();
  return {
    emit(event: PartEvent) {
      const sound = sounds?.transitions?.[event];
      for (const listener of listeners) listener(event, sound);
    },
    /** The state sound it is making now, if any. */
    held: computed(() => sounds?.state?.(state()) ?? null),
    /** Hear what it does; returns a function that stops listening. */
    onEvent(listener: PartListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      listeners.clear();
    },
  };
}

/** A state that is a bound world value, or the part's own. */
function source<T>(bound: Binding<T> | undefined, initial: T) {
  const own = signal(initial);
  const value = computed(() => (bound ? bound.value : own.value));
  return {
    value,
    write(next: T) {
      if (bound) bound.set(next);
      else own.value = next;
    },
    /** Move it without a sound or an operation: the model moved it. */
    quietly(next: T) {
      own.value = next;
    },
  };
}

const inputs = ({ power, latch }: Common) => ({
  powered: computed(() => power?.value ?? true),
  latched: computed(() => latch?.value ?? false),
});

// ---- LED pushbutton ----------------------------------------------------------

export interface LedPushbuttonInputs extends Common {
  /** A world value it is wired to; unbound, it keeps its own state. */
  bound?: Binding<boolean>;
  initial?: boolean;
}

/**
 * An LED pushbutton, push-on, push-off.
 *
 * Inputs: Power and Latch. Output: its State, on or off.
 *
 * When pushed it always clicks, whatever its power and latch. With no
 * power its LED is always off and a press changes nothing; powered and
 * unlatched, a press toggles the state; powered and latched, a press does
 * not change the state. The LED shows the state while powered.
 */
export function createLedPushbutton(options: LedPushbuttonInputs = {}) {
  const { powered, latched } = inputs(options);
  const state = source(options.bound, options.initial ?? false);
  const lit = computed(() => powered.value && state.value.value);
  const e = events(options.sounds, () => ({
    on: state.value.value,
    powered: powered.value,
    latched: latched.value,
    position: state.value.value ? 1 : 0,
  }));
  return {
    kind: 'led pushbutton' as const,
    /** The state sound it is making now, if any. */
    held: e.held as ReadonlySignal<string | null>,
    state: state.value as ReadonlySignal<boolean>,
    lit: lit as ReadonlySignal<boolean>,
    powered: powered as ReadonlySignal<boolean>,
    latched: latched as ReadonlySignal<boolean>,
    /** Push it. Returns whether its state changed. */
    press(): boolean {
      e.emit('press');
      if (!powered.peek() || latched.peek()) return false;
      const next = !state.value.peek();
      state.write(next);
      return state.value.peek() === next;
    },
    /** The model moved it: unbound only, and silent. */
    set: (on: boolean) => state.quietly(on),
    onEvent: e.onEvent,
    dispose: e.dispose,
  };
}

// ---- Momentary pushbutton ----------------------------------------------------

export interface MomentaryInputs extends Common {
  /** What it does, when a press gets through. */
  action?: () => void;
  /** A lamp in it, lit by something else (and only while powered). */
  lamp?: Readable<boolean>;
}

/**
 * A momentary pushbutton, keycap or spring-return handle: it does its
 * action as it goes in and springs back by itself. It always clicks; the
 * action happens only while it is powered and unlatched. Its lamp, if it
 * has one, shows whatever drives it, while powered.
 */
export function createMomentary(options: MomentaryInputs = {}) {
  const { powered, latched } = inputs(options);
  const lit = computed(() => powered.value && (options.lamp?.value ?? false));
  const e = events(options.sounds, () => ({
    on: lit.value,
    powered: powered.value,
    latched: latched.value,
    position: 0,
  }));
  return {
    kind: 'momentary' as const,
    held: e.held as ReadonlySignal<string | null>,
    lit: lit as ReadonlySignal<boolean>,
    powered: powered as ReadonlySignal<boolean>,
    latched: latched as ReadonlySignal<boolean>,
    /** Push it. Returns whether its action happened. */
    press(): boolean {
      e.emit('press');
      if (!powered.peek() || latched.peek()) return false;
      options.action?.();
      return true;
    },
    onEvent: e.onEvent,
    dispose: e.dispose,
  };
}

// ---- Two-position switch -----------------------------------------------------

export interface SwitchInputs extends Common {
  bound?: Binding<boolean>;
  initial?: boolean;
}

/**
 * A two-position switch that stays where it is put: toggle, rocker, key
 * switch, isolator, wall switch. It is mechanical, so it throws whether or
 * not its circuit is live; Power only lights its lamp, if it has one. A
 * latched switch (guarded, padlocked, its key taken out) will not move.
 * It sounds `on` or `off` as it goes over, or `refused` when it will not.
 */
export function createSwitch(options: SwitchInputs = {}) {
  const { powered, latched } = inputs(options);
  const state = source(options.bound, options.initial ?? false);
  const lit = computed(() => powered.value && state.value.value);
  const e = events(options.sounds, () => ({
    on: state.value.value,
    powered: powered.value,
    latched: latched.value,
    position: state.value.value ? 1 : 0,
  }));
  return {
    kind: 'switch' as const,
    held: e.held as ReadonlySignal<string | null>,
    state: state.value as ReadonlySignal<boolean>,
    lit: lit as ReadonlySignal<boolean>,
    powered: powered as ReadonlySignal<boolean>,
    latched: latched as ReadonlySignal<boolean>,
    /** Throw it. Returns whether it moved. */
    flip(): boolean {
      if (latched.peek()) {
        e.emit('refused');
        return false;
      }
      const next = !state.value.peek();
      state.write(next);
      e.emit(next ? 'on' : 'off');
      return state.value.peek() === next;
    },
    set: (on: boolean) => state.quietly(on),
    onEvent: e.onEvent,
    dispose: e.dispose,
  };
}

// ---- Detented selector -------------------------------------------------------

export interface SelectorInputs extends Common {
  /** How many positions it clicks between: 21 for a 20-step knob. */
  positions: number;
  /**
   * A world value it is wired to, from 0 at the first position to 1 at
   * the last; a value between detents shows at the nearest.
   */
  bound?: Binding<number>;
  /** Its own position to begin with, when unbound. */
  initial?: number;
}

/**
 * A knob, rotary selector or slide switch with detents, turned one detent
 * at a time: -1 anticlockwise (down), 1 clockwise (up). It stops at its
 * ends rather than wrapping round. It is mechanical, so it turns whether
 * or not its circuit is live; latched, it will not turn. It sounds
 * `detent` for each step, `end-stop` against a stop and `refused` while
 * latched.
 */
export function createSelector(options: SelectorInputs) {
  const { powered, latched } = inputs(options);
  const last = Math.max(1, options.positions - 1);
  const toShare = (index: number) => index / last;
  const toIndex = (share: number) =>
    Math.max(0, Math.min(last, Math.round(share * last)));
  const share = source<number>(options.bound, toShare(options.initial ?? 0));
  const position = computed(() => toIndex(share.value.value));
  const e = events(options.sounds, () => ({
    on: position.value > 0,
    powered: powered.value,
    latched: latched.value,
    position: position.value,
  }));
  return {
    kind: 'selector' as const,
    held: e.held as ReadonlySignal<string | null>,
    positions: options.positions,
    /** The detent it is at, from 0. */
    position: position as ReadonlySignal<number>,
    /** Where it is through its travel, 0 to 1. */
    share: computed(() => toShare(position.value)) as ReadonlySignal<number>,
    powered: powered as ReadonlySignal<boolean>,
    latched: latched as ReadonlySignal<boolean>,
    /** Turn it one detent. Returns whether it moved. */
    turn(direction = 1): boolean {
      if (latched.peek()) {
        e.emit('refused');
        return false;
      }
      const from = position.peek();
      const to = Math.max(0, Math.min(last, from + Math.sign(direction)));
      if (to === from) {
        e.emit('end-stop');
        return false;
      }
      share.write(toShare(to));
      e.emit('detent');
      return true;
    },
    /** The model moved it: unbound only, and silent. */
    set: (index: number) => share.quietly(toShare(index)),
    onEvent: e.onEvent,
    dispose: e.dispose,
  };
}

// ---- Key-locked selector -----------------------------------------------------

/**
 * A selector whose hub is a lock: its key is a two-position switch, and
 * the selector is latched until the key is turned. Two components, one
 * driving the other's Latch.
 */
export function createKeyLockedSelector(
  options: Omit<SelectorInputs, 'latch'> & { unlocked?: boolean },
) {
  const key = createSwitch({ initial: options.unlocked ?? false });
  const selector = createSelector({
    ...options,
    latch: computed(() => !key.state.value),
  });
  return {
    kind: 'key-locked selector' as const,
    key,
    selector,
    dispose() {
      key.dispose();
      selector.dispose();
    },
  };
}

export type LedPushbutton = ReturnType<typeof createLedPushbutton>;
export type Momentary = ReturnType<typeof createMomentary>;
export type Switch = ReturnType<typeof createSwitch>;
export type Selector = ReturnType<typeof createSelector>;
export type KeyLockedSelector = ReturnType<typeof createKeyLockedSelector>;
