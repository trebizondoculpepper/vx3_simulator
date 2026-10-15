import { CHANNEL_HZ } from './ferrocore-anomaly';

/**
 * Every dial on the end-state effects, spelled out so the effects room
 * (`/?room=dev1`) can turn each one by hand. `settingsForActivity` gives the
 * values the lab uses today, so `effectFrame` of those settings is exactly
 * what `anomalyEffects` produces; anything else is an experiment.
 */
export interface EffectSettings {
  warp: {
    /** Overall strength, 0 (flat); the lab reaches 1. */
    amount: number;
    /** Twist about the line of sight: peak angle, radians. */
    twist: number;
    /** How quickly the twist changes with distance, per scene unit. */
    twistFrequency: number;
    /** How fast the twist travels, radians per second. */
    twistSpeed: number;
    /** Swell of distances: peak fraction. */
    swell: number;
    swellFrequency: number;
    swellSpeed: number;
    /**
     * Where the bending is centred, metres on the floor plan, and how far
     * it reaches (at that radius it is down to a third). A radius of 0
     * bends all of space alike, as the lab does today.
     */
    centreX: number;
    centreZ: number;
    radius: number;
  };
  pi: {
    /** A fixed error added to π. */
    offset: number;
    /** Depth of the slow wander the lab uses, 0 (none) to 1 (strongest). */
    wander: number;
  };
  phaser: {
    /** How far each colour channel swings either side of 1. */
    depth: number;
    /** Each channel's rate, Hz: red, green, blue. */
    hz: [number, number, number];
    /** Phase step from one channel to the next, radians. */
    spread: number;
  };
  /** Red, green and blue disagreeing about where things are. */
  divergence: {
    /** How far red and blue swing apart sideways, pixels of the PS1 picture. */
    horizontalPx: number;
    /** How far they swing apart up and down, pixels. */
    verticalPx: number;
    /** How often the sideways swing repeats, Hz; 0 holds it at full split. */
    horizontalHz: number;
    /** How often the up-and-down swing repeats, Hz. */
    verticalHz: number;
    /** Sideways parallax, pixels at one metre, falling off with distance. */
    parallax: number;
  };
  /** The universe losing numerical precision. */
  precision: {
    /** Positions snap to a grid this many metres across; 0 is off. */
    grid: number;
    /** How far each snapped point trembles, as a fraction of a cell. */
    tremble: number;
    /** How often the trembling changes, per second. */
    flickerHz: number;
  };
}

/** What the lab's ferrocores do at this activity, 0 to 1. */
export function settingsForActivity(activity: number): EffectSettings {
  const a = Math.max(0, Math.min(1, activity));
  return {
    warp: {
      amount: a ** 1.5,
      twist: 0.2,
      twistFrequency: 0.33,
      twistSpeed: 0.6,
      swell: 0.07,
      swellFrequency: 0.21,
      swellSpeed: 0.4,
      centreX: 0,
      centreZ: 0,
      radius: 0,
    },
    pi: { offset: 0, wander: a * a },
    phaser: { depth: 0.28 * a, hz: [...CHANNEL_HZ], spread: 2.1 },
    divergence: {
      horizontalPx: 0,
      verticalPx: 0,
      horizontalHz: 0.2,
      verticalHz: 0.2,
      parallax: 0,
    },
    precision: { grid: 0, tremble: 0.5, flickerHz: 12 },
  };
}

/** The effects the console can bypass, one per row. */
export const EFFECT_NAMES = [
  'warp',
  'field',
  'precision',
  'pi',
  'phaser',
  'divergence',
] as const;
export type EffectName = (typeof EFFECT_NAMES)[number];

/**
 * The settings with each bypassed effect switched off, leaving the rest
 * (and the settings themselves, so the knobs keep their places) alone. A
 * bypassed field bends all of space alike, as the lab does.
 */
export function withBypass(
  settings: EffectSettings,
  bypassed: ReadonlySet<EffectName>,
): EffectSettings {
  const off = (name: EffectName) => bypassed.has(name);
  return {
    warp: {
      ...settings.warp,
      amount: off('warp') ? 0 : settings.warp.amount,
      radius: off('field') ? 0 : settings.warp.radius,
    },
    pi: off('pi') ? { offset: 0, wander: 0 } : { ...settings.pi },
    phaser: {
      ...settings.phaser,
      hz: [...settings.phaser.hz],
      depth: off('phaser') ? 0 : settings.phaser.depth,
    },
    divergence: off('divergence')
      ? {
          ...settings.divergence,
          horizontalPx: 0,
          verticalPx: 0,
          parallax: 0,
        }
      : { ...settings.divergence },
    precision: {
      ...settings.precision,
      grid: off('precision') ? 0 : settings.precision.grid,
    },
  };
}

/** The effects' values at this moment. */
export function effectFrame(settings: EffectSettings, seconds: number) {
  const { warp, pi, phaser, divergence, precision } = settings;
  return {
    channels: phaser.hz.map(
      (hz, i) =>
        1 +
        phaser.depth * Math.sin(seconds * hz * Math.PI * 2 + i * phaser.spread),
    ) as [number, number, number],
    pi:
      Math.PI +
      pi.offset +
      pi.wander *
        (0.035 * Math.sin(seconds * 0.13) + 0.012 * Math.sin(seconds * 0.71)),
    warp: warp.amount,
    twist: [warp.twist, warp.twistFrequency, warp.twistSpeed] as const,
    swell: [warp.swell, warp.swellFrequency, warp.swellSpeed] as const,
    /** The warp's centre and reach, metres; a reach of 0 is everywhere. */
    field: [warp.centreX, warp.centreZ, warp.radius] as const,
    divergence: { ...divergence },
    /** Grid in metres, tremble as a fraction, flicker per second. */
    precision: [
      precision.grid,
      precision.tremble,
      precision.flickerHz,
    ] as const,
  };
}

/** What a recording holds besides the effects: the room's own state. */
export interface EffectRoomState {
  /** The lab activity the presets were last set to. */
  activity: number;
  /** How fast effect time runs. */
  timeSpeed: number;
  /** The effect clock when recorded, seconds; it sets the wander and phases. */
  effectSeconds: number;
  /** Exhibits kept whole against lost precision. */
  exempt: string[];
  /** Effects switched off on the console, whatever their knobs say. */
  bypassed: EffectName[];
}

/**
 * A saved set of effect settings: what the effects room's RECORD button
 * writes out as a JSON file, and what `readEffectRecording` loads back.
 */
export interface EffectRecording {
  format: 'vx3-effects';
  version: 1;
  /** Which recording this was in its session, from 1. */
  number: number;
  /** When it was made, as an ISO timestamp. */
  recorded: string;
  settings: EffectSettings;
  room: EffectRoomState;
}

export function effectRecording(
  settings: EffectSettings,
  room: EffectRoomState,
  number: number,
  recorded: Date,
): EffectRecording {
  return {
    format: 'vx3-effects',
    version: 1,
    number,
    recorded: recorded.toISOString(),
    settings: structuredClone(settings),
    room: structuredClone(room),
  };
}

/** The file name a recording is saved under. */
export function recordingFileName(recording: EffectRecording) {
  const stamp = recording.recorded
    .replace(/\.\d+Z$/, '')
    .replace(/[-:]/g, '')
    .replace('T', '-');
  return `vx3-effects-${stamp}-${String(recording.number).padStart(2, '0')}.json`;
}

/**
 * Load a recording, accepting the parsed JSON or its text. Anything a
 * recording leaves out, or holds in the wrong form, falls back to the
 * lab's settings at no activity, so an older recording still loads after
 * new dials are added.
 */
export function readEffectRecording(input: unknown): EffectRecording {
  const data: unknown = typeof input === 'string' ? JSON.parse(input) : input;
  const record = (data ?? {}) as Partial<EffectRecording>;
  if (record.format !== 'vx3-effects')
    throw new Error('Not a VX3 effects recording.');
  const merge = <T>(base: T, given: unknown): T => {
    if (Array.isArray(base)) {
      return (
        Array.isArray(given) &&
        given.length === base.length &&
        given.every((v) => typeof v === 'number' && Number.isFinite(v))
          ? [...given]
          : base
      ) as T;
    }
    if (typeof base === 'number')
      return (
        typeof given === 'number' && Number.isFinite(given) ? given : base
      ) as T;
    if (base && typeof base === 'object') {
      const out = { ...base } as Record<string, unknown>;
      const from = (given ?? {}) as Record<string, unknown>;
      for (const key of Object.keys(out)) out[key] = merge(out[key], from[key]);
      return out as T;
    }
    return base;
  };
  const room = (record.room ?? {}) as Partial<EffectRoomState>;
  return {
    format: 'vx3-effects',
    version: 1,
    number: typeof record.number === 'number' ? record.number : 0,
    recorded: typeof record.recorded === 'string' ? record.recorded : '',
    settings: merge(settingsForActivity(0), record.settings),
    room: {
      activity: merge(0, room.activity),
      timeSpeed: merge(1, room.timeSpeed),
      effectSeconds: merge(0, room.effectSeconds),
      exempt: Array.isArray(room.exempt)
        ? room.exempt.filter((v): v is string => typeof v === 'string')
        : [],
      bypassed: Array.isArray(room.bypassed)
        ? room.bypassed.filter((v): v is EffectName =>
            (EFFECT_NAMES as readonly unknown[]).includes(v),
          )
        : [],
    },
  };
}

/** A recording as it is typed on the effects room's printer. */
export function printRecording(recording: EffectRecording) {
  const { settings: s, room } = recording;
  const f = (value: number, digits = 2) => value.toFixed(digits);
  const w = s.warp;
  const p = s.phaser;
  const d = s.divergence;
  const q = s.precision;
  return [
    `RECORDING ${String(recording.number).padStart(2, '0')}  ${recording.recorded.slice(0, 19).replace('T', ' ')}`,
    `LAB ACT ${f(room.activity)}  TIME X${f(room.timeSpeed)}  T ${f(room.effectSeconds, 1)}`,
    `WARP AMT ${f(w.amount)} TWIST ${f(w.twist, 3)} F ${f(w.twistFrequency)} S ${f(w.twistSpeed)}`,
    `     SWELL ${f(w.swell, 3)} F ${f(w.swellFrequency)} S ${f(w.swellSpeed)}`,
    `FIELD X ${f(w.centreX)} Z ${f(w.centreZ)} REACH ${f(w.radius)}`,
    `PRECISION GRID ${f(q.grid, 3)} TREMBLE ${f(q.tremble)} FLICKER ${f(q.flickerHz, 1)}`,
    `PI OFFSET ${f(s.pi.offset, 3)} WANDER ${f(s.pi.wander)}`,
    `PHASER DEPTH ${f(p.depth)} HZ ${p.hz.map((v) => f(v)).join('/')} SPREAD ${f(p.spread)}`,
    `DIVERGE H ${f(d.horizontalPx, 1)}PX ${f(d.horizontalHz)}HZ V ${f(d.verticalPx, 1)}PX ${f(d.verticalHz)}HZ PARALLAX ${f(d.parallax, 1)}`,
    `BYPASSED ${room.bypassed.length ? room.bypassed.join(', ').toUpperCase() : 'NONE'}`,
    `KEPT WHOLE ${room.exempt.length ? room.exempt.join(', ').toUpperCase() : 'NONE'}`,
    `FILE ${recordingFileName(recording)}`,
    '-'.repeat(48),
  ].join('\n');
}

/** What the effects follow on a running machine. */
export interface MachineEffectInputs {
  /** The ferrocores' activity, 0 to 1. */
  activity: number;
  /**
   * How fully activated the machine is, 0 to 1: 1 while it is fully
   * operational, eased in and out over a few seconds by the caller.
   */
  full: number;
  /** How far the machine has overheated, 0 (not at all) to 1 (critical). */
  overheat: number;
  /** How far the field is from equilibrium, 0 to 1. */
  instability: number;
  /** Where the machine's rotor stands, metres on the floor plan. */
  centreX: number;
  centreZ: number;
  /**
   * Where the watcher stands, metres on the floor plan: the effects fall
   * away with distance from the rotor (`fieldExposure`). Left out, they
   * are felt at full strength, as beside the machine.
   */
  viewerX?: number;
  viewerZ?: number;
}

/** Within this distance of the rotor, metres, the effects are full. */
export const FIELD_NEAR = 1.5;
/** From this distance, metres, nothing is felt at all. */
export const FIELD_FAR = 10;

const smoothstep = (from: number, to: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

/**
 * How strongly the machine's effects reach someone `metres` from its
 * rotor, 0 to 1: full within FIELD_NEAR, then falling with the inverse
 * square of the distance (a quarter at 3 m, a sixteenth at 6 m), and
 * tapering to nothing at FIELD_FAR, where the inverse square alone would
 * still leave a trace.
 */
export function fieldExposure(metres: number) {
  const d = Math.max(0, metres);
  if (d >= FIELD_FAR) return 0;
  const inverseSquare = d <= FIELD_NEAR ? 1 : (FIELD_NEAR / d) ** 2;
  return inverseSquare * (1 - smoothstep(FIELD_FAR * 0.7, FIELD_FAR, d));
}

/**
 * The effects a running machine has on the room around it.
 *
 * Nothing much happens until the machine is close to activation. As the
 * cores' activity climbs to where full operation begins, lost precision
 * and colour divergence fade in together, mildly: everything trembling a
 * little, red and blue disagreeing at the edges. Running normally, even
 * fully, that is all.
 *
 * Overheating, it gets steadily worse: the walls start to breathe, a slow
 * swell of distances in long waves about every six seconds, stronger as
 * the core nears critical; the trembling and the divergence double; π
 * comes loose and the colours breathe with it. An unstable field quickens
 * the breathing. Centred on the machine's rotor, and falling away with
 * the inverse square of the watcher's distance from it: walking away
 * helps, and ten metres off nothing is felt.
 */
export function settingsForMachine(
  machine: MachineEffectInputs,
): EffectSettings {
  const a = Math.max(0, Math.min(1, machine.activity));
  const full = Math.max(0, Math.min(1, machine.full));
  const hot = Math.max(0, Math.min(1, machine.overheat));
  const unsettled = Math.max(0, Math.min(1, machine.instability));
  const settings = settingsForActivity(0);
  // Mild, near activation; doubled by the time it is critical.
  const near = smoothstep(0.6, 0.85, a);
  const mild = Math.min(1, near + hot);
  const worse = 1 + hot;
  if (mild > 0) {
    settings.precision.grid = (0.0004 + 0.0016 * mild) * worse;
    settings.precision.tremble = 0.3 + 0.4 * mild;
    settings.precision.flickerHz = 12;
  }
  settings.divergence.horizontalPx = 3 * mild * worse;
  settings.divergence.verticalPx = 1.2 * mild * worse;
  settings.divergence.parallax = 5 * mild * worse;
  // Overheating only: the room breathes.
  settings.warp.amount = 0.12 * hot;
  settings.warp.centreX = machine.centreX;
  settings.warp.centreZ = machine.centreZ;
  settings.warp.radius = hot > 0 ? 3 + 5 * hot : 0;
  settings.warp.twist = 0.04;
  settings.warp.twistSpeed = 0.3 * (1 + unsettled * 2);
  settings.warp.swell = 0.1;
  settings.warp.swellFrequency = 0.12;
  settings.warp.swellSpeed = ((Math.PI * 2) / 6) * (1 + unsettled);
  settings.pi.wander = 0.3 * hot;
  settings.phaser.depth = 0.03 * near + 0.03 * full + 0.1 * hot;
  // Felt less the further the watcher stands from the rotor.
  const reach =
    machine.viewerX === undefined || machine.viewerZ === undefined
      ? 1
      : fieldExposure(
          Math.hypot(
            machine.viewerX - machine.centreX,
            machine.viewerZ - machine.centreZ,
          ),
        );
  settings.precision.grid *= reach;
  settings.divergence.horizontalPx *= reach;
  settings.divergence.verticalPx *= reach;
  settings.divergence.parallax *= reach;
  settings.warp.amount *= reach;
  settings.pi.wander *= reach;
  settings.phaser.depth *= reach;
  return settings;
}

/**
 * How much of its divergence the machine shows at a moment, 0 to 1: it
 * swells up to its full amount and falls away again, smoothly, once every
 * `period` seconds, so red and blue drift apart and come back together.
 */
export function divergencePulse(seconds: number, period = 7) {
  return 0.5 - 0.5 * Math.cos((seconds / period) * Math.PI * 2);
}
