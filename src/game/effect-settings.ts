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
    /** Radial: the fraction red and blue are scaled about the centre. */
    radial: number;
    /** A turning shift, pixels of the PS1 picture. */
    shift: number;
    /** Parallax, pixels at one metre, falling off with distance. */
    parallax: number;
    /** How fast the shift turns, revolutions per second. */
    wobbleHz: number;
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
    divergence: { radial: 0, shift: 0, parallax: 0, wobbleHz: 0.2 },
    precision: { grid: 0, tremble: 0.5, flickerHz: 12 },
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
